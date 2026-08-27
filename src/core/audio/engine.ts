/**
 * Heaven Synth — audio engine.
 * Layer: Synth / Audio Engine + Effects orchestration.
 *
 * Public surface consumed by the UI:
 *   start / dispose, noteOn / pluck / noteOnChord / noteOff / allOff,
 *   setInstrument, setScale, setChord, setHold, setTempo,
 *   setReverb / setEq / setResonance / setDelay / setFilterMod,
 *   setArp / setArpTarget / clearArpTarget, midiFor, getAnalyser.
 */

import { clamp, noteToFrequency } from "@/core/music/pitch";
import { BASE_MIDI, degreeToMidi, degreeToSemitones, scaleSteps } from "@/core/music/scales";
import type { ChordId, DivisionId } from "@/core/music/patterns";
import { chordOffsets, divisionSeconds } from "@/core/music/patterns";
import { Arpeggiator, type ArpEvent } from "./arpeggiator";
import { MasterRack } from "./effects";
import { InstrumentChannel } from "./channel";
import { FxChain, type FxSpec } from "./fx";
import {
  DEFAULT_KEYS,
  INSTRUMENT_SHIFT,
  presetOf,
  withKeysOptions,
  type InstrumentId,
  type KeysOptions,
} from "./presets";
import { SynthVoice, type VoiceBuses } from "./voice";

/** one layered instrument: gain + its own insert FX chain */
export type MixLayerSpec = {
  id: string;
  instrument: InstrumentId;
  gain: number;
  effects: FxSpec[];
};

/** full Sound Constellation mix, max 4 instruments */
export type MixSpec = {
  instruments: MixLayerSpec[];
  master: { effects: FxSpec[] };
};

/** `voiceKey@channelId` → voiceKey */
const baseKey = (key: string) => key.split("@")[0]!;

/** hard ceiling on simultaneous voices across every channel */
const MAX_TOTAL_VOICES = 20;

/** voices kept alive per active instrument channel */
const MAX_VOICES_PER_CHANNEL = 8;

export class HeavenAudioEngine {
  private ctx: AudioContext | null = null;
  private rack: MasterRack | null = null;
  private voices = new Map<string, SynthVoice>();
  private readonly arp: Arpeggiator;
  /** Sound Constellation layers; empty = classic single-instrument routing */
  private channels = new Map<string, InstrumentChannel>();
  private masterChain: FxChain | null = null;
  private mix: MixSpec | null = null;

  instrument: InstrumentId = "violin";

  // musical settings
  scale: number[] = scaleSteps("minorPent");
  rootPc = 2; // D
  chordMode: ChordId = "off";
  hold = false;
  bpm = 100;

  /** piano-family controls (pedal / brightness / lid) */
  private keys: KeysOptions = { ...DEFAULT_KEYS };
  /** BPM-locked repeated notes */
  private pulse: { enabled: boolean; division: DivisionId; gate: number } = {
    enabled: false,
    division: "1/4",
    gate: 0.6,
  };
  private pulseTimer: number | null = null;
  /** last sustained note per voice id, so the pulse can retrigger them */
  private sustained = new Map<
    string,
    { freq: number; amount: number; bright: number; inst?: InstrumentId | undefined }
  >();



  // effects state (mirrored so the UI can read it back)
  reverbAmount = 0.35;
  eqType: BiquadFilterType = "lowpass";
  eqFreq = 12000;
  eqQ = 0.7;
  delayMix = 0.25;
  delayFeedback = 0.35;
  delaySync = true;
  delayDivision: DivisionId = "1/8";
  delayTime = 0.3;
  chorusMix = 0;
  chorusDepth = 0.5;
  chorusRate = 0.5;
  /** portamento (legato) between chords, in seconds; null = preset default */
  legato: number | null = null;
  /** 0..1 gesture modulation of the master cutoff */
  filterMod = 0.5;
  filterModAmount = 0;
  /** last values pushed to the rack: guards against per-frame redundant writes */
  private lastReverb = -1;
  private lastEqFreq = -1;
  private lastEqType: BiquadFilterType | null = null;
  private lastEqQ = -1;

