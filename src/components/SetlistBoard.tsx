"use client";

import { useState } from "react";
import type { SetlistItem } from "@/lib/types";
import { IconGrip, IconLock, IconTrash, IconWave } from "./icons";
import { TrackPreview } from "./TrackPreview";
import { coverFor } from "@/lib/mock-data";

export function SetlistBoard({
  items,
  onChange,
}: {
  items: SetlistItem[];
  onChange: (next: SetlistItem[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function toggleLock(uid: string) {
    onChange(
      items.map((i) => (i.uid === uid ? { ...i, locked: !i.locked } : i))
    );
  }

  function remove(uid: string) {
    onChange(items.filter((i) => i.uid !== uid));
  }

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-dashed border-line bg-surface/40 p-8 text-center">
        <div>
          <IconWave className="mx-auto mb-3 text-faint" width={28} height={28} />
          <p className="text-sm text-muted">Your setlist is empty.</p>
          <p className="mt-1 text-xs text-faint">
            Search and add tracks, then drag to set the order the DJ should follow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <article
          key={item.uid}
          draggable
          onDragStart={() => setDragIdx(idx)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIdx(idx);
          }}
          onDragEnd={() => {
            if (dragIdx !== null && overIdx !== null) reorder(dragIdx, overIdx);
            setDragIdx(null);
            setOverIdx(null);
          }}
          className={`flex items-center gap-3 rounded-xl border bg-surface/80 p-3 shadow-depth transition-all ${
            overIdx === idx && dragIdx !== idx
              ? "border-accent/60"
              : "border-line"
          } ${dragIdx === idx ? "opacity-40" : ""} ${
            item.locked ? "ring-1 ring-accent/30" : ""
          }`}
        >
          <span
            className="cursor-grab text-faint active:cursor-grabbing"
            aria-hidden
          >
            <IconGrip width={18} height={18} />
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ground-2 text-xs font-semibold text-accent">
            {idx + 1}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              item.track.thumbnail ||
              coverFor(item.track.id, item.track.artist.slice(0, 3).toUpperCase())
            }
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {item.track.title}
            </p>
            <p className="truncate text-xs text-muted">{item.track.artist}</p>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-faint sm:flex">
            <span className="rounded-md bg-ground-2 px-2 py-1">{item.track.bpm} BPM</span>
            <span className="rounded-md bg-ground-2 px-2 py-1">{item.track.musicalKey}</span>
          </div>
          <TrackPreview bpm={item.track.bpm} trackId={item.uid} compact />
          <button
            onClick={() => toggleLock(item.uid)}
            aria-label={item.locked ? "Unlock position" : "Lock position"}
            title={item.locked ? "Unlock position" : "Lock position"}
            className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
              item.locked
                ? "border-accent/60 bg-accent-soft text-accent"
                : "border-line text-faint hover:text-ink"
            }`}
          >
            <IconLock width={14} height={14} />
          </button>
          <button
            onClick={() => remove(item.uid)}
            aria-label="Remove from setlist"
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-faint transition-colors hover:border-bad/50 hover:text-bad"
          >
            <IconTrash width={14} height={14} />
          </button>
        </article>
      ))}
    </div>
  );
}
