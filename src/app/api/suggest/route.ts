import { NextRequest, NextResponse } from "next/server";
import type { Track } from "@/lib/types";
import { MOCK_TRACKS, searchMock } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/suggest?genre=...&q=<json items>
 * Suggests tracks to extend the current setlist:
 *  - near: same / adjacent genre to the target (safe, on-theme picks)
 *  - bold: contrasting genres (riskier, surprising picks)
 * Uses the demo catalog plus a live YouTube search when an API key is set.
 */
function overlaps(a: string[], b: string[]): boolean {
  return a.some((g) => b.includes(g));
}

export async function GET(req: NextRequest) {
  const genre = (req.nextUrl.searchParams.get("genre") ?? "House").trim();
  let items: any[] = [];
  try {
    const raw = req.nextUrl.searchParams.get("q");
    if (raw) items = JSON.parse(raw);
  } catch {}

  const setlistGenres = new Set<string>();
  for (const it of items) {
    (it?.track?.genres ?? []).forEach((g: string) => setlistGenres.add(g));
  }
  if (setlistGenres.size === 0 && genre) setlistGenres.add(genre);

  // --- Demo catalog as the base source ---
  const near: Track[] = [];
  const bold: Track[] = [];
  for (const t of MOCK_TRACKS) {
    const sameTheme = overlaps(t.genres, [...setlistGenres]);
    if (sameTheme) {
      if (near.length < 10) near.push(t);
    } else {
      if (bold.length < 10) bold.push(t);
    }
  }

  // --- Enrich "near" with a live YouTube search for the target genre ---
  const key = process.env.YT_API_KEY;
  if (key) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", genre);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "8");
      url.searchParams.set("key", key);
      const res = await fetch(url);
      const json = await res.json();
      const yt: Track[] = (json.items ?? []).map((it: any) => ({
        id: it.id?.videoId ?? it.id,
        title: it.snippet?.title ?? "Unknown",
        artist: it.snippet?.channelTitle ?? "Unknown",
        source: "youtube" as const,
        url: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
        thumbnail: it.snippet?.thumbnails?.medium?.url ?? "",
        durationSec: 210,
        bpm: 100 + Math.floor(Math.random() * 40),
        musicalKey: "Am",
        energy: 0.6,
        genres: [genre],
        synthetic: false,
      }));
      for (const t of yt) {
        if (near.length < 12) near.push(t);
        else if (bold.length < 12) bold.push(t);
      }
    } catch {
      /* keep demo-only */
    }
  }

  return NextResponse.json({ near, bold });
}
