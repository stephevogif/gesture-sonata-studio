import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Repeat, Sparkles, X, Zap } from "lucide-react";
import { buildChord, MODES } from "@/core/music/chords";
import type { ModeId } from "@/core/music/chords";
import { compatibilityLabel } from "@/core/songs/catalog";
import type { LoopMode } from "@/core/songs/types";
import type { SongModeState } from "@/hooks/useSongMode";

function chordLabel(rootPc: number, mode: ModeId, degree: number) {
  return buildChord({
    rootPc,
    mode,
    degree: degree - 1,
    tonality: "auto",
    voicing: "triad",
  }).label;
}

const LOOP_ORDER: LoopMode[] = ["section", "song", "off"];
const LOOP_LABEL: Record<LoopMode, string> = {
  section: "Loop section",
  song: "Loop song",
  off: "Loop off",
};

export default function SongModeHud({
  state,
  rootPc,
  mode,
  slots = null,
}: {
  state: SongModeState;
  rootPc: number;
  mode: ModeId;
  /** One Hand: mappa dita 1..5 -> grado, per mostrare quante dita alzare */
  slots?: number[] | null;
}) {
  const { song, degrees, stepIndex, current, next, sectionName, matched } = state;
  if (!song || current == null) return null;

  const heaven = compatibilityLabel(song.compatibility);
  const cycleLoop = () =>
    state.setLoopMode(LOOP_ORDER[(LOOP_ORDER.indexOf(state.loopMode) + 1) % LOOP_ORDER.length]!);

  return (
    <section className="heaven-song-hud mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold tracking-tight text-white drop-shadow">
            {song.title}
          </p>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.3em] text-white/65">
            {song.artist} · {MODES.find((m) => m.id === mode)?.name}
          </p>
          {heaven && (
            <p className="mt-1 inline-flex items-center gap-1 text-[8px] uppercase tracking-[0.26em] text-[#ffe9bd]/80">
              <Sparkles className="h-2.5 w-2.5" /> {heaven}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => state.setAutoAdvance(!state.autoAdvance)}
            aria-pressed={state.autoAdvance}
            aria-label="Auto advance"
            className={`heaven-orb-btn ${state.autoAdvance ? "heaven-nav-on" : ""}`}
          >
            <Zap className="h-4 w-4" />
          </button>
          <button
            onClick={cycleLoop}
            aria-label={LOOP_LABEL[state.loopMode]}
            className={`heaven-orb-btn ${state.loopMode !== "off" ? "heaven-nav-on" : ""}`}
          >
            <Repeat className="h-4 w-4" />
          </button>
          <button onClick={state.exit} aria-label="Esci da Song Mode" className="heaven-orb-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {sectionName && (
        <p
          key={sectionName}
          className="animate-fade-in mt-3 text-center text-[10px] uppercase tracking-[0.46em] text-[#ffe9bd]"
        >
          {sectionName} · {LOOP_LABEL[state.loopMode]}
        </p>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/70">Now</p>
          <p
            className={`heaven-title text-[4rem] leading-[0.85] transition-transform ${matched ? "heaven-song-hit" : ""}`}
          >
            {current}
          </p>
          <p className="mt-1 text-[13px] uppercase tracking-[0.24em] text-white/85">
            {chordLabel(rootPc, mode, current)}
          </p>
          {slots && slots.indexOf(current) >= 0 && (
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.24em] text-[#ffe9bd]">
              {slots.indexOf(current) + 1} dita
            </p>
          )}
        </div>
        {next != null && (
          <div className="text-right opacity-80">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/70">Next</p>
            <p className="heaven-title heaven-song-next text-[2rem] leading-none">{next}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-white/75">
              {chordLabel(rootPc, mode, next)}
            </p>
          </div>
        )}
      </div>

      {/* constellation timeline */}
      <div className="heaven-song-constellation mt-4">
        {degrees.map((d, i) => (
          <span key={`${d}-${i}`} className="heaven-song-node-wrap">
            {i > 0 && <span aria-hidden className="heaven-song-link" />}
            <span
              className={`heaven-song-node ${
                i === stepIndex
                  ? "heaven-song-node-now"
                  : i === (stepIndex + 1) % Math.max(1, degrees.length)
                    ? "heaven-song-node-next"
                    : "heaven-song-node-past"
              }`}
            >
              <span aria-hidden className="heaven-song-star">
                ✦
              </span>
              {d}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button onClick={() => state.step(-1)} aria-label="Accordo precedente" className="heaven-orb-btn">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[9px] uppercase tracking-[0.3em] text-white/60">
          {stepIndex + 1}/{degrees.length}
        </span>
        <button onClick={() => state.step(1)} aria-label="Accordo successivo" className="heaven-orb-btn">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {song.sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => state.setSectionIndex(i)}
              className={`heaven-song-filter ${i === state.sectionIndex ? "heaven-song-filter-on" : ""}`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <Link to="/songs" className="heaven-song-filter">
          Songs
        </Link>
      </div>
    </section>
  );
}
