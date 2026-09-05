/**
 * Heaven Synth — extended instrument bank.
 *
 * Generates 40 instruments for each of the 8 categories
 * (keys, winds, bass, arp, osc, pads, brass, realistic) = 320 patches.
 * Every patch is derived from a per-category base recipe with deterministic
 * seeded variation, so the bank is stable between sessions and every
 * instrument is a valid `PresetSpec` for the voice builder.
 */

import type { InstrumentGroup, PresetSpec } from "./presets";

/** deterministic PRNG so the bank never changes between loads */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
const range = (r: Rand, min: number, max: number) => min + (max - min) * r();
const irange = (r: Rand, min: number, max: number) => Math.round(range(r, min, max));

type CategoryDef = {
  group: InstrumentGroup;
  adjectives: string[];
  nouns: string[];
  blurbs: string[];
  build: (r: Rand, i: number) => Omit<PresetSpec, "id" | "name" | "blurb" | "group">;
};

const WAVES: OscillatorType[] = ["sawtooth", "square", "triangle", "sine"];

/* ————— ricette per categoria ————— */

const keysDef: CategoryDef = {
  group: "keys",
  adjectives: ["Midnight", "Velvet", "Dusty", "Glass", "Amber", "Ivory", "Smoky", "Golden"],
  nouns: ["Piano", "Tines", "Clav", "Organ", "Celesta"],
  blurbs: ["Tastiera morbida", "Attacco dolce, coda lunga", "Timbro vintage", "Suono intimo"],
  build: (r) => {
    const fm = r() > 0.5 ? { ratio: pick(r, [2, 3, 4, 7]), index: range(r, 0.4, 2.2) } : undefined;
    return {
      transpose: pick(r, [0, 0, 0, 12]),
      partials: [
        { wave: pick(r, ["triangle", "sine"]), level: range(r, 0.4, 0.6) },
        { wave: "sine", ratio: 2, detune: irange(r, -5, 5), level: range(r, 0.15, 0.3) },
        { wave: "sine", ratio: pick(r, [3, 4, 5.02]), level: range(r, 0.04, 0.14) },
      ],
      fm,
      filter: { type: "lowpass", cutoff: irange(r, 1800, 5200), q: range(r, 0.6, 1.4) },
      env: {
        attack: range(r, 0.003, 0.03),
        release: range(r, 0.8, 2.4),
        sustain: range(r, 0.1, 0.26),
        decay: range(r, 0.5, 1.3),
      },
      vibrato: { rate: range(r, 0.4, 4.5), cents: range(r, 1, 3) },
      glide: range(r, 0.04, 0.07),
      keys: true,
    };
  },
};

const windsDef: CategoryDef = {
  group: "winds",
  adjectives: ["Misty", "Breath", "Reed", "Air", "Dune", "River", "Cedar", "Willow"],
  nouns: ["Flute", "Clarinet", "Oboe", "Panpipe", "Shakuhachi"],
  blurbs: ["Fiato legnoso", "Soffio arioso", "Ancia espressiva", "Vento morbido"],
  build: (r) => ({
    transpose: pick(r, [0, 0, -5, -12]),
    partials: [
      { wave: pick(r, ["triangle", "sine"]), level: range(r, 0.45, 0.65) },
      { wave: "sine", detune: irange(r, -7, 7), level: range(r, 0.25, 0.45) },
      { wave: pick(r, ["sine", "triangle"]), ratio: 2, level: range(r, 0.05, 0.18) },
    ],
    filter: { type: "lowpass", cutoff: irange(r, 1200, 2600), q: range(r, 0.8, 2.2) },
    env: { attack: range(r, 0.06, 0.22), release: range(r, 0.18, 0.6) },
    vibrato: { rate: range(r, 3.8, 5.4), cents: range(r, 5, 11) },
    noise: { level: range(r, 0.02, 0.09), ratio: range(r, 1.5, 3), q: range(r, 0.6, 1.2) },
    glide: range(r, 0.07, 0.12),
  }),
};

