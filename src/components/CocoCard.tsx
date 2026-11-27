import { useEffect, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Feather, Languages, RefreshCw } from 'lucide-react';
import { COACH_COCO_IMAGE } from '../data/topics';
import type { CoachFeedback, FocusRound, HintLevel } from '../types';

interface CocoCardProps {
  feedback: CoachFeedback;
  showKorean: boolean;
  onToggleKorean: () => void;
  fallbackNotice?: string | null;
  onRetryFeedback?: () => void;
  isRetryingFeedback?: boolean;
  focusRound?: FocusRound;
  hintLevel?: HintLevel;
  reviewAllHints?: boolean;
}

export function CocoCard({
  feedback,
  showKorean,
  onToggleKorean,
  fallbackNotice,
  onRetryFeedback,
  isRetryingFeedback,
  focusRound = 1,
  hintLevel = 1,
  reviewAllHints = false,
}: CocoCardProps) {
  const isSelfCheckFallback = Boolean(feedback.isFallback);
  const isAllClear = !isSelfCheckFallback && Boolean(feedback.noMoreIssues);
  const [previousHintsOpen, setPreviousHintsOpen] = useState(reviewAllHints);

  useEffect(() => {
    setPreviousHintsOpen(reviewAllHints);
  }, [reviewAllHints, focusRound, hintLevel]);

  const currentHintLabel =
    hintLevel === 1
      ? '3. Guiding Question (Hint 1)'
      : hintLevel === 2
      ? '3. Closer Clue (Hint 2)'
      : '3. Same-Pattern Example (Hint 3)';

  const currentHintEn =
    hintLevel === 1 ? feedback.question : hintLevel === 2 ? feedback.hint2 : feedback.hint3;
  const currentHintKo =
    hintLevel === 1 ? feedback.questionKo : hintLevel === 2 ? feedback.hint2Ko : feedback.hint3Ko;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      {/* Header row: Coco Avatar + Name + Korean translation toggle */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative flex items-center justify-center">
            <img
              src={COACH_COCO_IMAGE}
              alt="Coco the writing coach"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <Feather className="w-5 h-5 text-teal-700 absolute -z-10" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {isSelfCheckFallback ? 'Topic Self-Check' : 'Coco'}
            </h2>
            <p className="text-xs text-slate-500">
              {isSelfCheckFallback
                ? 'AI coach unavailable · Self-check questions'
                : isAllClear
                ? 'Your English writing coach · All Clear!'
                : `Your English writing coach · Focus ${focusRound} of 2 · Hint ${hintLevel}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={showKorean}
          onClick={onToggleKorean}
          className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            showKorean
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Languages className="w-4 h-4" aria-hidden="true" />
          <span>한국어 번역</span>
        </button>
      </div>

      {fallbackNotice && (
        <div
          role="status"
          className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
        >
          <span>{fallbackNotice}</span>
          {onRetryFeedback && (
            <button
              type="button"
              onClick={onRetryFeedback}
              disabled={isRetryingFeedback}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 disabled:opacity-60 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRetryingFeedback ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRetryingFeedback ? 'Retrying...' : 'Retry AI'}</span>
            </button>
          )}
        </div>
      )}

      {isSelfCheckFallback ? (
        <div className="mt-4 space-y-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-teal-700" aria-hidden="true" />
              <span>{feedback.praise}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{feedback.fixPoint}</p>
            {showKorean && (
              <p className="mt-1 text-xs text-slate-500">
                {feedback.praiseKo} — {feedback.fixPointKo}
              </p>
            )}

            <ul className="mt-3 space-y-2.5">
              {(feedback.selfCheckQuestions ?? []).map((item, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-slate-200 text-sm text-slate-900"
                >
                  <div className="font-medium leading-relaxed">{item.question}</div>
                  {showKorean && (
                    <div className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {item.questionKo}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : isAllClear ? (
        <div className="mt-4 space-y-3.5">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-xs font-bold text-emerald-800">1. Praise</div>
            <p className="mt-1 text-sm font-medium text-slate-900 leading-relaxed">
              {feedback.praise}
            </p>
            {showKorean && feedback.praiseKo && (
              <p className="mt-1.5 text-xs text-emerald-900 leading-relaxed">
                {feedback.praiseKo}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
            <div className="text-xs font-bold text-teal-900">No Major Fixes Needed</div>
            <p className="mt-1 text-sm text-slate-800 leading-relaxed">
              Your paragraph already has clear ideas, a reason, and natural A2 English. You can polish anything freely in Rewrite or submit your card!
            </p>
            {showKorean && (
              <p className="mt-1.5 text-xs text-teal-900 leading-relaxed">
                이미 생각과 추천 이유, 문장이 잘 갖춰져 있어요! 수정 단계에서 자유롭게 다듬거나 바로 카드를 제출할 수 있어요.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Order: Praise -> Fix -> Active Hint Stage (Hint 1 / Hint 2 / Hint 3) */
        <div className="mt-4 space-y-3.5">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-xs font-bold text-emerald-800">1. Praise</div>
            <p className="mt-1 text-sm font-medium text-slate-900 leading-relaxed">
              {feedback.praise}
            </p>
            {showKorean && (
              <p className="mt-1.5 text-xs text-emerald-900 leading-relaxed">
                {feedback.praiseKo}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="text-xs font-bold text-amber-900">2. Fix (One Focus Point)</div>
            <p className="mt-1 text-sm font-medium text-slate-900 leading-relaxed">
              {feedback.fixPoint}
            </p>
            {showKorean && (
              <p className="mt-1.5 text-xs text-amber-950 leading-relaxed">
                {feedback.fixPointKo}
              </p>
            )}
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              hintLevel === 3
                ? 'bg-amber-50/70 border-amber-200'
                : hintLevel === 2
                ? 'bg-teal-50/60 border-teal-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div
              className={`text-xs font-bold ${
                hintLevel === 3 ? 'text-amber-900' : 'text-teal-800'
              }`}
            >
              {currentHintLabel}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900 leading-relaxed">
              {currentHintEn}
            </p>
            {hintLevel === 3 && (
              <p className="mt-1 text-xs text-amber-900">
                Look at the pattern in this unrelated example, then try your own sentence!
              </p>
            )}
            {showKorean && currentHintKo && (
              <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">{currentHintKo}</p>
            )}
          </div>

          {hintLevel >= 2 && (
            <div className="border border-slate-200 rounded-xl bg-slate-50/70">
              <button
                type="button"
                aria-expanded={previousHintsOpen}
                onClick={() => setPreviousHintsOpen((v) => !v)}
                className="w-full min-h-[40px] px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <span>
                  {hintLevel === 2
                    ? 'Review previous hint (Hint 1)'
                    : 'Review previous hints (Hints 1–2)'}
                </span>
                {previousHintsOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                )}
              </button>

              {previousHintsOpen && (
                <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-slate-200/80 text-xs text-slate-700">
                  <div>
                    <div className="font-bold text-slate-800">Hint 1 · Guiding Question</div>
                    <p className="mt-0.5 leading-relaxed">{feedback.question}</p>
                    {showKorean && feedback.questionKo && (
                      <p className="mt-0.5 text-slate-600 leading-relaxed">{feedback.questionKo}</p>
                    )}
                  </div>
                  {hintLevel === 3 && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <div className="font-bold text-slate-800">Hint 2 · Closer Clue</div>
                      <p className="mt-0.5 leading-relaxed">{feedback.hint2}</p>
                      {showKorean && feedback.hint2Ko && (
                        <p className="mt-0.5 text-slate-600 leading-relaxed">{feedback.hint2Ko}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Required notice on every feedback screen */}
      <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        AI can be wrong. If you are not sure, check a dictionary or your English textbook.
      </p>
    </div>
  );
}
