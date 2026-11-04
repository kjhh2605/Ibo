# Street Fitting — 두 Mac 재개 핸드오프 (2026-11-04)

## 최신 상태: main 병합·맥북 수동 실행 (2026-11-05 KST)

사용자가 두 Mac 작업의 병합과 불필요한 worktree/branch 정리를 요청해 **이전 main 병합 금지를 해제했다.** 아래 재개·중단 절은 당시 기록이며 이 절이 우선한다.

- 두 Mac 이력을 보존한 `abecf85c62cb37b47ab395cbf958e6feafcd817e`를 `main`에 fast-forward하고 원격 push했다. 부모는 MacBook `bb40557`, M1 `80865ae`이며 merge tree는 `bb40557`과 동일하다.
- 현재 작업 경로는 MacBook `/Users/gnar/orca/projects/meta-hackathon`, M1 `/Users/user/Desktop/Meta-Hackathon`의 `main`이다. 두 호스트 모두 별도 worktree와 로컬 작업 브랜치를 제거했다.
- 정리: MacBook worktree 1개/로컬 브랜치 1개, M1 worktree 14개/로컬 브랜치 15개, 원격 작업 브랜치 16개. 이전 PR #1–4의 squash 병합도 확인했다. 미병합 Ibo 이름·로고 변경이 있는 `claude/charming-rubin-dogd9f`는 보존했으며 이번 main에 섞지 않았다.
- 삭제 전 고유 파일과 Git bundle을 Git 밖에 보존했다. MacBook: `$HOME/.cache/street-fitting/macbook-worktree-preservation-2026-11-05`의 21개 파일(hash 검증) 및 `merged-branches-2026-11-05.bundle`. M1: `$HOME/.cache/street-fitting/m1-worktree-preservation-2026-11-05-9cnubf2s`의 69개 보존 파일·이력 bundle·최종 APK. 원 모델/인증 cache는 삭제하지 않았다.
- M1 모델 묶음과 private 설정은 기존 Tailscale/SSH 연결에서 host fingerprint를 검증한 뒤 MacBook으로 전달했다. 비밀 값은 출력·커밋하지 않았다. MacBook의 실제 PE text loader를 포함한 `RELAY_MODE=live` relay startup이 통과했고, main에서 `RELAY_MODE=live bash scripts/relay-dev.sh`로 실행 중이다. 이 checkout의 포트는 `8788`, Android 주소는 `http://10.0.2.2:8788`이다.
- MacBook main에서 lint/build/doctor, `cap sync android`, `assembleDebug` 통과. 기존 lint warning 24개 및 theme-fonts warning은 남아 있다. MacBook 서명 APK SHA256: `3d85bee979e804885c07a393f2b284c13bff60ebc4a9fcbd35331f9a7d3bf3c9` (`app/android/app/build/outputs/apk/debug/app-debug.apk`).
- 기존 `Medium_Phone`의 저장 공간 부족은 사용자 승인 후 다른 사용자 앱 4개 삭제로 해결했다. Street Fitting 데이터는 유지했다. M1 APK는 기존 설치본과 서명이 달라 MacBook에서 다시 빌드한 APK를 update 설치했고, 등록된 App Check debug secret을 비밀 값 출력 없이 복원했다.
- 실제 MacBook Android WebView에서 Home → Wardrobe → Home → Find it → Home 이동을 확인했다. 홈 화면으로 돌린 뒤 자동화 연결을 해제하고 앱/에뮬레이터/live relay를 사용자 조작용으로 남겼다. 이는 capture·try-on 전체 E2E 또는 MacBook의 Firebase/Meta 인증 round-trip 합격을 뜻하지 않는다.
- 사람 검토 URL `http://127.0.0.1:8767/review/`는 삭제할 worktree 대신 main의 동일 자산을 서비스하도록 옮겼으며 HTTP 200을 확인했다. 사람 승인 상태는 변경하지 않았다.
- **실제 외부 AI 추론 호출은 아직 미검증이다.** Spark/SAM 3.1/Muse Image/Muse Voice의 live inference 성공 증거가 없다. Meta 모델 목록 GET 200, 실제 local PE/EdgeTAM 추론, live relay startup과 구분한다. 사람 입력에 의존하는 전체 E2E 제외를 standalone provider API smoke까지 넓힌 것은 검증 범위 누락이며, 이전 “사람 입력 없는 나머지 완료”를 해당 API 검증 완료로 해석하지 않는다.