const bassDef: CategoryDef = {
  group: "bass",
  adjectives: ["Deep", "Rubber", "Moog", "Warm", "Dirty", "Round", "Heavy", "Velvet"],
  nouns: ["Sub", "Reese", "Acid", "Pluck Bass", "Sine Bass"],
  blurbs: ["Basso profondo", "Punch e corpo", "Fondo morbido", "Groove potente"],
  build: (r) => {
    const dirty = r() > 0.5;
    return {
      transpose: pick(r, [-12, -24, -24]),
      partials: dirty
        ? [
            { wave: "sawtooth", detune: irange(r, -18, -6), level: range(r, 0.35, 0.5) },
            { wave: "sawtooth", detune: irange(r, 6, 18), level: range(r, 0.35, 0.5) },
            { wave: "square", ratio: 0.5, level: range(r, 0.15, 0.3) },
          ]
        : [
            { wave: "sine", level: range(r, 0.6, 0.9) },
            { wave: "triangle", ratio: 2, level: range(r, 0.1, 0.25) },
          ],
      fm: !dirty && r() > 0.5 ? { ratio: pick(r, [1, 2]), index: range(r, 1, 4) } : undefined,
      filter: { type: "lowpass", cutoff: irange(r, 300, 1400), q: range(r, 1, 10) },
      env: { attack: range(r, 0.004, 0.03), release: range(r, 0.1, 0.5) },
      vibrato: { rate: range(r, 0.1, 0.5), cents: range(r, 1, 6) },
      drive: dirty ? { amount: range(r, 0.3, 1), level: range(r, 0.55, 0.85) } : undefined,
      cutoffLfo:
        dirty && r() > 0.5
          ? { wave: pick(r, WAVES), rate: range(r, 1.5, 6), depth: irange(r, 300, 900) }
          : undefined,
      subOctave: 0.55,
      glide: 0.04,
      bass: true,
    };
  },
};

const arpDef: CategoryDef = {
  group: "arp",
  adjectives: ["Neon", "Crystal", "Pixel", "Laser", "Echo", "Digital", "Silver", "Turbo"],
  nouns: ["Pluck", "Blip", "Stab", "Sequence", "Chip"],
  blurbs: ["Pluck per arpeggi", "Secco e ritmico", "Ideale con l'arp", "Attacco istantaneo"],
  build: (r) => ({
    transpose: pick(r, [0, 12, 12]),
    partials: [
      { wave: pick(r, ["square", "sawtooth"]), level: range(r, 0.35, 0.55) },
      { wave: "triangle", ratio: 2, detune: irange(r, -7, 7), level: range(r, 0.15, 0.3) },
    ],
    fm: r() > 0.5 ? { ratio: pick(r, [2, 3, 5]), index: range(r, 0.8, 2.5) } : undefined,
    filter: { type: "lowpass", cutoff: irange(r, 2400, 5600), q: range(r, 1.5, 5) },
    env: {
      attack: range(r, 0.002, 0.01),
      release: range(r, 0.25, 0.8),
      sustain: range(r, 0.05, 0.16),
      decay: range(r, 0.12, 0.4),
    },
    vibrato: { rate: range(r, 3, 6), cents: range(r, 1, 3) },
    glide: range(r, 0.03, 0.07),
  }),
};

const oscDef: CategoryDef = {
  group: "osc",
  adjectives: ["Analog", "Vintage", "Modular", "Raw", "Pulse", "Drift", "Circuit", "Mono"],
  nouns: ["Lead", "Saw", "Square", "Sync", "PWM"],
  blurbs: ["Oscillatore puro", "Lead analogico", "Timbro sintetico", "Suono da synth classico"],
  build: (r) => {
    const spread = irange(r, 6, 24);
    return {
      transpose: pick(r, [0, 0, -12]),
      partials: [
        { wave: pick(r, WAVES), detune: -spread, level: range(r, 0.18, 0.32) },
        { wave: pick(r, WAVES), detune: spread, level: range(r, 0.18, 0.32) },
        { wave: pick(r, ["sawtooth", "square"]), level: range(r, 0.2, 0.35) },
        { wave: "sine", ratio: 0.5, level: range(r, 0.1, 0.2) },
      ],
      filter: { type: "lowpass", cutoff: irange(r, 1200, 4000), q: range(r, 1, 8) },
      env: {
        attack: range(r, 0.01, 0.15),
        release: range(r, 0.3, 0.9),
        sustain: r() > 0.5 ? range(r, 0.4, 0.7) : undefined,
        decay: range(r, 0.3, 0.6),
      },
      vibrato: { rate: range(r, 3, 6), cents: range(r, 4, 18) },
      drive: r() > 0.6 ? { amount: range(r, 0.2, 0.6), level: range(r, 0.7, 0.9) } : undefined,
      glide: range(r, 0.05, 0.12),
    };
  },
};

const padsDef: CategoryDef = {
  group: "pads",
  adjectives: ["Cloud", "Aurora", "Ocean", "Dream", "Solar", "Lunar", "Mist", "Heaven"],
  nouns: ["Pad", "String Machine", "Atmosphere", "Drone", "Wash"],
  blurbs: ["Tappeto ampio", "Atmosfera lenta", "Respiro lungo", "Sfondo caldo"],
  build: (r) => {
    const spread = irange(r, 6, 16);
    return {
      transpose: pick(r, [0, 0, -12]),
      partials: [
        { wave: "sawtooth", detune: -spread, level: range(r, 0.15, 0.3) },
        { wave: "sawtooth", detune: spread, level: range(r, 0.15, 0.3) },
        { wave: pick(r, ["sine", "triangle"]), level: range(r, 0.25, 0.4) },
        { wave: "sine", ratio: 2, level: range(r, 0.05, 0.15) },
      ],
      filter: { type: "lowpass", cutoff: irange(r, 800, 2200), q: range(r, 0.8, 2) },
      env: { attack: range(r, 0.5, 1.6), release: range(r, 1.2, 3) },
      vibrato: { rate: range(r, 0.3, 0.9), cents: range(r, 4, 12) },
      noise: r() > 0.6 ? { level: range(r, 0.01, 0.03), ratio: 2, q: 1 } : undefined,
      glide: range(r, 0.15, 0.3),
    };
  },
};

