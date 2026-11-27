import { ArrowLeft, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { splitDraftWithHighlight } from '../utils/writingLogic';
import { CocoCard } from './CocoCard';
import type { CoachFeedback, FocusRound, HintLevel, TopicConfig } from '../types';

interface HintStepProps {
  topic: TopicConfig;
  focusBaseDraft: string;
  currentRevisedDraft: string;
  feedback: CoachFeedback;
  focusRound: FocusRound;
  revealedHintLevel: HintLevel;
  hintBanner?: string | null;
  showKorean: boolean;
  fallbackNotice: string | null;
  onRetryFeedback?: () => void;
  isRetryingFeedback?: boolean;
  onToggleKorean: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmitNow: () => void;
}

export function HintStep({
  topic,
  focusBaseDraft,
  currentRevisedDraft,
  feedback,
  focusRound,
  revealedHintLevel,
  hintBanner,
  showKorean,
  fallbackNotice,
  onRetryFeedback,
  isRetryingFeedback,
  onToggleKorean,
  onBack,
  onNext,
  onSubmitNow,
}: HintStepProps) {
  const isFallback = Boolean(feedback.isFallback);
  const isAllClear = !isFallback && Boolean(feedback.noMoreIssues);
  const highlighted =
    isFallback || isAllClear ? null : splitDraftWithHighlight(focusBaseDraft, feedback.highlightText);
  const hasSeparateRevision =
    currentRevisedDraft.trim().length > 0 &&
    currentRevisedDraft.trim() !== focusBaseDraft.trim();

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Draft with Highlighted Focus Spot */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="pb-4 border-b border-slate-200">
            <div className="text-xs font-medium text-slate-500">
              Step 3 · {isFallback ? 'Self-Check' : isAllClear ? 'Hint' : `Hint ${revealedHintLevel}`}
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
              {isFallback
                ? 'Review your draft with self-check'
                : isAllClear
                ? 'Coco reviewed your draft'
                : revealedHintLevel === 2
                ? 'Hint 2 · Try a closer clue'
                : revealedHintLevel === 3
                ? 'Hint 3 · Look at a pattern example'
                : "Look at Coco's focus spot"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isFallback
                ? 'Use the topic questions on the right to check your paragraph yourself.'
                : isAllClear
                ? 'Your draft already looks strong! Polish anything in Rewrite or submit your card now.'
                : revealedHintLevel === 2
                ? 'Read Hint 2 on the right for the same focus point, then go back to Rewrite.'
                : revealedHintLevel === 3
                ? 'Look at the example pattern in Hint 3 on the right, then write your own fix.'
                : highlighted
                ? 'The highlighted part shows where to focus when you rewrite.'
                : 'Coco noticed one idea you can expand in the next step.'}
            </p>
          </div>

          {hintBanner && (
            <div
              role="status"
              className="mt-4 p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-950 font-medium flex items-start gap-2"
            >
              <Lightbulb className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{hintBanner}</span>
            </div>
          )}

          <div
            aria-label="Your draft with highlighted focus area"
            className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-base text-slate-900 leading-relaxed whitespace-pre-wrap"
          >
            {highlighted ? (
              <>
                {highlighted.before}
                <mark className="bg-amber-200 text-slate-900 px-1 py-0.5 rounded font-medium">
                  {highlighted.match}
                </mark>
                {highlighted.after}
              </>
            ) : (
              focusBaseDraft
            )}
          </div>

          {hasSeparateRevision && (
            <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800">Your Latest Revision (Saved)</div>
              <p className="mt-1 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {currentRevisedDraft}
              </p>
            </div>
          )}

          {!isFallback && !isAllClear && !highlighted && (
            <p className="mt-3 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Focus point: Look at Coco&apos;s hint on the right to see what to add or improve.
            </p>
          )}

          {/* Bottom Navigation */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Draft</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onSubmitNow}
                className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>Submit Card</span>
              </button>

              <button
                type="button"
                onClick={onNext}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors inline-flex items-center gap-2"
              >
                <span>Next: Rewrite</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Right: Coco's Focused Feedback updated to current Hint stage */}
        <aside className="lg:col-span-6 space-y-4">
          <CocoCard
            feedback={feedback}
            showKorean={showKorean}
            onToggleKorean={onToggleKorean}
            fallbackNotice={fallbackNotice}
            onRetryFeedback={onRetryFeedback}
            isRetryingFeedback={isRetryingFeedback}
            focusRound={focusRound}
            hintLevel={revealedHintLevel}
          />
        </aside>
      </div>
    </div>
  );
}
