import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  consumeGoogleRedirectResult,
  getReadableFirebaseAuthError,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import { isAuthorizedTeacher } from './config/teacher';
import { getTopicById } from './data/topics';
import {
  computeNextLevel,
  detectPersonalInfo,
  detectPersonalInfoInPlan,
  getFallbackFeedback,
} from './utils/writingLogic';
import {
  ensureStudentProfile,
  loadLocalLevel,
  loadLocalRecords,
  saveLocalLevel,
  saveLocalRecord,
  saveWritingRecordToCloud,
  subscribeToStudentRecords,
  updateStudentLevelInCloud,
} from './services/recordsService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StartScreen } from './components/StartScreen';
import { StepHeader } from './components/StepHeader';
import { PlanStep } from './components/PlanStep';
import { DraftStep } from './components/DraftStep';
import { HintStep } from './components/HintStep';
import { RewriteStep } from './components/RewriteStep';
import { FinishStep } from './components/FinishStep';
import { CollectionView } from './components/CollectionView';
import { TeacherView } from './components/TeacherView';
import type {
  AppView,
  CoachFeedback,
  FocusRound,
  HintLevel,
  PlanAnswers,
  RevisionCheckError,
  RevisionCheckResult,
  SupportLevel,
  TopicId,
  WizardStep,
  WritingRecord,
} from './types';

interface Round1Outcome {
  evaluated: boolean;
  fixedOnFirstTry: boolean;
  hintsUsed: HintLevel;
  stuckAfterHint3: boolean;
}

const DEFAULT_ROUND1_OUTCOME: Round1Outcome = {
  evaluated: false,
  fixedOnFirstTry: false,
  hintsUsed: 1,
  stuckAfterHint3: false,
};

interface AuthUserState {
  uid: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  isTeacher: boolean;
}

const EMPTY_PLAN: PlanAnswers = { q1: '', q2: '', q3: '', q4: '' };

