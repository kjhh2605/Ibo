# S05 app-ml

상태: 확정(R9까지) · 웨이브 1 · 선행 슬라이스: S00 merge 완료, 사용자 `SF_MODELS_DIR` 준비. S06 Store는 계약 mock으로 시작 후 실제 연결

## 목표

기기에서 PE 사진 색인·검색, EdgeTAM 탭 마스크, 본인 사진의 머리 제거와 자동 수치 기반 재합성을 구현한다. 사진·벡터·본인 원본을 네트워크로 보내지 않으며, 모델 추론 결과와 privacy 판정은 에뮬레이터 실측으로 확인한다.

## 읽을 문서

이 목록만 읽는다.

- [결정 로그](../decisions.md): R0~R9, 특히 D-R0-02·D-R3-02/11·D-R4-02~04/10/11·D-R7-01/03/11·D-R9-01.
- [device-modules](../contracts/device-modules.md): §1, §4~6 전부(자동 지표·fixture API 포함), §9 repository, §11~12.
- [data-model](../contracts/data-model.md): 공통 파일/mask/vector 규칙, PhotoEmbedding·Candidate·SelfPhoto·Result, §3~5 삭제/피팅 불변식.
- [relay-api](../contracts/relay-api.md): §1 Image, §3 PE 텍스트 타워, §6.2 mask, §6.6 마스킹본/원본 출력 경계.
- [agent-tools](../contracts/agent-tools.md): §3.3 사진 검색·§4 후보 무필터 규칙.
- [scope](../product/scope.md), [privacy](../product/privacy.md): 본인 사진과 불변식 1·2·5·6·7·11·13.
- [search UX](../ux/search.md): F-08; [tryon UX](../ux/tryon.md): F-10~13 기능 상태; [앱 규칙](../../../app/AGENTS.md).
- [research §7.1](../../../street-fitting-research.md#71-탭-지점-옷-후보-에뮬레이터-실측), [§8.1](../../../street-fitting-research.md#81-에이전트-장면-검색), [§6.3](../../../street-fitting-research.md#63-마스킹-후-생성형-피팅): 실측·PoC 재현 근거. 옛 수동 마스킹/모델 필터 제안보다 R9 계약이 우선.

## 소유 경로

- Java: `app/android/app/src/{main,debug,release,test,androidTest}/java/com/streetfitting/app/plugins/{photoindex,segmenter,facemask}/**`.
- TS 실제/web 구현과 인접 테스트: `app/src/native/{photoIndex,segmenter,faceMask}.ts`, 같은 basename의 `.test.ts`.
- 공용 ONNX loader/session registry는 S05 소유 plugin package 내부 한 곳에 두고 세 plugin이 재사용한다. 예: `plugins/segmenter/model/`; 각 plugin이 모델 사본/세션을 따로 만들지 않는다. `faceMaskConfig`와 자동 판정 코드는 facemask 소유 경로 안에 둔다.
- 고치지 않음: MainActivity·Manifest·Gradle·앱 의존성·공유 `contracts.ts`·web loader·relay/generated 타입, Store/native/data(S06), Capture(S04), 피팅 JS `app/src/tryon/**`(S10), 화면(S08), `verification/**`·공유 scripts.
- S00 등록/패키징/모델 manifest·공유 타입 변경이 필요하면 요청한다. S05는 FaceMask **알고리즘과 판정** owner이고 S10은 이를 호출하는 JS 오케스트레이션 owner다.

## 구현 항목

1. **로컬 모델 로딩/수명:** S00 generated assets의 `models/{edgetam_encoder,edgetam_decoder,pe_image}.onnx`를 hash 검증 후 최초 1회 앱 files/models/<hash>에 원자 복사하고 ONNX Runtime CPU OrtSession을 재사용한다. model shape/revision/전처리 mismatch·누락은 명시 오류, 자동 다운로드/mock fallback 없음. feature/tensor/Bitmap을 UI thread 밖에서 처리하고 release 시 native 자원을 닫는다. 근거: D-R0-02, D-R7-03/11; [device §5·12](../contracts/device-modules.md#12-모델-배포android-16-kb-선행-조건).
2. **PhotoIndex:** RGB 정방향→bilinear 384²(센터 crop 없음)→`(pixel/255-.5)/.5`, image `[1,3,384,384]`에서 embedding `[1,512]`를 받아 L2 정규화한다. ID별 single-flight, 성공 사진은 재계산0, pending 재개/명시 failed 재시도, SQLite BLOB+indexState 원자 commit을 S06 repository로 호출한다. search는 score 내림차순→takenAt 내림차순→photoId 오름차순으로 **정렬한 뒤 k1~3개를 자르고**, 호출자는 다시 정렬하지 않는다. pending 최대30초/failed 오류이며 임베딩 업로드·후보 제거 필터는 없다. 삭제된 사진의 늦은 추론은 반영하지 않는다. 근거: D-R1-01, D-R3-01~03/11; [device §4](../contracts/device-modules.md#4-photoindex--s05), [data PhotoEmbedding](../contracts/data-model.md#photoembedding).
3. **Segmenter:** prepare는 정방향 RGB 1024², 계약 mean/std의 encoder 1회로 feature를 유지하고 tap/person은 같은 handle의 decoder만 실행한다. point=1, batch=1과 embedding/high0/high1·coords·labels 입출력을 계약대로 지킨다. logits bilinear 원본 복원 후 >0→0/255 PNG/tight bbox, 점수 내림차순·동점 decoder index의 **3개 전부**를 반환한다. 레터박스/회전·edge clamp·release handle 검증, invalid/빈 mask는 명시 오류이며 PE 필터/전 화면 자동 검출은 없다. 근거: D-R3-02, D-R7-01/03; [device §5](../contracts/device-modules.md#5-segmenter--s05).
4. **FaceMask 등록:** 중심점 후보와 connected component/행 폭/목/머리 팽창 규칙을 정확히 구현한다. person은 의미론적 사람 검출기가 아니므로 윤곽 조건을 검사하고 사람 없음·모호함·잘린 머리/불안전 경계는 실패한다. 단색 불투명 덮기(a), 목 아래 crop(b), 배경도 덮기(c)와 좌표 sidecar를 로컬에서 처리한다. 성공 시만 EXIF 없는 lossless maskedFile·headMask·원본을 SelfPhoto로 원자 교체하고 실패하면 기존 정상본을 유지한다. raw/headMask는 네트워크 경로가 없다. 근거: D-R4-02/03/11, D-R7-01, D-R9-01; [device §6](../contracts/device-modules.md#6-facemask--s05-피팅-js-오케스트레이션-s10).
5. **자동 마스킹 평가:** `evaluateFixture`는 register와 같은 core를 실행하되 SelfPhoto를 교체하지 않는다. 사람이 표시한 얼굴+머리카락 GT를 원본 좌표에서 추적해 원본이 전송본에 기여한 exposedHeadPixels를 계산한다. crop/resize interpolation footprint도 보수적으로 계산하며 우연히 같은 RGB 비교로 판정하지 않는다. 성공 대상 본인 fixture **전부 registrationOk=true·exposedHeadPixels=0**, no-person **전부 registrationOk=false**가 필수다. expectedPerson을 검출 입력으로 사용해 정답을 주입하지 않고 일반 등록 GT 없으면 count/privacyPassed=null이다. 근거: D-R4-11, D-R9-01; [device 자동 지표](../contracts/device-modules.md#자동-지표-정의와-poc-합격-절차).
6. **자동 재합성 판정:** 원본/출력 윤곽을 선형 정렬하고 목/어깨 각 64 sampling 지점에서 ΔE76 색 차이95백분위·양방향 최근접 윤곽 거리95백분위/원본 대각선을 계산한다. `compositionThresholds={version,maxBoundaryColorDeltaE,maxBoundaryOffsetRatio}`는 PoC 설정값이며 초기 null이다. 네 지표 모두 유효하고 각각 `<=` 임계값일 때만 합성, null/측정 불가/하나라도 초과는 해당 결과 faceless다. 임의 3%/10%나 사람 승인 override는 쓰지 않는다. faceless도 생성된 머리를 실제 제거해야 하며 안전한 출력 영역을 못 찾으면 unsafe_output으로 저장을 막는다. providerFile 바이트는 불변, selfUpdatedAt 바뀜은 다른 얼굴로 대체하지 않고 실패다. 근거: D-R4-04/10/11, D-R9-01; [device §6 전송본·자동 지표](../contracts/device-modules.md#전송본-설정-재합성).
7. **web mock/소비자 경계:** PhotoIndex mock도 실제 내적/정렬, Segmenter는 원본 크기 mask3개, FaceMask는 실제 불투명 masked fixture·수치로 production과 같은 판정 함수를 쓴다. 사진마다 가짜 결과를 고정하거나 raw를 maskedFile로 복사하지 않는다. S10은 maskedFile 전송/결과 저장을 오케스트레이션하고 S06은 파일/DB 소유권을 지킨다. 근거: D-R1-04, D-R7-03/04, D-R9-01; [device §1·4~6](../contracts/device-modules.md#1-공통-경계).

## mock 경계와 의존

모델 자체는 **실제 ONNX**를 사용하며 에뮬레이터 ML 합격을 mock으로 대체하지 않는다. 웹 소비자 테스트만 동일 계약의 mock을 쓴다. 초기 unit test의 Store fake는 S06 merge 뒤 실제 SQLite 연결 검사로 보완한다. 네트워크/Meta 호출은 S05에 없고, Muse Image 결과 입력은 승인 provider fixture를 읽는다. S11이 준비하는 head GT/negative/no-person/provider 출력은 읽기 전용이며 보정/검증 세트를 사전에 분리한다.

모델·연구 실험/결과의 원 출처는 `/tmp/edgetam-poc/`이며, 사용자 위임 준비로 `SF_MODELS_DIR`에 보존됐다([배치·hash·호스트 검증](../README.md#모델-배치와-오프라인-검증)). S05는 기존 export를 덮어쓰거나 재-export하지 않는다. 22장/7문구 호환 검사를 위해 기기 이미지 벡터·model hash·전처리/사진 hash를 S02/S11에 제공하되 **네트워크 업로드가 아니라 로컬 검증 산출물**이다. 벡터/원본을 일반 앱 로그에 기록하지 않는다.

## 합격 기준

아래 명령은 구현자가 실행할 요구다. Java 테스트 클래스는 해당 plugin의 test/androidTest package에 구현한다. 앱 UI 없이 instrumentation이 같은 production core를 호출할 수 있어야 한다. 모든 기기 조작은 전역 emulator lock을 사용한다.

| 명령(루트 기준) | 기대 결과 |
|---|---|
| `(cd app && npx vitest run src/native/photoIndex.test.ts src/native/segmenter.test.ts src/native/faceMask.test.ts)` | 실제 내적/순위·오류·수치 경계·masked fixture 계약 통과. `faceMaskNoNetworkOnSuccessFailureCancel`은 fetch/relay/native HTTP seam 호출0 |
| `(cd app/android && ./gradlew testDebugUnitTest)` | `singleFlightIndex`, `pendingTimeoutIsNotNotFound`, `deletedPhotoCannotResurrect`, `maskCoordinatesAndSorting`, `composeThresholdInclusiveBoundary`, `oneMetricExceededIsFaceless`, `nullThresholdsAreNotCalibrated`, `metricsUnavailableIsFaceless` 통과. 수치 경계 unit 값은 테스트 입력일 뿐 실측 보정값으로 저장하지 않음 |
| `(cd app/android && ./gradlew assembleDebug)` | 실제 모델 assets hash/shape 확인, 누락 모델은 실패. text tower는 APK에 없음 |
| `scripts/emulator-lock.sh adb shell getconf PAGE_SIZE` | `16384` |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.photoindex.PhotoIndexResearchTest'` | 실제 PE ONNX로 research §7.1 두 이미지 및 §8.1 동일 22장 벡터 생성, 512/유한수/L2오차≤1e-4. Mac 기준과 원소 max absolute error·벡터 cosine·hash를 기록. [추론·검증 기본값] 동일 입력 비교는 max abs≤1e-4, cosine≥0.9999를 gate로 두며 미달이면 원인/계약 변경을 보고하고 임의 완화하지 않음 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.segmenter.SegmenterResearchTest'` | research 두 사진·동일 탭의 mask3개 score순, Mac 기준 PNG와 각각 IoU=1.0(연구 대조), 두 번째 tap encoder 추가0. 원본 픽셀 bbox/회전/레터박스·release 후 handle_expired 검사 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.facemask.FaceMaskPrivacyTest'` | 전송본 머리 픽셀0을 **본인 fixture 각 장**에 assert, no-person 전부 실패, negative 세트 사후 제외0. raw/headMask/sidecar 네트워크 전달0, 실패·취소·재시도에서도 HTTP0, EXIF/위치 metadata0, SelfPhoto 실패 교체0 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.facemask.FaceMaskComposeTest'` | calibrated 설정의 경계 동등/초과/측정불가/null 네 경우 자동 판정, faceless와 passed 일관성·안전한 머리 제거·unsafe_output 저장 차단·self_photo_changed·providerFile digest 불변. 실제 수치 산출 함수를 provider fixture로 실행 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.segmenter.MlTimingTest'` | 워밍업 후 5회 중앙값으로 encoder/decoder/PE 및 bridge·표시 가능 시 tap→표시 지연을 분리 기록. research 154.95ms/16.60ms/35.35~39.95ms와 비교표, cold load·최대 메모리·반복 handle 회수 포함. 연구 수치를 앱 SLA로 강제하지 않음 |

### 16 KB 정렬 확인 명령

S00이 선택한 SDK build-tools/NDK 실제 설치 경로로 `ZIPALIGN`, `LLVM_READELF`를 설정한 뒤 실행한다. 이 변수는 도구 실행 파일의 절대 경로이며 `<version>`을 추정해서 쓰지 않는다. 설치 목록은 `sdkmanager --list_installed`로 확인한다.

```sh
"$ZIPALIGN" -c -P 16 -v 4 app/android/app/build/outputs/apk/debug/app-debug.apk
unzip -o app/android/app/build/outputs/apk/debug/app-debug.apk 'lib/*/*.so' -d /tmp/sf-s05-apk-libs
find /tmp/sf-s05-apk-libs/lib -name '*.so' -exec "$LLVM_READELF" --program-headers --wide {} \;
```

- zipalign은 검증 성공이어야 하고, 패키징된 ORT 포함 모든 배포 ABI `.so`의 각 LOAD segment `p_align>=0x4000`, offset/vaddr alignment가 16KB 로딩 조건을 만족해야 한다. 파일 이름만으로 정렬을 추정하지 않는다.
- 검사한 APK/라이브러리 hash·ORT AAR 버전을 기록하고 같은 APK를 위 16KB AVD에서 설치·실제 추론한다. standalone PoC runner 성공은 앱 AAR 성공을 대신하지 않는다.
- 추가 JNI가 필요하면 NDK r28+ 또는 `-Wl,-z,max-page-size=16384` 설정을 S00에 요청한다. Java만 작성했어도 ORT `.so` 검사를 생략하지 않는다. 임시 추출물은 검사 후 회수한다.

### 보정과 최종 합격 경계

D-R9-01에 따른 runtime 자동 판정과 null 설정의 안전한 faceless 경로는 S05에서 완료한다. **실제 품질 임계값은 미확인**이므로 임의 숫자를 제품 설정으로 확정하지 않는다. S11은 research §6.3의 2사진×3방식×low/high 12회 + 우수 조합3회 + 상의1회=16회 실 API PoC로 `version/maxBoundaryColorDeltaE/maxBoundaryOffsetRatio`를 정하고 고정 검증 세트에서 자동 재현한다. S05 완료 보고는 알고리즘/지표/분기 검증과 실측 보정 승인 여부를 분리한다. 미보정 상태에서 합성을 켜지 않는다.

## 완료 보고 형식

- 바꾼 파일: 모델 loader·3 plugin·web·tests 경계별.
- 실행한 명령과 결과: 모델/사진 hash·ORT/ABI·page size·ELF/APK 정렬, Mac 벡터 오차·mask IoU·점수순·지연 비교표.
- privacy 결과: fixture별 registrationOk/exposedHeadPixels/판정, no-person 실패 수, 네트워크0·providerFile digest·임계값 version 및 보정 여부. 실제 사진/좌표/바이트는 로그 첨부 금지.
- 미확인·위험: fixture/GT/기준 벡터 누락, 기기 SQLite 연결, 품질 임계값·실 API 미실행을 구분.
- 계약 변경 요청: 전처리/shape/임계값 측정법/소유권/공유 빌드 설정 변경 필요를 절 단위로 보고.

## 미확인·위험

- 중심점 EdgeTAM과 윤곽 규칙은 사람 의미 검출기가 아니다. no-person fixture의 오검출은 합격 실패이며 입력 파일명/expectedPerson으로 강제 실패시키는 우회는 금지다.
- 모델 실행 성공과 얼굴·머리 안전성은 다른 gate다. fixture 일부를 제외하거나 평균으로 노출 픽셀을 숨기지 않는다. GT 없는 일반 등록을 검증 완료로 표시하지 않는다.
- FaceMask의 이전 S10 소유 표기는 폐기됐다. S05가 native/web 알고리즘, S10은 pipeline, S06은 원자 저장 owner다.
- Mac 연구 결과와 현재 Android resize/ORT 버전 차이는 미확인이다. 성능 숫자를 꾸미지 않고 오차/원인을 보고한다. 모델 준비·원 실험 자료가 누락되면 해당 검증은 미완료다.
