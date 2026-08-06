import { useEffect, useState } from 'react';
import { X, Trash2, Plus, Heart } from 'lucide-react';
import { VisionTopic } from '../types';
import { GOAL_COLORS } from '../lib/visionUtils';

interface ReflectionsPanelProps {
  topics: VisionTopic[];
  onAddTopic: () => void;
  onUpdateTopic: (id: string, patch: Partial<VisionTopic>, persist: boolean) => void;
  onDeleteTopic: (id: string) => void;
  onClose: () => void;
}

const nextColor = (c: string) => {
  const i = GOAL_COLORS.indexOf(c);
  return GOAL_COLORS[(i + 1) % GOAL_COLORS.length];
};
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'e' + Date.now() + Math.random();

export default function ReflectionsPanel({ topics, onAddTopic, onUpdateTopic, onDeleteTopic, onClose }: ReflectionsPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative paper-card rounded-2xl border border-black/10 shadow-2xl w-[min(1100px,96vw)] h-[min(680px,88vh)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-black/5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold ink-text flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" /> Reflections
            </h3>
            <p className="text-xs ink-text-muted mt-1">
              Life areas and how you want to hold them. Add emotion bubbles to each — click a bubble to shift its tone.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddTopic}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" /> Add topic
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Horizontal topics */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full flex gap-4 p-5">
            {topics.length === 0 && (
              <div className="w-full h-full grid place-items-center text-sm ink-text-muted">
                No topics yet — add one (Parents, Career, Health…) to start.
              </div>
            )}
            {topics.map((t) => (
              <TopicColumn
                key={t.id}
                topic={t}
                onUpdate={(patch, persist) => onUpdateTopic(t.id, patch, persist)}
                onDelete={() => onDeleteTopic(t.id)}
              />
            ))}
            <button
              onClick={onAddTopic}
              className="flex-none w-[150px] h-full rounded-2xl border border-dashed border-black/15 ink-text-muted hover:ink-text hover:border-stone-400 hover:bg-stone-50/50 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition"
            >
              <Plus className="w-5 h-5" /> Add topic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicColumn({
  topic,
  onUpdate,
  onDelete,
}: {
  topic: VisionTopic;
  onUpdate: (patch: Partial<VisionTopic>, persist: boolean) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState(topic.color);
  const [confirmDel, setConfirmDel] = useState(false);
  const emotions = topic.emotions || [];

  const addEmotion = () => {
    const text = draft.trim();
    if (!text) return;
    onUpdate({ emotions: [...emotions, { id: newId(), text, color: draftColor }] }, true);
    setDraft('');
  };

  return (
    <div className="flex-none w-[264px] h-full flex flex-col rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
      {/* column header */}
      <div className="px-3 py-3 border-b border-black/5 flex items-center gap-2" style={{ background: `${topic.color}12` }}>
        <button
          onClick={() => onUpdate({ color: nextColor(topic.color) }, true)}
          className="w-4 h-4 rounded-full flex-none"
          style={{ background: topic.color, boxShadow: `0 0 6px ${topic.color}88` }}
          title="Change colour"
        />
        <input
          value={topic.title}
          onChange={(e) => onUpdate({ title: e.target.value }, false)}
          onBlur={() => onUpdate({}, true)}
          className="flex-1 bg-transparent outline-none font-bold text-[15px] ink-text min-w-0"
          placeholder="Topic…"
        />
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="text-[11px] font-bold text-red-600 px-1.5 py-1 rounded hover:bg-red-50">
              Delete
            </button>
            <button onClick={() => setConfirmDel(false)} className="text-[11px] ink-text-muted px-1 py-1 rounded hover:bg-stone-100">
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="p-1 rounded ink-text-muted hover:text-red-600 hover:bg-red-50 transition flex-none"
            title="Delete topic"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* emotion bubbles */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-2 content-start">
          {emotions.length === 0 && <p className="text-xs ink-text-muted/70">Add how you want to feel about this.</p>}
          {emotions.map((em) => (
            <span
              key={em.id}
              onClick={() =>
                onUpdate(
                  { emotions: emotions.map((x) => (x.id === em.id ? { ...x, color: nextColor(x.color) } : x)) },
                  true
                )
              }
              className="group inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 text-[13px] font-medium cursor-pointer select-none transition"
              style={{ background: `${em.color}1a`, color: em.color, border: `1px solid ${em.color}40` }}
              title="Click to shift tone"
            >
              {em.text}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ emotions: emotions.filter((x) => x.id !== em.id) }, true);
                }}
                className="w-4 h-4 rounded-full grid place-items-center hover:bg-black/10 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* add emotion */}
      <div className="p-3 border-t border-black/5 flex flex-col gap-2">
        <div className="flex gap-1.5">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setDraftColor(c)}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110"
              style={{ background: c, boxShadow: c === draftColor ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addEmotion();
            }}
            placeholder="Add a feeling…"
            className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg bg-stone-50 border border-black/[0.07] outline-none focus:border-stone-400 ink-text"
          />
          <button
            onClick={addEmotion}
            className="w-9 flex-none rounded-lg bg-stone-800 hover:bg-stone-900 text-white grid place-items-center transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
