/**
 * Heaven Songs — session bridge between the Song Library and Seven Heavens.
 * A tiny observable store (no second synth, no second engine).
 */

import type { SongSession } from "./types";

const KEY = "heaven-song-session";

let current: SongSession | null = null;
let hydrated = false;
const listeners = new Set<(s: SongSession | null) => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = JSON.parse(raw) as SongSession;
  } catch {
    current = null;
  }
}

export function getSongSession(): SongSession | null {
  hydrate();
  return current;
}

export function setSongSession(session: SongSession | null) {
  hydrated = true;
  current = session;
  if (typeof window !== "undefined") {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }
  listeners.forEach((fn) => fn(current));
}

export function updateSongSession(patch: Partial<SongSession>) {
  const base = getSongSession();
  if (!base) return;
  setSongSession({ ...base, ...patch });
}

export function subscribeSongSession(fn: (s: SongSession | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function startSongSession(songId: string, transpose = 0): SongSession {
  const session: SongSession = {
    songId,
    transpose,
    sectionIndex: 0,
    loopSection: false,
    advance: "manual",
  };
  setSongSession(session);
  return session;
}
