/**
 * Heaven Songs — local library state: favorites, recently played, play count.
 * Pure localStorage, no engine involved.
 */

const FAV_KEY = "heaven-songs-favorites";
const RECENT_KEY = "heaven-songs-recent";
const COUNT_KEY = "heaven-songs-plays";
const RECENT_MAX = 30;

const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  listeners.forEach((fn) => fn());
}

export function subscribeLibrary(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFavorites(): string[] {
  return read<string[]>(FAV_KEY, []);
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

export function toggleFavorite(id: string): string[] {
  const favs = getFavorites();
  const next = favs.includes(id) ? favs.filter((x) => x !== id) : [id, ...favs];
  write(FAV_KEY, next);
  return next;
}

export function getRecent(): string[] {
  return read<string[]>(RECENT_KEY, []);
}

export function getPlayCounts(): Record<string, number> {
  return read<Record<string, number>>(COUNT_KEY, {});
}

export function markPlayed(id: string) {
  const recent = [id, ...getRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  write(RECENT_KEY, recent);
  const counts = getPlayCounts();
  counts[id] = (counts[id] ?? 0) + 1;
  write(COUNT_KEY, counts);
}
