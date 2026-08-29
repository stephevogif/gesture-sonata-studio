/**
 * Heaven Synth — voice builder.
 * Layer: Synth / Audio Engine.
 *
 * A `SynthVoice` realises one `PresetSpec` as a Web Audio graph:
 *
 *   partials -> filter -> [drive] -> voice gain -> engine buses
 *
 * Voices are reused per note slot (the engine keeps a map of them) and are
 * always torn down through `release()`, which schedules the oscillators to stop
 * after the tail so nothing can get stuck.
 */

import { clamp } from "@/core/music/pitch";
import type { InstrumentId, PresetSpec } from "./presets";

export type VoiceBuses = {
  dry: AudioNode;
  reverb?: AudioNode | undefined;
  delay?: AudioNode | undefined;
  chorus?: AudioNode | undefined;
};

function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const size = 1024;
  const curve = new Float32Array(new ArrayBuffer(size * 4));
  const k = amount * 100;
  for (let i = 0; i < size; i++) {
    const x = (i * 2) / size - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  return buffer;
}

export class SynthVoice {
  readonly instrument: InstrumentId;
  private readonly ctx: AudioContext;
  private readonly spec: PresetSpec;
  private readonly gain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly oscillators: OscillatorNode[] = [];
  private readonly ratios: number[] = [];
  private readonly extras: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private readonly vibratoDepth: GainNode;
  private noiseGain: GainNode | null = null;
  private cutoffLfo: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private fmDepth: GainNode | null = null;
  private stopped = false;

