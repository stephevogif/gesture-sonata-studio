/**
 * Sound preset library — save / open / delete presets.
 * Layer: state + persistence (localStorage). Max 40 presets.
 *
 * `console` presets store the whole Sound Constellation (all instruments,
 * their FX chains and the master chain) so a full mix can be reused — also in
 * other projects, via JSON export / import.
 */

import { cloneFxList, cloneLayer, cloneMix, type MixFx, type MixLayer, type MixState } from "./mix";

export type SoundPresetBody =
  | { kind: "console"; mix: MixState }
  | { kind: "layer"; layer: MixLayer }
  | { kind: "fx"; effects: MixFx[] };

export type SoundPreset = { id: string; name: string; at: number } & SoundPresetBody;

const KEY = "sky.sound.presets.v1";
export const MAX_PRESETS = 40;
export const PRESET_FILE_TAG = "steph-evo.sound-preset.v1";

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

function clonePresetBody(entry: SoundPresetBody): SoundPresetBody {
  if (entry.kind === "console") return { kind: "console", mix: cloneMix(entry.mix) };
  if (entry.kind === "layer") return { kind: "layer", layer: cloneLayer(entry.layer) };
  return { kind: "fx", effects: cloneFxList(entry.effects) };
}

export function savePreset(entry: { name: string } & SoundPresetBody): SoundPreset[] {
  const base = {
    id: `p-${Date.now().toString(36)}`,
    name: entry.name.trim() || "Preset",
    at: Date.now(),
  };
  const preset = { ...base, ...clonePresetBody(entry) } as SoundPreset;
  return persist([preset, ...listPresets()]);
}

export function deletePreset(id: string): SoundPreset[] {
  return persist(listPresets().filter((p) => p.id !== id));
}

/* ————— portabilità: export / import JSON ————— */

export function exportPresetFile(preset: SoundPreset) {
  if (typeof window === "undefined") return;
  const payload = { tag: PRESET_FILE_TAG, preset };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${preset.name.replace(/[^\w\-]+/g, "_") || "preset"}.sound.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** reads an exported file and stores it locally; returns the updated list or null */
export async function importPresetFile(file: File): Promise<SoundPreset[] | null> {
  try {
    const data = JSON.parse(await file.text());
    const p = data?.preset ?? data;
    if (!p || (p.kind !== "console" && p.kind !== "layer" && p.kind !== "fx")) return null;
    return savePreset({ name: String(p.name ?? "Preset"), ...(p as SoundPresetBody) });
  } catch {
    return null;
  }
}
