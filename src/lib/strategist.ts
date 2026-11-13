// Shared helpers for the Creative Strategist tab state. Used by both App (to
// label the nav tab with the active stage) and CreativeStrategistTab (the UI).
import type { StrategistState, StrategistStage } from '../types';

// The three identity stages, in order. The active one (first not-done) names the
// tab. Targets are the condition to COMPLETE a stage / unlock the next; all are
// user-editable, these are just the seed.
export const DEFAULT_STAGES: StrategistStage[] = [
  { name: 'Creative Strategist', target: '₹1cr in bank', deadline: null, done: false },
  { name: 'Business', target: '', deadline: null, done: false },
  { name: 'Enlightenment', target: '', deadline: null, done: false },
];

export const DEFAULT_STRATEGIST: StrategistState = {
  stages: DEFAULT_STAGES,
  weeks: {},
  goals: { weekly: [], monthly: [] },
  notes: [],
};

// Coerce whatever's stored (possibly `{}` before the migration, or partial) into a
// complete, length-3 StrategistState so the UI never has to null-check.
export function normalizeStrategist(raw: unknown): StrategistState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StrategistState>;
  const rawStages = Array.isArray(r.stages) ? r.stages : [];
  const stages = DEFAULT_STAGES.map((def, i) => {
    const s = rawStages[i] as Partial<StrategistStage> | undefined;
    return {
      name: typeof s?.name === 'string' && s.name.trim() ? s.name : def.name,
      target: typeof s?.target === 'string' ? s.target : def.target,
      deadline: typeof s?.deadline === 'string' ? s.deadline : null,
      done: s?.done === true,
      bullets: Array.isArray(s?.bullets) ? s!.bullets.filter((b): b is string => typeof b === 'string') : [],
    };
  });
  return {
    stages,
    weeks: r.weeks && typeof r.weeks === 'object' ? (r.weeks as Record<string, string>) : {},
    goals: {
      weekly: Array.isArray(r.goals?.weekly) ? r.goals!.weekly : [],
      monthly: Array.isArray(r.goals?.monthly) ? r.goals!.monthly : [],
    },
    notes: Array.isArray(r.notes) ? r.notes : [],
  };
}

/** Index of the active stage: the first one not marked done (last if all done). */
export function activeStageIndex(stages: StrategistStage[]): number {
  const i = stages.findIndex((s) => !s.done);
  return i === -1 ? stages.length - 1 : i;
}

/** The active stage's name — what the nav tab is labelled with. */
export function activeStageName(stages: StrategistStage[]): string {
  return stages[activeStageIndex(stages)]?.name || 'Creative Strategist';
}

export const STRATEGIST_LS_KEY = 'vision_strategist';
