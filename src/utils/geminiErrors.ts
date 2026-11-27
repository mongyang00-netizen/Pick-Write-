import { GeminiPayloadError } from './aiPayload.ts';

export type GeminiErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'server'
  | 'bad_request'
  | 'invalid_response'
  | 'unknown';

export interface ClassifiedGeminiError {
  category: GeminiErrorCategory;
  httpStatus: number;
  retryable: boolean;
  autoRetryable: boolean;
  userMessage: string;
  userMessageKo: string;
  detail: string;
  payloadStage?: string;
  finishReason?: string;
  missingFields?: string[];
  invalidFields?: string[];
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  if (err instanceof GeminiPayloadError) {
    return {
      category: 'invalid_response',
      httpStatus: 502,
      retryable: true,
      autoRetryable: false,
      userMessage: 'Coco sent an incomplete answer. Your writing is safe — please try again.',
      userMessageKo: '코코의 응답 형식이 완전하지 않았어요. 작성한 글은 안전하게 보관되어 있으니 다시 시도해 주세요.',
      detail: err.message.slice(0, 800),
      payloadStage: err.stage,
      finishReason: err.finishReason,
      missingFields: err.missingFields,
      invalidFields: err.invalidFields,
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = rawMessage.toLowerCase();
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : undefined;

  if (
    lower.includes('incomplete ai') ||
    lower.includes('stage=json_parse') ||
    lower.includes('stage=missing_fields') ||
    lower.includes('stage=schema_mismatch') ||
    lower.includes('stage=empty_response') ||
    lower.includes('stage=finish_reason')
  ) {
    return {
      category: 'invalid_response',
      httpStatus: 502,
      retryable: true,
      autoRetryable: false,
      userMessage: 'Coco sent an incomplete answer. Your writing is safe — please try again.',
      userMessageKo: '코코의 응답 형식이 완전하지 않았어요. 작성한 글은 안전하게 보관되어 있으니 다시 시도해 주세요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('aborterror') ||
    status === 408 ||
    status === 504
  ) {
    return {
      category: 'timeout',
      httpStatus: 504,
      retryable: true,
      autoRetryable: true,
      userMessage: 'Coco took too long to answer. Your writing is safe — please try again.',
      userMessageKo: '코코의 응답이 시간 초과되었어요. 작성한 글은 안전하게 보관되어 있어요. 다시 시도해 주세요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return {
      category: 'rate_limit',
      httpStatus: 429,
      retryable: true,
      autoRetryable: false,
      userMessage: 'Too many requests right now. Please wait a moment and try again.',
      userMessageKo: '잠시 요청이 많아졌어요. 조금 뒤에 다시 시도해 주세요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('missing_api_key')
  ) {
    return {
      category: 'auth',
      httpStatus: 503,
      retryable: false,
      autoRetryable: false,
      userMessage: 'AI coach authentication is unavailable right now. Your writing is safe.',
      userMessageKo: 'AI 코치 인증에 문제가 있어요. 작성한 글은 안전하게 보관되어 있어요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  if (
    (status !== undefined && status >= 500 && status < 600) ||
    lower.includes('unavailable') ||
    lower.includes('internal') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset')
  ) {
    return {
      category: 'server',
      httpStatus: 502,
      retryable: true,
      autoRetryable: true,
      userMessage: 'The AI service had a temporary server issue. Your writing is safe — please retry.',
      userMessageKo: 'AI 서버에 일시적인 오류가 발생했어요. 작성한 글은 안전하며 다시 시도할 수 있어요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  if (status === 400 || status === 404 || lower.includes('not_found') || lower.includes('invalid')) {
    return {
      category: 'bad_request',
      httpStatus: 502,
      retryable: false,
      autoRetryable: false,
      userMessage: 'Coco could not process this request right now. Your writing is safe.',
      userMessageKo: '코코가 요청을 처리하지 못했어요. 작성한 글은 안전하게 보관되어 있어요.',
      detail: rawMessage.slice(0, 800),
    };
  }

  return {
    category: 'unknown',
    httpStatus: 502,
    retryable: true,
    autoRetryable: true,
    userMessage: 'Coco could not connect right now. Your writing is safe — please try again.',
    userMessageKo: '코코와 연결하지 못했어요. 작성한 글은 안전하니 다시 시도해 주세요.',
    detail: rawMessage.slice(0, 800),
  };
}

export async function runWithBoundedRetry<T>(
  operation: (attempt: number, remainingMs: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    retryDelayMs?: number;
    maxTotalMs?: number;
    minRemainingForRetryMs?: number;
    onAttemptError?: (attempt: number, classified: ClassifiedGeminiError) => void;
  } = {}
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  const retryDelayMs = options.retryDelayMs ?? 1200;
  const maxTotalMs = options.maxTotalMs ?? 48000;
  const minRemainingForRetryMs = options.minRemainingForRetryMs ?? 10000;
  const startedAt = Date.now();

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsed = Date.now() - startedAt;
    const remainingMs = maxTotalMs - elapsed;
    if (remainingMs <= 0) {
      throw lastError ?? new Error(`Gemini request exceeded total ceiling (${maxTotalMs}ms)`);
    }

    try {
      return await operation(attempt, remainingMs);
    } catch (err) {
      lastError = err;
      const classified = classifyGeminiError(err);
      options.onAttemptError?.(attempt, classified);
      const remainingAfterAttempt = maxTotalMs - (Date.now() - startedAt);
      if (
        !classified.autoRetryable ||
        attempt >= maxAttempts ||
        remainingAfterAttempt - retryDelayMs < minRemainingForRetryMs
      ) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastError;
}
