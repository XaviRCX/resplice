"use client";

import { useState, useRef, useEffect } from "react";
import type { SetlistItem } from "@/lib/types";
import { coverFor } from "@/lib/mock-data";
import { IconGrip, IconWave, IconPlay, IconPause } from "./icons";

/**
 * Timeline — a fine-tuning region.
 * Shows each track's "waveform" with the selected slice (inSec..outSec)
 * highlighted, draggable order handles, and sliders to move the transition
 * point (where this track hands off to the next).
 */
export function Timeline({
  items,
  onChange,
  onTune,
}: {
  items: SetlistItem[];
  onChange: (next: SetlistItem[]) => void;
  onTune: (uid: string, mix: SetlistItem["mix"]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  async function autoSet() {
    if (items.length === 0) return;
    setAutoBusy(true);
    try {
      const r = await fetch("/api/autoset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: items.map((i) => ({
            uid: i.uid,
            url: i.track.url,
            durationSec: i.track.durationSec,
          })),
        }),
      });
      const j = await r.json();
      const byUid: Record<string, { inSec: number; outSec: number }> = {};
      for (const t of j.tracks ?? []) byUid[t.uid] = t;
      items.forEach((i) => {
        const a = byUid[i.uid];
        if (a) {
          onTune(i.uid, {
            inSec: a.inSec,
            outSec: a.outSec,
            transitionOut: i.mix?.transitionOut ?? "crossfade",
            transitionLen: i.mix?.transitionLen ?? 2,
          });
        }
      });
    } catch {
      /* ignore */
    } finally {
      setAutoBusy(false);
    }
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  }

  const [playingUid, setPlayingUid] = useState<string | null>(null);
  const [pausedUid, setPausedUid] = useState<string | null>(null); // uid paused mid-clip (resume available)
  const [progress, setProgress] = useState(0); // 0..1 within the selected slice
  const [needGesture, setNeedGesture] = useState<string | null>(null); // uid awaiting a user gesture to play
  const clipAudio = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clipCache = useRef<Map<string, Promise<string | null>>>(new Map());

  function mixOf(item: SetlistItem) {
    const dur = Number(item.track.durationSec) || 180;
    return {
      inSec: item.mix?.inSec ?? Math.round(dur * 0.15),
      outSec: item.mix?.outSec ?? Math.round(dur * 0.75),
    };
  }

  // Preload each track's clip in the background so play() can run synchronously on click.
  function prepareClip(item: SetlistItem): Promise<string | null> {
    const mix = mixOf(item);
    const key = `${item.uid}:${mix.inSec}:${mix.outSec}`;
    const cached = clipCache.current.get(key);
    if (cached) return cached;
    const p = (async () => {
      try {
        const r = await fetch(
          `http://127.0.0.1:3941/api/clip?url=${encodeURIComponent(item.track.url)}&inSec=${mix.inSec}&outSec=${mix.outSec}`,
          { method: "POST" }
        );
        if (!r.ok) return null;
        const blob = await r.blob();
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    })();
    clipCache.current.set(key, p);
    return p;
  }

  useEffect(() => {
    items.forEach((it) => prepareClip(it));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function stopRaf() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startTick(a: HTMLAudioElement, sliceLen: number) {
    stopRaf();
    const tick = () => {
      const p = Math.min(1, Math.max(0, (a.currentTime || 0) / sliceLen));
      setProgress(p);
      if (p >= 1) {
        stopRaf();
        setPlayingUid(null);
        setPausedUid(null);
        setProgress(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function playClip(item: SetlistItem) {
    const uid = item.uid;
    const a = clipAudio.current;

    // 1) Same track currently playing -> PAUSE (keep element for resume)
    if (playingUid === uid && a) {
      a.pause();
      stopRaf();
      setPlayingUid(null);
      setPausedUid(uid);
      return;
    }

    // 2) Same track paused -> RESUME from where it stopped
    if (pausedUid === uid && a) {
      try {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {}
      const mix = mixOf(item);
      const sliceLen = Math.max(0.1, mix.outSec - mix.inSec);
      setPlayingUid(uid);
      setPausedUid(null);
      setNeedGesture(null);
      const pr = a.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch(() => setNeedGesture(uid));
      }
      startTick(a, sliceLen);
      return;
    }

    // 3) Different track (or fresh) -> load clip and play from start
    if (a) {
      a.pause();
      a.src = "";
      clipAudio.current = null;
    }
    stopRaf();
    setPlayingUid(uid);
    setPausedUid(null);
    setNeedGesture(null);
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
    const mix = mixOf(item);
    const clipUrl = `http://127.0.0.1:3941/api/clip?url=${encodeURIComponent(item.track.url)}&inSec=${mix.inSec}&outSec=${mix.outSec}`;
    (window as any).__diag = { stage: "start", url: clipUrl };
    try {
      const url = await prepareClip(item);
      if (!url) {
        (window as any).__diag = { stage: "fetch", ok: false, status: 500, url: clipUrl };
        setPlayingUid(null);
        setProgress(0);
        return;
      }
      const na = new Audio(url);
      const sliceLen = Math.max(0.1, mix.outSec - mix.inSec);
      na.onended = () => {
        stopRaf();
        setPlayingUid(null);
        setPausedUid(null);
        setProgress(0);
        URL.revokeObjectURL(url);
      };
      clipAudio.current = na;
      const pr = na.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch((e) => {
          (window as any).__diag = { stage: "play", error: e?.message || String(e) };
          setNeedGesture(uid);
          setPlayingUid(null);
          setProgress(0);
        });
      }
      startTick(na, sliceLen);
    } catch {
      setPlayingUid(null);
      setProgress(0);
    }
  }

  function restartClip() {
    const a = clipAudio.current;
    if (!a) return;
    a.currentTime = 0;
    setProgress(0);
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
    const uid = playingUid || pausedUid;
    if (uid) {
      const pr = a.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch(() => setNeedGesture(uid));
      }
      setPlayingUid(uid);
      setPausedUid(null);
      const mix = mixOf(items.find((i) => i.uid === uid) as SetlistItem);
      startTick(a, Math.max(0.1, mix.outSec - mix.inSec));
    }
  }

  function scrubTo(item: SetlistItem, pct: number) {
    const a = clipAudio.current;
    const p = Math.min(1, Math.max(0, pct));
    const mix = mixOf(item);
    const sliceLen = Math.max(0.1, mix.outSec - mix.inSec);
    const tSec = p * sliceLen;
    setProgress(p);
    if (a) {
      // Pause while scrubbing so the playhead follows the drag precisely.
      if (!a.paused) {
        a.pause();
        stopRaf();
        setPlayingUid(null);
        setPausedUid(item.uid);
      }
      try {
        a.currentTime = tSec;
      } catch {}
    }
  }

  function resumeClip() {
    const a = clipAudio.current;
    const uid = needGesture;
    if (!a || !uid) return;
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    const mix = mixOf(item);
    setPlayingUid(uid);
    setPausedUid(null);
    setNeedGesture(null);
    const pr = a.play();
    if (pr && typeof pr.catch === "function") {
      pr.catch(() => setNeedGesture(uid));
    }
    startTick(a, Math.max(0.1, mix.outSec - mix.inSec));
  }

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-dashed border-line bg-surface/40 p-8 text-center">
        <div>
          <IconWave className="mx-auto mb-3 text-faint" width={28} height={28} />
          <p className="text-sm text-muted">Sua timeline está vazia.</p>
          <p className="mt-1 text-xs text-faint">
            Adicione faixas para ver o track de cada uma e ajustar as transições.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-faint">
          Ajuste manual ou deixe o app encontrar os melhores pontos de entrada.
        </p>
        <button
          onClick={autoSet}
          disabled={autoBusy || items.length === 0}
          className="shrink-0 rounded-lg border border-accent/50 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
        >
          {autoBusy ? "Analisando…" : "✨ Autoset"}
        </button>
      </div>

      <div className="space-y-3">
      {items.map((item, idx) => {
        const t = item.track;
        const dur = t.durationSec || 180;
        const mix = item.mix ?? {
          inSec: Math.round(dur * 0.15),
          outSec: Math.round(dur * 0.75),
          transitionOut: "crossfade" as const,
          transitionLen: 2,
        };
        const inPct = (mix.inSec / dur) * 100;
        const outPct = (mix.outSec / dur) * 100;

        return (
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
            className={`rounded-xl border bg-surface/80 p-3 shadow-depth transition-all ${
              overIdx === idx && dragIdx !== idx ? "border-accent/60" : "border-line"
            } ${dragIdx === idx ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="cursor-grab text-faint active:cursor-grabbing" aria-hidden>
                <IconGrip width={18} height={18} />
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ground-2 text-xs font-semibold text-accent">
                {idx + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.thumbnail || coverFor(t.id, t.artist.slice(0, 3).toUpperCase())}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                <p className="truncate text-xs text-muted">{t.artist}</p>
              </div>
              <button
                onClick={() => playClip(item)}
                aria-label={
                  playingUid === item.uid
                    ? "Pausar trecho"
                    : pausedUid === item.uid
                    ? "Retomar trecho"
                    : "Tocar trecho marcado"
                }
                title={
                  playingUid === item.uid
                    ? "Pausar"
                    : pausedUid === item.uid
                    ? "Retomar do ponto atual"
                    : "Tocar o trecho marcado (in/out)"
                }
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                  playingUid === item.uid
                    ? "border-accent bg-accent text-[#1a120a]"
                    : "border-line text-accent hover:border-accent/60 hover:bg-accent-soft"
                }`}
              >
                {playingUid === item.uid ? (
                  <IconPause width={13} height={13} />
                ) : (
                  <IconPlay width={13} height={13} />
                )}
              </button>
              {(playingUid === item.uid || pausedUid === item.uid) && (
                <button
                  onClick={restartClip}
                  aria-label="Voltar ao início do trecho"
                  title="Voltar ao início do trecho"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 19 4 12l7-7" />
                    <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
                  </svg>
                </button>
              )}
              {needGesture === item.uid && (
                <button
                  onClick={resumeClip}
                  className="grid h-8 shrink-0 place-items-center rounded-full border border-accent bg-accent px-3 text-xs font-semibold text-[#1a120a]"
                >
                  ▶ Tocar
                </button>
              )}
            </div>

            {/* Waveform with selected slice */}
            <div className="relative mt-3 h-14 rounded-lg bg-ground-2/60">
              <Waveform />
              {/* selected slice */}
              <div
                className="absolute top-0 h-full rounded-md bg-accent/25 ring-1 ring-accent/50"
                style={{ left: `${inPct}%`, width: `${Math.max(2, outPct - inPct)}%` }}
              />
              {/* in handle */}
              <Handle
                side="left"
                pct={inPct}
                onMove={(p) => {
                  const sec = Math.round((p / 100) * dur);
                  onTune(item.uid, {
                    ...mix,
                    inSec: Math.min(sec, mix.outSec - 1),
                  });
                }}
              />
              {/* out handle */}
              <Handle
                side="right"
                pct={outPct}
                onMove={(p) => {
                  const sec = Math.round((p / 100) * dur);
                  onTune(item.uid, {
                    ...mix,
                    outSec: Math.max(mix.inSec + 1, Math.min(dur, sec)),
                  });
                }}
              />
              {/* playhead while previewing (stays visible when paused too) */}
              {(playingUid === item.uid || pausedUid === item.uid) && (
                <div
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    const el = e.currentTarget.parentElement;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    scrubTo(item, (e.clientX - rect.left) / rect.width);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 0) return; // only while dragging
                    const el = e.currentTarget.parentElement;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    scrubTo(item, (e.clientX - rect.left) / rect.width);
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  }}
                  className="absolute top-0 z-30 h-full w-[6px] -translate-x-1/2 cursor-ew-resize touch-none rounded bg-[#ffd9a8] shadow-[0_0_8px_rgba(255,217,168,0.95)]"
                  style={{ left: `${inPct + progress * (outPct - inPct)}%` }}
                  title="Arraste para adiantar ou retroceder o trecho"
                />
              )}
            </div>

            <div className="mt-2 flex justify-between text-[11px] text-faint">
              <span>in {mix.inSec}s</span>
              <span>
                {playingUid === item.uid
                  ? `tocando ${Math.round(mix.inSec + progress * (mix.outSec - mix.inSec))}s / ${mix.outSec}s`
                  : pausedUid === item.uid
                  ? `pausado em ${Math.round(mix.inSec + progress * (mix.outSec - mix.inSec))}s / ${mix.outSec}s`
                  : `trecho ${mix.outSec - mix.inSec}s · transição ${mix.transitionLen ?? 2}s`}
              </span>
              <span>out {mix.outSec}s / {dur}s</span>
            </div>
          </article>
        );
      })}
    </div>
    </>
  );
}

function Waveform() {
  // Simple deterministic bars to suggest a waveform.
  const bars = Array.from({ length: 64 }, (_, i) => 20 + Math.abs(Math.sin(i * 0.7) * 60) + ((i * 13) % 17));
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 64 100">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i}
          y={(100 - h) / 2}
          width={0.8}
          height={h}
          fill="rgba(244,236,226,0.18)"
        />
      ))}
    </svg>
  );
}

function Handle({
  side,
  pct,
  onMove,
}: {
  side: "left" | "right";
  pct: number;
  onMove: (pct: number) => void;
}) {
  return (
    <div
      className={`absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-md bg-accent shadow ${
        side === "left" ? "border-l" : "border-r"
      }`}
      style={{ left: `${pct}%` }}
      onPointerDown={(e) => {
        e.preventDefault();
        const parent = (e.currentTarget.parentElement as HTMLElement)!;
        const rect = parent.getBoundingClientRect();
        const move = (ev: PointerEvent) => {
          const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
          onMove((x / rect.width) * 100);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      aria-label={side === "left" ? "Início do trecho" : "Fim do trecho"}
    >
      <span className="absolute left-1/2 top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#1a120a]" />
    </div>
  );
}
