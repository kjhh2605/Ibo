# S11 verification
상태: 확정(R10까지) · 웨이브 1에서 fixture 제작, 모든 슬라이스 merge 후 통합 E2E · 선행: S00 merge 및 사용자 준비(D-R7-11).

## 목표
독립 슬라이스에 재현 가능한 합성 검증 자산을 제공하고, 통합 앱의 전체 흐름을 에뮬레이터에서 mock 한 번·live 한 번 검증한다. 자동 privacy/품질 판정과 3분 실제 API 데모 녹화 준비까지 맡되 앱/릴레이 기능 구현을 대신하지 않는다.

## 읽을 문서
이 목록만 읽는다.
- [결정 로그](../decisions.md): R0~R10 전부. R8 제출, R9 수치·스냅샷, R10 검증 도구(D-R10-01~02)를 놓치지 않는다.
- [relay-api](../contracts/relay-api.md), [agent-tools](../contracts/agent-tools.md), [device-modules](../contracts/device-modules.md), [data-model](../contracts/data-model.md): 전부, 특히 각 검증 절.
- [scope](../product/scope.md), [privacy](../product/privacy.md), [navigation](../ux/navigation.md), [capture](../ux/capture.md), [search](../ux/search.md), [tryon](../ux/tryon.md), [walk](../ux/walk.md).
- [fixtures](../verification/fixtures.md), [acceptance](../verification/acceptance.md): 이 슬라이스가 구현할 검증 인터페이스와 단계별 담당.
- [research §6.3](../../../street-fitting-research.md#63-마스킹-후-생성형-피팅), [§10](../../../street-fitting-research.md#10-남은-미정검증-항목), [제출 요건](../../../hackathon-info.md): 구 결정과 충돌하면 decisions 우선.

## 소유 경로
- 수정: `verification/**`(합성 fixture·출처 manifest·검증 결과), `docs/prd/verification/*`, `scripts/e2e/**`(실제 검사·녹화·E2E 도구). `scripts/e2e/package.json`은 S11 전용 패키지로 두고 `playwright-core`를 고정 버전으로 넣는다. 앱 `package.json`은 고치지 않는다.
- 금지: 앱/relay 기능, 공용 scripts(`emulator-lock.sh`, `gpx-replay.sh`, `push-fixtures.sh`, `relay-dev.sh`), shared package/Gradle/OpenAPI/generated 타입, 계약 문서. 발견한 결함은 해당 slice에 입력·기대·관측·재현 명령을 전달한다.
- 키/토큰·개인정보·원시 HTTP body·개발자 credential은 저장소에 넣지 않는다. 검증 결과는 숫자·허용 metadata·assertion만 보관한다.

## 구현 항목
1. [fixtures의 목록/제작 절차](../verification/fixtures.md#구현-항목) 전부를 구현한다. 기준 기기에 설치된 Codex의 image_generation 비대화 저장 방법부터 확인하고, 불가하면 대화형 생성 후 실제 파일을 옮긴다. 출처·prompt·이용조건·부모/hash 기록을 남긴다. 3가게 촬영 GPX, 안내 GPX, say→16 kHz mono PCM16 WAV, 사람이 표시한 머리 GT도 만든다. D-R7-06, D-R9-01.
2. relay §7의 (scenario, operation, step) 선택·OpenAPI 상시 검증·명시 match/ignore·response ref echo 방식으로 전 시나리오를 웨이브 1에서 제공한다. 실제 촬영 시각/ID/base64/token은 ignore로 녹화값 비교만 생략하며 유효성 검사는 유지한다. 수기 응답과 실녹화를 구분하고 토큰은 runtime 재발급한다. 실녹화는 별도 client recorder로 승인 합성 입력만 처리하며 relay 자동 저장을 추가하지 않는다. [relay §7](../contracts/relay-api.md#7-mock-녹화-선택-계약), [agent §8](../contracts/agent-tools.md#8-mock-fixture가-담아야-할-시나리오); D-R1-04, D-R6-04.
3. `scripts/e2e/`에 아래 CLI를 실제 구현한다. 실패/미실행/선행 조건 누락은 nonzero exit 또는 명시 blocked 보고이며 녹화 파일만 보여 주고 실행 성공으로 처리하지 않는다. S00의 공유 runner와 generated 타입을 재사용한다. [relay §8~9](../contracts/relay-api.md#8-openapi-원본과-타입-생성); D-R7-02~05.
4. **Playwright-Android와 adb로** [acceptance 전체 시나리오](../verification/acceptance.md#통합-e2e-시나리오)를 구동한다(D-R10-01). Orca 없이 맥에서 돌아가야 한다.
   - 앱 화면(React/WebView): `playwright-core`의 `_android.devices()` → `device.webView({pkg:'com.streetfitting.app'})` → `page`로 DOM 셀렉터를 써서 클릭·입력·assert한다.
   - 시스템 UI(권한 대화상자, 알림 카드와 액션): `adb shell uiautomator dump`로 노드 bounds를 읽어 `adb shell input tap`한다. 알림 창은 `adb shell cmd statusbar expand-notifications`로 연다. 권한 사전 상태는 `adb shell pm grant|revoke`로 맞춘다. 딥링크는 `adb shell am start -d streetfitting://…`, 최근 목록에서 지우기는 실제 task swipe로 한다.
   - 고정 화면 좌표·sleep만으로 성공을 추정하지 않는다. GPS는 adb geo fix, 이미지는 debug Capture fixture, WAV는 debug Voice fixture다. mock/live 모두 실제 VAD·마스킹·저장·삭제를 실행한다. D-R7-05, D-R7-10, D-R9-01~04.
   - PRD 작성 기기(M4)에서 2026-11-04 확인한 것: headless `Medium_Phone`에 현재 `app/` debug APK를 설치하고 Playwright-Android가 WebView에 연결됨(title "Street Fitting", `Capacitor.getPlatform()==='android'`, DOM 클릭, 기기 스크린샷). `cmd statusbar expand-notifications` + `uiautomator dump`로 알림 창 글자 읽기. `-no-window -gpu host`에서 WebView WebGL2. `adb emu geo fix` 명령 동작(앱 수신은 S04 구현 후 미확인). **기준 기기 M1에서는 모두 미확인**이며 S11이 처음 실행할 때 다시 확인하고 결과를 `verification/results/`에 남긴다(D-R10-03).
   - 에뮬레이터 시작 직후 Playwright-Android로 앱 WebView에서 `webgl`/`webgl2` 컨텍스트를 얻는지 확인한다. 렌더러 문자열은 기록만 하고 특정 GPU 이름을 기대하지 않는다. 얻지 못하면 지도·데모 단계를 "검증 불가"로 보고하고 성공으로 표시하지 않는다.
5. S05 `evaluateFixture` 자동 지표를 실행하고 positive 머리 노출0·no-person 실패를 모두 assert한다. 통합 16회 Muse Image PoC의 목/어깨 색 차이·어긋남으로 thresholdVersion을 정하고 고정 검증 세트에서 재현한다. 초과/미측정/미보정은 자동 faceless, unsafe_output은 실패다. [device 자동 지표](../contracts/device-modules.md#자동-지표-정의와-poc-합격-절차); D-R9-01.
   [추론·검증 경계] 16회 PoC의 low/high 비교는 S11의 별도 로컬 검증 클라이언트가 승인된 합성 **마스킹본**으로만 실행한다. 제품 `/v1/tryon`에 model/reasoning 옵션을 추가하지 않으며 제품 릴레이는 계약의 low 고정을 유지한다. 모델은 같은 Muse Image만 사용하고 key는 로컬 환경, store:false/도구 없음/가명 식별자·무저장 규칙을 동일하게 적용한다. 이 PoC 클라이언트의 출력 출처는 앱 live E2E와 별도 기록한다.
6. relay metadata 로그와 **메모리에서만 검사하는 HTTP 캡처**를 대응해 privacy를 확인한다. 앱→relay뿐 아니라 relay→Meta/OSRM outbound를 테스트 transport에서 검사하고 원시 image/audio/좌표 body는 저장/로그하지 않는다. providerFile provenance·GPS와 resultDownload gate를 별도 검사한다. [privacy](../product/privacy.md#불변식테스트-대상), [acceptance privacy 표](../verification/acceptance.md#privacy-불변식과-검증); D-R6-04, D-R4-10.
7. 로컬 Mac relay+`Medium_Phone`+실제 API의 3분 데모 영상 녹화를 준비한다. 에뮬레이터는 `-gpu host`로 띄운다. 녹화는 에뮬레이터 콘솔 `adb emu screenrecord start --time-limit 180 <file>.webm` → `adb emu screenrecord stop`이며 한 번에 최대 180초다. 다시 찍기와 앞뒤 여유를 위해 쇼핑·검색·피팅·길 안내 구간별로 녹화하고 ffmpeg concat으로 이어 붙여 mp4로 만든 뒤 전체 길이가 3분 이하인지 확인한다(M4에서 5초 녹화→mp4 변환만 확인). 영상의 흐름은 E2E와 같은 스크립트를 live로 실행하며 녹화한다(D-R10-02). mock 성공 화면을 실제 API 영상으로 표시하지 않는다. 공개 GitHub용 secret/라이선스 검사를 하고 APK 공개·클라우드 배포·터널/실기기 시연은 하지 않는다. [scope 제출](../product/scope.md#구현검증과-배포-선행-조건); D-R8-01~03, D-R10-01, D-R10-03.

### 구현할 검증 CLI
아래 이름/인수는 [추론·검증 인터페이스]이며 S11이 만드는 실행 파일이다. 구현 전 이미 존재한다고 가정하지 않는다. 모든 명령은 저장소 루트 기준이며 내부 경로는 절대 cwd 가정 없이 해석한다.

| CLI | 책임·출력 |
| --- | --- |
| `scripts/e2e/validate-fixtures.sh --all` / `--relay` | manifest/hash/라이선스 확인 상태·WAV/GT/GPX·필수 scenario·OpenAPI schema와 생성 타입 drift 검사 |
| `scripts/e2e/record-relay.sh --scenario <name> --source live` | 승인 합성 입력을 별도 client로 호출, 검토·정규화 후 §7 fixture로 명시 저장. 인증/토큰 원문 없음 |
| `scripts/e2e/run.sh --mode mock\|live --scenario full\|walk\|tryon` | 해당 모드 앱/relay 설정 확인, Playwright-Android(WebView)와 adb(시스템 UI) 단계 수행·assertion·자원 정리. full은 모든 단계 누락 없이 실행 |
| `scripts/e2e/privacy.sh --run <run-id>` | 메모리 HTTP 캡처 assertion과 metadata 로그·DB count·파일 소유권 증거 대조. 원시 payload 미보관 |
| `scripts/e2e/head-mask.sh --all` | 실제 native evaluateFixture 자동 판정, 숫자 결과·합격 여부만 보고 |
| `scripts/e2e/tryon-poc.sh --plan 16 --mode live` | 12+3+1 실호출·자동 품질 수치·임계값 보정/고정 검증. 실제 호출 수와 실패도 기록 |
| `scripts/e2e/provenance.sh --run <run-id>` | providerFile bytes/hash·워터마크/메타데이터·GPS·export gate 확인, 미검증 시 OFF 유지 |
| `scripts/e2e/android-pages.sh --apk <debug-apk>` | APK ZIP 및 packaged native ELF 16 KB alignment와 AVD getconf PAGE_SIZE=16384 확인 |
| `scripts/e2e/measure.sh --suite research10 --mode live` | acceptance research 표의 시간·메모리·정확도 수치/모수·미확인 항목 보고 |
| `scripts/e2e/demo.sh --mode live --segment <name> --seconds <≤180>` / `--concat` | live 설정·secret 비노출 사전 검사 후 `-gpu host` 에뮬레이터에서 구간별로 `adb emu screenrecord` 녹화, ffmpeg concat으로 mp4 합치기, 전체 길이 ≤ 3분·재생 확인. source는 실제 에뮬레이터와 로컬 relay |

실행 결과는 `verification/results/<run-id>/summary.json` 등 구조화 숫자/상태와 스크린샷으로 남기고 저장소에 커밋한다(D-R10-02). 앱 clock/ID seed hook을 만들거나 S00에 변경 요청하지 않는다. native 실제 셔터 시각·ID를 유지하고 relay fixture의 명시 ignore/요청 ref echo로 재생한다. 메모리 HTTP 검사는 S11 테스트 transport/harness에서 수행하며 payload를 저장해 사후 검사하는 방식으로 바꾸지 않는다.

### 환경과 E2E 준비 순서
- 기준 기기는 M1 Mac mini 16 GB이며 도구와 AVD는 [README 기준 기기 준비](../README.md#기준-기기-준비-m1-mac-mini-16-gb-d-r10-03)를 따른다. AVD `Medium_Phone`은 **한 대**다. 원 `/tmp/edgetam-poc` 묶음은 사용자 위임 준비로 기준 기기의 `SF_MODELS_DIR`에 보존됐다([배치·호스트 검증](../README.md#모델-배치와-오프라인-검증)). D-R7-11의 커밋/setup 훅을 임의 변경하지 않는다. 칩에 기대는 값(부팅 시간, 추론 속도, GPU 이름)을 합격 조건으로 쓰지 않는다(D-R10-03).
- 에뮬레이터는 `emulator -avd Medium_Phone -no-window -no-audio -no-boot-anim -gpu host`로 부팅한다. `adb wait-for-device` 후 `sys.boot_completed=1`을 확인하고 시간 제한은 넉넉히 둔다. `adb devices`로 serial을 확인해 `ANDROID_SERIAL`로 고정한다. 앱 설치는 `adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`, 실행은 `adb shell am start -n com.streetfitting.app/.MainActivity …`이며 package는 S00 설정을 읽는다.
- worktree별 `RELAY_PORT`를 정하고 S00 `relay-dev.sh`로 모드를 명시한다. 앱 base URL은 `http://10.0.2.2:<port>`. live는 Firebase 익명 인증+App Check debug provider·Meta key가 필수이며 mock skip flag가 없어야 한다.
- S00 push-fixtures script와 adb로 이미지/WAV를 각각 capture-fixtures/voice-fixtures 폴더에 넣는다. `adb shell am start ... --es sf_capture_source fixture --es sf_capture_fixture_dir <dir> --es sf_voice_source fixture --es sf_voice_fixture_dir <dir>`의 component는 S00 앱 설정에서 읽는다. fake preview/dev UI는 없다.
- WebView는 Playwright-Android, 시스템 UI는 `uiautomator dump`·`input tap`, 권한은 `pm grant|revoke`로 다룬다. native 권한/알림도 UI 관찰로 확인한다. 모든 AVD 접근 명령을 **상위 한 번의 emulator-lock**으로 묶고 내부에서 중첩 lock하지 않는다. Orca emulator 명령은 선택 사항이며 합격 기준에 쓰지 않는다(D-R10-01).
- 먼저 mock full, 그 후 live full을 별도 run ID/초기 데이터로 실행한다. mock scenario selector는 live에서 제거한다. live 오류를 mock fallback으로 숨기지 않는다.

## mock 경계와 의존
웨이브 1은 S00 위에서 fixture·검사 도구를 제작한다. 통합 단계는 S01~S10 merge와 각 단위 합격 후에만 시작한다. S11이 앱 오류를 테스트에서 우회하거나 앱 코드를 고치지 않는다. 기능 owner가 수정한 뒤 필요한 실패 범위를 재검증하고 증거를 구분한다. 모델/API/인증 준비 부족은 실제로 부족한 선행 조건을 기록하며 live 합격으로 표시하지 않는다.

## 합격 기준
1. `scripts/e2e/validate-fixtures.sh --all` — 모든 자산/시나리오·출처·스키마 통과.
2. `scripts/emulator-lock.sh scripts/e2e/head-mask.sh --all` — positive 전부 등록/노출0, no-person 전부 실패, negative 기대 거부.
3. `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario full` — acceptance 모든 단계 통과, upstream 실제 호출 0(mock 지도도 네트워크 없는 adapter 사용).
4. `scripts/emulator-lock.sh scripts/e2e/run.sh --mode live --scenario full` — 실제 Meta·OSRM 및 MapLibre 타일, 동일 기능/삭제·스냅샷 통과. 카메라/음성만 debug 입력이고 AI/저장은 실제다.
5. `scripts/e2e/privacy.sh --run <mock-run>` 및 `--run <live-run>` — 모든 불변식 통과, 요청 body 영구 저장 0.
6. `scripts/emulator-lock.sh scripts/e2e/tryon-poc.sh --plan 16 --mode live` 및 `scripts/e2e/provenance.sh --run <poc-run>` — 수치·임계값 판정 재현, 보존 미확인이면 다운로드 OFF를 확인.
7. `scripts/emulator-lock.sh scripts/e2e/android-pages.sh --apk <debug-apk>` 및 `scripts/emulator-lock.sh scripts/e2e/measure.sh --suite research10 --mode live` — 16 KB 실제 추론·수치 보고, 현장/배터리 미실측은 미확인으로 분리.
8. `scripts/emulator-lock.sh scripts/e2e/demo.sh --mode live --segment <name> --seconds <≤180>`(구간마다) 후 `scripts/e2e/demo.sh --concat` — 합친 mp4가 3분 이하이고 재생 가능, 앱 dev 표시·키 노출 없음, live 출처 확인. 영상에 들어갈 쇼핑→검색→피팅→안내의 실제 대기 시간을 사전 rehearsal로 맞춘다. API 실패를 편집으로 성공처럼 만들지 않는다. 구간을 잇는 것은 허용하지만 한 구간 안에서 화면을 잘라 결과를 꾸미지 않는다.

위 명령은 현재 문서 작성 중 실행하지 않았다. 모든 테스트/스크립트 구현과 실행은 이 문서를 받은 S11 구현 에이전트의 작업이다.

## 완료 보고 형식
- 바꾼 파일 및 fixture manifest·영상/증거 경로.
- 실제 실행 명령·모드·run ID·통과/실패·API 호출 수; mock과 live 별도.
- 미확인·위험: 자동 지표, 실제 모델 품질, 이용조건, 현장/배터리 등 미실측.
- 계약 변경 요청과 각 요청의 담당 slice. 없으면 "없음".

## 미확인·위험
실제 API 품질·지연, Codex 비대화 저장, 공개 asset 이용조건, provenance 보존, PoC 임계값은 미확인이다. research의 구 1GiB Cloud Run/자동 가게 구분/DAT Mock/범위 칩 대안은 최신 결정으로 대체됐으며 되살리지 않는다. 데모 제출과 공개 배포를 혼동하지 않는다.
