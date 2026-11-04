"use client";

import type { Track } from "@/lib/types";
import { IconPlus, IconHistory, IconFolder } from "./icons";
import { coverFor } from "@/lib/mock-data";
import { TrackPreview } from "./TrackPreview";

export function RecentPanel({
  recent,
  onAdd,
  onLibrary,
}: {
  recent: Track[];
  onAdd: (t: Track) => void;
  onLibrary?: (t: Track) => void;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
          <IconHistory width={16} height={16} className="text-accent" />
          Recentes
        </h2>
        <p className="mt-1 text-sm text-muted">
          As últimas 10 músicas que você acessou (buscou ou adicionou ao mix).
        </p>
      </header>

      {recent.length === 0 ? (
        <p className="text-sm text-faint">
          Nenhuma música acessada ainda. Busque ou adicione faixas ao mix.
        </p>
      ) : (
        <div className="space-y-2">
          {recent.map((t) => (
            <article
              key={`${t.id}-${t.source}`}
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
                  onClick={() => onLibrary?.(t)}
                  aria-label={`Add ${t.title} to library`}
                  title="Adicionar à biblioteca"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-accent"
                >
                  <IconFolder width={15} height={15} />
                </button>
                <button
                  onClick={() => onAdd(t)}
                  aria-label={`Add ${t.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
                >
                  <IconPlus width={15} height={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
