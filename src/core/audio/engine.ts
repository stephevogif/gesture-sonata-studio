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
import { INSTRUMENT_SHIFT, presetOf, type InstrumentId } from "./presets";
import { SynthVoice } from "./voice";

export class HeavenAudioEngine {
  private ctx: AudioContext | null = null;
  private rack: MasterRack | null = null;
  private voices = new Map<string, SynthVoice>();
  private readonly arp: Arpeggiator;

  instrument: InstrumentId = "violin";

  // musical settings
  scale: number[] = scaleSteps("minorPent");
  rootPc = 2; // D
  chordMode: ChordId = "off";
  hold = false;
  bpm = 100;

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

  constructor() {
    this.arp = new Arpeggiator((event) => this.playArpEvent(event));
  }

  /* ————— lifecycle ————— */

  async start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.rack = new MasterRack(ctx);
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
    await this.ctx?.close();
    this.ctx = null;
    this.rack = null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.rack?.analyser ?? null;
  }

  /* ————— voices ————— */

  private voiceFor(id: string, frequency: number, instrument: InstrumentId): SynthVoice | null {
    if (!this.ctx || !this.rack) return null;
    let voice = this.voices.get(id);
    if (voice && voice.instrument !== instrument) {
      voice.release();
      this.voices.delete(id);
      voice = undefined;
    }
    if (!voice) {
      const spec = presetOf(instrument);
      voice = new SynthVoice(this.ctx, spec, frequency, {
        dry: this.rack.master,
        reverb: this.rack.reverbSend,
        delay: this.rack.delaySend,
        chorus: this.rack.chorusSend,
      });
      this.voices.set(id, voice);
    }
    return voice;
  }

  /** sustained note — amount 0..1 loudness, bright 0..1 timbre */
  noteOn(id: string, freq: number, amount: number, bright = 0.5, inst?: InstrumentId) {
    const voice = this.voiceFor(id, freq, inst ?? this.instrument);
    voice?.hold(freq, amount, bright, this.legato ?? undefined);
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
      if (!key.startsWith(`${id}~`)) continue;
      const index = Number(key.slice(id.length + 1));
      if (!Number.isNaN(index) && index >= offsets.length) this.releaseVoice(key);
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
    this.rack?.setReverb({ amount: this.reverbAmount });
  }

  private applyEq() {
    const factor =
      this.filterModAmount > 0 ? 1 + this.filterModAmount * (this.filterMod * 5 - 1.5) : 1;
    this.rack?.setEq({
      type: this.eqType,
      frequency: this.eqFreq * Math.max(0.15, factor),
      q: this.eqQ,
    });
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
