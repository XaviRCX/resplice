import sys, os, json, subprocess, tempfile, shutil

# Real analysis: download audio (yt-dlp), compute RMS energy envelope, and find
# the best entry point (energy onset after the intro) and a stable outro point.
# Falls back to duration-based heuristics if download/analysis fails.

TMP = tempfile.mkdtemp(prefix="autoset_")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mix import download_audio, CROSSFADE_SEC  # reuse downloader + transition map

def analyze(path):
    """Return (in_sec, out_sec, dur) from a local audio file using ffmpeg RMS."""
    # Get duration
    dur = 0.0
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    try:
        dur = float(p.stdout.strip())
    except Exception:
        dur = 0.0

    # RMS envelope: split into ~1s windows.
    # Use ffmpeg loudnorm-style: compute frame RMS via astats in 1s windows.
    p2 = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path, "-af",
         "astats=metadata=1:reset=1:length=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    # Parse RMS levels (dB) per window from stderr.
    import re
    levels = []
    for m in re.finditer(r"lavfi\.astats\.Overall\.RMS_level=([-0-9.]+)", p2.stderr):
        try:
            db = float(m.group(1))
            levels.append(10 ** (db / 20.0))  # to linear amplitude
        except Exception:
            pass

    if dur < 5 or len(levels) < 5:
        # fallback
        return int(dur * 0.15), int(min(dur - 5, dur * 0.75))

    # Convert to relative energy
    mx = max(levels) or 1.0
    rel = [v / mx for v in levels]
    # Entry: first window where energy exceeds 35% of peak (intro end / beat drop)
    in_w = next((i for i, v in enumerate(rel) if v > 0.35), 0)
    in_sec = int(in_w)
    # Out: last window where energy still > 35% (before outro/fade)
    out_idx = len(rel) - 1
    for i in range(len(rel) - 1, -1, -1):
        if rel[i] > 0.35:
            out_idx = i
            break
    out_sec = int(out_idx)
    # If outro is too late (song fades slowly), cap out at 85% of duration
    out_sec = min(out_sec, int(dur * 0.85))
    in_sec = min(in_sec, max(0, out_sec - 10))
    return in_sec, out_sec


def main():
    data = json.load(sys.stdin)
    tracks = data.get("tracks", [])
    results = []
    for t in tracks:
        url = t.get("url", "")
        uid = t.get("uid", "")
        dur = float(t.get("durationSec", 0) or 0)
        # Heuristic fallback (used when audio can't be downloaded, e.g. demo
        # catalog or quota-limited search): skip a short intro and cut before
        # the outro, which is visibly different from the 0.15/0.75 default.
        in_sec, out_sec = max(6, int(dur * 0.05)), max(20, int(dur - 12))
        if "youtube.com" in url or "youtu.be" in url:
            try:
                raw = os.path.join(TMP, f"{uid}.wav")
                download_audio(url, raw, TMP)
                if os.path.exists(raw):
                    a_in, a_out = analyze(raw)
                    if a_in >= 0 and a_out > a_in:
                        in_sec, out_sec = a_in, a_out
            except Exception:
                pass
        results.append({"uid": uid, "inSec": in_sec, "outSec": out_sec})
    print(json.dumps({"tracks": results}))


if __name__ == "__main__":
    main()
