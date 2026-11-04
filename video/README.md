# Ibo demo video (preview cut)

A 2:47, 1920×1080, English-only motion-graphics demo built for the hackathon submission. The storyboard is [`docs/video/storyboard.md`](../docs/video/storyboard.md).

## What it shows, and what it does not

- App screens are the PR #8 UI (`claude/bold-faraday-0x9svu`), captured from the **web mock runtime** (`app/src/ui/verify-web.ts --scenario serve --mode mock`) with Playwright at 412×915. They show sample data from the mock relay, **not live Meta API output**. The video says so on every app scene ("preview build with sample data (mock relay)"), and the try-on image carries a "Placeholder image · mock relay" badge.
- Before submission, swap the app clips for an emulator recording against the live relay (D-R8-01).
- The Dongmyo map is drawn from real OpenStreetMap roads (© OpenStreetMap contributors, ODbL): Jong-ro, Jibong-ro, the shrine block, Dongmyo-ap station (Lines 1 and 6) and Cheonggyecheon are at their real positions. Every walking line follows the road graph (shortest path on drawn roads), so no route cuts through a block. Stall photos are not placed at the spots where they were taken.

## Pipeline

| Step | Script | Output |
| --- | --- | --- |
| Capture app UI | `scripts/capture*.mjs <WEB_MOCK_URL>` | `shots/*.png` and burst frames |
| Map data | `osm/extract_walk.py` (OSMnx Seoul walk GraphML), `osm/build_map.py` | `comp/assets/dongmyo-map.svg`, `comp/mapdata.js` |
| Map raster | `scripts/maprender.mjs` (2×, with the Outfit font) | `comp/assets/dongmyo-map.png` |
| Photos | `scripts/mkphotos.py` | `comp/photos.js`, `comp/assets/dm/` (credits in `dm/CREDITS.md`) |
| Narration | `tts/gen.py` with Kokoro TTS (`af_heart`, user query `am_michael`) | `audio/vo/*.wav` |
| Composition | `comp/index.html` (GSAP timeline, `window.seek(t)`) | — |
| SFX cue list | `scripts/cues.mjs` | `audio/cues.json` |
| Music, SFX, mix | `audio/make_audio.py` (all synthesized with numpy/scipy) | `audio/mix.wav` |
| Frames | `scripts/render.mjs <start> <end> <out.mp4>` (30 fps, 3 workers) | segment MP4s |
| Final | ffmpeg concat + `loudnorm=I=-14:TP=-1.5` | `ibo-demo.mp4` (−14 LUFS) |

Captions for YouTube: `out/ibo-demo.en.srt`.

The scripts use absolute paths from the build workspace (`/home/user/sfvideo`). Generated binaries (screenshots, WAVs, MP4s, the map PNG) are not committed.

## Not verified

- The motion kit at careerhackeralex.com could not be opened from the build session, so its motion was not referenced.
- Audio was checked by loudness measurement only, not by listening.
