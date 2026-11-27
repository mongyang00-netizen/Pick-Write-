import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  PRIVACY_WARNING_MESSAGE,
  detectPersonalInfo,
  detectPersonalInfoInPlan,
  getFallbackFeedback,
} from './src/utils/writingLogic.ts';
import { classifyGeminiError, runWithBoundedRetry } from './src/utils/geminiErrors.ts';
import {
  parseAndValidateCoachFeedback,
  parseAndValidateRevisionCheck,
} from './src/utils/aiPayload.ts';
import type {
  CoachFeedback,
  PlanAnswers,
  RevisionCheckResult,
  SupportLevel,
  TopicId,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_BACKUP_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_ATTEMPT_TIMEOUT_MS = 22000;
const GEMINI_MAX_TOTAL_MS = 48000;
const GEMINI_RETRY_DELAY_MS = 1200;

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

function getGeminiClient(timeoutMs = GEMINI_ATTEMPT_TIMEOUT_MS): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
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

const COCO_FEEDBACK_INSTRUCTION = `You are Coco, a friendly English writing coach for Korean middle school learners (CEFR A2).
Goal: Help the student write a 3-4 sentence recommendation paragraph (food, place, or hobby).

Evaluation Priority (pick ONLY the single highest-priority real issue; content/structure before minor grammar):
1. Clear target: Is what the student recommends named clearly?
2. Details or experience: Does the draft share sensory details, feelings, or personal experience (when/who/what)?
3. Clear recommendation reason: Does the draft clearly convey WHY a friend should try/visit it?
   - Judge by whole-paragraph meaning, NOT keyword checklists (reasons using "so", "it helps...", "it makes...", or clear explanatory sentences count as valid!).
   - However, a bare ending like "You should try it." or "I recommend it." without explaining WHY needs a clearer reason!
4. Coherence & flow: Do the sentences connect logically and stay on topic?
5. Clear grammar, verb tense, subject-verb agreement, or spelling errors (ONLY check after 1-4 are satisfied — e.g., "Yesterday I play", "He like", "It are", "becouse").

Strict Guardrails (NEVER violate):
- NEVER rewrite the student's sentence or supply a corrected version of their draft.
- NEVER question or "correct" a student's personal taste, sensory description, feeling, or real-life experience based on general world assumptions (e.g., if they write "fried rice is sweet and salty" or "I read comics alone at night", accept their description as true).
- NEVER treat grammatically correct, understandable CEFR A2 sentences as errors, and NEVER demand B1/B2 vocabulary, complex clauses, or longer essays.
- NEVER use negative words ("wrong", "bad", "mistake", "error") or scores. If unsure, say "I think..." and suggest checking a dictionary or textbook.

Specific Praise & Unified Hint Ladder (1-3):
- praise & praiseKo: Must specifically name a real strength in the student's draft (e.g., naming the topic, sharing taste/feeling, or family time).
- When noMoreIssues is false, fixPoint, question (Hint 1), hint2 (Hint 2), and hint3 (Hint 3) MUST all target THAT EXACT SAME fixPoint:
  * Hint 1 (fixPoint, question, highlightText): highlightText is an exact 1-6 word substring from Draft (or "" if something is missing). Question guides the student to notice what to add or fix.
  * Hint 2 (hint2, hint2Ko): A closer breakdown clue for THAT SAME fixPoint (no rewritten draft sentence).
  * Hint 3 (hint3, hint3Ko): ONE short A2 example sentence showing the EXACT SAME meaning or grammar pattern on an UNRELATED everyday topic, avoiding the student's topic/target words AND avoiding the exact corrected word (e.g., for missing reason: "You should try pancakes because they are warm and fluffy."; for past tense verb error like "Yesterday I play": "Yesterday, I watched a fun movie.").

Completion Rule (valid in BOTH Focus Round 1 and Focus Round 2):
- If the draft already satisfies 1-4 clearly AND has no clear grammar, verb tense, subject-verb, or spelling errors (or in Round 2 no important issue remains besides Previous Focus), set noMoreIssues=true with warm, specific praise/praiseKo and set fixPoint, question, highlightText, hint2, hint3 (and their Ko fields) to "". NEVER invent fake flaws.
- Keep each field concise (1 short A2 sentence, ~6-15 words; natural Korean; max 1 emoji in praise only).`;

const COCO_REVISION_INSTRUCTION = `You are Coco, a friendly English writing coach for Korean middle school learners (CEFR A2).
Check whether the Revised Paragraph meaningfully addressed ONLY the given Focus and Question compared to the First Draft.
Rules:
1. Judge by meaning and CEFR A2 clarity, NOT whether a specific keyword (like "because") was used—if the student added a clear reason, detail, connection, or fix, mark addressedFeedback=true.
2. Respect the student's personal taste, sensory descriptions, and experiences; never require B1+ vocabulary.
3. NEVER give a corrected sentence or negative words ("wrong", "bad", "mistake").
4. Keep each field to 1 short warm sentence (English ~6-15 words; concise natural Korean; max 1 emoji in praise).`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: GEMINI_PRIMARY_MODEL,
      backupModel: GEMINI_BACKUP_MODEL,
      ...(process.env.NODE_ENV !== 'production' ? { recentGeminiErrors } : {}),
    });
  });

  app.post('/api/coach/feedback', async (req, res) => {
    const body = req.body as {
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
    const previousFixPoint =
      typeof body.previousFocus?.fixPoint === 'string'
        ? body.previousFocus.fixPoint.trim().slice(0, 200)
        : '';
    const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
    const planAnswers: PlanAnswers = {
      q1: typeof body.planAnswers?.q1 === 'string' ? body.planAnswers.q1.trim() : '',
      q2: typeof body.planAnswers?.q2 === 'string' ? body.planAnswers.q2.trim() : '',
      q3: typeof body.planAnswers?.q3 === 'string' ? body.planAnswers.q3.trim() : '',
      q4: typeof body.planAnswers?.q4 === 'string' ? body.planAnswers.q4.trim() : '',
    };

    if (!draft) {
      res.status(400).json({
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
      res.status(400).json({
        ok: false,
        piiBlocked: true,
        errorCategory: 'bad_request',
        retryable: false,
        error: PRIVACY_WARNING_MESSAGE,
      });
      return;
    }

    const planLines = [planAnswers.q1, planAnswers.q2, planAnswers.q3, planAnswers.q4]
      .filter(Boolean)
      .map((ans, idx) => `Q${idx + 1}: ${ans.slice(0, 120)}`)
      .join('\n');

    const roundLine =
      focusRound === 2 && previousFixPoint
        ? `Focus Round: 2 (Previous Focus already solved: "${previousFixPoint}" — check remaining goals 1-5; pick ONE different major issue with noMoreIssues=false ONLY if truly needed, or set noMoreIssues=true if the recommendation paragraph already meets A2 goals.)\n`
        : 'Focus Round: 1 (Apply Evaluation Priority 1-5 by meaning; set noMoreIssues=true if the paragraph already meets A2 recommendation goals with no important issue.)\n';

    const prompt = `Topic: ${topicTitle} (Level ${level})
${roundLine}${planLines ? `Notes:\n${planLines}\n` : ''}Draft:
"""
${draft.slice(0, 1200)}
"""`;

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
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  noMoreIssues: {
                    type: Type.BOOLEAN,
                    description: 'true only when no important issue needs fixing; false when giving a Fix and Hints 1-3.',
                  },
                  praise: {
                    type: Type.STRING,
                    description: 'Always non-empty warm English praise.',
                  },
                  fixPoint: {
                    type: Type.STRING,
                    description: 'Required non-empty 1 focus issue when noMoreIssues=false; empty string "" when noMoreIssues=true.',
                  },
                  question: {
                    type: Type.STRING,
                    description: 'Required non-empty Hint 1 guiding question when noMoreIssues=false; empty string "" when noMoreIssues=true.',
                  },
                  highlightText: {
                    type: Type.STRING,
                    description: 'Exact 1-6 word substring from Draft, or "" if something is missing or noMoreIssues=true.',
                  },
                  hint2: {
                    type: Type.STRING,
                    description: 'Required non-empty Hint 2 closer clue for fixPoint when noMoreIssues=false; "" when noMoreIssues=true.',
                  },
                  hint3: {
                    type: Type.STRING,
                    description: 'Required non-empty Hint 3 same-pattern example on unrelated words when noMoreIssues=false; "" when noMoreIssues=true.',
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
                    description: 'Natural Korean translation of hint3 ("" if noMoreIssues=true).',
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

      res.json({
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
      res.status(classified.httpStatus).json({
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
  });

  app.post('/api/coach/check-revision', async (req, res) => {
    const body = req.body as {
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
      res.status(400).json({
        ok: false,
        errorCategory: 'bad_request',
        retryable: false,
        error: 'Please write your revised paragraph before checking.',
      });
      return;
    }

    const pii = detectPersonalInfo(revisedDraft);
    if (pii.hasPII) {
      res.status(400).json({
        ok: false,
        piiBlocked: true,
        errorCategory: 'bad_request',
        retryable: false,
        error: PRIVACY_WARNING_MESSAGE,
      });
      return;
    }

    const prompt = `First Draft:
"""
${firstDraft.slice(0, 1200)}
"""
Focus: ${fixPoint.slice(0, 200)}
Question: ${question.slice(0, 200)}
Revised Paragraph:
"""
${revisedDraft.slice(0, 1200)}
"""`;

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
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

      res.json({
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
      res.status(classified.httpStatus).json({
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
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pick & Write! server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
