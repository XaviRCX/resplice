"use client";

/**
 * Local music library.
 *
 * Two backends:
 *  1. File System Access API (Chrome/Edge with the flag on): the user picks a
 *     folder, we persist the directory handle in IndexedDB so it survives
 *     reloads, and we can re-list it anytime.
 *  2. Fallback for browsers without that API (Brave w/o flag, Firefox, etc.):
 *     an <input type="file" webkitdirectory> lets the user pick a folder; we
 *     read the selected audio File objects directly into memory. This does
 *     not persist across reloads, but works everywhere.
 *
 * A LibraryTrack carries either a FileSystemFileHandle (backend 1) or a
 * live File (backend 2) so the UI can play/preview it.
 */

const DB_NAME = "resplice-library";
const STORE = "handles";
const KEY = "musicDir";

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i;

export type LibraryTrack = {
  name: string;
  size: number;
  lastModified: number;
  /** Backend 1: persistent handle. */
  handle?: FileSystemFileHandle;
  /** Backend 2: in-memory file (no persistence). */
  file?: File;
};

export const fsAccessSupported =
  typeof window !== "undefined" && "showDirectoryPicker" in window;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putHandle(handle: FileSystemDirectoryHandle) {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(KEY);
    r.onsuccess = () =>
      resolve((r.result as FileSystemDirectoryHandle) ?? null);
    r.onerror = () => reject(r.error);
  });
}

/** Prompt the user to pick the library folder (first-run setup, backend 1). */
export async function pickLibraryFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!fsAccessSupported) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({
      id: "resplice-music",
      mode: "readwrite",
    });
    await putHandle(handle);
    return handle;
  } catch {
    return null; // user cancelled
  }
}

/** Get the saved folder handle (backend 1). Does NOT re-prompt for permission
 *  automatically — that must happen from a user gesture (clicking the button),
 *  otherwise the browser throws NotAllowedError and the app crashes. */
export async function getLibraryFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!fsAccessSupported) return null;
  try {
    return (await getHandle()) ?? null;
  } catch {
    return null;
  }
}

/** Convert File objects (from the webkitdirectory input) into LibraryTracks. */
export function tracksFromFiles(files: FileList | File[]): LibraryTrack[] {
  const arr = Array.from(files).filter((f) => AUDIO_EXT.test(f.name));
  return arr
    .map((f) => ({
      name: f.name,
      size: f.size,
      lastModified: f.lastModified,
      file: f,
    }))
    .sort((a, b) => b.lastModified - a.lastModified);
}

export async function listLibrary(
  handle: FileSystemDirectoryHandle
): Promise<LibraryTrack[]> {
  const out: LibraryTrack[] = [];
  // @ts-ignore - AsyncIterable not in all lib defs
  for await (const [name, entry] of (handle as any).entries()) {
    if (entry.kind === "file" && AUDIO_EXT.test(name)) {
      const file: File = await entry.getFile();
      out.push({ name, size: file.size, lastModified: file.lastModified, handle: entry });
    }
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

/** Write a blob directly into the saved library folder (FS Access API). */
export async function saveToFolder(
  folder: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<void> {
  const safe = filename.replace(/[\\/:*?"<>|]/g, "_");
  const fileHandle: FileSystemFileHandle = await (folder as any).getFileHandle(
    safe,
    { create: true }
  );
  const w = await (fileHandle as any).createWritable();
  await w.write(blob);
  await w.close();
}

/** Trigger a normal browser download (fallback for browsers w/o FS API). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
