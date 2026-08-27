/**
 * Heaven Synth — instrument presets.
 * Layer: Synth / Audio Engine (data only).
 *
 * Every patch is a declarative description of a voice. The voice builder in
 * `voice.ts` knows how to realise any of these specs, so adding an instrument
 * never means adding audio graph code.
 */

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
  | "subpad"
  | "chamberStrings"
  | "cineStrings"
  | "viola"
  | "cello"
  | "grandPiano"
  | "feltPiano"
  | "rhodes"
  | "celesta";

export type InstrumentGroup = "zen" | "electro" | "strings" | "keys";


export type PartialSpec = {
  wave: OscillatorType;
  /** frequency multiplier over the played note */
  ratio?: number;
  /** detune in cents */
  detune?: number;
  level: number;
};

export type PresetSpec = {
  id: InstrumentId;
  name: string;
  blurb: string;
  group: InstrumentGroup;
  /** semitone transpose applied when the patch plays (bass patches sit lower) */
  transpose: number;
  partials: PartialSpec[];
  filter: { type: BiquadFilterType; cutoff: number; q: number };
  /** attack / release are one-pole time constants in seconds */
  env: { attack: number; release: number; sustain?: number; decay?: number };
  vibrato: { rate: number; cents: number };
  /** simple FM operator modulating the first partial */
  fm?: { ratio: number; index: number };
  /** breath / bow noise blended into the filter input */
  noise?: { level: number; ratio: number; q: number };
  /** waveshaper saturation */
  drive?: { amount: number; level: number };
  /** cutoff wobble */
  cutoffLfo?: { wave: OscillatorType; rate: number; depth: number };
  /** adds a sine one octave below, straight into the voice gain */
  subOctave?: number;
  /** short downward pitch sweep at note start */
  pitchDrop?: { from: number; seconds: number };
  /** portamento time constant */
  glide: number;
  /** bass patches stay dry and get more headroom */
  bass?: boolean;
  /** piano-family patch: reacts to the pedal / brightness / lid controls */
  keys?: boolean;

};

