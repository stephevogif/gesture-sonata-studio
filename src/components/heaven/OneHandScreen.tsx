/**
 * One Hand — schermata dedicata dentro Seven Heavens.
 * UX moderna e pulita: schermo di tracking in alto, slot dita, editor accordi.
 * La maiolica siciliana resta come accento (angoli del frame, bordo dei pulsanti).
 */

import { useMemo } from "react";
import { ArrowLeft, Hand, Play, Square, Sparkles, Wand2 } from "lucide-react";
import { allSongs } from "@/core/songs/catalog";
import { startSongSession } from "@/core/songs/session";
import { slotsFromSong, type OneHandConfig, type PlayMode } from "@/core/gesture/oneHand";
import { ROMAN } from "@/core/music/chords";
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
}: Props) {
  const songs = useMemo(() => allSongs(), []);
  const cover = config.playMode === "cover";
  const activeSlot =
    activeDegree == null ? null : config.slots.indexOf(activeDegree + 1) + 1 || null;

  return (
    <div className="oh-screen fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-4 sm:px-6">
        <div className="oh-frame oh-corners p-4 sm:p-6">
          {/* header */}
          <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <button onClick={onClose} aria-label="Torna a Seven Heavens" className="oh-icon-btn">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <h1 className="oh-title text-[1.7rem] leading-none sm:text-3xl">ONE HAND</h1>
              <p className="oh-kicker mt-1">{cover ? "Easy cover mode" : "Scale mode"}</p>
            </div>
            <button
              onClick={onTogglePlay}
              aria-label={running ? "Stop" : "Play"}
              className="oh-icon-btn oh-icon-btn-primary"
            >
              {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </header>

          {/* scale / cover */}
          <div className="mt-4 flex justify-center">
            <div className="oh-seg" role="tablist" aria-label="Modo di gioco">
              <button
                role="tab"
                aria-selected={!cover}
                onClick={() => setPlayMode("scale")}
                className={`oh-seg-btn ${!cover ? "oh-seg-on" : ""}`}
              >
                Scale
              </button>
              <button
                role="tab"
                aria-selected={cover}
                onClick={() => setPlayMode("cover")}
                className={`oh-seg-btn ${cover ? "oh-seg-on" : ""}`}
              >
                Cover
              </button>
            </div>
          </div>

          {/* schermo di tracking */}
          <div className="oh-viewport mt-4">
            <canvas ref={trackCanvasRef} className="h-full w-full object-cover" />
            {!running && (
              <div className="absolute inset-0 grid place-items-center gap-2 px-6 text-center">
                <div>
                  <Sparkles className="mx-auto h-5 w-5 text-[color:var(--oh-gold)]" />
                  <p className="oh-kicker mt-2">Raise your hand</p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/70">
                    {camError ?? "Premi play: la mano diventa costellazione."}
                  </p>
                </div>
              </div>
            )}
            {running && activeSlot == null && (
              <p className="oh-viewport-hint">{camStatus ?? "Alza la mano…"}</p>
            )}
            <div className="oh-viewport-bar">
              <span className="oh-chip">
                <Hand className="h-3 w-3" /> {config.hand === "any" ? "AUTO" : config.hand.toUpperCase()}
              </span>
              <span className="oh-chip">{keyLabel}</span>
            </div>
          </div>

          {/* accordo corrente */}
          <div className="mt-3 min-h-[3.5rem] text-center">
            {activeSlot ? (
              <div className="animate-fade-in">
                <p className="oh-kicker">
                  {activeSlot} {activeSlot === 1 ? "dito" : "dita"}
                </p>
                <p className="oh-title text-3xl leading-none">
                  {degreeChordLabels[(config.slots[activeSlot - 1] ?? 1) - 1]}
                </p>
              </div>
            ) : (
              <p className="pt-4 text-[11px] font-semibold text-white/45">
                {cover
                  ? "Segui la progressione: ogni accordo ha il suo dito."
                  : "Assegna un accordo a ogni dito e suona libero."}
              </p>
            )}
          </div>

          {/* slot dita */}
          <div className="mt-2 grid grid-cols-5 gap-1.5 sm:gap-2">
            {config.slots.map((degree, i) => (
              <div key={i} className="flex min-w-0 flex-col items-center gap-1">
                <div className={`oh-slot ${activeSlot === i + 1 ? "oh-slot-on" : ""}`}>
                  <span className="text-lg font-bold leading-none sm:text-xl">{i + 1}</span>
                  <span className="text-[10px] font-bold leading-none text-[color:var(--oh-gold)]">
                    {ROMAN[degree - 1]}
                  </span>
                  <span className="text-[10px] font-semibold leading-none text-white/85">
                    {degreeChordLabels[degree - 1]}
                  </span>
                </div>
                <span className="truncate text-[8px] font-bold tracking-[0.14em] text-white/40">
                  {FINGER_NAMES[i]}
                </span>
              </div>
            ))}
          </div>

          {/* mano */}
          <div className="oh-card mt-4 flex items-center gap-2">
            <span className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              Mano
            </span>
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

          {cover ? (
            /* ————— COVER: canzone e progressione ————— */
            <div className="oh-card mt-4 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Canzone
                <select
                  value={songMode.song?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      songMode.exit();
                      return;
                    }
                    startSongSession(id);
                    const song = songs.find((s) => s.id === id) ?? null;
                    const slots = slotsFromSong(song, 0);
                    if (slots) update({ slots, enabled: true, followSong: true });
                  }}
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

              {songMode.song && (
                <>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                      Progressione
                    </span>
                    {songMode.degrees.map((d, i) => {
                      const slot = config.slots.indexOf(d);
                      return (
                        <span key={i} className="oh-dot">
                          {slot < 0 ? "–" : slot + 1}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const slots = slotsFromSong(songMode.song, songMode.sectionIndex);
                      if (slots) update({ slots, enabled: true, followSong: true });
                    }}
                    className="oh-btn"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Auto map song
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ————— SCALE: accordi liberi sulle dita ————— */
            <div className="oh-card mt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                  Slot editor
                </h2>
                <span className="text-[10px] font-semibold text-white/40">{keyLabel}</span>
              </div>
              {config.slots.map((degree, i) => (
                <label key={i} className="flex items-center gap-3">
                  <span className="oh-dot h-8 w-8 text-[13px]">{i + 1}</span>
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

          <button onClick={onTogglePlay} className="oh-btn oh-btn-primary mt-5 w-full !py-4">
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop" : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}
