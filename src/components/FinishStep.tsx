import { useState } from 'react';
import { ArrowLeft, BookOpen, Check, Eye, Save, X } from 'lucide-react';
import type { SupportLevel, TopicConfig } from '../types';

interface FinishStepProps {
  topic: TopicConfig;
  authorName: string;
  level: SupportLevel;
  nextLevel: SupportLevel;
  hintsUsed: number;
  firstDraft: string;
  finalParagraph: string;
  reflection: string;
  isSaving: boolean;
  isSaved: boolean;
  saveError: string | null;
  onChangeReflection: (value: string) => void;
  onSave: () => void;
  onOpenCollection: () => void;
  onBack: () => void;
  onStartNew: () => void;
}

const REFLECTION_STARTERS = [
  'I added a clearer reason.',
  'I fixed a verb form.',
  'I added describing words.',
];

export function FinishStep({
  topic,
  authorName,
  level,
  nextLevel,
  hintsUsed,
  firstDraft,
  finalParagraph,
  reflection,
  isSaving,
  isSaved,
  saveError,
  onChangeReflection,
  onSave,
  onOpenCollection,
  onBack,
  onStartNew,
}: FinishStepProps) {
  const [showSampleModal, setShowSampleModal] = useState(false);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const levelChangeText =
    nextLevel > level
      ? `Great job! You'll move to Level ${nextLevel} next time!`
      : nextLevel < level
      ? `Next time, we will practice at Level ${nextLevel} with extra support.`
      : `Next topic will stay at Level ${nextLevel}.`;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Row: Final "My Pick" Recommendation Card */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 bg-slate-100 min-h-[200px]">
            <img
              src={topic.imageUrl}
              alt={topic.imageAlt}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-800">
                <span>My Pick Card</span>
                <span aria-hidden="true">·</span>
                <span>{topic.title}</span>
              </div>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Your Recommendation Card is Ready!
              </h1>

              {/* Final revised paragraph ONLY (never first draft) */}
              <blockquote
                data-testid="my-pick-final-paragraph"
                className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-lg text-slate-900 leading-relaxed"
              >
                {finalParagraph}
              </blockquote>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Picked by {authorName}</span>
              <span>{todayFormatted}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Middle Row: Before / After Comparison */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Before / After Comparison</h2>
          <div className="text-xs font-medium text-slate-600 font-mono tabular-nums">
            AI helped me with: Level {level} · {hintsUsed} {hintsUsed === 1 ? 'hint' : 'hints'}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-500">Before (First Draft)</div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {firstDraft}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <div className="text-xs font-bold text-emerald-800">After (Final Paragraph)</div>
            <p className="mt-2 text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
              {finalParagraph}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
          <p className="text-xs sm:text-sm font-semibold text-teal-900">{levelChangeText}</p>
          <span
            data-testid="next-writing-level"
            className="text-xs font-mono tabular-nums font-bold text-teal-950 bg-white px-2.5 py-1 rounded-lg border border-teal-200"
          >
            Next Writing Level: {nextLevel}
          </span>
        </div>
      </section>

      {/* Short Reflection & Save / See a Sample */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <label htmlFor="reflection-input" className="block text-sm font-bold text-slate-900">
          Short Reflection: What did you improve today?
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {REFLECTION_STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => onChangeReflection(starter)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>
        <input
          id="reflection-input"
          type="text"
          maxLength={500}
          value={reflection}
          onChange={(e) => onChangeReflection(e.target.value)}
          placeholder="Write one sentence about what you improved..."
          className="mt-3 w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
        />

        {saveError && (
          <div
            role="alert"
            className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900"
          >
            {saveError}
          </div>
        )}

        {/* Primary Finish Actions: Save + See a Sample */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isSaved}
            className={`min-h-[48px] px-6 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
              isSaved
                ? 'bg-emerald-700 text-white'
                : 'bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            <span>{isSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* "See a Sample" appears ONLY on Step 5 */}
          <button
            type="button"
            onClick={() => setShowSampleModal(true)}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>See a Sample</span>
          </button>

          {isSaved && (
            <button
              type="button"
              onClick={onOpenCollection}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-teal-700 text-teal-800 bg-teal-50 hover:bg-teal-100 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>Open My Writing Collection</span>
            </button>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Rewrite</span>
          </button>

          <button
            type="button"
            onClick={onStartNew}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Pick Another Topic
          </button>
        </div>
      </section>

      {/* Step 5 Sample Modal */}
      {showSampleModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sample-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <h3 id="sample-dialog-title" className="text-lg font-bold text-slate-900">
                Sample Paragraph · {topic.title}
              </h3>
              <button
                type="button"
                aria-label="Close sample modal"
                onClick={() => setShowSampleModal(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-base text-slate-900 leading-relaxed">
              {topic.sampleParagraph}
            </p>
            <p className="mt-3 text-sm text-slate-600">{topic.sampleNote}</p>

            <button
              type="button"
              onClick={() => setShowSampleModal(false)}
              className="mt-5 w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
            >
              Close Sample
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
