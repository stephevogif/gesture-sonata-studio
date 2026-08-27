/**
 * Factory sound presets — curated console mixes (instruments + FX chains).
 * Layer: pure data. No audio nodes, no React.
 *
 * Each preset builds a full `MixState` with fresh ids, ready to be applied
 * to the Sound Constellation.
 */

import type { FxTypeId } from "@/core/audio/fx";
import type { InstrumentId } from "@/core/audio/presets";
import { createFx, createLayer, type MixFx, type MixLayer, type MixState } from "./mix";

type FxSeed = { type: FxTypeId; amount?: number; params?: Record<string, number> };
type LayerSeed = { instrument: InstrumentId; gain?: number; fx?: FxSeed[] };

function fx(seed: FxSeed): MixFx {
  const base = createFx(seed.type);
  return {
    ...base,
    amount: seed.amount ?? base.amount,
    params: { ...base.params, ...(seed.params ?? {}) },
  };
}

function layer(seed: LayerSeed): MixLayer {
  return { ...createLayer(seed.instrument, seed.gain ?? 0.8), effects: (seed.fx ?? []).map(fx) };
}

export type FactoryPreset = {
  id: string;
  name: string;
  hint: string;
  build: () => MixState;
};

function mix(instruments: LayerSeed[], master: FxSeed[]): MixState {
  return { instruments: instruments.map(layer), master: master.map(fx) };
}

export const FACTORY_PRESETS: FactoryPreset[] = [
  {
    id: "cathedral-pads",
    name: "Cathedral Pads",
    hint: "pads + coro, riverbero lungo",
    build: () =>
      mix(
        [
          {
            instrument: "pads",
            gain: 0.82,
            fx: [
              { type: "filter", amount: 0.5, params: { cutoff: 3600, resonance: 2 } },
              { type: "chorus", amount: 0.35, params: { depth: 0.45, rate: 0.35 } },
            ],
          },
          { instrument: "choir", gain: 0.42, fx: [{ type: "filter", amount: 0.4, params: { cutoff: 2600, resonance: 1.5 } }] },
        ],
        [
          { type: "reverb", amount: 0.62, params: { size: 0.46, decay: 0.58, tone: 3200 } },
          { type: "delay", amount: 0.18, params: { time: 0.52, feedback: 0.28, tone: 2600 } },
        ],
      ),
  },
  {
    id: "felt-room",
    name: "Felt Room",
    hint: "piano felt intimo, aria calda",
    build: () =>
      mix(
        [
          {
            instrument: "feltPiano",
            gain: 0.9,
            fx: [{ type: "filter", amount: 0.45, params: { cutoff: 4200, resonance: 1.2 } }],
          },
        ],
        [
          { type: "reverb", amount: 0.42, params: { size: 0.24, decay: 0.38, tone: 2600 } },
          { type: "chorus", amount: 0.16, params: { depth: 0.28, rate: 0.28 } },
        ],
      ),
  },
  {
    id: "string-quartet",
    name: "String Quartet",
    hint: "archi da camera + violoncello",
    build: () =>
      mix(
        [
          { instrument: "chamberStrings", gain: 0.85 },
          { instrument: "cello", gain: 0.5, fx: [{ type: "filter", amount: 0.4, params: { cutoff: 2200, resonance: 1 } }] },
        ],
        [
          { type: "reverb", amount: 0.52, params: { size: 0.34, decay: 0.48, tone: 3000 } },
        ],
      ),
  },
  {
    id: "glass-bells",
    name: "Glass Bells",
    hint: "celesta e glocken cristallini",
    build: () =>
      mix(
        [
          { instrument: "celesta", gain: 0.8 },
          { instrument: "glocken", gain: 0.4 },
        ],
        [
          { type: "delay", amount: 0.34, params: { time: 0.3, feedback: 0.42, tone: 5200 } },
          { type: "reverb", amount: 0.5, params: { size: 0.4, decay: 0.5, tone: 6000 } },
        ],
      ),
  },
  {
    id: "night-rhodes",
    name: "Night Rhodes",
    hint: "rhodes + tremolo notturno",
    build: () =>
      mix(
        [
          {
            instrument: "rhodes",
            gain: 0.85,
            fx: [
              { type: "tremolo", amount: 0.3, params: { rate: 4.5, depth: 0.45 } },
              { type: "chorus", amount: 0.32, params: { depth: 0.5, rate: 0.7 } },
            ],
          },
        ],
        [
          { type: "delay", amount: 0.26, params: { time: 0.38, feedback: 0.3, tone: 3000 } },
          { type: "reverb", amount: 0.38, params: { size: 0.26, decay: 0.4, tone: 2800 } },
        ],
      ),
  },
  {
    id: "cinematic-air",
    name: "Cinematic Air",
    hint: "archi cinematici e fiati lontani",
    build: () =>
      mix(
        [
          { instrument: "cineStrings", gain: 0.8 },
          { instrument: "winds", gain: 0.38, fx: [{ type: "filter", amount: 0.5, params: { cutoff: 2000, resonance: 1.4 } }] },
        ],
        [
          { type: "reverb", amount: 0.68, params: { size: 0.5, decay: 0.62, tone: 2400 } },
          { type: "delay", amount: 0.2, params: { time: 0.66, feedback: 0.34, tone: 2200 } },
        ],
      ),
  },
  {
    id: "harp-garden",
    name: "Harp Garden",
    hint: "arpa e kalimba, eco delicata",
    build: () =>
      mix(
        [
          { instrument: "harp", gain: 0.82 },
          { instrument: "kalimba", gain: 0.4 },
        ],
        [
          { type: "delay", amount: 0.3, params: { time: 0.44, feedback: 0.36, tone: 4200 } },
          { type: "reverb", amount: 0.46, params: { size: 0.32, decay: 0.46, tone: 3600 } },
        ],
      ),
  },
  {
    id: "pulse-dream",
    name: "Pulse Dream",
    hint: "pad ritmico con gate a tempo",
    build: () =>
      mix(
        [
          {
            instrument: "pluckAmb",
            gain: 0.78,
            fx: [
              { type: "gate", amount: 0.8, params: { depth: 0.9, rate: 2, attack: 0.006, release: 0.09 } },
              { type: "filter", amount: 0.55, params: { cutoff: 5200, resonance: 3 } },
            ],
          },
          { instrument: "subpad", gain: 0.45 },
        ],
        [
          { type: "delay", amount: 0.32, params: { time: 0.3, feedback: 0.4, tone: 3600 } },
          { type: "reverb", amount: 0.44, params: { size: 0.3, decay: 0.44, tone: 3200 } },
        ],
      ),
  },
];
