/**
 * Heaven Synth — insert effect units + effect chains.
 * Layer: Effects (clean-room, no DSP inside React).
 *
 * Every unit is an insert with an internal dry/wet crossfade:
 *
 *   input ─┬─► dry ──────────────┬─► output
 *          └─► wet chain ─► wet ─┘
 *
 * `amount` is always 0..1 and means "how much of this effect", so the UI can
 * map a single distance to it. Chains are reconciled from declarative specs
 * (`FxChain.sync`) so the audio graph is only rebuilt when the list changes.
 */

import { clamp } from "@/core/music/pitch";
import { gatePreset, type GatePresetId } from "./gatePresets";

export type FxTypeId = "reverb" | "delay" | "chorus" | "filter" | "distortion" | "tremolo" | "gate";

export type FxSpec = {
  id: string;
  type: FxTypeId;
  amount: number;
  params: Record<string, number>;
  preset?: GatePresetId;
  bypass?: boolean;
};

export type FxUnit = {
  readonly type: FxTypeId;
  readonly input: GainNode;
  readonly output: GainNode;
  setAmount: (value: number) => void;
  setParam: (id: string, value: number) => void;
  setPreset: (id: string) => void;
  setTempo: (bpm: number) => void;
  dispose: () => void;
};

const SMOOTH = 0.05;

type Shell = {
  input: GainNode;
  output: GainNode;
  dry: GainNode;
  wet: GainNode;
  wetIn: GainNode;
};

function shell(ctx: AudioContext): Shell {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const wetIn = ctx.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0;
  input.connect(dry).connect(output);
  input.connect(wetIn);
  wet.connect(output);
  return { input, output, dry, wet, wetIn };
}

function crossfade(ctx: AudioContext, s: Shell, amount: number, keepDry = true) {
  const a = clamp(amount, 0, 1);
  const now = ctx.currentTime;
  s.wet.gain.setTargetAtTime(a, now, SMOOTH);
  s.dry.gain.setTargetAtTime(keepDry ? 1 - a * 0.85 : 1 - a, now, SMOOTH);
}

/**
 * Waveshaper curves are expensive to build, so they are cached per 5% step:
 * dragging the Drive knob reuses a curve instead of allocating one per frame.
 */
const SAT_CACHE = new Map<number, Float32Array<ArrayBuffer>>();

