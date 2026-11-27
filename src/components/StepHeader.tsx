import { Home } from 'lucide-react';
import type { SupportLevel, WizardStep } from '../types';

interface StepHeaderProps {
  currentStep: Exclude<WizardStep, 'start'>;
  level: SupportLevel;
  onGoHome: () => void;
}

const STEPS: { id: Exclude<WizardStep, 'start'>; number: number; label: string }[] = [
  { id: 'plan', number: 1, label: 'Plan' },
  { id: 'draft', number: 2, label: 'Draft' },
  { id: 'hint', number: 3, label: 'Hint' },
  { id: 'rewrite', number: 4, label: 'Rewrite' },
  { id: 'finish', number: 5, label: 'Finish' },
];

export function StepHeader({ currentStep, level, onGoHome }: StepHeaderProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === currentStep);
  const activeStep = STEPS[activeIndex] ?? STEPS[0];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
        {/* Upper left: Home button */}
        <button
          type="button"
          onClick={onGoHome}
          aria-label="Go to Home screen"
          className="min-h-[44px] px-2 sm:px-3 inline-flex items-center gap-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Home</span>
        </button>

        {/* Center: 5-step progress bar */}
        <nav
          aria-label="Writing steps progress"
          className="flex items-center gap-1 sm:gap-2 min-w-0"
        >
          {STEPS.map((step, idx) => {
            const isCurrent = idx === activeIndex;
            const isDone = idx < activeIndex;
            return (
              <div key={step.id} className="flex items-center gap-1 sm:gap-1.5">
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    isCurrent
                      ? 'bg-teal-700 text-white'
                      : isDone
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="font-mono tabular-nums">{step.number}</span>
                  <span className={isCurrent ? 'inline' : 'hidden md:inline'}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`hidden sm:block w-3 h-px ${
                      isDone ? 'bg-teal-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
          <span className="sr-only">
            Step {activeStep.number} of 5: {activeStep.label}
          </span>
        </nav>

        {/* Upper right: Current support level badge */}
        <div
          aria-label={`Current support level: Level ${level}`}
          className="px-2 sm:px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 font-mono tabular-nums whitespace-nowrap shrink-0"
        >
          Level {level}
        </div>
      </div>
    </header>
  );
}
