/**
 * Heaven Synth — declarative FX catalog for the Sound Constellation UI.
 * Only effects actually implemented in `fx.ts` are listed here.
 */

import type { FxTypeId } from "./fx";

export type FxParamDef = {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  curve?: "lin" | "log";
  unit?: string;
  /** 0/1 switch rendered as a satellite too */
  toggle?: boolean;
};

export type FxDef = {
  type: FxTypeId;
  label: string;
  /** family tint, "r, g, b" */
  rgb: string;
  defaultAmount: number;
  params: FxParamDef[];
};

export const FX_CATALOG: FxDef[] = [
  {
    type: "reverb",
    label: "Reverb",
    rgb: "150, 190, 255",
    defaultAmount: 0.4,
    params: [
      { id: "size", label: "Size", min: 0.06, max: 0.55, default: 0.2, unit: "s" },
      { id: "decay", label: "Decay", min: 0, max: 0.68, default: 0.36 },
      { id: "tone", label: "Tone", min: 500, max: 11000, default: 2800, curve: "log", unit: "Hz" },
    ],
  },
  {
    type: "delay",
    label: "Delay",
    rgb: "255, 214, 150",
    defaultAmount: 0.35,
    params: [
      { id: "time", label: "Time", min: 0.05, max: 1.4, default: 0.32, unit: "s" },
      { id: "feedback", label: "Feedback", min: 0, max: 0.85, default: 0.35 },
      { id: "tone", label: "Tone", min: 500, max: 11000, default: 3200, curve: "log", unit: "Hz" },
    ],
  },
  {
    type: "chorus",
    label: "Chorus",
    rgb: "190, 255, 226",
    defaultAmount: 0.4,
    params: [
      { id: "depth", label: "Depth", min: 0, max: 1, default: 0.5 },
      { id: "rate", label: "Rate", min: 0.05, max: 6, default: 0.6, curve: "log", unit: "Hz" },
    ],
  },
  {
    type: "filter",
    label: "Filter",
    rgb: "210, 180, 255",
    defaultAmount: 0.6,
    params: [
      {
        id: "cutoff",
        label: "Cutoff",
        min: 120,
        max: 14000,
        default: 2400,
        curve: "log",
        unit: "Hz",
      },
      { id: "resonance", label: "Res", min: 0.3, max: 18, default: 4 },
      { id: "mode", label: "HP", min: 0, max: 1, default: 0, toggle: true },
    ],
  },
  {
    type: "distortion",
    label: "Drive",
    rgb: "255, 160, 140",
    defaultAmount: 0.35,
    params: [
      { id: "drive", label: "Drive", min: 0.05, max: 1, default: 0.4 },
      { id: "tone", label: "Tone", min: 600, max: 11000, default: 6000, curve: "log", unit: "Hz" },
      { id: "level", label: "Level", min: 0.1, max: 1, default: 0.55 },
    ],
  },
  {
    type: "tremolo",
    label: "Tremolo",
    rgb: "255, 236, 190",
    defaultAmount: 0.4,
    params: [
      { id: "rate", label: "Rate", min: 0.2, max: 14, default: 4, curve: "log", unit: "Hz" },
      { id: "depth", label: "Depth", min: 0, max: 1, default: 0.6 },
    ],
  },
  {
    type: "gate",
    label: "Gate",
    rgb: "180, 220, 255",
    defaultAmount: 0.8,
    params: [
      { id: "depth", label: "Depth", min: 0, max: 1, default: 1 },
      { id: "rate", label: "Rate", min: 0.25, max: 4, default: 1, curve: "log", unit: "×" },
      { id: "attack", label: "Attack", min: 0.002, max: 0.4, default: 0.006, curve: "log" },
      { id: "release", label: "Release", min: 0.008, max: 1, default: 0.06, curve: "log" },
    ],
  },
];

export function fxDef(type: FxTypeId): FxDef {
  return FX_CATALOG.find((f) => f.type === type) ?? FX_CATALOG[0]!;
}

export function defaultFxParams(type: FxTypeId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of fxDef(type).params) out[p.id] = p.default;
  return out;
}
