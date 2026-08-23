/**
 * Music theory engine.
 * KEY + SCALE + DEGREE -> ROOT NOTE -> CHORD (notes as MIDI numbers).
 * Nessuna nota hardcoded: tutto è calcolato dagli intervalli.
 */

export const KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
export type KeyName = (typeof KEYS)[number];

export type ModeId = "major" | "minor" | "dorian" | "mixolydian";

export const MODES: { id: ModeId; name: string; steps: number[] }[] = [
  { id: "major", name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", name: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "dorian", name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: "mixolydian", name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
];

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export type Tonality = "auto" | "major" | "minor";

export type VoicingId = "triad" | "inv1" | "inv2" | "seventh" | "open";

export const VOICINGS: { id: VoicingId; name: string }[] = [
  { id: "triad", name: "Triade" },
  { id: "inv1", name: "1° rivolto" },
  { id: "inv2", name: "2° rivolto" },
  { id: "seventh", name: "Settima" },
  { id: "open", name: "Aperto" },
];

export function modeSteps(id: ModeId): number[] {
  return MODES.find((m) => m.id === id)?.steps ?? MODES[0]!.steps;
}

/** semitoni sopra la tonica per un grado (supporta gradi oltre l'ottava) */
export function degreeSemitones(steps: number[], degree: number): number {
  const n = steps.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return steps[idx]! + 12 * oct;
}

export function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function pcName(pc: number) {
  return KEYS[((pc % 12) + 12) % 12]!;
}

export function midiName(m: number) {
  return `${pcName(m)}${Math.floor(m / 12) - 1}`;
}

export type Chord = {
  /** 0-based scale degree */
  degree: number;
  rootMidi: number;
  rootName: string;
  quality: "major" | "minor" | "dim" | "sus";
  seventh: boolean;
  notes: number[];
  label: string;
};

export type ChordRequest = {
  rootPc: number;
  mode: ModeId;
  degree: number;
  tonality: Tonality;
  voicing: VoicingId;
  octave?: number;
  /** notes of the previous chord, used for voice leading */
  previous?: number[];
};

function qualityOf(third: number, fifth: number): Chord["quality"] {
  if (fifth === 6) return "dim";
  if (third === 3) return "minor";
  if (third === 4) return "major";
  return "sus";
}

export function buildChord(req: ChordRequest): Chord {
  const steps = modeSteps(req.mode);
  const octave = req.octave ?? 3;
  const base = 12 * (octave + 1) + req.rootPc;
  const rootSemi = degreeSemitones(steps, req.degree);

  let third = degreeSemitones(steps, req.degree + 2) - rootSemi;
  let fifth = degreeSemitones(steps, req.degree + 4) - rootSemi;
  const seventhInt = degreeSemitones(steps, req.degree + 6) - rootSemi;

  if (req.tonality === "major") third = 4;
  if (req.tonality === "minor") third = 3;
  if (req.tonality !== "auto" && fifth === 6) fifth = 7;

  const rootMidi = base + rootSemi;
  const wantSeventh = req.voicing === "seventh";
  let notes = [rootMidi, rootMidi + third, rootMidi + fifth];
  if (wantSeventh) notes.push(rootMidi + seventhInt);

  switch (req.voicing) {
    case "inv1":
      notes = [notes[1]!, notes[2]!, notes[0]! + 12];
      break;
    case "inv2":
      notes = [notes[2]!, notes[0]! + 12, notes[1]! + 12];
      break;
    case "open":
      notes = [rootMidi - 12, rootMidi + fifth, rootMidi + third + 12, rootMidi + seventhInt + 12];
      break;
    default:
      break;
  }

  // voice leading: sposta l'accordo di un'ottava se avvicina il centro precedente
  if (req.previous && req.previous.length) {
    const avg = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
    const prev = avg(req.previous);
    const cur = avg(notes);
    if (cur - prev > 7) notes = notes.map((n) => n - 12);
    else if (prev - cur > 7) notes = notes.map((n) => n + 12);
  }

  const quality = qualityOf(third, fifth);
  const rootName = pcName(rootMidi);
  const suffix =
    quality === "minor" ? "m" : quality === "dim" ? "dim" : quality === "sus" ? "sus" : "";
  return {
    degree: req.degree,
    rootMidi,
    rootName,
    quality,
    seventh: wantSeventh,
    notes: [...new Set(notes)].sort((a, b) => a - b),
    label: `${rootName}${suffix}${wantSeventh ? "7" : ""}`,
  };
}

/** nomi delle 8 note visualizzate nella striscia della scala (I..VII + I') */
export function scaleNoteNames(rootPc: number, mode: ModeId): string[] {
  const steps = modeSteps(mode);
  return Array.from({ length: 8 }, (_, i) => pcName(rootPc + degreeSemitones(steps, i)));
}
