import { ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';

type Tab = 'track' | 'statistics' | 'vision';

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  currentMonth: string;
  onMonthChange: (direction: 'prev' | 'next') => void;
  streakDays: number;
  canGoNext: boolean;
}

export default function Navigation({
  activeTab,
  onTabChange,
  currentMonth,
  onMonthChange,
  streakDays,
  canGoNext,
}: NavigationProps) {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 paper-card paper-border paper-shadow"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        {/* Mobile layout */}
        <div className="flex md:hidden flex-col py-2 gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onMonthChange('prev')}
                className="p-1.5 hover:bg-amber-50 rounded-lg transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 ink-text-muted" />
              </button>
              <h1 className="text-base font-bold ink-text whitespace-nowrap">{currentMonth}</h1>
              {canGoNext ? (
                <button
                  onClick={() => onMonthChange('next')}
                  className="p-1.5 hover:bg-amber-50 rounded-lg transition-all active:scale-95"
                >
                  <ChevronRight className="w-5 h-5 ink-text-muted" />
                </button>
              ) : (
                <div className="w-8" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg paper-border">
                <Flame className="w-4 h-4 text-amber-600" />
                <span className="text-base font-bold ink-text">{streakDays}</span>
              </div>
              <img src="/profile.png" alt="profile" className="w-8 h-8 rounded-full object-cover" />
            </div>
          </div>
          <div className="flex gap-1.5 bg-amber-50/50 rounded-lg p-1 paper-border">
            <button
              onClick={() => onTabChange('track')}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'track'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => onTabChange('statistics')}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'statistics'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => onTabChange('vision')}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1 ${
                activeTab === 'vision'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'vision' ? 'text-violet-500' : ''}`} />
              Vision
            </button>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:flex h-[70px] items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-6">
            <button
              onClick={() => onMonthChange('prev')}
              className="p-2.5 hover:bg-amber-50 rounded-lg transition-all hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 ink-text-muted" />
            </button>

            <div className="flex gap-2 bg-amber-50/50 rounded-lg p-1.5 paper-border">
              <button
                onClick={() => onTabChange('track')}
                className={`px-4 lg:px-6 py-2 rounded-md font-semibold transition-all ${
                  activeTab === 'track'
                    ? 'paper-card ink-text paper-shadow'
                    : 'ink-text-muted hover:bg-amber-50'
                }`}
              >
                Track
              </button>
              <button
                onClick={() => onTabChange('statistics')}
                className={`px-4 lg:px-6 py-2 rounded-md font-semibold transition-all ${
                  activeTab === 'statistics'
                    ? 'paper-card ink-text paper-shadow'
                    : 'ink-text-muted hover:bg-amber-50'
                }`}
              >
                Statistics
              </button>
              <button
                onClick={() => onTabChange('vision')}
                className={`px-4 lg:px-6 py-2 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'vision'
                    ? 'paper-card ink-text paper-shadow'
                    : 'ink-text-muted hover:bg-amber-50'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${activeTab === 'vision' ? 'text-violet-500' : ''}`} />
                Vision
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold ink-text tracking-tight whitespace-nowrap">
              {currentMonth}
            </h1>
            {canGoNext && (
              <button
                onClick={() => onMonthChange('next')}
                className="p-2 hover:bg-amber-50 rounded-lg transition-all hover:scale-105 active:scale-95"
              >
                <ChevronRight className="w-5 h-5 ink-text-muted" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 lg:gap-3 bg-amber-50 px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg paper-border paper-shadow">
              <Flame className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
              <div className="flex items-center gap-1.5 lg:gap-2">
                <span className="text-xl lg:text-2xl font-bold ink-text">{streakDays}</span>
                <div className="flex flex-col">
                  <span className="text-[10px] lg:text-xs font-semibold text-amber-700 leading-tight">day streak</span>
                  <span className="text-[10px] lg:text-xs ink-text-muted leading-tight">&ge;8h/day</span>
                </div>
              </div>
            </div>
            <img src="/profile.png" alt="profile" className="w-9 h-9 lg:w-10 lg:h-10 rounded-full object-cover" />
          </div>
        </div>
      </div>
    </nav>
  );
}
