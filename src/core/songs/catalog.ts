/**
 * Heaven Songs — catalog: registry, search and filters.
 * Scales from 40 to 500+ songs without touching any component: add another
 * `Song[]` module to SOURCES and everything (search, filters, Song Mode) works.
 */

import { KEYS, MODES } from "@/core/music/chords";
import { HEAVEN_SONGS } from "./heavenVersions";
import { loadUserSongs } from "./userSongs";
import { getFavorites, getRecent } from "./library";
import { songChordCount, type Compatibility, type Difficulty, type Song } from "./types";

const SOURCES: (() => Song[])[] = [() => HEAVEN_SONGS, () => loadUserSongs()];

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
  | "all"
  | "easy"
  | "pop"
  | "rock"
  | "alternative"
  | "numetal"
  | "chords4"
  | "major"
  | "minor"
  | "favorites"
  | "recent";

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "easy", label: "Easy" },
  { id: "pop", label: "Pop" },
  { id: "rock", label: "Rock" },
  { id: "alternative", label: "Alternative" },
  { id: "numetal", label: "Nu Metal" },
  { id: "chords4", label: "4 Chords" },
  { id: "major", label: "Major" },
  { id: "minor", label: "Minor" },
  { id: "favorites", label: "Favorites" },
  { id: "recent", label: "Recently Played" },
];

function longestSection(song: Song): number {
  return song.sections.reduce((n, s) => Math.max(n, s.degrees.length), 0);
}

function matchesFilter(song: Song, filter: FilterId): boolean {
  const genre = song.genre.toLowerCase();
  switch (filter) {
    case "all":
      return true;
    case "easy":
      return song.difficulty === "easy";
    case "pop":
      return genre.includes("pop") || genre.includes("reggae");
    case "rock":
      return genre.includes("rock") || genre.includes("britpop") || genre.includes("grunge");
    case "alternative":
      return genre.includes("alternative") || genre.includes("grunge") || genre.includes("britpop");
    case "numetal":
      return genre.includes("nu metal") || genre.includes("metal");
    case "chords4":
      return longestSection(song) <= 4;
    case "major":
      return song.scale === "major" || song.scale === "mixolydian";
    case "minor":
      return song.scale === "minor" || song.scale === "dorian";
    case "favorites":
      return getFavorites().includes(song.id);
    case "recent":
      return getRecent().includes(song.id);
  }
}

export function keyLabel(song: Song, transpose = 0): string {
  return KEYS[((song.keyPc + transpose) % 12 + 12) % 12]!;
}

export function scaleLabel(song: Song): string {
  return MODES.find((m) => m.id === song.scale)?.name ?? song.scale;
}

export function difficultyLabel(d: Difficulty): string {
  return d === "easy" ? "Easy" : d === "medium" ? "Medium" : "Hard";
}

export function compatibilityLabel(c: Compatibility): string | null {
  if (c === "full") return null;
  return c === "simplified" ? "Heaven Version" : "Heaven Version · Simplified";
}

export function searchSongs(
  query: string,
  filters: FilterId[] = [],
  songs: Song[] = allSongs(),
): Song[] {
  const q = query.trim().toLowerCase();
  const active = filters.filter((f) => f !== "all");
  const recent = getRecent();
  const list = songs.filter((song) => {
    if (active.length && !active.every((f) => matchesFilter(song, f))) return false;
    if (!q) return true;
    const haystack = `${song.title} ${song.artist} ${song.genre} ${keyLabel(song)} ${song.scale}`;
    return haystack.toLowerCase().includes(q);
  });
  if (active.includes("recent")) {
    return [...list].sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  }
  return list;
}

export { songChordCount };
