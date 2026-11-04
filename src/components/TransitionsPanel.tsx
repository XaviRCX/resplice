"use client";

import type { SetlistItem, Transition } from "@/lib/types";
import { CROSSFADE_SEC } from "@/lib/types";
import { IconSpark } from "./icons";

const TRANSITIONS: Transition[] = [
  "cut",
  "crossfade",
  "beatmatch",
  "filter-sweep",
  "echo-out",
  "acapella-over",
];

const TRANS_LABEL: Record<Transition, string> = {
  cut: "Corte seco",
  crossfade: "Crossfade",
  beatmatch: "Beatmatch",
  "filter-sweep": "Filter sweep",
  "echo-out": "Echo out",
  "acapella-over": "Acapella over",
};

export function TransitionsPanel({
  items,
  onTune,
}: {
  items: SetlistItem[];
  onTune: (uid: string, mix: SetlistItem["mix"]) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-8 text-center">
        <p className="text-sm text-muted">Sem faixas ainda.</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
          <IconSpark width={16} height={16} className="text-accent" />
          Transições
        </h2>
        <p className="mt-1 text-sm text-muted">
          Escolha o tipo de transição e por quanto tempo ela dura entre uma faixa e outra.
        </p>
      </header>

      <ol className="space-y-3">
        {items.map((item, idx) => {
          const t = item.track;
          const dur = t.durationSec || 180;
          const mix = item.mix ?? {
            inSec: Math.round(dur * 0.15),
            outSec: Math.round(dur * 0.75),
            transitionOut: "crossfade" as Transition,
            transitionLen: 2,
          };
          const isLast = idx === items.length - 1;
          return (
            <li
              key={item.uid}
              className="flex flex-col gap-2 rounded-xl border border-line bg-ground-2/60 p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ground-2 text-xs font-semibold text-accent">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                <p className="truncate text-xs text-muted">
                  {isLast ? "última faixa" : `→ sai em ${mix.transitionOut}`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={mix.transitionOut}
                  disabled={isLast}
                  onChange={(e) =>
                    onTune(item.uid, {
                      ...mix,
                      transitionOut: e.target.value as Transition,
                      transitionLen:
                        mix.transitionLen ??
                        CROSSFADE_SEC[e.target.value as Transition],
                    })
                  }
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-accent/50"
                >
                  {TRANSITIONS.map((tr) => (
                    <option key={tr} value={tr} disabled={isLast && tr !== "cut"}>
                      {TRANS_LABEL[tr]}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-faint">duração</span>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={mix.transitionLen ?? 2}
                    disabled={isLast || mix.transitionOut === "cut"}
                    onChange={(e) =>
                      onTune(item.uid, {
                        ...mix,
                        transitionLen: Number(e.target.value),
                      })
                    }
                    className="w-24 accent-[var(--color-accent)]"
                  />
                  <span className="w-10 text-[11px] text-muted">
                    {mix.transitionLen ?? 2}s
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
