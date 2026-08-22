export type InstrumentId =
  | "violin"
  | "winds"
  | "pads"
  | "reese"
  | "acid"
  | "growl"
  | "harp"
  | "piano"
  | "kalimba"
  | "bowl"
  | "glocken"
  | "choir"
  | "pluckAmb"
  | "subpad";

export type InstrumentGroup = "zen" | "electro";

export const INSTRUMENTS: {
  id: InstrumentId;
  name: string;
  blurb: string;
  group: InstrumentGroup;
}[] = [
  { id: "harp", name: "Arpa di cristallo", blurb: "Pizzicato brillante, coda lunga", group: "zen" },
  { id: "piano", name: "Pianoforte notturno", blurb: "Feltro morbido, attacco dolce", group: "zen" },
  { id: "kalimba", name: "Kalimba", blurb: "Pizzicato legnoso, meditativo", group: "zen" },
  { id: "bowl", name: "Campane tibetane", blurb: "Metallo profondo, note infinite", group: "zen" },
  { id: "glocken", name: "Glockenspiel", blurb: "Cristallino e luminoso", group: "zen" },
  { id: "choir", name: "Coro etereo", blurb: "Voci ampie e riverberate", group: "zen" },
  { id: "violin", name: "Violino", blurb: "Archi espressivi con vibrato", group: "zen" },
  { id: "winds", name: "Fiati", blurb: "Legni ariosi e soffiati", group: "zen" },
  { id: "pads", name: "Pads", blurb: "Tappeti ampi e riverberati", group: "zen" },
  { id: "pluckAmb", name: "Ambient pluck", blurb: "Pluck digitale downtempo", group: "electro" },
  { id: "subpad", name: "Warm sub pad", blurb: "Basso morbido e continuo", group: "electro" },
  { id: "reese", name: "Reese Bass", blurb: "Basso detunato, sporco e profondo", group: "electro" },
  { id: "acid", name: "Acid 303", blurb: "Squelch acido con filtro urlante", group: "electro" },
  { id: "growl", name: "Growl / Dubstep", blurb: "Wobble aggressivo e distorto", group: "electro" },
];

/** Semitone transpose per instrument (bass patches play way lower). */
export const INSTRUMENT_SHIFT: Record<InstrumentId, number> = {
  violin: 0,
  winds: 0,
  pads: 0,
  reese: -24,
  acid: -12,
  growl: -24,
  harp: 12,
  piano: 0,
  kalimba: 12,
  bowl: 0,
  glocken: 24,
  choir: 0,
  pluckAmb: 12,
  subpad: -12,
};


export type ScaleId =
  | "minorPent"
  | "majorPent"
  | "naturalMinor"
  | "harmonicMinor"
  | "phrygian"
  | "dorian"
  | "major"
  | "blues"
  | "chromatic";

