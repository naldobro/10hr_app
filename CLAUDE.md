# CLAUDE.md — 10hr Day (Deep Work Tracker)

Orientation for future Claude sessions. Read this first; it captures the non-obvious stuff so you don't have to re-derive it.

## What this app is

A **single-user, no-auth** personal productivity tracker. One person, all devices, same data. There is no login — every row is written with a hardcoded `user_id = 'single-user'` (see `SINGLE_USER_ID` in `src/lib/database.ts`). Anyone with the URL has full access; that's by design.

Three tabs: **Track** (log deep-work sessions + habits on a calendar), **Statistics** (analytics/streaks), **Vision** (goals, stages, "Stage Book", planner, reflections).

## Stack & commands

- **Vite + React 18 + TypeScript**, **Tailwind** (config in `tailwind.config.js`), **Supabase** (Postgres) as the only backend, deployed on Vercel.
- `npm run dev` — dev server · `npm run build` — production build · `npm run lint` — eslint · `npm run typecheck` — `tsc --noEmit -p tsconfig.app.json`.
- **Always run `typecheck` + `build` before committing.** There are 4 pre-existing `react-hooks/exhaustive-deps` warnings in `TrackTab.tsx` — those are expected, not from your change.
- Env: `.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. See `DEPLOYMENT_GUIDE.md`.

## Data layer

`src/lib/database.ts` exports a single `db` object namespaced by table: `db.sessions`, `db.summaries`, `db.habits`, `db.habitSchedules`, `db.visionGoals`, `db.visionSnapshots`, `db.visionTopics`, `db.visionSettings`, `db.visionDocs`. All async, all thin wrappers over the Supabase client (`src/lib/supabase.ts`). Types live in `src/types/index.ts`.

- **Sessions** (`work_sessions`): `date` (YYYY-MM-DD local), `start_time`/`end_time` as **fractional hours** (e.g. 9.5 = 09:30), `label`, `color`. A day's total is denormalized into `daily_summaries.total_hours` (recomputed on every add/delete).
- **`vision_settings`** is a single-row grab-bag keyed by `user_id`, holding lots of scattered fields (focus notes, focus pillars, planner notebooks, stage bubbles, diary, etc.) via `upsert(patch)`. When you need a new app-wide scalar/blob, it usually belongs here rather than a new table.
- Migrations live in `supabase/migrations/*.sql`, applied manually in the Supabase SQL editor. Adding a column ⇒ add a migration file AND remember the user must run it (surfacing "run the X migration" in an error toast is the established pattern — see `track_focus_note`).

## Cross-cutting systems (know these before editing)

### Theme — `src/lib/theme.ts` + `src/index.css`
- `.dark` class on `<html>` flips a big set of CSS variables. **Light** = warm paper. **Dark** = pure OLED black with bright white "glow" rims (there are no drop shadows on black — separation is done with glowing borders/halos).
- The dark card glow is built from **`--glow-rgb`** (an `"R G B"` triple, default `255 255 255`). `.dark .paper-card` / `.paper-shadow` / `.dyn-sheen` / `.dyn-glow` paint their halo with `rgb(var(--glow-rgb) / a)`, and `--paper-border` uses it too. **Gotcha:** the halo is painted _element-level_ on purpose. An earlier attempt routed it through the inherited `--paper-shadow` variable and it baked white in at `<html>` before inheriting — so overriding `--glow-rgb` lower did nothing. Keep glow color on the element rules.
- Utility classes: `paper-card`, `paper-shadow`, `paper-border`, `ink-text`, `ink-text-muted`, `dyn-sheen`/`dyn-glow` (stronger hero glow), `cal-cell` (opts OUT of the dark halo).

### Track "modes" glow (recent feature)
- `src/lib/modes.ts` = the 5 fixed baskets ("modes"): **Work / Content / Outreach / Learning / Variable Efforts**, each with a hex color. This is the single source of truth. Sessions store `color = <mode key>`; `resolveColor()` maps a key (or a legacy `blue/green/...` key) back to hex for the timeline.
- `src/lib/modeGlow.ts` `applyModeGlow(modeKey|null)` writes `--glow-rgb` + toggles `.mode-active` on `<html>`. Because it lives on the document element (not React state), the mode glow **persists across tab switches** and while `ControlsPanel` is unmounted, until the timer stops.
- Interaction (in `ControlsPanel.tsx`): pick a mode → **Start** runs the timer AND (only while running) the whole app tints to that mode's color; **Finish** logs the session in that basket and reverts to white. Selecting a mode alone does NOT tint. "Add Manually" is kept, pre-tagged to a basket.
- The big soft bloom is a single fixed composited layer `.mode-ambient` (in `App.tsx` / `index.css`) that fades opacity — it carries the wide glow cheaply so per-card box-shadows stay lighter and animation is smooth. `.dark.mode-active` rules crank card halos up.

### Undo/redo — `src/lib/undoManager.ts`
- App-wide, localStorage-backed stack. Every mutating action pushes a typed `UndoAction` (see the big union: `add_session`, `delete_session`, `vision_*`, `topic_*`, `focus_update` with `scope`, `habit_toggle`, `pillar_update`, `stage_bubbles`, `doc_*`…). `Ctrl/Cmd+Z` / `Shift+Z` handled in `TrackTab` and Vision.
- When you add a new kind of mutation, add a matching `UndoAction` variant and its inverse, or it silently won't be undoable. `doc_*` actions are filtered out of the Track/Vision undo view.

### Realtime & offline-feel
- Vision has Supabase **Realtime** enabled (`20260920000000_enable_realtime_vision.sql`) for cross-device live sync; mobile refetches on focus.
- Pattern throughout: **seed from `localStorage` for an instant paint, then reconcile with Supabase** (e.g. focus notes, focus pillars). Keep this pattern for anything that should show before the network lands.

## Component map (`src/components/`)

- **Track**: `TrackTab` (orchestrator) → `MonthOverview` (calendar) + `HabitMonthView` overlay, `HabitScheduleModal`, `TodayFocus`, `DaySummary`, `TimelineGraph` (renders sessions as blocks; colors via `resolveColor`), `ControlsPanel` (modes + timer + manual add), `MotivationalQuote`, `MilestoneQuote`.
- **Vision**: `VisionTab` (orchestrator) → `StageBook`, `TimelineGraph`(vision variant not the track one), `GoalDrawer`, `FocusPillars`, `PlannerPanel`, `ReflectionsPanel`, `DiaryCard`, `ColorPicker`, `MonthOverview` reuse, `BackupModal`.
- **Shared/chrome**: `Navigation` (fixed top bar, publishes its height as `--nav-h`), `StatisticsTab`.
- **Focus pillars** (the 3 chips in the Vision nav) live in `App.tsx` state, mirrored to localStorage + `vision_settings.focus_pillars`, with undo via a `focuspillars:set` window event.

## Conventions & gotchas

- **Dark mode is the priority surface.** Recent visual work targets dark first; confirm dark before light.
- Dates are **local** `YYYY-MM-DD` strings built manually (not `toISOString()`, which would shift by timezone). Copy the existing `` `${y}-${String(m+1).padStart(2,'0')}-...` `` helpers.
- Session times are **fractional hours**, not minutes/timestamps.
- Toasts: `TrackTab` has a `showFeedback('success'|'error', msg)` helper; DB write failures should surface a friendly toast (esp. "run the … migration").
- No test suite. "Verification" = `typecheck` + `build` + eyeballing the running app (the user runs it as a Mac desktop-wrapped web app and shares screenshots).
- Commit only when asked; branch off `main` if needed; end commit messages with the `Co-Authored-By: Claude Opus 4.8` trailer.

## Design rules (from `.bolt/prompt`)

This project was scaffolded with Bolt.new; its standing design instructions live in `.bolt/prompt`:
- Designs should be **beautiful, not cookie-cutter** — fully-featured, production-worthy.
- **Don't add UI/icon/theme packages** unless truly necessary or explicitly requested. Stick to Tailwind + React hooks + **lucide-react** for icons.

## Desktop app (Tauri)

The app is run as a native macOS app (`10Hr.app`) — that's the window in the user's screenshots. `.claude/settings.local.json` carries **Tauri** build permissions (`src-tauri/target/release/bundle/macos/10Hr.app` copied to `/Applications/10Hr.app`, plus `rustc`/`cargo`), so a Tauri wrapper was set up at some point. **But `src-tauri/` does not exist in this working copy** (not on disk, not tracked, not gitignored) — the Tauri config is absent here. If desktop packaging comes up, it needs to be (re)created; don't assume it's present.

## Persistent memory

There's a separate auto-memory index at `~/.claude/.../memory/MEMORY.md` (Vision Stage Book notes, audit findings). Check it for in-flight work context that isn't in the repo.
