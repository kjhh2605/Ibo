# Street Fitting app

React/Astryx UI와 실제 S06 Store, S07 검색 agent, S09 Walk, S10 TryOn controller를 연결한다. Android는 Capacitor native plugin을 사용한다. 일반 브라우저에서 native 기능을 성공한 것처럼 대체하지 않으며, 브라우저 검증에는 명시적 `web-mock` runtime이 필요하다.

## Android 수동 체험 — 2026-11-05 실연동 확인

설치된 debug 앱은 `live` relay `http://10.0.2.2:8788`을 사용한다. 브라우저 목 화면이 아니라 실제 native Store/PE-Core/EdgeTAM과 Firebase 익명 인증·App Check를 거친 실행이다. 별도 로그인 화면은 없다.

- 데모 기본 구성: 종료된 trip 3개, shop 9개, 사진 36장(상품 27·전경 9), 저장한 옷 12개, 옷장 6개. 위치·방문 시간·`[Demo]` 이름은 합성 데이터이며 실제 GPS나 사람 검토 승인을 뜻하지 않는다.
- 실제 앱 검색으로 저장한 상품 1개가 추가되어 현재 저장한 옷은 13개다. 전경 9개의 설명과 `Blue Zip-Front Bomber Jacket` 이름·종류는 실제 Spark 응답이다.
- 실제 Muse Image로 생성한 결과 2개(동반 0벌·5벌)는 native 검사·얼굴 제거 후 보관되어 있다. 재시작 뒤 결과 화면을 다시 열었고 provider 원본 바이트 hash 보존을 확인했다. seed가 생성 성공 기록을 넣은 것은 아니다.
- Home → **Find it** → `blue denim jacket` → **Find** → **Best match** → **Use this item**으로 실제 검색·분할·저장을 확인할 수 있다. **Wardrobe**, **All trips**, **Try-ons**도 데이터가 있다. 저장 상품 → **Try it on** → 동반 옷 선택 → **Generate**는 실제 유료 API 호출이다.
- 사람 얼굴/머리 GT와 재합성 임계값 보정은 미완료다. 원본 self는 기기에만 있고 전송에는 native 마스킹본만 쓴다. 원래 얼굴을 붙이지 않고 `faceless:true` 결과를 표시하며, 출력 윤곽 검증 실패 시 저장하지 않는다. 결과 다운로드는 OFF다. 음성 녹음·실제 GPS 이동·실내/야외 길찾기는 이번에 검증하지 않았다.

재빌드(이 checkout의 relay 포트는 8788):

```sh
# app/
VITE_SF_RELAY_URL=http://10.0.2.2:8788 VITE_SF_RELAY_MODE=live VITE_SF_VERIFICATION=1 npm run build
npx astryx doctor --built dist
npx cap sync android
./android/gradlew -p android assembleDebug
adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 shell am start -W -n com.streetfitting.app/.MainActivity
```

디버그 앱만 로컬 HTTP mixed content를 허용한다. `network_security_config.xml`은 HTTP 목적지를 로컬 relay 주소로 제한하며 release는 기존 HTTP 차단을 유지한다. native Store의 `/data/data`와 Filesystem의 동일 앱 `/data/user/0` 경로 별칭을 처리하되 다른 앱/사용자/디렉터리·traversal은 거부한다.

데모 설치는 기존 기록을 지우지 않고 고정 namespace에 추가한다. 모델·debug APK·실행 중인 에뮬레이터가 필요하며 재실행은 중복을 만들지 않는다. 원본 self가 있을 때는 교체하지 않는다.

```sh
# 저장소 루트; 최초 harness 의존성은 scripts/e2e/에서 npm ci
node scripts/e2e/seed-demo.mjs --dry-run
ANDROID_SERIAL=emulator-5554 bash scripts/emulator-lock.sh node scripts/e2e/seed-demo.mjs --apply --self-if-empty
# 필요할 때만: 도구가 소유한 demo 기록 삭제. 사용자 추가 옷·결과·self는 보존.
ANDROID_SERIAL=emulator-5554 bash scripts/emulator-lock.sh node scripts/e2e/seed-demo.mjs --rollback
```

`--self-if-empty`는 self가 없을 때만 합성 `calibration-hat.png`를 실제 native 마스킹으로 등록한다. 데모 설치/삭제는 mock relay 전환이나 승인 flag 변경을 하지 않는다. 선택적으로 넣은 demo self도 rollback이 삭제하지 않는다.

