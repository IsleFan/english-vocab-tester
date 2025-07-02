from gtts import gTTS
import sys
import os
import tempfile

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python gtts_synthesize.py <text> <lang>", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1]
    lang = sys.argv[2]

    try:
        tts = gTTS(text=text, lang=lang)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
            tts.save(fp.name)
            print(fp.name)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
