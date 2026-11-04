# S04 app-capture

상태: 확정(R10까지) · 웨이브 1 · 선행 슬라이스: S00 merge 완료. S06 Store와 S05 PhotoIndex는 계약 mock으로 시작하고 merge 뒤 실제 연결

## 목표

쇼핑 세션·수동 가게 구분·위치 포그라운드 서비스/알림, CameraX와 debug fixture 촬영, 안전한 갤러리 입출력, 무음 종료 음성 녹음을 구현한다. 화면 없이도 플러그인 상태·DB commit·시스템 알림을 검증할 수 있게 하고, UI 배치는 S08에 맡긴다.

## 읽을 문서

이 목록만 읽는다.

- [결정 로그](../decisions.md): R0~R9, 특히 R2·D-R3-03/07·D-R4-02/10·D-R6-03·D-R7-03/10/11.
- [device-modules](../contracts/device-modules.md): §1~3, §7~9, §11~12. TS 시그니처·오류·권한·이벤트 순서는 그대로 사용.
- [data-model](../contracts/data-model.md): §1~4·6, Trip/TrailPoint/Shop/Photo/QueueJob/SelfPhoto/Result 파일 소유권.
- [relay-api](../contracts/relay-api.md): §1 공통 Image·§6.3 WAV·§6.6 결과 바이트 보존.
- [agent-tools](../contracts/agent-tools.md): §6 음성 질의의 completed→전사 한 경로.
- [scope](../product/scope.md), [privacy](../product/privacy.md): 로컬 촬영·trail 삭제·갤러리·음성 불변식.
- [capture UX](../ux/capture.md): F-01~05, [search UX](../ux/search.md): F-07~08, [tryon UX](../ux/tryon.md): F-10~12 입력 및 F-13 내보내기. [앱 규칙](../../../app/AGENTS.md).

## 소유 경로

- Java: `app/android/app/src/{main,debug,release,test,androidTest}/java/com/streetfitting/app/plugins/{shopping,capture,media,voice}/**`. 여기서 `{...}`는 각 source set의 같은 plugin package를 의미한다. production·fixture factory·unit/instrumentation test를 각 소유 plugin 아래 둔다.
- TS 실제 구현과 해당 web 구현/인접 테스트: `app/src/native/{shoppingSession,capture,media,voice}.ts`, 같은 basename의 `.test.ts`. 공유 web fixture loader는 S00 것을 읽어 사용한다.
- 고치지 않음: MainActivity/Manifest/Gradle/package.json·공유 `contracts.ts`·relay client·generated 타입, `app/src/data/**`·Store native(S06), ML plugin(S05), `screens/App.tsx/ui`(S08), agent/tryon/walk, `verification/**`·공유 scripts.
- Manifest·서비스 선언·source-set 설정이 모자라면 S00 owner에 변경 요청한다. DB 테이블/SQL을 plugin마다 새로 만들지 않고 S06 내부 repository의 원자 연산을 쓴다.

## 구현 항목

