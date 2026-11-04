import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/download
 * Body: { title, targetBpm, segments, items, creativity }
 * Builds a REAL audio mix: downloads each YouTube segment's audio with yt-dlp,
 * trims the requested slice, and stitches them with ffmpeg crossfades. Returns
 * the resulting 16-bit WAV as a download. Spotify-only sets are not supported
 * (no public audio download) and return a clear 422.
 */
function runMix(plan: unknown): Promise<{ wav: Buffer; title: string }> {
  return new Promise((resolve, reject) => {
    const workdir = mkdtempSync(path.join(tmpdir(), "resplice-mix-"));
    const py = process.env.HERMES_VENV_PYTHON ||
      "C:/Users/Lucas/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";
    const script = path.join(process.cwd(), "scripts", "mix.py");

    const child = spawn(py, [script], {
      cwd: process.cwd(),
    });
    let stderr = "";
    let stdout = "";
    child.stdin.write(JSON.stringify({ ...(plan as object), workdir }));
    child.stdin.end();
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `mix exited ${code}`));
        return;
      }
      const wavPath = stdout.trim().split(/\r?\n/).pop()?.trim();
      if (!wavPath || !require("node:fs").existsSync(wavPath)) {
        reject(new Error("mix produced no output: " + stderr));
        return;
      }
      const buf = require("node:fs").readFileSync(wavPath);
      const title = (plan as any).title ?? "Resplice Mix";
      resolve({ wav: buf, title });
    });
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Map plan segments back to real track URLs via the setlist items.
  const items: any[] = Array.isArray(body.items) ? body.items : [];
  const byId = new Map<string, any>();
  for (const it of items) {
    byId.set(it.track?.id, it.track);
    byId.set(it.uid, it.track);
  }
  const segments: any[] = (body.segments ?? []).map((s: any) => {
    const track = byId.get(s.trackId) ?? {};
    return {
      url: track.url,
      inSec: s.inSec,
      outSec: s.outSec,
      transitionOut: s.transitionOut,
      transitionLen: s.transitionLen,
      title: s.title,
    };
  });

  const plan = {
    title: body.title ?? "Resplice Mix",
    targetBpm: body.targetBpm ?? 120,
    creativity: body.creativity ?? 0.5,
    segments,
  };

  try {
    const { wav, title } = await runMix(plan);
    const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "resplice-mix";
    return new NextResponse(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `attachment; filename="${safeTitle}.wav"`,
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/MIX_UNSUPPORTED/.test(msg)) {
      return NextResponse.json(
        { error: "Spotify tracks have no downloadable audio. Add YouTube tracks to mix." },
        { status: 422 }
      );
    }
    console.error("[download] mix failed:", msg);
    return NextResponse.json(
      { error: "Mix failed. Check that tracks have a YouTube source." },
      { status: 500 }
    );
  }
}
