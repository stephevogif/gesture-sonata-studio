/**
 * Hand control mapping — opt-in gesture modulation.
 * Layer: state (pure data). No audio nodes, no React.
 *
 * By default NOTHING is controlled by the hands: the player chooses which
 * parameter (cutoff, volume, reverb) follows which hand gesture.
 */

export type HandSource = "off" | "leftHeight" | "rightHeight" | "leftOpen" | "rightOpen";
export type HandTargetId = "cutoff" | "volume" | "reverb";

export type HandControl = Record<HandTargetId, HandSource>;

export const DEFAULT_HAND_CONTROL: HandControl = {
  cutoff: "off",
  volume: "off",
  reverb: "off",
};

export const HAND_SOURCES: { id: HandSource; label: string }[] = [
  { id: "off", label: "Nessuno" },
  { id: "leftOpen", label: "Mano A · apri/chiudi" },
  { id: "leftHeight", label: "Mano A · altezza" },
  { id: "rightOpen", label: "Mano B · apri/chiudi" },
  { id: "rightHeight", label: "Mano B · altezza" },
];

export const HAND_TARGETS: { id: HandTargetId; label: string }[] = [
  { id: "cutoff", label: "Filtro low pass" },
  { id: "volume", label: "Volume" },
  { id: "reverb", label: "Riverbero" },
];

type HandLike = { height: number; openness: number } | null | undefined;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0..1 value for a source, or `null` when the source is off / hand missing */
export function sourceValue(src: HandSource, left: HandLike, right: HandLike): number | null {
  switch (src) {
    case "leftHeight":
      return left ? clamp01(left.height) : null;
    case "rightHeight":
      return right ? clamp01(right.height) : null;
    case "leftOpen":
      return left ? clamp01(left.openness) : null;
    case "rightOpen":
      return right ? clamp01(right.openness) : null;
    default:
      return null;
  }
}

export function readHandControl(key: string): HandControl {
  if (typeof window === "undefined") return { ...DEFAULT_HAND_CONTROL };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_HAND_CONTROL };
    const parsed = JSON.parse(raw) as Partial<HandControl>;
    return { ...DEFAULT_HAND_CONTROL, ...parsed };
  } catch {
    return { ...DEFAULT_HAND_CONTROL };
  }
}

export function writeHandControl(key: string, value: HandControl) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
