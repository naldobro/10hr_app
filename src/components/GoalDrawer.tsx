import { useEffect, useState } from 'react';
import { X, Trash2, Check, CalendarClock, Link2, Maximize2, Minimize2 } from 'lucide-react';
import { VisionGoal } from '../types';
import { GOAL_COLORS, MILESTONE_NEUTRAL, fmtDate, relText, iso, addDays, todayMidnight } from '../lib/visionUtils';

interface GoalDrawerProps {
  goal: VisionGoal;
  attachOptions: { id: string; title: string; color: string }[];
  onChange: (patch: Partial<VisionGoal>, persist: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
  onComplete: (color: string) => void;
}

export default function GoalDrawer({ goal, attachOptions, onChange, onDelete, onClose, onComplete }: GoalDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [noteExpanded, setNoteExpanded] = useState(false);
  const isMilestone = goal.kind === 'milestone';
  const linked = attachOptions.find((o) => o.id === goal.goal_id);
  const accent = isMilestone ? (linked ? linked.color : MILESTONE_NEUTRAL) : goal.color;

  const markDone = () => {
    const next = !goal.done;
    onChange({ done: next }, true);
    if (next) onComplete(accent);
  };

  return (
    <div className="fixed top-[100px] md:top-[90px] right-0 bottom-0 z-[70] w-[min(420px,92vw)] paper-card border-l border-black/10 flex flex-col animate-[drawerIn_0.32s_cubic-bezier(0.16,1,0.3,1)]">
      <style>{`@keyframes drawerIn { from { transform: translateX(102%); } to { transform: translateX(0); } }`}</style>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-black/5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between min-h-[24px]">
          {isMilestone ? (
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-md"
              style={{ color: accent, background: `${accent}18` }}
            >
              Milestone
            </span>
          ) : (
            <div className="flex gap-1.5">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ color: c }, true)}
                  className="w-[18px] h-[18px] rounded-full transition-transform hover:scale-110"
                  style={{ background: c, boxShadow: c === goal.color ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined }}
                  title="Colour"
                />
              ))}
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 hover:ink-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          value={goal.title}
          onChange={(e) => onChange({ title: e.target.value }, false)}
          onBlur={() => onChange({}, true)}
          placeholder={isMilestone ? 'Name this milestone…' : 'Name this goal…'}
          className="w-full text-2xl font-bold ink-text bg-transparent outline-none leading-tight"
        />

        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-none" style={{ background: accent, boxShadow: `0 0 8px ${accent}88` }} />
          <div>
            <div className="text-[15px] font-bold ink-text tabular-nums" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {goal.deadline ? fmtDate(goal.deadline) : 'Not scheduled'}
            </div>
            <div className="text-xs ink-text-muted mt-0.5">
              {goal.deadline ? relText(goal.deadline) : 'Drag it onto the timeline to set a date'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 overflow-y-auto flex flex-col gap-5 flex-1">
        {!isMilestone && (
          <Field label="Target">
            <input
              value={goal.target}
              onChange={(e) => onChange({ target: e.target.value }, false)}
              onBlur={() => onChange({}, true)}
              placeholder="e.g. $10,000 / month"
              className="drawer-input"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </Field>
        )}

        <Field label={isMilestone ? 'Date' : 'Deadline'}>
          <input
            type="date"
            value={goal.deadline || ''}
            onChange={(e) => onChange({ deadline: e.target.value || null }, true)}
            className="drawer-input"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          />
        </Field>

        {isMilestone && (
          <Field label="Attach to goal">
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ink-text-muted pointer-events-none" />
              <select
                value={goal.goal_id || ''}
                onChange={(e) => onChange({ goal_id: e.target.value || null }, true)}
                className="drawer-input appearance-none cursor-pointer"
                style={{ paddingLeft: 38 }}
              >
                <option value="">Standalone (no goal)</option>
                {attachOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] ink-text-muted mt-1.5">
              {linked ? `Takes on “${linked.title}”'s colour on the timeline.` : 'Standalone milestones show in a neutral tone.'}
            </p>
          </Field>
        )}

        {!isMilestone && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] tracking-wider uppercase ink-text-muted font-bold">Why this matters</label>
              <button
                onClick={() => setNoteExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold ink-text-muted hover:ink-text transition"
              >
                {noteExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {noteExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            <textarea
              value={goal.note}
              onChange={(e) => onChange({ note: e.target.value }, false)}
              onBlur={() => onChange({}, true)}
              placeholder="The reason you'll push through…"
              className="drawer-input resize-none transition-[height] duration-200"
              style={{ height: noteExpanded ? '52vh' : 128 }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3.5 border-t border-black/5 flex gap-2.5">
        <button
          onClick={onDelete}
          className="px-3 py-2.5 rounded-xl border border-black/10 ink-text-muted hover:text-red-600 hover:bg-red-50 transition flex-none"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {goal.deadline ? (
          <button
            onClick={() => onChange({ deadline: null }, true)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-black/10 ink-text font-semibold text-sm hover:bg-stone-50 transition flex items-center justify-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4" /> Unschedule
          </button>
        ) : (
          <button
            onClick={() => onChange({ deadline: iso(addDays(todayMidnight(), 30)) }, true)}
            className="flex-1 px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-sm transition flex items-center justify-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4" /> Add to timeline
          </button>
        )}
        <button
          onClick={markDone}
          className={`flex-1 px-3 py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-1.5 ${
            goal.done
              ? 'border border-black/10 ink-text hover:bg-stone-50'
              : 'bg-stone-800 hover:bg-stone-900 text-white'
          }`}
        >
          {goal.done ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} style={{ color: accent }} /> Completed
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
        .drawer-input:focus { border-color: #57534e; box-shadow: 0 0 0 3px rgba(87,83,78,0.14); }
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