## 재개 진행 상황 (2026-11-05 KST)

사용자 요청으로 MacBook/M1 환경·소유권 합의 후 구현을 재개했다. **이 절은 main 병합 전 기록이며, 당시 main/PR 병합 금지와 세션별 Fast 모드를 적용했다.** 현재 Git·실행 상태는 위 최신 절을 따른다.

- MacBook: `kjhh2605/macbook-resume`, M1: `kjhh2605/m1-native-resume`. 공유 파일은 MacBook 조정자, Java/native/모델·키·기기 검증은 M1 조정자가 소유한다. 명시 승인한 SHA만 교환하며 이미 존재하는 동등 변경을 중복 cherry-pick하지 않는다.
- `55a289f`: 실제 영속 서비스/UI 연결과 M1 build 선행본. MacBook lint/build/doctor 통과, 당시 전체 검사 218 pass/1 잘못된 RGB assertion 실패를 기록했다.
- `8f989e9`: S02/S03 제품 endpoint·실제 PE text loader·공식 SAM parser 구현. 통합 pytest 266 pass, 실제 TCP 검색 18개 응답 및 fixture 10 chain/12 boundary 통과. 실제 Meta/OSRM/PE 품질 합격과 구분한다.
- `7e8a9d5`: portable fixture/엄격 replay·review import/validator. 구조 오류 0이지만 사람 승인/GT/배포 가능한 음성/연구 corpus의 외부 선행 조건은 그대로 보존한다. review UI의 polygon anti-alias를 binary mask로 보수적 변환하는 수정도 실제 화면에서 확인했다.
- `f0213c4`: 실제 경계 계측과 native debug gate, web cross-tab GC 유실 수정, canonical device 오류 및 구형 bootstrap 제거. 실제 Chromium에서 계측 count 증가와 두 탭 소유권/파일 보존을 확인했다. M1의 private Store debug 메서드와 함께 검증 flag를 켜야 observer를 노출한다.
- S01 M1 gate: 72 pytest + 실제 TCP 22 응답, 외부 호출/요청 파일 쓰기 0. M1 증거 `f237e2a`를 MacBook의 `5169aa8`로 가져왔다.
- M1 native `6207b15`를 이 브랜치 `58cca12`로 통합했다. 실제 원본 JPEG/PNG 각각 22장 벡터와 6개 segmentation mask가 엄격 기준을 통과했고, 실제 relay text tower × Android 22장 검색은 top3 7/7이다. CameraX·Store v2·private fixture와 실제 masks 기반 web Result/wardrobe 연결은 각 `2026-11-04-m1-resume/checkpoint.md`, `2026-11-04-s08-ui/CHECKPOINT.md` 증거를 따른다. native 전체 E2E나 사람 privacy 승인을 뜻하지 않는다.
- **2026-11-05 KST 사용자 범위 변경:** “맥미니에서 사람 입력 대기중인 작업은 이번 작업범위에서 제외”. 사람 head GT·item-mask/분류 검토·자산 공개 승인·사용 동의 영어 녹음 및 그 입력에 의존하는 전체 mock/live E2E·품질/threshold·privacy/provenance 최종 판정·live 데모는 이번 재개 범위에서 제외한다. 제외는 PASS/승인/제품 요구사항 삭제가 아니다. 기존 CLI의 사람 입력 gate와 fail-closed 동작을 유지하며 승인 자료를 만들어 넣지 않는다.
- **이번 승인 범위 완료:** MacBook Camera viewport·S11 freshness/metric GPS 검증 수정과 M1 native 알림/권한/음수 preview 원점 수정을 통합했다. M1 `940d577` → MacBook `491e058`, 최종 취소/정리 증거 `a5db1ba` → `5bdb9a6`. main/PR 병합은 하지 않았다.
- 최신 설치 APK `c18813965a9d3078c753e89df8511d9a588f2520daaa7e564bfbb3177d699cef`: native 39개(원 aggregate의 Capture fixture 오류는 별도 수정 실행 6개로 확인), 실제 권한 변형 5개, Camera UI 6상태·실제 3장 저장/재시작/오프라인 외관 검증 통과. Debug/Release 단위 각각 12개, 16 KB ZIP/ELF 정렬 및 release fixture 제외도 통과했다. [M1 검증 기록](../../verification/results/2026-11-04-m1-resume/checkpoint.md)의 각 APK·실행 경계를 따른다.
- MacBook 실제 browser full 52개/state 92개 관측, 각각 13개 route 및 lint/build/doctor 통과. 실제 Android mask fixture를 쓰는 web mock이며 live API 품질 증거가 아니다. [UI 검증 기록](../../verification/results/2026-11-04-s08-ui/CHECKPOINT.md).
- **1시간 FGS는 M1 세션의 사용자 지시로 중단했다.** 17개 실제 관측/595,965 ms까지만 보존했고 `passed:false`, `completedFullHour:false`다. 중단 후 자기 Trip 종료, raw trail 71→0, FGS 종료를 확인했다. 이를 1시간 합격으로 바꾸거나 다시 시작하지 않는다.
- 당시 수행한 검증 후 M1의 소유 앱/에뮬레이터 종료·adb 연결 해제를 확인했다. MacBook의 검사용 탭/서버와 supervised worker도 정리했다. 외부 AI inference smoke는 이 완료 기록에 포함되지 않았다. 기존 사용자 검토 서버 `http://127.0.0.1:8767/review/`는 이전 유지 요청대로 남겼으며 사람 검토는 이번 범위 완료의 대기 조건이 아니었다.

