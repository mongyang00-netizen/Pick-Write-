import { ArrowLeft, BookOpen } from 'lucide-react';
import type { WritingRecord } from '../types';

interface CollectionViewProps {
  records: WritingRecord[];
  isSignedIn: boolean;
  loading: boolean;
  onBackHome: () => void;
  onStartWriting: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function CollectionView({
  records,
  isSignedIn,
  loading,
  onBackHome,
  onStartWriting,
}: CollectionViewProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            My Writing Collection
          </h1>

          <button
            type="button"
            onClick={onStartWriting}
            className="min-h-[44px] px-4 rounded-xl bg-teal-700 text-white text-xs sm:text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            New Pick
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!isSignedIn && (
          <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700">
            Showing practice cards saved on this device. Sign in with Google on the Home screen to
            save records to your student account.
          </div>
        )}

        {loading ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
            Loading your writing collection...
          </div>
        ) : records.length === 0 ? (
          <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6 text-teal-700" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">No saved recommendations yet</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Pick a topic, revise your paragraph with Coco, and click Save on Step 5 to keep your
              card here.
            </p>
            <button
              type="button"
              onClick={onStartWriting}
              className="mt-5 min-h-[48px] px-6 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
            >
              Start Writing
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {records.map((rec) => (
              <article
                key={rec.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900 text-sm">{rec.topicTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(rec.createdAtIso)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Level {rec.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      AI helped me with: {rec.hintsUsed} {rec.hintsUsed === 1 ? 'hint' : 'hints'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500">First Draft</div>
                    <p className="mt-1.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {rec.firstDraft}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <div className="text-xs font-bold text-emerald-800">Final Paragraph</div>
                    <p className="mt-1.5 text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                      {rec.finalParagraph}
                    </p>
                  </div>
                </div>

                {rec.reflection && (
                  <p className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Reflection: </span>
                    {rec.reflection}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
