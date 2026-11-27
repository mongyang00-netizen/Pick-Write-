import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GeminiPayloadError,
  parseAndValidateCoachFeedback,
  parseAndValidateRevisionCheck,
} from './aiPayload';

test('parseAndValidateCoachFeedback accepts full valid feedback when noMoreIssues is false', () => {
  const result = parseAndValidateCoachFeedback({
    finishReason: 'STOP',
    rawText: JSON.stringify({
      noMoreIssues: false,
      praise: 'Great food pick!',
      praiseKo: '좋은 음식 추천이에요!',
      fixPoint: 'Add a recommendation reason',
      fixPointKo: '추천 이유를 추가해 보세요',
      question: 'Why should a friend try this food?',
      questionKo: '친구가 왜 이 음식을 먹어봐야 할까요?',
      highlightText: '',
      hint2: 'Try adding a reason starting with because.',
      hint2Ko: 'because로 시작하는 이유를 덧붙여 보세요.',
      hint3: 'I like winter because snow is fun.',
      hint3Ko: '나는 눈이 재미있어서 겨울을 좋아해.',
    }),
  });

  assert.equal(result.noMoreIssues, false);
  assert.equal(result.fixPoint, 'Add a recommendation reason');
  assert.equal(result.hint3, 'I like winter because snow is fun.');
});

test('parseAndValidateCoachFeedback accepts valid noMoreIssues=true with empty fix and hint fields', () => {
  const result = parseAndValidateCoachFeedback({
    finishReason: 'STOP',
    rawText: JSON.stringify({
      noMoreIssues: true,
      praise: 'Your recommendation paragraph is clear and complete!',
      praiseKo: '추천 문단이 아주 명확하고 완성도가 높아요!',
      fixPoint: '',
      fixPointKo: '',
      question: '',
      questionKo: '',
      highlightText: '',
      hint2: '',
      hint2Ko: '',
      hint3: '',
      hint3Ko: '',
    }),
  });

  assert.equal(result.noMoreIssues, true);
  assert.equal(result.praise, 'Your recommendation paragraph is clear and complete!');
  assert.equal(result.fixPoint, '');
  assert.equal(result.question, '');
});

test('parseAndValidateCoachFeedback distinguishes finishReason MAX_TOKENS truncation', () => {
  assert.throws(
    () =>
      parseAndValidateCoachFeedback({
        finishReason: 'MAX_TOKENS',
        rawText: '{"noMoreIssues":false,"praise":"Nice',
      }),
    (err: unknown) =>
      err instanceof GeminiPayloadError &&
      err.stage === 'finish_reason' &&
      err.finishReason === 'MAX_TOKENS'
  );
});

test('parseAndValidateCoachFeedback distinguishes empty response and malformed JSON', () => {
  assert.throws(
    () =>
      parseAndValidateCoachFeedback({
        finishReason: 'STOP',
        rawText: '   ',
      }),
    (err: unknown) => err instanceof GeminiPayloadError && err.stage === 'empty_response'
  );

  assert.throws(
    () =>
      parseAndValidateCoachFeedback({
        finishReason: 'STOP',
        rawText: '{"praise": "Good",',
      }),
    (err: unknown) => err instanceof GeminiPayloadError && err.stage === 'json_parse'
  );
});

test('parseAndValidateCoachFeedback rejects null/wrong-type fields and missing required hint fields', () => {
  assert.throws(
    () =>
      parseAndValidateCoachFeedback({
        finishReason: 'STOP',
        rawText: JSON.stringify({
          noMoreIssues: false,
          praise: 'Nice!',
          fixPoint: null,
          question: 'Why?',
          hint2: 'Think why.',
          hint3: 'I like apples because they are sweet.',
        }),
      }),
    (err: unknown) =>
      err instanceof GeminiPayloadError &&
      err.stage === 'schema_mismatch' &&
      err.invalidFields?.includes('fixPoint')
  );

  assert.throws(
    () =>
      parseAndValidateCoachFeedback({
        finishReason: 'STOP',
        rawText: JSON.stringify({
          noMoreIssues: false,
          praise: 'Nice!',
          fixPoint: 'Add a reason',
          question: '',
          hint2: '',
          hint3: '',
        }),
      }),
    (err: unknown) =>
      err instanceof GeminiPayloadError &&
      err.stage === 'missing_fields' &&
      err.missingFields?.includes('question') &&
      err.missingFields?.includes('hint2') &&
      err.missingFields?.includes('hint3')
  );
});

test('parseAndValidateRevisionCheck validates boolean and non-empty strings strictly', () => {
  const valid = parseAndValidateRevisionCheck({
    finishReason: 'STOP',
    rawText: JSON.stringify({
      addressedFeedback: true,
      praise: 'Nice fix!',
      praiseKo: '잘 고쳤어요!',
      nextSuggestion: 'You can submit your card now.',
      nextSuggestionKo: '이제 카드를 제출해도 좋아요.',
    }),
  });
  assert.equal(valid.addressedFeedback, true);

  assert.throws(
    () =>
      parseAndValidateRevisionCheck({
        finishReason: 'STOP',
        rawText: JSON.stringify({
          addressedFeedback: 'yes',
          praise: 'Nice fix!',
          nextSuggestion: 'Done.',
        }),
      }),
    (err: unknown) => err instanceof GeminiPayloadError && err.stage === 'schema_mismatch'
  );
});
