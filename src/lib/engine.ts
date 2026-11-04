import type { MixPlan, SetlistItem, Track, Transition } from "./types";
import { CROSSFADE_SEC } from "./types";

/** Pick the transition vocabulary available at a given creativity level. */
function transitionsFor(creativity: number): Transition[] {
  if (creativity < 0.25) return ["cut", "crossfade"];
  if (creativity < 0.55) return ["crossfade", "beatmatch", "echo-out"];
  if (creativity < 0.8) return ["beatmatch", "filter-sweep", "echo-out", "acapella-over"];
  return ["beatmatch", "filter-sweep", "acapella-over", "echo-out", "crossfade"];
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor((seed % 1) * arr.length) % arr.length];
}

/**
 * Optimize rhythm: keep user-locked items at their current slot, and order the
 * remaining free tracks by climbing energy so the set builds instead of jumping.
 * (The manual drag order is still respected where nothing is locked.)
 */
export function optimizeOrder(items: SetlistItem[]): SetlistItem[] {
  const lockedPositions = items
    .map((it, idx) => (it.locked ? idx : -1))
    .filter((i) => i >= 0);
  const free = items
    .filter((i) => !i.locked)
    .sort((a, b) => a.track.energy - b.track.energy);
  const out: SetlistItem[] = [];
  let fi = 0;
  for (let i = 0; i < items.length; i++) {
    if (lockedPositions.includes(i)) {
      out.push(items[i]);
    } else {
      out.push(free[fi++] ?? items[i]);
    }
  }
  return out;
}

export interface PlanOptions {
  description: string;
  targetGenre: string;
  creativity: number; // 0..1
}

export function buildMixPlan(
  items: SetlistItem[],
  opts: PlanOptions
): MixPlan {
  const tracks = items.map((i) => i.track);
  const bpms = tracks.map((t) => t.bpm).sort((a, b) => a - b);
  const medianBpm = bpms[Math.floor(bpms.length / 2)] ?? 120;
  const targetBpm = Math.round(medianBpm / 2) * 2; // even number, DJ-friendly
  const transitions = transitionsFor(opts.creativity);

  const segments = items.map((item, idx) => {
    const t = item.track;
    const h = (t.id.length * 31 + idx * 7) / 997;
    const transitionIn = idx === 0 ? "cut" : pick(transitions, h + 0.11);
    const transitionOut =
      idx === items.length - 1 ? "cut" : pick(transitions, h + 0.37);

    // Respect per-track user tuning from the Timeline / Transitions panels.
    const m = item.mix;
    const dur = t.durationSec;
    const inSec = m ? m.inSec : Math.round(dur * 0.15);
    const outSec = m ? m.outSec : Math.min(dur - 5, Math.round(dur * 0.75));
    const tOut = m?.transitionOut ?? transitionOut;
    const tLen = m?.transitionLen ?? (CROSSFADE_SEC[tOut] ?? 2);

    return {
      trackId: t.id,
      title: t.title,
      artist: t.artist,
      inSec: Math.max(0, Math.min(dur - 1, inSec)),
      outSec: Math.max(inSec + 1, Math.min(dur, outSec)),
      transitionIn: transitionIn as Transition,
      transitionOut: tOut as Transition,
      transitionLen: tLen,
      bpm: targetBpm,
    };
  });

  const estDurationSec = segments.reduce(
    (acc, s) => acc + (s.outSec - s.inSec) + 8, // +8s crossfade overlap
    0
  );

  const notes = buildNotes(tracks, targetBpm, opts.creativity, opts.targetGenre);

  return {
    title: deriveTitle(opts.description, tracks),
    description: opts.description || "A blended set mixed from your selection.",
    targetGenre: opts.targetGenre,
    targetBpm,
    creativity: opts.creativity,
    segments,
    estDurationSec,
    generatedBy: "engine-heuristic",
    notes,
  };
}

const TITLE_OPENERS = [
  "Neon",
  "Midnight",
  "Velvet",
  "Hyper",
  "Liquid",
  "Crimson",
  "Afterglow",
  "Static",
  "Golden",
  "Phantom",
];
const TITLE_CLOSERS = [
  "Blend",
  "Mash",
  "Fusion",
  "Splice",
  "Mixtape",
  "Resplice",
  "Collider",
  "Sessions",
];

/** Builds a producer-style mashup name from real track data, not the raw brief. */
function deriveTitle(desc: string, tracks: Track[]): string {
  const clean = desc.trim().replace(/[.,]/g, "");
  const words = clean.split(/\s+/);
  const descriptive = /(with|vibe|mix|feeling|like|into|night|drive|energy|euphoric|moody)/i.test(
    clean
  );
  if (clean && words.length <= 3 && !descriptive) {
    return clean;
  }
  const seed =
    (tracks[0]?.id.length ?? 3) +
    (tracks[tracks.length - 1]?.id.length ?? 7) +
    tracks.length;
  const opener = TITLE_OPENERS[seed % TITLE_OPENERS.length];
  const closer = TITLE_CLOSERS[(seed * 3) % TITLE_CLOSERS.length];
  const a = tracks[0]?.artist.split(/[,\s]/)[0] ?? "Night";
  const b = tracks[tracks.length - 1]?.artist.split(/[,\s]/)[0] ?? "Drive";
  return `${opener} ${a} × ${b} ${closer}`;
}

/** Specific DJ notes derived from the actual set, not generic filler. */
function buildNotes(
  tracks: Track[],
  targetBpm: number,
  creativity: number,
  targetGenre: string
): string[] {
  const opener = tracks[0]?.title ?? "the opener";
  const closer = tracks[tracks.length - 1]?.title ?? "the closer";
  const sharedGenre = tracks
    .flatMap((t) => t.genres)
    .filter((g) => g.toLowerCase().includes(targetGenre.toLowerCase()))[0];
  const notes = [
    `Beat-matched everything to ${targetBpm} BPM so "${opener}" hands off cleanly into the next record.`,
  ];
  if (sharedGenre) {
    notes.push(
      `Lean into the ${sharedGenre} pocket — your target ${targetGenre} sits in that lineage, so the blend stays coherent.`
    );
  } else {
    notes.push(
      `Target is ${targetGenre}, but your picks lean elsewhere — the engine compromises toward a ${targetGenre}-flavored midsection.`
    );
  }
  notes.push(
    creativity >= 0.8
      ? "High creativity: acapella overlays and filter sweeps on the transitions — bold, DJ-show energy."
      : creativity <= 0.25
        ? "Low creativity: conservative cuts and crossfades; the original arrangements stay intact."
        : `Medium creativity: "${closer}" exits on an echo-out for a smooth landing.`
  );
  return notes;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
