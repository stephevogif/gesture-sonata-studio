/**
 * Heaven Songs — data model.
 * Layer: Song Library (independent from the React components).
 *
 * A song is stored as HARMONIC DEGREES (1..7), never as audio and never as
 * chord names: `key + scale + degree` is the single source of truth, so the
 * Music Theory Engine can build (and transpose) every chord for free, and the
 * Seven Heavens gesture (total fingers = degree) stays untouched.
 */

import type { ModeId } from "@/core/music/chords";

export type SectionName =
  | "Intro"
  | "Verse"
  | "Pre-Chorus"
  | "Chorus"
  | "Bridge"
  | "Outro"
  | "Main"
  | (string & {});

export type Difficulty = "easy" | "medium" | "hard";

/**
 * FULL        — the Heaven Version maps directly onto available diatonic degrees
 * SIMPLIFIED  — the original has traits we simplified for Seven Heavens
 * ADVANCED    — the original contains harmony the V1 diatonic system can't fully express
 */
export type Compatibility = "full" | "simplified" | "advanced";

export type SongSection = {
  id: string;
  name: SectionName;
  /** degrees expressed exactly as the gesture number: 1..7 */
  degrees: number[];
  /** how many beats each chord lasts (future tempo mode) */
  beatsPerChord?: number;
  /** how many times the section repeats before moving on */
  repetitions?: number;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  /** pitch class of the Heaven key, 0 = C */
  keyPc: number;
  scale: ModeId;
  bpm?: number | null;
  timeSignature?: [number, number];
  difficulty: Difficulty;
  genre: string;
  year?: number;
  artworkRef?: string;
  compatibility: Compatibility;
  /** V1 arrangements are always "heaven" (simplified diatonic reading) */
  arrangementType: "heaven";
  /** reserved for a future extension: borrowed chords, 7ths, sus, power chords */
  extensions?: Record<string, unknown>;
  /** "heaven" = curated Heaven Version, "user" = created in-app */
  origin: "heaven" | "user";
  sections: SongSection[];
};

export type LoopMode = "off" | "section" | "song";

/** future UI surfaces; V1 ships LEARN */
export type SongPlayMode = "learn" | "practice" | "perform";

/** what Seven Heavens needs to enter Song Mode */
export type SongSession = {
  songId: string;
  /** semitones applied on top of the Heaven key */
  transpose: number;
  /** index of the section to play */
  sectionIndex: number;
  loopMode: LoopMode;
  /** a correct gesture moves to the next chord */
  autoAdvance: boolean;
  playMode: SongPlayMode;
};

export function songChordCount(song: Song): number {
  return song.sections.reduce((n, s) => n + s.degrees.length, 0);
}

export function uniqueDegrees(song: Song): number[] {
  const set = new Set<number>();
  song.sections.forEach((s) => s.degrees.forEach((d) => set.add(d)));
  return [...set].sort((a, b) => a - b);
}

export function isHeavenVersion(song: Song): boolean {
  return song.compatibility !== "full";
}
