import sys, os, json, subprocess, tempfile

TMP = tempfile.mkdtemp(prefix="tlprev_")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mix import download_audio

def main():
    payload = json.load(sys.stdin)
    url = payload.get("url", "")
    in_sec = float(payload.get("inSec", 0) or 0)
    out_sec = float(payload.get("outSec", 0) or 0)

    if not url:
        print(json.dumps({"error": "no url"}))
        return

    raw = os.path.join(TMP, "src.wav")
    try:
        download_audio(url, raw, TMP)
    except Exception as e:
        print(json.dumps({"error": f"download failed: {e}"}))
        return

    dur = out_sec if out_sec and out_sec > in_sec else None
    out_mp3 = os.path.join(TMP, "clip.mp3")
    ffmpeg = os.environ.get("FFMPEG_PATH", "ffmpeg")
    cmd = [ffmpeg, "-y", "-ss", str(in_sec)]
    if dur:
        cmd += ["-t", str(dur - in_sec)]
    cmd += ["-i", raw, "-b:a", "192k", out_mp3]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(out_mp3):
        print(json.dumps({"error": "ffmpeg failed", "detail": r.stderr[-500]}))
        return

    print(json.dumps({"path": out_mp3}))

if __name__ == "__main__":
    main()
