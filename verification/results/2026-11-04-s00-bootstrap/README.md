# S00 bootstrap 실행 증거 — 2026-11-04

기준: M1 Mac mini 16 GB, `Medium_Phone`, API 37.0 Play Store 16 KB ARM64 revision 8. 이 폴더는 통합 담당의 S00 기록이며 S11 fixture 제작/제품 E2E 결과가 아니다. Android 상세 수치·명령·실패 수정은 [android.json](android.json)에 보존한다. 키·토큰·이미지·음성·좌표 본문·원본 logcat은 포함하지 않는다.

## 구현과 소유권 이전

- 공유: Python 3.12.16/uv 의존성, strict Pydantic wire DTO, 결정적 OpenAPI/TS 생성, 요청 크기·미디어 검증·안전한 오류·no-store·로컬 CORS, 앱 native DTO/등록/fixture 주입, typed relay client와 인증 adapter, feature flag, Capacitor/Gradle/Manifest/모델 패키징, 호스트 공통 emulator lock과 실행 helper.
- S02/S03 이전: 7개 route의 초기 signature와 명시적 501. S01 인증 검증은 아직 연결하지 않았으며 헤더 존재 확인을 실제 인증이라고 보고하지 않는다.
- S04/S05/S06 이전: 8개 plugin과 각 TS/web 초기 등록. native는 `unimplemented`로 거부한다. shopping plugin/service는 S04 소유인 `plugins/shopping/`에 있다. S06의 atomic NativeRepository 경계를 미리 선언했다.
- S08 화면은 구현하지 않았다. 초기 앱은 빈 shell이며 prototype 데이터·성공 타이머를 제품 기능으로 옮기지 않았다.
- 초기 Codex 작업 종료 후 OMP harness 작업자가 앱 경계 수정과 Android 검증을 수행했다. 모델 이름과 harness 종류는 구분한다.

## 실제 실행한 검사

명령의 작업 디렉터리는 별도 표시가 없으면 저장소 루트다. 환경을 쓰는 셸은 먼저 `source scripts/worktree-env.sh`를 실행했다.

| 실행 | 관찰 결과 |
| --- | --- |
| `uv --directory relay run pytest tests/bootstrap/test_bootstrap.py -q` | 최종 9 passed. 7경로 501, 오류 스키마, 추가 필드/미디어/교차 제약, optional alias의 명시 null 거부, export 네트워크 차단, CORS 경계 회귀 검사. Starlette/httpx deprecation warning 1개 |
| `uv --directory relay run python scripts/export_openapi.py --output <temp>` 두 번 및 checked-in JSON과 `diff -u` | 모두 종료 0, 결정적 결과. 최종 CORS 수정 후에도 checked-in OpenAPI 차이 없음 |
| app에서 `npx openapi-typescript ../relay/openapi.json -o <temp>` 및 generated 파일과 `diff -u` | 종료 0, 차이 없음. TS 7 peer 호환을 위해 openapi-typescript 6.7.6 사용 |
| app에서 `npm run lint && npx vitest run src/relay src/native/web && npm run build && npx astryx doctor --built dist` | 모두 종료 0. 4개 파일 35 tests passed. 기존 generated triple-slash 경고와 doctor theme-fonts 경고 유지 |
| app에서 `npx cap sync android` | 최종 `loggingBehavior:none` 포함하여 성공 |
| `uv --directory relay run python -c <dependency import/CPU tensor smoke>` | arm64, Python 3.12.16, torch 2.5.1, torchvision 0.20.1, timm 1.0.15, einops 0.8.1, NumPy 2.5.4 import 성공, CPU tensor 합 3.0. PE 모델 호환성 검증은 아님 |
| `bash scripts/relay-dev.sh` | worktree 포트 8789의 실제 단일 uvicorn 서버 기동. 유효한 합성 route 요청은 HTTP 501/not_implemented/no-store. 실제 provider 요청 없음 |
| app에서 `VITE_SF_RUNTIME=web-mock npm run dev -- --host 127.0.0.1 --port 5173` + Aside 실제 브라우저 | Street Fitting 초기 shell 렌더링, root 존재, 빈 화면과 dev 배지 없음. 일회성 runtime smoke에서 8개 lazy web plugin/공유 fixture·listener·명시 mock transport 실행. scaffold smoke는 삭제 |
| OMP worker의 최종 Vite runtime smoke | 등록된 Capture의 기본 context set/reset, 안전한 오류 DTO, 원격 HTTP 거부, body 완료 뒤 취소 전파를 실제 실행하여 종료 0 |
| Aside 브라우저에서 localhost:5173 → relay:8789 fetch | preflight 수정 후 HTTP 400/invalid_request/no-store를 JS에서 읽음. placeholder 인증 헤더와 빈 잘못된 요청을 사용했으며 실제 relay 인증 성공을 뜻하지 않음 |
| `app/android/gradlew -p app/android assembleDebug` | 최종 모델 포함 APK 빌드 성공 |
| 빈 임시 모델 디렉터리로 `assembleDebug -PSF_MODELS_DIR=<empty>` | 예상대로 종료 1, 모델 3개 누락 검출. 기존 generated assets로 우회하지 않음, 기준 모델 미변경 |
| `app/android/gradlew -p app/android assembleDebugAndroidTest` | 통합 담당이 전체 모듈 unqualified 명령 실행, 종료 0. android.json의 개별 :app 실행 기록 외에 추가 확인 |
| 전역 lock 안에서 `connectedDebugAndroidTest` 전체 모듈 실행 | 종료 0, 실제 NetworkSecurityPolicyTest 1개 통과. template 테스트 제거. `testDebugUnitTest`는 NO-SOURCE이며 단위 coverage를 주장하지 않음 |
| 전역 lock 안에서 APK 설치/실행/Playwright-Android WebView 연결 | Android native platform, 8개 등록 plugin의 명시적 미구현 거부, WebGL 가용. renderer: Android Emulator OpenGL ES Translator (Apple M1) |
| APK 모델 hash·저장 방식·ELF/zipalign 검사 | 3개 ONNX baseline hash 일치, 무압축. 포함된 arm64 native library LOAD 정렬 모두 ≥16384, `zipalign -c -P 16 4` 종료 0. 모델 추론은 실행하지 않음 |
| `scripts/emulator-lock.sh adb shell getconf PAGE_SIZE` | 16384. 한 AVD만 사용, host GPU. emulator는 설정 2048 MB를 4096 MB로 올림 |
| 독립 프로세스 2개 + 중첩 lock + 오래된 owner 표식 | 직렬화 대기 약 1.02초, 중첩 호출 성공, stale owner는 정상 새 lock 획득. 잠금 없는 실행 경로 없음 |
| 혼합 timestamp GPX 2점 replay | 종료 0, 약 1.761초, 중첩 잠금 성공. timestamp 누락을 epoch로 취급하여 과도하게 대기하던 오류 수정 |
| capture/voice push helper | worker의 빈 디렉터리 검사 후 통합 담당이 실제 PNG 68 bytes·WAV 364 bytes 각 1개를 전역/중첩 lock 안에서 전송하고 장치에서 읽은 SHA-256 일치를 확인, 종료 0. 이 검사용 파일만 즉시 삭제. CameraX/Voice가 해당 파일을 소비하는 기능은 후속 슬라이스 검증 |
| Aside Firebase debug secret 등록 | `M1 Medium_Phone S00` 이름으로 기존 프로젝트에 등록. 과금/강제 적용 설정 변경 없음 |
| `bash scripts/restore-app-check-debug.sh` 후 실제 native SfAuth 호출 | debug 전용 run-as/중첩 lock 복원 성공. Firebase Admin으로 ID 토큰과 App Check 토큰 각각 검증, anonymous provider와 app ID 일치 |
| 최종 native 인증 후 메모리 내 logcat 검사 | debug secret/ID token/App Check token 일치 없음. 원본 logcat·토큰은 증거 파일에 저장하지 않음 |

