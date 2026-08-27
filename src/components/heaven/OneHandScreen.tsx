/**
 * One Hand — schermata dedicata dentro Seven Heavens.
 * UX ispirata alle maioliche siciliane: cornice a piastrelle, pannelli in carta
 * avorio, slot ovali dorati per le cinque dita.
 */

import { useMemo } from "react";
import { ArrowLeft, Camera, Play, Square, Wand2 } from "lucide-react";
import { allSongs } from "@/core/songs/catalog";
import { startSongSession } from "@/core/songs/session";
import { slotsFromSong, type OneHandConfig } from "@/core/gesture/oneHand";
import { ROMAN } from "@/lib/theory";
import type { SongModeState } from "@/hooks/useSongMode";
import tilePattern from "@/assets/maiolica-pattern.jpg";

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
}: Props) {
  const songs = useMemo(() => allSongs(), []);
  const activeSlot =
    activeDegree == null ? null : config.slots.indexOf(activeDegree + 1) + 1 || null;

  const handChip = (active: boolean) =>
    `maiolica-btn flex-1 ${active ? "maiolica-btn-primary" : ""}`;

  return (
    <div
      className="maiolica-frame fixed inset-0 z-40 overflow-y-auto"
      style={{ backgroundImage: `url(${tilePattern})` }}
    >
      <div className="mx-auto w-full max-w-xl p-3 sm:p-6">
        <div className="maiolica-paper rounded-[1.8rem] p-4 sm:p-6">
          {/* header */}
          <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Torna a Seven Heavens"
              className="maiolica-btn !px-3"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <h1 className="maiolica-title text-[1.9rem] leading-none sm:text-4xl">ONE HAND</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.34em] text-[#8a6d2f]">
                Easy Cover Mode
              </p>
            </div>
            <button
              onClick={onTogglePlay}
              aria-label={running ? "Stop" : "Play"}
              className="maiolica-btn maiolica-btn-primary !px-3"
            >
              {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </header>

          <div className="maiolica-rule my-4" />

          {/* fotocamera / tutorial */}
          <div className="flex items-start gap-3 rounded-2xl border border-[rgba(180,150,90,0.4)] bg-[rgba(255,253,246,0.75)] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(180,150,90,0.5)] bg-[#f6ead0] text-[#14224a]">
              <Camera className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a6d2f]">
                Fotocamera e tracciamento
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#25335a]">
                Concedi l&apos;accesso alla fotocamera. Alza 1–5 dita davanti allo schermo: ogni
                dito suona l&apos;accordo dello slot corrispondente.
              </p>
            </div>
          </div>

          {/* song corrente */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(180,150,90,0.4)] bg-[rgba(255,253,246,0.75)] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-[#14224a]">
                {songMode.song?.title ?? "Accordi liberi"}
              </p>
              <p className="truncate text-[11px] font-semibold text-[#6b7591]">
                {songMode.song?.artist ?? "Nessuna canzone"}
              </p>
            </div>
            <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a6d2f]">
              {keyLabel}
            </p>
          </div>

          {/* slot dita */}
          <div className="mt-5 text-center">
            <p className="maiolica-title text-sm font-semibold tracking-[0.28em]">FINGER SLOTS</p>
            <p className="mt-1 text-[11px] font-semibold text-[#6b7591]">
              Ogni dito è uno slot. Assegna qualsiasi grado.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
            {config.slots.map((degree, i) => (
              <div key={i} className="flex min-w-0 flex-col items-center gap-1">
                <div className={`maiolica-slot ${activeSlot === i + 1 ? "maiolica-slot-on" : ""}`}>
                  <span className="maiolica-title text-xl leading-none sm:text-2xl">{i + 1}</span>
                  <span className="text-[11px] font-bold leading-none text-[#9b1c1c]">
                    {ROMAN[degree - 1]}
                  </span>
                  <span className="text-[10px] font-semibold leading-none text-[#25335a]">
                    {degreeChordLabels[degree - 1]}
                  </span>
                </div>
                <span className="truncate text-[8px] font-bold tracking-[0.14em] text-[#8a6d2f]">
                  {FINGER_NAMES[i]}
                </span>
              </div>
            ))}
          </div>

          {/* accordo corrente */}
          <div className="mt-4 min-h-[3.75rem] text-center">
            {activeSlot ? (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8a6d2f]">
                  {activeSlot} {activeSlot === 1 ? "dito" : "dita"}
                </p>
                <p className="maiolica-title text-3xl leading-none">
                  {degreeChordLabels[(config.slots[activeSlot - 1] ?? 1) - 1]}
                </p>
              </div>
            ) : (
              <p className="pt-3 text-[11px] font-semibold text-[#6b7591]">Alza la mano…</p>
            )}
          </div>

          {/* mano */}
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[rgba(180,150,90,0.4)] bg-[rgba(255,253,246,0.75)] p-2">
            <span className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6d2f]">
              Mano
            </span>
            <button
              onClick={() => update({ hand: "left" })}
              className={handChip(config.hand === "left")}
            >
              Left
            </button>
            <button
              onClick={() => update({ hand: "right" })}
              className={handChip(config.hand === "right")}
            >
              Right
            </button>
            <button
              onClick={() => update({ hand: "any" })}
              className={handChip(config.hand === "any")}
            >
              Auto
            </button>
          </div>

          {/* song */}
          <div className="mt-4 space-y-3 rounded-2xl border border-[rgba(180,150,90,0.4)] bg-[rgba(255,253,246,0.75)] p-4">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d2f]">
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
                className="maiolica-field mt-1.5"
                aria-label="Scegli una canzone"
              >
                <option value="">Nessuna · accordi liberi</option>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.artist}
                  </option>
                ))}
              </select>
            </label>

            {songMode.song && (
              <>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d2f]">
                  Sezione
                  <select
                    value={songMode.sectionIndex}
                    onChange={(e) => songMode.setSectionIndex(Number(e.target.value))}
                    className="maiolica-field mt-1.5"
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
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d2f]">
                    Progressione
                  </span>
                  {songMode.degrees.map((d, i) => {
                    const slot = config.slots.indexOf(d);
                    return (
                      <span
                        key={i}
                        className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(180,150,90,0.6)] bg-[#fffaf0] text-[11px] font-bold text-[#14224a]"
                      >
                        {slot < 0 ? "–" : slot + 1}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    const slots = slotsFromSong(songMode.song, songMode.sectionIndex);
                    if (slots) update({ slots, enabled: true });
                  }}
                  className="maiolica-btn"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Auto map song
                </button>
              </>
            )}
          </div>

          {/* mappatura manuale */}
          <div className="mt-4 space-y-2 rounded-2xl border border-[rgba(180,150,90,0.4)] bg-[rgba(255,253,246,0.75)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="maiolica-title text-xs font-bold tracking-[0.2em]">SLOT EDITOR</h2>
              <button
                onClick={() => update({ followSong: !config.followSong })}
                className={`maiolica-btn ${config.followSong ? "maiolica-btn-primary" : ""}`}
              >
                Segui la song
              </button>
            </div>
            {config.slots.map((degree, i) => (
              <label
                key={i}
                className="flex items-center gap-3 text-[11px] font-semibold text-[#25335a]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[rgba(180,150,90,0.6)] bg-[#fffaf0] text-[13px] font-bold text-[#14224a]">
                  {i + 1}
                </span>
                <select
                  value={degree}
                  onChange={(e) => {
                    const slots = [...config.slots];
                    slots[i] = Number(e.target.value);
                    update({ slots, followSong: false });
                  }}
                  className="maiolica-field flex-1"
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

          {/* play */}
          <button
            onClick={onTogglePlay}
            className="maiolica-btn maiolica-btn-primary mt-5 w-full !py-4 !text-sm !tracking-[0.26em]"
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Play / Stop
          </button>
        </div>
      </div>
    </div>
  );
}
