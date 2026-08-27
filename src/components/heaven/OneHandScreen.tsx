/**
 * One Hand — schermata dedicata dentro Seven Heavens.
 * Si suona con una sola mano: 1–5 dita = 5 accordi assegnabili.
 * Le song vengono mappate automaticamente sulle dita, in ordine di apparizione.
 */

import { useMemo } from "react";
import { ArrowLeft, Camera, Play, Square, Wand2 } from "lucide-react";
import { allSongs } from "@/core/songs/catalog";
import { startSongSession } from "@/core/songs/session";
import { slotsFromSong, type OneHandConfig } from "@/core/gesture/oneHand";
import { ROMAN } from "@/lib/theory";
import type { SongModeState } from "@/hooks/useSongMode";

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

  const field =
    "mt-1.5 w-full appearance-none rounded-xl border border-white/60 bg-white/75 px-3 py-2.5 text-[13px] font-semibold text-[#2b3855] shadow-sm outline-none focus:border-[rgba(255,222,160,0.95)]";
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
      active
        ? "border-[rgba(255,222,160,0.95)] bg-[rgba(255,238,200,0.32)] text-[#2b1f0a]"
        : "border-white/50 bg-white/15 text-[#f0f6ff] hover:bg-white/25"
    }`;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(9,18,38,0.62)] backdrop-blur-[2px]">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pb-12 pt-5">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button onClick={onClose} aria-label="Torna a Seven Heavens" className="heaven-orb-btn">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85">
              Seven Heavens
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85">
              {keyLabel}
            </p>
          </div>
          <button
            onClick={onTogglePlay}
            aria-label={running ? "Stop" : "Play"}
            className="heaven-orb-btn"
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </header>

        <h1 className="heaven-title mt-5 text-center text-[2.1rem] leading-none sm:text-5xl">
          ONE HAND
        </h1>
        <p className="mt-2 text-center text-[11px] font-semibold text-white/80">
          Una sola mano: 1 dito = primo accordo, 5 dita = quinto.
        </p>

        {/* tutorial + accesso camera */}
        <div className="heaven-glass mt-5 flex items-start gap-3 rounded-2xl p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(255,222,160,0.18)] text-[#fff3d2]">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#fff3d2]">
              Fotocamera e tracciamento
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#f0f6ff]/85">
              Concedi l&apos;accesso alla fotocamera. Alza 1–5 dita davanti allo
              schermo: ogni dito suona l&apos;accordo dello slot corrispondente.
            </p>
          </div>
        </div>

        {/* i cinque slot */}
        <div className="mt-6 flex items-start justify-between gap-1">
          {config.slots.map((degree, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className={`heaven-node ${activeSlot === i + 1 ? "heaven-node-on" : ""}`}>
                {i + 1}
              </div>
              <span
                className={`truncate text-[9px] font-semibold ${
                  activeSlot === i + 1 ? "text-[#fff3d2]" : "text-white/75"
                }`}
              >
                {degreeChordLabels[degree - 1]}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-white/50">
                {ROMAN[degree - 1]}
              </span>
            </div>
          ))}
        </div>

        {/* accordo corrente */}
        <div className="mt-5 min-h-[4.5rem] text-center">
          {activeSlot ? (
            <div className="animate-fade-in">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                {activeSlot} {activeSlot === 1 ? "dito" : "dita"}
              </p>
              <p className="heaven-title text-4xl leading-none">
                {degreeChordLabels[(config.slots[activeSlot - 1] ?? 1) - 1]}
              </p>
            </div>
          ) : (
            <p className="pt-3 text-[11px] font-semibold text-white/50">
              Aspettando la mano…
            </p>
          )}
        </div>

        {/* song */}
        <div className="heaven-glass mt-4 space-y-3 rounded-2xl p-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0f6ff]/90">
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
              className={field}
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
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0f6ff]/90">
                Sezione
                <select
                  value={songMode.sectionIndex}
                  onChange={(e) => songMode.setSectionIndex(Number(e.target.value))}
                  className={field}
                  aria-label="Sezione della canzone"
                >
                  {songMode.song.sections.map((sec, i) => (
                    <option key={sec.id} value={i}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] font-semibold text-[#f0f6ff]/85">
                Sequenza:{" "}
                {songMode.degrees
                  .map((d) => {
                    const slot = config.slots.indexOf(d);
                    return slot < 0 ? "–" : `${slot + 1}`;
                  })
                  .join(" → ")}{" "}
                dita
              </p>
              <button
                onClick={() => {
                  const slots = slotsFromSong(songMode.song, songMode.sectionIndex);
                  if (slots) update({ slots, enabled: true });
                }}
                className={chip(false)}
              >
                <Wand2 className="mr-1 inline h-3.5 w-3.5" />
                Rimappa sulle dita
              </button>
            </>
          )}
        </div>

        {/* mappatura manuale */}
        <div className="heaven-glass mt-4 space-y-2 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-[#f8fbff]">Accordo per numero di dita</h2>
            <button
              onClick={() => update({ followSong: !config.followSong })}
              className={chip(config.followSong)}
            >
              Segui la song
            </button>
          </div>
          {config.slots.map((degree, i) => (
            <label
              key={i}
              className="flex items-center gap-3 text-[11px] font-semibold text-[#f0f6ff]/90"
            >
              <span className="heaven-node !h-8 !w-8 !text-[13px]">{i + 1}</span>
              <select
                value={degree}
                onChange={(e) => {
                  const slots = [...config.slots];
                  slots[i] = Number(e.target.value);
                  update({ slots, followSong: false });
                }}
                className={`${field} !mt-0 flex-1`}
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

          <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0f6ff]/90">
            Mano
            <select
              value={config.hand}
              onChange={(e) => update({ hand: e.target.value as OneHandConfig["hand"] })}
              className={field}
              aria-label="Mano che suona"
            >
              <option value="any">Quella visibile</option>
              <option value="left">Sinistra</option>
              <option value="right">Destra</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