## 중단 당시 지시와 Git 상태

**중단 당시 제품 미완료였으며 추가 병합·구현·검증을 멈췄다. 이후 재개 및 병합 지시와 진행 상황은 위 절이 우선한다. 아래 병합 금지는 당시 지시다.**

- main의 마지막 승인 기준은 S00 PR [#4](https://github.com/kjhh2605/Meta-Hackathon/pull/4), `23baff764ed622be9dd2ed4e0673f60747937a7d`이다. 이번 중단 정리에서 main을 변경하지 않았다.
- 이전 “전체 병합 후 중단” 지시에 따라 아래 작업을 로컬 `kjhh2605/wave1-shared-integration`에 이미 모았다. 이후 “병합하지 말라” 지시를 받아 추가 merge/PR 생성/PR 병합은 하지 않는다. 기존 로컬 통합 이력은 재작성하지 않고 보존한다. 이 브랜치는 **검증되지 않은 WIP 집합**이지 합격한 통합본이 아니다.
- 개별 작업 브랜치를 그대로 재개할 수 있다. 기존 PR [#5](https://github.com/kjhh2605/Meta-Hackathon/pull/5) (S10, draft), [#6](https://github.com/kjhh2605/Meta-Hackathon/pull/6) (S07)은 병합하지 않는다.
- 모든 코딩 작업자는 OMP로 전환했다. 모델 이름 `openai-codex/gpt-6-astra`는 harness와 다르다. S11의 Codex CLI 사용은 실제 이미지 생성 도구 용도였다.

## 보존 브랜치와 상태

브랜치 prefix는 모두 `kjhh2605/`. 표의 hash는 중단 시점 소스 commit이며, 합격 표시가 아니다.

| 슬라이스 / 브랜치 | Commit | 실제 관측 및 남은 범위 |
| --- | --- | --- |
| S01 / s01-relay-core | cd8c6601488d1d2964c23e8c06dfd76147af0213 | 인증·토큰·privacy logging·Meta transport 구현. 작업자 보고 63 pytest 통과 후 마지막 logger 수정에 privacy 5개만 재실행. 실제 native Firebase/App Check → HTTP 인증/실패 경로 확인. 제품 endpoint는 아직 구현 전. |
| S04 / s04-app-capture | e1b30d299f97056e6bf8b6e990ea1bc249378c74 | CameraX/위치 FGS/media/voice와 web 코드 작성. **compile/build/test/runtime 전부 미실행**. |
| S05 / s05-app-ml | d169b265cc80da4727624130f9f974c719678d2d | ONNX/index/segment/head protection/composition 코드 작성. 연구 입력 준비만 실행. **Android 추론·build·test 미실행**. |
| S06 / s06-app-data | fa0844a33e7c85aa45fc75500505ad397e2f2f57 | SQLite/files/GC/self pin/queue/web IndexedDB 작성. native instrumentation 7 methods 중 6개 실질 동작, 1개 phase-only/no-op. 별도 실제 저장 → force-stop → 재시작/삭제 확인. JS compile/test/browser 미실행. |
| S07 / s07-app-agent | 914d05b3fe827e637a6f7567a228a578fcd1522a | 49 tests 및 Chromium + 실제 HTTP mock 4-turn/1-SAM 검색 증거. 실제 Meta 검색 아님. missing native/files로 tsc 실패, build/doctor 미통과. |
| S08 / s08-app-ui | 5fb01eb38b1b3ec6ef2b18dcadd2b00ecc6e0bc7 | 13-route UI·bindings·test/harness 초안. **lint/build/tests/browser/device 모두 미실행**. |
| S09 / s09-app-walk | eb9a378ae52cefb879d5cdd7b4a267ca1dfffdd3 | 30 tests, lint/build/doctor, 실제 OpenFreeMap host/Android 화면 확인. route/location은 synthetic. live OSRM/native GPS 통합 아님. |
| S10 / s10-app-tryon | 005b87a941d072b64c208d185ac9911a85857741 | 31 tests, Android WebView synthetic 7-image pipeline/privacy 증거. 실제 Muse/native ML/SQLite 성공 증거 아님. missing native/files로 tsc 실패. |
| S11 / s11-verification | f05e561a36d32b0bdc9dea2694c2b4f7cac48841 | 앞선 code commit 7dc60dbe079a5f482239d777e561f037a6c052da. 실제 생성 이미지·미승인 draft fixtures·미완성 harness 보존. **acceptance 명령/E2E/PoC/데모 미실행**. |
| 공통 / wave1-shared-integration | b53a508 (공통 구현 commit) | 전송 직전 queue claim hook, 강제 native auth refresh, Retry-After parsing, Filesystem 및 UIAutomator 의존성. 이후 로컬 통합 merge 및 이 문서 commit이 뒤따른다. |

**S02/S03은 시작하지 않았다.** S01 WIP 코드가 존재하는 것과 S01 합격·PR 병합 gate는 다르다. README의 의존 순서를 유지한다.

## 실행 증거와 상세 인계

경로는 저장소 루트 기준이다. 각 증거의 mock/live/native 경계를 유지한다. 아래 slice 관측은 작업자 보고와 해당 보존 증거이며, 이번 전체 WIP의 재검증 결과가 아니다.

- S00: `verification/results/2026-11-04-s00-bootstrap/{README.md,android.json}`. 실제 Firebase debug App Check 등록 및 인증, 16 KB APK/asset 준비. 모델 추론 증거 아님.
- 공통: `verification/results/2026-11-04-wave1-shared/README.md`. 통합 전 47 tests, lint/build/doctor, native assemble/unit, 실제 TCP 전송·claim·취소·429 및 native force-refresh/Auth Admin 검증. 원본 비밀 값은 기록하지 않았다.
- S01: `relay/tests/core/README.md`, `live_auth_smoke.py`, `live_auth_smoke.mjs`.
- S04: `verification/results/2026-11-04-checkpoint/s04-handoff.md`.
- S05: `verification/results/s05/checkpoint.md`, research/self input manifests. 추가 초기 인계: `verification/results/2026-11-04-checkpoint/s05-handoff.md`; 최신 소스 상태는 s05/checkpoint가 우선한다.
- S06: `verification/results/s06-app-data/{apk.sha256,native-identity.txt,native-instrumentation.log,process-save.log,process-restart-delete.log}`. APK sha256 `56c0a0f6160b252b9281449d6dc6017f7f8dfd89b1095902d8d6654cd8c5b55c`.
- S07: `app/src/agent/evidence/{README.md,smoke.json,smoke.mjs}`.
- S08: `verification/results/2026-11-04-s08-ui/CHECKPOINT.md`.
- S09: `verification/results/2026-11-04-s09-walk/{runtime.json,host-route.png,host-arrived.png,android-device-route.png,android-device-arrived.png}`. Android CDP screenshot은 WebGL compositor를 놓치므로 adb 전체 화면이 실제 지도 증거다.
- S10: `app/src/tryon/evidence/` README 및 acceptance/native-boundary/webview-contract JSON.
- S11: `verification/results/2026-11-04-checkpoint/s11-handoff.md`. 생성·출처·미완성 항목·재개 순서를 상세히 기록했다.

## 재개 시 먼저 해결할 코드/계약 문제

1. **`app/src/native/files.ts`가 없다.** S07/S10의 확인된 compile blocker다. 임시 mock/우회 import를 넣지 않는다. 합의한 경계:
   - `readBytes(file: FileRef): Promise<Uint8Array>`.
   - `writeTemp({bytes: Uint8Array, mime: string, purpose: 'candidate-mask' | 'provider', ownerId?: string}): Promise<FileRef>`.
   - candidate-mask는 원본 photo ownerId 필수. native private Store `registerTemp({file,ownerId})`로 소유권을 확인/등록한다. provider 바이트는 재인코딩하지 않는다.
   - native는 Filesystem 8.1.5와 app files/cache canonical URI만 사용한다. web은 S06 `getWebRepository().readBlob` / `writeBlob(blob,purpose,ownerId?)`를 재사용한다. 별도 Blob DB/메모리 production fallback 금지.
   - discardTemp 및 photo 삭제 연쇄를 실제 확인한다. raw Store public write/아홉 번째 custom plugin을 만들지 않는다.
2. S06 queue의 `forceRefresh` 옵션은 공통 전송 API `forceRefreshAuth`와 맞지 않는다. pre-claim 영구 image 오류의 무한 retry, lost wake, pin rollback, GC/web multi-tab 경계도 미검증이다.
3. S04 `MediaContractTest.photo`는 입력 fixture를 `commitPhoto`에 직접 넘겨 이동/삭제할 수 있다. **실행 전에 cache copy를 사용하도록 수정**한다. voice cancel/finalization, FGS lifecycle, OS 권한 실패 경로 미검증.
4. 과거 Trip의 외관 추가/retake UX는 current-shop-only `Capture.takePhoto({kind})` / note-only `Store.updateShop` 계약으로 구현할 수 없다. S04/S06/S08과 계약 확장을 명시적으로 합의해야 한다. 아직 DTO 변경하지 않았다.
5. S05 faceMask.test의 잘못된 nonbinary RGB assertion, PNG-only research test의 원 JPEG decode 누락, future/sidecar/cancel 경계를 검토한다. human GT 부재 시 현재 skip을 합격으로 해석하지 않는다. 16 KB 실추론·22장/7문구·마스크 정확도·실측 threshold 모두 남았다.
6. S08 `VITE_SF_UI_ADAPTER=1`은 browser-only 메모리 UI contract 초안이다. 영속성/제품/native 증거가 아니며 실제 owner integration 때 제거해야 한다. `person()` reject와 capture lifecycle 초안도 남았다.
7. S01 XMP GPS metadata 차단은 source inspection상 추가 검토 필요. **재현된 privacy bypass로 보고한 것이 아니다.** 마지막 logger 수정 후 전체 suite를 다시 실행해야 한다.
8. S11 shell wrappers가 호출하는 `scripts/e2e/entry.py`가 **없다**. fixtures/manifest가 최신 generator 수정과 불일치한다. validator/privacy observer도 미실행이다. wrappers나 생성 corpus를 실행 가능한 E2E/합격 corpus로 취급하지 않는다.

## 외부 승인·권리 조건

- human face+hair GT / item-mask / 분류 승인은 **0건**이다. AI rectangle draft를 human annotation으로 승격하지 않는다. 실제 annotator/date/review가 필요하다. 새 UI 배치·문구의 프로토타입 세션 승인도 미완료다.
- Apple macOS Tahoe SLA §2F: https://www.apple.com/legal/sla/docs/macOSTahoe.pdf . `say` System Voice 녹음을 public demo/corpus에 재배포하지 않는다. 로컬 `audio/query.wav`, `voice/normal/01-query.wav`는 Git 제외. 재개 시 동의·라이선스가 있는 사람 녹음, 명시적 허가 또는 승인된 대체 방법이 필요하다. 임의 provider 교체 금지.
- Codex 생성 이미지는 출처가 기록된 **미승인 synthetic draft**로만 커밋했다. 원 연구 이미지/weights, secrets, node_modules, pycache, Apple speech는 커밋하지 않았다. 저장소 공개 전환/과금 계약 변경은 하지 않았다.

## 두 Mac 재개 배치 제안 — 아직 실행하지 않음

- **Mac mini M1**: 유일한 Medium_Phone, Android/native/16 KB inference, 실제 최종 integration·영상. 모든 device scenario 전체에 `scripts/emulator-lock.sh` 전역 잠금을 건다.
- **MacBook**: 코드 구현·단위 검증·fixture/harness 편집 등 기기 독립 작업. 그 기기의 결과를 M1 합격으로 대체하지 않는다. 모델/키는 안전한 로컬 경로로 별도 준비하며 Git/프롬프트에 넣지 않는다.
- 통합 담당은 한 명. 공유 contracts/manifest/MainActivity/package/transport 파일 소유자를 먼저 배정한다. 이전처럼 11개 작업자를 M1 하나에서 동시에 돌리지 않는다. 적은 수의 독립 작업부터 배치한다.
- 파일 잠금과 포트 registry는 **호스트 로컬**이다. MacBook에서 M1 기기를 원격 제어해도 M1의 동일 잠금 안에서 실행한다. 두 호스트의 별도 lock이 하나의 전역 잠금인 것처럼 취급하지 않는다.
- 새 Orca worktree마다 `bash scripts/setup-worktree.sh`를 실행하고 `source scripts/worktree-env.sh`를 로딩한다. 기존 worktree는 setup 완료 상태다. 빈 Orca setup hook을 기다리지 않는다. relay port는 worktree별 분리; Android relay host는 emulator의 `10.0.2.2`, host browser는 `127.0.0.1` 경계를 지킨다.
- M1 원 연구 묶음은 `$HOME/.cache/street-fitting/models` (`SF_MODELS_DIR`), hash/revision/자격 증명 로딩은 README를 따른다. 원 export script를 직접 실행하거나 기준 모델/출력을 덮어쓰지 않는다.
- 새 coordinator는 이 문서 → README/decisions → 담당 slice/contracts를 읽고 시작한다. 이미 모인 통합 브랜치에 같은 변경을 다시 cherry-pick하지 않는다. 개별 브랜치 재개라면 실제 merge base와 공유 선행 commit을 확인한다.
- 다음 순서: 공유 helper/owner 계약 정리 → S01 합격 gate → S02/S03 → 각 slice 실제 UI/native 실패 경로 → mock/live full E2E·16-call 품질·privacy·provenance·3분 데모. 체크포인트 보존은 어떤 gate도 면제하지 않는다.

## 보존한 로컬 경로와 종료 상태

- repo: `/Users/user/Desktop/Meta-Hackathon`; worktrees: `/Users/user/orca/workspaces/Meta-Hackathon/` 아래 위 표 이름. worktree/브랜치를 삭제하거나 reset하지 않았다.
- Git 외 fresh S05 입력/스크립트: `/tmp/sf-s05-proof`, `/tmp/sf-s05-prepare.py`. 원본 연구는 stable models 경로가 기준이다. 임시 proof를 다른 Mac에서 필요로 하면 재부팅 전에 별도 보존한다.
- 로컬 S06 재현 wrapper: `/tmp/s06-native-acceptance.sh`, `/tmp/s06-process-smoke.sh`. 공유 auth smoke 결과: `/tmp/sf-shared-native-smoke-result.json`. secrets 원문은 이동/출력하지 않는다.
- S11 original generated PNG 위치와 로컬 연구 복사 경로는 상세 S11 인계에 있다. dependencies/cache/연구 local-only 항목은 남겨 두었다.
- 종료 확인: Orca run `run_cf8c75b4d782`의 작업자 17개 terminal 모두 `released`; 각 transcript 보존. 이번 요청으로 중단된 worker outcome `failed`는 제품 합격 실패 판정이 아니라 user-stop checkpoint다.
- 소유 dev/relay/browser 세션 종료, emulator launchctl service bootout 완료. Gradle daemon 1개 `--stop`으로 종료. 최종 process inventory에서 QEMU/emulator/Vite/uvicorn/GradleDaemon 관련 실행 항목 없음. 사용자 Orca 앱/무관한 프로세스는 종료하지 않았다.
- 중단 이후 제품 build/test/추론/generation을 새로 실행하지 않았다. 이 핸드오프와 Git 보존/종료 확인만 수행했다. **실제 full E2E·품질 합격·데모 영상은 아직 없다.**
