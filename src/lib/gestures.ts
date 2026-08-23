/**
 * Compatibility surface for the UI — real implementation in
 * `src/core/tracking/*` and `src/core/gesture/*`.
 */

import { GestureLatch, ValueGlide } from "@/core/tracking/stabilize";

export type { FingerId, FingerState, Landmark as Point, TrackedHand } from "@/core/tracking/types";
export type { TrackedHand as HandFrame } from "@/core/tracking/types";

export {
  fingerScores,
  palmOpenness as handOpenness,
  palmTilt as handTilt,
  FingerAnalyzer,
} from "@/core/tracking/fingers";

export {
  heightToGain,
  tiltToCutoff,
  opennessToBrightness,
  heavensDegree,
  pickHand,
} from "@/core/gesture/interpreter";

export { HysteresisSwitch } from "@/core/tracking/stabilize";

/** Legacy alias: one-pole glide for continuous controls. */
export class Smoother extends ValueGlide {}

/** Legacy alias: hold-to-confirm latch for discrete gesture values. */
export class Debouncer<T> extends GestureLatch<T> {}
