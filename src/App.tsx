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
  {/* Motivational Message Banner */}
<div className="mb-10 text-center max-w-3xl mx-auto">
  <p className="text-xl font-bold leading-relaxed tracking-tight">

    <span className="block mb-10 text-slate-500">
      Obsession is going crazy for your current milestone ⤴︎
    </span>

    <span className="block">
      <span className="text-slate-500">1.   </span> I am slave of ALLAH
    </span>

    <span className="block mb-6">
      <span className="text-indigo-600">2.   </span> My current jihad is to work hard and accomplish what i have thought off
    </span>

    <span className="block mb-2">
      <span className="text-blue-600">3.   </span> Always do the timer thing, its more important that you think. Always add timer when you work, lets you actually know how much you were able to work that day
    </span>

    <span className="block">
      <span className="text-emerald-600">It</span> starts from doing now.
    </span>

    <span className="block">
      <span className="text-amber-600">Every</span> day matters, every hour matters, every minute matters.
    </span>

    <span className="block mt-4">
      <span className="text-red-600">Now</span>, if you choose not to work, that's the whole story of why you are failing every day.
    </span>
  </p>
</div>


<div className="mb-16 max-w-2xl mx-auto">

  <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">
    5 rules to follow
  </h2>

  <div className="border border-black/20 rounded-lg overflow-hidden text-xl font-bold">

    <div className="grid grid-cols-[80px_1fr] border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-indigo-600 text-center">1</div>
      <div className="p-4">Whatever stage of life you are in, follow the 10hr/day rule</div>
    </div>

    <div className="grid grid-cols-[80px_1fr] border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-blue-600 text-center">2</div>
      <div className="p-4">Pray 5 times, its non negotiable, I'm failing because im not praying,</div>
    </div>

    <div className="grid grid-cols-[80px_1fr] border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-emerald-600 text-center">3</div>
      <div className="p-4">2 people, one prays 5 times and other doesn't, obviously the 1st will win</div>
    </div>

    <div className="grid grid-cols-[80px_1fr] border-b border-black/20">
      <div className="p-4 border-r border-black/20 text-amber-600 text-center">4</div>
      <div className="p-4">Make goals and track progress each day</div>
    </div>

    <div className="grid grid-cols-[80px_1fr]">
      <div className="p-4 border-r border-black/20 text-red-600 text-center">5</div>
      <div className="p-4">Repeat daily consistency is everything</div>
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
