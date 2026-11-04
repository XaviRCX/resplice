"use client";

import { useState, useEffect, useRef } from "react";
import type { Genre, MixPlan, SetlistItem, Track } from "@/lib/types";
import { GENRES } from "@/lib/types";
import { SearchPanel } from "@/components/SearchPanel";
import { SetlistBoard } from "@/components/SetlistBoard";
import { SpotifyPanel } from "@/components/SpotifyPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { Timeline } from "@/components/Timeline";
import { TransitionsPanel } from "@/components/TransitionsPanel";
import { RecentPanel } from "@/components/RecentPanel";
import { LibraryPanel } from "@/components/LibraryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  IconSpark,
  IconDownload,
  IconPlay,
  IconPause,
  IconLink,
} from "@/components/icons";
import { formatDuration } from "@/lib/engine";

let uidCounter = 0;
const nextUid = () => `u${Date.now()}_${uidCounter++}`;

export default function Studio() {
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<Genre>("House");
  const [creativity, setCreativity] = useState(0.5);
  const [plan, setPlan] = useState<MixPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dlState, setDlState] = useState<"idle" | "busy">("idle");
  const mixAudioRef = useRef<HTMLAudioElement | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"buscar" | "spotify" | "recentes" | "biblioteca">("buscar");
  const [library, setLibrary] = useState<Track[]>([]);

  // Load / persist the manual library (links added from search / spotify).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("resplice-library-links");
      if (saved) setLibrary(JSON.parse(saved));
    } catch {}
  }, []);
  function persistLibrary(list: Track[]) {
    setLibrary(list);
    try {
      localStorage.setItem("resplice-library-links", JSON.stringify(list));
    } catch {}
  }
  function addToLibrary(t: Track) {
    persistLibrary([t, ...library].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 50));
  }

  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      setFatal((e.error?.stack || e.message || String(e)) as string);
    };
    const rej = (e: PromiseRejectionEvent) => {
      setFatal((e.reason?.stack || e.reason?.message || String(e.reason)) as string);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rej);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rej);
    };
  }, []);

  function addTrack(t: Track) {
    setItems((prev) => [...prev, { uid: nextUid(), track: t }]);
    trackRecent(t);
  }

  function trackRecent(t: Track) {
    setRecent((prev) => [t, ...prev.filter((x) => x.id !== t.id)].slice(0, 10));
  }

  function tuneTrack(uid: string, mix: SetlistItem["mix"]) {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, mix } : i))
    );
  }

  async function generate() {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const r = await fetch("/api/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, description, targetGenre: genre, creativity }),
      });
      const j = await r.json();
      setPlan(j.plan);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!plan) return;
    setDlState("busy");
    try {
      const r = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.title,
          targetBpm: plan.targetBpm,
          segments: plan.segments,
          creativity: plan.creativity,
          items,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error || "Download failed.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${plan.title.replace(/[^a-z0-9]+/gi, "-") || "resplice-mix"}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDlState("idle");
    }
  }

  async function previewMix() {
    if (!plan) return;
    // Stop if currently playing
    if (playing) {
      mixAudioRef.current?.pause();
      mixAudioRef.current = null;
      setPlaying(false);
      return;
    }
    // Generate the mix audio (same pipeline as download) and play it inline.
    setPlaying(true);
    try {
      const r = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.title,
          targetBpm: plan.targetBpm,
          segments: plan.segments,
          creativity: plan.creativity,
          items,
        }),
      });
      if (!r.ok) {
        setPlaying(false);
        alert("Falha ao gerar o áudio do mix para preview.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      mixAudioRef.current = a;
      a.onended = () => {
        setPlaying(false);
        mixAudioRef.current = null;
        URL.revokeObjectURL(url);
      };
      const pr = a.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch(() => {
          // Autoplay blocked — keep state, user can click Stop
          setPlaying(false);
          mixAudioRef.current = null;
        });
      }
    } catch {
      setPlaying(false);
    }
  }

  return (
    <ErrorBoundary>
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
      {fatal && (
        <div className="rounded-xl border border-[#7a2230] bg-[#2a0f14] p-4 text-sm text-[#ffb4b4]">
          <strong className="block text-[#ff6b6b]">Runtime error (diagnostic):</strong>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
            {fatal}
          </pre>
        </div>
      )}
      <TopBar count={items.length} onGenerate={generate} loading={loading} />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[360px_1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="flex gap-1.5 text-xs">
            {(["buscar", "spotify", "recentes", "biblioteca"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLeftTab(t)}
                className={`rounded-full border px-3 py-1.5 capitalize transition-colors ${
                  leftTab === t
                    ? "border-accent/60 bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {leftTab === "buscar" && <SearchPanel onAdd={addTrack} onAccess={trackRecent} onLibrary={addToLibrary} />}
          {leftTab === "spotify" && <SpotifyPanel onAdd={addTrack} onAccess={trackRecent} onLibrary={addToLibrary} />}
          {leftTab === "recentes" && (
            <RecentPanel recent={recent} onAdd={addTrack} onLibrary={addToLibrary} />
          )}
          {leftTab === "biblioteca" && (
            <LibraryPanel
              tracks={library}
              onAdd={addTrack}
              onRemove={(id) => persistLibrary(library.filter((x) => x.id !== id))}
              onAddLink={addToLibrary}
              onDownload={async (t) => {
                const dlPort = 3941;
                const api = `http://127.0.0.1:${dlPort}/api/dl?url=${encodeURIComponent(t.url)}&title=${encodeURIComponent(t.title)}`;
                try {
                  const r = await fetch(api, { redirect: "follow" });
                  if (!r.ok) {
                    alert("Falha ao baixar o áudio.");
                    return;
                  }
                  const blob = await r.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${(t.title || "track").replace(/[\\/:*?"<>|]/g, "_")}.mp3`;
                  a.click();
                } catch {
                  alert("Falha ao baixar o áudio. O servidor de downloads pode não estar rodando.");
                }
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Setlist */}
          <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                  Setlist
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Drag to order. Lock a track to keep its slot while the engine
                  optimizes the rest.
                </p>
              </div>
              <span className="rounded-full bg-ground-2 px-3 py-1 text-xs text-muted">
                {items.length} track{items.length === 1 ? "" : "s"}
              </span>
            </header>
            <SetlistBoard items={items} onChange={setItems} />
          </section>

          {/* Fine-tuning timeline */}
          <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
            <header className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                Timeline
              </h2>
              <p className="mt-1 text-sm text-muted">
                Veja o track de cada música, arraste para reordenar e ajuste onde
                cada faixa entra e sai do mix.
              </p>
            </header>
            <Timeline items={items} onChange={setItems} onTune={tuneTrack} />
          </section>

          {/* Mix console */}
          <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
            <header className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                The brief
              </h2>
              <p className="mt-1 text-sm text-muted">
                Describe the vibe, pick a target genre, and set how bold the mix
                should be.
              </p>
            </header>

            <label className="block text-xs font-medium uppercase tracking-wide text-faint">
              Describe your idea
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. A late-night drive mix — moody synthwave into a euphoric house drop, building energy toward the end."
              className="mt-2 w-full resize-none rounded-xl border border-line bg-ground-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-faint">
                  Target genre
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        genre === g
                          ? "border-accent/60 bg-accent-soft text-accent"
                          : "border-line text-muted hover:text-ink"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-faint">
                  <span>Creativity</span>
                  <span className="text-accent">{Math.round(creativity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={creativity}
                  onChange={(e) => setCreativity(Number(e.target.value))}
                  className="mt-4 w-full accent-[var(--color-accent)]"
                />
                <div className="mt-1 flex justify-between text-[11px] text-faint">
                  <span>Conservative</span>
                  <span>Bold</span>
                </div>
              </div>
            </div>

            <button
              onClick={generate}
              disabled={loading || items.length === 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-[#1a120a] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <IconSpark width={16} height={16} />
              {loading ? "Mixing…" : "Generate mix"}
            </button>
          </section>

          <TransitionsPanel items={items} onTune={tuneTrack} />

          {plan && (
            <ResultPlayer
              plan={plan}
              playing={playing}
              onToggle={previewMix}
              onDownload={download}
              dlState={dlState}
              onRegenerate={generate}
            />
          )}

          {/* Right rail: dynamic suggestions react to the current setlist */}
          <SuggestionsPanel
            items={items}
            targetGenre={genre}
            onAdd={addTrack}
          />
        </div>
      </div>
    </main>
    </ErrorBoundary>
  );
}

function TopBar({
  count,
  onGenerate,
  loading,
}: {
  count: number;
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 font-display text-xl font-extrabold text-accent">
          R
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">
            Resplice
          </h1>
          <p className="text-xs text-muted">AI DJ Studio — describe, fuse, mix</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-faint">
        <IconLink width={14} height={14} />
        <span>YouTube · Spotify</span>
      </div>
    </header>
  );
}

function ResultPlayer({
  plan,
  playing,
  onToggle,
  onDownload,
  dlState,
  onRegenerate,
}: {
  plan: MixPlan;
  playing: boolean;
  onToggle: () => void;
  onDownload: () => void;
  dlState: "idle" | "busy";
  onRegenerate: () => void;
}) {
  return (
    <section className="animate-float-in rounded-2xl border border-accent/30 bg-surface/80 p-5 shadow-lift">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">
            {plan.generatedBy === "llm" ? "AI mix" : "Engine mix"}
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            {plan.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{plan.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#1a120a] transition-opacity hover:opacity-90"
          >
            {playing ? <IconPause width={15} height={15} /> : <IconPlay width={15} height={15} />}
            {playing ? "Stop" : "Preview"}
          </button>
          <button
            onClick={onDownload}
            disabled={dlState === "busy"}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent/50 disabled:opacity-50"
          >
            <IconDownload width={15} height={15} />
            {dlState === "busy" ? "Rendering…" : "Download .wav"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-ground-2 px-3 py-1 text-muted">
          {plan.targetBpm} BPM
        </span>
        <span className="rounded-full bg-ground-2 px-3 py-1 text-muted">
          {plan.targetGenre}
        </span>
        <span className="rounded-full bg-ground-2 px-3 py-1 text-muted">
          {formatDuration(plan.estDurationSec)}
        </span>
      </div>

      <ol className="mt-4 space-y-1.5">
        {plan.segments.map((s, i) => (
          <li
            key={s.trackId + i}
            className="flex items-center gap-3 rounded-lg border border-line bg-ground-2/50 px-3 py-2 text-sm"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-ink">
              {s.title} <span className="text-muted">— {s.artist}</span>
            </span>
            <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-muted">
              {s.transitionIn} → {s.transitionOut}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl border border-line bg-ground-2/50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-faint">
          Engine notes
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {plan.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">·</span>
              {n}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onRegenerate}
        className="mt-4 text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        Regenerate with current changes →
      </button>
    </section>
  );
}