  constructor(ctx: AudioContext, spec: PresetSpec, frequency: number, buses: VoiceBuses) {
    this.ctx = ctx;
    this.spec = spec;
    this.instrument = spec.id;
    const now = ctx.currentTime;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = spec.filter.type;
    this.filter.frequency.value = spec.filter.cutoff;
    this.filter.Q.value = spec.filter.q;

    // shared vibrato bus, modulating every partial's detune
    const vibrato = ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = spec.vibrato.rate;
    this.vibratoDepth = ctx.createGain();
    this.vibratoDepth.gain.value = spec.vibrato.cents;
    vibrato.connect(this.vibratoDepth);
    vibrato.start(now);
    this.extras.push(vibrato);

    spec.partials.forEach((partial, index) => {
      const osc = ctx.createOscillator();
      const ratio = partial.ratio ?? 1;
      osc.type = partial.wave;
      osc.frequency.value = frequency * ratio;
      osc.detune.value = partial.detune ?? 0;
      this.baseDetunes.push(partial.detune ?? 0);

      const level = ctx.createGain();
      level.gain.value = partial.level;
      osc.connect(level).connect(this.filter);
      this.vibratoDepth.connect(osc.detune);
      osc.start(now);
      this.oscillators.push(osc);
      this.ratios.push(ratio);

      if (index === 0 && spec.fm) {
        const modulator = ctx.createOscillator();
        modulator.type = "sine";
        modulator.frequency.value = frequency * spec.fm.ratio;
        const depth = ctx.createGain();
        depth.gain.value = frequency * spec.fm.index;
        modulator.connect(depth).connect(osc.frequency);
        modulator.start(now);
        this.extras.push(modulator);
        this.fmDepth = depth;
      }

      if (index === 0 && spec.pitchDrop) {
        osc.frequency.setValueAtTime(frequency * spec.pitchDrop.from, now);
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, frequency),
          now + spec.pitchDrop.seconds,
        );
      }
    });

    if (spec.noise) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      source.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = frequency * spec.noise.ratio;
      band.Q.value = spec.noise.q;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = spec.noise.level;
      source.connect(band).connect(this.noiseGain).connect(this.filter);
      source.start(now);
      this.extras.push(source);
    }

    if (spec.cutoffLfo) {
      const lfo = ctx.createOscillator();
      lfo.type = spec.cutoffLfo.wave;
      lfo.frequency.value = spec.cutoffLfo.rate;
      const depth = ctx.createGain();
      depth.gain.value = spec.cutoffLfo.depth;
      lfo.connect(depth).connect(this.filter.frequency);
      lfo.start(now);
      this.cutoffLfo = lfo;
      this.extras.push(lfo);
    }

    if (spec.drive) {
      const shaper = ctx.createWaveShaper();
      shaper.oversample = "4x";
      shaper.curve = saturationCurve(spec.drive.amount);
      const trim = ctx.createGain();
      trim.gain.value = spec.drive.level;
      this.filter.connect(shaper).connect(trim).connect(this.gain);
    } else {
      this.filter.connect(this.gain);
    }

    if (spec.subOctave) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = frequency / 2;
      const level = ctx.createGain();
      level.gain.value = spec.subOctave;
      sub.connect(level).connect(this.gain);
      sub.start(now);
      this.sub = sub;
      this.extras.push(sub);
    }

    this.gain.connect(buses.dry);
    if (!spec.bass && buses.reverb) this.gain.connect(buses.reverb);
    if (buses.delay) this.gain.connect(buses.delay);
    if (buses.chorus) this.gain.connect(buses.chorus);
  }

  /** headroom: bass patches are allowed to be louder, everything else stays clean */
  private get peak() {
    return this.spec.bass ? 0.5 : 0.34;
  }

  private retune(frequency: number, glideSeconds: number) {
    const now = this.ctx.currentTime;
    this.oscillators.forEach((osc, index) => {
      osc.frequency.setTargetAtTime(frequency * (this.ratios[index] ?? 1), now, glideSeconds);
    });
    this.sub?.frequency.setTargetAtTime(frequency / 2, now, glideSeconds);
    if (this.fmDepth && this.spec.fm) {
      this.fmDepth.gain.setTargetAtTime(frequency * this.spec.fm.index, now, glideSeconds);
    }
  }

  /** Sustained note: swell to `amount`, then hold (or decay for plucky patches).
   *  `glide` overrides the preset portamento (legato speed) when provided. */
  hold(frequency: number, amount: number, brightness: number, glide?: number) {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.retune(frequency, glide ?? this.spec.glide);
    const target = clamp(amount, 0, 1) * this.peak;
    const { sustain, decay, attack } = this.spec.env;
    const gain = this.gain.gain;
    if (sustain !== undefined) {
      if (gain.value < target * 0.35) gain.setTargetAtTime(target, now, attack);
      else gain.setTargetAtTime(target * sustain, now, decay ?? 0.5);
    } else {
      gain.setTargetAtTime(target, now, attack);
    }
    this.shape(brightness, amount, now);
  }

  /** Retriggered note with an explicit gate length, used by the arpeggiator. */
  strike(frequency: number, amount: number, brightness: number, gateSeconds: number) {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    this.retune(frequency, 0);
    const gain = this.gain.gain;
    const target = clamp(amount, 0, 1) * this.peak;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(target, now + Math.min(0.02, gateSeconds * 0.2));
    gain.linearRampToValueAtTime(0.0001, now + gateSeconds);
    this.shape(brightness, amount, now);
  }

  /** Expression: brightness opens the voice filter, amount feeds the breath noise. */
  private shape(brightness: number, amount: number, now: number) {
    const b = clamp(brightness, 0, 1);
    if (this.spec.bass) {
      this.filter.frequency.setTargetAtTime(120 + b * 2600, now, 0.05);
      this.cutoffLfo?.frequency.setTargetAtTime(1.5 + b * 9, now, 0.1);
    } else {
      this.filter.frequency.setTargetAtTime(400 + b * 5200, now, 0.1);
    }
    this.noiseGain?.gain.setTargetAtTime(0.02 + clamp(amount, 0, 1) * 0.08, now, 0.1);
  }

  /** Fades out and schedules the whole graph to stop; safe to call twice. */
  release() {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    const { release } = this.spec.env;
    const gain = this.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.setTargetAtTime(0, now, release / 3);
    const stopAt = now + release + 1.2;
    [...this.oscillators, ...this.extras].forEach((node) => {
      try {
        node.stop(stopAt);
      } catch {
        /* already stopped */
      }
    });
    window.setTimeout(
      () => {
        try {
          this.gain.disconnect();
        } catch {
          /* already disconnected */
        }
      },
      (release + 1.4) * 1000,
    );
  }
}
