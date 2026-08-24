/**
 * Song Mode — orchestrator on top of Seven Heavens.
 * No second engine: it only reads the already-latched gesture degree and keeps
 * the position inside a degree progression (1..7).
 *
 * V1 = LEARN / MANUAL FOLLOW: nothing is tied to BPM.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findSong } from "@/core/songs/catalog";
import {
  getSongSession,
  setSongSession,
  subscribeSongSession,
  updateSongSession,
} from "@/core/songs/session";
import type { LoopMode, Song, SongSession } from "@/core/songs/types";

export type SongModeState = {
  session: SongSession | null;
  song: Song | null;
  /** transposed root pitch class for the engine */
  rootPc: number | null;
  sectionIndex: number;
  stepIndex: number;
  /** degree numbers 1..7 of the current section */
  degrees: number[];
  current: number | null;
  next: number | null;
  sectionName: string | null;
  loopMode: LoopMode;
  autoAdvance: boolean;
  /** true right after the expected degree was recognized */
  matched: boolean;
  setLoopMode: (mode: LoopMode) => void;
  setAutoAdvance: (on: boolean) => void;
  setSectionIndex: (i: number) => void;
  setTranspose: (semitones: number) => void;
  step: (delta: number) => void;
  reset: () => void;
  exit: () => void;
  /** feed the detected gesture degree (1..7 or null) */
  observe: (detected: number | null) => void;
};

export function useSongMode(): SongModeState {
  const [session, setSession] = useState<SongSession | null>(() => getSongSession());
  const [stepIndex, setStepIndex] = useState(0);
  const [matched, setMatched] = useState(false);
  const matchTimer = useRef<number | null>(null);

  useEffect(() => subscribeSongSession(setSession), []);

  const song = useMemo(() => findSong(session?.songId), [session?.songId]);
  const sectionIndex = Math.min(
    session?.sectionIndex ?? 0,
    Math.max(0, (song?.sections.length ?? 1) - 1),
  );
  const section = song?.sections[sectionIndex] ?? null;
  const degrees = section?.degrees ?? [];
  const loopMode = session?.loopMode ?? "section";
  const autoAdvance = session?.autoAdvance ?? true;

  useEffect(() => {
    setStepIndex(0);
    setMatched(false);
  }, [song?.id, sectionIndex]);

  useEffect(
    () => () => {
      if (matchTimer.current) window.clearTimeout(matchTimer.current);
    },
    [],
  );

  const flash = useCallback(() => {
    setMatched(true);
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
    matchTimer.current = window.setTimeout(() => setMatched(false), 420);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const len = degrees.length || 1;
      setStepIndex((i) => {
        const nextIndex = i + delta;
        if (nextIndex >= 0 && nextIndex < len) return nextIndex;
        if (nextIndex < 0) return loopMode === "off" ? 0 : len - 1;
        /* end of the section */
        if (loopMode === "section") return 0;
        if (!song) return 0;
        const last = song.sections.length - 1;
        if (sectionIndex < last) {
          updateSongSession({ sectionIndex: sectionIndex + 1 });
          return 0;
        }
        if (loopMode === "song") {
          updateSongSession({ sectionIndex: 0 });
          return 0;
        }
        return len - 1;
      });
    },
    [degrees.length, loopMode, sectionIndex, song],
  );

  /* Manual follow: the gesture must be released (or changed) before the same
     degree can trigger again — this is what prevents double triggers. */
  const armedRef = useRef(true);
  const observe = useCallback(
    (detected: number | null) => {
      if (!song) return;
      const expected = degrees[stepIndex];
      if (expected == null) return;
      if (detected === expected) {
        if (!armedRef.current) return;
        armedRef.current = false;
        flash();
        if (autoAdvance) step(1);
      } else {
        armedRef.current = true;
      }
    },
    [autoAdvance, degrees, flash, song, step, stepIndex],
  );

  const rootPc =
    song != null ? ((((song.keyPc + (session?.transpose ?? 0)) % 12) + 12) % 12) : null;

  return {
    session,
    song,
    rootPc,
    sectionIndex,
    stepIndex,
    degrees,
    current: degrees[stepIndex] ?? null,
    next: degrees[(stepIndex + 1) % Math.max(1, degrees.length)] ?? null,
    sectionName: section?.name ?? null,
    loopMode,
    autoAdvance,
    matched,
    setLoopMode: (mode) => updateSongSession({ loopMode: mode }),
    setAutoAdvance: (on) => updateSongSession({ autoAdvance: on }),
    setSectionIndex: (i) => updateSongSession({ sectionIndex: i }),
    setTranspose: (semitones) => updateSongSession({ transpose: semitones }),
    step,
    reset: () => setStepIndex(0),
    exit: () => setSongSession(null),
    observe,
  };
}
