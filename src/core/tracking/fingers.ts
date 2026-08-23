/**
 * Heaven Synth — finger state analyzer.
 * Layer: Finger State Analyzer.
 *
 * Approach: every finger is judged in the palm's own reference frame instead of
 * in screen space, so the reading survives rotation, mirroring, hand size and
 * phone cameras.
 *
 *  - `spine` is the unit vector wrist -> middle knuckle (the "up" of the hand)
 *  - `span`  is the unit vector index knuckle -> pinky knuckle (the "across")
 *  - a finger counts as extended when its bone chain is nearly straight AND the
 *    tip sits far along the spine, both measured relative to the finger's own
 *    bone length (scale invariant)
 *  - the thumb is judged by abduction across the palm, since it folds sideways
 *
 * Per-finger scores are low-pass filtered and gated with hysteresis, so one bad
 * frame cannot flip a finger and change the chord.
 */

import { FINGER_IDS, JOINTS, type FingerId, type FingerState, type Landmark } from "./types";

type Vec = { x: number; y: number };

const sub = (a: Landmark, b: Landmark): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Vec) => Math.hypot(v.x, v.y) || 1e-6;
const unit = (v: Vec): Vec => {
  const l = len(v);
  return { x: v.x / l, y: v.y / l };
};
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const dist = (a: Landmark, b: Landmark) => len(sub(a, b));

export type PalmFrame = {
  /** unit vector from wrist towards the middle knuckle */
  spine: Vec;
  /** unit vector across the knuckles */
  span: Vec;
  /** knuckle-to-knuckle width, used as the hand's scale unit */
  width: number;
  /** wrist-to-knuckle length */
  length: number;
};

export function palmFrame(lm: Landmark[]): PalmFrame {
  const wrist = lm[JOINTS.wrist]!;
  const indexMcp = lm[JOINTS.index[0]]!;
  const middleMcp = lm[JOINTS.middle[0]]!;
  const pinkyMcp = lm[JOINTS.pinky[0]]!;
  return {
    spine: unit(sub(middleMcp, wrist)),
    span: unit(sub(pinkyMcp, indexMcp)),
    width: Math.max(0.02, dist(indexMcp, pinkyMcp)),
    length: Math.max(0.02, dist(wrist, middleMcp)),
  };
}

/** 0 = curled into the palm, 1 = fully extended, for one of the four long fingers. */
export function longFingerScore(lm: Landmark[], chain: readonly number[], frame: PalmFrame) {
  const [mcp, pip, dip, tip] = chain.map((i) => lm[i]!) as [
    Landmark,
    Landmark,
    Landmark,
    Landmark,
  ];
  const boneLength = dist(mcp, pip) + dist(pip, dip) + dist(dip, tip);
  if (boneLength < 1e-4) return 0;

  // 1 when the three bones form a straight line, ~0.4 when fully folded
  const straightness = dist(mcp, tip) / boneLength;
  // how far the tip reaches along the palm's own "up" direction
  const reach = dot(sub(tip, mcp), frame.spine) / boneLength;

  const straightScore = (straightness - 0.62) / 0.3;
  const reachScore = (reach + 0.05) / 0.55;
  return Math.max(0, Math.min(1, Math.min(straightScore, reachScore)));
}

/** 0 = tucked against the index, 1 = clearly abducted / stretched out. */
export function thumbScore(lm: Landmark[], frame: PalmFrame) {
  const mcp = lm[JOINTS.thumb[1]]!;
  const tip = lm[JOINTS.thumb[3]]!;
  const indexMcp = lm[JOINTS.index[0]]!;
  const pinkyMcp = lm[JOINTS.pinky[0]]!;

  // sideways travel away from the palm, signed against the knuckle axis
  const lateral = -dot(sub(tip, indexMcp), frame.span) / frame.width;
  // distance to the far side of the palm grows a lot once the thumb opens
  const reach = dist(tip, pinkyMcp) / frame.width;
  // a folded thumb stays close to its own base
  const stretch = dist(tip, mcp) / frame.width;

  const lateralScore = (lateral + 0.12) / 0.34;
  const reachScore = (reach - 1.0) / 0.35;
  const stretchScore = (stretch - 0.42) / 0.3;
  const blended = 0.45 * lateralScore + 0.35 * reachScore + 0.2 * stretchScore;
  return Math.max(0, Math.min(1, blended));
}

/** Raw (unfiltered) 0..1 extension score for the five fingers. */
export function fingerScores(lm: Landmark[]): Record<FingerId, number> {
  const frame = palmFrame(lm);
  return {
    thumb: thumbScore(lm, frame),
    index: longFingerScore(lm, JOINTS.index, frame),
    middle: longFingerScore(lm, JOINTS.middle, frame),
    ring: longFingerScore(lm, JOINTS.ring, frame),
    pinky: longFingerScore(lm, JOINTS.pinky, frame),
  };
}

const OPEN_GATE = 0.62;
const CLOSE_GATE = 0.38;

/**
 * Keeps one filtered score + latched boolean per finger.
 * Create one analyzer per hand slot (left / right).
 */
export class FingerAnalyzer {
  private smoothed: Record<FingerId, number> = {
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
  };
  private latched: FingerState = {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  };

  constructor(private readonly responsiveness = 0.45) {}

  read(lm: Landmark[]): { fingers: FingerState; count: number; scores: Record<FingerId, number> } {
    const raw = fingerScores(lm);
    for (const id of FINGER_IDS) {
      const previous = this.smoothed[id];
      const next = previous + (raw[id] - previous) * this.responsiveness;
      this.smoothed[id] = next;
      if (!this.latched[id] && next > OPEN_GATE) this.latched[id] = true;
      else if (this.latched[id] && next < CLOSE_GATE) this.latched[id] = false;
    }
    const fingers = { ...this.latched };
    const count = FINGER_IDS.reduce((total, id) => total + (fingers[id] ? 1 : 0), 0);
    return { fingers, count, scores: { ...this.smoothed } };
  }

  reset() {
    for (const id of FINGER_IDS) {
      this.smoothed[id] = 0;
      this.latched[id] = false;
    }
  }
}

/** Palm rotation in radians: 0 when the knuckle line is horizontal. */
export function palmTilt(lm: Landmark[]): number {
  const a = lm[JOINTS.index[0]]!;
  const b = lm[JOINTS.pinky[0]]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** 0 = fist, 1 = spread hand, from the average tip distance in palm units. */
export function palmOpenness(lm: Landmark[]): number {
  const frame = palmFrame(lm);
  const wrist = lm[JOINTS.wrist]!;
  const tips = [JOINTS.index[3], JOINTS.middle[3], JOINTS.ring[3], JOINTS.pinky[3]];
  const average =
    tips.reduce((sum, i) => sum + dist(lm[i]!, wrist), 0) / (tips.length * frame.length);
  return Math.max(0, Math.min(1, (average - 1.1) / 1.1));
}

/** Palm centre in image space (before mirroring). */
export function palmCentre(lm: Landmark[]): { x: number; y: number } {
  const wrist = lm[JOINTS.wrist]!;
  const middleMcp = lm[JOINTS.middle[0]]!;
  return { x: (wrist.x + middleMcp.x) / 2, y: (wrist.y + middleMcp.y) / 2 };
}
