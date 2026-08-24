/**
 * Song Mode — sequence state for Seven Heavens.
 * Manual follow (default) plus an optional tempo-driven advance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findSong } from "@/core/songs/catalog";
import {
  getSongSession,
  setSongSession,
  subscribeSongSession,
  updateSongSession,
} from "@/core/songs/session";
import type { Song, SongSession } from "@/core/songs/types";

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
  loopSection: boolean;
  advance: "manual" | "auto";
  matched: boolean;
  setLoop: (on: boolean) => void;
  setAdvance: (mode: "manual" | "auto") => void;
  setSectionIndex: (i: number) => void;
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
  const sectionIndex = Math.min(session?.sectionIndex ?? 0, Math.max(0, (song?.sections.length ?? 1) - 1));
  const section = song?.sections[sectionIndex] ?? null;
  const degrees = section?.degrees ?? [];

  useEffect(() => {
    setStepIndex(0);
    setMatched(false);
  }, [song?.id, sectionIndex]);

  const advanceStep = useCallback(() => {
    setMatched(true);
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
    matchTimer.current = window.setTimeout(() => setMatched(false), 420);
    setStepIndex((i) => {
      const len = degrees.length || 1;
      if (i + 1 < len) return i + 1;
      if (session?.loopSection || !song) return 0;
      const last = song.sections.length - 1;
      if (sectionIndex < last) {
        updateSongSession({ sectionIndex: sectionIndex + 1 });
        return 0;
      }
      updateSongSession({ sectionIndex: 0 });
      return 0;
    });
  }, [degrees.length, section?.id, sectionIndex, session?.loopSection, song]);

  useEffect(() => () => {
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
  }, []);

  /* manual follow: the expected degree must be released before advancing again */
  const armedRef = useRef(true);
  const observe = useCallback(
    (detected: number | null) => {
      if (!song || session?.advance === "auto") return;
      const expected = degrees[stepIndex];
      if (expected == null) return;
      if (detected === expected) {
        if (armedRef.current) {
          armedRef.current = false;
          advanceStep();
        }
      } else if (detected !== expected) {
        armedRef.current = true;
      }
    },
    [advanceStep, degrees, session?.advance, song, stepIndex],
  );

  /* auto / tempo mode */
  useEffect(() => {
    if (!song || session?.advance !== "auto") return;
    const beats = section?.beatsPerChord ?? 4;
    const ms = (60000 / Math.max(40, song.bpm)) * beats;
    const t = window.setInterval(advanceStep, ms);
    return () => window.clearInterval(t);
  }, [advanceStep, section?.beatsPerChord, session?.advance, song]);

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
    loopSection: session?.loopSection ?? false,
    advance: session?.advance ?? "manual",
    matched,
    setLoop: (on) => updateSongSession({ loopSection: on }),
    setAdvance: (mode) => updateSongSession({ advance: mode }),
    setSectionIndex: (i) => updateSongSession({ sectionIndex: i }),
    reset: () => setStepIndex(0),
    exit: () => setSongSession(null),
    observe,
  };
}
