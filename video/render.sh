#!/usr/bin/env bash
# Renders the Ibo demo video from a fresh clone: video/out/ibo-demo.mp4
#
#   video/render.sh               # render with the committed captures, narration and map (same video as committed)
#   video/render.sh --tts         # also re-voice the narration from video/tts/lines.json (Kokoro TTS)
#   video/render.sh --map         # also rebuild the Dongmyo map from video/osm/*.json
#   video/render.sh --recapture   # also re-capture the app UI from the web mock (see README: needs the matching app UI)
#   video/render.sh --preview 12 66 131   # only write preview frames at those seconds to video/.work/preview
#
# Needs: Node >= 22, Python >= 3.10, ffmpeg. Playwright's Chromium is installed on first run if missing.
set -euo pipefail
VIDEO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$VIDEO")"
WORK="$VIDEO/.work"
mkdir -p "$WORK"
TTS=0; MAP=0; RECAPTURE=0; PREVIEW=()
while [ $# -gt 0 ]; do
  case "$1" in
    --tts) TTS=1 ;;
    --map) MAP=1 ;;
    --recapture) RECAPTURE=1 ;;
    --preview) shift; while [ $# -gt 0 ] && [[ "$1" != --* ]]; do PREVIEW+=("$1"); shift; done; continue ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
log() { printf '\n== %s\n' "$*"; }

log "Dependencies"
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
[ -d "$VIDEO/comp/node_modules" ] || (cd "$VIDEO/comp" && npm ci --no-audit --no-fund)
[ -d "$REPO/app/node_modules" ] || (cd "$REPO/app" && npm ci --no-audit --no-fund)
if ! (cd "$REPO/app" && node -e "require('@playwright/test').chromium.launch().then(b=>b.close()).catch(()=>require('@playwright/test').chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).then(b=>b.close()))" >/dev/null 2>&1); then
  (cd "$REPO/app" && npx playwright install chromium)
fi
[ -x "$WORK/venv/bin/python" ] || python3 -m venv "$WORK/venv"
PY="$WORK/venv/bin/python"
REQ="$VIDEO/requirements.txt"
[ "$RECAPTURE" = 1 ] && REQ="$VIDEO/requirements-capture.txt"
"$PY" -m pip install -q -r "$REQ"
[ "$TTS" = 1 ] && "$PY" -m pip install -q -r "$VIDEO/requirements-tts.txt"

PORT="${COMP_PORT:-8811}"
export COMP_URL="http://127.0.0.1:$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$VIDEO/comp" >"$WORK/http.log" 2>&1 &
HTTP_PID=$!
MOCK_PID=""
cleanup() { kill "$HTTP_PID" 2>/dev/null || true; [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "$COMP_URL/index.html" && break; sleep 0.2; done

if [ "$MAP" = 1 ]; then
  log "Map: SVG + map data from video/osm, then the 2x PNG"
  "$PY" "$VIDEO/osm/build_map.py"
  node "$VIDEO/scripts/maprender.mjs"
fi

if [ "$RECAPTURE" = 1 ]; then
  log "App UI: demo fixtures, web mock, captures"
  "$PY" "$VIDEO/scripts/assemble_fixtures.py"
  (cd "$REPO/app" && SF_UI_FIXTURE_ROOT="$WORK/fixtures-demo" node --experimental-strip-types src/ui/verify-web.ts --scenario serve --mode mock >"$WORK/webmock.log" 2>&1) &
  MOCK_PID=$!
  for _ in $(seq 1 120); do grep -q WEB_MOCK_URL "$WORK/webmock.log" 2>/dev/null && break; sleep 1; done
  URL="$(grep -o 'http://[0-9.:]*' "$WORK/webmock.log" | head -1)"
  [ -n "$URL" ] || { echo "web mock did not start, see $WORK/webmock.log" >&2; exit 1; }
  for s in capture capture2 capture3; do node "$VIDEO/scripts/$s.mjs" "$URL"; done
  find "$VIDEO/comp/assets/shots" -name '*.orig.png' -delete
  "$PY" "$VIDEO/scripts/walk_map_overlay.py"
  "$PY" "$VIDEO/scripts/make_bursts.py"
fi

if [ "$TTS" = 1 ]; then
  log "Narration: Kokoro TTS"
  mkdir -p "$WORK/tts"
  for f in kokoro-v1.0.onnx voices-v1.0.bin; do
    [ -s "$WORK/tts/$f" ] || curl -fL -o "$WORK/tts/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
  done
  "$PY" "$VIDEO/tts/gen.py"
fi

if [ "${#PREVIEW[@]}" -gt 0 ]; then
  log "Preview frames"
  node "$VIDEO/scripts/snap.mjs" "${PREVIEW[@]}"
  echo "frames in $WORK/preview"
  exit 0
fi

log "Audio: SFX cue list, music, SFX, narration mix"
node "$VIDEO/scripts/cues.mjs"
"$PY" "$VIDEO/audio/make_audio.py"

log "Frames (3 workers)"
DUR="$("$PY" -c "import json;print(json.load(open('$VIDEO/audio/cues.json'))['duration'])")"
TOTAL="$("$PY" -c "print(round($DUR*30))")"
A=$((TOTAL / 3)); B=$((TOTAL * 2 / 3))
mkdir -p "$WORK/frames"
node "$VIDEO/scripts/render.mjs" 0 "$A" "$WORK/frames/p1.mp4" &
P1=$!
node "$VIDEO/scripts/render.mjs" "$A" "$B" "$WORK/frames/p2.mp4" &
P2=$!
node "$VIDEO/scripts/render.mjs" "$B" "$TOTAL" "$WORK/frames/p3.mp4" &
P3=$!
wait "$P1" "$P2" "$P3"

log "Mux"
printf "file '%s'\nfile '%s'\nfile '%s'\n" "$WORK/frames/p1.mp4" "$WORK/frames/p2.mp4" "$WORK/frames/p3.mp4" >"$WORK/frames/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$WORK/frames/list.txt" -c copy "$WORK/frames/video.mp4"
mkdir -p "$VIDEO/out"
ffmpeg -loglevel error -y -i "$WORK/frames/video.mp4" -i "$WORK/audio/mix.wav" \
  -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$VIDEO/out/ibo-demo.mp4"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$VIDEO/out/ibo-demo.mp4"
echo "done: $VIDEO/out/ibo-demo.mp4"
