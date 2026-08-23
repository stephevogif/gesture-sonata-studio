/**
 * Heaven Synth — scale registry.
 * Layer: Music Theory Engine.
 *
 * A scale is nothing but an ordered list of semitone offsets from its tonic.
 * Every note the instrument can play is generated from that list at runtime,
 * so adding a scale only means adding intervals here.
 */

import { SEMITONES_PER_OCTAVE, midiOf, pitchClassName, wrap } from "./pitch";

export type ScaleId =
  | "minorPent"
  | "majorPent"
  | "naturalMinor"
  | "harmonicMinor"
  | "phrygian"
  | "dorian"
  | "major"
  | "blues"
  | "chromatic";

export type ScaleDefinition = {
  id: ScaleId;
  name: string;
  /** semitone offsets from the tonic, ascending, first entry always 0 */
  steps: number[];
};

export const SCALES: ScaleDefinition[] = [
  { id: "minorPent", name: "Pentatonica minore", steps: [0, 3, 5, 7, 10] },
  { id: "majorPent", name: "Pentatonica maggiore", steps: [0, 2, 4, 7, 9] },
  { id: "naturalMinor", name: "Minore naturale", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "harmonicMinor", name: "Minore armonica", steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: "phrygian", name: "Frigia", steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: "dorian", name: "Dorica", steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: "major", name: "Maggiore", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "blues", name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
  { id: "chromatic", name: "Cromatica", steps: Array.from({ length: 12 }, (_, i) => i) },
];

const FALLBACK = SCALES[0]!;

export function scaleDefinition(id: ScaleId): ScaleDefinition {
  return SCALES.find((s) => s.id === id) ?? FALLBACK;
}

/** semitone list of a scale (kept as a helper so callers never index the registry) */
export function scaleSteps(id: ScaleId): number[] {
  return scaleDefinition(id).steps;
}

/**
 * Semitone distance of a scale degree from the tonic.
 * Degrees are unbounded: index 7 of a 7-note scale is the tonic one octave up,
 * and negative indexes walk downwards.
 */
export function degreeToSemitones(steps: number[], degree: number): number {
  const size = steps.length || 1;
  const index = wrap(degree, size);
  const octave = Math.floor(degree / size);
  return (steps[index] ?? 0) + octave * SEMITONES_PER_OCTAVE;
}

/** Base register used by the gesture instruments (C3). */
export const BASE_MIDI = midiOf(0, 3);

/** MIDI note for a degree of `steps` rooted on `rootPc`, plus an optional transpose. */
export function degreeToMidi(
  degree: number,
  steps: number[],
  rootPc: number,
  transpose = 0,
): number {
  return BASE_MIDI + rootPc + transpose + degreeToSemitones(steps, degree);
}

/** Maps a normalized 0..1 axis onto a discrete degree ladder. */
export function positionToDegree(position: number, ladderSize = 21): number {
  const last = Math.max(1, ladderSize - 1);
  const raw = Math.round(position * last);
  return raw < 0 ? 0 : raw > last ? last : raw;
}

/** Names of `count` consecutive degrees, used by the scale ribbons in the UI. */
export function scaleDegreeNames(rootPc: number, steps: number[], count = 8): string[] {
  return Array.from({ length: count }, (_, i) =>
    pitchClassName(rootPc + degreeToSemitones(steps, i)),
  );
}
