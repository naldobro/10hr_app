import { useEffect } from 'react';
import { X, Trash2, Plus, Check, CalendarClock } from 'lucide-react';
import { VisionGoal } from '../types';
import {
  GOAL_COLORS,
  fmtDate,
  relText,
  progress,
  isDone,
  iso,
  addDays,
  todayMidnight,
} from '../lib/visionUtils';

interface GoalDrawerProps {
  goal: VisionGoal;
  onChange: (patch: Partial<VisionGoal>, persist: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
  onComplete: (color: string) => void;
}

export default function GoalDrawer({ goal, onChange, onDelete, onClose, onComplete }: GoalDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pr = progress(goal);
  const done = isDone(goal);
  const doneCount = goal.steps.filter((s) => s.done).length;

  // progress ring geometry
  const R = 26;
  const C = 2 * Math.PI * R;

  const setSteps = (steps: VisionGoal['steps'], persist: boolean) => onChange({ steps }, persist);

  const toggleStep = (i: number) => {
    const steps = goal.steps.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s));
    setSteps(steps, true);
    if (steps.length > 0 && steps.every((s) => s.done)) onComplete(goal.color);
  };

  const markComplete = () => {
    const target = !done;
    const steps = goal.steps.length
      ? goal.steps.map((s) => ({ ...s, done: target }))
      : [{ text: 'Achieved', done: target }];
    setSteps(steps, true);
    if (target) onComplete(goal.color);
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[70] w-[min(420px,92vw)] paper-card border-l border-black/10 flex flex-col animate-[drawerIn_0.32s_cubic-bezier(0.16,1,0.3,1)]">
      <style>{`@keyframes drawerIn { from { transform: translateX(102%); } to { transform: translateX(0); } }`}</style>

      {/* Header */}
      <div className="px-5 pt-4 pb-4 border-b border-black/5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c }, true)}
                className={`w-[18px] h-[18px] rounded-full transition-transform hover:scale-110 ${
                  c === goal.color ? 'ring-2 ring-offset-2 ring-offset-white' : ''
                }`}
                style={{ background: c, boxShadow: c === goal.color ? `0 0 0 1.5px ${c}` : undefined }}
                title="Colour"
              />
            ))}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-amber-50 hover:ink-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          value={goal.title}
          onChange={(e) => onChange({ title: e.target.value }, false)}
          onBlur={() => onChange({}, true)}
          placeholder="Name this goal…"
          className="w-full text-2xl font-bold ink-text bg-transparent outline-none leading-tight"
        />

        <div className="flex items-center gap-3.5">
          <svg width="60" height="60" viewBox="0 0 60 60" className="flex-none">
            <circle cx="30" cy="30" r={R} fill="none" stroke="#f0ede6" strokeWidth="6" />
            <circle
              cx="30"
              cy="30"
              r={R}
              fill="none"
              stroke={goal.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pr)}
              transform="rotate(-90 30 30)"
              style={{ filter: `drop-shadow(0 0 4px ${goal.color})`, transition: 'stroke-dashoffset 0.4s ease' }}
            />
            <text x="30" y="35" textAnchor="middle" fontSize="14" fontWeight="700" fill="#37352f" fontFamily="ui-monospace, monospace">
              {Math.round(pr * 100)}
            </text>
          </svg>
          <div>
            <div className="text-[15px] font-bold ink-text tabular-nums" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {goal.deadline ? fmtDate(goal.deadline) : 'Not scheduled'}
            </div>
            <div className="text-xs ink-text-muted mt-0.5">
              {goal.deadline ? relText(goal.deadline) : 'Drag it onto the timeline to set a deadline'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 overflow-y-auto flex flex-col gap-5 flex-1">
        <Field label="Target">
          <input
            value={goal.target}
            onChange={(e) => onChange({ target: e.target.value }, false)}
            onBlur={() => onChange({}, true)}
            placeholder="e.g. $10,000 / month"
            className="drawer-input font-mono"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          />
        </Field>

        <Field label="Deadline">
          <input
            type="date"
            value={goal.deadline || ''}
            onChange={(e) => onChange({ deadline: e.target.value || null }, true)}
            className="drawer-input"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          />
        </Field>

        <Field label="Why this matters">
          <textarea
            value={goal.note}
            onChange={(e) => onChange({ note: e.target.value }, false)}
            onBlur={() => onChange({}, true)}
            rows={3}
            placeholder="The reason you'll push through…"
            className="drawer-input resize-y"
          />
        </Field>

        <Field label={`Milestones · ${doneCount}/${goal.steps.length}`}>
          <div className="flex flex-col gap-2">
            {goal.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 group">
                <button
                  onClick={() => toggleStep(i)}
                  className="w-5 h-5 flex-none rounded-md border-2 grid place-items-center transition-all"
                  style={
                    s.done
                      ? { background: goal.color, borderColor: goal.color, boxShadow: `0 0 8px ${goal.color}66` }
                      : { borderColor: 'rgba(0,0,0,0.18)' }
                  }
                >
                  {s.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <input
                  value={s.text}
                  onChange={(e) =>
                    setSteps(
                      goal.steps.map((st, idx) => (idx === i ? { ...st, text: e.target.value } : st)),
                      false
                    )
                  }
                  onBlur={() => onChange({}, true)}
                  className={`flex-1 bg-transparent outline-none py-1 text-[15px] ${
                    s.done ? 'line-through ink-text-muted' : 'ink-text'
                  }`}
                />
                <button
                  onClick={() => setSteps(goal.steps.filter((_, idx) => idx !== i), true)}
                  className="p-1 rounded ink-text-muted opacity-0 group-hover:opacity-100 hover:bg-amber-50 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setSteps([...goal.steps, { text: 'New milestone', done: false }], true)}
              className="mt-1 py-2.5 rounded-lg border border-dashed border-black/15 ink-text-muted hover:ink-text hover:border-violet-400 text-sm font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add milestone
            </button>
          </div>
        </Field>
      </div>

      {/* Actions */}
      <div className="px-5 py-3.5 border-t border-black/5 flex gap-2.5">
        <button
          onClick={onDelete}
          className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition flex-none"
          title="Delete goal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {goal.deadline ? (
          <button
            onClick={() => onChange({ deadline: null }, true)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-black/10 ink-text font-semibold text-sm hover:bg-amber-50 transition flex items-center justify-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4" /> Unschedule
          </button>
        ) : (
          <button
            onClick={() => onChange({ deadline: iso(addDays(todayMidnight(), 45)) }, true)}
            className="flex-1 px-3 py-2.5 rounded-xl text-white font-semibold text-sm transition flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(120deg,#06b6d4,#7c3aed)', boxShadow: '0 6px 16px rgba(124,58,237,0.3)' }}
          >
            <CalendarClock className="w-4 h-4" /> Add to timeline
          </button>
        )}
        <button
          onClick={markComplete}
          className="flex-1 px-3 py-2.5 rounded-xl text-white font-semibold text-sm transition flex items-center justify-center gap-1.5"
          style={{
            background: done ? goal.color : 'linear-gradient(120deg,#06b6d4,#7c3aed)',
            boxShadow: '0 6px 16px rgba(124,58,237,0.3)',
          }}
        >
          {done ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} /> Completed
            </>
          ) : (
            'Mark complete'
          )}
        </button>
      </div>

      <style>{`
        .drawer-input {
          width: 100%;
          font: inherit;
          color: #37352f;
          background: #f5f2ec;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 10px;
          padding: 10px 12px;
          outline: none;
        }
        .drawer-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.16); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] tracking-wider uppercase ink-text-muted font-bold mb-1.5">{label}</label>
      {children}
    </div>
  );
}
