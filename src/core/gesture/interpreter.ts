/**
 * Heaven Synth — gesture interpreter.
 * Layer: Gesture Interpreter (pure functions from hand state to musical intent).
 */

import { clamp } from "@/core/music/pitch";
import type { TrackedHand } from "@/core/tracking/types";

/** Seven Heavens: total extended fingers 1..7 select scale degrees I..VII. */
export const HEAVENS_MIN_FINGERS = 1;
export const HEAVENS_MAX_FINGERS = 7;

/**
 * left count + right count -> 0-based scale degree.
 * Returns null when the total is outside the playable 1..7 window.
 */
export function heavensDegree(leftCount: number, rightCount: number): number | null {
  const total = Math.round(leftCount) + Math.round(rightCount);
  if (total < HEAVENS_MIN_FINGERS || total > HEAVENS_MAX_FINGERS) return null;
  return total - 1;
}

/**
 * Vertical hand position -> playing volume.
 * Full level is reached at 70% of the frame height, with a slightly convex
 * curve so quiet playing keeps its resolution.
 */
export function heightToGain(height: number): number {
  const normalized = clamp(height / 0.7, 0, 1);
  return Math.pow(normalized, 1.4);
}

/** Palm rotation -> low-pass cutoff in Hz (logarithmic sweep). */
export function tiltToCutoff(tilt: number): number {
  const normalized = clamp(0.5 + tilt / 1.4, 0, 1);
  return 220 * Math.pow(10000 / 220, normalized);
}

/** Closed fist = dark, open hand = bright. Returns a 0..1 brightness. */
export function opennessToBrightness(openness: number): number {
  return clamp(openness, 0, 1);
}

/** Horizontal hand position -> 0..1 control value (already mirror corrected). */
export function positionToControl(x: number): number {
  return clamp(x, 0, 1);
}

export function pickHand(hands: TrackedHand[], side: "left" | "right"): TrackedHand | undefined {
  return hands.find((hand) => hand.handedness === side);
}
