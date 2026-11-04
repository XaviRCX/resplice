import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

const PY =
  process.env.PYTHON_PATH ||
  "C:/Users/Lucas/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";

function ytId(url: string): string | null {
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const url = body.url || "";
  const inSec = Number(body.inSec || 0);
  const outSec = Number(body.outSec || 0);

  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });
  if (!ytId(url)) {
    return NextResponse.json({ error: "only youtube supported" }, { status: 400 });
  }

  const workdir = mkdtempSync(path.join(tmpdir(), "resplice-tlprev-"));

  return new Promise<NextResponse>((resolve) => {
    const p = spawn(PY, ["scripts/timeline_preview.py"], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.stdin?.write(JSON.stringify({ url, inSec, outSec }));
    p.stdin?.end();
    p.on("close", (code) => {
      if (code !== 0) {
        console.error("[tlprev] stderr:", err.slice(-1500));
        return resolve(
          NextResponse.json({ error: "preview failed", detail: err.slice(-600) }, { status: 500 })
        );
      }
      try {
        const j = JSON.parse(out.trim());
        const audio = readFileSync(j.path);
        resolve(
          new NextResponse(new Uint8Array(audio), {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Disposition": `attachment; filename="clip.mp3"`,
            },
          })
        );
      } catch {
        resolve(NextResponse.json({ error: "read failed" }, { status: 500 }));
      }
    });
  });
}
