import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

const PY =
  process.env.PYTHON_PATH ||
  "C:/Users/Lucas/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";

export async function POST(req: NextRequest) {
  let tracks: any[] = [];
  try {
    const body = await req.json();
    tracks = body.tracks ?? [];
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const workdir = mkdtempSync(path.join(tmpdir(), "resplice-autoset-"));
  const payload = JSON.stringify({
    tracks: tracks.map((t) => ({
      uid: t.uid,
      url: t.url,
      durationSec: t.durationSec,
    })),
  });

  return new Promise<NextResponse>((resolve) => {
    const p = spawn(PY, ["scripts/autoset.py"], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.stdin?.write(payload);
    p.stdin?.end();
    p.on("close", (code) => {
      if (code !== 0) {
        console.error("[autoset] stderr:", err.slice(-1500));
        return resolve(
          NextResponse.json({ error: "analysis failed", detail: err.slice(-800) }, { status: 500 })
        );
      }
      try {
        const j = JSON.parse(out.trim());
        resolve(NextResponse.json(j));
      } catch {
        resolve(NextResponse.json({ error: "bad output" }, { status: 500 }));
      }
    });
  });
}
