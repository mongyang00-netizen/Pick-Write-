import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  PRIVACY_WARNING_MESSAGE,
  detectPersonalInfo,
  detectPersonalInfoInPlan,
  getFallbackFeedback,
} from '../utils/writingLogic.ts';
import { classifyGeminiError, runWithBoundedRetry } from '../utils/geminiErrors.ts';
import {
  parseAndValidateCoachFeedback,
  parseAndValidateRevisionCheck,
} from '../utils/aiPayload.ts';
import {
  COCO_FEEDBACK_INSTRUCTION,
  COCO_REVISION_INSTRUCTION,
  buildCoachFeedbackPrompt,
  buildRevisionCheckPrompt,
} from '../utils/coachPrompt.ts';
import type { PlanAnswers, SupportLevel, TopicId } from '../types.ts';

export { COCO_FEEDBACK_INSTRUCTION, COCO_REVISION_INSTRUCTION };

export const GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_BACKUP_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_ATTEMPT_TIMEOUT_MS = 22000;
export const GEMINI_MAX_TOTAL_MS = 48000;
export const GEMINI_RETRY_DELAY_MS = 1200;

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export interface ApiRequest {
  method?: string;
  body?: unknown;
  on?: IncomingMessage['on'];
  removeListener?: IncomingMessage['removeListener'];
}

export interface ApiResponse {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
}

interface GeminiDiagnosticEntry {
  timestamp: string;
  endpoint: string;
  model: string;
  stage: 'attempt' | 'backup' | 'final';
  attempt?: number;
  category: string;
  httpStatus: number;
  detail: string;
  payloadStage?: string;
  finishReason?: string;
  missingFields?: string[];
  invalidFields?: string[];
}

const recentGeminiErrors: GeminiDiagnosticEntry[] = [];

function recordGeminiError(entry: Omit<GeminiDiagnosticEntry, 'timestamp'>) {
  recentGeminiErrors.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (recentGeminiErrors.length > 12) {
    recentGeminiErrors.length = 12;
  }
}

function sendJson(res: ApiResponse, statusCode: number, payload: unknown): void {
  const statusFn = res.status;
  const jsonFn = res.json;
  if (typeof statusFn === 'function' && typeof jsonFn === 'function') {
    const target = statusFn.call(res, statusCode);
    if (target && typeof target.json === 'function') {
      target.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !Array.isArray(req.body)) {
      return req.body as Record<string, unknown>;
    }
    const rawText = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
      ? req.body
      : '';
    if (!rawText.trim()) return {};
    const parsed = JSON.parse(rawText) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }

  const onFn = req.on;
  if (typeof onFn !== 'function') {
    return {};
  }

  const rawText = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = () => {
      req.removeListener?.('data', onData);
      req.removeListener?.('end', onEnd);
      req.removeListener?.('error', onError);
    };

    const onData = (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
      totalBytes += buf.length;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        settled = true;
        cleanup();
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(buf);
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8'));
    };

    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    onFn.call(req, 'data', onData);
    onFn.call(req, 'end', onEnd);
    onFn.call(req, 'error', onError);
  });

  if (!rawText.trim()) return {};
  const parsed = JSON.parse(rawText) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function getConfiguredGeminiApiKey(): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return apiKey;
}

