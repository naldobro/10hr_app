import { useEffect, useState } from 'react';
import { db } from '../lib/database';
import { WorkSession, DailySummary } from '../types';
import { TrendingUp, Calendar, Target, Award, BarChart3, Clock } from 'lucide-react';

interface StatisticsTabProps {
  currentMonth: Date;
}

interface Stats {
  totalHours: number;
  totalSessions: number;
  avgHoursPerDay: number;
  daysWorked: number;
  bestDay: { date: string; hours: number } | null;
  currentStreak: number;
  longestStreak: number;
  weeklyAverage: number;
  completionRate: number;
  mostProductiveHour: number;
}

export default function StatisticsTab({ currentMonth }: StatisticsTabProps) {
  const [stats, setStats] = useState<Stats>({
    totalHours: 0,
    totalSessions: 0,
    avgHoursPerDay: 0,
    daysWorked: 0,
    bestDay: null,
    currentStreak: 0,
    longestStreak: 0,
    weeklyAverage: 0,
    completionRate: 0,
    mostProductiveHour: 9,
  });

  const [recentSessions, setRecentSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [currentMonth]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;

      const summaries = await db.summaries.getByDateRange(startDate, endDate);
      const allSessions = await db.sessions.getAll();

      const totalHours = summaries.reduce((sum, s) => sum + s.total_hours, 0);
      const daysWorked = summaries.filter((s) => s.total_hours > 0).length;
      const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;

      const bestDay = summaries.reduce(
        (best, s) => {
          if (!best || s.total_hours > best.hours) {
            return { date: s.date, hours: s.total_hours };
          }
          return best;
        },
        null as { date: string; hours: number } | null
      );

      const currentStreak = calculateCurrentStreak(summaries);
      const longestStreak = calculateLongestStreak(summaries);

      const now = new Date();
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setDate(now.getDate() - 28);
      const recentSummaries = summaries.filter(
        (s) => new Date(s.date) >= fourWeeksAgo
      );
      const weeklyAverage =
        recentSummaries.length > 0
          ? recentSummaries.reduce((sum, s) => sum + s.total_hours, 0) / 4
          : 0;

      const daysWithTarget = summaries.filter((s) => s.total_hours >= 8).length;
      const completionRate = daysWorked > 0 ? (daysWithTarget / daysInMonth) * 100 : 0;

      const hourDistribution = calculateHourDistribution(allSessions);
      const mostProductiveHour = hourDistribution.reduce(
        (max, hour, index) => (hour > hourDistribution[max] ? index : max),
        9
      );

      const monthSessions = allSessions.filter((s) => {
        const sessionDate = new Date(s.date);
        return (
          sessionDate >= new Date(startDate) && sessionDate <= new Date(endDate)
        );
      });

      setStats({
        totalHours,
        totalSessions: monthSessions.length,
        avgHoursPerDay,
        daysWorked,
        bestDay,
        currentStreak,
        longestStreak,
        weeklyAverage,
        completionRate,
        mostProductiveHour,
      });

      setRecentSessions(allSessions.slice(0, 10));
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentStreak = (summaries: DailySummary[]): number => {
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const summary = summaries.find((s) => s.date === dateStr);

      if (summary && summary.total_hours >= 8) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateLongestStreak = (summaries: DailySummary[]): number => {
    let longestStreak = 0;
    let currentStreak = 0;

    const sortedSummaries = [...summaries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (const summary of sortedSummaries) {
      if (summary.total_hours >= 8) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  };

  const calculateHourDistribution = (sessions: WorkSession[]): number[] => {
    const distribution = new Array(24).fill(0);

    sessions.forEach((session) => {
      const startHour = Math.floor(session.start_time);
      const endHour = Math.ceil(session.end_time);

      for (let hour = startHour; hour < endHour && hour < 24; hour++) {
        distribution[hour] += 1;
      }
    });

    return distribution;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl ink-text-muted">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold ink-text mb-8">
        Statistics – {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="paper-card rounded-xl p-6 paper-shadow paper-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold ink-text-muted">Total Hours</div>
          </div>
          <div className="text-3xl font-bold ink-text">
            {stats.totalHours.toFixed(1)}h
          </div>
        </div>

        <div className="paper-card rounded-xl p-6 paper-shadow paper-border">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold ink-text-muted">Total Sessions</div>
          </div>
          <div className="text-3xl font-bold ink-text">{stats.totalSessions}</div>
        </div>

        <div className="paper-card rounded-xl p-6 paper-shadow paper-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold ink-text-muted">Avg Per Day</div>
          </div>
          <div className="text-3xl font-bold ink-text">
            {stats.avgHoursPerDay.toFixed(1)}h
          </div>
        </div>

        <div className="paper-card rounded-xl p-6 paper-shadow paper-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold ink-text-muted">Days Worked</div>
          </div>
          <div className="text-3xl font-bold ink-text">{stats.daysWorked}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="paper-card rounded-2xl p-6 paper-shadow paper-border">
          <h3 className="text-xl font-bold ink-text mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-700" />
            Achievements
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-amber-50/30 rounded-xl paper-border">
              <div>
                <div className="text-sm ink-text-muted">Current Streak</div>
                <div className="text-2xl font-bold ink-text">{stats.currentStreak} days</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-amber-50/30 rounded-xl paper-border">
              <div>
                <div className="text-sm ink-text-muted">Longest Streak</div>
                <div className="text-2xl font-bold ink-text">{stats.longestStreak} days</div>
              </div>
            </div>

            {stats.bestDay && (
              <div className="flex justify-between items-center p-4 bg-amber-50/30 rounded-xl paper-border">
                <div>
                  <div className="text-sm ink-text-muted">Best Day</div>
                  <div className="text-2xl font-bold ink-text">
                    {stats.bestDay.hours.toFixed(1)}h
                  </div>
                  <div className="text-sm ink-text-muted">{formatDate(stats.bestDay.date)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="paper-card rounded-2xl p-6 paper-shadow paper-border">
          <h3 className="text-xl font-bold ink-text mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-700" />
            Performance
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50/30 rounded-xl paper-border">
              <div className="text-sm ink-text-muted mb-2">Target Completion Rate</div>
              <div className="text-2xl font-bold ink-text mb-2">
                {stats.completionRate.toFixed(1)}%
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="p-4 bg-amber-50/30 rounded-xl paper-border">
              <div className="text-sm ink-text-muted">4-Week Average</div>
              <div className="text-2xl font-bold ink-text">
                {stats.weeklyAverage.toFixed(1)}h/week
              </div>
            </div>

            <div className="p-4 bg-amber-50/30 rounded-xl paper-border">
              <div className="text-sm ink-text-muted">Most Productive Hour</div>
              <div className="text-2xl font-bold ink-text">
                {stats.mostProductiveHour}:00
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="paper-card rounded-2xl p-6 paper-shadow paper-border">
        <h3 className="text-xl font-bold ink-text mb-4">Recent Activity</h3>

        <div className="space-y-2">
          {recentSessions.length === 0 ? (
            <div className="text-center py-8 ink-text-muted">No sessions recorded yet</div>
          ) : (
            recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-amber-50/30 rounded-xl hover:bg-amber-50/50 transition-colors paper-border"
              >
                <div className="flex items-center gap-4">
                  <div className="text-sm ink-text-muted min-w-[100px]">
                    {formatDate(session.date)}
                  </div>
                  <div className="font-medium ink-text">{session.label}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm ink-text-muted">
                    {session.start_time.toFixed(1)}h - {session.end_time.toFixed(1)}h
                  </div>
                  <div className="font-bold text-amber-700">
                    {(session.end_time - session.start_time).toFixed(1)}h
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