현재 실측: 앱 238 tests, relay 270 tests, lint/build/doctor, native assembleDebug/testDebugUnitTest 통과. 기존 lint 24개·theme-fonts·bundle 경고는 남아 있다. browser full/states 통과에 더해 Android에서 실제 4턴 Spark·1회 SAM 검색, 저장·Spark 명명, Muse 2/7장 입력 생성, 취소 정리·6번째 동반 차단·재시작 보존을 확인했다. 전체 제품 품질·개인정보 최종 합격과는 구분한다.

증거: [Android 최종 상태](../verification/results/2026-11-05-android-live/final.json), [검색](../verification/results/2026-11-05-android-live/search.json), [피팅 7장/취소](../verification/results/2026-11-05-android-live/tryon-max.json), [독립 Meta API 실호출](../verification/results/2026-11-05-live-provider/final.json). 아래 기존 UI 관측 수치는 당시 기록이다.

### 원본 얼굴 재합성 — 2026-11-05 합성 데모 활성화

- 사용자 승인(D-R12-01)에 따라 수동 head GT·사람 판정 없이 **합성 self 한 장에 한정한 임시 보정**을 적용했다. `config/local-composition.json`의 provenance는 `provisional-synthetic`, `humanApproved:false`다. 일반 사진의 개인정보/품질 검증 완료를 뜻하지 않는다.
- 저장된 원본 **파일 바이트 SHA-256**이 보정 source와 일치하고 Android `FLAG_DEBUGGABLE`일 때만 적용한다. 웹 mock은 Vite 개발 모드에서만 적용한다. 사진을 바꾸거나 release 빌드이면 임계값은 null로 처리한다. 구도·crop·생성 머리 보호 범위 검사와 자동 faceless/저장 거부는 유지한다.
- 실제 Meta 출력 6개로 fit했다(복원 가능 4개·구도 거부 2개). 양성 실측 최댓값은 색 차이 `52.92406593298473`, 대각선 대비 어긋남 `0.01087116327113919`다. 이를 고정한 뒤 **새 Meta 출력 1개**가 native 합성에 통과했다. 초기 두 보정 시도의 거부 결과도 보존했으며 실패를 성공으로 바꾸지 않았다.
- 이번 작업에서 실제 생성 요청 6회를 추가했다. 1회는 `unsafe_output`으로 저장되지 않았다. 설치 후 보관된 실제 provider 7개를 production native 경로로 재검사해 복원 5개·faceless 2개를 확인했다. 그중 실제 복원 결과 2개를 Store에 추가 저장하고 `Try-ons` → `Your look`에서 열었다. 이 재합성에는 추가 API 호출이 없다.
- 현재 에뮬레이터: trip 3·shop 9·photo 36·saved 13·wardrobe 6·result 9(얼굴 복원 2개). 기존 원본 self·provider 바이트·기존 결과는 보존했다. `http://10.0.2.2:8788`의 live relay를 사용하며 다운로드는 계속 OFF다. 앱을 열고 **Try-ons의 최신 두 결과**를 확인하면 된다. 새 Generate 결과는 구도/지표에 따라 계속 faceless 또는 거부될 수 있다.
- 검증: app 273 tests, 승격 회귀 17 tests, Android 설정/합성/마스킹 instrumentation 8 tests 통과. lint/build/doctor, Android build/unit tests 통과. 기존 lint 24개·theme-fonts·bundle 경고는 남아 있다. release gate는 instrumentation으로 검증했으며 release APK 실연동 검증은 아니다.
- 일반 사진용 정식 16회 PoC·사람 GT/판정 절차는 유지한다. [정식 및 임시 보정 절차](../docs/prd/verification/acceptance.md#재합성-보정-산출물과-승격)를 따른다. 이전 `compositionThresholds:null`·사람 GT 대기 상태는 [이전 기록](../verification/results/2026-11-05-recomposition/preview.json)이며 현재 합성 데모의 활성화 선행 조건은 아니다.

증거: [고정·측정·비승인 provenance](../verification/results/provisional-synthetic-20261105-r3/provisional-composition.json), [설치본 native 재합성](../verification/results/provisional-synthetic-20261105-r3/installed.json), [바로 확인할 결과 화면](../verification/results/provisional-synthetic-20261105-r3/ready-for-user.png).


## 개발·검증

```sh
# 이 디렉터리에서 실행
npm run lint
npm run build
npx astryx doctor --built dist
npx vitest run

# 실제 UI/owner controller + IndexedDB Store + 명시적 native-web fixtures
node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock
node --experimental-strip-types src/ui/verify-web.ts --scenario states --mode mock

# 같은 runtime을 수동 브라우저 검증용으로 유지; 출력된 WEB_MOCK_URL 사용
node --experimental-strip-types src/ui/verify-web.ts --scenario serve --mode mock
```

runner는 저장소의 `verification/fixtures`와 실제 Android mask 증거를 HTTP로 제공하고 임시 Vite 서버를 시작한다. `SF_UI_FIXTURE_ROOT`로 fixture root를, `SF_UI_NATIVE_MASK_ROOT`로 `person-mask-export-after.json`과 `person-masks/`가 있는 증거 디렉터리(기본 `verification/results/2026-11-04-m1-resume`)를 바꿀 수 있다. source/mask hash·해상도·binary 픽셀을 검사하며 모델 점수나 mask를 만들어 보충하지 않는다. 자동 시나리오는 설치된 Playwright Chromium을 사용하고 종료 시 브라우저·서버를 정리한다. `serve`는 Ctrl-C로 종료한다.

runner 설정:
- `VITE_SF_RUNTIME=web-mock`
- `VITE_SF_RELAY_MODE=mock`
- `VITE_SF_VERIFICATION=1`
- `VITE_SF_WEB_FIXTURES=<local HTTP fixture root>`
- `VITE_SF_WEB_NATIVE_MASKS=1` — 위 실제 Android 산출물을 명시적 web-mock 입력으로 연결

`web-fixtures.ts`는 실제 WebRepository API로 과거 trip/photo/embedding을 넣고, 실제 Capture/Media/Segmenter/Voice web plugin에 입력 fixture를 제공한다. 앱에서 저장한 piece·photo·result는 IndexedDB에 남는다. 삭제한 과거 trip은 새로고침 시 재생성하지 않는다. 메모리 Store adapter, 화면 강제 이동, 가짜 생성 성공 hook은 없다.

## 관측 경계

`window.__sfVerification.inspect()`는 읽기 전용이다. 명시적 verification flag와 다음 조건을 함께 만족해야 설치된다.
- 브라우저: `web-mock` + Vite DEV.
- Android: native `Store.getRuntimeInfo()`가 실제 debug build임을 확인. release/검증 실패는 닫힌다.

반환값은 route/stack, 저장된 ID, 실제 agent/fitting/walk snapshot, 공용 경계에서 관측한 transport counters다. counter scope는 `relay-attempts/shared-file-reads/media-export-attempts`이며, 원본 사진의 **로컬 읽기**와 원본 업로드를 동일시하면 안 된다. 이미지·오디오 bytes와 인증 token은 노출하지 않는다.

## 현재 증거와 한계

상세 명령 결과·화면 상태는 [S08 체크포인트](../verification/results/2026-11-04-s08-ui/CHECKPOINT.md), 자동 클릭 결과는 같은 디렉터리의 `full/matrix.json`, `states/matrix.json`을 참고한다.

- lint/build/doctor 및 전체 228개 테스트 통과를 관측했다. lint 경고와 기존 theme-fonts·bundle 크기 경고는 남아 있다.
- 실제 browser UI에서 13개 route를 열었고 `full` 49개 관측, `states` 88개 관측이 통과했다. 실제 FaceMask 등록·재합성 안전 분기·Store Result 저장/삭제, 새로고침 후 결과 보존을 확인했다.
- provider 응답은 명시적 합성 이미지다. 검증된 Android person masks를 사용했지만 실제 Muse 생성 품질이나 사람 GT 기반 privacy 승인이 아니다. 검출 불가 원본 provider fixture는 unsafe-provider 음성(陰性) 사례로 보존하고, 정상 합성 사례도 미보정 재합성 threshold 때문에 실제 얼굴 없는 결과가 된다. 성공 Result를 seed하거나 서비스 결과를 덮어쓰지 않는다.
- 실제 Android wardrobe tap masks도 연결해 취소 후 재수입·cutout 저장·오프라인 naming 대기와 재연결·새로고침 후 보존·삭제를 확인했다. naming 응답과 아이템 draft mask·음성 tone은 명시적 mock이며 사람 음성 인식·실제 API 품질·M1 전체 E2E 증거가 아니다.
- 새 배치·문구의 인간 프로토타입 세션 승인은 미확인이다.
