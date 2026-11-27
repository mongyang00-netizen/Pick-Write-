import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import type { PlanAnswers, TopicConfig } from '../types';

interface PlanStepProps {
  topic: TopicConfig;
  answers: PlanAnswers;
  piiWarning: string | null;
  onChangeAnswer: (key: keyof PlanAnswers, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function PlanStep({
  topic,
  answers,
  piiWarning,
  onChangeAnswer,
  onBack,
  onNext,
}: PlanStepProps) {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7">
        {/* Topic context row */}
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
          <img
            src={topic.imageUrl}
            alt={topic.imageAlt}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
          />
          <div>
            <div className="text-xs font-medium text-slate-500">
              Step 1 · Plan
              <span aria-hidden="true"> · </span>
              <span>{topic.title}</span>
            </div>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-bold text-slate-900">
              Organize your ideas first
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Short words or phrases are great. Your answers become Idea Notes in the next step.
            </p>
          </div>
        </div>

        {/* 4 Planning Questions */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNext();
          }}
          className="mt-6 space-y-5"
        >
          {topic.planningQuestions.map((item) => (
            <div key={item.key}>
              <label
                htmlFor={`plan-${item.key}`}
                className="block text-sm font-semibold text-slate-900"
              >
                {item.question}
              </label>
              <p className="mt-0.5 text-xs text-slate-500">{item.koreanHint}</p>
              <input
                id={`plan-${item.key}`}
                type="text"
                value={answers[item.key]}
                maxLength={300}
                onChange={(e) => onChangeAnswer(item.key, e.target.value)}
                placeholder={item.placeholder}
                className="mt-2 w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
              />
            </div>
          ))}

          {piiWarning && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900 flex items-start gap-2.5"
            >
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{piiWarning}</span>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors inline-flex items-center gap-2"
            >
              <span>Next: Write Draft</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
