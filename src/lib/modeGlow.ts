import { MODE_MAP, hexToRgbTriple } from './modes';

// Drives the app-wide "mode glow" by writing to <html>: sets --glow-rgb (the
// color every card's halo/border re-reads) and toggles the `mode-active` class
// (which ramps the halo up + fades in the ambient wash). Because it lives on the
// document element — not in the React tree — the glow persists across tab
// switches and while the Track controls are unmounted, until the timer stops.
export function applyModeGlow(modeKey: string | null) {
  const root = document.documentElement;
  const mode = modeKey ? MODE_MAP[modeKey] : null;
  if (mode) {
    root.style.setProperty('--glow-rgb', hexToRgbTriple(mode.color));
    root.classList.add('mode-active');
  } else {
    root.style.removeProperty('--glow-rgb');
    root.classList.remove('mode-active');
  }
}
