/**
 * Loop pedal a eventi (non audio grezzo): 4 tracce, griglia a sedicesimi.
 */

export const STEPS_PER_BAR = 16;

export type LoopEvent = {
  step: number;
  notes: number[];
  label: string;
  volume: number;
  filter: number;
  muted?: boolean;
};

export type LoopTrack = {
  id: number;
  events: LoopEvent[];
  mute: boolean;
  solo: boolean;
  volume: number;
};

export type LooperState = {
  playing: boolean;
  recording: boolean;
  countIn: boolean;
  step: number;
  tracks: LoopTrack[];
  selected: number;
};

export function emptyTracks(): LoopTrack[] {
  return [0, 1, 2, 3].map((id) => ({ id, events: [], mute: false, solo: false, volume: 0.8 }));
}

export type LooperOptions = {
  bpm: number;
  bars: number;
  /** suona un evento registrato */
  onEvent: (track: LoopTrack, ev: LoopEvent) => void;
  /** click del metronomo */
  onClick?: (step: number, countIn: boolean) => void;
  /** richiesta dello stato musicale corrente durante la registrazione */
  capture?: () => Omit<LoopEvent, "step"> | null;
  onState: (patch: Partial<LooperState>) => void;
};

export class Looper {
  tracks: LoopTrack[] = emptyTracks();
  bpm = 100;
  bars = 2;
  playing = false;
  recording = false;
  countIn = false;
  step = 0;
  selected = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private countRemaining = 0;
  private lastCaptured = "";

  constructor(private opts: LooperOptions) {
    this.bpm = opts.bpm;
    this.bars = opts.bars;
  }

  get totalSteps() {
    return this.bars * STEPS_PER_BAR;
  }

  private stepMs() {
    return 60000 / Math.max(30, this.bpm) / 4;
  }

  private emit() {
    this.opts.onState({
      playing: this.playing,
      recording: this.recording,
      countIn: this.countIn,
      step: this.step,
      tracks: this.tracks.map((t) => ({ ...t, events: [...t.events] })),
      selected: this.selected,
    });
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), this.stepMs());
    }
  }

  setBars(bars: number) {
    this.bars = bars;
    this.emit();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.timer = setInterval(() => this.tick(), this.stepMs());
    this.emit();
  }

  pause() {
    this.playing = false;
    this.recording = false;
    this.countIn = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit();
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  record(track = this.selected) {
    this.selected = track;
    this.tracks[track]!.events = [];
    this.countIn = true;
    this.countRemaining = STEPS_PER_BAR;
    if (!this.playing) {
      this.playing = true;
      this.step = 0;
      this.timer = setInterval(() => this.tick(), this.stepMs());
    }
    this.emit();
  }

  stopRecording() {
    this.recording = false;
    this.countIn = false;
    this.emit();
  }

  select(i: number) {
    this.selected = Math.max(0, Math.min(3, i));
    this.emit();
  }

  toggleMute(i = this.selected) {
    const t = this.tracks[i]!;
    t.mute = !t.mute;
    this.emit();
  }

  toggleSolo(i = this.selected) {
    const t = this.tracks[i]!;
    t.solo = !t.solo;
    this.emit();
  }

  setVolume(i: number, v: number) {
    this.tracks[i]!.volume = v;
    this.emit();
  }

  clear(i = this.selected) {
    this.tracks[i]!.events = [];
    this.emit();
  }

  clearAll() {
    this.tracks = emptyTracks();
    this.emit();
  }

  toggleCell(track: number, step: number) {
    const t = this.tracks[track]!;
    const ev = t.events.find((e) => e.step === step);
    if (ev) ev.muted = !ev.muted;
    this.emit();
  }

  private tick() {
    if (this.countIn) {
      this.opts.onClick?.(STEPS_PER_BAR - this.countRemaining, true);
      this.countRemaining -= 1;
      if (this.countRemaining <= 0) {
        this.countIn = false;
        this.recording = true;
        this.step = 0;
        this.lastCaptured = "";
        this.emit();
      }
      return;
    }

    const step = this.step;
    const anySolo = this.tracks.some((t) => t.solo);

    if (this.recording) {
      const cap = this.opts.capture?.();
      if (cap && cap.notes.length) {
        const key = cap.notes.join(",");
        const track = this.tracks[this.selected]!;
        const isNew = key !== this.lastCaptured;
        if (isNew || step % 4 === 0) {
          track.events = track.events.filter((e) => e.step !== step);
          track.events.push({ step, ...cap });
          this.lastCaptured = key;
        }
      }
    }

    for (const t of this.tracks) {
      if (t.mute || (anySolo && !t.solo)) continue;
      if (this.recording && t.id === this.selected) continue;
      for (const ev of t.events) {
        if (ev.step === step && !ev.muted) this.opts.onEvent(t, ev);
      }
    }

    this.opts.onClick?.(step, false);
    this.step = (step + 1) % this.totalSteps;

    if (this.recording && this.step === 0) {
      this.recording = false;
      this.lastCaptured = "";
    }
    this.opts.onState({ step: this.step, recording: this.recording, tracks: this.tracks.map((t) => ({ ...t, events: [...t.events] })) });
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