const PRESET_LIST: PresetSpec[] = [
  {
    id: "harp",
    name: "Arpa di cristallo",
    blurb: "Pizzicato brillante, coda lunga",
    group: "zen",
    transpose: 12,
    partials: [
      { wave: "triangle", level: 0.5 },
      { wave: "sine", ratio: 2, detune: 4, level: 0.35 },
      { wave: "sine", ratio: 3, detune: -4, level: 0.12 },
    ],
    filter: { type: "lowpass", cutoff: 5200, q: 0.7 },
    env: { attack: 0.006, release: 1.1, sustain: 0.12, decay: 0.55 },
    vibrato: { rate: 3.2, cents: 2 },
    glide: 0.08,
  },
  {
    id: "piano",
    name: "Pianoforte notturno",
    blurb: "Feltro morbido, attacco dolce",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "triangle", level: 0.55 },
      { wave: "sine", ratio: 2, level: 0.3 },
      { wave: "sine", ratio: 4, detune: 3, level: 0.1 },
    ],
    filter: { type: "lowpass", cutoff: 3200, q: 0.6 },
    env: { attack: 0.02, release: 1.4, sustain: 0.2, decay: 0.9 },
    vibrato: { rate: 1.2, cents: 1 },
    glide: 0.08,
  },
  {
    id: "kalimba",
    name: "Kalimba",
    blurb: "Pizzicato legnoso, meditativo",
    group: "zen",
    transpose: 12,
    partials: [
      { wave: "sine", level: 0.6 },
      { wave: "sine", ratio: 2.76, level: 0.18 },
      { wave: "sine", ratio: 5.4, level: 0.08 },
    ],
    filter: { type: "lowpass", cutoff: 4200, q: 1 },
    env: { attack: 0.004, release: 0.7, sustain: 0.08, decay: 0.28 },
    vibrato: { rate: 2.4, cents: 1 },
    glide: 0.08,
  },
  {
    id: "bowl",
    name: "Campane tibetane",
    blurb: "Metallo profondo, note infinite",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "sine", level: 0.5 },
      { wave: "sine", ratio: 2.4, level: 0.24 },
      { wave: "sine", ratio: 4.3, level: 0.14 },
      { wave: "sine", ratio: 6.7, detune: 6, level: 0.08 },
    ],
    filter: { type: "lowpass", cutoff: 3000, q: 1 },
    env: { attack: 0.25, release: 3.2, sustain: 0.45, decay: 2.4 },
    vibrato: { rate: 0.45, cents: 4 },
    glide: 0.1,
  },
  {
    id: "glocken",
    name: "Glockenspiel",
    blurb: "Cristallino e luminoso",
    group: "zen",
    transpose: 24,
    partials: [
      { wave: "sine", level: 0.5 },
      { wave: "sine", ratio: 3.01, level: 0.28 },
      { wave: "sine", ratio: 6.2, level: 0.12 },
    ],
    filter: { type: "lowpass", cutoff: 8000, q: 1 },
    env: { attack: 0.003, release: 1.6, sustain: 0.1, decay: 0.5 },
    vibrato: { rate: 1.6, cents: 1 },
    glide: 0.08,
  },
  {
    id: "choir",
    name: "Coro etereo",
    blurb: "Voci ampie e riverberate",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "sawtooth", detune: -8, level: 0.18 },
      { wave: "sawtooth", detune: 8, level: 0.18 },
      { wave: "triangle", level: 0.3 },
      { wave: "sine", ratio: 2, level: 0.2 },
    ],
    filter: { type: "lowpass", cutoff: 1600, q: 2.5 },
    env: { attack: 0.55, release: 1.8 },
    vibrato: { rate: 4.8, cents: 7 },
    glide: 0.12,
  },
  {
    id: "violin",
    name: "Violino",
    blurb: "Archi espressivi con vibrato",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "sawtooth", level: 0.55 },
      { wave: "sawtooth", detune: 7, level: 0.35 },
    ],
    filter: { type: "lowpass", cutoff: 2600, q: 3 },
    env: { attack: 0.14, release: 0.28 },
    vibrato: { rate: 5.6, cents: 16 },
    glide: 0.08,
  },
  {
    id: "winds",
    name: "Fiati",
    blurb: "Legni ariosi e soffiati",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "triangle", level: 0.6 },
      { wave: "sine", detune: -5, level: 0.4 },
    ],
    filter: { type: "lowpass", cutoff: 1800, q: 1 },
    env: { attack: 0.09, release: 0.2 },
    vibrato: { rate: 4.4, cents: 8 },
    noise: { level: 0.05, ratio: 2, q: 0.8 },
    glide: 0.08,
  },
  {
    id: "pads",
    name: "Pads",
    blurb: "Tappeti ampi e riverberati",
    group: "zen",
    transpose: 0,
    partials: [
      { wave: "sawtooth", detune: -9, level: 0.3 },
      { wave: "sawtooth", detune: 9, level: 0.3 },
      { wave: "sine", level: 0.4 },
    ],
    filter: { type: "lowpass", cutoff: 1400, q: 1 },
    env: { attack: 0.9, release: 1.6 },
    vibrato: { rate: 0.6, cents: 10 },
    glide: 0.25,
  },
  {
    id: "pluckAmb",
    name: "Ambient pluck",
    blurb: "Pluck digitale downtempo",
    group: "electro",
    transpose: 12,
    partials: [
      { wave: "square", level: 0.3 },
      { wave: "triangle", detune: 7, level: 0.35 },
      { wave: "sine", ratio: 2, detune: -7, level: 0.2 },
    ],
    filter: { type: "lowpass", cutoff: 3600, q: 2 },
    env: { attack: 0.005, release: 0.9, sustain: 0.14, decay: 0.35 },
    vibrato: { rate: 5, cents: 3 },
    glide: 0.08,
  },
  {
    id: "subpad",
    name: "Warm sub pad",
    blurb: "Basso morbido e continuo",
    group: "electro",
    transpose: -12,
    partials: [
      { wave: "sine", level: 0.55 },
      { wave: "triangle", detune: -6, level: 0.2 },
      { wave: "sine", ratio: 2, detune: 6, level: 0.18 },
    ],
    filter: { type: "lowpass", cutoff: 900, q: 0.8 },
    env: { attack: 0.7, release: 1.8 },
    vibrato: { rate: 0.35, cents: 4 },
    glide: 0.12,
  },
  {
    id: "reese",
    name: "Reese Bass",
    blurb: "Basso detunato, sporco e profondo",
    group: "electro",
    transpose: -24,
    partials: [
      { wave: "sawtooth", detune: -14, level: 0.5 },
      { wave: "sawtooth", detune: 14, level: 0.5 },
      { wave: "sawtooth", level: 0.35 },
    ],
    filter: { type: "lowpass", cutoff: 900, q: 6 },
    env: { attack: 0.02, release: 0.18 },
    vibrato: { rate: 0.25, cents: 6 },
    drive: { amount: 0.55, level: 0.8 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "acid",
    name: "Acid 303",
    blurb: "Squelch acido con filtro urlante",
    group: "electro",
    transpose: -12,
    partials: [
      { wave: "sawtooth", level: 0.7 },
      { wave: "square", detune: -6, level: 0.3 },
    ],
    filter: { type: "lowpass", cutoff: 700, q: 18 },
    env: { attack: 0.008, release: 0.12 },
    vibrato: { rate: 0.1, cents: 2 },
    drive: { amount: 0.8, level: 0.7 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "growl",
    name: "Growl / Dubstep",
    blurb: "Wobble aggressivo e distorto",
    group: "electro",
    transpose: -24,
    partials: [
      { wave: "square", detune: -10, level: 0.45 },
      { wave: "sawtooth", detune: 10, level: 0.45 },
    ],
    filter: { type: "lowpass", cutoff: 600, q: 12 },
    env: { attack: 0.01, release: 0.14 },
    vibrato: { rate: 0.2, cents: 4 },
    drive: { amount: 0.95, level: 0.6 },
    cutoffLfo: { wave: "sine", rate: 5.5, depth: 700 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "neuro",
    name: "Neuro Bass",
    blurb: "Saw distorto con filtro formante",
    group: "electro",
    transpose: -24,
    partials: [
      { wave: "sawtooth", detune: -18, level: 0.4 },
      { wave: "sawtooth", detune: 18, level: 0.4 },
      { wave: "square", ratio: 0.5, level: 0.25 },
    ],
    filter: { type: "lowpass", cutoff: 800, q: 10 },
    env: { attack: 0.012, release: 0.16 },
    vibrato: { rate: 0.3, cents: 5 },
    drive: { amount: 1.2, level: 0.55 },
    cutoffLfo: { wave: "triangle", rate: 3.2, depth: 900 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "fmbass",
    name: "FM Bass",
    blurb: "FM profonda, attacco secco",
    group: "electro",
    transpose: -24,
    partials: [{ wave: "sine", level: 0.8 }],
    fm: { ratio: 2, index: 3 },
    filter: { type: "lowpass", cutoff: 1200, q: 4 },
    env: { attack: 0.005, release: 0.2 },
    vibrato: { rate: 0.2, cents: 2 },
    drive: { amount: 0.4, level: 0.85 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "sub808",
    name: "808 Sub",
    blurb: "Sub caldo con pitch drop",
    group: "electro",
    transpose: -24,
    partials: [{ wave: "sine", level: 0.95 }],
    filter: { type: "lowpass", cutoff: 400, q: 1 },
    env: { attack: 0.006, release: 0.9 },
    vibrato: { rate: 0.1, cents: 1 },
    drive: { amount: 0.25, level: 0.95 },
    pitchDrop: { from: 2.2, seconds: 0.08 },
    subOctave: 0.55,
    glide: 0.04,
    bass: true,
  },
  {
    id: "hoover",
    name: "Hoover / Rave Stab",
    blurb: "Stab rave urlante",
    group: "electro",
    transpose: 0,
    partials: [
      { wave: "sawtooth", detune: -22, level: 0.28 },
      { wave: "sawtooth", detune: 22, level: 0.28 },
      { wave: "square", ratio: 0.5, level: 0.2 },
      { wave: "sawtooth", ratio: 2, level: 0.2 },
    ],
    filter: { type: "lowpass", cutoff: 1800, q: 9 },
    env: { attack: 0.02, release: 0.5, sustain: 0.5, decay: 0.4 },
    vibrato: { rate: 5.5, cents: 22 },
    glide: 0.08,
  },
  {
    id: "supersaw",
    name: "Supersaw Trance",
    blurb: "7 saw detunati, brillante",
    group: "electro",
    transpose: 0,
    partials: [
      { wave: "sawtooth", detune: -24, level: 0.16 },
      { wave: "sawtooth", detune: -14, level: 0.16 },
      { wave: "sawtooth", detune: -6, level: 0.16 },
      { wave: "sawtooth", level: 0.2 },
      { wave: "sawtooth", detune: 6, level: 0.16 },
      { wave: "sawtooth", detune: 14, level: 0.16 },
      { wave: "sawtooth", detune: 24, level: 0.16 },
    ],
    filter: { type: "lowpass", cutoff: 3400, q: 1.5 },
    env: { attack: 0.12, release: 0.7 },
    vibrato: { rate: 0.4, cents: 6 },
    glide: 0.08,
  },
  {
    id: "digipluck",
    name: "Digital Pluck",
    blurb: "Pluck secco per arp veloci",
    group: "electro",
    transpose: 12,
    partials: [
      { wave: "square", level: 0.45 },
      { wave: "triangle", ratio: 2, detune: 5, level: 0.25 },
    ],
    fm: { ratio: 3, index: 1.5 },
    filter: { type: "lowpass", cutoff: 4200, q: 2.5 },
    env: { attack: 0.003, release: 0.45, sustain: 0.06, decay: 0.18 },
    vibrato: { rate: 4, cents: 2 },
    glide: 0.08,
  },
];

export const PRESETS: Record<InstrumentId, PresetSpec> = PRESET_LIST.reduce(
  (map, preset) => {
    map[preset.id] = preset;
    return map;
  },
  {} as Record<InstrumentId, PresetSpec>,
);

/** Catalogue used by the instrument pickers. */
export const INSTRUMENTS = PRESET_LIST.map(({ id, name, blurb, group }) => ({
  id,
  name,
  blurb,
  group,
}));

/** Transpose table exposed to the UI/looper so notes are drawn at pitch. */
export const INSTRUMENT_SHIFT = PRESET_LIST.reduce(
  (map, preset) => {
    map[preset.id] = preset.transpose;
    return map;
  },
  {} as Record<InstrumentId, number>,
);

export function presetOf(id: InstrumentId): PresetSpec {
  return PRESETS[id] ?? PRESETS.violin;
}
