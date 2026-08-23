/**
 * Compatibility surface for the UI.
 * The real implementation lives in `src/core/*` (clean-room modules):
 *   core/audio  — engine, presets, voices, effects, arpeggiator
 *   core/music  — pitch, scales, chords, patterns
 */

export {
  INSTRUMENTS,
  INSTRUMENT_SHIFT,
  PRESETS,
  presetOf,
  type InstrumentGroup,
  type InstrumentId,
} from "@/core/audio/presets";

export {
  ARP_PATTERNS,
  CHORDS,
  DIVISIONS,
  arpDegrees,
  chordOffsets,
  divisionSeconds,
  type ArpPatternId,
  type ChordId,
  type DivisionId,
} from "@/core/music/patterns";

export {
  SCALES,
  scaleSteps,
  scaleDefinition,
  degreeToSemitones,
  degreeToMidi,
  positionToDegree,
  scaleDegreeNames,
  BASE_MIDI,
  type ScaleId,
  type ScaleDefinition,
} from "@/core/music/scales";

export {
  PITCH_CLASS_NAMES as NOTE_NAMES,
  noteToFrequency as midiToFreq,
  noteLabel as midiToName,
  frequencyToNote,
  clamp,
} from "@/core/music/pitch";

export { HeavenAudioEngine, HeavenAudioEngine as GestureSynthEngine } from "@/core/audio/engine";
