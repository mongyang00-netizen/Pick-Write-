import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { countSentences } from '../utils/writingLogic';
import { CocoCard } from './CocoCard';
import type {
  CoachFeedback,
  FocusRound,
  HintLevel,
  RevisionCheckError,
  RevisionCheckResult,
  SupportLevel,
  TopicConfig,
} from '../types';

interface RewriteStepProps {
  topic: TopicConfig;
  revisedDraft: string;
  feedback: CoachFeedback;
  focusRound: FocusRound;
  revealedHintLevel: HintLevel;
  hint3FailedForFocus: boolean;
  taskLevel: SupportLevel;
  previewNextLevel: SupportLevel;
  showKorean: boolean;
  fallbackNotice: string | null;
  piiWarning: string | null;
  isChecking: boolean;
  isLoadingSecondFocus: boolean;
  noMoreIssuesFound: boolean;
  secondFocusTip?: { tip: string; tipKo?: string } | null;
  secondFocusError: RevisionCheckError | null;
  revisionCheck: RevisionCheckResult | null;
  revisionCheckError: RevisionCheckError | null;
  onRetryFeedback?: () => void;
  isRetryingFeedback?: boolean;
  onChangeRevisedDraft: (value: string) => void;
  onToggleKorean: () => void;
  onCheckRevision: () => void;
  onStartSecondFocus: () => void;
  onFinishWithoutCheck: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function RewriteStep({
  topic,
  revisedDraft,
  feedback,
  focusRound,
  revealedHintLevel,
  hint3FailedForFocus,
  taskLevel,
  previewNextLevel,
  showKorean,
  fallbackNotice,
  piiWarning,
  isChecking,
  isLoadingSecondFocus,
  noMoreIssuesFound,
  secondFocusTip,
  secondFocusError,
  revisionCheck,
  revisionCheckError,
  onRetryFeedback,
  isRetryingFeedback,
  onChangeRevisedDraft,
  onToggleKorean,
  onCheckRevision,
  onStartSecondFocus,
  onFinishWithoutCheck,
  onBack,
  onNext,
}: RewriteStepProps) {
  const sentenceCount = countSentences(revisedDraft);
  const isFallback = Boolean(feedback.isFallback);
  const isAllClear = !isFallback && Boolean(feedback.noMoreIssues);
  const busy = isChecking || isLoadingSecondFocus;
  const showCheckAction = !isFallback && !isAllClear && !hint3FailedForFocus;
  const revisionApproved = Boolean(revisionCheck?.addressedFeedback);
  const checkIsPrimary = showCheckAction && !revisionApproved;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Editable Revision Box */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500">
                Step 4 · Rewrite
                <span aria-hidden="true"> · </span>
                <span>{topic.title}</span>
                {!isFallback && !isAllClear && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>Focus {focusRound} of 2</span>
                  </>
                )}
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                Improve your draft by yourself
              </h1>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-800 font-mono tabular-nums">
              {sentenceCount} {sentenceCount === 1 ? 'sentence' : 'sentences'}
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="rewrite-textarea"
              className="block text-sm font-semibold text-slate-800"
            >
              Your Revised Paragraph
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              {isFallback
                ? 'Edit your paragraph below using the self-check questions on the right.'
                : isAllClear
                ? 'Your paragraph already looks great! Polish anything freely, or click Submit Card & See Result.'
                : hint3FailedForFocus
                ? 'You unlocked all 3 hints for this focus. Polish your paragraph freely and submit whenever you are ready!'
                : 'Edit your paragraph below to answer Coco’s hint, then click Check My Revision.'}
            </p>
            <textarea
              id="rewrite-textarea"
              rows={7}
              maxLength={2000}
              value={revisedDraft}
              onChange={(e) => onChangeRevisedDraft(e.target.value)}
              className="mt-2.5 w-full p-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
            />
          </div>

          {piiWarning && (
            <div
              role="alert"
              className="mt-4 p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900 flex items-start gap-2.5"
            >
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{piiWarning}</span>
            </div>
          )}

          {/* Revision Check API Error (does NOT mark failed or change Level) */}
          {revisionCheckError && (
            <div
              role="alert"
              className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-950"
            >
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Could not reach Coco right now</span>
              </div>
              <p className="mt-1 leading-relaxed">{revisionCheckError.message}</p>
              {showKorean && revisionCheckError.messageKo && (
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  {revisionCheckError.messageKo}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onCheckRevision}
                  disabled={busy}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-white border border-amber-400 text-amber-950 text-xs font-semibold hover:bg-amber-100 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isChecking ? 'Checking...' : 'Retry Check'}</span>
                </button>
                <button
                  type="button"
                  onClick={onFinishWithoutCheck}
                  disabled={busy}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950 disabled:opacity-60 transition-colors"
                >
                  Submit Without AI Check (Keep Level)
                </button>
              </div>
            </div>
          )}

