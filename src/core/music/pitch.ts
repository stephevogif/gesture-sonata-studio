/**
 * Heaven Synth — pitch primitives.
 * Layer: Music Theory Engine (pure, no DOM, no audio).
 *
 * Everything here is derived from equal temperament maths:
 * a MIDI note number is an integer index over semitones, and A4 (69) is the anchor.
 */

export const SEMITONES_PER_OCTAVE = 12;

/** Reference pitch used to convert note indexes into frequencies. */
export const TUNING = { anchorMidi: 69, anchorHz: 440 } as const;

export const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type PitchClassName = (typeof PITCH_CLASS_NAMES)[number];

/** Always-positive modulo, so negative degrees/roots behave musically. */
export function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function pitchClassOf(midi: number): number {
  return wrap(Math.round(midi), SEMITONES_PER_OCTAVE);
}

export function pitchClassName(pitchClass: number): PitchClassName {
  return PITCH_CLASS_NAMES[pitchClassOf(pitchClass)]!;
}

export function octaveOf(midi: number): number {
  return Math.floor(Math.round(midi) / SEMITONES_PER_OCTAVE) - 1;
}

/** "C4", "F#2", … */
export function noteLabel(midi: number): string {
  return `${pitchClassName(midi)}${octaveOf(midi)}`;
}

/** MIDI number for a pitch class inside a scientific octave (C4 = 60). */
export function midiOf(pitchClass: number, octave: number): number {
  return (octave + 1) * SEMITONES_PER_OCTAVE + pitchClassOf(pitchClass);
}

export function noteToFrequency(midi: number): number {
  return TUNING.anchorHz * Math.pow(2, (midi - TUNING.anchorMidi) / SEMITONES_PER_OCTAVE);
}

export function frequencyToNote(hz: number): number {
  return TUNING.anchorMidi + SEMITONES_PER_OCTAVE * Math.log2(hz / TUNING.anchorHz);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
