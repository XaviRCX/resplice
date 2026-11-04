// Downloads server: handles library audio download + static serving.
// Next's `next start` does not reliably deliver large response bodies in this
// environment, so all binary downloads go through this plain Node HTTP server
// (CORS-open, 127.0.0.1 only). It proxies the yt-dlp/ffmpeg download via the
// Python helper so the browser only ever fetches a real static file.
import { createServer } from "node:http";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const PORT = Number(process.env.DL_PORT || 3941);
const ROOT = join(process.cwd(), "public", "lib-downloads");
const PY =
  process.env.PYTHON_PATH ||
  "C:/Users/Lucas/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";

function ytId(url) {
  const m =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/\/embed\/([^?&]+)/);
  return m ? m[1] : null;
}
function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "track";
}

function runDownload(url, title) {
  return new Promise((resolve, reject) => {
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
        resolve(j.path);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function handleDownload(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const url = u.searchParams.get("url") || "";
  const title = u.searchParams.get("title") || "";
  if (!url) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "missing url" }));
  }
  try {
    const srcPath = await runDownload(url, title);
    const name = `${slug(title || ytId(url) || "track")}.mp3`;
    await mkdir(ROOT, { recursive: true });
    const data = await readFile(srcPath);
    await writeFile(join(ROOT, name), data);
    res.writeHead(302, { Location: `/lib-downloads/${name}` });
    res.end();
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "download failed: " + (e?.message || e) }));
  }
}

async function handleClip(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const url = u.searchParams.get("url") || "";
  const inSec = u.searchParams.get("inSec") || "0";
  const outSec = u.searchParams.get("outSec") || "0";
  if (!url) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "missing url" }));
  }
  try {
    const p = spawn(PY, ["scripts/timeline_preview.py"], { cwd: process.cwd(), env: { ...process.env } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.stdin?.write(JSON.stringify({ url, inSec: Number(inSec), outSec: Number(outSec) }));
    p.stdin?.end();
    const code = await new Promise((resolve) => p.on("close", (c) => resolve(c)));
    if (code !== 0) {
      const log = `CLIP FAIL code=${code} url=${url} in=${inSec} out=${outSec}\nERR: ${err.slice(-800)}\nOUT: ${out.slice(-400)}\n`;
      try { require("node:fs").appendFileSync("C:/Users/Lucas/AppData/Local/Temp/downloads-server.log", log); } catch {}
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "clip failed: " + err.slice(-300) }));
    }
    const j = JSON.parse(out.trim());
    const name = `clip_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp3`;
    await mkdir(ROOT, { recursive: true });
    const data = await readFile(j.path);
    await writeFile(join(ROOT, name), data);
    res.writeHead(302, { Location: `/lib-downloads/${name}` });
    res.end();
  } catch (e) {
    try { require("node:fs").appendFileSync("C:/Users/Lucas/AppData/Local/Temp/downloads-server.log", "CLIP CATCH " + (e?.message || e) + "\n"); } catch {}
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "clip failed: " + (e?.message || e) }));
  }
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const u = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (u.pathname === "/api/dl") {
    return handleDownload(req, res);
  }

  if (u.pathname === "/api/clip") {
    if (req.method !== "POST") {
      res.writeHead(405);
      return res.end("method not allowed");
    }
    try {
      require("node:fs").appendFileSync(
        "C:/Users/Lucas/AppData/Local/Temp/downloads-server.log",
        `CLIP REQ url=${url} in=${inSec} out=${outSec}\n`
      );
    } catch {}
    return handleClip(req, res);
  }

  if (u.pathname.startsWith("/lib-downloads/")) {
    const name = u.pathname.replace(/^\/lib-downloads\//, "");
    if (!name || name.includes("..") || name.includes("/")) {
      res.writeHead(400);
      return res.end("bad name");
    }
    try {
      const p = join(ROOT, name);
      const s = await stat(p);
      if (!s.isFile()) {
        res.writeHead(404);
        return res.end("not found");
      }
      const buf = await readFile(p);
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buf.length),
        "Content-Disposition": `attachment; filename="${name}"`,
      });
      res.end(buf);
    } catch {
      res.writeHead(500);
      res.end("error");
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[downloads] http://127.0.0.1:${PORT}  (downloads + static)`);
});
