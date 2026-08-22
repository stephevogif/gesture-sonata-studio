export type InstrumentId = "violin" | "winds" | "pads" | "reese" | "acid" | "growl";

export const INSTRUMENTS: { id: InstrumentId; name: string; blurb: string }[] = [
  { id: "reese", name: "Reese Bass", blurb: "Basso detunato, sporco e profondo" },
  { id: "acid", name: "Acid 303", blurb: "Squelch acido con filtro urlante" },
  { id: "growl", name: "Growl / Dubstep", blurb: "Wobble aggressivo e distorto" },
  { id: "violin", name: "Violino", blurb: "Archi espressivi con vibrato" },
  { id: "winds", name: "Fiati", blurb: "Legni ariosi e soffiati" },
  { id: "pads", name: "Pads", blurb: "Tappeti ampi e riverberati" },
];

/** Semitone transpose per instrument (bass patches play way lower). */
export const INSTRUMENT_SHIFT: Record<InstrumentId, number> = {
  violin: 0,
  winds: 0,
  pads: 0,
  reese: -24,
  acid: -12,
  growl: -24,
};

// D minor pentatonic-ish scale over 3 octaves for always-musical results
const SCALE = [0, 2, 3, 5, 7, 9, 10];
const ROOT_MIDI = 50; // D3

export function positionToMidi(x: number, steps = 21, shift = 0): number {
  const i = Math.min(steps - 1, Math.max(0, Math.round(x * (steps - 1))));
  const octave = Math.floor(i / SCALE.length);
  return ROOT_MIDI + shift + octave * 12 + (SCALE[i % SCALE.length] ?? 0);
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function midiToName(m: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[m % 12] ?? "C"}${Math.floor(m / 12) - 1}`;
}

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
  attack: number;
  release: number;
};

export class GestureSynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices = new Map<string, VoiceNodes>();
  instrument: InstrumentId = "violin";

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

    // simple stereo-ish ambience with two delays
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
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

    master.connect(analyser).connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.wet = wet;
    this.analyser = analyser;
    await ctx.resume();
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
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1;

    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.type = "sine";

    const oscs: OscillatorNode[] = [];
    let noise: AudioBufferSourceNode | undefined;
    let noiseGain: GainNode | undefined;
    let attack = 0.12;
    let release = 0.25;
    let drive: WaveShaperNode | undefined;
    let driveGain: GainNode | undefined;
    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;
    let sub: OscillatorNode | undefined;
    const bassPatches: InstrumentId[] = ["reese", "acid", "growl"];
    const isBass = bassPatches.includes(this.instrument);

    const addOsc = (type: OscillatorType, detune = 0, level = 1) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(filter);
      vibratoGain.connect(o.detune);
      oscs.push(o);
      return o;
    };

    if (this.instrument === "violin") {
      addOsc("sawtooth", 0, 0.55);
      addOsc("sawtooth", 7, 0.35);
      filter.frequency.value = 2600;
      filter.Q.value = 3;
      vibrato.frequency.value = 5.6;
      vibratoGain.gain.value = 16;
      attack = 0.14;
      release = 0.28;
    } else if (this.instrument === "winds") {
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

      if (this.instrument === "reese") {
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
      } else if (this.instrument === "acid") {
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
        // wobble LFO on the filter cutoff
        lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 5.5;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = 700;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
      }

      // sub oscillator one octave down for weight
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
      attack,
      release,
    };
  }

  /** amount: 0..1 loudness/expression, freq in Hz, bright: 0..1 */
  noteOn(id: string, freq: number, amount: number, bright = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    let v = this.voices.get(id);
    if (!v) {
      v = this.buildVoice(freq);
      this.voices.set(id, v);
    }
    const now = ctx.currentTime;
    const glide = this.instrument === "pads" ? 0.25 : v.isBass ? 0.04 : 0.08;
    v.oscs.forEach((o) => o.frequency.setTargetAtTime(freq, now, glide));
    v.sub?.frequency.setTargetAtTime(freq / 2, now, glide);
    const peak = v.isBass ? 0.5 : 0.34;
    v.gain.gain.setTargetAtTime(Math.min(peak, amount * peak), now, v.attack);
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
    [...this.voices.keys()].forEach((k) => this.noteOff(k));
  }

  setInstrument(i: InstrumentId) {
    this.allOff();
    this.instrument = i;
  }

  async dispose() {
    this.allOff();
    await this.ctx?.close();
    this.ctx = null;
  }
}
