import { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Lightbulb, ShieldAlert } from 'lucide-react';
import { countSentences } from '../utils/writingLogic';
import type { PlanAnswers, SupportLevel, TopicConfig } from '../types';

interface DraftStepProps {
  topic: TopicConfig;
  level: SupportLevel;
  planAnswers: PlanAnswers;
  draft: string;
  piiWarning: string | null;
  validationError: string | null;
  isSubmitting: boolean;
  onChangeDraft: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DraftStep({
  topic,
  level,
  planAnswers,
  draft,
  piiWarning,
  validationError,
  isSubmitting,
  onChangeDraft,
  onBack,
  onNext,
}: DraftStepProps) {
  const [notesOpen, setNotesOpen] = useState(true);
  const sentenceCount = countSentences(draft);
  const hasPlanNotes = Boolean(
    planAnswers.q1.trim() || planAnswers.q2.trim() || planAnswers.q3.trim() || planAnswers.q4.trim()
  );

  const insertHelperText = (snippet: string) => {
    const clean = snippet.replace(/______/g, '').trim();
    const prefix = draft.trim().length > 0 && !draft.endsWith(' ') && !draft.endsWith('\n') ? ' ' : '';
    onChangeDraft(`${draft}${prefix}${clean} `);
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Writing Area */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500">
                Step 2 · Draft
                <span aria-hidden="true"> · </span>
                <span>{topic.title}</span>
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                Write your recommendation paragraph
              </h1>
            </div>

            <div
              aria-live="polite"
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-800 font-mono tabular-nums"
            >
              {sentenceCount} {sentenceCount === 1 ? 'sentence' : 'sentences'} · Goal ~4
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="draft-textarea" className="block text-sm font-semibold text-slate-800">
              Your English Draft
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Try writing about 4 sentences using connectors like <em>and, but, because, so</em>.
            </p>
            <textarea
              id="draft-textarea"
              rows={7}
              maxLength={2000}
              value={draft}
              onChange={(e) => onChangeDraft(e.target.value)}
              placeholder={`Write 3–4 sentences about ${topic.title.toLowerCase()}...`}
              className="mt-2.5 w-full p-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
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

          {validationError && !piiWarning && (
            <div
              role="alert"
              className="mt-4 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
            >
              {validationError}
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Plan</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={isSubmitting}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
            >
              <span>{isSubmitting ? 'Coco is reading...' : "Next: Get Coco's Hint"}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Right Side: Idea Notes + Level-Based Scaffolding */}
        <aside className="lg:col-span-5 space-y-5">
          {/* Idea Notes Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <button
              type="button"
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen((v) => !v)}
              className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900">Idea Notes (from Step 1)</h2>
                <p className="text-xs text-slate-500">Use your plan while writing</p>
              </div>
              {notesOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              )}
            </button>

            {notesOpen && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 text-sm">
                {hasPlanNotes ? (
                  topic.planningQuestions.map((q) => (
                    <div key={q.key} className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs font-medium text-slate-500">{q.question}</div>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {planAnswers[q.key].trim() || '—'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No planning notes yet. You can go back to Step 1 anytime to add ideas.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Level-Based Support */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">
                Level {level} Writing Support
              </h2>
            </div>

            {level === 1 && (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">
                    Guided Outline (click a starter to copy it into your box)
                  </div>
                  <div className="mt-2 space-y-2">
                    {topic.level1Outline.map((line, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => insertHelperText(line)}
                        className="w-full min-h-[44px] text-left px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-xs sm:text-sm text-slate-800 transition-colors"
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Useful Expressions</div>
                  <ul className="mt-2 space-y-1.5 text-xs sm:text-sm text-slate-700">
                    {topic.level1Expressions.map((expr, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-teal-700" aria-hidden="true">•</span>
                        <span>{expr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {level === 2 && (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Writing Prompts</div>
                  <ul className="mt-2 space-y-2 text-xs sm:text-sm text-slate-700">
                    {topic.level2Prompts.map((p, idx) => (
                      <li key={idx} className="p-2.5 rounded-xl bg-slate-50">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Helpful Keywords</div>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-700">
                    {topic.level2Keywords.join(' · ')}
                  </p>
                </div>
              </div>
            )}

            {level === 3 && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                You are writing independently at Level 3! Use your Idea Notes and connectors
                (<em>and, but, because, so</em>) to write your own 4-sentence recommendation.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