1. **ShoppingSession 상태 머신/위치:** 앱 버튼 start→location 권한→notification 권한→visible Activity에서 location FGS→유효 fix→Trip+Shop1+첫 TrailPoint 원자 저장을 구현한다. 위치 거부는 Trip/FGS 생성0, 알림 거부는 recording+notice 1회, 반복 start는 idempotent다. 수동 newShop만 n+1, 유효 fix 없으면 명시 오류다. 기록 중 권한 철회/stop은 종료+trail 삭제를 commit한 뒤 서비스 종료한다. 근거: D-R0-03, D-R2-03/07/10/11, D-R3-03; [device §2](../contracts/device-modules.md#2-shoppingsession--s04), [data §4](../contracts/data-model.md#4-생명주기삭제-연쇄).
2. **알림과 복원:** low/ongoing 카드 하나, "Shop N · N photos · N min", "Take photo"/"New shop"만 둔다. 본문 home, 액션 capture/capture?newShop=1 PendingIntent를 구분하고 Intent 1회만 소비한다. onTaskRemoved에서 stop하지 않고 서비스가 DB/위치 owner다. 재진입 getState로 복원하며 force-stop/재부팅은 최근 목록 swipe와 구별한다. 종료 후 Photo/Shop 좌표는 유지하고 TrailPoint만 지운다. 근거: D-R2-01/02/11; [device §2 서비스·알림](../contracts/device-modules.md#android-서비스알림복원).
3. **CameraX 촬영:** PreviewView를 투명 WebView 뒤에 배치하고 main-thread bind/rect·rotation·front mirror를 정방향 픽셀로 처리한다. shopping은 recording 필수, self/wardrobe는 임시 Asset만 반환한다. 셔터 시각과 당시 trip/shop을 고정하고 유효 trail/fix를 연결한다. 파일 확정+Photo pending commit 직후 PhotoIndex를 dispatch(기다리지 않음), storefront면 description pending+QueueJob을 같은 transaction에 넣는다. 실패에 위치 없는 Photo·가짜 성공을 만들지 않는다. 근거: D-R2-04/05/09, D-R4-02, D-R5-01; [device §3](../contracts/device-modules.md#3-capture--s04).
4. **debug fixture 캡처:** `sf_capture_source=fixture`, `sf_capture_fixture_dir` intent extra를 debug factory에서만 읽는다. 앱 외부 전용 files 아래의 JPG/JPEG/PNG 파일명 UTF-8 오름차순 순환, 성공 셔터에서만 index 증가, lifecycle 유지/새 프로세스 reset을 구현한다. EXIF GPS/시각 대신 현재 주입 GPS/셔터 시각을 사용한다. 빈/손상 폴더는 오류, 카메라 fallback 없음. debug fixture는 CAMERA 권한/실제 preview 없이 동작하고 release에는 extra reader/fixture 구현/자료가 없다. dev 표시 없음. 근거: D-R7-07/10; [device §3 fixture](../contracts/device-modules.md#3-capture--s04).
5. **Media:** Android Photo Picker로 wardrobe/self만 가져오고 앱 전용 import cache로 복사·정방향 정규화한다. 광역 저장소 권한·shopping import를 추가하지 않는다. exportPhoto는 명시 사용자 액션 때만 EXIF GPS를 제거한 복사본을 MediaStore로 내보내고 앱 원본/DB 좌표는 유지한다. exportResult는 resultDownload=false 또는 provenance 미검증이면 파일 생성0; 메타데이터 전체 제거로 워터마크를 훼손하지 않는다. discard는 임시 Asset만 회수한다. 근거: D-R2-05/09/11, D-R4-02/10; [device §7](../contracts/device-modules.md#7-media--s04-내보내기-정책-s10), [privacy](../product/privacy.md#불변식테스트-대상).
6. **Voice:** AudioRecord PCM signed 16-bit LE/mono/16kHz WAV, 15초 상한과 모델 없는 에너지 VAD를 구현한다. 계약의 20ms frame/-40dBFS/60ms 발화 시작/1초 후행 무음/5초 선행 무음/200ms 미만 no_speech를 기본 설정으로 사용한다. complete는 경쟁 stop/silence/limit 중 1회, cancel은 파일 삭제·complete0, no_speech는 error만 보낸다. S07은 completed 한 경로로만 전사하므로 stop 반환을 두 번째 전사 신호로 만들지 않는다. 마이크 FGS/백그라운드 업로드는 없다. 근거: D-R3-05/07, D-R7-09; [device §8](../contracts/device-modules.md#8-voice--s04), [agent §6](../contracts/agent-tools.md#6-음성-질의-경로).
   - **debug Voice fixture [추론·기술 결정, D-R7-10 원칙 확장]:** `sf_voice_source=fixture|mic`, `sf_voice_fixture_dir`를 읽고 기본 `/sdcard/Android/data/com.streetfitting.app/files/voice-fixtures/`의 PCM16 mono 16kHz WAV를 `start()`마다 파일명 순서로 하나씩 **실시간 속도**로 production VAD에 공급한다. 무음 종료·15초·no_speech는 실제 MIC와 동일 코어를 쓴다. 빈/손상 입력은 fixture_empty/fixture_invalid, release는 reader/fixture 구현을 제외하며 화면 표시 없음. 근거: D-R7-07/10; [device §8 fixture](../contracts/device-modules.md#8-voice--s04).
7. **web mock/소비자 연결:** 동일 TS API·snapshot·commit 후 이벤트·권한/clock/실패 주입을 제공한다. Store mock을 공유하며 실제 JS state/fixture 동작을 수행하고 성공 타이머로 DB를 흉내 내지 않는다. 촬영/세션/Media/Voice 모듈 안에서 relay를 직접 호출하지 않는다. 외관/옷 label 큐 실행은 S06, 전사는 S07, 화면 영어 문구/배치는 S08이다. 가게 정보는 Trip에 통합하며 Shop/Visit native 화면을 만들지 않는다. 근거: D-R1-04, D-R6-03, D-R7-03/04, D-R9-04; [device §1·9](../contracts/device-modules.md#1-공통-경계).

## mock 경계와 의존

S00의 계약/등록을 사용하고 초기 S04 unit test에서는 Store repository와 PhotoIndex를 계약 fake로 주입한다. **SQLite에서 종료 후 TrailPoint 0건·복원·원자 큐를 확인하는 최종 기기 검증은 S06 실제 Store merge 뒤 필수**이며 fake 통과로 대체하지 않는다. S05 merge 뒤 index dispatch도 실제 PhotoIndex에 연결한다. UI 미완성 때는 소유 package의 instrumentation harness로 API를 직접 호출하고 UiAutomator로 OS 알림/최근 목록을 조작한다. 제품 화면을 테스트용 native Activity로 새로 만들지 않는다.

AVD는 기준 기기(M1 Mac mini 16 GB, D-R10-03)의 `Medium_Phone` API 37/16 KB 한 대다. 모든 emulator/adb 기기 조작은 `scripts/emulator-lock.sh`로 감싼다. 검증은 Orca 없이 adb와 에뮬레이터 콘솔로 한다(D-R10-01): 권한은 `adb shell pm grant|revoke`, GPS는 `adb emu geo fix`, 카메라는 debug fixture다. WAV→에뮬레이터 실제 마이크 주입 방법은 **미확인**이지만 합격 선행 조건이 아니다. 음성 E2E는 위 debug Voice fixture가 실제 시간으로 VAD에 공급하는 경로로 고정한다. 호스트 마이크·사람 발화는 합격 기준에서 제외하며 fixture 경로를 AudioRecord 하드웨어 성공으로 부르지 않는다.

## 합격 기준

명령은 루트 기준이다. `CaptureContractTest`, `ShoppingSessionContractTest`, `MediaContractTest`, `VoiceContractTest`는 S04가 각 plugin의 androidTest package에 구현할 테스트 클래스다. 에뮬레이터 관련 일련의 준비와 검사는 같은 잠금 안에서 실행한다.

권한 명령 전에 `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew installDebug'`로 테스트 대상 패키지를 설치한다. instrumentation이 Activity를 새로 여는 경우에도 테스트가 같은 fixture intent extra를 다시 넣어 source를 유지한다. 이전 실행의 프로세스/권한/fixture index에 우연히 의존하지 않는다.

| 명령 | 기대 결과 |
|---|---|
| `(cd app && npx vitest run src/native/shoppingSession.test.ts src/native/capture.test.ts src/native/media.test.ts src/native/voice.test.ts)` | 동일 web 상태/이벤트, no shopping import, fixture 순환, cancel/중복 complete, 외관 큐 호출·index dispatch 계약 통과 |
| `(cd app/android && ./gradlew testDebugUnitTest)` | 소유 plugin 단위 테스트 통과: 좌표/시각 선택·WAV sample/header·VAD 경계·GPS metadata 제거·민감 로그 없음 |
| `scripts/emulator-lock.sh bash -lc 'adb shell pm revoke com.streetfitting.app android.permission.ACCESS_FINE_LOCATION; adb shell pm revoke com.streetfitting.app android.permission.ACCESS_COARSE_LOCATION; cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.shopping.ShoppingSessionContractTest#locationDeniedDoesNotStart'` | 위치 거부 흐름→idle, Trip/TrailPoint/FGS 생성0, Open settings 요청 가능. 테스트는 OS 거부 선택과 반환 오류를 관찰 |
| `scripts/emulator-lock.sh bash -lc 'adb shell pm grant com.streetfitting.app android.permission.ACCESS_FINE_LOCATION && adb shell pm grant com.streetfitting.app android.permission.ACCESS_COARSE_LOCATION && adb shell pm revoke com.streetfitting.app android.permission.POST_NOTIFICATIONS; adb emu geo fix 127.0 37.5 && cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.shopping.ShoppingSessionContractTest#notificationDeniedStillRecords'` | location 허용+notification 거부에도 recording, startForeground 호출, notice 1회·카드 없음. 좌표는 합성 테스트 입력이며 로그에 출력하지 않음 |
| `scripts/emulator-lock.sh bash -lc 'adb shell pm grant com.streetfitting.app android.permission.POST_NOTIFICATIONS && adb emu geo fix 127.0 37.5 && cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.shopping.ShoppingSessionContractTest'` | 카드1·액션2·본문/두 액션 각각 올바른 deep link, New shop 한 번만 증가. 알림 카드는 `adb shell cmd statusbar expand-notifications` 후 `uiautomator dump`로 글자와 버튼을 확인한다. `swipeRecentsThenReopenRestoresRecording`은 실제 task swipe 후 fix 증가/DB 복원, `stopDeletesAllTrailKeepsPhotos`는 SQL TrailPoint=0·사진/가게 위치 보존. force-stop으로 swipe를 대체하지 않음 |
| `scripts/emulator-lock.sh bash -lc 'scripts/push-fixtures.sh verification/fixtures/capture && adb emu geo fix 127.0 37.5 && adb shell am start -n com.streetfitting.app/.MainActivity --es sf_capture_source fixture --es sf_capture_fixture_dir /sdcard/Android/data/com.streetfitting.app/files/capture-fixtures/ && cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.capture.CaptureContractTest'` | fixture 사진 순서/순환, EXIF GPS·날짜 무시, Photo.location은 주입 fix·takenAt은 셔터 시각, 앱 전용 파일만 존재. location 실패 Photo0·index 1회·storefront 큐 원자성, preview rect/lifecycle·CAMERA 거부의 실제 camera source 오류 검사 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.media.MediaContractTest'` | picker wardrobe/self·취소, `exportPhotoRemovesExifGpsKeepsOriginalLocation`, `resultDownloadOffCreatesNoGalleryFile`, `exportDoesNotChangeProviderFile` 통과. 실제 내보낸 URI를 재열어 EXIF 검사 |
| `scripts/emulator-lock.sh bash -lc 'adb shell mkdir -p /sdcard/Android/data/com.streetfitting.app/files/voice-fixtures && adb push verification/fixtures/voice/. /sdcard/Android/data/com.streetfitting.app/files/voice-fixtures/ && adb shell am start -n com.streetfitting.app/.MainActivity --es sf_voice_source fixture --es sf_voice_fixture_dir /sdcard/Android/data/com.streetfitting.app/files/voice-fixtures/ && cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.voice.VoiceContractTest'` | `start()`→fixture WAV 실시간 재생→silence 자동 종료→completed 정확히1회. `speechThenSilenceStopsOnce`, `leadingSilenceFailsAtFiveSeconds`, `limitStopsAtFifteenSeconds`, `cancelDeletesWav`, `invalidFixtureNeverFallsBackToMic` 통과. 별도 mic source 권한 거부 검사는 `permissionDeniedHasNoRecording`; 호스트 마이크 입력을 요구하지 않음 |
| `(cd app/android && ./gradlew assembleRelease testReleaseUnitTest)` | release fixture factory/extra reader/fixture assets 부재를 소유 source-set 테스트로 검사. APK 공개/배포는 하지 않음 |

Shared fixture 경로가 아직 준비되지 않았다면 S11에 정확한 필요 자료를 요청하고 기기 합격을 미완료로 보고한다. `verification/`를 이 슬라이스에서 만들거나 바꾸지 않는다. 로그 검사는 좌표/이미지/WAV 바이트 대신 count·상태·기간·pass/fail만 남긴다.

## 완료 보고 형식

- 바꾼 파일: 4개 plugin의 native/TS/web/test만 구분.
- 실행한 명령과 결과: AVD/API/page size, 권한 3조합·알림 딥링크·swipe 복원·TrailPoint0·fixture 태그·EXIF·Voice 자동 종료 증거.
- 미확인·위험: Store fake/실제 구분, debug Voice fixture E2E와 MIC 하드웨어 경계, 실제 CameraX와 fixture 입력 구분, release fixture 제외 결과.
- 계약 변경 요청: Manifest/등록/shared DTO/Store 원자 메서드가 부족한 경우 정확한 요구와 owner.

## 미확인·위험

- OS 권한 대화상자의 영문·알림 배치는 Android 버전에 따라 달라진다. 앱 자체 새 문구·위치는 프로토타입 세션에서 확정하며 플러그인은 code/event를 제공한다.
- 최근 목록 제거와 강제 종료는 다르다. force-stop/재부팅 이후 Android 서비스 지속을 보장하지 않는다.
- UI의 권한 안내는 UX 문서, 실제 권한 재요청/영구 거부 상태는 device 계약을 따른다. 거부 상태를 무한 재프롬프트하지 않는다.
- 알림 문구 예시의 UX 배치와 device의 한 줄 payload가 다르면 실제 기능 acceptance는 D-R2-01의 상태·2액션을 기준으로 하며 최종 시각 배치는 S08에 남긴다.
