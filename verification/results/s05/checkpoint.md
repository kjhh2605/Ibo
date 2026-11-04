# S05 native checkpoint — 2026-11-04

재개 구현·실행 기록과 이전 중단 기록을 함께 보존한다. 현재 S05 전체 합격 또는 개인정보 품질 완료 기록은 아니다.

## M1 재개 관측 — 2026-11-04

사용자 재개 지시에 따라 `kjhh2605/m1-native-resume`에서 검증 중이다. 아래의 frozen 기록은 이전 중단 시점 기록이며, **main/PR 병합 금지는 유지**한다. 제품 완료 또는 S05 합격 기록이 아니다.

- 실제 debug APK와 instrumentation APK가 빌드되었고 native 단위 검사 12개가 실패·skip 없이 통과했다. 설치된 Android WebView에서 Home 렌더링, private `Store.getRuntimeInfo().debug === true`, 임시 파일 중복 정리의 실패 전/수정 후 동작을 확인했다.
- MacBook 공유 파일 소유자의 명시 승인으로 APK ABI를 `arm64-v8a`, `x86_64`로 제한했다. 재빌드된 APK의 ZIP 16 KB 정렬 및 포함된 ELF 10개 전부의 LOAD 정렬을 확인했다. 포함된 ONNX 3개의 SHA-256도 동결 모델과 일치한다. x86_64는 패키징 검사만 했으며, 실행 기기는 M1의 ARM64 Medium_Phone 한 대다.
- 실제 `PAGE_SIZE=16384`, ORT 1.22.0에서 새 instrumentation 프로세스의 cold 모델 로딩과 encoder/decoder/PE 이미지 추론을 실행했다. 각 추론은 warmup 1회 뒤 5회 측정했다. 이는 직접 native 추론 증거이며 UI/릴레이 전체 E2E 또는 개인정보 품질 합격을 대신하지 않는다.
- Android 원 연구 22장/7문구의 canonical PNG와 원본 JPEG 경로가 **각각 22/22 고정 벡터 허용 오차를 통과**했다. 원인은 ICC 프로파일 색 변환이었다. `Images.decode`의 채널 보존을 수정했으며 기준 벡터·허용 오차는 변경하지 않았다. 이전 17/22 실패 증거도 보존한다.
- EdgeTAM rack/shop의 총 6개 마스크가 모두 **IoU=1, mismatchPixels=0**으로 동결 마스크와 일치했다. 실제 production decode를 우회하던 검증 helper를 수정했으며 원본 기준 마스크와 합격 조건은 유지했다.
- 실제 relay PE text tower와 CPU 이미지 ONNX의 원 연구 22장/7문구 검증, **실제 Android에서 추출한 22개 벡터와 같은 text tower의 검색 검증**이 모두 통과했다. 두 경로의 hit@3=7/7이다. relay 검사 6개 통과, skip 없음. 초기 manifest의 6문구와 최종 results의 7문구가 같다는 잘못된 검사만 MacBook 소유자가 제거했고, 두 원본 SHA·22장·최종 7문구·순위 조건은 유지했다.
- 실제 self 12건의 detection을 실행했다. 양성 6건의 사람이 검토한 face+hair GT 승인이 없어 개인정보 gate는 **hard failure/차단 상태**다. 일부 양성 detection 실패와 GT 부재를 skip하거나 실제 모델 출력으로 대신 승인하지 않는다.
- self/provider 및 wardrobe-jeans를 포함한 14입력의 실제 Android tap 결과 42개를 PNG와 binary 84파일로 추출했다. 모든 SHA와 원본 해상도를 확인했다. 이는 **person/garment 모델 출력이며 사람이 승인한 head GT가 아니다**.
- synthetic composition 경계 검사는 통과했지만, 실제 self/provider 조합의 품질과 calibration 16회·독립 heldout 검증은 아직 미확인이다.
- 동일 APK에서 Capture 6개, Voice 7개, Store 14개 및 별도 프로세스 저장→재시작·삭제가 통과했다. Store에는 기존 file URI 별칭의 소유권 이관과 충돌 시 rollback 검사가 포함된다. Media는 실제 시스템 picker의 선택 후 **Done** 확인을 누락했던 검증 드라이버를 고친 뒤 4/4 통과했다. 제품 callback 우회나 timeout 확대는 하지 않았다. 실제 CameraX preview·셔터·종료·재시작 및 같은 Activity의 fixture 폴더/실제 카메라 전환도 통과했다. 전체 UI E2E 합격과는 구분한다.
- 최신 관측 APK SHA는 `943f7f3e5d3ce6ce0eb102145612ac09806c57ce9468252d651a7811bf81795a`다. 공유 소유자 승인으로 CameraX 4개 의존성을 1.5.1→1.5.2로 올린 뒤 API 37의 bind 동적 범위 NPE가 사라지고 Capture 6개가 통과했다. backend가 바뀌는 1.6으로 대체하지 않았다.
- 실행 증거는 `../2026-11-04-m1-resume/`에 있다. 최신 기록은 `native-fixed-contracts.json`, `apk-layout.json`, `ml-timing-after.json`, `photo-index-{original-jpeg,research}-after.json`, `segmenter-research-after.json`, `person-mask-export-after.json`, `actual-mask-provenance.json`, `relay-real-pe-after.{json,xml}`이다. `*-before.json`, `native-diagnostics.json`, `native-contracts*.json`, `relay-real-pe.xml`의 이전 실패를 덮어 합격으로 숨기지 않는다.
- 후속 실제 실행은 `media-after.json`, `native-capture-ui-after.json`, `native-intent-source.json`, `native-auth-current.json`과 [M1 통합 체크포인트](../2026-11-04-m1-resume/checkpoint.md)를 따른다. Firebase Admin은 현재 APK의 ID/App Check 토큰을 각각 검증했으며, 앱 PID 로그의 반환 토큰·등록 debug secret 일치 항목은 0이다. 값이나 원시 로그는 보존하지 않았다.

이전 체크포인트의 “실행 없음”, “GT gate skip”, “JPEG 미검사” 문장은 당시 상태다. 현재는 실제 실행 실패를 보존하며, GT 부재를 hard failure로 처리한다.

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

## Frozen web helper handoff

Helper confirmed frozen and released all six TS/test paths. Zero checks or processes. Known immediate test defect: first geometry test in faceMask.test.ts calls binaryPixels on a nonbinary image then expects undefined, so it will throw; fix on resume, not during freeze. Other unverified items: S06 module/API integration, TS validation, native numerical parity, mode-b alignment/privacy, callback failure isolation, self input temp cleanup, candidate ownerId deletion linkage and actual S11 fixture wiring. S06 web peer agreed getWebRepository/readBlob/writeBlob plus sidecar/retain methods; inspect peer implementation before gates.
