import { useEffect, useState } from 'react';
import { ArrowLeft, GraduationCap, RefreshCw } from 'lucide-react';
import { fetchAllRecordsForTeacher } from '../services/recordsService';
import type { TopicId, WritingRecord } from '../types';

interface TeacherViewProps {
  teacherEmail: string;
  onBackHome: () => void;
}

type TopicFilter = 'all' | TopicId;

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

export function TeacherView({ teacherEmail, onBackHome }: TeacherViewProps) {
  const [records, setRecords] = useState<WritingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TopicFilter>('all');

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchAllRecordsForTeacher();
      setRecords(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load student records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = filter === 'all' ? records : records.filter((r) => r.topic === filter);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              Teacher View · Read-Only
            </h1>
          </div>

          <button
            type="button"
            onClick={loadRecords}
            disabled={loading}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="text-sm text-slate-600">
            Signed in as <span className="font-semibold text-slate-900">{teacherEmail}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">{filtered.length} records</span>
          </div>

          {/* Topic Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            {(
              [
                { id: 'all', label: 'All Topics' },
                { id: 'food', label: 'Food' },
                { id: 'place', label: 'Place' },
                { id: 'hobby', label: 'Hobby' },
              ] as { id: TopicFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
            Loading all student learning records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
            No student writing records found yet.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((rec) => (
              <article
                key={rec.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="text-sm font-bold text-slate-900">{rec.studentName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(rec.createdAtIso)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{rec.topicTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Level {rec.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {rec.hintsUsed} {rec.hintsUsed === 1 ? 'hint' : 'hints'} used
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
                    <div className="text-xs font-bold text-emerald-800">Final Text</div>
                    <p className="mt-1.5 text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                      {rec.finalParagraph}
                    </p>
                  </div>
                </div>

                {rec.reflection && (
                  <p className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Student Reflection: </span>
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
