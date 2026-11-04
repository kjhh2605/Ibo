# S00 bootstrap

상태: 확정(R10까지) · 웨이브 0 · 선행 조건: 공유 계약 4개 확정, 아래 사용자 준비, [기준 기기 준비](../README.md#기준-기기-준비-m1-mac-mini-16-gb-d-r10-03)(M1 Mac mini 16 GB) 완료

## 목표

병렬 구현자가 공유 설정을 동시에 수정하지 않도록 계약 타입·라우트 시그니처·플러그인 등록·검증 실행 기반을 먼저 만든다. 제품 기능은 구현하지 않으며, 네이티브 미구현을 성공으로 위장하지 않고 web mock만으로 앱을 열 수 있게 한다.

**가장 먼저 사용자 선행 조건을 확인한다.** 아래는 사용자 수행 또는 별도 지시 대상이며 이 슬라이스가 임의로 커밋·복사·계정 생성·키 발급·Orca 설정을 대행하지 않는다(D-R7-11, D-R6-01, D-R7-07).

| 확인할 준비 | 완료 증거와 미완료 처리 |
|---|---|
| 기준 커밋 | 사용자가 PRD/기존 앱을 기준 브랜치에 커밋했는지 확인. 미커밋 변경을 대신 커밋하지 않음 |
| 모델 안정 경로 복사 | 사용자 위임 준비로 원 묶음과 ONNX 3개·PE 가중치·토크나이저·설정이 `SF_MODELS_DIR=$HOME/.cache/street-fitting/models`에 배치됐다. [준비 기록](../README.md#모델-배치와-오프라인-검증)의 hash/revision/전처리 출처를 사용한다. 임시 경로를 기본값으로 고정하지 않으며 호스트 검증을 앱 패키징·16 KB 추론 합격으로 대체하지 않음 |
| Orca setup 훅 | 사용자 설정이 worktree마다 의존성·비밀 환경을 준비하고 서로 다른 `RELAY_PORT`를 제공하는지 확인. 설정 변경은 하지 않음 |
| Meta API 키 | 사용자가 서버 전용 `MODEL_API_KEY`를 저장소 밖에 준비. 값은 출력/앱 번들/fixture에 넣지 않음 |
| Firebase dev 프로젝트 | 개발 프로젝트·Android app 등록, 익명 인증, App Check debug provider와 Admin 자격 증명이 준비됐는지 확인. 비밀은 저장소 밖. 앱에는 dev 표시 없음 |

이 준비 목록의 키/Firebase 부분은 인증 의존성을 포함한 실행 선행 조건이다. D-R7-11 원문의 직접 열거는 커밋·모델 복사·setup 훅이며, 키/프로젝트의 제품 근거는 D-R6-01·D-R7-07이다. 미완료 항목은 정확히 보고하고 해당 검증을 통과했다고 쓰지 않는다.

## 읽을 문서

이 목록만 읽는다. 계약 세부가 필요한 경우 아래 링크의 지정 절을 원본으로 사용한다.

- [결정 로그](../decisions.md): R0~R9 전부.
- [제품 범위](../product/scope.md): 전제·구현/검증·배포 선행 조건; [개인정보](../product/privacy.md): 데이터 경계·불변식.
- [relay-api](../contracts/relay-api.md): §1~9 전부(특히 §8 code-first).
- [agent-tools](../contracts/agent-tools.md): §1~4, §8의 wire 스키마·fixture 규칙.
- [device-modules](../contracts/device-modules.md): §1~12의 인터페이스·권한·등록·모델 배포.
- [data-model](../contracts/data-model.md): §1~7, R9 Result 스냅샷 및 labelMode 포함.
- [앱 규칙](../../../app/AGENTS.md): Astryx 설정과 doctor. [navigation UX](../ux/navigation.md): 앱 진입 기능 상태만; 화면 추가 설계는 하지 않음.

## 소유 경로

- 공유 골격 소유: `relay/pyproject.toml`, `relay/uv.lock`, `relay/app/{__init__,main,schemas}.py`, `relay/app/routes/__init__.py`, `relay/tests/bootstrap/**`, `relay/tests/conftest.py`, `relay/openapi.json`, `relay/scripts/export_openapi.py`.
- 앱 공유 설정: `app/package.json`, lockfile, TS/Vite/Vitest 설정, `app/src/generated/relay-api.d.ts`, `app/src/native/contracts.ts`, `app/src/native/web/**`의 공통 fixture/주입 골격, `app/src/relay/**`, 앱 환경 설정·인증 adapter·feature flag 연결, `app/src/main.tsx`의 초기 연결.
- Android 공유 설정: Gradle 파일·의존성, `app/android/app/src/main/java/com/streetfitting/app/MainActivity.java`, source-set별 Manifest·보안/backup XML·공유 리소스. 플러그인 클래스 등록과 서비스 선언용 최소 클래스 포함.
- 실행 기반: `scripts/{emulator-lock,gpx-replay,push-fixtures,relay-dev}.sh` 및 계약/네이티브 테스트 실행에 필요한 공유 설정.
- **웨이브 0에서만 초기 파일 생성 후 소유권을 넘김:** `relay/app/routes/search*.py`→S02, `{transcribe,describe,tryon,route}.py`→S03; 8개 native 플러그인의 빈 클래스와 각 TS 등록 파일→S04/S05/S06. S00 merge 이후 해당 구현 파일은 각 슬라이스만 수정한다. 이것은 병렬 공동 소유가 아니다.
- 고치지 않음: `docs/prd/contracts/**`, 제품/UX 문서, `prototype/**`, 기능 화면(`App.tsx` 포함 S08), S01 공통 기능 구현, S11 `verification/**`·`scripts/e2e/**`. 공유 계약 변경 필요 시 통합 담당에게 보고한다.

## 구현 항목

1. **code-first 계약 전부를 먼저 정의한다.** `schemas.py`에 7개 경로와 모든 도구 arguments/result·오류의 Pydantic 타입, 추가 필드 금지와 교차 필드 제약을 정의한다. `main.py`는 `routes/*.py` 자동 등록과 dependency injection을 제공한다. 각 라우트는 실제 request/response signature를 가지되 유효한 입력에 명시적 501 스텁을 반환한다. S01~03이 schema를 다시 만들지 않는다. `openapi.yaml`, `datamodel-code-generator`, 수기 `relay/types.ts`는 만들지 않는다. 근거: D-R7-02, D-R7-04; [relay §8](../contracts/relay-api.md#8-openapi-원본과-타입-생성).
2. **결정적 생성 명령을 고정한다.** `(cd relay && uv run python scripts/export_openapi.py --output openapi.json)`은 시간·임의 ID 없는 정렬 JSON을 내보내고, `(cd app && npx openapi-typescript ../relay/openapi.json -o src/generated/relay-api.d.ts)`로 TS를 생성한다. export는 키·모델·live 네트워크 없이 동작하는 schema-only app factory를 사용한다. 응답 union도 빠짐없이 OpenAPI에 노출한다. 근거: D-R7-02; [relay §8](../contracts/relay-api.md#8-openapi-원본과-타입-생성).
3. **의존성과 테스트 기반을 한 번 설치한다.** uv/FastAPI/Pydantic/pytest·HTTP mock·Firebase Admin·PE CPU 로더에 필요한 의존성, 앱 Vitest·openapi-typescript·Firebase 익명 인증/App Check·Geolocation·MapLibre, CameraX/FusedLocation/ExifInterface/ONNX Runtime·Android instrumentation을 공유 설정에 준비한다. 릴레이 Python은 기준 기기에 깔린 버전에 기대지 않고 `relay/.python-version`으로 고정해 uv가 받게 한다. PE 의존성(torch 등) wheel이 macOS arm64용으로 있는 버전을 고르고 보고한다. 기능 구현자가 설정을 각자 바꾸지 않게 한다. 근거: D-R6-01, D-R7-02~04, D-R10-03; [device §1·12](../contracts/device-modules.md#1-공통-경계).
4. **8개 플러그인과 공유 경계를 등록한다.** `ShoppingSession`, `Capture`, `PhotoIndex`, `Segmenter`, `FaceMask`, `Media`, `Voice`, `Store`를 정확한 이름으로 Java 빈 클래스·TS registerPlugin에 등록한다. Manifest의 location FGS·camera·audio·notification·deep link·INTERNET·backup 제외를 준비하되 background location/광역 갤러리 권한은 넣지 않는다. `contracts.ts`에는 R9 Store snapshot/labelMode 등 최종 인터페이스와 native 내부 repository 계약을 고정한다. 미구현 native 호출은 명시 오류다. 근거: D-R0-02, D-R7-03~04, D-R9-01~03; [device §1~9](../contracts/device-modules.md#1-공통-경계), [data §1·5](../contracts/data-model.md#1-공통-타입과-저장-원칙).
5. **web mock·relay 연결 골격을 만든다.** 동일 인터페이스의 web 등록과 fixture/clock/권한/failure 주입 지점을 만들고, Store 영속 mock의 실제 동작은 S06으로 넘긴다. 초기 화면 import가 native나 실제 네트워크를 강제하지 않게 한다. `relay/client.ts`는 생성 타입, 인증 2개 헤더, 안전한 오류, `X-Query-Token` 수신, 취소 신호, configurable base URL을 처리한다. debug 기본은 `http://10.0.2.2:8787`, web은 로컬 릴레이 또는 명시 mock transport를 선택한다. mock은 테스트 설정으로만 선택하고 dev 배지는 없다. `resultDownload=false`. 근거: D-R1-04, D-R4-10, D-R6-01, D-R7-07; [relay §1~2·5](../contracts/relay-api.md#1-경계와-공통-전송-규칙), [device §1](../contracts/device-modules.md#1-공통-경계).
6. **모델 패키징과 공용 실행 스크립트를 고정한다.** `SF_MODELS_DIR`를 Gradle property→환경→기본 경로 순으로 읽어 ONNX 3개를 generated assets에 넣고 누락은 build 실패, `noCompress 'onnx'`를 적용한다. `emulator-lock.sh <command> [args...]`는 모든 worktree가 같은 호스트 lock 파일(예: `~/.cache/street-fitting/emulator.lock`)을 macOS 기본 `/usr/bin/lockf -k`로 잠그며 자식 종료까지 유지한다. macOS 기본 설치에는 `flock`이 없으므로 쓰지 않는다. 잠금 도구가 없으면 실패해야 하며 조용히 잠금 없이 실행하지 않는다. `gpx-replay.sh <gpx-file>`은 `adb emu geo fix`를 사용하고, `push-fixtures.sh capture|voice <dir>`은 debug 캡처 폴더(`capture-fixtures/`)나 음성 폴더(`voice-fixtures/`, [device §8](../contracts/device-modules.md#8-voice--s04))에만 넣는다. `relay-dev.sh`는 worktree의 `RELAY_PORT`를 서버 `PORT`로 전달해 단일 worker로 실행한다. 근거: D-R1-04, D-R6-05, D-R7-03, D-R7-10~11; [device §3·8·12](../contracts/device-modules.md#12-모델-배포android-16-kb-선행-조건), [relay §2](../contracts/relay-api.md#2-인증과-환경).

## mock 경계와 의존

S00에서는 실제 Meta·OSRM·기기 기능을 호출하지 않는다. 501은 이 슬라이스에만 허용하는 의도된 스텁이며 S01~03 완료 후 정상 기능의 대안이 아니다. S01 공통 모듈은 웨이브 1, S02/S03은 S01 merge 뒤 웨이브 2다. S04~S10은 S00 계약과 mock으로 병렬 작업하고 S11이 모두 merge된 후 실제 연결을 확인한다. S11 승인 fixture가 아직 없으면 테스트의 합성 최소 데이터만 자기 테스트 경로에 두며 `verification/`을 대신 수정하지 않는다.

## 합격 기준

아래는 **구현자가 실행할 명령**이며 이 문서 작성 중 실행한 결과가 아니다. `app/package.json`의 기존 lint/build와 Astryx 규칙을 유지한다. 기준 기기는 M1 Mac mini 16 GB이고 도구·AVD는 [기준 기기 준비](../README.md#기준-기기-준비-m1-mac-mini-16-gb-d-r10-03)를 따른다. 칩에 기대는 값(부팅 시간, GPU 이름)을 합격 조건으로 쓰지 않는다(D-R10-03).

| 명령(저장소 루트 기준) | 기대 결과 |
|---|---|
| `(cd relay && uv run pytest)` | `test_all_seven_routes_have_501_stubs`, `test_stub_errors_follow_schema`, `test_unknown_fields_rejected`, `test_no_network_during_schema_export` 통과. 501을 정상 200으로 위장하지 않음 |
| `(cd relay && uv run python scripts/export_openapi.py --output /tmp/sf-openapi-a.json && uv run python scripts/export_openapi.py --output /tmp/sf-openapi-b.json)` 및 `diff -u /tmp/sf-openapi-a.json /tmp/sf-openapi-b.json` | 종료 0, 차이 없음. checked-in openapi.json과 같은 내용 |
| `(cd app && npx openapi-typescript ../relay/openapi.json -o /tmp/sf-relay-api.d.ts)` 및 `diff -u app/src/generated/relay-api.d.ts /tmp/sf-relay-api.d.ts` | 생성 타입 차이 없음 |
| `(cd app && npm run lint && npm run build && npx astryx doctor --built dist)` | 모두 종료 0 |
| `(cd app/android && ./gradlew assembleDebug)` | 모델 포함·플러그인 8개 등록·Manifest가 컴파일됨. missing model을 성공으로 건너뛰지 않음 |
| `(cd app && npx vitest run src/relay src/native/web)` | `noRawSelfPhotoUpload`, `authHeadersAttached`, `noSecretsInLogs`, `mockDoesNotUseNetwork`, `eightPluginsResolveOnWeb` 통과 |
| `(cd app && VITE_SF_RUNTIME=web-mock npm run dev -- --host 127.0.0.1 --port 5173)` | 초기 앱이 열리고 8개 web 등록/공유 fixture 주입 가능. 실제 Android/마이크/Meta 없이 렌더링, dev 배지 없음. 이 환경 변수와 mock 선택을 S00이 제공함 |
| `scripts/emulator-lock.sh adb shell getconf PAGE_SIZE` | 사용 중 AVD에서 `16384`. 기기를 쓰는 후속 명령은 모두 같은 lock으로 감쌈 |
| `scripts/emulator-lock.sh bash -lc 'adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk && adb shell am start -n com.streetfitting.app/.MainActivity'` 후 S11의 WebGL 확인 스크립트(또는 같은 내용의 일회성 Playwright-Android 스크립트) | 기준 기기의 `-gpu host` 에뮬레이터에서 앱 WebView가 `webgl` 또는 `webgl2` 컨텍스트를 얻는다. 렌더러 문자열은 기록만 하고 특정 GPU 이름을 기대하지 않는다. 얻지 못하면 실패가 아니라 "지도 검증 불가"로 보고한다(D-R10-03) |

## 완료 보고 형식

- 바꾼 파일: 공유 파일과 웨이브 1/2로 넘길 초기 파일을 구분.
- 실행한 명령과 결과: 위 명령별 종료 상태·schema diff 여부·빌드/doctor·web 기동 증거. 비밀/이미지/좌표 본문은 첨부하지 않음.
- 미확인·위험: 사용자 준비 누락, 의존성/16 KB/PE Python 호환, 실제 API 미실행.
- 계약 변경 요청: 파일·절·요청 이유와 영향 슬라이스. 기능 구현자가 공유 파일을 중복 수정하게 넘기지 않음.

## 미확인·위험

- code-first가 확정이다. 이전 작업 메모의 YAML-first와 충돌하면 이 문서와 relay §8을 따른다.
- 실제 API 모델 ID/전용 API 옵션, PE 의존성의 Python 버전 호환, ORT AAR 16 KB 정렬은 설치/실측 전 미확인이다. 지원 불가를 다른 모델로 우회하지 않는다.
- 기준 기기(M1, 16 GB)에 AVD는 한 대다. build 작업과 기기 잠금은 구별하되 기기를 쓰는 모든 테스트는 전역 lock을 사용한다.
- `-gpu host` 에뮬레이터에서 WebView WebGL이 되는지는 M4에서만 확인했다. S00은 기준 기기에서 `emulator -avd Medium_Phone -no-window -gpu host`로 띄워 앱 WebView의 WebGL 가용 여부를 처음 확인하고 결과를 보고한다. 안 되면 소프트웨어 렌더러로 테스트를 계속하되 지도 성능과 데모 품질은 미확인으로 남긴다(D-R10-03).
- Codex의 image_generation은 PRD 작성 기기(codex 0.166)에서 stable로 켜져 있었다. 기준 기기의 설치 버전과 비대화 저장 방식은 미확인이다. S00은 시연 이미지를 생성하지 않으며 S11 범위를 침범하지 않는다.
