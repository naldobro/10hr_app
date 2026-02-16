import { useState, useEffect } from 'react';
import { db } from './lib/database';
import Navigation from './components/Navigation';
import TrackTab from './components/TrackTab';
import FocusTab from './components/FocusTab';
import StatisticsTab from './components/StatisticsTab';

function App() {
  const [activeTab, setActiveTab] = useState<'track' | 'focus' | 'statistics'>('track');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    calculateStreak();
  }, [currentMonth]);

  const calculateStreak = async () => {
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const summary = await db.summaries.getByDate(dateStr);

      if (summary && summary.total_hours >= 8) {
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
      />

      <main className="relative pt-[90px] pb-12 px-8 max-w-[1400px] mx-auto">
  {/* Motivational Message Banner */}
 <div className="mb-10 text-center max-w-2xl mx-auto">
  <p className="text-xl font-bold leading-relaxed tracking-tight">
    <span className="block text-black opacity-100 mb-2">
      your goal, you are not a failure, you are just not working.
    </span>

    <span className="block text-black opacity-90 mb-6">
      If you work, you can do wonders.
    </span>

    <span className="block text-black opacity-80 mb-2">
      If your calendar looks bad, then how can you succeed?
    </span>

    <span className="block text-black opacity-85">
      It starts from doing now.
    </span>

    <span className="block text-black opacity-90">
      Every day matters, every hour matters, every minute matters.
    </span>

    <span className="block text-black opacity-100 mt-6">
      Now, if you choose not to work,
      that's the whole story of why you are failing every day.
    </span>
  </p>
</div>

  {activeTab === 'track' && <TrackTab currentMonth={currentMonth} />}
  {activeTab === 'focus' && <FocusTab currentMonth={currentMonth} />}
  {activeTab === 'statistics' && <StatisticsTab currentMonth={currentMonth} />}
</main>
    </div>
  );
}

export default App;
