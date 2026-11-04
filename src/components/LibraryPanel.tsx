"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import {
  fsAccessSupported,
  getLibraryFolder,
  pickLibraryFolder,
  listLibrary,
  tracksFromFiles,
  type LibraryTrack,
} from "@/lib/library";
import { IconFolder, IconPlus, IconWave, IconLink, IconDownload } from "./icons";
import { TrackPreview } from "./TrackPreview";

export function LibraryPanel({
  tracks,
  onAdd,
  onRemove,
  onDownload,
  onAddLink,
}: {
  tracks: Track[];
  onAdd: (t: Track) => void;
  onRemove: (id: string) => void;
  onDownload: (t: Track) => void;
  onAddLink: (t: Track) => void;
}) {
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileTracks, setFileTracks] = useState<LibraryTrack[]>([]);
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState(false);
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fsAccessSupported) return;
    getLibraryFolder().then((h) => {
      if (h) {
        setFolder(h);
        refresh(h);
      }
    });
  }, []);

  async function refresh(h: FileSystemDirectoryHandle) {
    setBusy(true);
    setPermError(false);
    try {
      setFileTracks(await listLibrary(h));
    } catch (e: any) {
      // Permission likely expired between sessions -> ask the user to re-pick.
      if (e && (e.name === "NotAllowedError" || e.message?.includes("NotAllowed"))) {
        setPermError(true);
      } else {
        setFileTracks([]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    const h = await pickLibraryFolder();
    if (h) {
      setFolder(h);
      refresh(h);
    }
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (list && list.length) setFileTracks(tracksFromFiles(list));
  }

  async function addByLink() {
    const u = link.trim();
    if (!u) return;
    setLinkBusy(true);
    try {
      const r = await fetch("/api/library/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = await r.json();
      if (j.track) {
        onAddLink(j.track);
        setLink("");
      } else {
        alert(j.error || "Link não suportado (use YouTube ou Spotify).");
      }
    } catch {
      alert("Falha ao adicionar o link.");
    } finally {
      setLinkBusy(false);
    }
  }

  const unsupported = !fsAccessSupported;

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface/70 p-5 shadow-depth">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
          <IconFolder width={16} height={16} className="text-accent" />
          Biblioteca
        </h2>
        {folder && (
          <button
            onClick={() => refresh(folder!)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            Atualizar
          </button>
        )}
      </header>

      {/* Link input */}
      <div className="mb-3 flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addByLink()}
          placeholder="Cole o link do YouTube ou Spotify"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ground-2/60 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />
        <button
          onClick={addByLink}
          disabled={linkBusy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[#1a120a] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <IconLink width={14} height={14} />
          {linkBusy ? "…" : "Adicionar"}
        </button>
      </div>

      {/* Folder selector (FS API mode) */}
      {fsAccessSupported && !folder && (
        <button
          onClick={choose}
          className="mb-3 flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink"
        >
          <IconFolder width={16} height={16} />
          Selecionar pasta local
        </button>
      )}
      {fsAccessSupported && folder && permError && (
        <div className="mb-3 rounded-xl border border-line bg-ground-2/50 p-3">
          <p className="mb-2 text-xs text-muted">
            A permissão da pasta expirou. Selecione a pasta novamente para continuar.
          </p>
          <button
            onClick={choose}
            className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
          >
            <IconFolder width={14} height={14} />
            Reselecionar pasta
          </button>
        </div>
      )}

      {/* Folder selector (fallback mode) */}
      {unsupported && (
        <label className="mb-3 block cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink">
          <input
            ref={fileRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            accept="audio/*"
            onChange={onFiles}
            className="hidden"
          />
          <span className="flex items-center gap-2">
            <IconFolder width={16} height={16} />
            Selecionar pasta de arquivos
          </span>
        </label>
      )}

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {tracks.map((t) => (
          <LinkRow key={t.id} t={t} onAdd={onAdd} onRemove={() => onRemove(t.id)} onDownload={() => onDownload(t)} />
        ))}
        {fileTracks.map((t) => (
          <FileRow key={t.name} t={t} onAdd={onAdd} />
        ))}
        {tracks.length === 0 && fileTracks.length === 0 && !busy && (
          <p className="text-sm text-faint">
            Nenhuma música ainda. Cole um link, adicione da busca/Spotify, ou selecione uma pasta.
          </p>
        )}
        {busy && <p className="text-sm text-faint">Lendo pasta…</p>}
      </div>
    </section>
  );
}

function LinkRow({
  t,
  onAdd,
  onRemove,
  onDownload,
}: {
  t: Track;
  onAdd: (tr: Track) => void;
  onRemove: () => void;
  onDownload: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5">
      {t.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <IconWave className="h-10 w-10 shrink-0 text-faint" width={40} height={40} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{t.title}</p>
        <p className="truncate text-xs text-muted">{t.artist}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <TrackPreview bpm={t.bpm} audioUrl={t.url} previewUrl={t.previewUrl} trackId={t.id} compact />
        <button
          onClick={onDownload}
          aria-label={`Baixar ${t.title}`}
          title="Baixar áudio"
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
        >
          <IconDownload width={14} height={14} />
        </button>
        <button
          onClick={() => onAdd(t)}
          aria-label={`Add ${t.title}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
        >
          <IconPlus width={15} height={15} />
        </button>
        <button
          onClick={onRemove}
          aria-label="Remover"
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-faint transition-colors hover:border-line hover:text-ink"
        >
          ✕
        </button>
      </div>
    </article>
  );
}

function FileRow({ t, onAdd }: { t: LibraryTrack; onAdd: (tr: Track) => void }) {
  const blob = t.file ? URL.createObjectURL(t.file) : undefined;
  const track: Track = {
    id: `local:${t.name}`,
    title: t.name.replace(/\.[^.]+$/, ""),
    artist: "Biblioteca local",
    source: "youtube",
    url: "",
    thumbnail: "",
    durationSec: 180,
    bpm: 120,
    musicalKey: "Am",
    energy: 0.6,
    genres: ["Library"],
    synthetic: false,
    localFile: t.handle,
    localBlobUrl: blob,
  } as Track;
  return (
    <article className="flex items-center gap-3 rounded-xl border border-line bg-ground-2/60 p-2.5">
      <IconWave className="h-10 w-10 shrink-0 text-faint" width={40} height={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{t.name.replace(/\.[^.]+$/, "")}</p>
        <p className="truncate text-xs text-muted">{(t.size / 1_048_576).toFixed(1)} MB</p>
      </div>
      <div className="flex items-center gap-1.5">
        <TrackPreview bpm={120} localFile={t.handle} localBlobUrl={blob} trackId={`local:${t.name}`} compact />
        <button
          onClick={() => onAdd(track)}
          aria-label={`Add ${t.name}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-accent transition-colors hover:border-accent/60 hover:bg-accent-soft"
        >
          <IconPlus width={15} height={15} />
        </button>
      </div>
    </article>
  );
}
