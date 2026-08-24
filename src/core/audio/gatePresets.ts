/**
 * Heaven Synth — GATE presets (declarative data only, no DSP here).
 *
 * `steps` are gain multipliers 0..1 read left to right; `beats` is the musical
 * length of one step (1 = a quarter note at the current BPM).
 */

export type GatePresetId =
  "pulse" | "eighth" | "sixteenth" | "offbeat" | "trance" | "stutter" | "breath" | "randomStars";

export type GatePreset = {
  id: GatePresetId;
  name: string;
  /** musical length of one step, in beats */
  beats: number;
  steps: number[];
  /** default edge smoothing in seconds */
  attack: number;
  release: number;
};

export const GATE_PRESETS: GatePreset[] = [
  { id: "pulse", name: "Pulse", beats: 1, steps: [1, 0], attack: 0.006, release: 0.06 },
  { id: "eighth", name: "Eighth", beats: 0.5, steps: [1, 0], attack: 0.005, release: 0.045 },
  {
    id: "sixteenth",
    name: "Sixteenth",
    beats: 0.25,
    steps: [1, 0, 1, 0],
    attack: 0.003,
    release: 0.03,
  },
  { id: "offbeat", name: "Offbeat", beats: 0.5, steps: [0, 1], attack: 0.006, release: 0.05 },
  {
    id: "trance",
    name: "Trance",
    beats: 0.25,
    steps: [1, 0, 0.7, 0, 1, 0, 0.5, 0.2],
    attack: 0.004,
    release: 0.035,
  },
  {
    id: "stutter",
    name: "Stutter",
    beats: 0.125,
    steps: [1, 1, 1, 0, 0, 1, 1, 0],
    attack: 0.002,
    release: 0.018,
  },
  { id: "breath", name: "Breath", beats: 2, steps: [1, 0.25], attack: 0.35, release: 0.7 },
  {
    id: "randomStars",
    name: "Random stars",
    beats: 0.25,
    steps: [1, 0, 0.35, 1, 0, 0.8, 0.15, 1, 0, 0.55, 1, 0.1, 0.9, 0, 0.45, 1],
    attack: 0.004,
    release: 0.04,
  },
];

export function gatePreset(id: GatePresetId | undefined): GatePreset {
  return GATE_PRESETS.find((p) => p.id === id) ?? GATE_PRESETS[0]!;
}

/** compact glyph row used by the UI to sketch the pattern */
export function gateGlyph(id: GatePresetId): string {
  return gatePreset(id)
    .steps.map((s) => (s > 0.66 ? "●" : s > 0.2 ? "◐" : "—"))
    .join("");
}
