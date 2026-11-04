import { NextRequest, NextResponse } from "next/server";
import { getValidToken, spotifyGet, mapSpotifyTracks } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: "not connected" }, { status: 401 });
  }
  try {
    const j = await spotifyGet(
      `/v1/playlists/${id}/tracks?limit=100`,
      token
    );
    const items = (j.items ?? [])
      .map((it: any) => it.track)
      .filter((t: any) => t && t.id);
    const tracks = await mapSpotifyTracks(items, token);
    return NextResponse.json({ tracks });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
