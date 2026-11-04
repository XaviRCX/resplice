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
    return NextResponse.json({
      connected: false,
      user: null,
      playlists: [],
    });
  }
  try {
    const j = await spotifyGet("/v1/me/playlists?limit=50", token);
    const playlists = (j.items ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks?.total ?? p.tracks?.items?.length ?? 0,
      image: p.images?.[0]?.url ?? "",
      owner: p.owner?.display_name ?? "",
      public: p.public ?? false,
    }));
    return NextResponse.json({
      connected: true,
      user: tokens.user ?? null,
      playlists,
    });
  } catch {
    // Token invalid; clear so the UI can reconnect.
    clearTokens();
    return NextResponse.json({
      connected: false,
      user: null,
      playlists: [],
    });
  }
}
