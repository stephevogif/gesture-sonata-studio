/**
 * Heaven Synth — master effects rack.
 * Layer: Effects.
 *
 *   voices ──┬─────────────────────────────► master ─► EQ ─► analyser ─► out
 *            ├─► reverb send (dual delay + damping) ─┘
 *            └─► ping-pong delay send ────────────────┘
 *
 * The rack owns every shared node so the engine never touches raw Web Audio
 * plumbing, and so the visualiser can read a single analyser.
 */

import { clamp } from "@/core/music/pitch";

export type ReverbSettings = { amount: number };

export type DelaySettings = {
  mix: number;
  feedback: number;
  time: number;
};

export type EqSettings = {
  type: BiquadFilterType;
  frequency: number;
  q: number;
};

export type ChorusSettings = {
  mix: number;
  depth: number;
  rate: number;
};

export class MasterRack {
  readonly master: GainNode;
  readonly reverbSend: GainNode;
  readonly delaySend: GainNode;
  readonly chorusSend: GainNode;
  readonly analyser: AnalyserNode;
  private readonly eq: BiquadFilterNode;
  private readonly delayL: DelayNode;
  private readonly delayR: DelayNode;
  private readonly delayFeedback: GainNode;
  private readonly chorusLfoL: OscillatorNode;
  private readonly chorusLfoR: OscillatorNode;
  private readonly chorusDepthL: GainNode;
  private readonly chorusDepthR: GainNode;

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.eq = ctx.createBiquadFilter();
    this.eq.type = "lowpass";
    this.eq.frequency.value = 12000;
    this.eq.Q.value = 0.7;

    // ——— reverb: two detuned feedback delays through a damping low-pass ———
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    const early = ctx.createDelay(1);
    early.delayTime.value = 0.19;
    const late = ctx.createDelay(1);
    late.delayTime.value = 0.31;
    const tail = ctx.createGain();
    tail.gain.value = 0.35;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2600;
    this.reverbSend.connect(early).connect(damp).connect(tail).connect(early);
    this.reverbSend.connect(late).connect(damp);
    early.connect(this.master);
    late.connect(this.master);

    // ——— ping-pong delay ———
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.25;
    this.delayL = ctx.createDelay(2);
    this.delayR = ctx.createDelay(2);
    this.delayL.delayTime.value = 0.3;
    this.delayR.delayTime.value = 0.3;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.65;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.65;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;

    this.delaySend.connect(this.delayL);
    this.delayL.connect(panL).connect(this.master);
    this.delayL.connect(this.delayR);
    this.delayR.connect(panR).connect(this.master);
    this.delayR.connect(tone).connect(this.delayFeedback).connect(this.delayL);

    this.master.connect(this.eq).connect(this.analyser).connect(ctx.destination);
  }

  setReverb({ amount }: ReverbSettings) {
    this.reverbSend.gain.setTargetAtTime(clamp(amount, 0, 1), this.ctx.currentTime, 0.05);
  }

  setDelay({ mix, feedback, time }: DelaySettings) {
    const now = this.ctx.currentTime;
    this.delaySend.gain.setTargetAtTime(clamp(mix, 0, 1), now, 0.05);
    this.delayFeedback.gain.setTargetAtTime(clamp(feedback, 0, 0.85), now, 0.05);
    const seconds = clamp(time, 0.02, 1.9);
    this.delayL.delayTime.setTargetAtTime(seconds, now, 0.08);
    this.delayR.delayTime.setTargetAtTime(seconds, now, 0.08);
  }

  setEq({ type, frequency, q }: EqSettings) {
    const now = this.ctx.currentTime;
    this.eq.type = type;
    this.eq.frequency.setTargetAtTime(clamp(frequency, 60, 18000), now, 0.06);
    this.eq.Q.setTargetAtTime(clamp(q, 0.1, 24), now, 0.05);
  }
}
