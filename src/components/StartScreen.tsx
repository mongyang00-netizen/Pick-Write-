import { BookOpen, GraduationCap, ShieldAlert, Utensils, MapPin, Palette, ArrowRight, LogIn, LogOut } from 'lucide-react';
import { TOPICS } from '../data/topics';
import type { SupportLevel, TopicId } from '../types';

interface StartScreenProps {
  currentLevel: SupportLevel;
  user: {
    uid: string;
    displayName: string;
    email: string;
    isTeacher: boolean;
  } | null;
  authLoading: boolean;
  authError: string | null;
  collectionCount: number;
  onSelectTopic: (topicId: TopicId) => void;
  onOpenCollection: () => void;
  onOpenTeacherView: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

function TopicFallbackIcon({ topicId }: { topicId: TopicId }) {
  if (topicId === 'food') return <Utensils className="w-8 h-8 text-teal-700" aria-hidden="true" />;
  if (topicId === 'place') return <MapPin className="w-8 h-8 text-teal-700" aria-hidden="true" />;
  return <Palette className="w-8 h-8 text-teal-700" aria-hidden="true" />;
}

export function StartScreen({
  currentLevel,
  user,
  authLoading,
  authError,
  collectionCount,
  onSelectTopic,
  onOpenCollection,
  onOpenTeacherView,
  onSignIn,
  onSignOut,
}: StartScreenProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
          <a
            href="#topics"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Pick &amp; Write!
          </a>

          <nav aria-label="Primary navigation" className="flex items-center gap-3 sm:gap-6">
            <a
              href="#topics"
              className="hidden md:inline-block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Topics
            </a>
            <button
              type="button"
              onClick={onOpenCollection}
              className="min-h-[44px] px-1 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">Collection</span>
              <span className="hidden sm:inline">My Writing Collection</span>
            </button>
            {user?.isTeacher && (
              <button
                type="button"
                onClick={onOpenTeacherView}
                className="min-h-[44px] px-2.5 rounded-lg text-xs sm:text-sm font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" aria-hidden="true" />
                <span>Teacher View</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="truncate max-w-[84px] sm:max-w-[160px]">{user.displayName}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={authLoading}
                className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-teal-700 text-white text-xs sm:text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span className="sm:hidden">{authLoading ? '...' : 'Sign in'}</span>
                <span className="hidden sm:inline">
                  {authLoading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero / Welcome */}
        <section className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>CEFR A2 English Practice</span>
            <span aria-hidden="true">·</span>
            <span>4-Sentence Recommendation</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-teal-800 font-semibold">
              Current Support: Level {currentLevel}
            </span>
          </div>

          <h1 className="mt-2.5 text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Pick something you love. Write a short recommendation.
          </h1>

          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            Choose a topic below, answer four quick planning questions, write your draft, and get
            one clear hint from Coco to make your recommendation card shine.
          </p>

          {authError && (
            <div
              role="alert"
              className="mt-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900"
            >
              {authError}
            </div>
          )}

          {/* Privacy Warning on Start Screen (PRD Section 8) */}
          <div
            role="note"
            className="mt-4 p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3"
          >
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900">Keep your personal info private: </span>
              Do not write your real name, school name, phone number, or home address. Texts with
              personal information are never sent to the AI.
            </div>
          </div>
        </section>

        {/* Three Topic Cards */}
        <section id="topics" aria-labelledby="topics-heading" className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="topics-heading" className="text-lg sm:text-xl font-bold text-slate-900">
              Choose a topic to start
            </h2>
            <span className="text-xs text-slate-500">
              5 steps: Plan · Draft · Hint · Rewrite · Finish
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
            {TOPICS.map((topic) => (
              <article
                key={topic.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col transition-shadow hover:shadow-md"
              >
                <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                  <img
                    src={topic.imageUrl}
                    alt={topic.imageAlt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 -z-10 flex items-center justify-center bg-slate-100">
                    <TopicFallbackIcon topicId={topic.id} />
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {topic.cardCategoryLabel}
                      <span aria-hidden="true"> · </span>
                      <span>{topic.koreanTitle}</span>
                    </div>
                    <h3 className="mt-1.5 text-lg font-bold text-slate-900">{topic.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{topic.tagline}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectTopic(topic.id)}
                    className="mt-5 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
                  >
                    <span>Start "{topic.title}"</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* My Writing Collection Bar */}
        <section className="mt-10 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-teal-700" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">My Writing Collection</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {collectionCount > 0
                  ? `You have ${collectionCount} saved recommendation ${
                      collectionCount === 1 ? 'card' : 'cards'
                    } to review.`
                  : 'Finish a paragraph and click Save to build your personal recommendation collection.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCollection}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Open Collection
          </button>
        </section>
      </main>
    </div>
  );
}
