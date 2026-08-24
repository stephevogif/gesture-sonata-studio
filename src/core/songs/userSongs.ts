/**
 * Heaven Songs — user library (future CREATE SONG feature).
 * Stored in localStorage, same `Song` shape as the demo catalog.
 */

import type { Song } from "./types";

const KEY = "heaven-songs-user";
const MAX = 200;

export function loadUserSongs(): Song[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Song[];
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.id && s.sections?.length) : [];
  } catch {
    return [];
  }
}

function persist(songs: Song[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(songs.slice(0, MAX)));
}

export function saveUserSong(song: Song): Song[] {
  const songs = loadUserSongs();
  const next = [{ ...song, origin: "user" as const }, ...songs.filter((s) => s.id !== song.id)];
  persist(next);
  return next;
}

export function deleteUserSong(id: string): Song[] {
  const next = loadUserSongs().filter((s) => s.id !== id);
  persist(next);
  return next;
}

export function newUserSongId(): string {
  return `user-${Date.now().toString(36)}`;
}
