import { useEffect, useRef, useState } from 'react';

interface ColorPickerProps {
  value: string;
  /** Fired continuously while dragging — use for a live preview (don't persist). */
  onChange: (hex: string) => void;
  /** Fired when a choice is settled (pointer up / valid hex entered) — persist here. */
  onCommit: (hex: string) => void;
}

// ---- colour maths -------------------------------------------------------
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
const isHex = (s: string) => /^#?[0-9a-f]{6}$/i.test(s.trim());
const norm = (s: string) => (s.startsWith('#') ? s.toLowerCase() : '#' + s.toLowerCase());

// -------------------------------------------------------------------------
export default function ColorPicker({ value, onChange, onCommit }: ColorPickerProps) {
  const [hsv, setHsv] = useState(() => {
    const { r, g, b } = hexToRgb(value);
    return rgbToHsv(r, g, b);
  });
  const [hexText, setHexText] = useState(value);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  // Ignore the value prop echo of our own last emit so dragging stays smooth.
  const lastEmit = useRef(norm(value));

  useEffect(() => {
    if (!isHex(value) || norm(value) === lastEmit.current) return;
    const { r, g, b } = hexToRgb(value);
    setHsv(rgbToHsv(r, g, b));
    setHexText(value);
  }, [value]);

  const hexOf = (h: typeof hsv) => {
    const { r, g, b } = hsvToRgb(h.h, h.s, h.v);
    return rgbToHex(r, g, b);
  };

  const apply = (next: typeof hsv, commit: boolean) => {
    setHsv(next);
    const hex = hexOf(next);
    lastEmit.current = hex;
    setHexText(hex);
    onChange(hex);
    if (commit) onCommit(hex);
  };

  // Drag helper for the SV box and the hue slider.
  const drag = (
    el: HTMLElement,
    e: React.PointerEvent,
    toHsv: (px: number, py: number, rect: DOMRect) => typeof hsv
  ) => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const move = (cx: number, cy: number) => apply(toHsv(cx - rect.left, cy - rect.top, rect), false);
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit(hexOf(hsvRef.current));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;
  const current = hexOf(hsv);

  return (
    <div className="select-none" style={{ touchAction: 'none' }}>
      {/* saturation / value box */}
      <div
        onPointerDown={(e) =>
          drag(e.currentTarget, e, (px, py, rect) => ({
            h: hsv.h,
            s: clamp(px / rect.width, 0, 1),
            v: clamp(1 - py / rect.height, 0, 1),
          }))
        }
        className="relative w-full h-28 rounded-lg overflow-hidden cursor-crosshair border border-black/10 dark:border-white/[0.2]"
        style={{ background: hueColor }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, rgba(255,255,255,0))' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, rgba(0,0,0,0))' }} />
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: current,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          }}
        />
      </div>

      {/* hue slider */}
      <div
        onPointerDown={(e) =>
          drag(e.currentTarget, e, (px, _py, rect) => ({
            h: clamp((px / rect.width) * 360, 0, 360),
            s: hsv.s,
            v: hsv.v,
          }))
        }
        className="relative w-full h-3.5 rounded-full mt-2.5 cursor-pointer border border-black/10 dark:border-white/[0.2]"
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor, boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
        />
      </div>

      {/* hex field + preview */}
      <div className="flex items-center gap-2 mt-2.5">
        <span
          className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/[0.2] flex-none"
          style={{ background: current }}
        />
        <div className="flex items-center flex-1 rounded-lg border border-black/10 dark:border-white/[0.2] bg-white dark:bg-paper px-2">
          <span className="text-[13px] ink-text-muted">#</span>
          <input
            value={hexText.replace(/^#/, '')}
            onChange={(e) => {
              const t = e.target.value;
              setHexText(t);
              if (isHex(t)) {
                const { r, g, b } = hexToRgb(t);
                const next = rgbToHsv(r, g, b);
                lastEmit.current = norm(t);
                setHsv(next);
                onChange(norm(t));
              }
            }}
            onBlur={() => {
              if (isHex(hexText)) onCommit(norm(hexText));
              else setHexText(current);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isHex(hexText)) onCommit(norm(hexText));
            }}
            spellCheck={false}
            maxLength={6}
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-mono ink-text py-1.5 uppercase"
            placeholder="RRGGBB"
          />
        </div>
      </div>
    </div>
  );
}
