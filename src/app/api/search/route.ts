import { NextRequest, NextResponse } from "next/server";
import { searchMock } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// Maps keywords found in a YouTube title/channel to Brazilian genre tags so the
// mix engine can group and target them properly (instead of a generic "YouTube").
const BR_GENRE_RULES: [RegExp, string][] = [
  [/(submundo|sub\s*mundo)/i, "Funk Submundo"],
  [/(eletrofunk|eletro funk|electrofunk)/i, "Eletrofunk"],
  [/(mandel[aã]o|mandela)/i, "Funk Mandelão"],
  [/(proibid[aã]o|proibido)/i, "Funk Proibidão"],
  [/(baile funk|baile|batid[aã]o)/i, "Baile Funk"],
  [/(brazilian phonk|br phonk|phonk br)/i, "Brazilian Phonk"],
  [/(funk\s*ostentacao|ostenta[cç][aã]o)/i, "Funk Ostentação"],
  [/(samba|pagode)/i, "Samba"],
  [/(sertanejo)/i, "Sertanejo"],
  [/(mpb|m[uú]sica popular brasileira)/i, "MPB"],
  [/(phonk)/i, "Phonk"],
  [/(funk)/i, "Funk"],
  [/(trap\s*br|trap brasileir)/i, "Trap"],
];

function detectGenres(title: string, channel: string): string[] {
  const text = `${title} ${channel}`;
  const found = new Set<string>();
  for (const [re, genre] of BR_GENRE_RULES) {
    if (re.test(text)) found.add(genre);
  }
  const out = [...found];
  if (out.length === 0) out.push("YouTube");
  return out;
}

/**
 * GET /api/search?q=...&source=youtube|spotify|all
 * Uses the YouTube Data API when YT_API_KEY is set, otherwise returns the
 * bundled demo catalog so the studio is fully usable offline.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const source = req.nextUrl.searchParams.get("source") ?? "all";
  const key = process.env.YT_API_KEY;

  if (key && source !== "spotify") {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", q);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("key", key);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`yt ${res.status}`);
      const json = await res.json();
      const items = (json.items ?? []).map((it: any) => ({
        id: it.id?.videoId ?? it.id,
        title: it.snippet?.title ?? "Unknown",
        artist: it.snippet?.channelTitle ?? "Unknown",
        source: "youtube",
        url: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
        thumbnail: it.snippet?.thumbnails?.medium?.url ?? "",
        durationSec: 210,
        bpm: 100 + Math.floor(Math.random() * 40),
        musicalKey: "Am",
        energy: 0.6,
        genres: detectGenres(
          it.snippet?.title ?? "",
          it.snippet?.channelTitle ?? ""
        ),
        synthetic: false,
      }));
      return NextResponse.json({ results: items, mode: "youtube-api" });
    } catch {
      // fall through to mock on API failure
    }
  }

  // API unavailable (no key / quota exceeded / network) — fall back to the
  // demo catalog so the search never shows an empty "No matches" state.
  return NextResponse.json({
    results: searchMock(q, source),
    mode: key ? "demo-fallback" : "demo",
  });
}
