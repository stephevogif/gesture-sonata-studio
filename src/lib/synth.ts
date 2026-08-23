export type InstrumentId =
  | "violin"
  | "winds"
  | "pads"
  | "reese"
  | "acid"
  | "growl"
  | "neuro"
  | "fmbass"
  | "sub808"
  | "hoover"
  | "supersaw"
  | "digipluck"
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
  { id: "neuro", name: "Neuro Bass", blurb: "Saw distorto con filtro formante", group: "electro" },
  { id: "fmbass", name: "FM Bass", blurb: "FM profonda, attacco secco", group: "electro" },
  { id: "sub808", name: "808 Sub", blurb: "Sub caldo con pitch drop", group: "electro" },
  { id: "hoover", name: "Hoover / Rave Stab", blurb: "Stab rave urlante", group: "electro" },
  { id: "supersaw", name: "Supersaw Trance", blurb: "7 saw detunati, brillante", group: "electro" },
  { id: "digipluck", name: "Digital Pluck", blurb: "Pluck secco per arp veloci", group: "electro" },
];

/** Semitone transpose per instrument (bass patches play way lower). */
export const INSTRUMENT_SHIFT: Record<InstrumentId, number> = {
  violin: 0,
  winds: 0,
  pads: 0,
  reese: -24,
  acid: -12,
  growl: -24,
  neuro: -24,
  fmbass: -24,
  sub808: -24,
  hoover: 0,
  supersaw: 0,
  digipluck: 12,
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

export type ArpPatternId =
  | "up"
  | "down"
  | "updown"
  | "updown2"
  | "triplet"
  | "octaves"
  | "octaveJump"
  | "fullScale"
  | "tranceGate"
  | "random";

export const ARP_PATTERNS: { id: ArpPatternId; name: string; degrees: number[] }[] = [
  { id: "up", name: "Su", degrees: [0, 1, 2, 3] },
  { id: "down", name: "Giù", degrees: [3, 2, 1, 0] },
  { id: "updown", name: "Su / Giù", degrees: [0, 1, 2, 3, 2, 1] },
  { id: "updown2", name: "Su / Giù x2", degrees: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] },
  { id: "triplet", name: "Terzine", degrees: [0, 2, 4] },
  { id: "octaves", name: "Ottave", degrees: [0, 2, 5, 7] },
  { id: "octaveJump", name: "Salti d'ottava", degrees: [0, 7, 1, 8, 2, 9] },
  { id: "fullScale", name: "Scala completa", degrees: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: "tranceGate", name: "Trance gate", degrees: [0, 0, 2, 0, 4, 0, 2, 5] },
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

export type ChordId = "off" | "fifth" | "triad" | "seventh" | "sus";

export const CHORDS: { id: ChordId; name: string; degrees: number[] }[] = [
  { id: "off", name: "Nota singola", degrees: [0] },
  { id: "fifth", name: "Quinte", degrees: [0, 4] },
  { id: "triad", name: "Triade", degrees: [0, 2, 4] },
  { id: "seventh", name: "Settima", degrees: [0, 2, 4, 6] },
  { id: "sus", name: "Sospeso", degrees: [0, 3, 4] },
];

export type DivisionId = "1/4" | "1/8" | "1/8T" | "1/16" | "1/16T";

export const DIVISIONS: { id: DivisionId; name: string; perBeat: number }[] = [
  { id: "1/4", name: "1/4", perBeat: 1 },
  { id: "1/8", name: "1/8", perBeat: 2 },
  { id: "1/8T", name: "1/8 terzine", perBeat: 3 },
  { id: "1/16", name: "1/16", perBeat: 4 },
  { id: "1/16T", name: "1/16 terzine", perBeat: 6 },
];

export class GestureSynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eq: BiquadFilterNode | null = null;
  private delaySend: GainNode | null = null;
  private delayL: DelayNode | null = null;
  private delayR: DelayNode | null = null;
  private delayFb: GainNode | null = null;
  reverbAmount = 0.35;
  delayMix = 0.25;
  delayFeedback = 0.35;
  delaySync = true;
  delayDivision: DivisionId = "1/8";
  delayTime = 0.3;
  eqType: BiquadFilterType = "lowpass";
  eqFreq = 12000;
  /** 0..1 gesture modulation of the master cutoff */
  filterMod = 0.5;
  filterModAmount = 0;
  private voices = new Map<string, VoiceNodes>();
  private buildInst: InstrumentId = "violin";
  instrument: InstrumentId = "violin";

  // musical settings
  scale: number[] = scaleSteps("minorPent");
  rootPc = 2; // D
  chordMode: ChordId = "off";
  hold = false;

  // tempo
  bpm = 100;

  // arpeggiator
  arpEnabled = false;
  arpRate = 8; // notes per second (used when sync is off)
  arpSync = true;
  arpDivision: DivisionId = "1/8";
  arpDegrees: number[] = ARP_PATTERNS[0]!.degrees;
  arpRandom = false;
  arpGate = 0.9;
  arpOctaves = 1;
  arpSwing = 0;
  private arpTick = 0;
  private arpTargets = new Map<string, ArpTarget>();
  private arpTimer: ReturnType<typeof setTimeout> | null = null;

  private divisionSec(div: DivisionId) {
    const perBeat = DIVISIONS.find((d) => d.id === div)?.perBeat ?? 2;
    return 60 / Math.max(20, this.bpm) / perBeat;
  }

  /** effective arpeggiator speed in notes per second */
  effectiveRate() {
    return this.arpSync ? 1 / this.divisionSec(this.arpDivision) : Math.max(1, this.arpRate);
  }

  private effectiveDelayTime() {
    const t = this.delaySync ? this.divisionSec(this.delayDivision) : this.delayTime;
    return Math.max(0.02, Math.min(1.9, t));
  }

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

    // ping-pong delay bus
    const delaySend = ctx.createGain();
    delaySend.gain.value = this.delayMix;
    const dL = ctx.createDelay(2);
    const dR = ctx.createDelay(2);
    const t = this.effectiveDelayTime();
    dL.delayTime.value = t;
    dR.delayTime.value = t;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.65;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.65;
    const dTone = ctx.createBiquadFilter();
    dTone.type = "lowpass";
    dTone.frequency.value = 3200;
    const dFb = ctx.createGain();
    dFb.gain.value = this.delayFeedback;

    delaySend.connect(dL);
    dL.connect(panL).connect(master);
    dL.connect(dR);
    dR.connect(panR).connect(master);
    dR.connect(dTone).connect(dFb).connect(dL);

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
    this.delaySend = delaySend;
    this.delayL = dL;
    this.delayR = dR;
    this.delayFb = dFb;
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
    const bassPatches: InstrumentId[] = ["reese", "acid", "growl", "neuro", "fmbass", "sub808"];
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
      } else if (inst === "neuro") {
        addOsc("sawtooth", -18, 0.4);
        addOsc("sawtooth", 18, 0.4);
        addOsc("square", 0, 0.25, 0.5);
        filter.type = "lowpass";
        filter.frequency.value = 800;
        filter.Q.value = 10;
        drive.curve = this.makeCurve(1.2);
        driveGain.gain.value = 0.55;
        vibrato.frequency.value = 0.3;
        vibratoGain.gain.value = 5;
        attack = 0.012;
        release = 0.16;
        lfo = ctx.createOscillator();
        lfo.type = "triangle";
        lfo.frequency.value = 3.2;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = 900;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
      } else if (inst === "fmbass") {
        const carrier = addOsc("sine", 0, 0.8);
        const mod = ctx.createOscillator();
        mod.type = "sine";
        mod.frequency.value = freq * 2;
        const modGain = ctx.createGain();
        modGain.gain.value = freq * 3;
        mod.connect(modGain).connect(carrier.frequency);

        oscs.push(mod);
        ratios.push(2);
        filter.type = "lowpass";
        filter.frequency.value = 1200;
        filter.Q.value = 4;
        drive.curve = this.makeCurve(0.4);
        driveGain.gain.value = 0.85;
        vibrato.frequency.value = 0.2;
        vibratoGain.gain.value = 2;
        attack = 0.005;
        release = 0.2;
      } else if (inst === "sub808") {
        const o = addOsc("sine", 0, 0.95);
        o.frequency.setValueAtTime(freq * 2.2, now);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, freq), now + 0.08);
        filter.type = "lowpass";
        filter.frequency.value = 400;
        filter.Q.value = 1;
        drive.curve = this.makeCurve(0.25);
        driveGain.gain.value = 0.95;
        vibrato.frequency.value = 0.1;
        vibratoGain.gain.value = 1;
        attack = 0.006;
        release = 0.9;
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
    } else if (inst === "harp") {
      addOsc("triangle", 0, 0.5);
      addOsc("sine", 4, 0.35, 2);
      addOsc("sine", -4, 0.12, 3);
      filter.frequency.value = 5200;
      filter.Q.value = 0.7;
      vibrato.frequency.value = 3.2;
      vibratoGain.gain.value = 2;
      attack = 0.006;
      release = 1.1;
      sustain = 0.12;
      decay = 0.55;
    } else if (inst === "piano") {
      addOsc("triangle", 0, 0.55);
      addOsc("sine", 0, 0.3, 2);
      addOsc("sine", 3, 0.1, 4);
      filter.frequency.value = 3200;
      filter.Q.value = 0.6;
      vibrato.frequency.value = 1.2;
      vibratoGain.gain.value = 1;
      attack = 0.02;
      release = 1.4;
      sustain = 0.2;
      decay = 0.9;
    } else if (inst === "kalimba") {
      addOsc("sine", 0, 0.6);
      addOsc("sine", 0, 0.18, 2.76);
      addOsc("sine", 0, 0.08, 5.4);
      filter.frequency.value = 4200;
      vibrato.frequency.value = 2.4;
      vibratoGain.gain.value = 1;
      attack = 0.004;
      release = 0.7;
      sustain = 0.08;
      decay = 0.28;
    } else if (inst === "bowl") {
      addOsc("sine", 0, 0.5);
      addOsc("sine", 0, 0.24, 2.4);
      addOsc("sine", 0, 0.14, 4.3);
      addOsc("sine", 6, 0.08, 6.7);
      filter.frequency.value = 3000;
      vibrato.frequency.value = 0.45;
      vibratoGain.gain.value = 4;
      attack = 0.25;
      release = 3.2;
      sustain = 0.45;
      decay = 2.4;
    } else if (inst === "glocken") {
      addOsc("sine", 0, 0.5);
      addOsc("sine", 0, 0.28, 3.01);
      addOsc("sine", 0, 0.12, 6.2);
      filter.frequency.value = 8000;
      vibrato.frequency.value = 1.6;
      vibratoGain.gain.value = 1;
      attack = 0.003;
      release = 1.6;
      sustain = 0.1;
      decay = 0.5;
    } else if (inst === "choir") {
      addOsc("sawtooth", -8, 0.18);
      addOsc("sawtooth", 8, 0.18);
      addOsc("triangle", 0, 0.3);
      addOsc("sine", 0, 0.2, 2);
      filter.type = "lowpass";
      filter.frequency.value = 1600;
      filter.Q.value = 2.5;
      vibrato.frequency.value = 4.8;
      vibratoGain.gain.value = 7;
      attack = 0.55;
      release = 1.8;
    } else if (inst === "hoover") {
      addOsc("sawtooth", -22, 0.28);
      addOsc("sawtooth", 22, 0.28);
      addOsc("square", 0, 0.2, 0.5);
      addOsc("sawtooth", 0, 0.2, 2);
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      filter.Q.value = 9;
      vibrato.frequency.value = 5.5;
      vibratoGain.gain.value = 22;
      attack = 0.02;
      release = 0.5;
      sustain = 0.5;
      decay = 0.4;
    } else if (inst === "supersaw") {
      addOsc("sawtooth", -24, 0.16);
      addOsc("sawtooth", -14, 0.16);
      addOsc("sawtooth", -6, 0.16);
      addOsc("sawtooth", 0, 0.2);
      addOsc("sawtooth", 6, 0.16);
      addOsc("sawtooth", 14, 0.16);
      addOsc("sawtooth", 24, 0.16);
      filter.type = "lowpass";
      filter.frequency.value = 3400;
      filter.Q.value = 1.5;
      vibrato.frequency.value = 0.4;
      vibratoGain.gain.value = 6;
      attack = 0.12;
      release = 0.7;
    } else if (inst === "digipluck") {
      const carrier = addOsc("square", 0, 0.45);
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 3;
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 1.5;
      mod.connect(modGain).connect(carrier.frequency);

      oscs.push(mod);
      ratios.push(3);
      addOsc("triangle", 5, 0.25, 2);
      filter.frequency.value = 4200;
      filter.Q.value = 2.5;
      vibrato.frequency.value = 4;
      vibratoGain.gain.value = 2;
      attack = 0.003;
      release = 0.45;
      sustain = 0.06;
      decay = 0.18;
    } else if (inst === "pluckAmb") {

      addOsc("square", 0, 0.3);
      addOsc("triangle", 7, 0.35);
      addOsc("sine", -7, 0.2, 2);
      filter.frequency.value = 3600;
      filter.Q.value = 2;
      vibrato.frequency.value = 5;
      vibratoGain.gain.value = 3;
      attack = 0.005;
      release = 0.9;
      sustain = 0.14;
      decay = 0.35;
    } else if (inst === "subpad") {
      addOsc("sine", 0, 0.55);
      addOsc("triangle", -6, 0.2);
      addOsc("sine", 6, 0.18, 2);
      filter.frequency.value = 900;
      filter.Q.value = 0.8;
      vibrato.frequency.value = 0.35;
      vibratoGain.gain.value = 4;
      attack = 0.7;
      release = 1.8;
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
    if (this.delaySend) gain.connect(this.delaySend);

    return {
      oscs,
      ratios,
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
      sustain,
      decay,
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
    v.oscs.forEach((o, i) =>
      o.frequency.setTargetAtTime(freq * (v.ratios[i] ?? 1), now, glide),
    );
    v.sub?.frequency.setTargetAtTime(freq / 2, now, glide);
    const peak = v.isBass ? 0.5 : 0.34;
    const target = Math.min(peak, amount * peak);
    if (v.sustain !== undefined) {
      // plucky patches: quick swell then decay to a soft tail while held
      const g = v.gain.gain;
      if (g.value < target * 0.35) {
        g.setTargetAtTime(target, now, v.attack);
      } else {
        g.setTargetAtTime(target * v.sustain, now, v.decay ?? 0.5);
      }
    } else {
      v.gain.gain.setTargetAtTime(target, now, v.attack);
    }
    this.shapeFilter(v, bright, amount, now);
  }

  /** short retriggered note used by the arpeggiator */
  pluck(id: string, freq: number, amount: number, bright: number, inst: InstrumentId, gate: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const v = this.getVoice(id, freq, inst);
    const now = ctx.currentTime;
    v.oscs.forEach((o, i) => o.frequency.setValueAtTime(freq * (v.ratios[i] ?? 1), now));
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

  /** play a chord (or a single note) built on a scale degree */
  noteOnChord(
    id: string,
    baseMidi: number,
    degree: number,
    amount: number,
    bright: number,
    inst: InstrumentId,
  ) {
    const offsets = CHORDS.find((c) => c.id === this.chordMode)?.degrees ?? [0];
    const rootSemi = degreeToSemitones(this.scale, degree);
    offsets.forEach((off, k) => {
      const semi = degreeToSemitones(this.scale, degree + off) - rootSemi;
      const vid = k === 0 ? id : `${id}~${k}`;
      this.noteOn(vid, midiToFreq(baseMidi + semi), amount * (k === 0 ? 1 : 0.55), bright, inst);
    });
    // spegni eventuali voci d'accordo in eccesso (cambio di modalità)
    for (const key of [...this.voices.keys()]) {
      if (!key.startsWith(`${id}~`)) continue;
      const k = Number(key.slice(id.length + 1));
      if (!Number.isNaN(k) && k >= offsets.length) this.noteOff(key, true);
    }
  }

  noteOff(id: string, force = false) {
    if (this.hold && !force) return;
    for (const key of [...this.voices.keys()]) {
      if (key.startsWith(`${id}~`)) this.releaseVoice(key);
    }
    this.releaseVoice(id);
  }

  private releaseVoice(id: string) {
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
    [...this.voices.keys()].forEach((k) => this.releaseVoice(k));
  }

  setChord(mode: ChordId) {
    this.chordMode = mode;
  }

  /** latch: keep the notes ringing until released */
  setHold(on: boolean) {
    this.hold = on;
    if (!on) this.allOff();
  }

  setInstrument(i: InstrumentId) {
    this.allOff();
    this.instrument = i;
  }

  /** ping-pong delay controls */
  setDelay(opts: {
    mix?: number;
    feedback?: number;
    sync?: boolean;
    division?: DivisionId;
    time?: number;
  }) {
    if (opts.mix !== undefined) this.delayMix = Math.max(0, Math.min(1, opts.mix));
    if (opts.feedback !== undefined)
      this.delayFeedback = Math.max(0, Math.min(0.85, opts.feedback));
    if (opts.sync !== undefined) this.delaySync = opts.sync;
    if (opts.division) this.delayDivision = opts.division;
    if (opts.time !== undefined) this.delayTime = opts.time;
    this.applyDelay();
  }

  private applyDelay() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.delaySend?.gain.setTargetAtTime(this.delayMix, now, 0.05);
    this.delayFb?.gain.setTargetAtTime(this.delayFeedback, now, 0.05);
    const t = this.effectiveDelayTime();
    this.delayL?.delayTime.setTargetAtTime(t, now, 0.08);
    this.delayR?.delayTime.setTargetAtTime(t, now, 0.08);
  }

  /** global tempo in BPM; arp and delay follow it when synced */
  setTempo(bpm: number) {
    this.bpm = Math.max(40, Math.min(220, bpm));
    this.applyDelay();
    this.syncArpTimer();
  }

  /**
   * gesture modulation of the master cutoff.
   * value 0..1, amount 0..1 (0 = no modulation)
   */
  setFilterMod(value: number, amount = this.filterModAmount) {
    this.filterMod = Math.max(0, Math.min(1, value));
    this.filterModAmount = Math.max(0, Math.min(1, amount));
    this.applyEq();
  }

  private applyEq() {
    if (!this.eq || !this.ctx) return;
    const factor =
      this.filterModAmount > 0
        ? 1 + this.filterModAmount * (this.filterMod * 5 - 1.5)
        : 1;
    const freq = Math.max(60, Math.min(18000, this.eqFreq * Math.max(0.15, factor)));
    this.eq.type = this.eqType;
    this.eq.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.06);
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
    this.applyEq();
  }

  /** master filter resonance (Q) */
  setResonance(q: number) {
    this.eqQ = Math.max(0.1, Math.min(24, q));
    if (this.eq && this.ctx) {
      this.eq.Q.setTargetAtTime(this.eqQ, this.ctx.currentTime, 0.05);
    }
  }


  setScale(steps: number[], rootPc: number) {
    this.scale = steps;
    this.rootPc = rootPc;
  }

  setArp(opts: {
    enabled?: boolean;
    rate?: number;
    degrees?: number[];
    random?: boolean;
    gate?: number;
    octaves?: number;
    swing?: number;
    sync?: boolean;
    division?: DivisionId;
  }) {
    if (opts.enabled !== undefined) {
      this.arpEnabled = opts.enabled;
      if (!opts.enabled) {
        this.arpTargets.clear();
        [...this.voices.keys()].forEach((k) => this.releaseVoice(k));
      }
    }
    if (opts.rate !== undefined) this.arpRate = opts.rate;
    if (opts.degrees) this.arpDegrees = opts.degrees;
    if (opts.random !== undefined) this.arpRandom = opts.random;
    if (opts.gate !== undefined) this.arpGate = Math.max(0.05, Math.min(1.5, opts.gate));
    if (opts.octaves !== undefined) this.arpOctaves = Math.max(1, Math.min(3, Math.round(opts.octaves)));
    if (opts.swing !== undefined) this.arpSwing = Math.max(0, Math.min(0.6, opts.swing));
    if (opts.sync !== undefined) this.arpSync = opts.sync;
    if (opts.division) this.arpDivision = opts.division;
    this.syncArpTimer();
  }

  /** feed the arpeggiator with the current gesture state for one hand */
  setArpTarget(id: string, degree: number, amount: number, bright: number, inst: InstrumentId) {
    const prev = this.arpTargets.get(id);
    this.arpTargets.set(id, { degree, amount, bright, inst, step: prev?.step ?? 0 });
  }

  clearArpTarget(id: string) {
    if (this.hold) return;
    if (this.arpTargets.delete(id)) this.noteOff(id, true);
  }


  private syncArpTimer() {
    if (this.arpTimer) {
      clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }
    if (!this.arpEnabled || !this.ctx) return;
    this.arpTick = 0;
    const schedule = () => {
      const base = 1000 / this.effectiveRate();
      const swung =
        this.arpSwing > 0
          ? this.arpTick % 2 === 0
            ? base * (1 + this.arpSwing)
            : base * (1 - this.arpSwing)
          : base;
      this.arpTick += 1;
      this.tickArp(swung / 1000);
      this.arpTimer = setTimeout(schedule, swung);
    };
    this.arpTimer = setTimeout(schedule, 1000 / this.effectiveRate());

  }

  private tickArp(periodSec: number) {
    if (!this.ctx) return;
    this.arpTargets.forEach((t, id) => {
      const seq = this.arpDegrees.length ? this.arpDegrees : [0];
      const offset = this.arpRandom
        ? (seq[Math.floor(Math.random() * seq.length)] ?? 0)
        : (seq[t.step % seq.length] ?? 0);
      const octIndex =
        this.arpOctaves > 1 ? Math.floor(t.step / seq.length) % this.arpOctaves : 0;
      t.step += 1;
      const midi =
        BASE_OCTAVE_MIDI +
        this.rootPc +
        (INSTRUMENT_SHIFT[t.inst] ?? 0) +
        degreeToSemitones(this.scale, t.degree + offset) +
        octIndex * 12;
      this.pluck(id, midiToFreq(midi), t.amount, t.bright, t.inst, periodSec * this.arpGate);
    });
  }


  /** midi note the arpeggiator (or a hand) is currently centred on */
  midiFor(degree: number, inst: InstrumentId) {
    return degreeToMidi(degree, this.scale, this.rootPc, INSTRUMENT_SHIFT[inst] ?? 0);
  }

  async dispose() {
    this.allOff();
    if (this.arpTimer) clearTimeout(this.arpTimer);
    this.arpTimer = null;
    await this.ctx?.close();
    this.ctx = null;
  }
}
