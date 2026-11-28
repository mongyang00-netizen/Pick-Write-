import type { CoachFeedback, RevisionCheckResult } from '../types';

export type PayloadFailureStage =
  | 'empty_response'
  | 'finish_reason'
  | 'json_parse'
  | 'schema_mismatch'
  | 'missing_fields';

export interface GeminiPayloadErrorDetails {
  stage: PayloadFailureStage;
  finishReason?: string;
  missingFields?: string[];
  invalidFields?: string[];
  rawLength?: number;
}

export class GeminiPayloadError extends Error {
  readonly stage: PayloadFailureStage;
  readonly finishReason?: string;
  readonly missingFields?: string[];
  readonly invalidFields?: string[];
  readonly rawLength?: number;

  constructor(message: string, details: GeminiPayloadErrorDetails) {
    super(message);
    this.name = 'GeminiPayloadError';
    this.stage = details.stage;
    this.finishReason = details.finishReason;
    this.missingFields = details.missingFields;
    this.invalidFields = details.invalidFields;
    this.rawLength = details.rawLength;
  }
}

function stripMarkdownJsonFence(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonObject(
  rawText: string,
  finishReason?: string
): Record<string, unknown> {
  if (finishReason && finishReason !== 'STOP') {
    throw new GeminiPayloadError(
      `Gemini response did not finish normally (stage=finish_reason, finishReason=${finishReason})`,
      {
        stage: 'finish_reason',
        finishReason,
        rawLength: rawText.length,
      }
    );
  }

  const cleaned = stripMarkdownJsonFence(rawText);
  if (!cleaned) {
    throw new GeminiPayloadError(
      `Gemini returned an empty response payload (stage=empty_response, finishReason=${finishReason ?? 'UNKNOWN'})`,
      {
        stage: 'empty_response',
        finishReason,
        rawLength: 0,
      }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const parseMsg = err instanceof Error ? err.message : 'Invalid JSON syntax';
    throw new GeminiPayloadError(
      `Invalid JSON in Gemini response (stage=json_parse, finishReason=${finishReason ?? 'UNKNOWN'}, length=${cleaned.length}): ${parseMsg}`,
      {
        stage: 'json_parse',
        finishReason,
        rawLength: cleaned.length,
      }
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GeminiPayloadError(
      'Gemini response JSON must be an object (stage=schema_mismatch)',
      {
        stage: 'schema_mismatch',
        finishReason,
        invalidFields: ['root'],
        rawLength: cleaned.length,
      }
    );
  }

  return parsed as Record<string, unknown>;
}

function checkOptionalString(
  obj: Record<string, unknown>,
  field: string,
  invalidFields: string[]
): string {
  const val = obj[field];
  if (val === undefined) return '';
  if (typeof val !== 'string') {
    invalidFields.push(field);
    return '';
  }
  return val.trim();
}

function readTrulyOptionalString(obj: Record<string, unknown>, field: string): string {
  const val = obj[field];
  return typeof val === 'string' ? val.trim() : '';
}

export function parseAndValidateCoachFeedback(params: {
  rawText: string;
  finishReason?: string;
}): CoachFeedback {
  const obj = parseJsonObject(params.rawText, params.finishReason);

  const invalidFields: string[] = [];
  if (typeof obj.noMoreIssues !== 'boolean') {
    invalidFields.push('noMoreIssues');
  }

  const praise = checkOptionalString(obj, 'praise', invalidFields);
  const praiseKo = checkOptionalString(obj, 'praiseKo', invalidFields);
  const fixPoint = checkOptionalString(obj, 'fixPoint', invalidFields);
  const fixPointKo = checkOptionalString(obj, 'fixPointKo', invalidFields);
  const question = checkOptionalString(obj, 'question', invalidFields);
  const questionKo = checkOptionalString(obj, 'questionKo', invalidFields);
  const highlightText = checkOptionalString(obj, 'highlightText', invalidFields);
  const hint2 = checkOptionalString(obj, 'hint2', invalidFields);
  const hint2Ko = checkOptionalString(obj, 'hint2Ko', invalidFields);
  const hint3 = checkOptionalString(obj, 'hint3', invalidFields);
  const hint3Ko = checkOptionalString(obj, 'hint3Ko', invalidFields);
  const writingTip = readTrulyOptionalString(obj, 'writingTip');
  const writingTipKo = readTrulyOptionalString(obj, 'writingTipKo');

  if (invalidFields.length > 0) {
    throw new GeminiPayloadError(
      `AI feedback field type mismatch (stage=schema_mismatch, fields=${invalidFields.join(',')})`,
      {
        stage: 'schema_mismatch',
        finishReason: params.finishReason,
        invalidFields,
        rawLength: params.rawText.length,
      }
    );
  }

  const noMoreIssues = obj.noMoreIssues as boolean;
  const missingFields: string[] = [];
  if (!praise) missingFields.push('praise');

  if (!noMoreIssues) {
    if (!fixPoint) missingFields.push('fixPoint');
    if (!question) missingFields.push('question');
    if (!hint2) missingFields.push('hint2');
    if (!hint3) missingFields.push('hint3');
  }

  if (missingFields.length > 0) {
    throw new GeminiPayloadError(
      `Incomplete AI feedback payload (stage=missing_fields, missing=${missingFields.join(',')}, noMoreIssues=${noMoreIssues})`,
      {
        stage: 'missing_fields',
        finishReason: params.finishReason,
        missingFields,
        rawLength: params.rawText.length,
      }
    );
  }

  if (noMoreIssues) {
    return {
      noMoreIssues: true,
      praise,
      praiseKo,
      fixPoint: '',
      fixPointKo: '',
      question: '',
      questionKo: '',
      highlightText: '',
      hint2: '',
      hint2Ko: '',
      hint3: '',
      hint3Ko: '',
      writingTip,
      writingTipKo: writingTip ? writingTipKo : '',
    };
  }

  return {
    noMoreIssues: false,
    praise,
    praiseKo,
    fixPoint,
    fixPointKo,
    question,
    questionKo,
    highlightText,
    hint2,
    hint2Ko,
    hint3,
    hint3Ko,
    writingTip: '',
    writingTipKo: '',
  };
}

export function parseAndValidateRevisionCheck(params: {
  rawText: string;
  finishReason?: string;
}): RevisionCheckResult {
  const obj = parseJsonObject(params.rawText, params.finishReason);

  const invalidFields: string[] = [];
  if (typeof obj.addressedFeedback !== 'boolean') {
    invalidFields.push('addressedFeedback');
  }

  const praise = checkOptionalString(obj, 'praise', invalidFields);
  const praiseKo = checkOptionalString(obj, 'praiseKo', invalidFields);
  const nextSuggestion = checkOptionalString(obj, 'nextSuggestion', invalidFields);
  const nextSuggestionKo = checkOptionalString(obj, 'nextSuggestionKo', invalidFields);

  if (invalidFields.length > 0) {
    throw new GeminiPayloadError(
      `AI revision check field type mismatch (stage=schema_mismatch, fields=${invalidFields.join(',')})`,
      {
        stage: 'schema_mismatch',
        finishReason: params.finishReason,
        invalidFields,
        rawLength: params.rawText.length,
      }
    );
  }

  const missingFields: string[] = [];
  if (!praise) missingFields.push('praise');
  if (!nextSuggestion) missingFields.push('nextSuggestion');

  if (missingFields.length > 0) {
    throw new GeminiPayloadError(
      `Incomplete AI revision check payload (stage=missing_fields, missing=${missingFields.join(',')})`,
      {
        stage: 'missing_fields',
        finishReason: params.finishReason,
        missingFields,
        rawLength: params.rawText.length,
      }
    );
  }

  return {
    addressedFeedback: obj.addressedFeedback as boolean,
    praise,
    praiseKo,
    nextSuggestion,
    nextSuggestionKo,
  };
}
