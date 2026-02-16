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

    <span className="block mb-2">
      <span className="text-slate-500">Remember</span> your goal, you are not a failure, you are just not working.
    </span>

    <span className="block mb-6">
      <span className="text-indigo-600">If</span> you work, you can do wonders.
    </span>

    <span className="block mb-2">
      <span className="text-blue-600">If</span> your calendar looks bad, then how can you succeed?
    </span>

    <span className="block">
      <span className="text-emerald-600">It</span> starts from doing now.
    </span>

    <span className="block">
      <span className="text-amber-600">Every</span> day matters, every hour matters, every minute matters.
    </span>

    <span className="block mt-6">
      <span className="text-red-600">Now</span>, if you choose not to work, that's the whole story of why you are failing every day.
    </span>
  </p>
</div>
<div className="mb-16 max-w-2xl mx-auto">

  <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">
    RULES
  </h2>

  <div className="border border-black/20 rounded-lg overflow-hidden text-xl font-bold">

    <div className="grid grid-cols-2 border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-indigo-600">1</div>
      <div className="p-4">Show up even when you don’t feel like it.</div>
    </div>

    <div className="grid grid-cols-2 border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-blue-600">2</div>
      <div className="p-4">Do the work before you judge the results.</div>
    </div>

    <div className="grid grid-cols-2 border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-emerald-600">3</div>
      <div className="p-4">Protect your calendar like your future depends on it.</div>
    </div>

    <div className="grid grid-cols-2 border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-amber-600">4</div>
      <div className="p-4">Finish what you start, no excuses.</div>
    </div>

    <div className="grid grid-cols-2">
      <div className="p-4 border-r border-black/20 text-red-600">5</div>
      <div className="p-4">Repeat daily until discipline becomes identity.</div>
    </div>

  </div>

</div>
  {activeTab === 'track' && <TrackTab currentMonth={currentMonth} />}
  {activeTab === 'focus' && <FocusTab currentMonth={currentMonth} />}
  {activeTab === 'statistics' && <StatisticsTab currentMonth={currentMonth} />}
</main>
    </div>
  );
}

export default App;