function getGeminiClient(timeoutMs = GEMINI_ATTEMPT_TIMEOUT_MS): GoogleGenAI {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY: GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function withTimeout<T>(promise: Promise<T>, ms = GEMINI_ATTEMPT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function runGeminiCallWithResilience<T>(params: {
  endpoint: string;
  enableBackupModel?: boolean;
  invoke: (model: string, attemptTimeoutMs: number) => Promise<T>;
}): Promise<{ data: T; modelUsed: string; usedBackupModel: boolean }> {
  const startedAt = Date.now();
  try {
    const data = await runWithBoundedRetry(
      async (_attempt, remainingMs) => {
        const timeoutMs = Math.max(1000, Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remainingMs));
        return await withTimeout(params.invoke(GEMINI_PRIMARY_MODEL, timeoutMs), timeoutMs);
      },
      {
        maxAttempts: 2,
        retryDelayMs: GEMINI_RETRY_DELAY_MS,
        maxTotalMs: GEMINI_MAX_TOTAL_MS,
        minRemainingForRetryMs: 11000,
        onAttemptError: (attempt, classified) => {
          recordGeminiError({
            endpoint: params.endpoint,
            model: GEMINI_PRIMARY_MODEL,
            stage: 'attempt',
            attempt,
            category: classified.category,
            httpStatus: classified.httpStatus,
            detail: classified.detail,
            payloadStage: classified.payloadStage,
            finishReason: classified.finishReason,
            missingFields: classified.missingFields,
            invalidFields: classified.invalidFields,
          });
          console.error('[Gemini Attempt Failed]', {
            endpoint: params.endpoint,
            model: GEMINI_PRIMARY_MODEL,
            attempt,
            category: classified.category,
            status: classified.httpStatus,
            payloadStage: classified.payloadStage,
            finishReason: classified.finishReason,
            missingFields: classified.missingFields,
            invalidFields: classified.invalidFields,
            detail: classified.detail,
          });
        },
      }
    );
    return { data, modelUsed: GEMINI_PRIMARY_MODEL, usedBackupModel: false };
  } catch (primaryErr) {
    const classified = classifyGeminiError(primaryErr);
    const remainingMs = GEMINI_MAX_TOTAL_MS - (Date.now() - startedAt);
    const canTryBackup =
      Boolean(params.enableBackupModel) &&
      classified.autoRetryable &&
      remainingMs >= 14000;

    if (!canTryBackup) {
      throw primaryErr;
    }

    const backupTimeoutMs = Math.max(1000, Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remainingMs - 500));
    try {
      const data = await withTimeout(
        params.invoke(GEMINI_BACKUP_MODEL, backupTimeoutMs),
        backupTimeoutMs
      );
      return { data, modelUsed: GEMINI_BACKUP_MODEL, usedBackupModel: true };
    } catch (backupErr) {
      const backupClassified = classifyGeminiError(backupErr);
      recordGeminiError({
        endpoint: params.endpoint,
        model: GEMINI_BACKUP_MODEL,
        stage: 'backup',
        category: backupClassified.category,
        httpStatus: backupClassified.httpStatus,
        detail: backupClassified.detail,
        payloadStage: backupClassified.payloadStage,
        finishReason: backupClassified.finishReason,
        missingFields: backupClassified.missingFields,
        invalidFields: backupClassified.invalidFields,
      });
      console.error('[Gemini Backup Model Failed]', {
        endpoint: params.endpoint,
        model: GEMINI_BACKUP_MODEL,
        category: backupClassified.category,
        status: backupClassified.httpStatus,
        payloadStage: backupClassified.payloadStage,
        finishReason: backupClassified.finishReason,
        missingFields: backupClassified.missingFields,
        invalidFields: backupClassified.invalidFields,
        detail: backupClassified.detail,
      });
      throw backupErr;
    }
  }
}

export async function handleHealth(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    model: GEMINI_PRIMARY_MODEL,
    backupModel: GEMINI_BACKUP_MODEL,
    hasGeminiKey: Boolean(getConfiguredGeminiApiKey()),
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    ...(process.env.NODE_ENV !== 'production' ? { recentGeminiErrors } : {}),
  });
}

