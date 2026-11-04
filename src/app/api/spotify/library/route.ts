import { NextResponse } from "next/server";
import {
  loadTokens,
  getValidToken,
  spotifyGet,
  mapSpotifyTracks,
  clearTokens,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = loadTokens();
  const token = await getValidToken();
  if (!tokens || !token) {
    return NextResponse.json({ connected: false, tracks: [] });
  }
  try {
    const j = await spotifyGet("/v1/me/tracks?limit=50", token);
    const items = (j.items ?? [])
      .map((it: any) => it.track)
      .filter((t: any) => t && t.id);
    const tracks = await mapSpotifyTracks(items, token);
    return NextResponse.json({ connected: true, tracks });
  } catch {
    clearTokens();
    return NextResponse.json({ connected: false, tracks: [] });
  }
}
