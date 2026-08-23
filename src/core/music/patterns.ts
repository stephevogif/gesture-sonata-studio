/**
 * Heaven Synth — rhythmic and harmonic pattern tables.
 * Layer: Music Theory Engine (data only).
 *
 * Patterns are expressed as scale-degree offsets, so they transpose with the
 * selected key and stay inside the chosen scale by construction.
 */

export type ArpPatternId =
  | "up"
  | "down"
  | "updown"
  | "octaves"
  | "thirds"
  | "wide"
  | "cascade"
  | "pulse"
  | "trance"
  | "acidline"
  | "bassdrive"
  | "random";

export type PatternDefinition<Id extends string> = {
  id: Id;
  name: string;
  degrees: number[];
};

export const ARP_PATTERNS: PatternDefinition<ArpPatternId>[] = [
  { id: "up", name: "Salita", degrees: [0, 1, 2, 3] },
  { id: "down", name: "Discesa", degrees: [3, 2, 1, 0] },
  { id: "updown", name: "Su e giù", degrees: [0, 1, 2, 3, 2, 1] },
  { id: "octaves", name: "Ottave", degrees: [0, 4, 0, 4] },
  { id: "thirds", name: "Terze", degrees: [0, 2, 1, 3] },
  { id: "wide", name: "Ampio", degrees: [0, 3, 5, 7] },
  { id: "cascade", name: "Cascata", degrees: [7, 5, 3, 2, 0] },
  { id: "pulse", name: "Pulsazione", degrees: [0, 0, 4, 0] },
  { id: "trance", name: "Trance gate", degrees: [0, 0, 2, 0, 4, 0, 2, 0] },
  { id: "acidline", name: "Acid line", degrees: [0, 0, 7, 0, 3, 0, 5, 0] },
  { id: "bassdrive", name: "Bass drive", degrees: [0, 0, 0, 2, 0, 0, 3, 0] },
  // "random" reuses the ladder but the engine picks the step at random
  { id: "random", name: "Casuale", degrees: [0, 1, 2, 3, 4, 5] },
];

export type ChordId = "off" | "fifth" | "triad" | "seventh" | "sus";

/** Chord shapes as scale-degree offsets above the played degree. */
export const CHORDS: PatternDefinition<ChordId>[] = [
  { id: "off", name: "Nota singola", degrees: [0] },
  { id: "fifth", name: "Quinta", degrees: [0, 4] },
  { id: "triad", name: "Triade", degrees: [0, 2, 4] },
  { id: "seventh", name: "Settima", degrees: [0, 2, 4, 6] },
  { id: "sus", name: "Sospeso", degrees: [0, 3, 4] },
];

export type DivisionId = "1/4" | "1/8" | "1/8T" | "1/16" | "1/16T";

/** `perBeat` = how many events fit inside one quarter note. */
export const DIVISIONS: { id: DivisionId; name: string; perBeat: number }[] = [
  { id: "1/4", name: "1/4", perBeat: 1 },
  { id: "1/8", name: "1/8", perBeat: 2 },
  { id: "1/8T", name: "1/8T", perBeat: 3 },
  { id: "1/16", name: "1/16", perBeat: 4 },
  { id: "1/16T", name: "1/16T", perBeat: 6 },
];

export function divisionSeconds(division: DivisionId, bpm: number): number {
  const perBeat = DIVISIONS.find((d) => d.id === division)?.perBeat ?? 2;
  return 60 / Math.max(20, bpm) / perBeat;
}

export function chordOffsets(id: ChordId): number[] {
  return CHORDS.find((c) => c.id === id)?.degrees ?? [0];
}

export function arpDegrees(id: ArpPatternId): number[] {
  return ARP_PATTERNS.find((p) => p.id === id)?.degrees ?? [0];
}
