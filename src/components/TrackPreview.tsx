"use client";

import { useEffect, useState } from "react";
import { IconPlay, IconPause, IconSpotify } from "./icons";
import {
  togglePreview,
  getActiveId,
  subscribe,
  isEmbedBlocked,
  subscribeBlocked,
  youtubeId as getYtId,
} from "@/lib/player";

export function TrackPreview({
  bpm,
  audioUrl,
  previewUrl,
  localFile,
  localBlobUrl,
  compact = false,
  trackId,
}: {
  bpm: number;
  audioUrl?: string;
  previewUrl?: string;
  localFile?: FileSystemFileHandle;
  localBlobUrl?: string;
  compact?: boolean;
  trackId?: string;
}) {
  // Use a stable id so the global player can track which track is active.
  const id = trackId ?? `bpm-${bpm}-${previewUrl ?? ""}`;
  const [playing, setPlaying] = useState(false);
  const [ytBlocked, setYtBlocked] = useState(false);

  useEffect(() => {
    setPlaying(getActiveId() === id);
    const unsub = subscribe((active) => setPlaying(active === id));
    // Re-render if this video turns out to have embedding disabled.
    const ytId = getYtId(audioUrl);
    const unsubBlocked = ytId
      ? subscribeBlocked(() => setYtBlocked(isEmbedBlocked(ytId)))
      : undefined;
    if (ytId) setYtBlocked(isEmbedBlocked(ytId));
    return () => {
      unsub();
      unsubBlocked?.();
    };
  }, [id, audioUrl]);

  // If this is a YouTube source, offer a guaranteed real-audio fallback that
  // opens the video in a new tab (bypasses any in-page autoplay restriction).
  const isYouTube = !!audioUrl && /youtube\.com|youtu\.be/i.test(audioUrl);
  const isSpotify = !!audioUrl && /open\.spotify\.com|spotify:/i.test(audioUrl);
  const isLocal = !!localFile;
  // Show the in-app play button only for tracks that can actually play here:
  // a Spotify 30s clip, a YouTube video whose embed is allowed, or a local file.
  const hasPreview = !!previewUrl || isLocal || (isYouTube && !ytBlocked);

  const bars = 28;
  return (
    <span className="flex items-center gap-1">
      {hasPreview && (
        <button
          type="button"
          onClick={() => togglePreview(id, { previewUrl, audioUrl, bpm, localFile, localBlobUrl })}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="group flex items-center gap-2 rounded-full border border-line bg-surface-2/60 px-2.5 py-1.5 text-ink transition-colors hover:border-accent/50 hover:bg-surface-3"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent">
            {playing ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
          </span>
          {!compact && (
            <span className="flex h-5 items-end gap-[2px]" aria-hidden>
              {Array.from({ length: bars }).map((_, i) => (
                <span
                  key={i}
                  className="w-[2px] rounded-full bg-accent/70"
                  style={{
                    height: playing ? `${20 + Math.abs(Math.sin(i * 0.7)) * 60}%` : "30%",
                    animation: playing ? `eq ${0.5 + (i % 5) * 0.08}s ease-in-out infinite` : "none",
                    animationDelay: `${(i % 7) * 0.05}s`,
                  }}
                />
              ))}
            </span>
          )}
        </button>
      )}
      {isYouTube && (
        <a
          href={audioUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Play on YouTube"
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-[#ff0000] transition-colors hover:border-[#ff0000]/60"
          title="Tocar no YouTube (áudio real)"
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 4.9 12 4.9 12 4.9s-7 0-8.9.5A3 3 0 0 0 1 7.5 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 16.5 31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.5M9.8 15.3V8.7l5.7 3.3Z" />
          </svg>
        </a>
      )}
      {isSpotify && !isYouTube && (
        <a
          href={audioUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in Spotify"
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-[#1db954] transition-colors hover:border-[#1db954]/60"
          title="Abrir no Spotify"
        >
          <IconSpotify width={13} height={13} />
        </a>
      )}
    </span>
  );
}
