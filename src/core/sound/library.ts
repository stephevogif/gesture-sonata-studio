/**
 * Sound preset library — save / open / delete instrument and FX presets.
 * Layer: state + persistence (localStorage). Max 40 presets.
 */

import { cloneFxList, cloneLayer, type MixFx, type MixLayer } from "./mix";

export type SoundPreset = {
  id: string;
  name: string;
  at: number;
} & ({ kind: "layer"; layer: MixLayer } | { kind: "fx"; effects: MixFx[] });

const KEY = "sky.sound.presets.v1";
export const MAX_PRESETS = 40;

export function listPresets(): SoundPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SoundPreset[]) : [];
  } catch {
    return [];
  }
}

function persist(list: SoundPreset[]): SoundPreset[] {
  const trimmed = list.slice(0, MAX_PRESETS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or blocked */
  }
  return trimmed;
}

export function savePreset(
  entry: { name: string } & ({ kind: "layer"; layer: MixLayer } | { kind: "fx"; effects: MixFx[] }),
): SoundPreset[] {
  const base = { id: `p-${Date.now().toString(36)}`, name: entry.name.trim() || "Preset", at: Date.now() };
  const preset: SoundPreset =
    entry.kind === "layer"
      ? { ...base, kind: "layer", layer: cloneLayer(entry.layer) }
      : { ...base, kind: "fx", effects: cloneFxList(entry.effects) };
  return persist([preset, ...listPresets()]);
}

export function deletePreset(id: string): SoundPreset[] {
  return persist(listPresets().filter((p) => p.id !== id));
}