function PickAndWriteApp() {
  const [view, setView] = useState<AppView>('wizard');
  const [step, setStep] = useState<WizardStep>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return 'plan';
    }
    return 'start';
  });

  // Auth & User Profile
  const [user, setUser] = useState<AuthUserState | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<SupportLevel>(() => loadLocalLevel());
  const [taskLevel, setTaskLevel] = useState<SupportLevel>(() => loadLocalLevel());

  // Records
  const [cloudRecords, setCloudRecords] = useState<WritingRecord[]>([]);
  const [localRecords, setLocalRecords] = useState<WritingRecord[]>(() => loadLocalRecords());
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Active Writing Session State (preserved across Back/Next)
  const [selectedTopicId, setSelectedTopicId] = useState<TopicId>('food');
  const [planAnswers, setPlanAnswers] = useState<PlanAnswers>(EMPTY_PLAN);
  const [firstDraft, setFirstDraft] = useState('');
  const [revisedDraft, setRevisedDraft] = useState('');
  const [focusBaseDraft, setFocusBaseDraft] = useState('');
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [, setCompletedFocuses] = useState<CoachFeedback[]>([]);
  const [focusRound, setFocusRound] = useState<FocusRound>(1);
  const [revealedHintLevel, setRevealedHintLevel] = useState<HintLevel>(1);
  const [hintUnlockNotice, setHintUnlockNotice] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [showKorean, setShowKorean] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<number>(1);
  const [revisionAttempts, setRevisionAttempts] = useState<number>(0);
  const [fixedOnFirstTry, setFixedOnFirstTry] = useState<boolean>(false);
  const [round1Outcome, setRound1Outcome] = useState<Round1Outcome>(DEFAULT_ROUND1_OUTCOME);
  const [revisionCheck, setRevisionCheck] = useState<RevisionCheckResult | null>(null);
  const [revisionCheckError, setRevisionCheckError] = useState<RevisionCheckError | null>(null);
  const [noMoreIssuesFound, setNoMoreIssuesFound] = useState(false);
  const [hint3FailedForFocus, setHint3FailedForFocus] = useState(false);
  const [secondFocusError, setSecondFocusError] = useState<RevisionCheckError | null>(null);
  const [nextLevel, setNextLevel] = useState<SupportLevel>(currentLevel);
  const [reflection, setReflection] = useState('');

  // UI / Request States
  const [piiWarning, setPiiWarning] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isRetryingFeedback, setIsRetryingFeedback] = useState(false);
  const [isLoadingSecondFocus, setIsLoadingSecondFocus] = useState(false);
  const [isCheckingRevision, setIsCheckingRevision] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronous request locks & deduplication refs
  const feedbackInFlightRef = useRef(false);
  const revisionInFlightRef = useRef(false);
  const lastFeedbackKeyRef = useRef<string | null>(null);
  const lastCheckedDraftRef = useRef<string | null>(null);
  const sessionLevelAppliedRef = useRef(false);

  // Firebase Auth listener + redirect result recovery (external mobile browsers)
  useEffect(() => {
    void consumeGoogleRedirectResult().catch((err) => {
      console.error('Redirect sign-in result error:', err);
      setAuthError(getReadableFirebaseAuthError(err));
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const email = fbUser.email ?? '';
        const verified = fbUser.emailVerified;
        const teacher = isAuthorizedTeacher(email, verified);
        const displayName = fbUser.displayName || email.split('@')[0] || 'Student';
        setUser({
          uid: fbUser.uid,
          displayName,
          email,
          emailVerified: verified,
          isTeacher: teacher,
        });
        try {
          const lvl = await ensureStudentProfile(fbUser.uid, displayName);
          setCurrentLevel(lvl);
          setTaskLevel(lvl);
          setNextLevel(lvl);
        } catch (err) {
          console.error('Profile sync failed:', err);
        }
      } else {
        setUser(null);
        setCloudRecords([]);
        const localLvl = loadLocalLevel();
        setCurrentLevel(localLvl);
        setTaskLevel(localLvl);
        setNextLevel(localLvl);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Firestore subscription ONLY when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    const unsub = subscribeToStudentRecords(
      user.uid,
      (records) => {
        setCloudRecords(records);
        setRecordsLoading(false);
      },
      (err) => {
        console.error('Records subscription error:', err);
        setRecordsLoading(false);
      }
    );
    return unsub;
  }, [authReady, user]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(getReadableFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setView('wizard');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const resetSessionForTopic = (topicId: TopicId) => {
    setSelectedTopicId(topicId);
    setTaskLevel(currentLevel);
    setPlanAnswers(EMPTY_PLAN);
    setFirstDraft('');
    setRevisedDraft('');
    setFocusBaseDraft('');
    setFeedback(null);
    setCompletedFocuses([]);
    setFocusRound(1);
    setRevealedHintLevel(1);
    setHintUnlockNotice(null);
    setFallbackNotice(null);
    setShowKorean(false);
    setHintsUsed(1);
    setRevisionAttempts(0);
    setFixedOnFirstTry(false);
    setRound1Outcome(DEFAULT_ROUND1_OUTCOME);
    setRevisionCheck(null);
    setRevisionCheckError(null);
    setNoMoreIssuesFound(false);
    setHint3FailedForFocus(false);
    setSecondFocusError(null);
    lastFeedbackKeyRef.current = null;
    lastCheckedDraftRef.current = null;
    sessionLevelAppliedRef.current = false;
    setNextLevel(currentLevel);
    setReflection('');
    setPiiWarning(null);
    setDraftError(null);
    setIsSaved(false);
    setSaveError(null);
    setView('wizard');
    setStep('plan');
  };

  const handleSelectTopic = (topicId: TopicId) => {
    resetSessionForTopic(topicId);
  };

  const handlePlanNext = () => {
    const pii = detectPersonalInfoInPlan(planAnswers);
    if (pii.hasPII) {
      setPiiWarning(pii.message);
      return;
    }
    setPiiWarning(null);
    setStep('draft');
  };

  const requestFeedbackFromCoach = async (
    trimmedDraft: string
  ): Promise<{
    piiBlocked?: boolean;
    feedback: CoachFeedback;
    fallbackNotice: string | null;
  }> => {
    const topic = getTopicById(selectedTopicId);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch('/api/coach/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: selectedTopicId,
          topicTitle: topic.title,
          level: taskLevel,
          planAnswers,
          draft: trimmedDraft,
          focusRound: 1,
        }),
      });

      const rawText = await response.text();
      let data: {
        ok?: boolean;
        piiBlocked?: boolean;
        errorCategory?: string;
        error?: string;
        usedFallback?: boolean;
        feedbackSource?: string;
        modelUsed?: string | null;
        feedback?: CoachFeedback;
      };
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Non-JSON response from /api/coach/feedback (status=${response.status}, contentType=${response.headers.get('content-type') ?? 'unknown'})`
        );
      }

      if (data.piiBlocked) {
        setPiiWarning(data.error ?? null);
        return {
          piiBlocked: true,
          feedback: getFallbackFeedback(selectedTopicId, trimmedDraft, taskLevel),
          fallbackNotice: null,
        };
      }

      if (data.feedback) {
        if (data.usedFallback || !response.ok) {
          console.error('[Coco Feedback Fallback Activated]', {
            status: response.status,
            feedbackSource: data.feedbackSource ?? 'rule_fallback',
            modelUsed: data.modelUsed ?? null,
            usedFallback: true,
            focusRound: 1,
            category: data.errorCategory ?? 'unknown',
            error: data.error,
          });
          return {
            feedback: data.feedback,
            fallbackNotice:
              data.error ||
              'Coco could not respond right now. Use the topic self-check questions below, or retry.',
          };
        }
        console.info('[Coco Feedback Path]', {
          feedbackSource: data.feedbackSource ?? 'gemini_primary',
          modelUsed: data.modelUsed ?? 'unknown',
          usedFallback: false,
          focusRound: 1,
          noMoreIssues: Boolean(data.feedback.noMoreIssues),
        });
        return {
          feedback: data.feedback,
          fallbackNotice: null,
        };
      }

      throw new Error(data.error || `Feedback request failed (${response.status})`);
    } catch (err) {
      console.error('[Coco Feedback Request Error]', {
        feedbackSource: 'client_fallback',
        usedFallback: true,
        focusRound: 1,
        name: err instanceof Error ? err.name : 'UnknownError',
      });
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        feedback: getFallbackFeedback(selectedTopicId, trimmedDraft, taskLevel),
        fallbackNotice: isAbort
          ? 'Coco took too long to answer. Use the topic self-check questions below, or retry.'
          : 'Coco could not connect right now. Use the topic self-check questions below, or retry.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  };

  const handleDraftNext = async () => {
    if (feedbackInFlightRef.current) return;
    setDraftError(null);
    const trimmed = firstDraft.trim();
    if (!trimmed) {
      setDraftError('Please write a short paragraph (about 3–4 sentences) before continuing.');
      return;
    }

    // Strict client-side PII check before sending anything to AI
    const draftPii = detectPersonalInfo(trimmed);
    const planPii = detectPersonalInfoInPlan(planAnswers);
    if (draftPii.hasPII || planPii.hasPII) {
      setPiiWarning(draftPii.message || planPii.message);
      return;
    }

    setPiiWarning(null);

    const feedbackKey = JSON.stringify({
      topic: selectedTopicId,
      level: taskLevel,
      plan: planAnswers,
      draft: trimmed,
    });

    // If student returns to Draft without editing and already has valid AI feedback, preserve state
    if (feedback && !feedback.isFallback && lastFeedbackKeyRef.current === feedbackKey) {
      if (!revisedDraft.trim()) {
        setRevisedDraft(trimmed);
      }
      setHintUnlockNotice(null);
      setStep('hint');
      return;
    }

    feedbackInFlightRef.current = true;
    setIsLoadingFeedback(true);
    setFallbackNotice(null);

    try {
      const outcome = await requestFeedbackFromCoach(trimmed);
      if (outcome.piiBlocked) {
        return;
      }

      const isInitialAllClear = !outcome.feedback.isFallback && Boolean(outcome.feedback.noMoreIssues);

      setFeedback(outcome.feedback);
      setCompletedFocuses([]);
      setFocusRound(1);
      setRevealedHintLevel(1);
      setHintsUsed(isInitialAllClear ? 0 : 1);
      setRevisionAttempts(0);
      setFixedOnFirstTry(isInitialAllClear);
      setRound1Outcome(
        isInitialAllClear
          ? {
              evaluated: true,
              fixedOnFirstTry: true,
              hintsUsed: 1,
              stuckAfterHint3: false,
            }
          : DEFAULT_ROUND1_OUTCOME
      );
      setRevisionCheck(null);
      setRevisionCheckError(null);
      setNoMoreIssuesFound(isInitialAllClear);
      setHint3FailedForFocus(false);
      setSecondFocusError(null);
      setHintUnlockNotice(null);
      setFocusBaseDraft(trimmed);
      setFallbackNotice(outcome.fallbackNotice);
      lastCheckedDraftRef.current = null;

      if (!outcome.feedback.isFallback) {
        lastFeedbackKeyRef.current = feedbackKey;
      } else {
        lastFeedbackKeyRef.current = null;
      }

      // Initialize revisedDraft if student hasn't started editing yet
      if (!revisedDraft.trim()) {
        setRevisedDraft(trimmed);
      }
      setStep('hint');
    } finally {
      feedbackInFlightRef.current = false;
      setIsLoadingFeedback(false);
    }
  };

  const handleRetryFeedback = async () => {
    if (feedbackInFlightRef.current) return;
    const trimmed = (focusBaseDraft || firstDraft).trim();
    if (!trimmed) return;

    feedbackInFlightRef.current = true;
    setIsRetryingFeedback(true);

    try {
      const outcome = await requestFeedbackFromCoach(trimmed);
      if (outcome.piiBlocked) return;

      // Never overwrite an existing real AI feedback with a fallback
      if (outcome.feedback.isFallback && feedback && !feedback.isFallback) {
        setFallbackNotice(outcome.fallbackNotice);
        return;
      }

      setFeedback(outcome.feedback);
      setFallbackNotice(outcome.fallbackNotice);
      if (!outcome.feedback.isFallback) {
        const isInitialAllClear = Boolean(outcome.feedback.noMoreIssues);
        setFocusRound(1);
        setRevealedHintLevel(1);
        setHintsUsed(isInitialAllClear ? 0 : 1);
        setRevisionAttempts(0);
        setFixedOnFirstTry(isInitialAllClear);
        setRound1Outcome(
          isInitialAllClear
            ? {
                evaluated: true,
                fixedOnFirstTry: true,
                hintsUsed: 1,
                stuckAfterHint3: false,
              }
            : DEFAULT_ROUND1_OUTCOME
        );
        setRevisionCheck(null);
        setRevisionCheckError(null);
        setNoMoreIssuesFound(isInitialAllClear);
        setHint3FailedForFocus(false);
        setHintUnlockNotice(null);
        lastCheckedDraftRef.current = null;
        lastFeedbackKeyRef.current = JSON.stringify({
          topic: selectedTopicId,
          level: taskLevel,
          plan: planAnswers,
          draft: trimmed,
        });
      }
    } finally {
      feedbackInFlightRef.current = false;
      setIsRetryingFeedback(false);
    }
  };

  const handleGoToRewrite = () => {
    if (!revisedDraft.trim()) {
      setRevisedDraft(firstDraft);
    }
    setPiiWarning(null);
    setHintUnlockNotice(null);
    setStep('rewrite');
  };

  const runRevisionEvaluation = async (): Promise<RevisionCheckResult | null> => {
    if (revisionInFlightRef.current) return null;

    const trimmed = revisedDraft.trim();
    const pii = detectPersonalInfo(trimmed);
    if (pii.hasPII) {
      setPiiWarning(pii.message);
      return null;
    }
    setPiiWarning(null);
    setRevisionCheckError(null);
    setSecondFocusError(null);

    revisionInFlightRef.current = true;
    setIsCheckingRevision(true);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch('/api/coach/check-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          firstDraft: focusBaseDraft || firstDraft,
          revisedDraft: trimmed,
          fixPoint: feedback?.fixPoint ?? '',
          question: feedback?.question ?? '',
        }),
      });

      const rawText = await response.text();
      let data: {
        ok?: boolean;
        piiBlocked?: boolean;
        feedbackSource?: string;
        modelUsed?: string | null;
        errorCategory?: string;
        retryable?: boolean;
        error?: string;
        errorKo?: string;
        result?: RevisionCheckResult | null;
      };
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Non-JSON response from /api/coach/check-revision (status=${response.status}, contentType=${response.headers.get('content-type') ?? 'unknown'})`
        );
      }

      if (data.piiBlocked) {
        setPiiWarning(data.error ?? null);
        return null;
      }

      if (!response.ok || !data.ok || !data.result) {
        console.error('[Coco Revision Check Failed]', {
          status: response.status,
          feedbackSource: data.feedbackSource ?? 'error_no_fallback',
          modelUsed: data.modelUsed ?? null,
          category: data.errorCategory ?? 'unknown',
          error: data.error,
        });
        setRevisionCheckError({
          category: data.errorCategory ?? 'server',
          message:
            data.error ||
            'Coco could not check your revision right now. Your writing is safe — please retry.',
          messageKo: data.errorKo,
          retryable: data.retryable ?? true,
        });
        return null;
      }

      console.info('[Coco Revision Check Path]', {
        feedbackSource: data.feedbackSource ?? 'gemini_primary',
        modelUsed: data.modelUsed ?? 'unknown',
        usedFallback: false,
        addressedFeedback: Boolean(data.result.addressedFeedback),
      });

      lastCheckedDraftRef.current = trimmed;
      return data.result;
    } catch (err) {
      console.error('[Coco Revision Check Request Error]', err);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setRevisionCheckError({
        category: isAbort ? 'timeout' : 'unknown',
        message: isAbort
          ? 'Coco took too long to answer. Your writing is safe — please try again.'
          : 'Could not reach Coco right now. Your writing is safe — please try again.',
        messageKo: isAbort
          ? '코코의 응답이 시간 초과되었어요. 작성한 글은 안전하게 보관되어 있어요. 다시 시도해 주세요.'
          : '코코와 연결하지 못했어요. 작성한 글은 안전하니 다시 시도해 주세요.',
        retryable: true,
      });
      return null;
    } finally {
      window.clearTimeout(timer);
      revisionInFlightRef.current = false;
      setIsCheckingRevision(false);
    }
  };

  const handleCheckRevision = async () => {
    if (revisionInFlightRef.current || hint3FailedForFocus) return;
    const trimmed = revisedDraft.trim();
    if (!trimmed) {
      setPiiWarning('Please keep your paragraph in the writing box before checking.');
      return;
    }

    if (revisionCheck && !revisionCheckError && lastCheckedDraftRef.current === trimmed) {
      return;
    }

    const result = await runRevisionEvaluation();
    if (!result) return;

    const attempt = revisionAttempts + 1;
    setRevisionAttempts(attempt);
    setRevisionCheck(result);

    if (result.addressedFeedback) {
      if (focusRound === 1) {
        const isFirstTryWin = attempt === 1 && revealedHintLevel === 1;
        setFixedOnFirstTry(isFirstTryWin);
        setRound1Outcome({
          evaluated: true,
          fixedOnFirstTry: isFirstTryWin,
          hintsUsed: revealedHintLevel,
          stuckAfterHint3: false,
        });
      }
      return;
    }

    // Revision did NOT address feedback yet -> unlock next hint in Step 3 (max Hint 3)
    if (revealedHintLevel === 1) {
      setRevealedHintLevel(2);
      setHintsUsed((prev) => Math.max(prev, 2));
      if (focusRound === 1) {
        setRound1Outcome({
          evaluated: true,
          fixedOnFirstTry: false,
          hintsUsed: 2,
          stuckAfterHint3: false,
        });
      }
      setHintUnlockNotice(
        'Coco unlocked Hint 2! Read the closer clue on the right, then go back to Rewrite.'
      );
      setStep('hint');
    } else if (revealedHintLevel === 2) {
      setRevealedHintLevel(3);
      setHintsUsed((prev) => Math.max(prev, 3));
      if (focusRound === 1) {
        setRound1Outcome({
          evaluated: true,
          fixedOnFirstTry: false,
          hintsUsed: 3,
          stuckAfterHint3: false,
        });
      }
      setHintUnlockNotice(
        'Coco unlocked Hint 3! Check the pattern example on the right, then try rewriting again.'
      );
      setStep('hint');
    } else {
      // Hint 3 failed: never create Hint 4 and stop further revision checks on this focus
      setHint3FailedForFocus(true);
      if (focusRound === 1) {
        setRound1Outcome({
          evaluated: true,
          fixedOnFirstTry: false,
          hintsUsed: 3,
          stuckAfterHint3: true,
        });
      }
    }
  };

  const handleStartSecondFocus = async () => {
    if (feedbackInFlightRef.current || !feedback || focusRound !== 1) return;
    const trimmed = revisedDraft.trim();
    if (!trimmed) {
      setPiiWarning('Please keep your paragraph in the writing box before continuing.');
      return;
    }
    const pii = detectPersonalInfo(trimmed);
    if (pii.hasPII) {
      setPiiWarning(pii.message);
      return;
    }

    setPiiWarning(null);
    setSecondFocusError(null);
    feedbackInFlightRef.current = true;
    setIsLoadingSecondFocus(true);

    const topic = getTopicById(selectedTopicId);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch('/api/coach/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: selectedTopicId,
          topicTitle: topic.title,
          level: taskLevel,
          planAnswers,
          draft: trimmed,
          focusRound: 2,
          previousFocus: {
            fixPoint: feedback.fixPoint,
            question: feedback.question,
          },
        }),
      });

      const rawText = await response.text();
      let data: {
        ok?: boolean;
        piiBlocked?: boolean;
        noMoreIssues?: boolean;
        usedFallback?: boolean;
        feedbackSource?: string;
        modelUsed?: string | null;
        errorCategory?: string;
        retryable?: boolean;
        error?: string;
        errorKo?: string;
        feedback?: CoachFeedback;
      };
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Non-JSON response from /api/coach/feedback (focusRound=2, status=${response.status}, contentType=${response.headers.get('content-type') ?? 'unknown'})`
        );
      }

      if (data.piiBlocked) {
        setPiiWarning(data.error ?? null);
        return;
      }

      if (!response.ok || !data.ok || data.usedFallback || !data.feedback) {
        console.error('[Coco Feedback Fallback Activated]', {
          status: response.status,
          feedbackSource: data.feedbackSource ?? 'rule_fallback',
          modelUsed: data.modelUsed ?? null,
          usedFallback: Boolean(data.usedFallback),
          focusRound: 2,
          category: data.errorCategory ?? 'server',
        });
        // Keep Round 1's valid AI feedback & hints safe — never replace with fallback
        setSecondFocusError({
          category: data.errorCategory ?? 'server',
          message:
            data.error ||
            'Could not find another focus point right now. Your writing and previous hints are safe.',
          messageKo: data.errorKo,
          retryable: data.retryable ?? true,
        });
        return;
      }

      console.info('[Coco Feedback Path]', {
        feedbackSource: data.feedbackSource ?? 'gemini_primary',
        modelUsed: data.modelUsed ?? 'unknown',
        usedFallback: false,
        focusRound: 2,
        noMoreIssues: Boolean(data.noMoreIssues || data.feedback.noMoreIssues),
      });

      if (data.noMoreIssues || data.feedback.noMoreIssues) {
        setNoMoreIssuesFound(true);
        return;
      }

      setCompletedFocuses((prev) => [...prev, feedback]);
      setFocusRound(2);
      setFeedback(data.feedback);
      setFallbackNotice(null);
      setFocusBaseDraft(trimmed);
      setRevealedHintLevel(1);
      setRevisionAttempts(0);
      setRevisionCheck(null);
      setRevisionCheckError(null);
      setSecondFocusError(null);
      setNoMoreIssuesFound(false);
      setHint3FailedForFocus(false);
      lastCheckedDraftRef.current = null;
      setHintUnlockNotice(
        'Focus Point 2: Coco picked one more way to polish your paragraph!'
      );
      setStep('hint');
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setSecondFocusError({
        category: isAbort ? 'timeout' : 'unknown',
        message: isAbort
          ? 'Coco took too long to answer. Your writing and previous hints are safe.'
          : 'Could not reach Coco right now. Your writing and previous hints are safe.',
        messageKo: isAbort
          ? '코코의 응답이 시간 초과되었어요. 작성한 글과 기존 힌트는 안전합니다.'
          : '코코와 연결하지 못했어요. 작성한 글과 기존 힌트는 안전합니다.',
        retryable: true,
      });
    } finally {
      window.clearTimeout(timer);
      feedbackInFlightRef.current = false;
      setIsLoadingSecondFocus(false);
    }
  };

  const computeSessionNextLevel = (): SupportLevel => {
    if (!round1Outcome.evaluated) {
      return taskLevel;
    }
    return computeNextLevel({
      currentLevel: taskLevel,
      fixedOnFirstTry: round1Outcome.fixedOnFirstTry,
      hintsUsed: round1Outcome.hintsUsed,
      stillNeedsHelpAfterExtraHints: round1Outcome.stuckAfterHint3,
    });
  };

  const applyCompletedNextLevel = (computedNext: SupportLevel) => {
    if (sessionLevelAppliedRef.current) return;
    sessionLevelAppliedRef.current = true;
    saveLocalLevel(computedNext);
    setCurrentLevel(computedNext);
    if (user && computedNext !== taskLevel) {
      void updateStudentLevelInCloud(user.uid, user.displayName, computedNext).catch((err) => {
        console.error('Background cloud level update failed:', err);
      });
    }
  };

  const handleSubmitAnytime = () => {
    const activeText = revisedDraft.trim() || firstDraft.trim();
    if (!activeText) {
      setPiiWarning('Please keep your paragraph in the writing box before submitting.');
      return;
    }
    const pii = detectPersonalInfo(activeText);
    if (pii.hasPII) {
      setPiiWarning(pii.message);
      return;
    }

    if (!revisedDraft.trim() && firstDraft.trim()) {
      setRevisedDraft(firstDraft.trim());
    }

    // Only alter Level if Round 1 was actually evaluated by AI (never on AI failure or unverified submit)
    const computedNext = computeSessionNextLevel();
    setNextLevel(computedNext);
    applyCompletedNextLevel(computedNext);
    setStep('finish');
  };

  const handleFinishWithoutCheck = () => {
    const trimmed = revisedDraft.trim();
    if (!trimmed) {
      setPiiWarning('Please keep your paragraph in the writing box before finishing.');
      return;
    }
    const pii = detectPersonalInfo(trimmed);
    if (pii.hasPII) {
      setPiiWarning(pii.message);
      return;
    }
    // Never judge failure or change Level when finishing without AI check
    if (!round1Outcome.evaluated) {
      setFixedOnFirstTry(false);
    }
    const computedNext = computeSessionNextLevel();
    setNextLevel(computedNext);
    applyCompletedNextLevel(computedNext);
    setStep('finish');
  };

  const handleSaveRecord = async () => {
    setIsSaving(true);
    setSaveError(null);
    const topic = getTopicById(selectedTopicId);
    const finalText = revisedDraft.trim() || firstDraft.trim();

    try {
      if (user) {
        await saveWritingRecordToCloud({
          uid: user.uid,
          studentName: user.displayName,
          topic: selectedTopicId,
          topicTitle: topic.title,
          level: taskLevel,
          nextLevel,
          hintsUsed,
          planQ1: planAnswers.q1,
          planQ2: planAnswers.q2,
          planQ3: planAnswers.q3,
          planQ4: planAnswers.q4,
          firstDraft: firstDraft.trim(),
          finalParagraph: finalText,
          reflection: reflection.trim(),
          aiPraise: feedback?.praise ?? '',
          aiFixPoint: feedback?.fixPoint ?? '',
          aiQuestion: feedback?.question ?? '',
          fixedOnFirstTry,
        });

        if (nextLevel !== taskLevel) {
          await updateStudentLevelInCloud(user.uid, user.displayName, nextLevel);
        }
      } else {
        const localRec: WritingRecord = {
          id: `local_${Date.now()}`,
          uid: 'local',
          studentName: 'Practice Writer',
          topic: selectedTopicId,
          topicTitle: topic.title,
          level: taskLevel,
          nextLevel,
          hintsUsed,
          planQ1: planAnswers.q1,
          planQ2: planAnswers.q2,
          planQ3: planAnswers.q3,
          planQ4: planAnswers.q4,
          firstDraft: firstDraft.trim(),
          finalParagraph: finalText,
          reflection: reflection.trim(),
          aiPraise: feedback?.praise ?? '',
          aiFixPoint: feedback?.fixPoint ?? '',
          aiQuestion: feedback?.question ?? '',
          fixedOnFirstTry,
          createdAtIso: new Date().toISOString(),
          source: 'local',
        };
        const updated = saveLocalRecord(localRec);
        setLocalRecords(updated);
      }

      saveLocalLevel(nextLevel);
      setCurrentLevel(nextLevel);
      setIsSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? `Could not save to cloud (${err.message}). Your draft is still safe here.`
          : 'Could not save right now. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const activeTopic = getTopicById(selectedTopicId);
  const displayedRecords = user ? cloudRecords : localRecords;
  const previewNextLevel = computeSessionNextLevel();

  if (view === 'teacher' && user?.isTeacher) {
    return (
      <TeacherView
        teacherEmail={user.email}
        onBackHome={() => {
          setView('wizard');
          setStep('start');
        }}
      />
    );
  }

  if (view === 'collection') {
    return (
      <CollectionView
        records={displayedRecords}
        isSignedIn={Boolean(user)}
        loading={recordsLoading}
        onBackHome={() => {
          setView('wizard');
          setStep('start');
        }}
        onStartWriting={() => {
          setView('wizard');
          setStep('start');
        }}
      />
    );
  }

  if (step === 'start') {
    return (
      <StartScreen
        currentLevel={currentLevel}
        user={user}
        authLoading={authLoading}
        authError={authError}
        collectionCount={displayedRecords.length}
        onSelectTopic={handleSelectTopic}
        onOpenCollection={() => setView('collection')}
        onOpenTeacherView={() => {
          if (user?.isTeacher) setView('teacher');
        }}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StepHeader
        currentStep={step}
        level={taskLevel}
        onGoHome={() => setStep('start')}
      />

      <main className="flex-1">
        {step === 'plan' && (
          <PlanStep
            topic={activeTopic}
            answers={planAnswers}
            piiWarning={piiWarning}
            onChangeAnswer={(key, value) => {
              setPiiWarning(null);
              setPlanAnswers((prev) => ({ ...prev, [key]: value }));
            }}
            onBack={() => setStep('start')}
            onNext={handlePlanNext}
          />
        )}

        {step === 'draft' && (
          <DraftStep
            topic={activeTopic}
            level={taskLevel}
            planAnswers={planAnswers}
            draft={firstDraft}
            piiWarning={piiWarning}
            validationError={draftError}
            isSubmitting={isLoadingFeedback}
            onChangeDraft={(val) => {
              setPiiWarning(null);
              setDraftError(null);
              setFirstDraft(val);
            }}
            onBack={() => setStep('plan')}
            onNext={handleDraftNext}
          />
        )}

        {step === 'hint' && feedback && (
          <HintStep
            topic={activeTopic}
            focusBaseDraft={focusBaseDraft || firstDraft}
            currentRevisedDraft={revisedDraft}
            feedback={feedback}
            focusRound={focusRound}
            revealedHintLevel={revealedHintLevel}
            hintBanner={hintUnlockNotice}
            showKorean={showKorean}
            fallbackNotice={fallbackNotice}
            onRetryFeedback={handleRetryFeedback}
            isRetryingFeedback={isRetryingFeedback}
            onToggleKorean={() => setShowKorean((v) => !v)}
            onBack={() => setStep('draft')}
            onNext={handleGoToRewrite}
            onSubmitNow={handleSubmitAnytime}
          />
        )}

        {step === 'rewrite' && feedback && (
          <RewriteStep
            topic={activeTopic}
            revisedDraft={revisedDraft}
            feedback={feedback}
            focusRound={focusRound}
            revealedHintLevel={revealedHintLevel}
            hint3FailedForFocus={hint3FailedForFocus}
            taskLevel={taskLevel}
            previewNextLevel={previewNextLevel}
            showKorean={showKorean}
            fallbackNotice={fallbackNotice}
            piiWarning={piiWarning}
            isChecking={isCheckingRevision}
            isLoadingSecondFocus={isLoadingSecondFocus}
            noMoreIssuesFound={noMoreIssuesFound}
            secondFocusError={secondFocusError}
            revisionCheck={revisionCheck}
            revisionCheckError={revisionCheckError}
            onRetryFeedback={handleRetryFeedback}
            isRetryingFeedback={isRetryingFeedback}
            onChangeRevisedDraft={(val) => {
              setPiiWarning(null);
              setRevisionCheckError(null);
              setSecondFocusError(null);
              if (val.trim() !== lastCheckedDraftRef.current) {
                setRevisionCheck(null);
              }
              setRevisedDraft(val);
            }}
            onToggleKorean={() => setShowKorean((v) => !v)}
            onCheckRevision={handleCheckRevision}
            onStartSecondFocus={handleStartSecondFocus}
            onFinishWithoutCheck={handleFinishWithoutCheck}
            onBack={() => {
              setHintUnlockNotice(null);
              setStep('hint');
            }}
            onNext={handleSubmitAnytime}
          />
        )}

        {step === 'finish' && (
          <FinishStep
            topic={activeTopic}
            authorName={user?.displayName ?? 'Student Writer'}
            level={taskLevel}
            nextLevel={nextLevel}
            hintsUsed={hintsUsed}
            firstDraft={firstDraft}
            finalParagraph={revisedDraft.trim() || firstDraft.trim()}
            reflection={reflection}
            isSaving={isSaving}
            isSaved={isSaved}
            saveError={saveError}
            onChangeReflection={setReflection}
            onSave={handleSaveRecord}
            onOpenCollection={() => setView('collection')}
            onBack={() => setStep('rewrite')}
            onStartNew={() => setStep('start')}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PickAndWriteApp />
    </ErrorBoundary>
  );
}
