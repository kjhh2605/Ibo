# Street Fitting PRD

상태: 인터뷰 R0~R10 반영. 화면 배치와 문구는 프로토타입 세션에서 확정한다.

구현 중단 체크포인트(2026-11-04): [두 Mac 재개 핸드오프](implementation-handoff-2026-11-04.md). **사용자 요청으로 추가 병합 없이 브랜치 보존 후 중단했다. S00 이후 코드는 미완료 WIP이며 전체 실행·합격 증거가 아니다.** 재개 시 브랜치별 상태·알려진 실패·로컬 산출물·기기 잠금 배치를 먼저 확인한다.

Street Fitting의 계층형 PRD 진입점이다. 구현 에이전트는 자기 슬라이스 문서 하나와 그 문서가 링크한 문서만 읽는다. 모든 규칙의 근거는 [decisions.md](decisions.md)의 결정 ID(`D-Rn-nn`)다. 문서끼리 충돌하면 결정 로그를 따른다.

UI 기준은 프로토타입(`prototype/`)이다. 흐름, 문구, 상태, 인터랙션은 고정하고, 시각 표현은 `app/`에서 Astryx로 근사한다([D-R1-03](decisions.md#r1-11월-4일-prd-형태와-아키텍처-경계)). 프로토타입에 아직 반영되지 않은 결정은 각 `ux/*.md` 끝의 "프로토타입 미반영" 표에 모았다.

## 읽는 순서

1. 이 문서에서 담당 슬라이스와 선행 조건을 확인한다.
2. `slices/S0n-*.md`를 읽는다.
3. 그 슬라이스가 링크한 `contracts/`, `ux/`, `product/` 문서만 읽고, 근거는 `decisions.md`에서 확인한다.
4. 계약 문서(`contracts/*`)를 바꿔야 한다면 직접 고치지 않는다. 완료 보고에 "계약 변경 요청"으로 적는다.

## 문서 지도

| 경로 | 내용 | 주 독자 |
| --- | --- | --- |
| [decisions.md](decisions.md) | 인터뷰 결정 로그(R0~R10) | 모두 |
| [product/scope.md](product/scope.md) | 목표, P0/P1/제외, 제품 규칙, 기능 한도, 제출 범위 | 모두 |
| [product/privacy.md](product/privacy.md) | 데이터 경계와 테스트로 확인할 불변식 | 모두 |
| [ux/navigation.md](ux/navigation.md) | 화면 구조, route, 공통 동작(F-17) | S08 |
| [ux/capture.md](ux/capture.md) | 쇼핑 모드, 촬영, 가게 구분, Trip(F-01~F-05) | S04, S08 |
| [ux/search.md](ux/search.md) | 에이전트 검색, 음성, 후보 선택(F-06~F-08) | S07, S08 |
| [ux/tryon.md](ux/tryon.md) | 저장한 옷, 옷장, 피팅, 결과, Privacy(F-09~F-14, F-16) | S08, S10 |
| [ux/walk.md](ux/walk.md) | 도보 길 안내(F-15) | S08, S09 |
| [screens/index.html](screens/index.html) | 화면 흐름 캡처, 프로토타입 기준 | 모두 |
| [contracts/relay-api.md](contracts/relay-api.md) | 릴레이 엔드포인트 7개, 인증, 질의 토큰, 오류, mock, OpenAPI | S00~S03, S07, S09, S10, S11 |
| [contracts/agent-tools.md](contracts/agent-tools.md) | 에이전트 루프, 도구 3개, 최종 응답, UI 단계 이벤트 | S02, S07 |
| [contracts/device-modules.md](contracts/device-modules.md) | Capacitor 플러그인 8개, JS 지도·경로 모듈, web mock | S00, S04~S10 |
| [contracts/data-model.md](contracts/data-model.md) | 엔티티, 저장 위치, 삭제 연쇄, 피팅 조합 규칙 | S06, S07, S10 |
| [slices/](slices/) | 슬라이스 S00~S11 | 각 구현 에이전트 |
| [verification/fixtures.md](verification/fixtures.md) | fixture 목록과 만드는 방법 | S11, 모든 슬라이스 |
| [verification/acceptance.md](verification/acceptance.md) | 슬라이스 합격 명령 요약, 통합 E2E, 불변식 검증 | S11, 통합 담당 |

## 슬라이스와 웨이브

공유 파일(의존성, 스키마, 플러그인 등록, Manifest, web mock 골격)은 S00이 먼저 만든다. 그다음 각 슬라이스는 자기 소유 경로만 고친다. 그래서 Orca worktree 여러 개가 동시에 작업해도 merge 충돌이 나지 않는다([D-R7-04](decisions.md#r7-11월-4일-구현-방식-작업-분할-검증)).

| 웨이브 | 슬라이스 | 시작 조건 |
| --- | --- | --- |
| 0 | [S00 bootstrap](slices/S00-bootstrap.md) | 아래 선행 조건 완료 |
| 1 | [S01 relay-core](slices/S01-relay-core.md), [S04 app-capture](slices/S04-app-capture.md), [S05 app-ml](slices/S05-app-ml.md), [S06 app-data](slices/S06-app-data.md), [S07 app-agent](slices/S07-app-agent.md), [S08 app-ui](slices/S08-app-ui.md), [S09 app-walk](slices/S09-app-walk.md), [S10 app-tryon](slices/S10-app-tryon.md), [S11 verification](slices/S11-verification.md)(fixture 단계) | S00 merge |
| 2 | [S02 relay-search](slices/S02-relay-search.md), [S03 relay-media](slices/S03-relay-media.md) | S01 merge |
| 통합 | S11(E2E 단계) | 모든 슬라이스 merge |

| 슬라이스 | contracts | ux | product |
| --- | --- | --- | --- |
| S00 | relay-api, device-modules, data-model | — | scope |
| S01 | relay-api(공통, 인증, 토큰, 오류, 로그, mock) | — | privacy |
| S02 | relay-api(§6.1–6.2), agent-tools | search | privacy |
| S03 | relay-api(§6.3–6.7) | — | privacy |
| S04 | device-modules(ShoppingSession, Capture, Media, Voice) | capture | privacy |
| S05 | device-modules(PhotoIndex, Segmenter, FaceMask) | tryon(마스킹) | privacy |
| S06 | data-model, device-modules(Store) | — | privacy |
| S07 | agent-tools, relay-api(검색, transcribe) | search | privacy |
| S08 | device-modules(web mock) | 전부 | scope |
| S09 | device-modules(지도·경로), relay-api(§6.7) | walk | privacy |
| S10 | data-model(피팅 규칙), device-modules(FaceMask), relay-api(§6.6) | tryon | privacy |
| S11 | 전부 | 전부 | 전부 |

## 선행 조건 (사용자 책임, D-R7-11)

슬라이스를 나눠 주기 전에 확인한다. 사용자가 별도 위임한 준비 작업의 이행 상태는 아래 준비 점검에 기록하며, 구현 슬라이스가 임의로 계정·키·모델을 대체하지 않는다.

| # | 할 일 | 막히는 것 | 근거 |
| --- | --- | --- | --- |
| 1 | `docs/prd/`, `AGENTS.md`, 프로토타입 변경을 커밋한다. Orca worktree는 git 브랜치에서 만들어진다 | 모든 worktree가 PRD를 볼 수 없음 | D-R7-11 |
| 2 | 제출 전에 GitHub 저장소를 public으로 바꾸고 문서와 코드를 push한다 | 제출 요건 | D-R8-01 |
| 3 | 모델·PE 텍스트 가중치·원 연구 자료를 기준 기기(M1)에 보존하고 `SF_MODELS_DIR`를 설정한다. **완료:** `~/.cache/street-fitting/models`; 배치 구조·hash·오프라인 검증은 아래 "모델 배치와 오프라인 검증" 참조 | S02, S05, 통합 | D-R7-11, D-R10-03 |
| 3a | 기준 기기에 아래 "기준 기기 준비"의 도구와 AVD를 만든다 | 모든 빌드·에뮬레이터 검증 | D-R10-03 |
| 4 | Orca repo setup 훅을 설정한다: `app`·`prototype` `npm ci`, `relay` `uv sync` | 새 worktree 의존성 설치 | D-R7-11 |
| 5 | Meta API 키를 넣는다(릴레이 환경 변수) | 실제 API 통합과 데모 녹화 | D-R1-04, D-R8-01 |
| 6 | 개발용 Firebase 프로젝트를 만든다: 익명 인증, App Check debug provider, `google-services.json`, debug 토큰 등록 | 실제 인증 검증(mock 단계는 무관) | D-R6-01, D-R7-07 |
| 7 | 비대화 모드(`codex exec`)에서 Codex 이미지 생성이 되는지 확인한다(S11 첫 단계) | 시연 fixture 이미지 | D-R7-06 |

## 기준 기기 준비 (M1 Mac mini 16 GB, D-R10-03)

개발과 검증은 M1 Mac mini 16 GB에서 한다. 아래는 그 기기에 갖춰야 할 요구 사항이다. 칩 종류에 기대는 값(부팅 시간, 추론 속도, GPU 이름)은 합격 기준으로 쓰지 않는다.

| 항목 | 요구 | 비고 |
| --- | --- | --- |
| Android SDK | `platform-tools`, `emulator`, `platforms;android-36`, `system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a` | `ANDROID_HOME`을 설정하면 gitignore된 `local.properties` 없이도 Gradle이 SDK를 찾는다. 시스템 이미지: 2026-11-04 기준 stable 목록(`sdkmanager --list`)에는 이 패키지의 **revision 8**이 있다. PRD 작성 기기에 깔린 것은 pre-release **revision 4**라서 둘의 동작 차이는 미확인이다. 이 패키지를 받을 수 없으면 `system-images;android-36;google_apis_playstore_ps16k;arm64-v8a`(stable revision 7)을 쓴다. 어느 쪽이든 `getconf PAGE_SIZE`가 `16384`이면 된다 |
| AVD | `avdmanager create avd -n Medium_Phone -k "<위 시스템 이미지>" -d medium_phone` 후 `hw.ramSize=2048`, `disk.dataPartition.size=6G` | PRD 작성 기기의 AVD 설정과 같은 값이다. 16 KB 페이지 이미지라 `adb shell getconf PAGE_SIZE`가 `16384`여야 한다. 쓴 이미지와 revision은 S00 완료 보고에 적는다 |
| Java / Node / Python | Java 21, Node ≥ 22.13, uv. 릴레이 Python 버전은 `relay/.python-version`으로 고정해 uv가 받는다(S00) | 기기에 깔린 Python 버전에 기대지 않는다 |
| 기타 | ffmpeg(데모 mp4 변환), `/usr/bin/lockf`(macOS 기본, 에뮬레이터 잠금), macOS `say`(음성 fixture) | Codex(시연 이미지), Orca(작업 분배)는 쓰는 경우에만 설치 |
| 에뮬레이터 GPU | 지도(MapLibre WebGL) 검증과 데모 녹화는 `-gpu host`로 띄운다. 화면 없는 테스트도 `-no-window -gpu host`로 돌릴 수 있다. 시작 직후 앱 WebView에서 WebGL을 얻을 수 있는지 자동 확인한다(S11) | `-gpu host`는 M4에서만 확인했다(WebGL2, 하드웨어 렌더러). M1에서는 **미확인**이며, S00이 처음 확인한다. 소프트웨어 렌더러(`swiftshader_indirect`)로 떨어지면 지도 성능과 데모 품질은 미확인으로 보고한다 |

## 실행 환경 제약

- 에뮬레이터는 기준 기기(M1, RAM 16 GB)의 AVD `Medium_Phone` 한 대다. 에뮬레이터를 쓰는 검증은 `scripts/emulator-lock.sh`로 한 번에 한 작업자만 실행한다.
- 검증 도구는 Orca 없이 맥에서 돈다(D-R10-01). 앱 WebView는 Playwright-Android(`_android.webView`)로, 시스템 UI(권한, 알림 카드)는 `adb shell uiautomator dump`·`input tap`·`cmd statusbar expand-notifications`로 조작한다. GPS는 `adb emu geo fix`, 카메라와 음성은 debug fixture(D-R7-10), 데모 녹화는 `adb emu screenrecord`(한 번에 최대 180초, 구간별로 녹화해 ffmpeg로 이어 붙임)로 한다. Orca는 작업 분배에만 쓴다. 이 도구 조합은 M4 작업 기기에서 확인했고 M1에서는 S00·S11이 다시 확인한다(D-R10-03).
- 실행 증거(리포트, 스크린샷, 개인정보 없는 수치)는 `verification/results/<run-id>/`에 커밋해 git으로 구현을 증명한다(D-R10-02).
- 릴레이는 로컬 Mac에서만 돌린다. worktree마다 다른 `RELAY_PORT`를 쓰고, 에뮬레이터에서는 `10.0.2.2`로 접속한다(D-R6-05).

## Goal 실행 준비와 워크트리 초기화

2026-11-04 준비 점검 이후 S00 bootstrap을 구현했다. 아래 준비 점검 기록은 당시 관찰이며, 현재 S00 실행 결과는 별도 증거와 구분한다.

- 현재 OMP의 `goal.enabled=true`, `goal.continuationModes=["interactive"]`다. 터미널의 `/goal` 또는 `omp --goal "<목표>"`를 사용한다. RPC/chat에서 자동 지속을 원하면 해당 실행 모드 지원과 설정을 따로 확인한다. Goal은 API 권한·모델 파일을 대신 제공하지 않는다.
- Orca 새 워크트리의 기준은 `origin/main`이다. S00 merge → 웨이브 1 → S01 merge 후 S02/S03 → 통합 순서를 따른다. 구현 워크트리마다 담당 슬라이스와 소유 경로를 명시하고, 검증한 PR만 통합 담당이 순차 merge한다.
- repo setup 명령은 `bash scripts/setup-worktree.sh`다. 이 스크립트는 `app`·`prototype`의 lockfile로 설치하고, 호스트의 `google-services.json`이 있으면 gitignored Android 경로에 권한 0600으로 복사한다. `relay/pyproject.toml`이 생긴 뒤에는 `uv sync --locked`도 실행한다. 릴레이가 없으면 그 사실을 출력하며 준비 완료로 위장하지 않는다.
- 포트는 `~/.cache/street-fitting/ports.json`의 호스트 공통 잠금으로 워크트리마다 배정하고 `.sf-worktree.env`에 기록한다. 이는 프로세스 소켓 예약이 아니므로 실제 시작 시 포트 충돌을 오류로 처리해야 한다. 각 작업자 셸은 저장소 루트에서 `source scripts/worktree-env.sh`로 환경을 읽는다.
- 호스트 도구 설정은 `~/.config/street-fitting/env.sh`, 자격 증명 로더는 같은 디렉터리의 `secrets.env`(권한 0600)에 둔다. Meta 키(`meta-api-key`), Firebase Admin 키(`firebase-admin.json`), Android 설정(`google-services.json`)도 저장소 밖에 보관한다. 키를 repo setup 명령이나 에이전트 프롬프트에 넣지 않는다. `RELAY_MODE`는 자동 지정하지 않는다.
- `.github/workflows/validate.yml`은 PR의 앱 lint/build/Astryx doctor와 프로토타입 build만 검사한다. Android·모델·live E2E를 통과했다는 뜻이 아니며, 해당 증거는 각 슬라이스와 S11이 제공한다. 저장소는 공개 전환하지 않았다.
- Orca setup 훅의 UI 등록은 별도 확인 대상이다. CLI의 `--setup run`은 등록된 훅을 실행할 뿐 설정하지 않는다. 훅이 비어 있는 동안에는 조정자가 각 워크트리에서 위 초기화 명령을 완료한 뒤 작업자를 시작한다.

### S00 구현·실행 결과 (2026-11-04, M1)

- 공유 DTO/OpenAPI/TS 생성, 7개 명시적 501 경로, 8개 native/web 플러그인 등록, Firebase 인증 adapter, 모델 패키징과 실행 잠금을 구현했다. 아직 `App.tsx`는 빈 shell이며 제품 기능은 S01~S11 소유다.
- Orca 후속 작업자는 `--agent omp`로 실행한다. 에이전트 harness와 그 안의 모델 이름은 별개다. 초기 Codex 작업자는 종료했으며, OMP 작업자가 경계 수정과 실제 Android 검증을 수행했다.
- [S00 실행 증거](../../verification/results/2026-11-04-s00-bootstrap/README.md)에 테스트·실행·실패 수정·남은 검증을 기록했다. 16 KB APK 패키징/정렬과 실제 ONNX 추론 합격은 구분한다.
- Capacitor의 기본 debug 응답 로그가 인증 토큰을 출력하는 것을 실제로 확인하여 `loggingBehavior: 'none'`으로 껐다. 이후 native 인증 재실행에서 ID/App Check/debug 토큰 로그 일치가 0개였다. 이후에도 미디어·좌표를 포함하는 브리지 로그를 다시 켜지 않는다.
- Firebase App Check debug secret은 로그인된 Aside로 `M1 Medium_Phone S00` 이름으로 등록했다. Android에서 받은 ID/App Check 토큰을 Firebase Admin으로 각각 검증했으며, 이는 S01의 relay 인증 middleware 검증을 대신하지 않는다.
- 계측 검증이나 앱 데이터 초기화 뒤에는 기존 등록 secret을 복원한다: 저장소 루트에서 `source scripts/worktree-env.sh && bash scripts/restore-app-check-debug.sh`. 이 명령은 전역 기기 잠금과 debug `run-as` 확인을 거친다. `~/.config/street-fitting/app-check-debug-token`은 권한 0600으로 유지하며 argv·로그·Git에 넣지 않는다. 재설치마다 새 토큰을 등록하지 않는다.
- 릴레이 CORS는 Capacitor/local web의 localhost·loopback origin만 허용하고 `X-Query-Token`을 노출한다. debug Android의 평문 HTTP는 10.0.2.2·localhost·loopback 호스트만 허용하며 release는 평문을 금지한다.

### 웨이브 1 공유 전송·인증 연결 (2026-11-04, M1)

- 공유 relay client의 `beforeSend`는 인증·JSON 직렬화 성공 뒤, 실제 HTTP 직전에 실행된다. 큐 소유권 확인 실패나 취소는 전송하지 않으며, 인증 실패는 큐 시도를 소비하지 않는다.
- `forceRefreshAuth`는 native Firebase ID/App Check 양쪽 강제 갱신에 연결된다. `RelayError.retryAfterMs`는 유효한 `Retry-After` 초/HTTP-date를 전달하며 client 자체 재시도는 하지 않는다.
- [실행 증거](../../verification/results/2026-11-04-wave1-shared/README.md): 앱 테스트 47개, lint/build/doctor, 실제 TCP HTTP 전송·취소·429 경계, Android 빌드와 실제 WebView의 강제 인증 갱신을 확인했다. 새 ID 토큰 발급 시각 증가, Firebase ID/App Check 토큰 각각 2개 검증, 토큰 로그 일치 0개였다.
- `@capacitor/filesystem` 8.1.5와 UIAutomator 2.3.0 의존성을 연결했다. 관리 파일 소유권·Blob 저장소·제품 화면과 전체 E2E 합격은 이 공유 변경의 증거가 아니며 S04~S11의 별도 검증 대상이다.

### 준비 점검 실측 (2026-11-04, M1)

제품 구현 검증과 구분한다. 다음은 현재 빈 앱 shell과 개발 도구에 대한 관찰이다.

| 항목 | 실제 확인 |
| --- | --- |
| GitHub | 관리자 권한·push 인증, 준비 PR #1 CI 2개 통과 및 squash merge. 저장소는 private 유지 |
| 워크트리 | Orca 생성 성공. 준비용 checkout과 main에 서로 다른 `RELAY_PORT` 8787/8788 배정. 비밀 로딩 전 xtrace 해제 확인 |
| 도구 | Node 26.8.2, npm 11.19.1, Java 21.0.13, uv 0.13.6, Python 3.12.16 설치. 릴레이 버전 고정은 S00 소유 |
| Android | SDK Platform 36 r2, Build Tools 35.0.0, platform-tools 37.0.1, emulator 37.2.13. API 37.0 Play Store 16 KB ARM64 이미지 r8, `Medium_Phone` |
| 네이티브 실행 | `assembleDebug`·설치·시작 통과. `PAGE_SIZE=16384`, Playwright-Android WebView와 host WebGL 확인. GPS 주입·UI dump·3초 webm 녹화 및 H.264/AAC mp4 변환 확인 |
| 에뮬레이터 RAM | 설정은 2048 MB/데이터 6 GB. 현재 emulator는 부팅 때 RAM을 4096 MB로 상향하므로 2 GB 실행으로 보고하지 않음 |
| 합성 자산 도구 | `codex exec` built-in 생성으로 PNG 실제 저장. `say`→PCM16/16 kHz/mono WAV 생성 확인. S11 fixture 제작은 아직 안 함 |
| Meta | 개발 전용 키 저장. 인증된 `GET /v1/models` 200과 Spark 1.3/SAM 3.1/Image 1.0/Voice 1.0 모두 확인. 콘솔 무료 크레딧 $149.99. 추론·피팅 품질은 미검증 |
| Firebase | 무료 Spark 프로젝트 `street-fitting-dev`, Android 등록·Anonymous 활성화. 실제 익명 로그인 200, 테스트 사용자 삭제 200. Admin 자격 증명으로 프로젝트 조회 200 |
| 지도 | OpenFreeMap style과 OSRM foot 합성 좌표 경로 요청 HTTP 200. 실제 앱 지도·길 안내 기능의 합격 증거는 아님 |
| Aside | 로그인된 콘솔 조작·개발 자격 증명 저장·로컬 프로토타입 클릭 검증 성공. 키 값은 대화·Git에 넣지 않음 |

### 모델 배치와 오프라인 검증

2026-11-04 사용자가 MacBook Air의 원본 묶음을 이 M1의 `/tmp/edgetam-poc`로 전송했다. 원본 Mac과 ONNX 3종의 SHA-256 일치는 사용자 확인이며, 준비 작업에서는 **전송본과 새 안정 배치본**을 비교했다.

- 안정 경로: `SF_MODELS_DIR=$HOME/.cache/street-fitting/models`. 호스트 `env.sh`에 설정했고 `source scripts/worktree-env.sh`에서 모델 3개가 읽히는 것을 확인했다.
- 원 묶음의 일반 파일 **697개 / 883,092,888 bytes**를 SHA-256으로 대조해 불일치 0개. 기존 상대 심볼릭 링크 6개도 대상 문자열·실제 해석 경로가 일치하며 모두 안정 디렉터리 안에서 해석된다.
- 루트의 `edgetam_encoder.onnx`, `edgetam_decoder.onnx`, `pe_image.onnx`는 각각 `artifacts/`의 원 파일을 가리키는 상대 링크다. `hf_cache/`, `perception_models/`, `EdgeTAM/`, `images/`, `retrieval_r4/`, 원 export 코드·기준 출력도 함께 보존했다. `.venv`는 복사하지 않았고 ONNX를 재-export하지 않았다.
- 원 스크립트·manifest의 `/tmp/edgetam-poc` 문자열은 출처 보존을 위해 수정하지 않았다. **원 `run_*.py`를 그대로 실행하면 임시 경로를 사용하고 기준 출력을 덮어쓰므로 실행하지 않는다.** 소비자는 그 prefix를 `SF_MODELS_DIR`로 해석해 읽고 검증 결과는 별도 경로에 쓴다.
- PE 코드·토크나이저·설정: `$SF_MODELS_DIR/perception_models/core/vision_encoder/`. HF checkpoint: `$SF_MODELS_DIR/hf_cache/hub/models--facebook--PE-Core-T16-384/snapshots/8b4722741a516c18e7d311f158f13c600fea6c78/PE-Core-T16-384.pt`. 로더는 `HF_HOME=$SF_MODELS_DIR/hf_cache`, `HF_HUB_OFFLINE=1`, `local_files_only=True`로 캐시를 해석하고 CPU/eval로 strict state-dict 로딩했다. 네트워크 연결 차단 아래 연결 시도 0회였다.
- 연구 저장소 revision: EdgeTAM `7711e012a30a2402c4eaab637bdb00a521302c91`, perception_models `3e352cca660658d4b5c90f42a7808b11469e4c66`.
- 별도 호스트 검증 환경: `~/.cache/street-fitting/model-validation-venv`의 Python 3.12.16, torch 2.15.0, torchvision 0.29.2, ONNX Runtime 1.31.1, NumPy 2.1.2, Pillow 11.0.0, timm 1.0.15, einops 0.8.1. 전체 설치 버전은 아래 환경 manifest에 있다. 이는 S00의 relay lockfile을 대체하지 않는다.

| ONNX | bytes | SHA-256 |
| --- | --- | --- |
| `edgetam_encoder.onnx` | 19,753,637 | `b13dd3cc3a60996e9f2a1ef55cdc3b9e70366706bd108d65ed6ea615543c918e` |
| `edgetam_decoder.onnx` | 16,421,792 | `ceaa17668b6bd70fb7d1d79f8b78274d71101696e16ba31eef7ee5d8fef16978` |
| `pe_image.onnx` | 31,994,387 | `10b2683490922a82a61ee108673fc94ea455c6ad3996b1f2dc86f93a935d114c` |

**M1 CPU 실행 결과:** ONNX 3종 로딩·실제 추론·계약 shape·유한수 확인. 보존된 encoder 입력→decoder의 저해상도 mask 3개는 기준 이진 mask와 각각 IoU=1.0(logit max abs 1.1826e-4, score max abs 6.8546e-7). PE 기준 binary 입력의 출력 max abs는 9.9652e-7. PE tokenizer·텍스트 타워는 7×512 유한 벡터와 L2 norm 최대 오차 5.9605e-8을 확인했다.

원 연구의 **동일 22장**을 PE ONNX로 다시 임베딩하고 **동일 7문구**를 실제 텍스트 타워로 인코딩했다. top-3 7/7, top-1 6/7이며 각 문구의 top-3 순서도 기존 결과와 일치했다. 이미지 벡터는 보존된 연구 벡터 대비 max abs 1.81795e-6, 최소 cosine 0.99999994였다.

호스트 증거는 `~/.cache/street-fitting/model-bundle-manifest.json`(697개 파일 hash·기존 링크·모델 hash), `model-smoke-results.json`(shape·오차·검색 결과), `model-validation-environment.json`(의존성·revision)에 보관한다. 원 묶음·가중치·자격 증명을 Git에 넣지 않는다. **이는 Android 앱의 16 KB ORT AAR·모델 패키징·두 원본 사진의 mask PNG·FaceMask 안전성·live E2E 합격을 대신하지 않는다.** 해당 검사는 S00/S02/S05/S11에서 수행한다.

**남은 선행 조건과 주의**

1. App Check debug 등록과 Android 토큰 검증은 S00에서 완료했다(위 실행 결과). S01 relay의 인증 거부/허용 경로와 S11 전체 live E2E는 별도 합격 조건이다.
2. Orca repo setup 훅은 아직 비어 있다. CLI에 훅 설정 명령이 없고, Orca Computer Use의 Accessibility/Screen Recording 권한이 없어 UI 설정은 수행하지 못했다. 자동 UI 등록을 원하면 OS 권한이 필요하다. 그 전에도 조정자가 setup 스크립트를 명시 실행하는 방식으로 초기화를 자동화할 수 있다.
3. provider 기본 Playground의 Contributor 선택이나 무료 크레딧 안내를 무보관 보장으로 해석하지 않는다. 구현은 계약의 Standard model ID와 저장 억제 옵션을 유지한다. 무료 크레딧 소진 시 기존 결제수단으로 과금될 수 있고 spend limit은 알림이지 하드 차단이 아니다.
