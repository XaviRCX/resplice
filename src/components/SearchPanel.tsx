"use client";

import { useState } from "react";
import type { Source, Track } from "@/lib/types";
import { IconSearch, IconPlus, IconYouTube, IconSpotify, IconFolder } from "./icons";
import { TrackPreview } from "./TrackPreview";
import { coverFor } from "@/lib/mock-data";

export function SearchPanel({
  onAdd,
  onAccess,
  onLibrary,
}: {
  onAdd: (t: Track) => void;
  onAccess?: (t: Track) => void;
  onLibrary?: (t: Track) => void;
}) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | Source>("all");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<string>("");

  async function run() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&source=${source}`
      );
      const j = await r.json();
      setResults(j.results ?? []);
      setMode(j.mode ?? "");
      setSearched(true);
      if (onAccess) (j.results ?? []).slice(0, 10).forEach((t: Track) => onAccess(t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Find tracks
        </h2>
        <p className="mt-1 text-sm text-muted">
          Search YouTube or your library, then listen to confirm the right version.
        </p>
      </header>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-ground-2 px-3 focus-within:border-accent/50">
          <IconSearch className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Song, artist, or genre…"
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-xl bg-accent px-4 text-sm font-semibold text-[#1a120a] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      <div className="mt-3 flex gap-1.5 text-xs">
        {(["all", "youtube", "spotify"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`rounded-full border px-3 py-1.5 capitalize transition-colors ${
              source === s
                ? "border-accent/60 bg-accent-soft text-accent"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {s === "youtube" && <IconYouTube width={12} height={12} className="mr-1 inline" />}
            {s === "spotify" && <IconSpotify width={12} height={12} className="mr-1 inline" />}
            {s}
          </button>
        ))}
      </div>

      {mode === "demo-fallback" && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft/50 p-3 text-sm text-ink">
          <p className="font-medium text-accent">
            YouTube API sem cota — mostrando o catálogo de sugestões
          </p>
          <p className="mt-1 text-xs text-muted">
            A cota diária da YouTube Data API esgotou. Enquanto isso, veja abaixo
            sugestões do catálogo local (inclui funk, submundo e eletrofunk). A
            busca real volta assim que a cota renovar.
          </p>
        </div>
      )}

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {!searched && (
          <p className="mt-8 text-center text-sm text-faint">
            Results appear here. Demo catalog loads without API keys.
          </p>
        )}
        {searched && results.length === 0 && (
          <p className="mt-8 text-center text-sm text-faint">No matches.</p>
        )}
        {results.map((t) => (
          <article
            key={t.id}
            className="group flex items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5 transition-colors hover:border-line-strong"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.thumbnail || coverFor(t.id, t.artist.slice(0, 3).toUpperCase())}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{t.title}</p>
              <p className="truncate text-xs text-muted">{t.artist}</p>
              <p className="mt-1 flex gap-2 text-[11px] text-faint">
                <span>{t.bpm} BPM</span>
                <span>·</span>
                <span>{t.musicalKey}</span>
                <span>·</span>
                <span className="uppercase">{t.source}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <TrackPreview bpm={t.bpm} audioUrl={t.synthetic ? undefined : t.url} trackId={t.id} compact />
              <div className="flex gap-2">
                <button
                  onClick={() => onLibrary?.(t)}
                  aria-label={`Add ${t.title} to library`}
                  title="Adicionar à biblioteca"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-accent"
                >
                  <IconFolder width={15} height={15} />
                </button>
                <button
                  onClick={() => onAdd(t)}
                  aria-label={`Add ${t.title} to setlist`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
                >
                  <IconPlus width={15} height={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
