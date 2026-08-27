/**
 * ONE HAND — suonare Seven Heavens con una sola mano.
 *
 * Le dita di UNA mano (1..5) scelgono uno slot; ogni slot può essere assegnato
 * a qualsiasi grado della scala (1..7). Con una song attiva gli slot vengono
 * riempiti con gli accordi della progressione in ordine di apparizione:
 * accordo 1 → dito 1, accordo 2 → dita 2, ecc.
 */

import type { Song } from "@/core/songs/types";

export const ONE_HAND_SLOTS = 5;

/** SCALE = accordi liberi assegnati alle dita · COVER = progressione di una song */
export type PlayMode = "scale" | "cover";

export type OneHandConfig = {
  enabled: boolean;
  /** grado (1..7) assegnato a ogni slot, indice 0 = 1 dito */
  slots: number[];
  /** quale mano comanda: "any" usa quella visibile */
  hand: "any" | "left" | "right";
  /** true = gli slot seguono automaticamente la song attiva */
  followSong: boolean;
  /** modo di gioco condiviso con Seven Heavens */
  playMode: PlayMode;
};

export const DEFAULT_ONE_HAND: OneHandConfig = {
  enabled: false,
  slots: [1, 4, 5, 6, 2],
  hand: "any",
  followSong: true,
  playMode: "scale",
};

const KEY = "sky.heaven.oneHand";

function sanitize(raw: Partial<OneHandConfig> | null | undefined): OneHandConfig {
  const slots = Array.from({ length: ONE_HAND_SLOTS }, (_, i) => {
    const v = Math.round(Number(raw?.slots?.[i] ?? DEFAULT_ONE_HAND.slots[i]));
    return Number.isFinite(v) ? Math.min(7, Math.max(1, v)) : DEFAULT_ONE_HAND.slots[i]!;
  });
  return {
    enabled: Boolean(raw?.enabled),
    slots,
    hand: raw?.hand === "left" || raw?.hand === "right" ? raw.hand : "any",
    followSong: raw?.followSong !== false,
    playMode: raw?.playMode === "cover" ? "cover" : "scale",
  };
}


export function readOneHand(): OneHandConfig {
  if (typeof window === "undefined") return { ...DEFAULT_ONE_HAND };
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? (JSON.parse(raw) as OneHandConfig) : null);
  } catch {
    return { ...DEFAULT_ONE_HAND };
  }
}

export function writeOneHand(cfg: OneHandConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitize(cfg)));
  } catch {
    /* storage pieno o non disponibile: la config resta in memoria */
  }
}

/** gradi unici della sequenza, nell'ordine in cui compaiono */
export function uniqueInOrder(degrees: number[]): number[] {
  const out: number[] = [];
  for (const d of degrees) if (!out.includes(d)) out.push(d);
  return out;
}

/**
 * Slot derivati da una progressione: il primo accordo va sul dito 1,
 * il secondo sul dito 2 e così via (max 5). Gli slot avanzati ripetono
 * l'ultimo accordo utile, così nessun dito resta muto.
 */
export function slotsFromDegrees(degrees: number[], fallback = DEFAULT_ONE_HAND.slots): number[] {
  const uniq = uniqueInOrder(degrees.filter((d) => d >= 1 && d <= 7));
  if (!uniq.length) return [...fallback];
  return Array.from(
    { length: ONE_HAND_SLOTS },
    (_, i) => uniq[i] ?? uniq[uniq.length - 1] ?? fallback[i]!,
  );
}

/** slot della song, sezione corrente */
export function slotsFromSong(song: Song | null, sectionIndex = 0): number[] | null {
  if (!song) return null;
  const section = song.sections[sectionIndex] ?? song.sections[0];
  if (!section) return null;
  return slotsFromDegrees(section.degrees);
}

/** dito (1..5) da premere per un certo grado, null se non assegnato */
export function slotForDegree(slots: number[], degree: number): number | null {
  const i = slots.indexOf(degree);
  return i < 0 ? null : i + 1;
}
