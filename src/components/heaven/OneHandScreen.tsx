/**
 * One Hand — schermata dedicata dentro Seven Heavens.
 * Stessa UI di Seven Heavens, ma in versione tramonto: tracking a tutto
 * schermo dietro, controlli in vetro davanti e barra inferiore in basso.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Play,
  Repeat,
  Sliders,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import { allSongs } from "@/core/songs/catalog";
import { startSongSession } from "@/core/songs/session";
import { slotsFromSong, type OneHandConfig, type PlayMode } from "@/core/gesture/oneHand";
import { ROMAN } from "@/core/music/chords";
import { INSTRUMENTS, type InstrumentId } from "@/core/audio/presets";
import type { SongModeState } from "@/hooks/useSongMode";

const FINGER_NAMES = ["POLLICE", "INDICE", "MEDIO", "ANULARE", "MIGNOLO"];

type Props = {
  config: OneHandConfig;
  update: (patch: Partial<OneHandConfig>) => void;
  degreeChordLabels: string[];
  activeDegree: number | null; // 0-based
  songMode: SongModeState;
  keyLabel: string;
  running: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  trackCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  setPlayMode: (mode: PlayMode) => void;
  camStatus?: string;
  camError?: string | null;
  arpOn?: boolean;
  onToggleArp?: () => void;
  onOpenSound?: () => void;
  instrument?: InstrumentId;
  onInstrumentChange?: (id: InstrumentId) => void;
};

export default function OneHandScreen({
  config,
  update,
  degreeChordLabels,
  activeDegree,
  songMode,
  keyLabel,
  running,
  onTogglePlay,
  onClose,
  trackCanvasRef,
  setPlayMode,
  camStatus,
  camError,
  arpOn = false,
  onToggleArp,
  onOpenSound,
  instrument,
  onInstrumentChange,
}: Props) {
  const songs = useMemo(() => allSongs(), []);
  const cover = config.playMode === "cover";
  const setup = true;
  const activeSlot =
    activeDegree == null ? null : config.slots.indexOf(activeDegree + 1) + 1 || null;

  const pickSong = (id: string) => {
    if (!id) {
      songMode.exit();
      return;
    }
    startSongSession(id);
    const song = songs.find((s) => s.id === id) ?? null;
    const slots = slotsFromSong(song, 0);
    if (slots) update({ slots, enabled: true, followSong: true });
  };

  return (
    <div className="heaven-scene heaven-sunset fixed inset-0 z-40 overflow-y-auto">
      {/* tracking a tutto schermo dietro all'interfaccia */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <canvas ref={trackCanvasRef} className="absolute inset-0 h-full w-full object-cover" />
        <div className="heaven-vignette absolute inset-0" />
      </div>
      <div className="heaven-bottom-shade" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-40 pt-5">
        {/* header — angoli: Seven Heavens | Night */}
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button onClick={onClose} aria-label="Seven Heavens" className="heaven-orb-btn">
            <Sparkles className="h-4 w-4" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85 drop-shadow">
              Steph Evo&apos;s
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85 drop-shadow">
              Heaven Synth
            </p>
          </div>
          <Link to="/night" aria-label="Night Sky" className="heaven-orb-btn">
            <Moon className="h-4 w-4" />
          </Link>
        </header>

        <h1 className="heaven-title mt-5 text-center text-[2.1rem] leading-none sm:text-5xl">
          ONE HAND
        </h1>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="heaven-pill">{keyLabel}</span>
          <span className="heaven-pill !px-4">
            {config.hand === "any" ? "Auto" : config.hand}
          </span>
        </div>

        {/* SCALE / COVER */}
        <div className="mt-3 flex items-center justify-center">
          <div className="heaven-seg" role="tablist" aria-label="Modo di gioco">
            <button
              role="tab"
              aria-selected={!cover}
              onClick={() => setPlayMode("scale")}
              className={`heaven-seg-btn ${!cover ? "heaven-seg-on" : ""}`}
            >
              Scale
            </button>
            <button
              role="tab"
              aria-selected={cover}
              onClick={() => setPlayMode("cover")}
              className={`heaven-seg-btn ${cover ? "heaven-seg-on" : ""}`}
            >
              Cover
            </button>
          </div>
        </div>

        {/* finestra cover: info canzone + cambio canzone */}
        {cover && (
          <div className="heaven-glass mt-4 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/75">Cover</p>
              {songMode.song && (
                <p className="text-[9px] uppercase tracking-[0.24em] text-[#ffe3ab]">
                  {songMode.sectionName} · {songMode.stepIndex + 1}/
                  {Math.max(1, songMode.degrees.length)}
                </p>
              )}
            </div>

            {songMode.song ? (
              <>
                <p className="mt-1 truncate text-lg font-light uppercase tracking-[0.1em] text-white">
                  {songMode.song.title}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.22em] text-white/70">
                  {songMode.song.artist}
                  {songMode.song.bpm ? ` · ${songMode.song.bpm} BPM` : ""}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {songMode.degrees.map((d, i) => {
                    const slot = config.slots.indexOf(d);
                    return (
                      <span
                        key={i}
                        className={`heaven-node !h-7 !w-7 !text-[0.6rem] ${
                          i === songMode.stepIndex ? "heaven-node-on" : ""
                        }`}
                      >
                        {slot < 0 ? "–" : slot + 1}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => songMode.step(-1)}
                    aria-label="Accordo precedente"
                    className="heaven-orb-btn !h-9 !w-9"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 text-center">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-white/70">Ora</p>
                    <p className="truncate text-base font-light uppercase tracking-[0.16em] text-white">
                      {songMode.current ? degreeChordLabels[songMode.current - 1] : "—"}
                      <span className="ml-2 text-[11px] text-white/60">
                        → {songMode.next ? degreeChordLabels[songMode.next - 1] : "—"}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => songMode.step(1)}
                    aria-label="Accordo successivo"
                    className="heaven-orb-btn !h-9 !w-9"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block text-[9px] uppercase tracking-[0.24em] text-white/70">
                    Canzone
                    <select
                      value={songMode.song.id}
                      onChange={(e) => pickSong(e.target.value)}
                      className="oh-field mt-1.5"
                      aria-label="Cambia canzone"
                    >
                      <option value="">Nessuna canzone</option>
                      {songs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} — {s.artist}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[9px] uppercase tracking-[0.24em] text-white/70">
                    Sezione
                    <select
                      value={songMode.sectionIndex}
                      onChange={(e) => songMode.setSectionIndex(Number(e.target.value))}
                      className="oh-field mt-1.5"
                      aria-label="Sezione della canzone"
                    >
                      {songMode.song.sections.map((sec, i) => (
                        <option key={sec.id} value={i}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  onClick={() => {
                    const slots = slotsFromSong(songMode.song, songMode.sectionIndex);
                    if (slots) update({ slots, enabled: true, followSong: true });
                  }}
                  className="heaven-pill mt-3 w-full justify-center !text-[0.7rem]"
                >
                  <Wand2 className="mr-2 h-3.5 w-3.5" />
                  Auto map song
                </button>
              </>
            ) : (
              <label className="mt-2 block text-[9px] uppercase tracking-[0.24em] text-white/70">
                Scegli una canzone
                <select
                  value=""
                  onChange={(e) => pickSong(e.target.value)}
                  className="oh-field mt-1.5"
                  aria-label="Scegli una canzone"
                >
                  <option value="">Nessuna canzone</option>
                  {songs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.artist}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {/* le cinque dita */}
        <div className="relative mt-7 flex items-start justify-between px-1">
          <div className="heaven-thread pointer-events-none absolute inset-x-2 top-[1.1rem]" />
          {config.slots.map((degree, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`heaven-node ${activeSlot === i + 1 ? "heaven-node-on" : ""}`}>
                {i + 1}
              </div>
              <span
                className={`text-[9px] font-semibold tracking-[0.06em] drop-shadow ${
                  activeSlot === i + 1 ? "text-[#fff3d2]" : "text-white/75"
                }`}
              >
                {degreeChordLabels[degree - 1]}
              </span>
              <span className="text-[8px] font-bold tracking-[0.12em] text-white/40">
                {ROMAN[degree - 1]} · {FINGER_NAMES[i]?.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>

        {/* accordo corrente */}
        <div className="mt-10 flex min-h-[190px] flex-col items-center justify-start text-center">
          {activeSlot ? (
            <div key={activeSlot} className="animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-[0.5em] text-white/90 drop-shadow">
                {activeSlot} {activeSlot === 1 ? "dito" : "dita"}
              </p>
              <p className="heaven-title mt-1 text-[4.2rem] leading-[0.9]">
                {ROMAN[(config.slots[activeSlot - 1] ?? 1) - 1]}
              </p>
              <div className="mx-auto mt-3 h-px w-24 bg-white/50" />
              <p className="mt-3 text-2xl font-light uppercase tracking-[0.14em] text-white drop-shadow">
                {degreeChordLabels[(config.slots[activeSlot - 1] ?? 1) - 1]}
              </p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <p className="text-base font-light uppercase tracking-[0.34em] text-white/95 drop-shadow">
                Raise your hand
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-white/70">
                {camError ?? (running ? (camStatus ?? "Alza la mano…") : "Tocca ▶ per iniziare")}
              </p>
              {!running && (
                <button
                  onClick={onTogglePlay}
                  aria-label="Play"
                  className="heaven-play heaven-play-breathe mx-auto mt-6"
                >
                  <Play className="h-7 w-7" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* pannello setup: mano + slot */}
        {setup && (
          <div className="heaven-glass mt-4 space-y-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/70">Mano</span>
              {(["left", "right", "any"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => update({ hand: h })}
                  className={`oh-btn flex-1 ${config.hand === h ? "oh-btn-on" : ""}`}
                >
                  {h === "any" ? "Auto" : h === "left" ? "Left" : "Right"}
                </button>
              ))}
            </div>

            {instrument && onInstrumentChange && (
              <label className="flex items-center gap-3">
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/70">Suono</span>
                <select
                  value={instrument}
                  onChange={(e) => onInstrumentChange(e.target.value as InstrumentId)}
                  className="oh-field flex-1"
                  aria-label="Strumento"
                >
                  {["violin", "winds", "pads"].map((id) => {
                    const it = INSTRUMENTS.find((i) => i.id === id);
                    return it ? (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ) : null;
                  })}
                  {GROUP_ORDER.map((g) => (
                    <optgroup key={g} label={GROUP_LABELS[g]}>
                      {INSTRUMENTS.filter(
                        (i) => i.group === g && !["violin", "winds", "pads"].includes(i.id),
                      ).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}



            {!cover && (
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/70">Slot editor</p>
                {config.slots.map((degree, i) => (
                  <label key={i} className="flex items-center gap-3">
                    <span className="heaven-node !h-8 !w-8 !text-[0.75rem]">{i + 1}</span>
                    <select
                      value={degree}
                      onChange={(e) => {
                        const slots = [...config.slots];
                        slots[i] = Number(e.target.value);
                        update({ slots, followSong: false });
                      }}
                      className="oh-field flex-1"
                      aria-label={`Accordo per ${i + 1} dita`}
                    >
                      {Array.from({ length: 7 }, (_, d) => (
                        <option key={d} value={d + 1}>
                          {ROMAN[d]} · {degreeChordLabels[d]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* barra inferiore: Sound — Play — Arp */}
      <nav className="heaven-navbar">
        <div className="heaven-glass mx-auto grid max-w-md grid-cols-3 items-center gap-2 px-4 py-2">
          <button onClick={onOpenSound} className="heaven-nav">
            <Sliders className="h-5 w-5" />
            Sound
          </button>
          <button
            onClick={onTogglePlay}
            aria-label={running ? "Stop" : "Play"}
            className={`heaven-play mx-auto ${running ? "heaven-play-on" : "heaven-play-breathe"}`}
          >
            {running ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <button
            onClick={onToggleArp}
            aria-pressed={arpOn}
            className={`heaven-nav ${arpOn ? "heaven-nav-on" : ""}`}
          >
            <Repeat className="h-5 w-5" />
            Arp
          </button>
        </div>
      </nav>
    </div>
  );
}
