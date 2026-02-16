import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';

interface NavigationProps {
  activeTab: 'track' | 'focus' | 'statistics';
  onTabChange: (tab: 'track' | 'focus' | 'statistics') => void;
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
    <nav className="fixed top-0 left-0 right-0 h-[70px] paper-card paper-border z-50 paper-shadow">
      <div className="max-w-[1400px] mx-auto h-full px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onMonthChange('prev')}
            className="p-2.5 hover:bg-amber-50 rounded-lg transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 ink-text-muted" />
          </button>

          <div className="flex gap-2 bg-amber-50/50 rounded-lg p-1.5 paper-border">
            <button
              onClick={() => onTabChange('track')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                activeTab === 'track'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => onTabChange('focus')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                activeTab === 'focus'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              Focus
            </button>
            <button
              onClick={() => onTabChange('statistics')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                activeTab === 'statistics'
                  ? 'paper-card ink-text paper-shadow'
                  : 'ink-text-muted hover:bg-amber-50'
              }`}
            >
              Statistics
            </button>
          </div>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <h1 className="text-2xl font-bold ink-text tracking-tight">{currentMonth}</h1>
          
          <span className="px-4 py-1 text-sm font-bold text-indigo-700 border-2 border-indigo-600 rounded-full">
           1. 5lakb/mo / $5.5k/mo / £4k/mo
          </span>
          {canGoNext && (
            <button
              onClick={() => onMonthChange('next')}
              className="p-2 hover:bg-amber-50 rounded-lg transition-all hover:scale-105 active:scale-95"
            >
              <ChevronRight className="w-5 h-5 ink-text-muted" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 bg-amber-50 px-5 py-2.5 rounded-lg paper-border paper-shadow">
          <Flame className="w-6 h-6 text-amber-600" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold ink-text">
              {streakDays}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-amber-700 leading-tight">day streak</span>
              <span className="text-xs ink-text-muted leading-tight">≥8h/day</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
