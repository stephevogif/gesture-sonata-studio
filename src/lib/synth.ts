export type InstrumentId = "violin" | "winds" | "pads";

export const INSTRUMENTS: { id: InstrumentId; name: string; blurb: string }[] = [
  { id: "violin", name: "Violino", blurb: "Archi espressivi con vibrato" },
  { id: "winds", name: "Fiati", blurb: "Legni ariosi e soffiati" },
  { id: "pads", name: "Pads", blurb: "Tappeti ampi e riverberati" },
];

// D minor pentatonic-ish scale over 3 octaves for always-musical results
const SCALE = [0, 2, 3, 5, 7, 9, 10];
const ROOT_MIDI = 50; // D3

export function positionToMidi(x: number, steps = 21): number {
  const i = Math.min(steps - 1, Math.max(0, Math.round(x * (steps - 1))));
  const octave = Math.floor(i / SCALE.length);
  return ROOT_MIDI + octave * 12 + (SCALE[i % SCALE.length] ?? 0);
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

    filter.connect(gain);
    gain.connect(this.master!);
    gain.connect(this.wet!);

    return { oscs, gain, filter, vibrato, vibratoGain, noise, noiseGain, attack, release };
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
    const glide = this.instrument === "pads" ? 0.25 : 0.08;
    v.oscs.forEach((o) => o.frequency.setTargetAtTime(freq, now, glide));
    v.gain.gain.setTargetAtTime(Math.min(0.34, amount * 0.34), now, v.attack);
    v.filter.frequency.setTargetAtTime(400 + bright * 5200, now, 0.1);
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