          {/* Second Focus Point API Error (preserves Round 1 feedback & draft) */}
          {secondFocusError && (
            <div
              role="alert"
              className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-950"
            >
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Could not load a second focus point</span>
              </div>
              <p className="mt-1 leading-relaxed">{secondFocusError.message}</p>
              {showKorean && secondFocusError.messageKo && (
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  {secondFocusError.messageKo}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onStartSecondFocus}
                  disabled={busy}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-white border border-amber-400 text-amber-950 text-xs font-semibold hover:bg-amber-100 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingSecondFocus ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isLoadingSecondFocus ? 'Checking...' : 'Retry Extra Focus'}</span>
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={busy}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
                >
                  Submit Card Now
                </button>
              </div>
            </div>
          )}

          {/* Check My Revision Result */}
          {revisionCheck && (
            <div
              role="status"
              className={`mt-4 p-4 rounded-xl border text-sm ${
                revisionCheck.addressedFeedback
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {revisionCheck.addressedFeedback ? 'Nice Improvement!' : 'Keep Trying!'}
                </span>
              </div>
              <p className="mt-1 leading-relaxed">{revisionCheck.praise}</p>
              <p className="mt-1 font-medium leading-relaxed">{revisionCheck.nextSuggestion}</p>
              {showKorean && (
                <p className="mt-1.5 text-xs opacity-90 leading-relaxed">
                  {revisionCheck.praiseKo} {revisionCheck.nextSuggestionKo}
                </p>
              )}

              {revisionCheck.addressedFeedback && focusRound === 1 && previewNextLevel > taskLevel && (
                <p className="mt-2 text-xs font-bold text-teal-900">
                  Great job! You&apos;ll move to Level {previewNextLevel} next time!
                </p>
              )}

              {revisionCheck.addressedFeedback && noMoreIssuesFound && (
                <div className="mt-3 p-3 rounded-lg bg-white/80 border border-emerald-200 text-xs text-emerald-950 font-medium space-y-1.5">
                  <p>
                    Coco checked your whole paragraph — no more major fixes are needed! You can submit your card now.
                  </p>
                  {secondFocusTip?.tip && (
                    <div className="pt-1.5 border-t border-emerald-200/70 text-slate-700 font-normal">
                      <span className="font-bold text-slate-800">Writing Tip (Optional): </span>
                      <span>{secondFocusTip.tip}</span>
                      {showKorean && secondFocusTip.tipKo && (
                        <p className="mt-1 text-slate-600">{secondFocusTip.tipKo}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {revisionCheck.addressedFeedback && focusRound === 1 && !noMoreIssuesFound && (
                <div className="mt-3 pt-3 border-t border-emerald-200/80 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onStartSecondFocus}
                    disabled={busy}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-white border border-emerald-400 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {isLoadingSecondFocus
                        ? 'Finding one more tip...'
                        : 'Improve One More Thing (더 수정해 보기)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={busy}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
                  >
                    Submit Card (제출하기)
                  </button>
                </div>
              )}

              {revisionCheck.addressedFeedback && focusRound === 2 && (
                <p className="mt-2.5 text-xs font-semibold text-emerald-800">
                  Awesome! You completed both focus points. Click Submit Card whenever you are ready!
                </p>
              )}
            </div>
          )}

          {!isFallback && !isAllClear && hint3FailedForFocus && (
            <div
              role="status"
              className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs sm:text-sm text-amber-950 leading-relaxed"
            >
              You tried all 3 hints for this focus point. Review Hints 1–3 on the right, edit your paragraph freely, and click <strong>Submit Card &amp; See Result</strong> when you&apos;re ready!
            </div>
          )}

          {showCheckAction && (
            <div className="mt-5">
              <button
                type="button"
                onClick={onCheckRevision}
                disabled={busy}
                className={
                  checkIsPrimary
                    ? 'w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-teal-700 text-white hover:bg-teal-800 shadow-sm text-base font-bold disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2.5'
                    : 'w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-teal-700 text-teal-800 bg-teal-50 hover:bg-teal-100 text-sm font-semibold disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2'
                }
              >
                {isChecking ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                )}
                <span>{isChecking ? 'Checking your revision...' : 'Check My Revision'}</span>
              </button>
              {checkIsPrimary && (
                <p className="mt-2 text-xs text-slate-500 text-center">
                  Ask Coco to check your fix first — or submit anytime below.
                </p>
              )}
            </div>
          )}

          {/* Bottom Navigation (Submit anytime!) */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="w-full sm:w-auto justify-center min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Hint</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={busy}
              className={
                checkIsPrimary
                  ? 'w-full sm:w-auto justify-center min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors inline-flex items-center gap-2'
                  : 'w-full sm:w-auto justify-center min-h-[50px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 shadow-sm disabled:opacity-60 transition-colors inline-flex items-center gap-2'
              }
            >
              <span>Submit Card &amp; See Result</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Right: Coco Feedback updated to current Hint stage */}
        <aside className="lg:col-span-5 space-y-5">
          <CocoCard
            feedback={feedback}
            showKorean={showKorean}
            onToggleKorean={onToggleKorean}
            fallbackNotice={fallbackNotice}
            onRetryFeedback={onRetryFeedback}
            isRetryingFeedback={isRetryingFeedback}
            focusRound={focusRound}
            hintLevel={revealedHintLevel}
            reviewAllHints={hint3FailedForFocus}
          />
        </aside>
      </div>
    </div>
  );
}
