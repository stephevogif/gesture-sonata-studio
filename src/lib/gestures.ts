/**
 * Gesture interpretation: dai landmark grezzi a valori musicali stabili.
 */

export type Point = { x: number; y: number; z?: number };

export type FingerState = {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
};

export type HandFrame = {
  handedness: "left" | "right";
  fingers: FingerState;
  count: number;
  x: number;
  y: number;
  /** 0 = in basso, 1 = in alto */
  height: number;
  tilt: number;
  openness: number;
  confidence: number;
  landmarks: Point[];
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function readFingers(lm: Point[]): { fingers: FingerState; count: number } {
  const wrist = lm[0]!;
  const scale = Math.max(0.04, dist(wrist, lm[9]!));
  const up = (tip: number, pip: number) => dist(lm[tip]!, wrist) > dist(lm[pip]!, wrist) * 1.12;

  const thumb = dist(lm[4]!, lm[17]!) > scale * 0.95;
  const fingers: FingerState = {
    thumb,
    index: up(8, 6),
    middle: up(12, 10),
    ring: up(16, 14),
    pinky: up(20, 18),
  };
  const count = Object.values(fingers).filter(Boolean).length;
  return { fingers, count };
}

export function handTilt(lm: Point[]) {
  const a = lm[5]!;
  const b = lm[17]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function handOpenness(lm: Point[]) {
  const wrist = lm[0]!;
  const scale = Math.max(0.04, dist(wrist, lm[9]!));
  const tips = [8, 12, 16, 20].map((i) => dist(lm[i]!, wrist) / scale);
  const avg = tips.reduce((s, v) => s + v, 0) / tips.length;
  return Math.max(0, Math.min(1, (avg - 1.1) / 1.1));
}

/* ————— mapping gesture -> grado della scala (centralizzato e modificabile) ————— */

export type DegreeRule = { id: string; label: string; degree: number; match: (f: FingerState, count: number) => boolean };

export const DEFAULT_DEGREE_RULES: DegreeRule[] = [
  {
    id: "vii",
    label: "pollice + indice + mignolo",
    degree: 6,
    match: (f) => f.thumb && f.index && f.pinky && !f.middle && !f.ring,
  },
  {
    id: "vi",
    label: "indice + mignolo",
    degree: 5,
    match: (f) => f.index && f.pinky && !f.middle && !f.ring && !f.thumb,
  },
  { id: "v", label: "5 dita", degree: 4, match: (_f, c) => c === 5 },
  { id: "iv", label: "4 dita", degree: 3, match: (_f, c) => c === 4 },
  { id: "iii", label: "3 dita", degree: 2, match: (_f, c) => c === 3 },
  { id: "ii", label: "2 dita", degree: 1, match: (_f, c) => c === 2 },
  { id: "i", label: "1 dito", degree: 0, match: (_f, c) => c === 1 },
];

export function gestureToDegree(
  fingers: FingerState,
  count: number,
  rules: DegreeRule[] = DEFAULT_DEGREE_RULES,
): number | null {
  for (const r of rules) if (r.match(fingers, count)) return r.degree;
  return null;
}

export const VOICING_BY_FINGERS = ["triad", "inv1", "inv2", "seventh", "open"] as const;

/* ————— smoothing ————— */

export class Smoother {
  private v: number | null = null;
  constructor(private factor = 0.18) {}
  push(x: number) {
    this.v = this.v === null ? x : this.v + (x - this.v) * this.factor;
    return this.v;
  }
  get value() {
    return this.v ?? 0;
  }
  reset() {
    this.v = null;
  }
}

/** conferma un valore discreto solo se stabile per `holdMs` */
export class Debouncer<T> {
  private candidate: T | null = null;
  private since = 0;
  private confirmed: T | null = null;
  constructor(private holdMs = 110) {}
  push(value: T, now = performance.now()): T | null {
    if (value !== this.candidate) {
      this.candidate = value;
      this.since = now;
    }
    if (this.confirmed !== value && now - this.since >= this.holdMs) {
      this.confirmed = value;
    }
    return this.confirmed;
  }
  get value() {
    return this.confirmed;
  }
  reset() {
    this.candidate = null;
    this.confirmed = null;
  }
}

/** tilt -> maggiore/minore con dead-zone + isteresi */
export class TonalitySwitch {
  private state: "major" | "minor" = "major";
  constructor(private dead = 0.28) {}
  push(tilt: number): "major" | "minor" {
    if (tilt > this.dead) this.state = "minor";
    else if (tilt < -this.dead * 0.6) this.state = "major";
    return this.state;
  }
  get value() {
    return this.state;
  }
}

/** curva musicale per il volume dall'altezza della mano (max al 70% dello schermo) */
export function heightToGain(height: number) {
  const n = Math.max(0, Math.min(1, height / 0.7));
  return Math.pow(n, 1.4);
}

/** tilt -> cutoff low-pass in Hz */
export function tiltToCutoff(tilt: number) {
  const n = Math.max(0, Math.min(1, 0.5 + tilt / 1.4));
  return 220 * Math.pow(10000 / 220, n);
}
