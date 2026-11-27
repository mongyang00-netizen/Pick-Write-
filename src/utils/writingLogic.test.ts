import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIVACY_WARNING_MESSAGE,
  computeNextLevel,
  countSentences,
  detectPersonalInfo,
  evaluateRevisionFallback,
  getFallbackFeedback,
  splitDraftWithHighlight,
} from './writingLogic';

test('detectPersonalInfo flags real name, school, phone, and address', () => {
  const nameCase = detectPersonalInfo('My name is Lee Minji, and my favorite food is pizza.');
  assert.equal(nameCase.hasPII, true);
  assert.equal(nameCase.message, PRIVACY_WARNING_MESSAGE);

  const phoneCase = detectPersonalInfo('Call me at 010-1234-5678 after class.');
  assert.equal(phoneCase.hasPII, true);

  const schoolCase = detectPersonalInfo('I go to Hanguk Middle School.');
  assert.equal(schoolCase.hasPII, true);

  const koreanSchoolCase = detectPersonalInfo('저는 서울중학교에 다닙니다.');
  assert.equal(koreanSchoolCase.hasPII, true);

  const addressCase = detectPersonalInfo('My address is 123 Maple Street.');
  assert.equal(addressCase.hasPII, true);
});

test('detectPersonalInfo allows safe student writing including "after school"', () => {
  const safeFood = detectPersonalInfo(
    'My favorite food is tteokbokki. It has rice cakes and spicy sauce. I ate it with my sister yesterday. You should try it because it is delicious.'
  );
  assert.equal(safeFood.hasPII, false);

  const safeAfterSchool = detectPersonalInfo(
    'My favorite place is the library. I usually read books there after school.'
  );
  assert.equal(safeAfterSchool.hasPII, false);
});

test('countSentences counts sentences accurately', () => {
  assert.equal(countSentences(''), 0);
  assert.equal(countSentences('My favorite food is hotteok.'), 1);
  assert.equal(
    countSentences(
      'My favorite food is hotteok. It is warm and sweet. I usually eat it on cold days. You should try it because it is really delicious!'
    ),
    4
  );
  assert.equal(countSentences('First sentence. Second sentence without period'), 2);
});

test('computeNextLevel follows PRD level up, stay, and level down rules', () => {
  // First try fix with only Hint 1 -> Level Up
  assert.equal(
    computeNextLevel({
      currentLevel: 1,
      fixedOnFirstTry: true,
      hintsUsed: 1,
      stillNeedsHelpAfterExtraHints: false,
    }),
    2
  );
  // Already Level 3 -> capped at 3
  assert.equal(
    computeNextLevel({
      currentLevel: 3,
      fixedOnFirstTry: true,
      hintsUsed: 1,
      stillNeedsHelpAfterExtraHints: false,
    }),
    3
  );
  // Fixed after Hint 2 -> stay at same level
  assert.equal(
    computeNextLevel({
      currentLevel: 2,
      fixedOnFirstTry: false,
      hintsUsed: 2,
      stillNeedsHelpAfterExtraHints: false,
    }),
    2
  );
  // Still stuck after 2 additional hints (Hint 2 & 3 -> hintsUsed 3) -> Level Down
  assert.equal(
    computeNextLevel({
      currentLevel: 2,
      fixedOnFirstTry: false,
      hintsUsed: 3,
      stillNeedsHelpAfterExtraHints: true,
    }),
    1
  );
  // Level 1 cannot go below 1
  assert.equal(
    computeNextLevel({
      currentLevel: 1,
      fixedOnFirstTry: false,
      hintsUsed: 3,
      stillNeedsHelpAfterExtraHints: true,
    }),
    1
  );
  // Initial all-clear draft (noMoreIssues) -> Level Up
  assert.equal(
    computeNextLevel({
      currentLevel: 1,
      fixedOnFirstTry: true,
      hintsUsed: 0,
      stillNeedsHelpAfterExtraHints: false,
    }),
    2
  );
});

test('splitDraftWithHighlight finds case-insensitive target segment', () => {
  const result = splitDraftWithHighlight(
    'I eat it with my sister yesterday.',
    'eat'
  );
  assert.deepEqual(result, {
    before: 'I ',
    match: 'eat',
    after: ' it with my sister yesterday.',
  });
  assert.equal(splitDraftWithHighlight('Hello world.', 'missing'), null);
});

test('fallback feedback returns topic self-check questions and coherent Hint 1-3 ladder', () => {
  const foodFb = getFallbackFeedback('food', 'My favorite food is fried rice. I like it.', 1);
  assert.equal(foodFb.isFallback, true);
  assert.equal(foodFb.highlightText, '');
  assert.equal(foodFb.selfCheckQuestions?.length, 3);
  assert.ok(foodFb.selfCheckQuestions?.[0].question.toLowerCase().includes('food'));
  assert.ok(foodFb.hint2.length > 0 && foodFb.hint3.includes('because'));

  const placeFb = getFallbackFeedback('place', 'Any draft text', 2);
  assert.equal(placeFb.isFallback, true);
  assert.equal(placeFb.selfCheckQuestions?.length, 3);
  assert.ok(placeFb.selfCheckQuestions?.[0].question.toLowerCase().includes('place'));
  assert.ok(placeFb.hint2.length > 0 && placeFb.hint3.includes('visit'));

  const hobbyFb = getFallbackFeedback('hobby');
  assert.equal(hobbyFb.isFallback, true);
  assert.equal(hobbyFb.selfCheckQuestions?.length, 3);
  assert.ok(hobbyFb.selfCheckQuestions?.[0].question.toLowerCase().includes('hobby'));
  assert.ok(hobbyFb.hint2.length > 0 && hobbyFb.hint3.includes('try'));

  const bareEndingFb = getFallbackFeedback(
    'food',
    'My favorite food is fried rice. It is sweet and salty. I usually eat it with my family. You should try it.',
    1
  );
  assert.equal(bareEndingFb.isFallback, true);
  assert.equal(bareEndingFb.highlightText, '');
  assert.ok(bareEndingFb.question.toLowerCase().includes('why a friend should try'));
  assert.ok(!bareEndingFb.question.toLowerCase().includes('sweet'));
});

test('evaluateRevisionFallback recognizes meaningful revision', () => {
  const unchanged = evaluateRevisionFallback('My food is good.', 'My food is good.');
  assert.equal(unchanged.addressedFeedback, false);

  const improved = evaluateRevisionFallback(
    'My favorite food is fried rice. I like it.',
    'My favorite food is fried rice. It is warm and savory. You should try it because it is delicious.'
  );
  assert.equal(improved.addressedFeedback, true);
});
