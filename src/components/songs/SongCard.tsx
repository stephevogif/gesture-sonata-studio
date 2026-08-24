import { MODES } from "@/core/music/chords";
import { difficultyLabel, keyLabel } from "@/core/songs/catalog";
import type { Song } from "@/core/songs/types";

export default function SongCard({ song, onPlay }: { song: Song; onPlay: (song: Song) => void }) {
  const scale = MODES.find((m) => m.id === song.scale)?.name ?? song.scale;
  const preview = song.sections[0]?.degrees.slice(0, 8) ?? [];

  return (
    <button onClick={() => onPlay(song)} className="heaven-song-card text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-white drop-shadow">
            {song.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.22em] text-white/70">
            {song.artist}
          </p>
        </div>
        <span className="heaven-song-badge">{difficultyLabel(song.difficulty)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-[#ffe9bd]">
        <span>
          {keyLabel(song)} · {scale}
        </span>
        <span className="text-white/55">{song.bpm} BPM</span>
        <span className="text-white/55">{song.genre}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {preview.map((d, i) => (
          <span key={`${d}-${i}`} className="heaven-song-degree">
            {d}
          </span>
        ))}
      </div>
    </button>
  );
}
