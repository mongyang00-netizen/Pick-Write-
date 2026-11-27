export type TopicId = 'food' | 'place' | 'hobby';

export type SupportLevel = 1 | 2 | 3;

export type WizardStep = 'start' | 'plan' | 'draft' | 'hint' | 'rewrite' | 'finish';

export type AppView = 'wizard' | 'collection' | 'teacher';

export interface PlanAnswers {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export type HintLevel = 1 | 2 | 3;

export type FocusRound = 1 | 2;

export interface SelfCheckItem {
  question: string;
  questionKo: string;
}

export interface CoachFeedback {
  praise: string;
  fixPoint: string;
  question: string;
  highlightText: string;
  hint2: string;
  hint3: string;
  praiseKo: string;
  fixPointKo: string;
  questionKo: string;
  hint2Ko: string;
  hint3Ko: string;
  isFallback?: boolean;
  noMoreIssues?: boolean;
  selfCheckQuestions?: SelfCheckItem[];
}

export interface RevisionCheckResult {
  addressedFeedback: boolean;
  praise: string;
  praiseKo: string;
  nextSuggestion: string;
  nextSuggestionKo: string;
  isFallback?: boolean;
}

export interface RevisionCheckError {
  category: string;
  message: string;
  messageKo?: string;
  retryable: boolean;
}

export interface WritingRecord {
  id: string;
  uid: string;
  studentName: string;
  topic: TopicId;
  topicTitle: string;
  level: SupportLevel;
  nextLevel: SupportLevel;
  hintsUsed: number;
  planQ1: string;
  planQ2: string;
  planQ3: string;
  planQ4: string;
  firstDraft: string;
  finalParagraph: string;
  reflection: string;
  aiPraise: string;
  aiFixPoint: string;
  aiQuestion: string;
  fixedOnFirstTry: boolean;
  createdAtIso: string;
  source: 'cloud' | 'local';
}

export interface TopicConfig {
  id: TopicId;
  title: string;
  koreanTitle: string;
  tagline: string;
  imageUrl: string;
  imageAlt: string;
  cardCategoryLabel: string;
  planningQuestions: {
    key: keyof PlanAnswers;
    question: string;
    koreanHint: string;
    placeholder: string;
  }[];
  level1Outline: string[];
  level1Expressions: string[];
  level2Prompts: string[];
  level2Keywords: string[];
  sampleParagraph: string;
  sampleNote: string;
}
