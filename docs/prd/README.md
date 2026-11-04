# Street Fitting PRD

상태: 인터뷰 R0~R10 반영. 화면 배치와 문구는 프로토타입 세션에서 확정한다.

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

## 선행 조건 (사용자가 직접 처리, D-R7-11)

슬라이스를 나눠 주기 전에 끝내야 한다. 에이전트가 대신 하지 않는다.

| # | 할 일 | 막히는 것 | 근거 |
| --- | --- | --- | --- |
| 1 | `docs/prd/`, `AGENTS.md`, 프로토타입 변경을 커밋한다. Orca worktree는 git 브랜치에서 만들어진다 | 모든 worktree가 PRD를 볼 수 없음 | D-R7-11 |
| 2 | 제출 전에 GitHub 저장소를 public으로 바꾸고 문서와 코드를 push한다 | 제출 요건 | D-R8-01 |
| 3 | 모델 파일을 기준 기기(M1)로 옮기고 `SF_MODELS_DIR`를 설정한다. 지금은 PRD 작성 기기(M4)의 `/tmp/edgetam-poc`에만 있다. 대상은 `edgetam_encoder.onnx`, `edgetam_decoder.onnx`, `pe_image.onnx`와 PE 텍스트 타워 가중치(`hf_cache`)다. 22장·7문구 검색 실험 자료(`/tmp/edgetam-poc/images`, `retrieval_r4`, `run_*.py`)도 S02·S05 호환 검사에 쓰므로 함께 옮긴다 | S02, S05, 통합 | D-R7-11, D-R10-03 |
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
