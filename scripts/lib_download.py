import sys, os, json, subprocess, tempfile

TMP = tempfile.mkdtemp(prefix="libdl_")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mix import download_audio, CROSSFADE_SEC  # reuse downloader + transition map

def main():
    payload = json.load(sys.stdin)
    url = payload.get("url", "")
    title = payload.get("title", "track")

    if not url:
        print(json.dumps({"error": "no url"}))
        return

    raw = os.path.join(TMP, "dl.wav")
    try:
        download_audio(url, raw, TMP)
    except Exception as e:
        print(json.dumps({"error": f"download failed: {e}"}))
        return

    # Convert to mp3 (constant name so the route can read it).
    out_mp3 = os.path.join(TMP, "out.mp3")
    ffmpeg = os.environ.get("FFMPEG_PATH", "ffmpeg")
    r = subprocess.run(
        [ffmpeg, "-y", "-i", raw, "-b:a", "192k", out_mp3],
        capture_output=True, text=True
    )
    if not os.path.exists(out_mp3):
        print(json.dumps({"error": "ffmpeg failed", "detail": r.stderr[-500]}))
        return

    print(json.dumps({"path": out_mp3, "title": title}))

if __name__ == "__main__":
    main()
