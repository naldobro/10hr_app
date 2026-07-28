import { useState, useEffect } from 'react';
import { db } from './lib/database';
import Navigation from './components/Navigation';
import TrackTab from './components/TrackTab';
import StatisticsTab from './components/StatisticsTab';

function App() {
  const [activeTab, setActiveTab] = useState<'track' | 'statistics'>('track');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [streakDays, setStreakDays] = useState(0);

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
       <img
  src="/profile.png"
  alt="profile"
  className="fixed top-4 right-4 w-10 h-10 rounded-full object-cover z-50"
/>
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentMonth={getMonthDisplay()}
        onMonthChange={handleMonthChange}
        streakDays={streakDays}
        canGoNext={canGoNext()}
      />

      <main className="relative pt-[90px] pb-12 px-8 max-w-[1400px] mx-auto">
  {activeTab === 'track' && <TrackTab currentMonth={currentMonth} />}
  {activeTab === 'statistics' && <StatisticsTab currentMonth={currentMonth} />}
</main>
    </div>
  );
}

export default App;
