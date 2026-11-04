export type Source = "youtube" | "spotify";

export interface Track {
  id: string;
  title: string;
  artist: string;
  source: Source;
  /** External watch/listen URL (YouTube watch URL or Spotify track URL). */
  url: string;
  /** Thumbnail / cover URL. */
  thumbnail: string;
  /** Duration in seconds. */
  durationSec: number;
  /** Estimated tempo. Stable per-track, derived from id when no real analysis. */
  bpm: number;
  /** Musical key, e.g. "Am", "F#m". */
  musicalKey: string;
  /** Energy 0..1 used by the ordering optimizer. */
  energy: number;
  /** Genre tags for similarity + genre targeting. */
  genres: string[];
  /** Whether this is a synthesized demo entry (no real audio). */
  synthetic?: boolean;
  /** Real 30s preview URL (Spotify provides this; YouTube does not). */
  previewUrl?: string;
  /** When set, the audio lives in the user's local library folder (not streamed). */
  localFile?: FileSystemFileHandle;
  /** Object URL for an in-memory local file (fallback backend). */
  localBlobUrl?: string;
}

export interface SetlistItem {
  /** Client-side unique id (stable across reorders). */
  uid: string;
  track: Track;
  /** User override of where this sits in the blended timeline (0 = start). */
  locked?: boolean;
  /** Per-track mix tuning the user sets in the Timeline / Transitions panels. */
  mix?: {
    inSec: number;
    outSec: number;
    transitionOut: Transition;
    transitionLen?: number;
  };
}

export type Transition =
  | "cut"
  | "crossfade"
  | "beatmatch"
  | "filter-sweep"
  | "echo-out"
  | "acapella-over";

/** Default crossfade/overlap length (seconds) per transition type. */
export const CROSSFADE_SEC: Record<Transition, number> = {
  cut: 0,
  crossfade: 2,
  beatmatch: 3,
  "filter-sweep": 2.5,
  "echo-out": 2,
  "acapella-over": 4,
};

export interface MixSegment {
  trackId: string;
  title: string;
  artist: string;
  /** Seconds this track contributes to the final mix. */
  inSec: number;
  outSec: number;
  transitionIn: Transition;
  transitionOut: Transition;
  /** Crossfade/overlap length in seconds for the outgoing transition. */
  transitionLen: number;
  /** Beat-matched BPM the engine settled on for this segment. */
  bpm: number;
}

export interface MixPlan {
  title: string;
  description: string;
  targetGenre: string;
  targetBpm: number;
  creativity: number;
  segments: MixSegment[];
  /** Estimated final duration in seconds. */
  estDurationSec: number;
  generatedBy: "engine-heuristic" | "llm";
  notes: string[];
}

export const GENRES = [
  "House",
  "Techno",
  "Hip-Hop",
  "Drum & Bass",
  "Lo-Fi",
  "Trap",
  "Disco",
  "Ambient",
  "Pop",
  "Reggaeton",
  "Future Bass",
  "Afrobeats",
  "Jazz",
  "Rock",
  "Funk",
  "Funk Submundo",
  "Eletrofunk",
  "Funk Mandelão",
  "Funk Proibidão",
  "Baile Funk",
  "Samba",
  "Pagode",
  "Sertanejo",
  "MPB",
  "Brazilian Phonk",
] as const;

export type Genre = (typeof GENRES)[number];
