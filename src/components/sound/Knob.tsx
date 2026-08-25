/**
 * Knob — rotary control in stile console analogica (arco + lancetta).
 * Puramente presentazionale: riceve un valore normalizzato 0..1 e lo rimanda
 * con `onChange` mentre trascini verticalmente. Nessun DSP qui dentro.
 */

import { useCallback, useRef } from "react";

type Props = {
  label: string;
  /** valore normalizzato 0..1 */
  value: number;
  /** testo già formattato mostrato al centro */
  display: string;
  onChange: (next: number) => void;
  size?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const SWEEP = 270; // gradi totali dell'arco
const START = 135; // angolo iniziale (in basso a sinistra)

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function Knob({ label, value, display, onChange, size = 62 }: Props) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const v = clamp01(value);
  const cx = 32;
  const cy = 32;
  const r = 22;
  const end = START + SWEEP * v;
  const pointer = polar(cx, cy, r - 4, end);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      start.current = { y: e.clientY, v };
    },
    [v],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      if (!s) return;
      e.preventDefault();
      onChange(clamp01(s.v + (s.y - e.clientY) / 150));
    },
    [onChange],
  );

  const stop = useCallback(() => {
    start.current = null;
  }, []);

  return (
    <div className="knob" style={{ width: size }}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="touch-none select-none"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-valuetext={display}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(clamp01(v + 0.02));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(clamp01(v - 0.02));
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <path d={arc(cx, cy, r, START, START + SWEEP)} className="knob-track" />
        {v > 0.001 && <path d={arc(cx, cy, r, START, end)} className="knob-fill" />}
        <circle cx={cx} cy={cy} r={r - 6} className="knob-cap" />
        <line x1={cx} y1={cy} x2={pointer.x} y2={pointer.y} className="knob-needle" />
      </svg>
      <span className="knob-value">{display}</span>
      <span className="knob-label">{label}</span>
    </div>
  );
}
