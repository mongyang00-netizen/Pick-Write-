import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiPayloadError } from './aiPayload';
import { classifyGeminiError, runWithBoundedRetry } from './geminiErrors';

test('classifyGeminiError distinguishes timeout, rate_limit, auth, server, and bad_request', () => {
  assert.equal(classifyGeminiError(new Error('Gemini request timed out')).category, 'timeout');
  assert.equal(classifyGeminiError(new Error('Gemini request timed out')).retryable, true);

  assert.equal(classifyGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }).category, 'rate_limit');
  assert.equal(classifyGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }).retryable, true);

  assert.equal(classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED' }).category, 'auth');
  assert.equal(classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED' }).retryable, false);

  assert.equal(classifyGeminiError({ status: 503, message: 'Service Unavailable' }).category, 'server');
  assert.equal(classifyGeminiError({ status: 503, message: 'Service Unavailable' }).retryable, true);

  assert.equal(classifyGeminiError({ status: 400, message: 'Invalid argument' }).category, 'bad_request');
  assert.equal(classifyGeminiError({ status: 400, message: 'Invalid argument' }).retryable, false);

  const payloadErr = new GeminiPayloadError('Incomplete AI feedback payload', {
    stage: 'missing_fields',
    missingFields: ['fixPoint'],
  });
  const classifiedPayload = classifyGeminiError(payloadErr);
  assert.equal(classifiedPayload.category, 'invalid_response');
  assert.equal(classifiedPayload.autoRetryable, false);
  assert.equal(classifiedPayload.payloadStage, 'missing_fields');
});

test('runWithBoundedRetry retries once on transient error and succeeds', async () => {
  let calls = 0;
  const result = await runWithBoundedRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Gemini request timed out');
      }
      return 'ok';
    },
    { maxAttempts: 2, retryDelayMs: 10 }
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('runWithBoundedRetry does not retry non-retryable auth errors', async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await runWithBoundedRetry(
      async () => {
        calls += 1;
        throw { status: 403, message: 'API_KEY_INVALID' };
      },
      { maxAttempts: 2, retryDelayMs: 10 }
    );
  });
  assert.equal(calls, 1);
});

test('runWithBoundedRetry does not immediately auto-retry 429 rate_limit errors', async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await runWithBoundedRetry(
      async () => {
        calls += 1;
        throw { status: 429, message: 'RESOURCE_EXHAUSTED' };
      },
      { maxAttempts: 2, retryDelayMs: 10 }
    );
  });
  assert.equal(calls, 1);
  assert.equal(classifyGeminiError(new Error('504 DEADLINE_EXCEEDED')).category, 'timeout');
});

test('runWithBoundedRetry does not repeat deterministic invalid_response payload errors', async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await runWithBoundedRetry(
      async () => {
        calls += 1;
        throw new GeminiPayloadError('Missing fields', {
          stage: 'missing_fields',
          missingFields: ['fixPoint', 'question'],
        });
      },
      { maxAttempts: 2, retryDelayMs: 10 }
    );
  });
  assert.equal(calls, 1);
});

test('runWithBoundedRetry skips retry when total time ceiling leaves insufficient budget', async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await runWithBoundedRetry(
      async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 25));
        throw { status: 503, message: 'Service Unavailable' };
      },
      { maxAttempts: 2, retryDelayMs: 10, maxTotalMs: 50, minRemainingForRetryMs: 40 }
    );
  });
  assert.equal(calls, 1);
});
