# S05 frozen WIP checkpoint — 2026-11-04

User stop overrides implementation/acceptance. No completion or quality claim. Native code and web helper edits are preserved, not verified. Do not mistake this checkpoint for accepted S05.

## Identity

- Worktree: `/Users/user/orca/workspaces/Meta-Hackathon/s05-app-ml`
- Branch: `kjhh2605/s05-app-ml`
- Task: `task_9a5d318d4ac5`; dispatch: `ctx_48dc3cdc79e9`
- Owner terminal: `term_517a7399-f3da-4266-8c3e-92879343558e`
- Web helper: `term_20d5cb0e-6423-4e26-8824-35cad95edcb7`
- Base S00: `23baff764ed622be9dd2ed4e0673f60747937a7d`
- Setup already completed before dispatch; do not repeat. Source `scripts/worktree-env.sh`.

## Owned native paths changed/new

Prefix `app/android/app/src/main/java/com/streetfitting/app/plugins/`:
- `photoindex/PhotoIndexPlugin.java`
- `segmenter/SegmenterPlugin.java`
- `segmenter/model/Models.java`
- `segmenter/model/Images.java`
- `segmenter/model/EdgeEngine.java`
- `facemask/FaceMaskPlugin.java`
- `facemask/FaceMaskCore.java`
- `facemask/HeadGeometry.java`
- `facemask/BoundaryMetrics.java`

Tests under `app/android/app/src/`:
- `test/java/com/streetfitting/app/plugins/facemask/FaceMaskRulesTest.java`
- `androidTest/java/com/streetfitting/app/plugins/segmenter/MlProof.java`
- `androidTest/java/com/streetfitting/app/plugins/segmenter/SegmenterResearchTest.java`
- `androidTest/java/com/streetfitting/app/plugins/segmenter/MlTimingTest.java`
- `androidTest/java/com/streetfitting/app/plugins/photoindex/PhotoIndexResearchTest.java`
- `androidTest/java/com/streetfitting/app/plugins/facemask/FaceMaskPrivacyTest.java`
- `androidTest/java/com/streetfitting/app/plugins/facemask/FaceMaskComposeTest.java`

Web helper owns exactly `app/src/native/{photoIndex,segmenter,faceMask}.ts` and matching `.test.ts`; all six present as WIP. Await helper freeze handoff for exact known defects. No shared config, Gradle, manifest, repository, generated theme or dependency files edited by S05.

## Implemented code, NOT exercised behavior

- Hash-verified streaming asset extraction and shared CPU ORT sessions with exact tensor checks.
- PE PIL-style bilinear fixed-point uint8 resize and Edge tensor-style antialias float resize; EXIF normalization; explicit grayscale 0/255 PNG writer.
- One active Edge encoder handle shared by Segmenter/FaceMask, decoder reuse, three score-sorted masks, half-pixel logits resize, original-dimension bounds, cache/source-deletion checks.
- Photo ID single-flight async inference, normalized vectors, repository atomic commit, pending resume, 30s pending search deadline, score/time/id ordering. Exact `public static void PhotoIndexPlugin.dispatch(Context,String)` promised to S04.
- Conservative connected-component/neck/hair-margin geometry, all three masking modes, opaque masked wire image capped2048/4MiB using single-footprint nearest downsampling, source-contribution privacy count, version-retained self composition, immutable provider hash checks, local sidecars, safe faceless crop.
- Neck/shoulder64-point sampling, symmetric offset95, LabD65 deltaE76 bands, threshold precedence/inclusive comparisons. Production thresholds remain null, never called calibrated.
- Regression and Android research/metric/privacy/timing test source written, no execution.

## Observed commands/results

Only reference preparation ran; no lint, build, tests, emulator, install, instrumentation, inference APK or server ran. No native acceptance evidence exists.

Command:
`/Users/user/.cache/street-fitting/model-validation-venv/bin/python /tmp/sf-s05-prepare.py`

Observed exit0 after17.17s; checkpoint loader reported no missing/unexpected keys. Output:
`{"output":"/tmp/sf-s05-proof","images":22,"queries":7,"segmentation":2,"selfCases":12,"approvedGT":0}`

