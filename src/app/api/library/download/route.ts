import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

const PY =
  process.env.PYTHON_PATH ||
  "C:/Users/Lucas/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";

const PUB_DIR = path.join(process.cwd(), "public", "lib-downloads");
const DL_PORT = process.env.DL_PORT || 3940;

function ytId(url: string): string | null {
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "track";
}

function runLibDownload(url: string, title: string): Promise<{ buf: Buffer; name: string }> {
  return new Promise((resolve, reject) => {
    const workdir = mkdtempSync(path.join(tmpdir(), "resplice-libdl-"));
    const p = spawn(PY, ["scripts/lib_download.py"], { cwd: process.cwd(), env: { ...process.env } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.stdin?.write(JSON.stringify({ url, title: title || ytId(url) || "track" }));
    p.stdin?.end();
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || `exit ${code}`));
      try {
        const j = JSON.parse(out.trim());
        const buf = readFileSync(j.path);
        const name = `${slug(title || ytId(url) || "track")}.mp3`;
        resolve({ buf, name });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  const title = req.nextUrl.searchParams.get("title") || "";
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  const yid = ytId(url);

  if (yid) {
    try {
      const { buf, name } = await runLibDownload(url, title);
      mkdirSync(PUB_DIR, { recursive: true });
      writeFileSync(path.join(PUB_DIR, name), buf);
      // Serve via the separate downloads server (Next can't stream big bodies).
      return NextResponse.json({ url: `http://127.0.0.1:${DL_PORT}/lib-downloads/${name}`, name });
    } catch (e: any) {
      console.error("[libdl] failed:", e?.message || e);
      return NextResponse.json({ error: "download failed: " + (e?.message || e) }, { status: 500 });
    }
  }

  if (/open\.spotify\.com|spotify:/i.test(url)) {
    try {
      const id = url.split("/").pop()?.split("?")[0];
      const meta = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN || ""}` },
      });
      const t = await meta.json();
      const purl = t.preview_url;
      if (!purl) return NextResponse.json({ error: "no preview available" }, { status: 404 });
      const r = await fetch(purl);
      const buf = Buffer.from(await r.arrayBuffer());
      const name = `${slug(t.name || "spotify")}.mp3`;
      mkdirSync(PUB_DIR, { recursive: true });
      writeFileSync(path.join(PUB_DIR, name), buf);
      return NextResponse.json({ url: `http://127.0.0.1:${DL_PORT}/lib-downloads/${name}`, name });
    } catch {
      return NextResponse.json({ error: "spotify fetch failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "unsupported url" }, { status: 400 });
}