export async function handleCoachFeedback(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method && req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await readJsonBody(req);
  } catch (err) {
    const isTooLarge = err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE';
    sendJson(res, isTooLarge ? 413 : 400, {
      ok: false,
      errorCategory: 'bad_request',
      retryable: false,
      error: isTooLarge ? 'Request body is too large.' : 'Invalid JSON request body.',
    });
    return;
  }

  const body = rawBody as {
    topic?: TopicId;
    topicTitle?: string;
    level?: SupportLevel;
    planAnswers?: PlanAnswers;
    draft?: string;
    focusRound?: 1 | 2;
    previousFocus?: {
      fixPoint?: string;
      question?: string;
    };
  };

  const topic: TopicId =
    body.topic === 'place' || body.topic === 'hobby' ? body.topic : 'food';
  const topicTitle =
    typeof body.topicTitle === 'string' ? body.topicTitle.slice(0, 60) : 'My Favorite Food';
  const level: SupportLevel = body.level === 2 || body.level === 3 ? body.level : 1;
  const focusRound = body.focusRound === 2 ? 2 : 1;
  const previousFocus =
    body.previousFocus && typeof body.previousFocus === 'object'
      ? {
          fixPoint:
            typeof body.previousFocus.fixPoint === 'string'
              ? body.previousFocus.fixPoint.trim()
              : '',
          question:
            typeof body.previousFocus.question === 'string'
              ? body.previousFocus.question.trim()
              : '',
        }
      : undefined;
  const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
  const planAnswers: PlanAnswers = {
    q1: typeof body.planAnswers?.q1 === 'string' ? body.planAnswers.q1.trim() : '',
    q2: typeof body.planAnswers?.q2 === 'string' ? body.planAnswers.q2.trim() : '',
    q3: typeof body.planAnswers?.q3 === 'string' ? body.planAnswers.q3.trim() : '',
    q4: typeof body.planAnswers?.q4 === 'string' ? body.planAnswers.q4.trim() : '',
  };

  if (!draft) {
    sendJson(res, 400, {
      ok: false,
      errorCategory: 'bad_request',
      retryable: false,
      error: 'Please write a short draft before asking Coco for a hint.',
    });
    return;
  }

  const draftPii = detectPersonalInfo(draft);
  const planPii = detectPersonalInfoInPlan(planAnswers);
  if (draftPii.hasPII || planPii.hasPII) {
    sendJson(res, 400, {
      ok: false,
      piiBlocked: true,
      errorCategory: 'bad_request',
      retryable: false,
      error: PRIVACY_WARNING_MESSAGE,
    });
    return;
  }

  const prompt = buildCoachFeedbackPrompt({
    topic,
    topicTitle,
    level,
    planAnswers,
    draft,
    focusRound,
    previousFocus,
  });

  try {
    const { data: parsed, modelUsed, usedBackupModel } = await runGeminiCallWithResilience({
      endpoint: '/api/coach/feedback',
      enableBackupModel: true,
      invoke: async (model, timeoutMs) => {
        const ai = getGeminiClient(timeoutMs);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: COCO_FEEDBACK_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                noMoreIssues: {
                  type: Type.BOOLEAN,
                  description:
                    'true only when no important issue needs fixing; false when giving a Fix and Hints 1-3.',
                },
                praise: {
                  type: Type.STRING,
                  description: 'Always non-empty warm English praise.',
                },
                fixPoint: {
                  type: Type.STRING,
                  description:
                    'Required non-empty 1 focus issue when noMoreIssues=false; empty string "" when noMoreIssues=true.',
                },
                question: {
                  type: Type.STRING,
                  description:
                    'Required non-empty Hint 1 guiding question when noMoreIssues=false; empty string "" when noMoreIssues=true.',
                },
                highlightText: {
                  type: Type.STRING,
                  description:
                    'Exact 1-6 word substring from Draft, or "" if something is missing or noMoreIssues=true.',
                },
                hint2: {
                  type: Type.STRING,
                  description:
                    'Required non-empty Hint 2 closer clue for fixPoint when noMoreIssues=false; "" when noMoreIssues=true.',
                },
                hint3: {
                  type: Type.STRING,
                  description:
                    'Required non-empty Hint 3 same-pattern example on unrelated words when noMoreIssues=false; "" when noMoreIssues=true.',
                },
                praiseKo: {
                  type: Type.STRING,
                  description: 'Natural Korean translation of praise.',
                },
                fixPointKo: {
                  type: Type.STRING,
                  description: 'Natural Korean translation of fixPoint ("" if noMoreIssues=true).',
                },
                questionKo: {
                  type: Type.STRING,
                  description: 'Natural Korean translation of question ("" if noMoreIssues=true).',
                },
                hint2Ko: {
                  type: Type.STRING,
                  description: 'Natural Korean translation of hint2 ("" if noMoreIssues=true).',
                },
                hint3Ko: {
                  type: Type.STRING,
                  description:
                    'Korean translation in Hangul (한국어 번역) of the hint3 example sentence ("" if noMoreIssues=true). Never leave in English.',
                },
                writingTip: {
                  type: Type.STRING,
                  description:
                    'Optional short A2 expression tip ONLY when noMoreIssues=true and genuinely helpful; "" when not needed or when noMoreIssues=false.',
                },
                writingTipKo: {
                  type: Type.STRING,
                  description:
                    'Natural Korean translation in Hangul of writingTip ("" when writingTip is empty or noMoreIssues=false).',
                },
              },
              required: [
                'noMoreIssues',
                'praise',
                'fixPoint',
                'question',
                'highlightText',
                'hint2',
                'hint3',
                'praiseKo',
                'fixPointKo',
                'questionKo',
                'hint2Ko',
                'hint3Ko',
              ],
            },
          },
        });

        const finishReason = response.candidates?.[0]?.finishReason
          ? String(response.candidates[0].finishReason)
          : undefined;
        const rawText = response.text ?? '';
        return parseAndValidateCoachFeedback({
          rawText,
          finishReason,
        });
      },
    });

    const feedbackSource = usedBackupModel ? 'gemini_backup' : 'gemini_primary';
    console.info('[Coco Feedback Path]', {
      endpoint: '/api/coach/feedback',
      feedbackSource,
      modelUsed,
      usedFallback: false,
      usedBackupModel,
      focusRound,
      level,
      topic,
      noMoreIssues: Boolean(parsed.noMoreIssues),
    });

    sendJson(res, 200, {
      ok: true,
      usedFallback: false,
      feedbackSource,
      modelUsed,
      usedBackupModel,
      noMoreIssues: Boolean(parsed.noMoreIssues),
      feedback: {
        ...parsed,
        isFallback: false,
      },
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    recordGeminiError({
      endpoint: '/api/coach/feedback',
      model: GEMINI_PRIMARY_MODEL,
      stage: 'final',
      category: classified.category,
      httpStatus: classified.httpStatus,
      detail: classified.detail,
      payloadStage: classified.payloadStage,
      finishReason: classified.finishReason,
      missingFields: classified.missingFields,
      invalidFields: classified.invalidFields,
    });
    console.error('[Gemini Feedback Final Error]', {
      endpoint: '/api/coach/feedback',
      feedbackSource: 'rule_fallback',
      usedFallback: true,
      model: GEMINI_PRIMARY_MODEL,
      focusRound,
      level,
      topic,
      category: classified.category,
      httpStatus: classified.httpStatus,
      payloadStage: classified.payloadStage,
      finishReason: classified.finishReason,
      missingFields: classified.missingFields,
      invalidFields: classified.invalidFields,
      detail: classified.detail,
    });
    const fallback = getFallbackFeedback(topic, draft, level);
    sendJson(res, classified.httpStatus, {
      ok: false,
      usedFallback: true,
      feedbackSource: 'rule_fallback',
      modelUsed: null,
      errorCategory: classified.category,
      retryable: classified.retryable,
      error: classified.userMessage,
      errorKo: classified.userMessageKo,
      feedback: fallback,
    });
  }
}

