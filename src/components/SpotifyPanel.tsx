"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { IconSpotify, IconPlus, IconLink, IconFolder } from "./icons";
import { TrackPreview } from "./TrackPreview";

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  image: string;
  owner: string;
  public: boolean;
}

export function SpotifyPanel({
  onAdd,
  onAccess,
  onLibrary,
}: {
  onAdd: (t: Track) => void;
  onAccess?: (t: Track) => void;
  onLibrary?: (t: Track) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<{ display_name: string; image?: string } | null>(
    null
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [library, setLibrary] = useState<Track[]>([]);
  const [tab, setTab] = useState<"playlists" | "library">("playlists");
  const [activePl, setActivePl] = useState<Playlist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshStatus() {
    const j = await fetch("/api/spotify/playlists").then((r) => r.json());
    setConnected(j.connected);
    setUser(j.user);
    setPlaylists(j.playlists ?? []);
  }

  useEffect(() => {
    fetch("/api/spotify/auth")
      .then((r) => r.json())
      .then((j) => setEnabled(j.enabled))
      .catch(() => setEnabled(false));
    refreshStatus();
  }, []);

  // The OAuth popup posts a message when login completes in the callback tab.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data && e.data.type === "spotify-connected") {
        refreshStatus();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function disconnect() {
    try {
      await fetch("/api/spotify/disconnect", { method: "POST" });
    } catch {}
    setConnected(false);
    setUser(null);
    setPlaylists([]);
    setTracks([]);
    setLibrary([]);
    setActivePl(null);
  }

  async function connect() {
    setBusy(true);
    setError("");
    const popup = window.open("about:blank", "spotify-auth", "width=480,height=720");
    try {
      const j = await fetch("/api/spotify/auth").then((r) => r.json());
      if (!j.enabled || !j.url) {
        setError("Spotify nao configurado. Defina SPOTIFY_CLIENT_ID no .env.local.");
        popup?.close();
        return;
      }
      if (popup) popup.location.href = j.url;
      else window.open(j.url, "spotify-auth", "width=480,height=720");
    } catch (e: any) {
      setError(e.message);
      popup?.close();
    } finally {
      setBusy(false);
    }
  }

  async function openPlaylist(pl: Playlist) {
    setActivePl(pl);
    setBusy(true);
    try {
      const j = await fetch(`/api/spotify/playlist/${pl.id}`).then((r) => r.json());
      setTracks(j.tracks ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadLibrary() {
    setBusy(true);
    try {
      const j = await fetch("/api/spotify/library").then((r) => r.json());
      setLibrary(j.tracks ?? []);
      if (onAccess) (j.tracks ?? []).slice(0, 10).forEach((t: Track) => onAccess(t));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (enabled === false) {
    return (
      <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
        <header className="mb-3 flex items-center gap-2">
          <IconSpotify width={18} height={18} className="text-[#1DB954]" />
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            Spotify
          </h2>
        </header>
        <p className="text-sm text-muted">
          Para conectar suas playlists, defina{" "}
          <code className="rounded bg-ground-2 px-1.5 py-0.5 text-accent">
            SPOTIFY_CLIENT_ID
          </code>{" "}
          no <code className="rounded bg-ground-2 px-1.5 py-0.5">.env.local</code> e
          reinicie o app.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconSpotify width={18} height={18} className="text-[#1DB954]" />
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            Spotify
          </h2>
        </div>
        {connected && user && (
          <span className="flex items-center gap-2 text-xs text-muted">
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
            )}
            {user.display_name}
            <button
              onClick={disconnect}
              className="ml-1 rounded-md border border-line px-2 py-0.5 text-[11px] text-faint hover:text-ink"
            >
              sair
            </button>
          </span>
        )}
      </header>

      {!connected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Conecte sua conta para ver e importar suas playlists.
          </p>
          <button
            onClick={connect}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <IconLink width={15} height={15} />
            Conectar Spotify
          </button>
          {error && <p className="text-xs text-bad">{error}</p>}
          <p className="text-[11px] text-faint">
            Fluxo OAuth PKCE — abre o Spotify, voce autoriza e volta sozinho.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTab("playlists");
                setActivePl(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "playlists"
                  ? "border border-accent/50 bg-accent-soft text-accent"
                  : "border border-line text-muted hover:text-ink"
              }`}
            >
              Playlists ({playlists.length})
            </button>
            <button
              onClick={() => {
                setTab("library");
                setActivePl(null);
                if (library.length === 0) loadLibrary();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "library"
                  ? "border border-accent/50 bg-accent-soft text-accent"
                  : "border border-line text-muted hover:text-ink"
              }`}
            >
              Biblioteca
            </button>
          </div>

          {tab === "playlists" ? (
            !activePl ? (
              <>
                <p className="text-sm text-muted">Suas playlists ({playlists.length}):</p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => openPlaylist(pl)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5 text-left transition-colors hover:border-line-strong"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pl.image}
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {pl.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {pl.trackCount} faixas · {pl.owner}
                        </p>
                      </div>
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <p className="text-sm text-faint">Nenhuma playlist encontrada.</p>
                  )}
                </div>
                <button
                  onClick={refreshStatus}
                  className="text-xs text-accent underline-offset-4 hover:underline"
                >
                  Atualizar
                </button>
              </>
            ) : (
              <div>
                <button
                  onClick={() => {
                    setActivePl(null);
                    setTracks([]);
                  }}
                  className="mb-3 text-xs text-accent hover:underline"
                >
                  ← Voltar as playlists
                </button>
                <p className="mb-2 text-sm text-muted">
                  {activePl.name} — {tracks.length} faixas
                </p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {tracks.map((t) => (
                    <TrackRow key={t.id} t={t} onAdd={onAdd} onLibrary={onLibrary} />
                  ))}
                  {tracks.length === 0 && (
                    <p className="text-sm text-faint">
                      O Spotify nao liberou as faixas desta playlist (conta em modo
                      desenvolvimento ou escopo restrito). Use a aba Biblioteca.
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {library.map((t) => (
                <TrackRow key={t.id} t={t} onAdd={onAdd} onLibrary={onLibrary} />
              ))}
              {library.length === 0 && !busy && (
                <p className="text-sm text-faint">
                  Sua biblioteca de músicas salvas aparece aqui.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TrackRow({ t, onAdd, onLibrary }: { t: Track; onAdd: (t: Track) => void; onLibrary?: (t: Track) => void }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={t.thumbnail}
        alt=""
        className="h-11 w-11 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{t.title}</p>
        <p className="truncate text-xs text-muted">{t.artist}</p>
        <p className="mt-0.5 flex gap-2 text-[11px] text-faint">
          <span>{t.bpm} BPM</span>
          <span>·</span>
          <span>{t.musicalKey}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <TrackPreview bpm={t.bpm} previewUrl={t.previewUrl} audioUrl={t.url} trackId={t.id} compact />
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
            aria-label={`Add ${t.title}`}
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
          >
            <IconPlus width={15} height={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