  constructor() {
    this.arp = new Arpeggiator((event) => this.playArpEvent(event));
  }

  /* ————— lifecycle ————— */

  async start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    this.rack = new MasterRack(ctx);
    this.masterChain = new FxChain(ctx, this.rack.master, this.rack.postMaster);
    // fresh rack → invalidate the redundancy guards
    this.lastReverb = -1;
    this.lastEqFreq = -1;
    this.lastEqType = null;
    this.lastEqQ = -1;
    if (this.mix) this.applyMix(this.mix);
    this.applyReverb();
    this.applyEq();
    this.applyDelay();
    this.applyChorus();
    await ctx.resume();
    this.arp.setTempo(this.bpm);
  }

  async dispose() {
    this.allOff();
    this.arp.stop();
    this.channels.forEach((c) => c.dispose());
    this.channels.clear();
    this.masterChain?.dispose();
    this.masterChain = null;
    await this.ctx?.close();
    this.ctx = null;
    this.rack = null;
  }

  /* ————— Sound Constellation: layers + routing ————— */

  /**
   * Applies a declarative mix: creates/removes instrument channels and
   * reconciles instrument + master FX chains. Cheap to call on every drag frame:
   * the graph is only rebuilt when the structure changes.
   */
  applyMix(mix: MixSpec) {
    this.mix = mix;
    const ctx = this.ctx;
    const rack = this.rack;
    if (!ctx || !rack) return;

    const wanted = mix.instruments.slice(0, 4);
    const ids = wanted.map((l) => l.id);
    for (const [id, channel] of [...this.channels]) {
      if (ids.includes(id)) continue;
      this.releaseChannelVoices(id);
      channel.dispose();
      this.channels.delete(id);
    }
    for (const layer of wanted) {
      let channel = this.channels.get(layer.id);
      if (channel && channel.instrument !== layer.instrument) {
        this.releaseChannelVoices(layer.id);
        channel.instrument = layer.instrument;
      }
      if (!channel) {
        channel = new InstrumentChannel(ctx, layer.instrument, rack.master, layer.gain, {
          reverb: rack.reverbSend,
          delay: rack.delaySend,
          chorus: rack.chorusSend,
        });
        this.channels.set(layer.id, channel);
      }
      channel.setGain(layer.gain);
      channel.syncFx(layer.effects, this.bpm);
    }
    this.masterChain?.sync(mix.master.effects, this.bpm);
  }

  /** drops every voice belonging to one channel */
  private releaseChannelVoices(channelId: string) {
    for (const key of [...this.voices.keys()]) {
      if (key.endsWith(`@${channelId}`)) this.releaseVoice(key);
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.rack?.analyser ?? null;
  }

  /* ————— voices ————— */

  private voiceFor(
    id: string,
    frequency: number,
    instrument: InstrumentId,
    buses?: VoiceBuses,
  ): SynthVoice | null {
    if (!this.ctx || !this.rack) return null;
    let voice = this.voices.get(id);
    if (voice && voice.instrument !== instrument) {
      voice.release();
      this.voices.delete(id);
      voice = undefined;
    }
    if (!voice) {
      const spec = presetOf(instrument);
      voice = new SynthVoice(
        this.ctx,
        spec,
        frequency,
        buses ?? {
          dry: this.rack.master,
          reverb: this.rack.reverbSend,
          delay: this.rack.delaySend,
          chorus: this.rack.chorusSend,
        },
      );
      this.voices.set(id, voice);
      this.trimVoices();
    }
    return voice;
  }

  /**
   * Polyphony guard: with 4 layered instruments a wide chord can allocate
   * dozens of voices. Oldest voices are released first so the CPU load stays
   * bounded instead of degrading into audio drop-outs.
   */
  private trimVoices() {
    // total polyphony is capped: layering 4 instruments must not multiply CPU by 4
    const max = Math.min(
      MAX_TOTAL_VOICES,
      Math.max(8, MAX_VOICES_PER_CHANNEL * Math.max(1, this.channels.size)),
    );
    if (this.voices.size <= max) return;
    for (const key of this.voices.keys()) {
      if (this.voices.size <= max) break;
      this.releaseVoice(key);
    }
  }


  /** sustained note — amount 0..1 loudness, bright 0..1 timbre */
  noteOn(id: string, freq: number, amount: number, bright = 0.5, inst?: InstrumentId) {
    this.sustained.set(id, { freq, amount, bright, inst });
    if (this.pulse.enabled) {
      this.strikeNote(id, freq, amount, bright, inst, this.pulseGateSeconds());
      return;
    }
    this.holdNote(id, freq, amount, bright, inst);
  }

  private holdNote(id: string, freq: number, amount: number, bright: number, inst?: InstrumentId) {
    if (this.channels.size) {
      for (const [cid, channel] of this.channels) {
        const voice = this.voiceFor(`${id}@${cid}`, freq, channel.instrument, {
          dry: channel.input,
        });
        voice?.hold(freq, amount, bright, this.legato ?? undefined);
      }
      return;
    }
    const voice = this.voiceFor(id, freq, inst ?? this.instrument);
    voice?.hold(freq, amount, bright, this.legato ?? undefined);
  }

  private strikeNote(
    id: string,
    freq: number,
    amount: number,
    bright: number,
    inst: InstrumentId | undefined,
    gate: number,
  ) {
    if (this.channels.size) {
      for (const [cid, channel] of this.channels) {
        const voice = this.voiceFor(`${id}@${cid}`, freq, channel.instrument, {
          dry: channel.input,
        });
        voice?.strike(freq, amount, bright, gate);
      }
      return;
    }
    const voice = this.voiceFor(id, freq, inst ?? this.instrument);
    voice?.strike(freq, amount, bright, gate);
  }

  /* ————— pulse (ritmo sincronizzato al BPM) ————— */

  private pulseGateSeconds() {
    const period = divisionSeconds(this.pulse.division, this.bpm);
    return Math.max(0.05, period * clamp(this.pulse.gate, 0.1, 1));
  }

  /** repeated notes ("tan tan tan") locked to the tempo; off = normal sustain */
  setPulse(opts: { enabled?: boolean; division?: DivisionId; gate?: number }) {
    if (opts.division) this.pulse.division = opts.division;
    if (opts.gate !== undefined) this.pulse.gate = clamp(opts.gate, 0.1, 1);
    if (opts.enabled !== undefined) this.pulse.enabled = opts.enabled;
    this.restartPulse();
  }

  get pulseEnabled() {
    return this.pulse.enabled;
  }
  get pulseDivision() {
    return this.pulse.division;
  }

  private restartPulse() {
    if (this.pulseTimer !== null) {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (!this.pulse.enabled) return;
    const period = divisionSeconds(this.pulse.division, this.bpm) * 1000;
    this.pulseTimer = window.setInterval(() => this.pulseTick(), Math.max(60, period));
  }

  private pulseTick() {
    if (!this.ctx || !this.sustained.size) return;
    const gate = this.pulseGateSeconds();
    for (const [id, note] of this.sustained) {
      this.strikeNote(id, note.freq, note.amount, note.bright, note.inst, gate);
    }
  }

  /* ————— piano controls ————— */

  /** sustain pedal / brightness / lid for the piano-family patches */
  setKeys(opts: Partial<KeysOptions>) {
    this.keys = { ...this.keys, ...opts };
    // rebuild keys voices so the new timbre is heard immediately
    for (const [key, voice] of [...this.voices]) {
      if (presetOf(voice.instrument).keys) this.releaseVoice(key);
    }
  }

  get keysOptions(): KeysOptions {
    return this.keys;
  }


  /** short retriggered note used by the arpeggiator */
  pluck(
    id: string,
    freq: number,
    amount: number,
    bright: number,
    inst: InstrumentId,
    gate: number,
  ) {
    if (this.channels.size) {
      for (const [cid, channel] of this.channels) {
        const voice = this.voiceFor(`${id}@${cid}`, freq, channel.instrument, {
          dry: channel.input,
        });
        voice?.strike(freq, amount, bright, gate);
      }
      return;
    }
    const voice = this.voiceFor(id, freq, inst);
    voice?.strike(freq, amount, bright, gate);
  }

  /** plays a chord (or a single note) built on a scale degree */
  noteOnChord(
    id: string,
    baseMidi: number,
    degree: number,
    amount: number,
    bright: number,
    inst: InstrumentId,
  ) {
    const offsets = chordOffsets(this.chordMode);
    const rootSemi = degreeToSemitones(this.scale, degree);
    offsets.forEach((offset, index) => {
      const semi = degreeToSemitones(this.scale, degree + offset) - rootSemi;
      const voiceId = index === 0 ? id : `${id}~${index}`;
      this.noteOn(
        voiceId,
        noteToFrequency(baseMidi + semi),
        amount * (index === 0 ? 1 : 0.55),
        bright,
        inst,
      );
    });
    // drop extra chord voices left over from a wider shape
    for (const key of [...this.voices.keys()]) {
      const base = baseKey(key);
      if (!base.startsWith(`${id}~`)) continue;
      const index = Number(base.slice(id.length + 1));
      if (!Number.isNaN(index) && index >= offsets.length) this.releaseVoice(key);
    }
  }

  noteOff(id: string, force = false) {
    if (this.hold && !force) return;
    for (const key of [...this.voices.keys()]) {
      const base = baseKey(key);
      if (base === id || base.startsWith(`${id}~`)) this.releaseVoice(key);
    }
    this.releaseVoice(id);
  }

  private releaseVoice(id: string) {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    voice.release();
  }

  allOff() {
    this.arp.clear();
    [...this.voices.keys()].forEach((key) => this.releaseVoice(key));
  }

  /* ————— musical settings ————— */

  setInstrument(instrument: InstrumentId) {
    this.allOff();
    this.instrument = instrument;
  }

  setScale(steps: number[], rootPc: number) {
    this.scale = steps;
    this.rootPc = rootPc;
  }

  setChord(mode: ChordId) {
    this.chordMode = mode;
  }

  /** latch: keep the notes ringing until released */
  setHold(on: boolean) {
    this.hold = on;
    if (!on) this.allOff();
  }

  /** global tempo in BPM; arp and delay follow it when synced */
  setTempo(bpm: number) {
    this.bpm = clamp(bpm, 40, 220);
    this.applyDelay();
    this.arp.setTempo(this.bpm);
    this.channels.forEach((c) => c.setTempo(this.bpm));
    this.masterChain?.setTempo(this.bpm);
  }

  /** midi note a degree maps to for the given instrument */
  midiFor(degree: number, inst: InstrumentId) {
    return degreeToMidi(degree, this.scale, this.rootPc, INSTRUMENT_SHIFT[inst] ?? 0);
  }

  /* ————— effects ————— */

  setReverb(amount: number) {
    this.reverbAmount = clamp(amount, 0, 1);
    this.applyReverb();
  }

  /** smooth master volume, used by the optional hand-control mapping */
  setMasterGain(value: number) {
    const rack = this.rack;
    const ctx = this.ctx;
    if (!rack || !ctx) return;
    rack.master.gain.setTargetAtTime(clamp(value, 0, 1) * 0.9, ctx.currentTime, 0.05);
  }

  setEq(type: BiquadFilterType, freq: number) {
    this.eqType = type;
    this.eqFreq = freq;
    this.applyEq();
  }

  setResonance(q: number) {
    this.eqQ = clamp(q, 0.1, 24);
    this.applyEq();
  }

  /** gesture modulation of the master cutoff: value 0..1, amount 0..1 */
  setFilterMod(value: number, amount = this.filterModAmount) {
    this.filterMod = clamp(value, 0, 1);
    this.filterModAmount = clamp(amount, 0, 1);
    this.applyEq();
  }

  setDelay(opts: {
    mix?: number;
    feedback?: number;
    sync?: boolean;
    division?: DivisionId;
    time?: number;
  }) {
    if (opts.mix !== undefined) this.delayMix = clamp(opts.mix, 0, 1);
    if (opts.feedback !== undefined) this.delayFeedback = clamp(opts.feedback, 0, 0.85);
    if (opts.sync !== undefined) this.delaySync = opts.sync;
    if (opts.division) this.delayDivision = opts.division;
    if (opts.time !== undefined) this.delayTime = opts.time;
    this.applyDelay();
  }

  setChorus(opts: { mix?: number; depth?: number; rate?: number }) {
    if (opts.mix !== undefined) this.chorusMix = clamp(opts.mix, 0, 1);
    if (opts.depth !== undefined) this.chorusDepth = clamp(opts.depth, 0, 1);
    if (opts.rate !== undefined) this.chorusRate = clamp(opts.rate, 0.05, 6);
    this.applyChorus();
  }

  /** legato/portamento time between chords, in seconds (0 = instant) */
  setLegato(seconds: number | null) {
    this.legato = seconds === null ? null : clamp(seconds, 0, 1.5);
  }

  private applyChorus() {
    this.rack?.setChorus({ mix: this.chorusMix, depth: this.chorusDepth, rate: this.chorusRate });
  }

  private applyReverb() {
    // the hand-control loop calls this every frame: skip inaudible updates
    if (Math.abs(this.reverbAmount - this.lastReverb) < 0.004) return;
    this.lastReverb = this.reverbAmount;
    this.rack?.setReverb({ amount: this.reverbAmount });
  }

  private applyEq() {
    const factor =
      this.filterModAmount > 0 ? 1 + this.filterModAmount * (this.filterMod * 5 - 1.5) : 1;
    const frequency = this.eqFreq * Math.max(0.15, factor);
    if (
      this.lastEqType === this.eqType &&
      Math.abs(this.lastEqQ - this.eqQ) < 0.005 &&
      Math.abs(frequency - this.lastEqFreq) < Math.max(4, frequency * 0.004)
    ) {
      return;
    }
    this.lastEqType = this.eqType;
    this.lastEqQ = this.eqQ;
    this.lastEqFreq = frequency;
    this.rack?.setEq({ type: this.eqType, frequency, q: this.eqQ });
  }

  private applyDelay() {
    const time = this.delaySync ? divisionSeconds(this.delayDivision, this.bpm) : this.delayTime;
    this.rack?.setDelay({ mix: this.delayMix, feedback: this.delayFeedback, time });
  }

  /* ————— arpeggiator ————— */

  get arpEnabled() {
    return this.arp.settings.enabled;
  }
  get arpRate() {
    return this.arp.settings.rate;
  }
  get arpSync() {
    return this.arp.settings.sync;
  }
  get arpDivision() {
    return this.arp.settings.division;
  }
  get arpDegrees() {
    return this.arp.settings.degrees;
  }
  get arpRandom() {
    return this.arp.settings.random;
  }
  get arpGate() {
    return this.arp.settings.gate;
  }
  get arpOctaves() {
    return this.arp.settings.octaves;
  }
  get arpSwing() {
    return this.arp.settings.swing;
  }

  /** effective arpeggiator speed in notes per second */
  effectiveRate() {
    return this.arp.rateHz();
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
    if (opts.enabled === false) {
      this.arp.clear();
      [...this.voices.keys()].forEach((key) => this.releaseVoice(key));
    }
    this.arp.update(opts);
  }

  /** feeds the arpeggiator with the current gesture state for one hand */
  setArpTarget(id: string, degree: number, amount: number, bright: number, inst: InstrumentId) {
    this.arp.setTarget(id, { degree, amount, brightness: bright, instrument: inst });
  }

  clearArpTarget(id: string) {
    if (this.hold) return;
    if (this.arp.clearTarget(id)) this.noteOff(id, true);
  }

  private playArpEvent({ id, target, degreeOffset, octaveOffset, gateSeconds }: ArpEvent) {
    if (!this.ctx) return;
    const midi =
      BASE_MIDI +
      this.rootPc +
      (INSTRUMENT_SHIFT[target.instrument] ?? 0) +
      degreeToSemitones(this.scale, target.degree + degreeOffset) +
      octaveOffset * 12;
    this.pluck(
      id,
      noteToFrequency(midi),
      target.amount,
      target.brightness,
      target.instrument,
      gateSeconds,
    );
  }
}