function saturation(amount: number): Float32Array<ArrayBuffer> {
  const step = Math.round(clamp(amount, 0, 1) * 20);
  const cached = SAT_CACHE.get(step);
  if (cached) return cached;
  const size = 1024;
  const curve = new Float32Array(new ArrayBuffer(size * 4));
  const k = (step / 20) * 120;
  for (let i = 0; i < size; i++) {
    const x = (i * 2) / size - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  SAT_CACHE.set(step, curve);
  return curve;
}

/* ————— units ————— */

function createReverb(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const early = ctx.createDelay(1);
  early.delayTime.value = 0.19;
  const late = ctx.createDelay(1);
  late.delayTime.value = 0.31;
  const tail = ctx.createGain();
  tail.gain.value = 0.36;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2800;
  s.wetIn.connect(early).connect(damp).connect(tail).connect(early);
  s.wetIn.connect(late).connect(damp);
  early.connect(s.wet);
  late.connect(s.wet);
  return {
    type: "reverb",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v),
    setParam: (id, v) => {
      const now = ctx.currentTime;
      if (id === "size") {
        early.delayTime.setTargetAtTime(clamp(v, 0.05, 0.6), now, 0.1);
        late.delayTime.setTargetAtTime(clamp(v * 1.7, 0.05, 0.95), now, 0.1);
      }
      if (id === "decay") tail.gain.setTargetAtTime(clamp(v, 0, 0.7), now, 0.1);
      if (id === "tone") damp.frequency.setTargetAtTime(clamp(v, 300, 12000), now, 0.1);
    },
    setPreset: () => {},
    setTempo: () => {},
    dispose: () => {
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

function createDelay(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const left = ctx.createDelay(2);
  const right = ctx.createDelay(2);
  left.delayTime.value = 0.3;
  right.delayTime.value = 0.3;
  const panL = ctx.createStereoPanner();
  panL.pan.value = -0.6;
  const panR = ctx.createStereoPanner();
  panR.pan.value = 0.6;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3200;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  s.wetIn.connect(left);
  left.connect(panL).connect(s.wet);
  left.connect(right);
  right.connect(panR).connect(s.wet);
  right.connect(tone).connect(fb).connect(left);
  let bpm = 100;
  let syncBeats = 0;
  const applyTime = (seconds: number) => {
    const now = ctx.currentTime;
    const t = clamp(seconds, 0.02, 1.9);
    left.delayTime.setTargetAtTime(t, now, 0.08);
    right.delayTime.setTargetAtTime(t, now, 0.08);
  };
  return {
    type: "delay",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v),
    setParam: (id, v) => {
      if (id === "time") {
        syncBeats = 0;
        applyTime(v);
      }
      if (id === "sync") {
        syncBeats = v;
        if (v > 0) applyTime((60 / bpm) * v);
      }
      if (id === "feedback") fb.gain.setTargetAtTime(clamp(v, 0, 0.85), ctx.currentTime, 0.06);
      if (id === "tone") tone.frequency.setTargetAtTime(clamp(v, 300, 12000), ctx.currentTime, 0.1);
    },
    setPreset: () => {},
    setTempo: (value) => {
      bpm = value;
      if (syncBeats > 0) applyTime((60 / bpm) * syncBeats);
    },
    dispose: () => {
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

function createChorus(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const dL = ctx.createDelay(0.1);
  dL.delayTime.value = 0.017;
  const dR = ctx.createDelay(0.1);
  dR.delayTime.value = 0.023;
  const panL = ctx.createStereoPanner();
  panL.pan.value = -0.75;
  const panR = ctx.createStereoPanner();
  panR.pan.value = 0.75;
  const lfoL = ctx.createOscillator();
  lfoL.frequency.value = 0.5;
  const lfoR = ctx.createOscillator();
  lfoR.frequency.value = 0.37;
  const depthL = ctx.createGain();
  depthL.gain.value = 0.004;
  const depthR = ctx.createGain();
  depthR.gain.value = 0.0034;
  lfoL.connect(depthL).connect(dL.delayTime);
  lfoR.connect(depthR).connect(dR.delayTime);
  lfoL.start();
  lfoR.start();
  s.wetIn.connect(dL).connect(panL).connect(s.wet);
  s.wetIn.connect(dR).connect(panR).connect(s.wet);
  return {
    type: "chorus",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v),
    setParam: (id, v) => {
      const now = ctx.currentTime;
      if (id === "depth") {
        const d = clamp(v, 0, 1) * 0.006 + 0.0008;
        depthL.gain.setTargetAtTime(d, now, 0.08);
        depthR.gain.setTargetAtTime(d * 0.85, now, 0.08);
      }
      if (id === "rate") {
        const r = clamp(v, 0.05, 6);
        lfoL.frequency.setTargetAtTime(r, now, 0.1);
        lfoR.frequency.setTargetAtTime(r * 0.74, now, 0.1);
      }
    },
    setPreset: () => {},
    setTempo: () => {},
    dispose: () => {
      try {
        lfoL.stop();
        lfoR.stop();
      } catch {
        /* already stopped */
      }
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

function createFilter(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const biquad = ctx.createBiquadFilter();
  biquad.type = "lowpass";
  biquad.frequency.value = 2400;
  biquad.Q.value = 4;
  s.wetIn.connect(biquad).connect(s.wet);
  return {
    type: "filter",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v, false),
    setParam: (id, v) => {
      const now = ctx.currentTime;
      if (id === "cutoff") biquad.frequency.setTargetAtTime(clamp(v, 80, 16000), now, 0.06);
      if (id === "resonance") biquad.Q.setTargetAtTime(clamp(v, 0.1, 20), now, 0.06);
      if (id === "mode") biquad.type = v > 0.5 ? "highpass" : "lowpass";
    },
    setPreset: () => {},
    setTempo: () => {},
    dispose: () => {
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

function createDistortion(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const shaper = ctx.createWaveShaper();
  shaper.oversample = "4x";
  shaper.curve = saturation(0.4);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 6000;
  const trim = ctx.createGain();
  trim.gain.value = 0.55;
  s.wetIn.connect(shaper).connect(tone).connect(trim).connect(s.wet);
  return {
    type: "distortion",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v),
    setParam: (id, v) => {
      if (id === "drive") shaper.curve = saturation(v);
      if (id === "tone") tone.frequency.setTargetAtTime(clamp(v, 400, 12000), ctx.currentTime, 0.1);
      if (id === "level") trim.gain.setTargetAtTime(clamp(v, 0.05, 1), ctx.currentTime, 0.06);
    },
    setPreset: () => {},
    setTempo: () => {},
    dispose: () => {
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

function createTremolo(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const vca = ctx.createGain();
  vca.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 4;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(vca.gain);
  lfo.start();
  s.wetIn.connect(vca).connect(s.wet);
  return {
    type: "tremolo",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v, false),
    setParam: (id, v) => {
      const now = ctx.currentTime;
      if (id === "rate") lfo.frequency.setTargetAtTime(clamp(v, 0.1, 16), now, 0.08);
      if (id === "depth") depth.gain.setTargetAtTime(clamp(v, 0, 1) * 0.9, now, 0.08);
    },
    setPreset: () => {},
    setTempo: () => {},
    dispose: () => {
      try {
        lfo.stop();
      } catch {
        /* already stopped */
      }
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
    },
  };
}

/**
 * GATE — rhythmic pattern gating with a small lookahead scheduler.
 * Patterns are declarative (see `gatePresets.ts`) and follow the musical clock.
 */
function createGate(ctx: AudioContext): FxUnit {
  const s = shell(ctx);
  const vca = ctx.createGain();
  vca.gain.value = 1;
  s.wetIn.connect(vca).connect(s.wet);

  let preset = gatePreset("pulse");
  let bpm = 100;
  let depth = 1;
  let attack = preset.attack;
  let release = preset.release;
  let rateScale = 1;
  let nextTime = ctx.currentTime;
  let stepIndex = 0;

  const stepSeconds = () => Math.max(0.03, (60 / bpm) * preset.beats * rateScale);

  const schedule = () => {
    const horizon = ctx.currentTime + 0.35;
    if (nextTime < ctx.currentTime) {
      nextTime = ctx.currentTime + 0.02;
      stepIndex = 0;
    }
    while (nextTime < horizon) {
      const step = preset.steps[stepIndex % preset.steps.length] ?? 1;
      const level = 1 - depth * (1 - clamp(step, 0, 1));
      const dur = stepSeconds();
      const rise = Math.min(attack, dur * 0.4);
      const fall = Math.min(release, dur * 0.45);
      vca.gain.setTargetAtTime(level, nextTime, Math.max(0.002, rise / 3));
      vca.gain.setTargetAtTime(level, nextTime + dur - fall, Math.max(0.002, fall / 3));
      nextTime += dur;
      stepIndex += 1;
    }
  };

  const timer = window.setInterval(schedule, 90);
  schedule();

  return {
    type: "gate",
    input: s.input,
    output: s.output,
    setAmount: (v) => crossfade(ctx, s, v, false),
    setParam: (id, v) => {
      if (id === "depth") depth = clamp(v, 0, 1);
      if (id === "rate") rateScale = clamp(v, 0.25, 4);
      if (id === "attack") attack = clamp(v, 0.001, 0.5);
      if (id === "release") release = clamp(v, 0.005, 1.2);
    },
    setPreset: (id) => {
      const next = gatePreset(id as GatePresetId);
      if (next.id === preset.id) return;
      preset = next;
      attack = next.attack;
      release = next.release;
      stepIndex = 0;
      nextTime = ctx.currentTime + 0.02;
    },
    setTempo: (value) => {
      bpm = clamp(value, 40, 220);
    },
    dispose: () => {
      window.clearInterval(timer);
      s.input.disconnect();
      s.output.disconnect();
      s.wetIn.disconnect();
      vca.disconnect();
    },
  };
}

export function createFxUnit(ctx: AudioContext, type: FxTypeId): FxUnit {
  switch (type) {
    case "reverb":
      return createReverb(ctx);
    case "delay":
      return createDelay(ctx);
    case "chorus":
      return createChorus(ctx);
    case "filter":
      return createFilter(ctx);
    case "distortion":
      return createDistortion(ctx);
    case "tremolo":
      return createTremolo(ctx);
    case "gate":
      return createGate(ctx);
  }
}

/* ————— chain ————— */

/**
 * Reconciles a declarative list of effects into a serial insert chain between
 * `input` and `output`. Only structural changes rewire the graph.
 */
export class FxChain {
  private units = new Map<string, FxUnit>();
  private order: string[] = [];
  private bpm = 100;

  constructor(
    private readonly ctx: AudioContext,
    private readonly input: AudioNode,
    private readonly output: AudioNode,
  ) {
    this.rewire();
  }

  sync(specs: FxSpec[], bpm = this.bpm) {
    this.bpm = bpm;
    const ids = specs.map((s) => s.id);
    for (const [id, unit] of [...this.units]) {
      if (!ids.includes(id)) {
        unit.dispose();
        this.units.delete(id);
      }
    }
    for (const spec of specs) {
      let unit = this.units.get(spec.id);
      if (unit && unit.type !== spec.type) {
        unit.dispose();
        this.units.delete(spec.id);
        unit = undefined;
      }
      if (!unit) {
        unit = createFxUnit(this.ctx, spec.type);
        this.units.set(spec.id, unit);
      }
      unit.setTempo(bpm);
      if (spec.preset) unit.setPreset(spec.preset);
      for (const [key, value] of Object.entries(spec.params)) unit.setParam(key, value);
      unit.setAmount(spec.bypass ? 0 : spec.amount);
    }
    const changed =
      ids.length !== this.order.length || ids.some((id, index) => this.order[index] !== id);
    if (changed) {
      this.order = ids;
      this.rewire();
    }
  }

  setTempo(bpm: number) {
    this.bpm = bpm;
    this.units.forEach((u) => u.setTempo(bpm));
  }

  private rewire() {
    try {
      this.input.disconnect();
    } catch {
      /* nothing connected */
    }
    this.units.forEach((u) => {
      try {
        u.output.disconnect();
      } catch {
        /* nothing connected */
      }
    });
    let node: AudioNode = this.input;
    for (const id of this.order) {
      const unit = this.units.get(id);
      if (!unit) continue;
      node.connect(unit.input);
      node = unit.output;
    }
    node.connect(this.output);
  }

  dispose() {
    this.units.forEach((u) => u.dispose());
    this.units.clear();
    this.order = [];
    try {
      this.input.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
