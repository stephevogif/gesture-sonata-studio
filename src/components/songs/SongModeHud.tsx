import { Link } from "@tanstack/react-router";
import { Repeat, X } from "lucide-react";
import { buildChord, MODES } from "@/core/music/chords";
import type { ModeId } from "@/core/music/chords";
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

export default function SongModeHud({
  state,
  rootPc,
  mode,
}: {
  state: SongModeState;
  rootPc: number;
  mode: ModeId;
}) {
  const { song, degrees, stepIndex, current, next, sectionName, matched } = state;
  if (!song || current == null) return null;

  return (
    <section className="heaven-song-hud mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold tracking-tight text-white drop-shadow">
            {song.title}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.3em] text-white/65">
            {song.artist} · {MODES.find((m) => m.id === mode)?.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => state.setLoop(!state.loopSection)}
            aria-pressed={state.loopSection}
            aria-label="Loop della sezione"
            className={`heaven-orb-btn ${state.loopSection ? "heaven-nav-on" : ""}`}
          >
            <Repeat className="h-4 w-4" />
          </button>
          <button onClick={state.exit} aria-label="Esci da Song Mode" className="heaven-orb-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {sectionName && (
        <p key={sectionName} className="animate-fade-in mt-3 text-center text-[10px] uppercase tracking-[0.46em] text-[#ffe9bd]">
          {sectionName}
          {state.loopSection ? " · loop" : ""}
        </p>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/70">Now</p>
          <p
            className={`heaven-title leading-[0.85] text-[4rem] transition-transform ${matched ? "heaven-song-hit" : ""}`}
          >
            {current}
          </p>
          <p className="mt-1 text-[13px] uppercase tracking-[0.24em] text-white/85">
            {chordLabel(rootPc, mode, current)}
          </p>
        </div>
        {next != null && (
          <div className="text-right opacity-75">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/70">Next</p>
            <p className="heaven-title text-[2rem] leading-none">{next}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-white/75">
              {chordLabel(rootPc, mode, next)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {degrees.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className={`heaven-song-step ${i === stepIndex ? "heaven-song-step-on" : ""}`}
          >
            {d}
          </span>
        ))}
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
