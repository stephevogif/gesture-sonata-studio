/**
 * Heaven Synth — instrument channel.
 * Layer: Audio routing.
 *
 *   voices ─► channel input ─► instrument FX chain ─► channel gain ─┬─► master bus
 *                                                                   └─► master sends
 *
 * One channel per layered instrument (max 4). The channel owns its own FX chain
 * so instrument effects never touch the rest of the mix; only the shared master
 * sends (reverb / delay / chorus) and the master FX chain are global.
 */

import { clamp } from "@/core/music/pitch";
import type { InstrumentId } from "./presets";
import { FxChain, type FxSpec } from "./fx";

export type MasterSends = {
  reverb: AudioNode;
  delay: AudioNode;
  chorus: AudioNode;
};

export class InstrumentChannel {
  readonly input: GainNode;
  private readonly out: GainNode;
  private readonly chain: FxChain;
  private gainValue: number;

  constructor(
    private readonly ctx: AudioContext,
    public instrument: InstrumentId,
    master: AudioNode,
    gain = 0.8,
    sends?: MasterSends,
  ) {
    this.input = ctx.createGain();
    this.out = ctx.createGain();
    this.gainValue = clamp(gain, 0, 1);
    this.out.gain.value = this.gainValue;
    this.chain = new FxChain(ctx, this.input, this.out);
    this.out.connect(master);
    if (sends) {
      this.out.connect(sends.reverb);
      this.out.connect(sends.delay);
      this.out.connect(sends.chorus);
    }
  }

  /** smooth gain, no clicks; skips redundant scheduling during drags */
  setGain(value: number) {
    const next = clamp(value, 0, 1);
    if (Math.abs(next - this.gainValue) < 0.0005) return;
    this.gainValue = next;
    this.out.gain.setTargetAtTime(next, this.ctx.currentTime, 0.06);
  }

  syncFx(specs: FxSpec[], bpm: number) {
    this.chain.sync(specs, bpm);
  }

  setTempo(bpm: number) {
    this.chain.setTempo(bpm);
  }

  dispose() {
    this.chain.dispose();
    try {
      this.input.disconnect();
      this.out.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
