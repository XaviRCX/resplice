import { NextRequest, NextResponse } from "next/server";
import {
  spotifyEnabled,
  authUrl,
  randomState,
  randomVerifier,
  pkceChallenge,
  savePkce,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!spotifyEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const state = randomState();
  const verifier = randomVerifier();
  savePkce(state, verifier);
  const url = authUrl(state, pkceChallenge(verifier));
  return NextResponse.json({ enabled: true, url });
}