export async function handleCheckRevision(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method && req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await readJsonBody(req);
  } catch (err) {
    const isTooLarge = err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE';
    sendJson(res, isTooLarge ? 413 : 400, {
      ok: false,
      errorCategory: 'bad_request',
      retryable: false,
      error: isTooLarge ? 'Request body is too large.' : 'Invalid JSON request body.',
    });
    return;
  }

  const body = rawBody as {
    firstDraft?: string;
    revisedDraft?: string;
    fixPoint?: string;
    question?: string;
  };

  const firstDraft = typeof body.firstDraft === 'string' ? body.firstDraft.trim() : '';
  const revisedDraft = typeof body.revisedDraft === 'string' ? body.revisedDraft.trim() : '';
  const fixPoint = typeof body.fixPoint === 'string' ? body.fixPoint.trim() : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';

  if (!revisedDraft) {
    sendJson(res, 400, {
      ok: false,
      errorCategory: 'bad_request',
      retryable: false,
      error: 'Please write your revised paragraph before checking.',
    });
    return;
  }

  const pii = detectPersonalInfo(revisedDraft);
  if (pii.hasPII) {
    sendJson(res, 400, {
      ok: false,
      piiBlocked: true,
      errorCategory: 'bad_request',
      retryable: false,
      error: PRIVACY_WARNING_MESSAGE,
    });
    return;
  }

  const prompt = buildRevisionCheckPrompt({
    firstDraft,
    revisedDraft,
    fixPoint,
    question,
  });

  try {
    const { data: parsed, modelUsed, usedBackupModel } = await runGeminiCallWithResilience({
      endpoint: '/api/coach/check-revision',
      enableBackupModel: true,
      invoke: async (model, timeoutMs) => {
        const ai = getGeminiClient(timeoutMs);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: COCO_REVISION_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                addressedFeedback: { type: Type.BOOLEAN },
                praise: { type: Type.STRING },
                praiseKo: { type: Type.STRING },
                nextSuggestion: { type: Type.STRING },
                nextSuggestionKo: { type: Type.STRING },
              },
              required: [
                'addressedFeedback',
                'praise',
                'praiseKo',
                'nextSuggestion',
                'nextSuggestionKo',
              ],
            },
          },
        });

        const finishReason = response.candidates?.[0]?.finishReason
          ? String(response.candidates[0].finishReason)
          : undefined;
        const rawText = response.text ?? '';
        return parseAndValidateRevisionCheck({
          rawText,
          finishReason,
        });
      },
    });

    const feedbackSource = usedBackupModel ? 'gemini_backup' : 'gemini_primary';
    console.info('[Coco Revision Check Path]', {
      endpoint: '/api/coach/check-revision',
      feedbackSource,
      modelUsed,
      usedFallback: false,
      usedBackupModel,
      addressedFeedback: Boolean(parsed.addressedFeedback),
    });

    sendJson(res, 200, {
      ok: true,
      usedFallback: false,
      feedbackSource,
      modelUsed,
      usedBackupModel,
      result: {
        ...parsed,
        isFallback: false,
      },
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    recordGeminiError({
      endpoint: '/api/coach/check-revision',
      model: GEMINI_PRIMARY_MODEL,
      stage: 'final',
      category: classified.category,
      httpStatus: classified.httpStatus,
      detail: classified.detail,
      payloadStage: classified.payloadStage,
      finishReason: classified.finishReason,
      missingFields: classified.missingFields,
      invalidFields: classified.invalidFields,
    });
    console.error('[Gemini Revision Check Final Error]', {
      endpoint: '/api/coach/check-revision',
      feedbackSource: 'error_no_fallback',
      usedFallback: false,
      model: GEMINI_PRIMARY_MODEL,
      category: classified.category,
      httpStatus: classified.httpStatus,
      payloadStage: classified.payloadStage,
      finishReason: classified.finishReason,
      missingFields: classified.missingFields,
      invalidFields: classified.invalidFields,
      detail: classified.detail,
    });
    sendJson(res, classified.httpStatus, {
      ok: false,
      usedFallback: false,
      feedbackSource: 'error_no_fallback',
      modelUsed: null,
      errorCategory: classified.category,
      retryable: classified.retryable,
      error: classified.userMessage,
      errorKo: classified.userMessageKo,
      result: null,
    });
  }
}
