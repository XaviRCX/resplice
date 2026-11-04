"use client";

// Global singleton preview player.
// - YouTube sources play the REAL audio via the YouTube IFrame Player API.
// - Spotify sources with a 30s previewUrl play that file.
// - Everything else falls back to a synthesized beat at the track BPM.
// Only ONE preview plays at a time.

type Source = {
  previewUrl?: string;
  audioUrl?: string;
  bpm: number;
  localFile?: FileSystemFileHandle;
  localBlobUrl?: string;
};

let ctx: AudioContext | null = null;
let current: { id: string; stop: () => void } | null = null;
const listeners = new Set<(id: string | null) => void>();
// YouTube video IDs whose embedding is blocked (owner disabled embed). These
// can never play in-app, so the UI hides the in-app play button for them.
const blockedEmbed = new Set<string>();
const blockedListeners = new Set<() => void>();

// ---- YouTube IFrame API ----
let ytApiPromise: Promise<void> | null = null;
let ytPlayer: any = null;
let ytHost: HTMLDivElement | null = null;

export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}

function isAudioFile(u?: string) {
  return !!u && /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(u);
}

function ensureYT(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined") return resolve();
    const w = window as any;
    if (w.YT && w.YT.Player) return resolve();
    if (!ytHost) {
      ytHost = document.createElement("div");
      ytHost.id = "yt-preview-host";
      ytHost.style.cssText =
        "position:fixed;bottom:8px;right:8px;width:2px;height:2px;overflow:hidden;z-index:1;opacity:0.01";
      document.body.appendChild(ytHost);
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => resolve();
    document.head.appendChild(tag);
    // Fallback in case the global callback already fired or is bypassed.
    const t = window.setInterval(() => {
      if (w.YT && w.YT.Player) {
        window.clearInterval(t);
        resolve();
      }
    }, 120);
    window.setTimeout(() => window.clearInterval(t), 8000);
  });
  return ytApiPromise;
}

function playYT(id: string, videoId: string) {
  ensureYT().then(() => {
    const w = window as any;
    if (!w.YT || !w.YT.Player || !ytHost) {
      playBeat(id, 120);
      return;
    }
    // Inject a real, visible (tiny) iframe — Chrome permits muted autoplay of
    // a rendered iframe, whereas the JS-API player on a hidden host often
    // stays UNSTARTED (-1). We unmute once playback actually begins.
    ytHost.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.width = "2";
    frame.height = "2";
    frame.allow = "autoplay; encrypted-media";
    frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(
      window.location.origin
    )}`;
    ytHost.appendChild(frame);

    // Hook the API player onto the iframe to control mute/volume, and open
    // the video in a new tab if embedding is blocked (common for some tracks).
    let tries = 0;
    const attach = () => {
      if (w.YT && w.YT.Player && frame.id) {
        try {
          ytPlayer = new w.YT.Player(frame.id, {
            events: {
              onStateChange: (e: any) => {
                if (e.data === 1) {
                  try {
                    ytPlayer.setVolume(100);
                    ytPlayer.unMute();
                  } catch {}
                }
              },
              onError: (e: any) => {
                // 101/150 = embedding blocked by the owner. Mark it so the UI
                // hides the in-app play button, and open the real video in a
                // new tab so audio always works.
                if (e && (e.data === 101 || e.data === 150)) {
                  if (!blockedEmbed.has(videoId)) {
                    blockedEmbed.add(videoId);
                    blockedListeners.forEach((fn) => fn());
                  }
                  try {
                    window.open(
                      `https://www.youtube.com/watch?v=${videoId}`,
                      "_blank",
                      "noopener"
                    );
                  } catch {}
                }
              },
            },
          });
          w.__ytPlayer = ytPlayer;
          return;
        } catch {
          /* retry */
        }
      }
      if (tries++ < 25) window.setTimeout(attach, 150);
    };
    frame.id = "yt-preview-frame";
    attach();
  });
}

function stopYT() {
  try {
    ytPlayer?.stopVideo?.();
  } catch {}
  if (ytHost) ytHost.innerHTML = "";
}

// ---- Synthesized beat fallback ----
function getCtx(): AudioContext {
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function playBeat(id: string, bpm: number) {
  const c = getCtx();
  const beatMs = (60 / Math.max(40, bpm || 120)) * 1000;
  const tick = () => {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = 110;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  };
  tick();
  const iv = window.setInterval(tick, beatMs);
  current = {
    id,
    stop: () => window.clearInterval(iv),
  };
}

// ---- Public API ----
export function getActiveId(): string | null {
  return current?.id ?? null;
}

export function subscribe(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// YouTube embed-block tracking: lets the UI hide the in-app play button for
// videos the owner has disabled embedding on (they can only be opened in YT).
export function isEmbedBlocked(videoId: string): boolean {
  return blockedEmbed.has(videoId);
}

export function subscribeBlocked(fn: () => void): () => void {
  blockedListeners.add(fn);
  return () => {
    blockedListeners.delete(fn);
  };
}

function emit() {
  const id = current?.id ?? null;
  listeners.forEach((fn) => fn(id));
}

export function togglePreview(id: string, src: Source) {
  if (current?.id === id) {
    current.stop();
    current = null;
    emit();
    return;
  }
  if (current) current.stop();

  // Local library file: play the real audio. Prefer the persistent FS handle;
  // fall back to an in-memory object URL (Brave/Firefox backend).
  if (src.localFile || src.localBlobUrl) {
    current = { id, stop: () => {} };
    emit();
    (async () => {
      try {
        let url: string;
        if (src.localFile) {
          const file: File = await (src.localFile as any).getFile();
          url = URL.createObjectURL(file);
        } else {
          url = src.localBlobUrl!;
        }
        const a = new Audio(url);
        a.play().catch(() => {});
        a.onended = () => {
          if (current?.id === id) {
            current = null;
            emit();
          }
          if (src.localFile) URL.revokeObjectURL(url);
        };
        current = {
          id,
          stop: () => {
            try {
              a.pause();
              a.src = "";
            } catch {}
            if (src.localFile) URL.revokeObjectURL(url);
          },
        };
      } catch {
        playBeat(id, src.bpm);
        emit();
      }
    })();
    return;
  }

  const ytId = youtubeId(src.audioUrl);
  if (ytId) {
    current = { id, stop: stopYT };
    emit();
    playYT(id, ytId);
    return;
  }

  const real =
    src.previewUrl && isAudioFile(src.previewUrl)
      ? src.previewUrl
      : src.audioUrl && isAudioFile(src.audioUrl)
        ? src.audioUrl
        : null;

  if (real) {
    const a = new Audio(real);
    a.play().catch(() => {});
    a.onended = () => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    };
    current = {
      id,
      stop: () => {
        try {
          a.pause();
          a.src = "";
        } catch {}
      },
    };
    emit();
  } else {
    playBeat(id, src.bpm);
    emit();
  }
}

export function stopAll() {
  if (current) {
    current.stop();
    current = null;
    emit();
  }
}
