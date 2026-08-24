import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { allSongs, FILTERS, searchSongs, type FilterId } from "@/core/songs/catalog";
import { startSongSession } from "@/core/songs/session";
import type { Song } from "@/core/songs/types";
import SongCard from "./SongCard";

export default function SongLibrary() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterId[]>([]);
  const songs = useMemo(() => allSongs(), []);
  const results = useMemo(() => searchSongs(query, filters, songs), [query, filters, songs]);

  const toggle = (id: FilterId) =>
    setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const play = (song: Song) => {
    startSongSession(song.id, 0);
    void navigate({ to: "/studio" });
  };

  return (
    <div className="heaven-scene relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="heaven-stars absolute inset-0" />
        <div className="heaven-veil absolute inset-0" />
        <div className="heaven-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl px-5 pb-16 pt-5">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/studio" aria-label="Torna a Seven Heavens" className="heaven-orb-btn">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.42em] text-white/85 drop-shadow">
            Steph Evo&apos;s Heaven Synth
          </p>
          <span aria-hidden className="h-9 w-9" />
        </header>

        <h1 className="heaven-title mt-6 text-center text-[2rem] leading-none sm:text-4xl">
          HEAVEN SONGS
        </h1>
        <p className="mt-2 text-center text-[11px] uppercase tracking-[0.32em] text-white/75">
          Play songs with your hands
        </p>

        <label className="heaven-song-search mt-6">
          <Search className="h-4 w-4 shrink-0 opacity-70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs..."
            aria-label="Search songs"
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/50 outline-none"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              aria-pressed={filters.includes(f.id)}
              className={`heaven-song-filter ${filters.includes(f.id) ? "heaven-song-filter-on" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-white/55">
          {results.length} songs · degrees 1–7
        </p>

        <div className="mt-3 space-y-3">
          {results.map((song) => (
            <SongCard key={song.id} song={song} onPlay={play} />
          ))}
          {!results.length && (
            <p className="py-10 text-center text-[12px] text-white/70">
              Nessuna canzone trovata.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] leading-relaxed text-white/45">
          Le progressioni demo sono originali di Heaven Synth (placeholder), non trascrizioni di
          brani commerciali.
        </p>
      </div>
    </div>
  );
}
