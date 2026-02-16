import { useEffect, useState } from 'react';
import { db } from '../lib/database';
import { Goal } from '../types';
import { Plus, X } from 'lucide-react';

interface FocusTabProps {
  currentMonth: Date;
}

export default function FocusTab({ currentMonth }: FocusTabProps) {
  const [majorGoals, setMajorGoals] = useState<Goal[]>([]);
  const [minorGoals, setMinorGoals] = useState<Goal[]>([]);
  const [showMajorModal, setShowMajorModal] = useState(false);
  const [showMinorModal, setShowMinorModal] = useState(false);

  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalProgress, setNewGoalProgress] = useState({ current: 0, total: 0 });
  const [newMinorDate, setNewMinorDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    loadGoals();
  }, [currentMonth]);

  const loadGoals = async () => {
    const major = await db.goals.getByMonth(monthKey, 'major');
    const minor = await db.goals.getByMonth(monthKey, 'minor');
    const sortedMinor = minor.sort((a, b) => b.date.localeCompare(a.date));

    setMajorGoals(major);
    setMinorGoals(sortedMinor);
  };

  const handleAddMajorGoal = async () => {
    if (!newGoalDesc.trim()) return;

    await db.goals.add({
      type: 'major',
      description: newGoalDesc,
      completed: false,
      progress_current: newGoalProgress.current,
      progress_total: newGoalProgress.total,
      date: new Date().toISOString().split('T')[0],
      month: monthKey,
    });

    setNewGoalDesc('');
    setNewGoalProgress({ current: 0, total: 0 });
    setShowMajorModal(false);
    await loadGoals();
  };

  const handleAddMinorGoal = async () => {
    if (!newGoalDesc.trim()) return;

    await db.goals.add({
      type: 'minor',
      description: newGoalDesc,
      completed: false,
      progress_current: 0,
      progress_total: 0,
      date: newMinorDate,
      month: monthKey,
    });

    setNewGoalDesc('');
    setNewMinorDate(new Date().toISOString().split('T')[0]);
    setShowMinorModal(false);
    await loadGoals();
  };

  const toggleGoalComplete = async (goal: Goal) => {
    await db.goals.update(goal.id, { completed: !goal.completed });
    await loadGoals();
  };

  const updateMajorGoalProgress = async (goal: Goal, current: number) => {
    await db.goals.update(goal.id, { progress_current: current });
    await loadGoals();
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    await loadGoals();
  };

  const handleResetMonth = async () => {
    if (
      !confirm(
        'Are you sure you want to reset all goals for this month? This cannot be undone.'
      )
    ) {
      return;
    }

    await db.goals.deleteByMonth(monthKey);
    await loadGoals();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold ink-text">
          Focus Goals – {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={handleResetMonth}
          className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-medium transition-colors paper-border"
        >
          Reset Month
        </button>
      </div>




<div className="mb-16 max-w-4xl mx-auto">

  <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">
    Non Negotiables
  </h2>

  <ul className="text-xl font-bold leading-relaxed space-y-3 text-purple-600 list-disc list-inside">

    <li>5 prayers (look at naushad, nadeem adn other people, they are religious and hard workers, your first and only client also was when you were religious, patient and not that hard working) </li>
    <li>Avoid Yt, PS, P. Everytime you fall for that and destroy your efforts</li>
    <li>Daily outreach, else not gonna cut</li>
    <li>focus on clearing engineering</li>
    <li>Pray to ALLAH daily</li>

  </ul>





</div>
      <div className="grid grid-cols-2 gap-8">
        <div className="paper-card rounded-2xl paper-shadow p-8 paper-border">
          <h3 className="text-xl font-bold ink-text mb-6">Major Goals</h3>

          <div className="space-y-4">
            {majorGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-start gap-3 p-4 bg-amber-50/30 rounded-xl hover:bg-amber-50/50 transition-colors group paper-border"
              >
                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => toggleGoalComplete(goal)}
                  className="mt-1 w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-600"
                />

                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      goal.completed
                        ? 'line-through ink-text-muted'
                        : 'ink-text'
                    }`}
                  >
                    {goal.description}
                  </p>

                  {goal.progress_total > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        value={goal.progress_current}
                        onChange={(e) =>
                          updateMajorGoalProgress(
                            goal,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-16 px-2 py-1 paper-border rounded text-sm"
                        min="0"
                        max={goal.progress_total}
                      />
                      <span className="text-sm ink-text-muted">
                        / {goal.progress_total}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-600 hover:text-rose-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setShowMajorModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-stone-300 rounded-xl ink-text-muted hover:border-amber-600 hover:text-amber-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add major goal
            </button>
          </div>
        </div>

        <div className="paper-card rounded-2xl paper-shadow p-8 paper-border">
          <h3 className="text-xl font-bold ink-text mb-6">Minor Goals Log</h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {minorGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-start gap-3 p-4 bg-amber-50/30 rounded-xl hover:bg-amber-50/50 transition-colors group paper-border"
              >
                <span className="text-sm font-medium ink-text-muted mt-1 min-w-[60px]">
                  {formatDate(goal.date)}
                </span>

                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => toggleGoalComplete(goal)}
                  className="mt-1 w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-600"
                />

                <p
                  className={`flex-1 ${
                    goal.completed
                      ? 'line-through ink-text-muted'
                      : 'ink-text'
                  }`}
                >
                  {goal.description}
                </p>

                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-600 hover:text-rose-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setShowMinorModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-stone-300 rounded-xl ink-text-muted hover:border-amber-600 hover:text-amber-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Log minor goal
            </button>
          </div>
        </div>
      </div>

      {showMajorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="paper-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl paper-border">
            <h3 className="text-2xl font-bold mb-6 ink-text">
              Add Major Goal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Goal Description
                </label>
                <input
                  type="text"
                  value={newGoalDesc}
                  onChange={(e) => setNewGoalDesc(e.target.value)}
                  placeholder="e.g., Land 3 clients"
                  className="w-full px-4 py-2 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Progress Tracking (Optional)
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="number"
                    value={newGoalProgress.current}
                    onChange={(e) =>
                      setNewGoalProgress({
                        ...newGoalProgress,
                        current: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-24 px-4 py-2 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    min="0"
                  />
                  <span className="ink-text-muted">/</span>
                  <input
                    type="number"
                    value={newGoalProgress.total}
                    onChange={(e) =>
                      setNewGoalProgress({
                        ...newGoalProgress,
                        total: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-24 px-4 py-2 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMajorModal(false);
                  setNewGoalDesc('');
                  setNewGoalProgress({ current: 0, total: 0 });
                }}
                className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg font-medium ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMajorGoal}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium text-white transition-colors paper-shadow"
              >
                Add Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {showMinorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="paper-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl paper-border">
            <h3 className="text-2xl font-bold mb-6 ink-text">
              Log Minor Goal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Task Description
                </label>
                <input
                  type="text"
                  value={newGoalDesc}
                  onChange={(e) => setNewGoalDesc(e.target.value)}
                  placeholder="e.g., Sent 20 outreach emails"
                  className="w-full px-4 py-2 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={newMinorDate}
                  onChange={(e) => setNewMinorDate(e.target.value)}
                  className="w-full px-4 py-2 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMinorModal(false);
                  setNewGoalDesc('');
                }}
                className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg font-medium ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMinorGoal}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium text-white transition-colors paper-shadow"
              >
                Log Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
