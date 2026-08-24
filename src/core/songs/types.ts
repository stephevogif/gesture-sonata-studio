/**
 * Heaven Songs — data model.
 * Layer: Song Library (independent from the React components).
 *
 * A song is stored as HARMONIC DEGREES (1..7), never as audio: this makes
 * every song transposable for free and playable with the Seven Heavens
 * finger-count gesture (total fingers = degree).
 */

import type { ModeId } from "@/core/music/chords";

export type SectionName =
  | "Intro"
  | "Verse"
  | "Pre-Chorus"
  | "Chorus"
  | "Bridge"
  | "Outro"
  | (string & {});

export type Difficulty = "easy" | "medium" | "hard";

export type SongSection = {
  id: string;
  name: SectionName;
  /** degrees expressed exactly as the gesture number: 1..7 */
  degrees: number[];
  /** how many beats each chord lasts (auto/tempo mode) */
  beatsPerChord?: number;
  /** how many times the section repeats before moving on */
  repetitions?: number;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  /** pitch class of the original key, 0 = C */
  keyPc: number;
  scale: ModeId;
  bpm: number;
  timeSignature: [number, number];
  difficulty: Difficulty;
  genre: string;
  year?: number;
  artworkRef?: string;
  /** semitone capo/transposition suggestion baked into the song */
  capo?: number;
  /** "demo" = original placeholder progression, "user" = created in-app */
  origin: "demo" | "user";
  sections: SongSection[];
};

/** what Seven Heavens needs to enter Song Mode */
export type SongSession = {
  songId: string;
  /** semitones applied on top of the original key */
  transpose: number;
  /** index of the section to start from */
  sectionIndex: number;
  /** loop the current section forever (practice mode) */
  loopSection: boolean;
  /** manual follow (default) or tempo-driven advance */
  advance: "manual" | "auto";
};

export function songChordCount(song: Song): number {
  return song.sections.reduce((n, s) => n + s.degrees.length, 0);
}

export function uniqueDegrees(song: Song): number[] {
  const set = new Set<number>();
  song.sections.forEach((s) => s.degrees.forEach((d) => set.add(d)));
  return [...set].sort((a, b) => a - b);
}
