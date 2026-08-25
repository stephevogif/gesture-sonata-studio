/**
 * Sound Constellation — mix state (pure data + helpers).
 * Layer: state/serialization. No audio nodes and no React here.
 *
 * The UI edits a `MixState`; `toMixSpec` translates it for the audio engine.
 */

import type { FxSpec, FxTypeId } from "@/core/audio/fx";
import type { MixSpec } from "@/core/audio/engine";
import { defaultFxParams, fxDef } from "@/core/audio/fxCatalog";
import type { InstrumentId } from "@/core/audio/presets";

export const MAX_LAYERS = 4;

export type MixFx = {
  id: string;
  type: FxTypeId;
  amount: number;
  params: Record<string, number>;
  preset?: string;
  bypass?: boolean;
};

export type MixLayer = {
  id: string;
  instrument: InstrumentId;
  gain: number;
  effects: MixFx[];
};

export type MixState = {
  instruments: MixLayer[];
  master: MixFx[];
};

let seq = 0;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function createFx(type: FxTypeId): MixFx {
  const def = fxDef(type);
  return {
    id: uid("fx-"),
    type,
    amount: def.defaultAmount,
    params: defaultFxParams(type),
    ...(type === "gate" ? { preset: "pulse" } : {}),
  };
}

export function createLayer(instrument: InstrumentId, gain = 0.8): MixLayer {
  return { id: uid("ch-"), instrument, gain, effects: [] };
}

/** deep copies with fresh ids, so a preset can be inserted many times */
export function cloneFxList(list: MixFx[]): MixFx[] {
  return list.map((f) => ({ ...f, id: uid("fx-"), params: { ...f.params } }));
}

export function cloneLayer(layer: MixLayer): MixLayer {
  return { ...layer, id: uid("ch-"), effects: cloneFxList(layer.effects) };
}

export function defaultMix(instrument: InstrumentId): MixState {
  return {
    instruments: [createLayer(instrument, 0.85)],
    master: [
      { ...createFx("reverb"), amount: 0.4 },
      { ...createFx("delay"), amount: 0.28 },
    ],
  };
}

/* ————— immutable editing helpers ————— */

export function addLayer(state: MixState, instrument: InstrumentId): MixState {
  if (state.instruments.length >= MAX_LAYERS) return state;
  return { ...state, instruments: [...state.instruments, createLayer(instrument, 0.65)] };
}

export function removeLayer(state: MixState, layerId: string): MixState {
  if (state.instruments.length <= 1) return state;
  return { ...state, instruments: state.instruments.filter((l) => l.id !== layerId) };
}

export function patchLayer(state: MixState, layerId: string, patch: Partial<MixLayer>): MixState {
  return {
    ...state,
    instruments: state.instruments.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
  };
}

/** `layerId === null` targets the master bus */
export function fxListOf(state: MixState, layerId: string | null): MixFx[] {
  if (layerId === null) return state.master;
  return state.instruments.find((l) => l.id === layerId)?.effects ?? [];
}

function setFxList(state: MixState, layerId: string | null, list: MixFx[]): MixState {
  if (layerId === null) return { ...state, master: list };
  return patchLayer(state, layerId, { effects: list });
}

export function addFx(state: MixState, layerId: string | null, type: FxTypeId): MixState {
  const list = fxListOf(state, layerId);
  if (list.length >= 4) return state;
  return setFxList(state, layerId, [...list, createFx(type)]);
}

export function removeFx(state: MixState, layerId: string | null, fxId: string): MixState {
  return setFxList(
    state,
    layerId,
    fxListOf(state, layerId).filter((f) => f.id !== fxId),
  );
}

export function patchFx(
  state: MixState,
  layerId: string | null,
  fxId: string,
  patch: Partial<MixFx>,
): MixState {
  return setFxList(
    state,
    layerId,
    fxListOf(state, layerId).map((f) => (f.id === fxId ? { ...f, ...patch } : f)),
  );
}

export function setFxParam(
  state: MixState,
  layerId: string | null,
  fxId: string,
  paramId: string,
  value: number,
): MixState {
  const fx = fxListOf(state, layerId).find((f) => f.id === fxId);
  if (!fx) return state;
  return patchFx(state, layerId, fxId, { params: { ...fx.params, [paramId]: value } });
}

/* ————— engine translation ————— */

function toSpec(fx: MixFx): FxSpec {
  const spec: FxSpec = { id: fx.id, type: fx.type, amount: fx.amount, params: fx.params };
  if (fx.preset) spec.preset = fx.preset as NonNullable<FxSpec["preset"]>;
  if (fx.bypass) spec.bypass = true;
  return spec;
}

export function toMixSpec(state: MixState): MixSpec {
  return {
    instruments: state.instruments.slice(0, MAX_LAYERS).map((l) => ({
      id: l.id,
      instrument: l.instrument,
      gain: l.gain,
      effects: l.effects.map(toSpec),
    })),
    master: { effects: state.master.map(toSpec) },
  };
}

/* ————— preset helpers ————— */

/** appends a saved layer (instrument + its FX chain) as a new planet */
export function insertLayer(state: MixState, layer: MixLayer): MixState {
  if (state.instruments.length >= MAX_LAYERS) return state;
  return { ...state, instruments: [...state.instruments, cloneLayer(layer)] };
}

/** replaces the whole FX chain of a node (`null` = master) with a saved one */
export function replaceFxChain(state: MixState, layerId: string | null, list: MixFx[]): MixState {
  const next = cloneFxList(list).slice(0, 4);
  if (layerId === null) return { ...state, master: next };
  return patchLayer(state, layerId, { effects: next });
}

/** full deep copy of the console state, with fresh ids */
export function cloneMix(state: MixState): MixState {
  return {
    instruments: state.instruments.map(cloneLayer),
    master: cloneFxList(state.master),
  };
}
