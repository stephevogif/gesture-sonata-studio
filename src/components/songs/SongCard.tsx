import { Heart, Play } from "lucide-react";
import {
  compatibilityLabel,
  difficultyLabel,
  keyLabel,
  scaleLabel,
} from "@/core/songs/catalog";
import type { Song } from "@/core/songs/types";

export default function SongCard({
  song,
  favorite,
  onPlay,
  onToggleFavorite,
}: {
  song: Song;
  favorite: boolean;
  onPlay: (song: Song) => void;
  onToggleFavorite: (song: Song) => void;
}) {
  const heaven = compatibilityLabel(song.compatibility);
  const main = song.sections[0]?.degrees ?? [];

  return (
    <article className="heaven-song-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold tracking-tight text-white drop-shadow">
            {song.title}
          </h2>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.28em] text-white/70">
            {song.artist}
          </p>
        </div>
        <button
          onClick={() => onToggleFavorite(song)}
          aria-pressed={favorite}
          aria-label={favorite ? `Rimuovi ${song.title} dai preferiti` : `Aggiungi ${song.title} ai preferiti`}
          className={`heaven-orb-btn ${favorite ? "heaven-nav-on" : ""}`}
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.24em] text-white/60">
        <span>{song.genre}</span>
        <span aria-hidden>·</span>
        <span>
          {keyLabel(song)} {scaleLabel(song)}
        </span>
        <span aria-hidden>·</span>
        <span>{difficultyLabel(song.difficulty)}</span>
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] tracking-[0.18em] text-[#ffe9bd]">
          {main.map((d, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="h-px w-3 bg-white/25" />}
              {d}
            </span>
          ))}
        </p>
        <button onClick={() => onPlay(song)} className="heaven-song-play">
          <Play className="h-3.5 w-3.5" />
          Play with hands
        </button>
      </div>

      {heaven && (
        <p className="mt-2 text-[8px] uppercase tracking-[0.26em] text-[#ffe9bd]/70">{heaven}</p>
      )}
    </article>
  );
}
