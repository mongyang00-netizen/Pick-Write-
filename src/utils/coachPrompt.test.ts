import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopicById } from '../data/topics.ts';
import {
  COCO_FEEDBACK_INSTRUCTION,
  COCO_REVISION_INSTRUCTION,
  buildCoachFeedbackPrompt,
  buildRevisionCheckPrompt,
} from './coachPrompt.ts';

test('buildCoachFeedbackPrompt includes topic learning goal, all 4 actual planning questions, and student idea notes', () => {
  for (const topicId of ['food', 'place', 'hobby'] as const) {
    const topicConfig = getTopicById(topicId);
    const prompt = buildCoachFeedbackPrompt({
      topic: topicId,
      topicTitle: topicConfig.title,
      level: 2,
      planAnswers: {
        q1: 'my pick',
        q2: 'vivid detail',
        q3: '',
        q4: 'good reason',
      },
      draft: 'This is my sample draft paragraph.',
      focusRound: 1,
    });

    assert.ok(prompt.includes(topicConfig.title));
    assert.ok(prompt.includes(topicConfig.tagline));
    for (const q of topicConfig.planningQuestions) {
      assert.ok(prompt.includes(q.question), `Missing planning question for ${topicId}: ${q.question}`);
    }
    assert.ok(prompt.includes('Idea Note: my pick'));
    assert.ok(prompt.includes('Idea Note: vivid detail'));
    assert.ok(prompt.includes('Idea Note: (not filled)'));
    assert.ok(prompt.includes('Idea Note: good reason'));
    assert.ok(prompt.includes('scaffolding reference only'));
  }
});

test('buildCoachFeedbackPrompt includes Focus Round 2 previousFocus without forcing another issue', () => {
  const prompt = buildCoachFeedbackPrompt({
    topic: 'hobby',
    level: 1,
    planAnswers: { q1: 'drawing', q2: 'weekends', q3: 'relaxed', q4: 'fun' },
    draft: 'My favorite hobby is drawing. I do it every weekend. You should try it because it is relaxing.',
    focusRound: 2,
    previousFocus: {
      fixPoint: 'Check the verb after I.',
      question: 'Look at "I does". What verb form goes with "I"?',
    },
  });

  assert.ok(prompt.includes('Focus Round: 2'));
  assert.ok(prompt.includes('Check the verb after I.'));
  assert.ok(prompt.includes('noMoreIssues=true'));
});

test('buildRevisionCheckPrompt formats draft, focus, question, and revised draft', () => {
  const prompt = buildRevisionCheckPrompt({
    firstDraft: 'I does it every weekend.',
    revisedDraft: 'I do it every weekend.',
    fixPoint: 'Check the verb after I.',
    question: 'Look at "I does". What verb goes with "I"?',
  });

  assert.ok(prompt.includes('First Draft:'));
  assert.ok(prompt.includes('Focus: Check the verb after I.'));
  assert.ok(prompt.includes('Question: Look at "I does".'));
  assert.ok(prompt.includes('Revised Paragraph:'));
});

test('system instructions enforce root-cause accuracy, priority order, and Idea Notes scaffolding boundaries', () => {
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('1. Topic drift or missing core recommendation content'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('2. Insufficient features/experience or recommendation reason'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('3. Content organization & sentence flow'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('4. Actual grammar & vocabulary errors'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('5. Spelling & other minor errors'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('STRICT ONE-POINT FEEDBACK RULE'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('Idea Notes are scaffolding reference ONLY'));
  assert.ok(COCO_FEEDBACK_INSTRUCTION.includes('Root-Cause Accuracy'));
  assert.ok(COCO_REVISION_INSTRUCTION.includes('addressedFeedback=true'));
});
