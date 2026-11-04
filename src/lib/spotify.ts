import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Track } from "./types";

const ROOT = process.cwd();
const TOKEN_FILE = path.join(ROOT, ".spotify-tokens.json");
const PKCE_FILE = path.join(ROOT, ".spotify-pkce.json");

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope?: string;
  user?: { id: string; display_name: string; image?: string };
}

export function spotifyClientId(): string {
  return process.env.SPOTIFY_CLIENT_ID ?? "";
}
export function spotifyEnabled(): boolean {
  return spotifyClientId().length > 0;
}
export function redirectUri(): string {
  // Spotify forbids "localhost" — must use explicit loopback IP literal.
  return (
    process.env.SPOTIFY_REDIRECT_URI ||
    "http://127.0.0.1:3939/api/spotify/callback"
  );
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function randomVerifier(): string {
  return base64url(crypto.randomBytes(32));
}
export function pkceChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}
export function randomState(): string {
  return base64url(crypto.randomBytes(16));
}

// PKCE temp store (single local user)
export function savePkce(state: string, verifier: string) {
  fs.writeFileSync(PKCE_FILE, JSON.stringify({ state, verifier }));
}
export function loadPkce(state: string): string | null {
  try {
    const j = JSON.parse(fs.readFileSync(PKCE_FILE, "utf-8"));
    if (j.state === state) return j.verifier;
  } catch {}
  return null;
}
export function clearPkce() {
  try {
    fs.unlinkSync(PKCE_FILE);
  } catch {}
}

export function loadTokens(): SpotifyTokens | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
  } catch {
    return null;
  }
}
export function saveTokens(t: SpotifyTokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t));
}
export function clearTokens() {
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {}
}

export function authUrl(state: string, challenge: string): string {
  const u = new URL("https://accounts.spotify.com/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", spotifyClientId());
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  // Force the consent screen so new scopes are always granted (avoids cached,
  // narrower consent from a previous connection).
  u.searchParams.set("show_dialog", "true");
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

async function tokenPost(body: Record<string, string>): Promise<any> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("token " + res.status + " " + txt);
  }
  return res.json();
}

const PITCH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function musicalKey(key: number, mode: number): string {
  const root = PITCH[((key % 12) + 12) % 12];
  return mode === 1 ? root : root + "m";
}

export function mapTrack(t: any, feat?: any): Track {
  const energy = typeof feat?.energy === "number" ? feat.energy : 0.6;
  return {
    id: t.id,
    title: t.name,
    artist: (t.artists ?? []).map((a: any) => a.name).join(", "),
    source: "spotify",
    url: t.external_urls?.spotify ?? "",
    thumbnail: t.album?.images?.[0]?.url ?? "",
    durationSec: Math.round((t.duration_ms ?? 180000) / 1000),
    bpm: feat?.tempo ? Math.round(feat.tempo) : 120,
    musicalKey: musicalKey(feat?.key ?? 0, feat?.mode ?? 1),
    energy: Math.round(energy * 100) / 100,
    genres: [],
    previewUrl: t.preview_url ?? undefined,
    synthetic: false,
  };
}

export async function mapSpotifyTracks(
  tracks: any[],
  token: string
): Promise<Track[]> {
  const ids = tracks.map((t) => t.id).filter(Boolean).join(",");
  const feats: Record<string, any> = {};
  if (ids) {
    try {
      const f = await spotifyGet(`/v1/audio-features?ids=${ids}`, token);
      (f.audio_features ?? []).forEach((x: any) => {
        if (x) feats[x.id] = x;
      });
    } catch {}
  }
  return tracks.map((t) => mapTrack(t, feats[t.id]));
}

export async function searchSpotify(q: string, token: string): Promise<Track[]> {
  const j = await spotifyGet(
    `/v1/search?type=track&limit=12&q=${encodeURIComponent(q)}`,
    token
  );
  const items = j.tracks?.items ?? [];
  return mapSpotifyTracks(items, token);
}

export async function exchangeCode(code: string, verifier: string) {
  const j = await tokenPost({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: spotifyClientId(),
    code_verifier: verifier,
  });
  const tokens: SpotifyTokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + j.expires_in * 1000,
    scope: j.scope,
  };
  try {
    const prof = await spotifyGet("/v1/me", tokens.access_token);
    tokens.user = {
      id: prof.id,
      display_name: prof.display_name ?? prof.id,
      image: prof.images?.[0]?.url,
    };
  } catch {}
  saveTokens(tokens);
  return tokens;
}

export async function refreshIfNeeded(
  tokens: SpotifyTokens
): Promise<SpotifyTokens> {
  if (Date.now() < tokens.expires_at - 60_000) return tokens;
  const j = await tokenPost({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: spotifyClientId(),
  });
  const next: SpotifyTokens = {
    ...tokens,
    access_token: j.access_token,
    expires_at: Date.now() + j.expires_in * 1000,
  };
  if (j.refresh_token) next.refresh_token = j.refresh_token;
  saveTokens(next);
  return next;
}

export async function spotifyGet(p: string, token: string): Promise<any> {
  const res = await fetch("https://api.spotify.com" + p, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("spotify " + res.status + " " + p);
  return res.json();
}

export async function getValidToken(): Promise<string | null> {
  const t = loadTokens();
  if (!t) return null;
  try {
    const refreshed = await refreshIfNeeded(t);
    return refreshed.access_token;
  } catch {
    return null;
  }
}
