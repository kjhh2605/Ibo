# Ibo demo video (preview cut)

A 2:47, 1920×1080, English-only motion-graphics demo built for the hackathon submission. The storyboard is [`docs/video/storyboard.md`](../docs/video/storyboard.md). The committed render is `out/ibo-demo.mp4`, with English captions in `out/ibo-demo.en.srt`.

## Render it

From a fresh clone (Node ≥ 22, Python ≥ 3.10, ffmpeg):

```bash
video/render.sh
```

This re-renders the committed video from the committed inputs: app captures, narration, map and composition. It takes 3–8 minutes and writes `video/out/ibo-demo.mp4`. Scratch files go to `video/.work/` (gitignored). On first run it installs `comp/` and `app/` npm packages, a Python venv, and Playwright's Chromium if missing.

| Option | What it redoes | Extra download |
| --- | --- | --- |
| `--preview 12 66 131` | Only writes preview frames at those seconds to `video/.work/preview/` | — |
| `--tts` | Re-voices the narration from `tts/lines.json` into `audio/vo/*.flac` | Kokoro model, about 350 MB (GitHub release) |
| `--map` | Rebuilds `comp/assets/dongmyo-map.svg`, `comp/mapdata.js` and the map PNG from `osm/*.json` | — |
| `--recapture` | Rebuilds the demo fixtures, re-captures the app UI from the web mock, redraws the Walk-screen map | rembg model, about 180 MB, on first segmentation only |

## Edit it

| To change | Edit | Then run |
| --- | --- | --- |
| Timing, motion, on-screen text, panels | `comp/index.html` (GSAP timeline; `window.seek(t)` renders any frame) | `render.sh --preview …` to check, then `render.sh` |
| Narration text or voice | `tts/lines.json`; clip start times are the `VO` list in `audio/make_audio.py` | `render.sh --tts` |
| Music, sound effects, mix | `audio/make_audio.py` (everything is synthesized) | `render.sh` |
| Map extent, style, pins, walking paths | `osm/build_map.py` | `render.sh --map` |
| App screens | `scripts/capture*.mjs` | `render.sh --recapture` |

Sound-effect cue times come from the composition (`cue()` calls) and are exported to `audio/cues.json` on every render, so they follow timeline edits automatically.

## Inputs in this folder

- `comp/assets/shots/`: the app captures the video uses (29 stills, 3 burst sequences, capture metadata). The Walk screens have the map drawn in; `*.orig.png` are the untouched captures.
- `fixtures-demo/`: overrides applied on top of `verification/fixtures` by `scripts/assemble_fixtures.py`. Shop, storefront and capture photos are upscaled 3×, and each garment has its own segmentation mask, replacing the AI-drafted rectangles that cut garments off. `verification/fixtures` itself is unchanged. `scripts/upscale_fixtures.py` and `scripts/segment_garments.py` (rembg isnet + GrabCut) produced the overrides.
- `audio/vo/*.flac`: narration (Kokoro TTS: `af_heart`; the user's voice query uses `am_michael`).
- `osm/walk.json`, `osm/major.json`: OpenStreetMap roads, stream and stations around Dongmyo, already extracted. To redo them, run `osm/extract_walk.py <seoul_walk.graphml>` (an OSMnx Seoul walk network) and `osm/extract_major.py <filtered.osm.pbf>` (github.com/lancard/filtered-south-korea-osm). Install the deps first with `pip install -r requirements-osm.txt`.
- `comp/assets/dm/`: Dongmyo photos from Wikimedia Commons, CC BY-SA 4.0. Credits are in `dm/CREDITS.md` and on the end card.

## What it shows, and what it does not

- App screens come from the **web mock runtime** (`app/src/ui/verify-web.ts --scenario serve --mode mock`) with sample data. They are not live Meta API output. Every app scene says so on screen, and the try-on image carries a "Placeholder image · mock relay" badge. Before submission, swap in an emulator recording against the live relay (D-R8-01).
- The committed captures come from `main` at `e6694d9`, before PR #13. PR #13 changed the try-on screen to a mannequin with outer/top/bottom slots, and `Generate` became `Fit`. `scripts/capture2.mjs` still follows the old try-on flow, so `--recapture` on the current `main` stops at the try-on step until that script is updated.
- The Dongmyo map is drawn from real OpenStreetMap roads (© OpenStreetMap contributors, ODbL). Every walking line follows the road graph. Stall photos are not placed where they were taken. In the web runtime the Walk screen's map is a mock box, so the video draws the Dongmyo map into it.
- The motion kit at careerhackeralex.com could not be opened from the build session, so its motion was not referenced.
- Audio was checked by loudness measurement only, not by listening.
