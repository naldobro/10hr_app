import { useState, useEffect, useRef } from 'react';
import { db } from './lib/database';
import type { FocusPillar } from './types';
import Navigation from './components/Navigation';
import TrackTab from './components/TrackTab';
import StatisticsTab from './components/StatisticsTab';
import VisionTab from './components/VisionTab';

// Always work with exactly three focus pillars, whatever the stored array looks like.
function normalizePillars(raw: unknown): FocusPillar[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 3 }, (_, i) => {
    const p = arr[i] as Partial<FocusPillar> | undefined;
    return {
      title: typeof p?.title === 'string' ? p.title : '',
      body: typeof p?.body === 'string' ? p.body : '',
    };
  });
}

function App() {
  const [activeTab, setActiveTab] = useState<'track' | 'statistics' | 'vision'>('track');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [streakDays, setStreakDays] = useState(0);

  // The 3 focus pillars in the Vision nav bar. Seed from localStorage for an
  // instant paint, then reconcile with Supabase.
  const [focusPillars, setFocusPillars] = useState<FocusPillar[]>(() => {
    try {
      return normalizePillars(JSON.parse(localStorage.getItem('vision_focus_pillars') || '[]'));
    } catch {
      return normalizePillars([]);
    }
  });
  const pillarsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    db.visionSettings
      .get()
      .then((s) => {
        if (s?.focus_pillars != null) setFocusPillars(normalizePillars(s.focus_pillars));
      })
      .catch(() => {});
  }, []);

  // Update immediately for a snappy UI + localStorage, and debounce the DB write.
  const updateFocusPillars = (next: FocusPillar[]) => {
    setFocusPillars(next);
    localStorage.setItem('vision_focus_pillars', JSON.stringify(next));
    if (pillarsSaveTimer.current) clearTimeout(pillarsSaveTimer.current);
    pillarsSaveTimer.current = setTimeout(() => {
      db.visionSettings
        .upsert({ focus_pillars: next })
        .catch(() => {});
    }, 600);
  };

  useEffect(() => {
    calculateStreak();
  }, [currentMonth]);

  const calculateStreak = async () => {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setDate(yearAgo.getDate() - 365);

    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const summaries = await db.summaries.getByDateRange(toDateStr(yearAgo), toDateStr(today));
    const goodDays = new Set(
      summaries.filter(s => s.total_hours >= 8).map(s => s.date)
    );

    let streak = 0;
    const checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
      if (goodDays.has(toDateStr(checkDate))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    setStreakDays(streak);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const canGoNext = () => {
    const today = new Date();
    return (
      currentMonth.getFullYear() < today.getFullYear() ||
      (currentMonth.getFullYear() === today.getFullYear() &&
        currentMonth.getMonth() < today.getMonth())
    );
  };

  const getMonthDisplay = () => {
    return currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen paper-texture">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentMonth={getMonthDisplay()}
        onMonthChange={handleMonthChange}
        streakDays={streakDays}
        canGoNext={canGoNext()}
        focusPillars={focusPillars}
        onFocusPillarsChange={updateFocusPillars}
      />

      {activeTab === 'vision' ? (
        <VisionTab />
      ) : (
        <main className="relative pt-[calc(100px+env(safe-area-inset-top))] md:pt-[calc(90px+env(safe-area-inset-top))] pb-12 px-3 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
          {activeTab === 'track' && <TrackTab currentMonth={currentMonth} />}
          {activeTab === 'statistics' && <StatisticsTab currentMonth={currentMonth} />}
        </main>
      )}
    </div>
  );
}

export default App;