Fresh `/tmp/sf-s05-proof` contains research22 Pillow RGB canonical PNGs plus original JPEG copies/hashes, preserved image vectors,7 text vectors computed from exact frozen checkpoint, rack/shop NPZ masks as binary,12 S11 frozen self images, `research.json`, `self.json`. `sf-s05-prepare.py` reads model modules/checkpoint only, never original export/retrieval scripts, uses offline mode and suppresses Python bytecode. No original bundle or baseline mutations were issued.

One child job `bg_1` ran reference prep and completed. No owned running job/service remains. Attempted nested Orca worker launch was rejected by depth policy before effects; coordinator launched web helper separately.

## Dependencies and known risks before restart

1. S06 native repository is still absent in this checkout: current interface has only six bootstrap methods. New code directly references agreed `get`, `list`, `getSelfPhoto`, `markIndexFailed`, `retainSelf`, `releaseSelf`; current tree therefore cannot compile until S06 implementation/interface integrated. No reflection or compatibility shim intended. Get/list entity keys use `Photo`/`PhotoEmbedding`, timestamps numeric milliseconds.
2. S06 web repository absent; helper imports agreed actual Blob/IndexedDB APIs. Receive S06 and web helper code/contracts before first gates.
3. No actual ORT1.22.0 Android16K inference, mask IoU1, vector tolerance, research ranking, cancellation/deletion, cache restoration, UI bridge, APK/ELF alignment, timing or protected GT acceptance exercised. All mandatory gates remain.
4. Research test currently compares canonical decoded PNGs, explicitly records original JPEG hashes but does not yet test native original JPEG decode differences. Must not silently present canonical-only proof as all-source compatibility. Preserve maxAbs1e-4, cosine.9999, norm1e-4 and IoU1 unchanged.
5. S11 human face+hair GT annotation/review is unavailable (`approvedGT=0`), draft masks cannot establish privacy. Native fixture test records results and skips the GT gate when approval absent; any skip is NOT acceptance. Frozen positives/negatives can also expose genuine algorithm failures; do not exclude failures post hoc.
6. Production composition thresholds intentionally null. Calibration16 real calls and independently fixed/heldout evidence remain S11 dependency, never substitute synthetic test thresholds.
7. Review/fix before gates: PhotoIndex repository lookup is outside its inference try block, so repository acquisition failure can strand its future; Segmenter corner test may legitimately return `invalid_mask` for empty masks rather than succeed; class/API Java compile has never been exercised.
8. Review exact cancellation atomicity: plugin destroy after final precommit check can race self replacement; source deletion checks currently use existence/size/mtime. S06 atomic embedding commit must prevent resurrection. No implemented proof yet.
9. FaceMask cleanup probes retained versions and currently deletes sidecars on any repository exception; refine to definite unavailable versions rather than transient IO. GT binary content is fully checked only after successful detection; API requires valid positive GT even on registration rejection.
10. Model missing file error classification and exact manifest/runtime shape behavior need actual checks. Session lifetime is process-shared. PE kernel fixed coefficients are recomputed inside pixel loops and should be hoisted (no algorithm change).
11. Current `cache/candidates/<assetId>/mask-UUID.png` layout agreed with S06. Source photo deletion purges directory; handle release deletes files; empty directories may remain. AssetId regex limits path traversal. `cache/ml` contains self/results temporary files; confirm S06 ownership/allowlist before integration.
12. Sidecar records mode, original dimensions, cropOffset, wire dimensions. S06 owns three SelfPhoto copies, S05 sidecar outside DTO; retainSelf must protect requested prior version. S10 receives only maskedFile and must never send original/headMask.

## Restart order

1. Read latest coordinator/web helper/S06 handoffs; integrate real repository and helper dependencies without repeated setup.
2. Address known defects and compile once with source env, Android native max-workers2; no repeated midflight gates.
3. Build actual acceptance APK/instrumentation, canonical+original research checks, exact masks and privacy/core fixtures; preserve fixed tolerances. First fresh instrumentation class MlTimingTest for cold model session timing.
4. One emulator only. Entire install/auth restore/launch/fixtures/inference/assertions/cleanup scenario under ONE `scripts/emulator-lock.sh` transaction. Restore registered AppCheck after installs; native URL10.0.2.2:$RELAY_PORT. Never touch user emulator service ownership.
5. Complete real lifecycle/bridge proofs, zipalign-P16/all ELF LOAD alignment, actual16K inference. Record failures honestly and preserve immutable provider/baseline bytes.
6. Only after user resumes full work, finish docs/evidence/PR per new coordinator instruction. Current stop forbids new builds/tests/PRs.
