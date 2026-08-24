/**
 * Heaven Songs — catalog: registry, search and filters.
 * Scales from 12 to 1000+ songs without touching any component.
 */

import { KEYS } from "@/core/music/chords";
import { DEMO_SONGS } from "./demo";
import { loadUserSongs } from "./userSongs";
import { songChordCount, type Difficulty, type Song } from "./types";

/** every song source; add more `Song[]` modules here as the catalog grows */
const SOURCES: (() => Song[])[] = [() => DEMO_SONGS, () => loadUserSongs()];

export function allSongs(): Song[] {
  const out: Song[] = [];
  const seen = new Set<string>();
  for (const source of SOURCES) {
    for (const song of source()) {
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      out.push(song);
    }
  }
  return out;
}

export function findSong(id: string | null | undefined): Song | null {
  if (!id) return null;
  return allSongs().find((s) => s.id === id) ?? null;
}

export type FilterId =
  | "easy"
  | "pop"
  | "chords4"
  | "chords6"
  | "major"
  | "minor";

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "pop", label: "Pop" },
  { id: "chords4", label: "4 Chords" },
  { id: "chords6", label: "6 Chords" },
  { id: "major", label: "Major" },
  { id: "minor", label: "Minor" },
];

function longestSection(song: Song): number {
  return song.sections.reduce((n, s) => Math.max(n, s.degrees.length), 0);
}

function matchesFilter(song: Song, filter: FilterId): boolean {
  switch (filter) {
    case "easy":
      return song.difficulty === "easy";
    case "pop":
      return song.genre.toLowerCase() === "pop";
    case "chords4":
      return longestSection(song) <= 4;
    case "chords6":
      return longestSection(song) >= 6;
    case "major":
      return song.scale === "major" || song.scale === "mixolydian";
    case "minor":
      return song.scale === "minor" || song.scale === "dorian";
  }
}

export function keyLabel(song: Song, transpose = 0): string {
  return KEYS[((song.keyPc + transpose) % 12 + 12) % 12]!;
}

export function difficultyLabel(d: Difficulty): string {
  return d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard";
}

export function searchSongs(
  query: string,
  filters: FilterId[] = [],
  songs: Song[] = allSongs(),
): Song[] {
  const q = query.trim().toLowerCase();
  return songs.filter((song) => {
    if (filters.length && !filters.every((f) => matchesFilter(song, f))) return false;
    if (!q) return true;
    const haystack = `${song.title} ${song.artist} ${song.genre} ${keyLabel(song)} ${song.scale}`;
    return haystack.toLowerCase().includes(q);
  });
}

export { songChordCount };
