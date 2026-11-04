# S11 runtime implementation checkpoint — 2026-11-04

## Scope and observed result

Implemented the ten documented CLI backends, actual Playwright-Android/adb flow driver, private fixture staging, production fixture replay, memory-only privacy observer, native instrumentation bridge, 16-call quality/provenance workflow, research measurement and emulator recording/concatenation. No Android device, native build, model inference, live provider call, secret transfer, git commit or merge was performed by this worker.

`runtime-smoke.json` contains actual host evidence: all ten wrappers accept `--help` from `/tmp`; the real FastAPI mock media endpoint accepted fragmented ASGI JSON and returned 200; memory inspection rejects raw-self and Meta coordinates and scopes OSRM correctly; real HTTPX multipart voice was inspected; synthetic APK ZIP/ELF 16KB alignment accepted and 4KB rejected. Real host Chromium forwarded four phase headers to an actual HTTP server without changing request bodies or response bytes, and aborted an undeclared phase before reaching the server. This is NOT Android WebView evidence. `boundary-smoke.json` covers finite calibration metrics, strict threshold boundaries and transparent-pixel identity canonicalization.

`validate-fixtures.sh --relay`: exit 0. Production replay includes exact route-origin/destination matching and wrong companion-count 409, token binding/budget/expiry and no fallback. There are 18 scenarios and 326 assets. `validate-fixtures.sh --all`: exit 2, errors 0, blockers 155, human approvals 0; complete output is in `fixtures-all.json`. No previous evidence was rewritten as passing.

## Owned implementation files

- `scripts/e2e/entry.py`, `runtime.py`, ten `.sh` entry wrappers, `package.json`, `package-lock.json`, `.gitignore`.
- `backends.py`, `android.mjs`, `device.mjs`, `scenarios.mjs`, `phases.mjs`, `observed_relay.py`, `privacy_capture.py`, `resources.py`.
- `instrumentation.py`, `android.init.gradle`, `android-src/com/streetfitting/verification/NativeVerificationTest.java`, `quality.py`, `research.py`, `research.mjs`, `recording.py`.
- Fixture-helper integration: `build_fixtures.py`, `fixture_manifest.py`, `validate_fixtures.py`, `import_review.py`, `relay_fixtures.py`, `relay_runtime.py`; generated `verification/fixtures/**` metadata/relay replay assets and review surfaces.
- `docs/prd/verification/fixtures.md`, `docs/prd/verification/acceptance.md`.

Root `scripts/push-fixtures.sh`, app/relay/shared contracts remain coordinator-owned. Root private staging cutover was coordinated, not modified here.

## Actual runtime contracts

- Every launch/deep link preserves current private Capture/Voice fixture extras. Capture switches unmount actual Capture via Home and reopen; no public Store write hook, clock override, result insertion or service replacement.
- Full creates prior trips via actual UI. Only explicit research `--seed-search` permits the S11 test APK's real native repository importer; photo indexes use actual native ML, never supplied synthetic embeddings.
- Mock phase IDs are `e2e-route-start`, `e2e-route-reroute`, `e2e-tryon-other` (one companion) and `e2e-tryon-target-only` (zero). Interception selects solely by harness phase/path and forwards actual requests; live installs none. Android correlation compares actual relay ingress headers to driver observations.
- Two Results are generated through actual UI Change pieces; deleting the first checks the other's row and copy hashes unchanged. Trip/photo/piece deletions check real rows, embedding cascade and owned files; Result Walk remains snapshot-based.
- Privacy scope is actual ASGI/HTTPX + request-context disk/database audit, metadata logs and native hash identities. App inspector scope remains relay attempts/shared-file reads/Media export attempts, not an invented native-wide spy. Download blocking separately invokes actual native Media and compares MediaStore.
- PoC saves original bytes only in local cache, waits for genuine human calibration review after 12 calls, resumes without rebilling completed calls, freezes thresholds before held-out calls and never automatically promotes product thresholds.
- Research joins successful full live and completed 16-call evidence, actual native 22×7/segmentation proof, real semantic/IoU observations, one-hour background FGS, endpoint latency, startup/model load/encode and sampled RSS/PSS.

## Genuine prerequisites and M1-only gates

See `docs/prd/verification/acceptance.md` for exact input schemas. Missing human inputs: reviewed 12-case `review/head.json` and GT masks, `masks/items/cases.json` review, nine semantic/SAM cases in `review/search.json`, approved speech WAV/public-use terms, and future `quality/calibration-review.json` tied to actual outputs. Native person-mask export is NOT human GT. Apple say output must not be distributed.

Original retrieval corpus exists on M1 at `/Users/user/.cache/street-fitting/models/retrieval_r4`; no copies or synthetic replacement were made here. The exact native `files/ml-proof/research.json` source bundle path/provenance field names were requested from coordinator and still require reconciliation to the original artifact before the research gate. The adapter currently requires `sourceOriginal/sourceSha256/canonical/vector` for images, seven query vectors/relevant IDs and two segmentation cases. Do not claim schema compatibility without inspecting the genuine bundle.

M1 must compile/install the S11 instrumentation APK, verify private folder ownership, MainActivity newIntent refresh and sequence reset, actual Android header forwarding, all real ML/head gates, full mock/live visual flows, auth/provider/OSRM, 16-call quality, research and final ≤180-second video. Host smoke cannot prove these. Mock generated provider output may be rejected by real person/head detection; preserve unsafe/faceless failure semantics instead of fabricating a safe mask.
