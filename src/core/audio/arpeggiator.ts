/**
 * Heaven Synth — arpeggiator clock.
 * Layer: Synth / Audio Engine (sequencing).
 *
 * The arpeggiator keeps one "target" per playing hand: the hand supplies the
 * degree and expression, the clock decides which note of the pattern is due.
 * It is deliberately independent from the audio graph — it only calls back with
 * (voiceId, degreeOffset, octaveOffset, gateSeconds).
 */

import { clamp } from "@/core/music/pitch";
import type { DivisionId } from "@/core/music/patterns";
import { divisionSeconds } from "@/core/music/patterns";
import type { InstrumentId } from "./presets";

export type ArpTarget = {
  degree: number;
  amount: number;
  brightness: number;
  instrument: InstrumentId;
  step: number;
};

export type ArpEvent = {
  id: string;
  target: ArpTarget;
  degreeOffset: number;
  octaveOffset: number;
  gateSeconds: number;
};

export type ArpSettings = {
  enabled: boolean;
  /** notes per second when not synced to the tempo */
  rate: number;
  sync: boolean;
  division: DivisionId;
  degrees: number[];
  random: boolean;
  gate: number;
  octaves: number;
  swing: number;
};

export class Arpeggiator {
  readonly targets = new Map<string, ArpTarget>();
  settings: ArpSettings = {
    enabled: false,
    rate: 8,
    sync: true,
    division: "1/8",
    degrees: [0, 1, 2, 3],
    random: false,
    gate: 0.9,
    octaves: 1,
    swing: 0,
  };

  private timer: ReturnType<typeof setTimeout> | null = null;
  private tick = 0;
  private bpm = 100;

  constructor(private readonly emit: (event: ArpEvent) => void) {}

  /** notes per second at the current tempo/division */
  rateHz(): number {
    return this.settings.sync
      ? 1 / divisionSeconds(this.settings.division, this.bpm)
      : Math.max(1, this.settings.rate);
  }

  setTempo(bpm: number) {
    this.bpm = bpm;
    this.restart();
  }

  update(patch: Partial<ArpSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.settings.gate = clamp(this.settings.gate, 0.05, 1.5);
    this.settings.octaves = clamp(Math.round(this.settings.octaves), 1, 3);
    this.settings.swing = clamp(this.settings.swing, 0, 0.6);
    this.restart();
  }

  setTarget(id: string, target: Omit<ArpTarget, "step">) {
    const previous = this.targets.get(id);
    this.targets.set(id, { ...target, step: previous?.step ?? 0 });
  }

  clearTarget(id: string): boolean {
    return this.targets.delete(id);
  }

  clear() {
    this.targets.clear();
  }

  /** (Re)starts the clock; safe to call whenever settings change. */
  restart() {
    this.stop();
    if (!this.settings.enabled) return;
    this.tick = 0;
    const schedule = () => {
      const base = 1000 / this.rateHz();
      const swing = this.settings.swing;
      const period =
        swing > 0 ? (this.tick % 2 === 0 ? base * (1 + swing) : base * (1 - swing)) : base;
      this.tick += 1;
      this.fire(period / 1000);
      this.timer = setTimeout(schedule, period);
    };
    this.timer = setTimeout(schedule, 1000 / this.rateHz());
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private fire(periodSeconds: number) {
    const sequence = this.settings.degrees.length ? this.settings.degrees : [0];
    this.targets.forEach((target, id) => {
      const degreeOffset = this.settings.random
        ? (sequence[Math.floor(Math.random() * sequence.length)] ?? 0)
        : (sequence[target.step % sequence.length] ?? 0);
      const octaveOffset =
        this.settings.octaves > 1
          ? Math.floor(target.step / sequence.length) % this.settings.octaves
          : 0;
      target.step += 1;
      this.emit({
        id,
        target,
        degreeOffset,
        octaveOffset,
        gateSeconds: periodSeconds * this.settings.gate,
      });
    });
  }
}