## 발견 후 수정한 실패

1. CORS 없는 릴레이에서 Android origin `https://localhost` preflight가 실제 HTTP 405, allow-origin 없음으로 재현됐다. localhost/loopback origin만 허용하고 오류·X-Query-Token까지 브라우저에서 읽도록 수정했다. 실제 Aside 브라우저 fetch와 회귀 테스트로 확인했다.
2. Capacitor 기본 debug bridge가 반환 토큰을 logcat에 기록했다. `loggingBehavior:none` 적용·sync·재빌드 후 native 인증을 재실행하여 유출 일치가 없음을 확인했다. 다른 plugin의 이미지/좌표 DTO도 브리지 로그에 출력하지 않는다.
3. 생성된 Cordova 모듈의 instrumentation runtime에 Kotlin stdlib 1.8.22와 jdk7/8 1.6.21이 섞여 duplicate classes가 발생했다. 생성 파일을 편집하지 않고 root Gradle의 해당 모듈에 Kotlin BOM을 적용하여 전체 aggregate assemble/connected 명령을 통과시켰다.
4. 장치 private debug secret과 등록된 호스트 파일이 달라 App Check가 실패했다. [추론] 계측 설치 lifecycle의 app-data 초기화가 원인이다. 새 등록으로 우회하지 않고 등록된 secret을 stdin으로 복원하여 실제 토큰 검증에 성공했다.
5. 원격 HTTP baseUrl override, native 오류 객체의 retryable 위치/민감 메시지, body-read 취소, cached web mock context 교체를 교정하고 동작 회귀 검사 35개를 통과시켰다.

## 아직 주장하지 않는 합격

- Android ONNX 로딩·실제 추론, 연구 22장/7문구 및 mask 비교, 자동 얼굴·머리 보호와 재합성 품질: S02/S05/S11.
- 실제 CameraX/GPS/권한/음성/SQLite 저장·재시작·삭제, 검색·피팅·지도 제품 UI: S04~S10.
- Firebase relay 인증 허용/거부, Meta/OSRM 실제 API 기능: S01~S03 및 통합.
- S11 합성 fixture corpus, mock/live full E2E, 품질 평가, 3분 데모, prototype 미반영 배치·문구의 시각 승인.
- 모든 ABI의 ONNX 실행을 검증한 것이 아니다. 이 기록의 ELF 정렬과 장치 실행 대상은 M1/arm64다.

원 연구 export 스크립트·모델·출력을 덮어쓰지 않았다. 저장소 공개 전환, 새 과금 계약, 결제 설정 변경은 하지 않았다.
