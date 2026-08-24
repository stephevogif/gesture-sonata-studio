/**
 * Heaven Synth — instrument channel.
 * Layer: Audio routing.
 *
 *   voices ─► channel input ─► instrument FX chain ─► channel gain ─► master bus
 *
 * One channel per layered instrument (max 4). The channel owns its own FX chain
 * so instrument effects never touch the rest of the mix.
 */

import { clamp } from "@/core/music/pitch";
import type { InstrumentId } from "./presets";
import { FxChain, type FxSpec } from "./fx";

export class InstrumentChannel {
  readonly input: GainNode;
  private readonly out: GainNode;
  private readonly chain: FxChain;

  constructor(
    private readonly ctx: AudioContext,
    public instrument: InstrumentId,
    master: AudioNode,
    gain = 0.8,
  ) {
    this.input = ctx.createGain();
    this.out = ctx.createGain();
    this.out.gain.value = clamp(gain, 0, 1);
    this.chain = new FxChain(ctx, this.input, this.out);
    this.out.connect(master);
  }

  /** smooth gain, no clicks */
  setGain(value: number) {
    this.out.gain.setTargetAtTime(clamp(value, 0, 1), this.ctx.currentTime, 0.06);
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
