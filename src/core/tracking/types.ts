/**
 * Heaven Synth — tracking contracts.
 * Layer: Hand Landmark Provider (boundary type between camera and app).
 *
 * The rest of the app only ever sees these structures: swapping the underlying
 * landmark library must not require touching UI, gestures or audio.
 */

export type Landmark = { x: number; y: number; z?: number };

export type FingerId = "thumb" | "index" | "middle" | "ring" | "pinky";

export type FingerState = Record<FingerId, boolean>;

export type Handedness = "left" | "right";

/** One hand as the application understands it (mirror-corrected, normalized 0..1). */
export type TrackedHand = {
  handedness: Handedness;
  /** raw landmark cloud, as delivered by the provider (image space, 0..1) */
  landmarks: Landmark[];
  /** which fingers are currently extended */
  fingers: FingerState;
  /** how many fingers are extended, 0..5 */
  count: number;
  /** palm centre on the mirrored screen axis, 0 = left edge, 1 = right edge */
  x: number;
  /** palm centre, 0 = top of the frame */
  y: number;
  /** 1 - y, i.e. 0 at the bottom of the frame and 1 at the top */
  height: number;
  /** palm rotation in radians (0 = horizontal) */
  tilt: number;
  /** 0 = closed fist, 1 = fully spread hand */
  openness: number;
  confidence: number;
  timestamp: number;
};

export type TrackingFrame = {
  hands: TrackedHand[];
  video: HTMLVideoElement;
  fps: number;
  timestamp: number;
};

/** Landmark indexes of the 21-point topology used by the provider. */
export const JOINTS = {
  wrist: 0,
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const;

export const FINGER_IDS: FingerId[] = ["thumb", "index", "middle", "ring", "pinky"];
