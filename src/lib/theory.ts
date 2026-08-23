/**
 * Compatibility surface for the UI — real implementation in `src/core/music/*`.
 */

export {
  KEYS,
  MODES,
  ROMAN,
  VOICINGS,
  buildChord,
  chordFrequencies,
  chordIntervals,
  midiName,
  midiToFreq,
  modeSteps,
  scaleNoteNames,
  type Chord,
  type ChordQuality,
  type ChordRequest,
  type KeyName,
  type ModeId,
  type Tonality,
  type VoicingId,
} from "@/core/music/chords";

export {
  PITCH_CLASS_NAMES,
  pitchClassName as pcName,
  noteToFrequency,
  noteLabel,
} from "@/core/music/pitch";

export { degreeToSemitones as degreeSemitones } from "@/core/music/scales";
