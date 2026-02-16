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
  <div className="mb-10 text-center">
    <p className="text-2xl font-bold text-grey-700 mb-4 leading-relaxed">
      Remember your goal, you are not a failure, you are just not working.<br />
      If you work, you can do wonders.
    </p>
    <p className="text-lg text-gray-700 leading-relaxed">
      If your calendar looks bad, then how can you succeed?<br />
      It starts from doing now.<br />
      Every day matters, every hour matters, every minute matters.<br />
      Now, if you choose not to work, that's the whole story of why you are failing every day.
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
