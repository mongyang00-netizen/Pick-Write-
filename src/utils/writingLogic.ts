import type {
  CoachFeedback,
  PlanAnswers,
  RevisionCheckResult,
  SupportLevel,
  TopicId,
} from '../types';

export const PRIVACY_WARNING_MESSAGE =
  'Please remove personal information such as your real name, school, phone number, or address before continuing.';

export interface PIICheckResult {
  hasPII: boolean;
  reason: string | null;
  message: string | null;
}

const NON_NAME_WORDS = new Set([
  'favorite',
  'food',
  'place',
  'hobby',
  'pizza',
  'ramen',
  'chicken',
  'tteokbokki',
  'hotteok',
  'badminton',
  'soccer',
  'library',
  'park',
  'music',
  'drawing',
  'reading',
  'happy',
  'hungry',
  'tired',
  'excited',
  'student',
  'korean',
  'middle',
  'good',
  'great',
]);

export function detectPersonalInfo(text: string): PIICheckResult {
  const cleaned = text.trim();
  if (!cleaned) {
    return { hasPII: false, reason: null, message: null };
  }

  // 1. Email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleaned)) {
    return {
      hasPII: true,
      reason: 'email',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  // 2. Korean / international phone numbers (010-1234-5678, 01012345678, 02-123-4567, etc.)
  if (
    /(?:\+?82[-\s]?)?0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(cleaned) ||
    /\b\d{3}[-\s.]\d{3,4}[-\s.]\d{4}\b/.test(cleaned)
  ) {
    return {
      hasPII: true,
      reason: 'phone',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  // 3. Explicit real name introduction in English or Korean
  // e.g., "My name is Lee Minji", "I am Kim Chulsoo", "제 이름은 홍길동"
  const myNameMatch = cleaned.match(/\bmy\s+name\s+is\s+([a-zA-Z가-힣][a-zA-Z가-힣\s'-]{1,30})/i);
  if (myNameMatch) {
    return {
      hasPII: true,
      reason: 'name',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  if (/(?:제\s*이름은|내\s*이름은|나는\s*[가-힣]{2,4}(?:이야|입니다|이에요))/.test(cleaned)) {
    return {
      hasPII: true,
      reason: 'name',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  // Detect "I am [Capitalized First] [Capitalized Last]" (two capitalized tokens, excluding common words)
  const twoCapNameRegex = /\b(?:I\s+am|I'm)\s+([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})\b/g;
  let match: RegExpExecArray | null;
  while ((match = twoCapNameRegex.exec(cleaned)) !== null) {
    const first = match[1].toLowerCase();
    const second = match[2].toLowerCase();
    if (!NON_NAME_WORDS.has(first) && !NON_NAME_WORDS.has(second)) {
      return {
        hasPII: true,
        reason: 'name',
        message: PRIVACY_WARNING_MESSAGE,
      };
    }
  }

  // 4. School names (avoid false positives on "after school" or "at school")
  if (
    /\b[A-Za-z가-힣0-9]+\s+(?:middle|elementary|high)\s+school\b/i.test(cleaned) ||
    /\bmy\s+school\s+(?:name\s+)?is\b/i.test(cleaned) ||
    /[가-힣A-Za-z0-9]{1,12}(?:초등학교|중학교|고등학교)/.test(cleaned) ||
    /\bschool\s+name\b/i.test(cleaned)
  ) {
    return {
      hasPII: true,
      reason: 'school',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  // 5. Home address indicators
  if (
    /\bmy\s+address\s+is\b/i.test(cleaned) ||
    /\b\d{1,5}\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/i.test(cleaned) ||
    /[가-힣0-9]+(?:시|구|동|로|길)\s*\d+/.test(cleaned) ||
    /[가-힣A-Za-z0-9]+\s*(?:아파트|apt\.?)\s*\d*/i.test(cleaned) ||
    /\b(?:주소|집\s*주소)\b/.test(cleaned)
  ) {
    return {
      hasPII: true,
      reason: 'address',
      message: PRIVACY_WARNING_MESSAGE,
    };
  }

  return { hasPII: false, reason: null, message: null };
}

export function detectPersonalInfoInPlan(plan: PlanAnswers): PIICheckResult {
  const combined = [plan.q1, plan.q2, plan.q3, plan.q4].join(' ');
  return detectPersonalInfo(combined);
}

export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Split on sentence-ending punctuation followed by whitespace or end
  const segments = trimmed
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return segments.length;
}

export function computeNextLevel(params: {
  currentLevel: SupportLevel;
  fixedOnFirstTry: boolean;
  hintsUsed: number;
  stillNeedsHelpAfterExtraHints: boolean;
}): SupportLevel {
  const { currentLevel, fixedOnFirstTry, hintsUsed, stillNeedsHelpAfterExtraHints } = params;
  // Level up when student addresses the main feedback point on the first revision attempt (only Hint 1 seen)
  if (fixedOnFirstTry && hintsUsed <= 1) {
    return currentLevel < 3 ? ((currentLevel + 1) as SupportLevel) : 3;
  }
  // Level down when student cannot address the feedback even after receiving 2 additional hints (Hint 2 & 3) and trying again
  if (stillNeedsHelpAfterExtraHints && hintsUsed >= 3) {
    return currentLevel > 1 ? ((currentLevel - 1) as SupportLevel) : 1;
  }
  return currentLevel;
}

export interface DraftHighlightSegments {
  before: string;
  match: string;
  after: string;
}

export function splitDraftWithHighlight(
  draft: string,
  highlightText: string
): DraftHighlightSegments | null {
  const target = highlightText.trim();
  if (!target || !draft.trim()) return null;

  const lowerDraft = draft.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const idx = lowerDraft.indexOf(lowerTarget);
  if (idx === -1) return null;

  return {
    before: draft.slice(0, idx),
    match: draft.slice(idx, idx + target.length),
    after: draft.slice(idx + target.length),
  };
}

function hasLikelyRecommendationReason(draftText: string): boolean {
  const lower = draftText.toLowerCase();
  if (!lower.trim()) return false;
  // Look for meaning-based reason/result cues without requiring one specific keyword
  return /\b(?:because|since|so|as|for)\b|\b(?:helps?|makes?|keeps?|lets?)\s+(?:you|me|us|everyone|people)\b|\b(?:reason|why)\b/.test(
    lower
  );
}

export function getFallbackFeedback(
  topic: TopicId,
  draft?: string,
  _level?: SupportLevel
): CoachFeedback {
  const trimmedDraft = (draft ?? '').trim();
  const sentenceCount = trimmedDraft ? countSentences(trimmedDraft) : 0;
  const wordCount = trimmedDraft ? trimmedDraft.split(/\s+/).filter(Boolean).length : 0;
  const needsMoreContent = Boolean(trimmedDraft) && (sentenceCount < 2 || wordCount < 12);
  const needsClearerReason =
    Boolean(trimmedDraft) && !needsMoreContent && !hasLikelyRecommendationReason(trimmedDraft);

  if (topic === 'place') {
    const focusQuestion = needsMoreContent
      ? 'Did you name your favorite place and add details about what you see or do there?'
      : needsClearerReason
      ? 'Did you explain why a friend should visit this place (what makes it special)?'
      : 'Did you clearly connect your place details with why a friend should visit?';
    const focusQuestionKo = needsMoreContent
      ? '가장 좋아하는 장소 이름과 그곳에서 보거나 하는 일을 충분히 적었나요?'
      : needsClearerReason
      ? '친구가 왜 이곳에 가 보면 좋을지(어떤 점이 특별한지) 이유를 설명했나요?'
      : '장소에 대한 설명과 추천 이유가 자연스럽게 이어지나요?';

    return {
      praise: 'Self-Check Guide for My Favorite Place',
      fixPoint: 'Check your paragraph using these 3 questions:',
      question: focusQuestion,
      highlightText: '',
      hint2: needsMoreContent
        ? 'Add 1-2 short sentences describing what you see, feel, or usually do there.'
        : 'Try connecting a clear reason using "because", "so", or "it helps you...".',
      hint3: 'Pattern example: "You should visit this museum because you can see amazing art there."',
      praiseKo: '내가 가장 좋아하는 장소 · 스스로 점검하기',
      fixPointKo: '아래 3가지 질문으로 내 글을 스스로 확인해 보세요:',
      questionKo: focusQuestionKo,
      hint2Ko: needsMoreContent
        ? '그곳에서 보거나 느끼는 점, 주로 하는 일을 1~2문장으로 덧붙여 보세요.'
        : '"because", "so", 또는 "it helps you..."를 활용해 추천 이유를 연결해 보세요.',
      hint3Ko: '패턴 예시: "You should visit this museum because you can see amazing art there."',
      isFallback: true,
      selfCheckQuestions: [
        {
          question: '1. Did you name your favorite place and describe what you see, feel, or do there?',
          questionKo: '1. 가장 좋아하는 장소와 그곳의 특징·경험을 분명히 썼나요?',
        },
        {
          question: '2. Did you clearly explain WHY a friend should visit it and connect your ideas smoothly?',
          questionKo: '2. 친구에게 왜 추천하는지 이유를 적고 문장을 자연스럽게 연결했나요?',
        },
        {
          question: '3. Read aloud once: do your verbs, articles, and spelling look clear?',
          questionKo: '3. 소리 내어 읽었을 때 동사 시제나 철자가 자연스럽게 읽히나요?',
        },
      ],
    };
  }

  if (topic === 'hobby') {
    const focusQuestion = needsMoreContent
      ? 'Did you name your favorite hobby and share when or how you enjoy it?'
      : needsClearerReason
      ? 'Did you explain why a friend should try this hobby (how it helps or feels)?'
      : 'Did you clearly connect your hobby experience with why a friend should try it?';
    const focusQuestionKo = needsMoreContent
      ? '가장 좋아하는 취미와 언제, 어떻게 즐기는지 충분히 적었나요?'
      : needsClearerReason
      ? '친구가 왜 이 취미를 해 보면 좋을지(어떤 점이 좋고 어떤 기분이 드는지) 이유를 적었나요?'
      : '취미 경험과 추천 이유가 자연스럽게 이어지나요?';

    return {
      praise: 'Self-Check Guide for My Favorite Hobby',
      fixPoint: 'Check your paragraph using these 3 questions:',
      question: focusQuestion,
      highlightText: '',
      hint2: needsMoreContent
        ? 'Add 1-2 short sentences about when you do this hobby and how you feel.'
        : 'Try connecting a clear reason using "because", "so", or "it makes me...".',
      hint3: 'Pattern example: "You should try gardening because it helps you feel calm."',
      praiseKo: '내가 가장 좋아하는 취미 · 스스로 점검하기',
      fixPointKo: '아래 3가지 질문으로 내 글을 스스로 확인해 보세요:',
      questionKo: focusQuestionKo,
      hint2Ko: needsMoreContent
        ? '언제 이 취미를 하는지, 할 때 어떤 기분이 드는지 1~2문장으로 덧붙여 보세요.'
        : '"because", "so", 또는 "it makes me..."를 활용해 추천 이유를 연결해 보세요.',
      hint3Ko: '패턴 예시: "You should try gardening because it helps you feel calm."',
      isFallback: true,
      selfCheckQuestions: [
        {
          question: '1. Did you name your favorite hobby and share when or how you enjoy it?',
          questionKo: '1. 가장 좋아하는 취미와 언제·어떻게 즐기는지 분명히 썼나요?',
        },
        {
          question: '2. Did you clearly explain WHY a friend should try it and connect your ideas smoothly?',
          questionKo: '2. 친구에게 왜 추천하는지 이유를 적고 문장을 자연스럽게 연결했나요?',
        },
        {
          question: '3. Read aloud once: do your verbs, articles, and spelling look clear?',
          questionKo: '3. 소리 내어 읽었을 때 동사 시제나 철자가 자연스럽게 읽히나요?',
        },
      ],
    };
  }

  const focusQuestion = needsMoreContent
    ? 'Did you name your favorite food and describe its taste, look, or a memory?'
    : needsClearerReason
    ? 'Did you explain why a friend should try this food (not just "You should try it")?'
    : 'Did you clearly connect your food description with why a friend should try it?';
  const focusQuestionKo = needsMoreContent
    ? '가장 좋아하는 음식과 맛·모양·경험을 충분히 적었나요?'
    : needsClearerReason
    ? '단순히 추천만 하지 말고 친구가 왜 먹어 보면 좋을지 이유를 덧붙였나요?'
    : '음식에 대한 묘사와 추천 이유가 자연스럽게 이어지나요?';

  return {
    praise: 'Self-Check Guide for My Favorite Food',
    fixPoint: 'Check your paragraph using these 3 questions:',
    question: focusQuestion,
    highlightText: '',
    hint2: needsMoreContent
      ? 'Add 1-2 short sentences about how it tastes, looks, or when you eat it.'
      : 'Try connecting a clear reason using "because", "so", or "it makes...".',
    hint3: 'Pattern example: "You should try pancakes because they are warm and fluffy."',
    praiseKo: '내가 가장 좋아하는 음식 · 스스로 점검하기',
    fixPointKo: '아래 3가지 질문으로 내 글을 스스로 확인해 보세요:',
    questionKo: focusQuestionKo,
    hint2Ko: needsMoreContent
      ? '맛이나 모양, 언제 누구와 먹는지 1~2문장으로 덧붙여 보세요.'
      : '"because", "so", 또는 "it makes..."를 활용해 추천 이유를 연결해 보세요.',
    hint3Ko: '패턴 예시: "You should try pancakes because they are warm and fluffy."',
    isFallback: true,
    selfCheckQuestions: [
      {
        question: '1. Did you name your favorite food and describe its taste, look, or a memory?',
        questionKo: '1. 가장 좋아하는 음식과 맛·모양·경험을 분명히 썼나요?',
      },
      {
        question: '2. Did you clearly explain WHY a friend should try it and connect your ideas smoothly?',
        questionKo: '2. 친구에게 왜 추천하는지 이유를 적고 문장을 자연스럽게 연결했나요?',
      },
      {
        question: '3. Read aloud once: do your verbs, articles, and spelling look clear?',
        questionKo: '3. 소리 내어 읽었을 때 동사 시제나 철자가 자연스럽게 읽히나요?',
      },
    ],
  };
}

export function evaluateRevisionFallback(
  firstDraft: string,
  revisedDraft: string
): RevisionCheckResult {
  const firstNorm = firstDraft.trim().toLowerCase();
  const revNorm = revisedDraft.trim().toLowerCase();
  const changed = firstNorm !== revNorm && revisedDraft.trim().length >= 15;
  const sentences = countSentences(revisedDraft);

  if (changed && sentences >= 3) {
    return {
      addressedFeedback: true,
      praise: 'Great job! You improved your paragraph by yourself!',
      praiseKo: '정말 잘했어요! 스스로 문장을 멋지게 고쳤네요!',
      nextSuggestion: 'Ready to see your Before & After card!',
      nextSuggestionKo: '이제 전후 비교와 나만의 추천 카드를 확인해 보세요!',
      isFallback: true,
    };
  }

  return {
    addressedFeedback: false,
    praise: 'Good try! You are getting closer.',
    praiseKo: '좋은 시도예요! 조금만 더 고쳐 보면 완성돼요.',
    nextSuggestion: 'Try changing or adding one sentence to answer Coco’s question.',
    nextSuggestionKo: '코코의 질문에 답하도록 한 문장을 고치거나 추가해 보세요.',
    isFallback: true,
  };
}

export function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}
