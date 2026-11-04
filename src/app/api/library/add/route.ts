import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YT_KEY = process.env.YT_API_KEY || "";
const SPOTIFY_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN || "";

function ytId(url: string): string | null {
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}

function spotifyId(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(?:track|album|playlist)\/([^?&/]+)/);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  let url = "";
  try {
    const body = await req.json();
    url = (body.url || "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!url) return NextResponse.json({ error: "empty url" }, { status: 400 });

  // --- YouTube ---
  const yid = ytId(url);
  if (yid) {
    if (YT_KEY) {
      try {
        const r = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${yid}&key=${YT_KEY}`
        );
        const j = await r.json();
        const it = j.items?.[0];
        if (it) {
          const dur = parseIso(it.contentDetails?.duration || "");
          return NextResponse.json({
            track: {
              id: `yt:${yid}`,
              title: it.snippet.title,
              artist: it.snippet.channelTitle,
              source: "youtube",
              url: `https://www.youtube.com/watch?v=${yid}`,
              thumbnail: it.snippet.thumbnails?.medium?.url || "",
              durationSec: dur,
              bpm: 120,
              musicalKey: "Am",
              energy: 0.6,
              genres: ["Imported"],
              synthetic: false,
            },
          });
        }
      } catch {
        /* fall through to basic */
      }
    }
    // Basic fallback (no key / quota): just the ID, audio plays via iframe.
    return NextResponse.json({
      track: {
        id: `yt:${yid}`,
        title: `YouTube ${yid}`,
        artist: "YouTube",
        source: "youtube",
        url: `https://www.youtube.com/watch?v=${yid}`,
        thumbnail: "",
        durationSec: 180,
        bpm: 120,
        musicalKey: "Am",
        energy: 0.6,
        genres: ["Imported"],
        synthetic: false,
      },
    });
  }

  // --- Spotify ---
  const sid = spotifyId(url);
  if (sid) {
    if (SPOTIFY_TOKEN) {
      try {
        const r = await fetch(`https://api.spotify.com/v1/tracks/${sid}`, {
          headers: { Authorization: `Bearer ${SPOTIFY_TOKEN}` },
        });
        if (r.ok) {
          const t = await r.json();
          const ms = t.duration_ms || 180000;
          return NextResponse.json({
            track: {
              id: `sp:${sid}`,
              title: t.name,
              artist: t.artists?.map((a: any) => a.name).join(", ") || "Spotify",
              source: "spotify",
              url: t.external_urls?.spotify || url,
              thumbnail: t.album?.images?.[0]?.url || "",
              durationSec: Math.round(ms / 1000),
              bpm: 120,
              musicalKey: "Am",
              energy: 0.6,
              genres: ["Imported"],
              synthetic: false,
              previewUrl: t.preview_url || "",
            },
          });
        }
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json({
      track: {
        id: `sp:${sid}`,
        title: "Spotify track",
        artist: "Spotify",
        source: "spotify",
        url,
        thumbnail: "",
        durationSec: 180,
        bpm: 120,
        musicalKey: "Am",
        energy: 0.6,
        genres: ["Imported"],
        synthetic: false,
        previewUrl: "",
      },
    });
  }

  return NextResponse.json({ error: "unsupported link" }, { status: 400 });
}

function parseIso(s: string): number {
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 180;
  const h = parseInt(m[1] || "0");
  const min = parseInt(m[2] || "0");
  const sec = parseInt(m[3] || "0");
  return h * 3600 + min * 60 + sec;
}