const brassDef: CategoryDef = {
  group: "brass",
  adjectives: ["Bold", "Mellow", "Brass", "Herald", "Amber", "Noble", "Wide", "Soft"],
  nouns: ["Trumpet", "Trombone", "Horn", "Tuba", "Section"],
  blurbs: ["Ottone brillante", "Fiato caldo", "Sezione compatta", "Timbro dorato"],
  build: (r) => ({
    transpose: pick(r, [0, 0, -5, -12]),
    partials: [
      { wave: "sawtooth", level: range(r, 0.4, 0.55) },
      { wave: "sawtooth", detune: irange(r, 4, 10), level: range(r, 0.2, 0.35) },
      { wave: "square", ratio: 0.5, level: range(r, 0.08, 0.18) },
    ],
    filter: { type: "lowpass", cutoff: irange(r, 1400, 3200), q: range(r, 1.5, 4) },
    env: { attack: range(r, 0.05, 0.18), release: range(r, 0.2, 0.6) },
    vibrato: { rate: range(r, 4.5, 5.8), cents: range(r, 6, 14) },
    noise: { level: range(r, 0.015, 0.05), ratio: range(r, 1.5, 2.5), q: 1 },
    glide: range(r, 0.06, 0.1),
  }),
};

const realisticDef: CategoryDef = {
  group: "realistic",
  adjectives: ["Solo", "Chamber", "Warm", "Baroque", "Muted", "Sweet", "Deep", "Antique"],
  nouns: ["Violin", "Viola", "Cello", "Guitar", "Marimba"],
  blurbs: ["Strumento realistico", "Timbro acustico", "Suono naturale", "Calmo e organico"],
  build: (r) => {
    const plucked = r() > 0.6;
    return {
      transpose: pick(r, [0, 0, -5, -12, 12]),
      partials: plucked
        ? [
            { wave: "triangle", level: range(r, 0.45, 0.6) },
            { wave: "sine", ratio: pick(r, [2, 2.76, 3]), level: range(r, 0.15, 0.3) },
            { wave: "sine", ratio: pick(r, [4, 5.4]), level: range(r, 0.05, 0.12) },
          ]
        : [
            { wave: "sawtooth", level: range(r, 0.35, 0.5) },
            { wave: "triangle", detune: irange(r, -6, 6), level: range(r, 0.2, 0.3) },
            { wave: "sine", ratio: pick(r, [0.5, 2]), level: range(r, 0.1, 0.18) },
          ],
      filter: {
        type: "lowpass",
        cutoff: plucked ? irange(r, 2600, 4800) : irange(r, 1200, 2600),
        q: range(r, 1, 2.6),
      },
      env: plucked
        ? {
            attack: range(r, 0.003, 0.01),
            release: range(r, 0.5, 1.2),
            sustain: range(r, 0.06, 0.14),
            decay: range(r, 0.25, 0.6),
          }
        : { attack: range(r, 0.12, 0.35), release: range(r, 0.6, 1.4) },
      vibrato: plucked
        ? { rate: range(r, 1, 3), cents: range(r, 1, 2) }
        : { rate: range(r, 4.2, 5.4), cents: range(r, 7, 13) },
      noise: plucked
        ? undefined
        : { level: range(r, 0.015, 0.035), ratio: range(r, 2, 3.2), q: range(r, 1, 1.6) },
      glide: range(r, 0.06, 0.12),
    };
  },
};

const CATEGORIES: CategoryDef[] = [
  keysDef,
  windsDef,
  bassDef,
  arpDef,
  oscDef,
  padsDef,
  brassDef,
  realisticDef,
];

/** 320 presets: 8 categories × 40 deterministic patches. */
export function buildBank(): PresetSpec[] {
  const out: PresetSpec[] = [];
  CATEGORIES.forEach((def, ci) => {
    const r = mulberry32(1234 + ci * 7919);
    let n = 0;
    for (const adj of def.adjectives) {
      for (const noun of def.nouns) {
        const spec = def.build(r, n);
        out.push({
          ...spec,
          id: `bk_${def.group}_${n}` as PresetSpec["id"],
          name: `${adj} ${noun}`,
          blurb: pick(r, def.blurbs),
          group: def.group,
        });
        n++;
      }
    }
  });
  return out;
}