export const SCALES: { id: ScaleId; name: string; steps: number[] }[] = [
  { id: "minorPent", name: "Pentatonica minore", steps: [0, 3, 5, 7, 10] },
  { id: "majorPent", name: "Pentatonica maggiore", steps: [0, 2, 4, 7, 9] },
  { id: "naturalMinor", name: "Minore naturale", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "harmonicMinor", name: "Minore armonica", steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: "phrygian", name: "Frigia", steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: "dorian", name: "Dorica", steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: "major", name: "Maggiore", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "blues", name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
  { id: "chromatic", name: "Cromatica", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function scaleSteps(id: ScaleId): number[] {
  return SCALES.find((s) => s.id === id)?.steps ?? [0, 3, 5, 7, 10];
}

/** degree index (can exceed scale length -> wraps up an octave) to semitones */
export function degreeToSemitones(steps: number[], degree: number): number {
  const len = steps.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return (steps[idx] ?? 0) + oct * 12;
}

const BASE_OCTAVE_MIDI = 48; // C3

export function positionToDegree(x: number, steps = 21): number {
  return Math.min(steps - 1, Math.max(0, Math.round(x * (steps - 1))));
}

export function degreeToMidi(
  degree: number,
  scale: number[],
  rootPc: number,
  shift = 0,
): number {
  return BASE_OCTAVE_MIDI + rootPc + shift + degreeToSemitones(scale, degree);
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function midiToName(m: number): string {
  return `${NOTE_NAMES[((m % 12) + 12) % 12] ?? "C"}${Math.floor(m / 12) - 1}`;
}

export type ArpPatternId = "up" | "down" | "updown" | "octaves" | "random";

export const ARP_PATTERNS: { id: ArpPatternId; name: string; degrees: number[] }[] = [
  { id: "up", name: "Su", degrees: [0, 1, 2, 3] },
  { id: "down", name: "Giù", degrees: [3, 2, 1, 0] },
  { id: "updown", name: "Su / Giù", degrees: [0, 1, 2, 3, 2, 1] },
  { id: "octaves", name: "Ottave", degrees: [0, 2, 5, 7] },
  { id: "random", name: "Random", degrees: [0, 1, 2, 3, 4, 5] },
];

type VoiceNodes = {
  oscs: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  vibrato: OscillatorNode;
  vibratoGain: GainNode;
  noise?: AudioBufferSourceNode | undefined;
  noiseGain?: GainNode | undefined;
  drive?: WaveShaperNode | undefined;
  driveGain?: GainNode | undefined;
  lfo?: OscillatorNode | undefined;
  lfoGain?: GainNode | undefined;
  sub?: OscillatorNode | undefined;
  isBass?: boolean | undefined;
  /** plucky patches decay toward this fraction of the peak while held */
  sustain?: number | undefined;
  /** time constant of the plucky decay */
  decay?: number | undefined;
  /** oscillator frequency ratios (index-aligned with oscs) */
  ratios: number[];
  inst: InstrumentId;
  attack: number;
  release: number;
};


type ArpTarget = {
  degree: number;
  amount: number;
  bright: number;
  inst: InstrumentId;
  step: number;
};

export class GestureSynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eq: BiquadFilterNode | null = null;
  reverbAmount = 0.35;
  eqType: BiquadFilterType = "lowpass";
  eqFreq = 12000;
  private voices = new Map<string, VoiceNodes>();
  private buildInst: InstrumentId = "violin";
  instrument: InstrumentId = "violin";

  // musical settings
  scale: number[] = scaleSteps("minorPent");
  rootPc = 2; // D

  // arpeggiator
  arpEnabled = false;
  arpRate = 8; // notes per second
  arpDegrees: number[] = ARP_PATTERNS[0]!.degrees;
  arpRandom = false;
  private arpTargets = new Map<string, ArpTarget>();
  private arpTimer: ReturnType<typeof setInterval> | null = null;

  async start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.9;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;

    const wet = ctx.createGain();
    wet.gain.value = this.reverbAmount;
    const d1 = ctx.createDelay(1);
    d1.delayTime.value = 0.19;
    const d2 = ctx.createDelay(1);
    d2.delayTime.value = 0.31;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2600;

    wet.connect(d1).connect(damp).connect(fb).connect(d1);
    wet.connect(d2).connect(damp);
    d1.connect(master);
    d2.connect(master);

    const eq = ctx.createBiquadFilter();
    eq.type = this.eqType;
    eq.frequency.value = this.eqFreq;
    eq.Q.value = 0.7;

    master.connect(eq).connect(analyser).connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.wet = wet;
    this.analyser = analyser;
    this.eq = eq;
    await ctx.resume();
    this.syncArpTimer();
  }

  getAnalyser() {
    return this.analyser;
  }

  private makeNoise(ctx: AudioContext) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  private makeCurve(amount: number) {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = amount * 100;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  private buildVoice(freq: number): VoiceNodes {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const inst = this.buildInst;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1;

    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.type = "sine";

    const oscs: OscillatorNode[] = [];
    const ratios: number[] = [];
    let noise: AudioBufferSourceNode | undefined;
    let noiseGain: GainNode | undefined;
    let attack = 0.12;
    let release = 0.25;
    let drive: WaveShaperNode | undefined;
    let driveGain: GainNode | undefined;
    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;
    let sub: OscillatorNode | undefined;
    let sustain: number | undefined;
    let decay: number | undefined;
    const bassPatches: InstrumentId[] = ["reese", "acid", "growl"];
    const isBass = bassPatches.includes(inst);

    const addOsc = (type: OscillatorType, detune = 0, level = 1, ratio = 1) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * ratio;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(filter);
      vibratoGain.connect(o.detune);
      oscs.push(o);
      ratios.push(ratio);
      return o;
    };


    if (inst === "violin") {
      addOsc("sawtooth", 0, 0.55);
      addOsc("sawtooth", 7, 0.35);
      filter.frequency.value = 2600;
      filter.Q.value = 3;
      vibrato.frequency.value = 5.6;
      vibratoGain.gain.value = 16;
      attack = 0.14;
      release = 0.28;
    } else if (inst === "winds") {
      addOsc("triangle", 0, 0.6);
      addOsc("sine", -5, 0.4);
      filter.frequency.value = 1800;
      vibrato.frequency.value = 4.4;
      vibratoGain.gain.value = 8;
      attack = 0.09;
      release = 0.2;
      noise = this.makeNoise(ctx);
      noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.05;
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = freq * 2;
      nf.Q.value = 0.8;
      noise.connect(nf).connect(noiseGain).connect(filter);
      noise.start(now);
    } else if (isBass) {
      drive = ctx.createWaveShaper();
      driveGain = ctx.createGain();
      drive.oversample = "4x";

      if (inst === "reese") {
        addOsc("sawtooth", -14, 0.5);
        addOsc("sawtooth", 14, 0.5);
        addOsc("sawtooth", 0, 0.35);
        filter.type = "lowpass";
        filter.frequency.value = 900;
        filter.Q.value = 6;
        drive.curve = this.makeCurve(0.55);
        driveGain.gain.value = 0.8;
        vibrato.frequency.value = 0.25;
        vibratoGain.gain.value = 6;
        attack = 0.02;
        release = 0.18;
      } else if (inst === "acid") {
        addOsc("sawtooth", 0, 0.7);
        addOsc("square", -6, 0.3);
        filter.type = "lowpass";
        filter.frequency.value = 700;
        filter.Q.value = 18;
        drive.curve = this.makeCurve(0.8);
        driveGain.gain.value = 0.7;
        vibrato.frequency.value = 0.1;
        vibratoGain.gain.value = 2;
        attack = 0.008;
        release = 0.12;
      } else {
        addOsc("square", -10, 0.45);
        addOsc("sawtooth", 10, 0.45);
        filter.type = "lowpass";
        filter.frequency.value = 600;
        filter.Q.value = 12;
        drive.curve = this.makeCurve(0.95);
        driveGain.gain.value = 0.6;
        vibrato.frequency.value = 0.2;
        vibratoGain.gain.value = 4;
        attack = 0.01;
        release = 0.14;
        lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 5.5;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = 700;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
      }

      sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = freq / 2;
      const subG = ctx.createGain();
      subG.gain.value = 0.55;
      sub.connect(subG).connect(gain);
      sub.start(now);
    } else {
      addOsc("sawtooth", -9, 0.3);
      addOsc("sawtooth", 9, 0.3);
      addOsc("sine", 0, 0.4);
      filter.frequency.value = 1400;
      vibrato.frequency.value = 0.6;
      vibratoGain.gain.value = 10;
      attack = 0.9;
      release = 1.6;
    }

    vibrato.connect(vibratoGain);
    vibrato.start(now);
    oscs.forEach((o) => o.start(now));

    if (drive && driveGain) {
      filter.connect(drive).connect(driveGain).connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(this.master!);
    if (!isBass) gain.connect(this.wet!);

    return {
      oscs,
      gain,
      filter,
      vibrato,
      vibratoGain,
      noise,
      noiseGain,
      drive,
      driveGain,
      lfo,
      lfoGain,
      sub,
      isBass,
      inst,
      attack,
      release,
    };
  }

  private getVoice(id: string, freq: number, inst: InstrumentId) {
    let v = this.voices.get(id);
    if (v && v.inst !== inst) {
      this.noteOff(id);
      v = undefined;
    }
    if (!v) {
      this.buildInst = inst;
      v = this.buildVoice(freq);
      this.voices.set(id, v);
    }
    return v;
  }

  /** amount: 0..1 loudness/expression, freq in Hz, bright: 0..1 */
  noteOn(id: string, freq: number, amount: number, bright = 0.5, inst?: InstrumentId) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const v = this.getVoice(id, freq, inst ?? this.instrument);
    const now = ctx.currentTime;
    const glide = v.inst === "pads" ? 0.25 : v.isBass ? 0.04 : 0.08;
    v.oscs.forEach((o) => o.frequency.setTargetAtTime(freq, now, glide));
    v.sub?.frequency.setTargetAtTime(freq / 2, now, glide);
    const peak = v.isBass ? 0.5 : 0.34;
    v.gain.gain.setTargetAtTime(Math.min(peak, amount * peak), now, v.attack);
    this.shapeFilter(v, bright, amount, now);
  }

  /** short retriggered note used by the arpeggiator */
  pluck(id: string, freq: number, amount: number, bright: number, inst: InstrumentId, gate: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const v = this.getVoice(id, freq, inst);
    const now = ctx.currentTime;
    v.oscs.forEach((o) => o.frequency.setValueAtTime(freq, now));
    v.sub?.frequency.setValueAtTime(freq / 2, now);
    const peak = (v.isBass ? 0.5 : 0.34) * Math.min(1, amount);
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(peak, now + Math.min(0.02, gate * 0.2));
    g.linearRampToValueAtTime(0.0001, now + gate);
    this.shapeFilter(v, bright, amount, now);
  }

  private shapeFilter(v: VoiceNodes, bright: number, amount: number, now: number) {
    if (v.isBass) {
      v.filter.frequency.setTargetAtTime(120 + bright * 2600, now, 0.05);
      if (v.lfo) v.lfo.frequency.setTargetAtTime(1.5 + bright * 9, now, 0.1);
    } else {
      v.filter.frequency.setTargetAtTime(400 + bright * 5200, now, 0.1);
    }
    if (v.noiseGain) v.noiseGain.gain.setTargetAtTime(0.02 + amount * 0.08, now, 0.1);
  }

  noteOff(id: string) {
    const v = this.voices.get(id);
    if (!v || !this.ctx) return;
    const now = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
    v.gain.gain.setTargetAtTime(0, now, v.release / 3);
    this.voices.delete(id);
    const stopAt = now + v.release + 1.2;
    v.oscs.forEach((o) => o.stop(stopAt));
    v.vibrato.stop(stopAt);
    v.noise?.stop(stopAt);
    v.lfo?.stop(stopAt);
    v.sub?.stop(stopAt);
  }

  allOff() {
    this.arpTargets.clear();
    [...this.voices.keys()].forEach((k) => this.noteOff(k));
  }

  setInstrument(i: InstrumentId) {
    this.allOff();
    this.instrument = i;
  }

  /** 0..1 amount of the delay/reverb send */
  setReverb(amount: number) {
    this.reverbAmount = Math.max(0, Math.min(1, amount));
    if (this.wet && this.ctx) {
      this.wet.gain.setTargetAtTime(this.reverbAmount, this.ctx.currentTime, 0.05);
    }
  }

  /** master EQ pass filter */
  setEq(type: BiquadFilterType, freq: number) {
    this.eqType = type;
    this.eqFreq = freq;
    if (this.eq && this.ctx) {
      this.eq.type = type;
      this.eq.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }

  setScale(steps: number[], rootPc: number) {
    this.scale = steps;
    this.rootPc = rootPc;
  }

  setArp(opts: { enabled?: boolean; rate?: number; degrees?: number[]; random?: boolean }) {
    if (opts.enabled !== undefined) {
      this.arpEnabled = opts.enabled;
      if (!opts.enabled) {
        this.arpTargets.clear();
        [...this.voices.keys()].forEach((k) => this.noteOff(k));
      }
    }
    if (opts.rate !== undefined) this.arpRate = opts.rate;
    if (opts.degrees) this.arpDegrees = opts.degrees;
    if (opts.random !== undefined) this.arpRandom = opts.random;
    this.syncArpTimer();
  }

  /** feed the arpeggiator with the current gesture state for one hand */
  setArpTarget(id: string, degree: number, amount: number, bright: number, inst: InstrumentId) {
    const prev = this.arpTargets.get(id);
    this.arpTargets.set(id, { degree, amount, bright, inst, step: prev?.step ?? 0 });
  }

  clearArpTarget(id: string) {
    if (this.arpTargets.delete(id)) this.noteOff(id);
  }

  private syncArpTimer() {
    if (this.arpTimer) {
      clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
    if (!this.arpEnabled || !this.ctx) return;
    const period = 1000 / Math.max(1, this.arpRate);
    this.arpTimer = setInterval(() => this.tickArp(period / 1000), period);
  }

  private tickArp(periodSec: number) {
    if (!this.ctx) return;
    this.arpTargets.forEach((t, id) => {
      const seq = this.arpDegrees.length ? this.arpDegrees : [0];
      const offset = this.arpRandom
        ? (seq[Math.floor(Math.random() * seq.length)] ?? 0)
        : (seq[t.step % seq.length] ?? 0);
      t.step += 1;
      const midi =
        BASE_OCTAVE_MIDI +
        this.rootPc +
        (INSTRUMENT_SHIFT[t.inst] ?? 0) +
        degreeToSemitones(this.scale, t.degree + offset);
      this.pluck(id, midiToFreq(midi), t.amount, t.bright, t.inst, periodSec * 0.9);
    });
  }

  /** midi note the arpeggiator (or a hand) is currently centred on */
  midiFor(degree: number, inst: InstrumentId) {
    return degreeToMidi(degree, this.scale, this.rootPc, INSTRUMENT_SHIFT[inst] ?? 0);
  }

  async dispose() {
    this.allOff();
    if (this.arpTimer) clearInterval(this.arpTimer);
    this.arpTimer = null;
    await this.ctx?.close();
    this.ctx = null;
  }
}
