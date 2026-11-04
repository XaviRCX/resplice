#!/usr/bin/env python3
"""Real audio mix for Resplice.

Reads a JSON plan from stdin:
{
  "title": str,
  "targetBpm": int,
  "creativity": float,
  "segments": [
    {"url": str, "inSec": int, "outSec": int, "transitionOut": str, "title": str}
  ]
}
Downloads each segment's audio (YouTube) with yt-dlp, trims the requested
slice, and stitches them together with DJ-style transitions (crossfade /
cut / echo-out) using ffmpeg. Writes the final 16-bit WAV to <workdir>/mix.wav
and prints its absolute path.

Spotify segments are skipped (no public audio download); if every segment is
Spotify the script exits non-zero with a clear message.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

FFMPEG = shutil.which("ffmpeg") or r"C:/Users/Lucas/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe"
YT_DLP = "yt_dlp"

CROSSFADE_SEC = {"cut": 0.0, "crossfade": 2.0, "beatmatch": 3.0,
                 "echo-out": 2.0, "filter-sweep": 2.5, "acapella-over": 4.0}


def log(msg):
    print(f"[mix] {msg}", file=sys.stderr, flush=True)


def download_audio(url, out_path, tmp):
    """Download best audio for a YouTube url to out_path (any container)."""
    ytdlp = shutil.which("yt-dlp") or os.path.join(
        os.path.dirname(sys.executable), "yt-dlp.exe"
    )
    if not ytdlp or not os.path.exists(ytdlp):
        # Fallback: invoke the module via the current interpreter.
        cmd = [sys.executable, "-m", YT_DLP]
    else:
        cmd = [ytdlp]
    cmd += [
        "-x", "--audio-format", "wav", "--audio-quality", "0",
        "--no-playlist", "--no-warnings",
        "-o", out_path, url,
    ]
    log(f"downloading {url}")
    r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True)
    if r.returncode != 0:
        log(f"yt-dlp failed: {r.stderr[-800:]}")
        raise RuntimeError(f"download failed for {url}: {r.stderr[-300:]}")
    return out_path


def trim(in_path, out_path, in_sec, out_sec):
    dur = max(1, out_sec - in_sec)
    cmd = [
        FFMPEG, "-y", "-ss", str(in_sec), "-i", in_path,
        "-t", str(dur), "-ar", "44100", "-ac", "2",
        "-c:a", "pcm_s16le", out_path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"trim failed: {r.stderr[-300:]}")


def build(plan, workdir):
    segs = plan.get("segments", [])
    if not segs:
        raise RuntimeError("no segments")

    youtube_segs = [s for s in segs if s.get("url") and "youtube" in s["url"]]
    if not youtube_segs:
        raise RuntimeError("MIX_UNSUPPORTED: no YouTube segments to mix (Spotify tracks have no downloadable audio)")

    tmp = tempfile.mkdtemp(prefix="resplice_")
    clips = []
    for i, s in enumerate(youtube_segs):
        raw = os.path.join(tmp, f"raw_{i}.wav")
        trimmed = os.path.join(tmp, f"clip_{i}.wav")
        download_audio(s["url"], raw, tmp)
        in_sec = int(s.get("inSec", 20))
        out_sec = int(s.get("outSec", in_sec + 30))
        trim(raw, trimmed, in_sec, out_sec)
        clips.append(trimmed)
        log(f"clip {i} ready: {s.get('title')}")

    if len(clips) == 1:
        final = os.path.join(workdir, "mix.wav")
        shutil.copy(clips[0], final)
        log(f"single clip -> {final}")
        return final

    # Stitch with crossfades. Build an ffmpeg filter_complex chain.
    inputs = []
    for c in clips:
        inputs += ["-i", c]
    prev = "[0]"
    last_label = None
    for i in range(1, len(clips)):
        t_out = youtube_segs[i - 1].get("transitionOut", "crossfade")
        cf = float(youtube_segs[i - 1].get("transitionLen", CROSSFADE_SEC.get(t_out, 2.0)))
        out_label = f"[a{i}]"
        if cf <= 0.0:
            # Hard cut: concat without overlap using the concat filter.
            filter_chain = f"{prev}[{i}]concat=n=2:v=0:a=1{out_label}"
        else:
            filter_chain = f"{prev}[{i}]acrossfade=d={cf}:c1=tri:c2=tri{out_label}"
        last_label = out_label
        prev = out_label
    final = os.path.join(workdir, "mix.wav")
    cmd = [FFMPEG, "-y"] + inputs + [
        "-filter_complex", filter_chain, "-map", last_label,
        "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", final,
    ]
    log("stitching: " + " ".join(cmd[:6]) + " ...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"stitch failed: {r.stderr[-600:]}")
    log(f"mix written -> {final}")
    return final


def main():
    data = json.load(sys.stdin)
    workdir = data.get("workdir") or tempfile.mkdtemp(prefix="resplice_out_")
    os.makedirs(workdir, exist_ok=True)
    try:
        out = build(data, workdir)
        print(out)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
