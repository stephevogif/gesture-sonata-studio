/**
 * Hand Expression — modulazione espressiva continua delle mani.
 * Layer: Gesture Interpreter (funzioni pure) + persistenza locale.
 *
 * Tre gesti, sempre gli stessi in ogni finestra (Seven Heavens, One Hand, Night Sky):
 *   • rotazione del palmo  -> oscillatore / bend fino a un quarto di tono (±50 cent)
 *   • apri / chiudi la mano -> low pass: chiuso = scuro, aperto = brillante
 *   • alza / abbassa la mano -> volume
 *
 * Tutto opzionale: `enabled` false = nessun parametro toccato.
 */

import { clamp } from "@/core/music/pitch";

export type Expression = {
  enabled: boolean;
  /** rotazione -> pitch bend (quarto di tono) */
  bend: boolean;
  /** apertura -> low pass filter */
  filter: boolean;
  /** altezza -> volume */
  volume: boolean;
};

export const DEFAULT_EXPRESSION: Expression = {
  enabled: false,
  bend: true,
  filter: true,
  volume: true,
};

/** massima deviazione di intonazione: un quarto di tono */
export const QUARTER_TONE_CENTS = 50;

type HandLike = { height: number; openness: number; tilt: number } | null | undefined;

/** la mano più affidabile fra le due (destra se presente) */
export function expressiveHand(left: HandLike, right: HandLike): HandLike {
  return right ?? left ?? null;
}

/** rotazione del palmo (rad) -> cent di bend, ±1/4 di tono */
export function tiltToBendCents(tilt: number): number {
  return clamp(tilt / 1.1, -1, 1) * QUARTER_TONE_CENTS;
}

/** apertura 0..1 -> cutoff low pass in Hz (chiuso scuro, aperto brillante) */
export function opennessToCutoff(openness: number): number {
  const v = clamp(openness, 0, 1);
  return 320 * Math.pow(15000 / 320, Math.pow(v, 0.85));
}

/** altezza 0..1 -> volume master 0.05..1 */
export function heightToVolume(height: number): number {
  return 0.05 + Math.pow(clamp(height, 0, 1), 1.3) * 0.95;
}

export function readExpression(key: string): Expression {
  if (typeof window === "undefined") return { ...DEFAULT_EXPRESSION };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_EXPRESSION };
    return { ...DEFAULT_EXPRESSION, ...(JSON.parse(raw) as Partial<Expression>) };
  } catch {
    return { ...DEFAULT_EXPRESSION };
  }
}

export function writeExpression(key: string, value: Expression) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage bloccato */
  }
}

export type ExpressionTargets = {
  setBend: (cents: number) => void;
  setEq: (type: BiquadFilterType, freq: number) => void;
  setMasterGain: (value: number) => void;
};

/**
 * Applica l'espressione a un motore audio.
 * Ritorna quali parametri sono stati scritti, così il chiamante può evitare di
 * sovrascriverli con le sue mappature di default.
 */
export function applyExpression(
  engine: ExpressionTargets,
  left: HandLike,
  right: HandLike,
  ex: Expression,
): { bend: boolean; filter: boolean; volume: boolean } {
  const done = { bend: false, filter: false, volume: false };
  if (!ex.enabled) return done;
  const hand = expressiveHand(left, right);
  if (!hand) {
    if (ex.bend) engine.setBend(0);
    return done;
  }
  if (ex.bend) {
    engine.setBend(tiltToBendCents(hand.tilt));
    done.bend = true;
  }
  if (ex.filter) {
    engine.setEq("lowpass", opennessToCutoff(hand.openness));
    done.filter = true;
  }
  if (ex.volume) {
    engine.setMasterGain(heightToVolume(hand.height));
    done.volume = true;
  }
  return done;
}
