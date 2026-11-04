"use client";

import { useState, useEffect } from "react";
import type { Track } from "@/lib/types";
import { IconPlus, IconSpark } from "./icons";
import { coverFor } from "@/lib/mock-data";
import { TrackPreview } from "./TrackPreview";

export function SuggestionsPanel({
  items,
  targetGenre,
  onAdd,
}: {
  items: { track: Track }[];
  targetGenre: string;
  onAdd: (t: Track) => void;
}) {
  const [near, setNear] = useState<Track[]>([]);
  const [bold, setBold] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = encodeURIComponent(JSON.stringify(items));
    fetch(`/api/suggest?genre=${encodeURIComponent(targetGenre)}&q=${q}`)
      .then((r) => r.json())
      .then((j) => {
        setNear(j.near ?? []);
        setBold(j.bold ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [items, targetGenre]);

  const inSetlist = new Set(items.map((i) => i.track.id));

  const Column = ({
    title,
    subtitle,
    tracks,
    tone,
  }: {
    title: string;
    subtitle: string;
    tracks: Track[];
    tone: "near" | "bold";
  }) => (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            tone === "near"
              ? "bg-accent-soft text-accent"
              : "bg-surface-3 text-muted"
          }`}
        >
          {subtitle}
        </span>
      </div>
      <div className="space-y-2">
        {tracks.length === 0 && (
          <p className="text-xs text-faint">Nada por aqui ainda.</p>
        )}
        {tracks.map((t) => (
          <article
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.thumbnail || coverFor(t.id, t.artist.slice(0, 3).toUpperCase())}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{t.title}</p>
              <p className="truncate text-xs text-muted">{t.artist}</p>
              <p className="mt-0.5 flex gap-1.5 text-[10px] text-faint">
                <span>{t.bpm} BPM</span>
                <span>·</span>
                <span className="truncate">{t.genres.slice(0, 2).join(", ")}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrackPreview bpm={t.bpm} audioUrl={t.url} trackId={t.id} compact />
              <button
                onClick={() => onAdd(t)}
                disabled={inSetlist.has(t.id)}
                aria-label={`Add ${t.title}`}
                className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft disabled:opacity-30"
              >
                <IconPlus width={15} height={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <section className="flex max-h-[78vh] min-h-0 flex-col rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
          <IconSpark width={16} height={16} className="text-accent" />
          Músicas sugeridas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Picks para estender seu set — perto do tema ou mais ousados.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-faint">Buscando sugestões…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1 lg:flex-row">
          <Column
            title="Próximas do gênero"
            subtitle="No tema"
            tracks={near}
            tone="near"
          />
          <div className="hidden w-px bg-line lg:block" />
          <Column
            title="Mais ousadas"
            subtitle="Contraste"
            tracks={bold}
            tone="bold"
          />
        </div>
      )}
    </section>
  );
}
