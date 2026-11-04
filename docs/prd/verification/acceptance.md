# 검증과 통합 합격 기준
상태: 확정(R10까지) · 작성 단계의 실행 결과 아님 · S11이 모든 슬라이스 merge 후 통합 실행한다.

## 목표
각 슬라이스의 합격 명령과 전체 사용자 흐름·privacy·남은 실측을 연결한다. mock 통과, 실제 API 통과, 연구/현장 미실측을 구별하고 부분 성공을 전체 합격으로 보고하지 않는다(D-R1-04, D-R7-05).

## 읽을 문서
- [결정 로그](../decisions.md): R0~R9 / [scope](../product/scope.md) / [privacy](../product/privacy.md).
- [relay-api](../contracts/relay-api.md), [agent-tools](../contracts/agent-tools.md), [device-modules](../contracts/device-modules.md), [data-model](../contracts/data-model.md): 계약·검증 절.
- [navigation](../ux/navigation.md), [capture](../ux/capture.md), [search](../ux/search.md), [tryon](../ux/tryon.md), [walk](../ux/walk.md).
- [fixtures](fixtures.md), [S11 실행 인터페이스](../slices/S11-verification.md#구현할-검증-cli), [research §10](../../../street-fitting-research.md#10-남은-미정검증-항목).

## 소유 경로
S11은 `verification/**`, `docs/prd/verification/*`, `scripts/e2e/**`만 변경한다. 앱/relay 결함은 해당 slice가 고친다. CLI 구현과 host smoke는 아래 실행 절에 기록하며, 파일 존재나 host 성공을 Android/live 합격으로 간주하지 않는다.

## 구현 항목
### 슬라이스별 합격 명령 요약
명령은 저장소 루트 기준이다. 단위 구현자는 자기 슬라이스의 **전체** 합격 절을 실행한다. 아래는 주요 진입 명령 요약이며 테스트 생략 허가가 아니다. 각 suite가 0개만 실행되거나 skip/xfail로 필수 항목을 숨기면 불합격이다.

| 슬라이스·웨이브 | 주요 명령 | 관찰할 합격 결과 |
| --- | --- | --- |
| [S00 bootstrap](../slices/S00-bootstrap.md#합격-기준) · 0 | `(cd relay && uv run pytest)`; `(cd relay && uv run python scripts/export_openapi.py --output openapi.json)`; `(cd app && npx openapi-typescript ../relay/openapi.json -o /tmp/sf-relay-api.d.ts)`; `diff -u app/src/generated/relay-api.d.ts /tmp/sf-relay-api.d.ts`; `(cd app && npm run lint && npm run build && npx astryx doctor --built dist)`; `(cd app/android && ./gradlew assembleDebug)` | 웨이브0 유효 입력 7라우트 501, 생성 결정성·drift0, 플러그인/권한/모델 패키징. 기능 merge 뒤에는 501을 요구하지 않음 |
| [S01 relay-core](../slices/S01-relay-core.md#합격-기준) · 1 | `(cd relay && uv run pytest tests/core)` | 인증·HMAC 예산·safe error·무저장 로그·mock 선택/echo/스키마 통과, 실제 upstream0 |
| [S02 relay-search](../slices/S02-relay-search.md#합격-기준) · 2 | `(cd relay && uv run pytest tests/search)`; `(cd relay && SF_REAL_PE_TEST=1 uv run pytest tests/search/test_pe_real.py tests/search/test_pe_research_compat.py -v)` | 4턴/3장·후보 무필터·privacy, 실제 PE checkpoint/512 norm 및 연구 22장×7문구 top3 7/7 대조 |
| [S03 relay-media](../slices/S03-relay-media.md#합격-기준) · 2 | `(cd relay && uv run pytest tests/media)` | 전사/describe/tryon/route 모든 정상·오류·schema·무저장 통과 |
| [S04 app-capture](../slices/S04-app-capture.md#합격-기준) · 1 | `(cd app && npx vitest run src/native/shoppingSession.test.ts src/native/capture.test.ts src/native/media.test.ts src/native/voice.test.ts)`; `(cd app/android && ./gradlew testDebugUnitTest)`; `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.capture.CaptureContractTest,com.streetfitting.app.plugins.voice.VoiceContractTest'` | 촬영/권한/FGS/알림/EXIF/Voice 완료1회. S04의 권한별·최근목록복원·Media·release 제외 명령도 모두 실행 |
| [S05 app-ml](../slices/S05-app-ml.md#합격-기준) · 1 | `(cd app && npx vitest run src/native/photoIndex.test.ts src/native/segmenter.test.ts src/native/faceMask.test.ts)`; `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.streetfitting.app.plugins.photoindex.PhotoIndexResearchTest,com.streetfitting.app.plugins.segmenter.SegmenterResearchTest,com.streetfitting.app.plugins.facemask.FaceMaskPrivacyTest'` | 실제 PE/EdgeTAM 연구 대조·네트워크0·모든 머리 fixture 노출0/no-person 실패. 수치 경계/release/16KB는 S05 전체 절 참조 |
| [S06 app-data](../slices/S06-app-data.md#합격-기준) · 1 | `(cd app && npx vitest run src/data src/native/store.test.ts)`; `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=com.streetfitting.app.plugins.store'` | 삭제표·중복·queue retry·snapshot 독립·native 재시작·privacy |
| [S07 app-agent](../slices/S07-app-agent.md#합격-기준) · 1 | `(cd app && npx vitest run src/agent)` | agent §8 전 시나리오와 추가 변형, 상태/이벤트/음성/검색 데이터 allowlist |
| [S08 app-ui](../slices/S08-app-ui.md#합격-기준) · 1 | `npm --prefix app run lint`; `npm --prefix app run build`; `(cd app && npx astryx doctor --built dist)`; `(cd app && node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock)`; 같은 명령 `--scenario states` | Astryx·route·실제 클릭·화면별 빈/오프라인/실패·dev0, 프로토타입 승인 구분 |
| [S09 app-walk](../slices/S09-app-walk.md#합격-기준) · 1 | `(cd app && npx vitest run src/walk)` | GPX 이탈/재탐색/끝구간/수동도착, Item/Result 목적지·삭제후 snapshot |
| [S10 app-tryon](../slices/S10-app-tryon.md#합격-기준) · 1 | `(cd app && npx vitest run src/tryon)` | 대상1/동반5, 직접자르기/queue, 마스킹→생성→자동 판정→snapshot, raw 업로드0·flag |
| [S11 verification](../slices/S11-verification.md#합격-기준) · 1+통합 | `scripts/e2e/validate-fixtures.sh --all`; `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario full`; 같은 명령 `--mode live`; `scripts/e2e/privacy.sh --run <run-id>` | 모든 아래 E2E 단계 mock/live 각각 1회, privacy 전부 통과. S11 추가 PoC/provenance/16KB/측정/영상 명령 포함 |

일련의 AVD 작업은 상위 한 번의 `scripts/emulator-lock.sh`로 묶는다. 기준 기기(M1 Mac mini 16 GB, D-R10-03)에서 AVD `Medium_Phone` API37/16KB 한 대만 사용하고, 여러 슬라이스를 동시에 실행하지 않는다. 모든 슬라이스 merge 후 통합 담당이 검증을 일괄 실행한다. 도구는 Playwright-Android(WebView)와 adb(시스템 UI, GPS, 녹화)다(D-R10-01).

## 통합 E2E 시나리오
**실행:** `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario full` 후 별도 초기 데이터로 `scripts/emulator-lock.sh scripts/e2e/run.sh --mode live --scenario full`.

mock도 실제 촬영 시각/로컬 ID를 유지한다. relay는 scenario/operation/step으로 fixture를 선택하고 OpenAPI 검증 후 명시 match/ignore 및 요청 echo를 적용한다. 앱 clock/ID seed hook은 추가하지 않는다. live에는 fixture 헤더가 없고 실제 AI/OSRM 응답을 사용한다. camera/voice debug 입력만 합성 fixture이며 저장·ML·VAD·UI를 건너뛰지 않는다.

| 단계 | 하는 일 | 담당 슬라이스 | 관찰 기준·합격 조건 |
| --- | --- | --- | --- |
| 0. 준비 | 모델/인증/relay mode·port·fixture hash 확인, 실제 UI로 과거 trip 생성 후 빈 현재 쇼핑 상태, camera/voice debug source 활성화, `-gpu host` 에뮬레이터에서 앱 WebView WebGL 확인 | S00/S01/S11 | API37 PAGE_SIZE=16384, actual API 키 앱 없음, 모델 누락 fallback 없음, dev 배지0. live는 auth skip0. WebGL을 못 얻으면 지도 단계는 "검증 불가"로 기록하고 성공 처리하지 않음(GPU 이름은 기대하지 않음) |
| 1. 시작 | Home에서 "Start shopping", 위치 허용·알림 허용. GPX 첫 점 주입 | S04/S06/S08/S11 | Trip1 recording+Shop1+trail 생성, 알림 카드1·액션2. 별도 변형에서 위치 거부 생성0/알림 거부 기록성공 |
| 2. Shop 1 | 외관과 옷 사진 촬영, 메모 입력. 외관 묘사 처리 관찰 | S04/S05/S06/S08/S03 | 앱 전용 Photo·GPS/셔터시각, 사진당 index1회, 묘사는 background queue, 카메라 묘사 카드 없음 |
| 3. Shop 2 | GPX 이동 뒤 알림 "New shop" 사용, 파란 재킷 포함 사진/외관 촬영 | S04/S05/S06/S08 | 수동 newShop 1회→n=2, 딥링크 중복 생성0. Shop.spot과 Photo.location 차이를 유지 |
| 4. Shop 3·오프라인 | GPX 이동, 새 가게/사진 촬영. 잠시 offline에서 기록·탐색·저장, reconnect | S04/S05/S06/S08 | n=3, offline 로컬 동작 성공, 외관/이름만 queue. attempts 증가 없음→온라인 foreground 단일 worker 처리 |
| 5. 종료·탐색 | 앱에서 쇼핑 종료, Home 최근 trip→"All trips"→Trip 확인 | S04/S06/S08 | trail0·Trip ended, 사진/가게좌표 남음, 카드/서비스 종료. Trip 안 외관·메모 수정·사진, visit route 없음 |
| 6. 음성 질문 | Find it 마이크 탭, debug WAV 실시간 VAD→무음 자동종료 | S04/S07/S08/S03 | completed1회, PCM16/16kHz/mono/≤15s, 실제 전사 endpoint1회, 전사문 그대로 즉시 검색. Home 마이크0 |
| 7. 에이전트 검색 | "Find the blue jacket in the second shop"를 검색 | S01/S02/S05/S06/S07/S08 | 모든 trip 방문/메모→올바른 Shop2→PE 사진→SAM, ≤4턴/누적≤3사진, 단계 이벤트 실제 순서, 완료 후 한줄 접힘/펼침 |
| 8. 후보 선택/저장 | 첫3 후보·"Show all", 사진 탭 분리 변형, "Use this item"→Item | S02/S05/S06/S07/S08 | 후보 필터링0·실제 윤곽·Show all 추가네트워크0, 동일 후보 두번 저장 Piece1, Item "Original photo" 동작 |
| 9. 옷장 옷 추가 | Wardrobe 촬영/갤러리→tap→cutout 저장/이름, 대상 Item으로 돌아가 피팅 | S04/S05/S06/S08/S10/S03 | wardrobe 원본 HTTP0·cutout만 describe, target은 가게옷1. 옷장옷은 companion으로만 선택 |
| 10. trip 직접자르기 | outfit에서 Trips→Trip→Pick→다른 옷 직접 tap, 잠시 offline 저장 후 복귀·reconnect | S05/S06/S08/S10/S03 | 자동 saved Piece origin=shop, "Picked item"+label_piece, 복귀 draft 유지·추가1·동반≤5, reconnect 이름/종류 갱신 |
| 11. 본인 사진 | 합성 성인 self 등록 및 교체 실패 변형 | S04/S05/S06/S08/S10 | 사람/머리 자동 판정, positive GT 노출0, 실패 등록은 기존 정상본 유지·tryon0. 확인/send 화면 없음 |
| 12. 피팅 생성 | 대상1+옷장1+직접자른1로 생성 | S01/S03/S05/S06/S08/S10 | masked self만+선택 cutout, snapshot 먼저 고정, providerFile 불변, 자동 수치 합격이면 compose/미달이면 faceless. unsafe_output은 실패, 성공Result로 위장 안 함 |
| 13. 결과·내려받기 | Result/Wearing/기록 확인, 다운로드 OFF 상태 확인 | S04/S06/S08/S10 | 실제 결과·snapshot 표시, 비교/재생성0, OFF export0·갤러리 파일0. 승인되지 않은 flag를 켜지 않음 |
| 14. 길 안내 | Result에서 Walk 진입, GPX 정상→이탈→복귀/재탐색→끝구간 | S03/S06/S08/S09/S11 | targetSnapshot.walkTo 고정, 30m/10s/3fix·cooldown, 50m direction/65m 복귀, GeoJSON lng/lat 정상. Item 진입도 별도 변형, Trip/Pick 진입 불가 |
| 15. 도착 | 목적지20m 이내5초·2fix, 외관/주변 확인 후 "Done" | S06/S08/S09 | nearby만 자동, confirmArrival 전 arrived0. 외관/메모 없으면 꾸민 주소0·수동 확인 가능 |
| 16. Photo/trip 삭제 | Photo 하나 삭제 후 trip 삭제 | S04/S06/S08 | 사진/embedding/원본 파일0, job/늦은응답 부활0. trip 삭제 Shop/Photo/Embedding/Trail0, saved Piece cutout/walkTo 동일·참조null, Original photo 연결0 |
| 17. 대상/옷장 삭제 | target Piece와 companion Piece 삭제 후 Result 재열기·길안내 재진입 | S06/S08/S09/S10 | Result·snapshot 파일/이름/외관/목적지 불변, 보기/안내 성공, Change pieces 비활성, 삭제 상세 링크0 |
| 18. 결과 삭제·종료 | Result 삭제, Try-ons/Privacy/빈 목록 재확인 | S06/S08/S11 | 자기 result/provider/snapshot 복사본 제거, 다른 Result·원본 유지, 사라진 상세 복귀0, Privacy 오프라인 열림·정확한 경계 |

추가 오류 변형은 agent §8 전체, 15초/무음, 원격정책거절/timeout, offline 검색·생성·경로, no-person, 품질 임계값 동일/초과/미보정, NoRoute, 권한 거부를 포함한다. 각 단계는 AX/화면 상태와 DB count·파일 존재·메모리 transport assertion을 함께 사용한다. 고정 timer나 toast만으로 저장/생성 합격을 판단하지 않는다.

## privacy 불변식과 검증
`privacy.sh --run <run-id>`가 아래 대응표를 보고한다. relay 기본 metadata 로그는 endpoint·가명·지연·상태·Spark턴만 있으므로 **그 로그만으로 body 비유출을 증명할 수 없다**. HTTP 캡처는 테스트 transport에서 메모리로 디코딩/검사 후 폐기한다. pcap/HAR/body dump를 디스크에 저장하지 않는다. 숫자 카운트·허용 assertion·run ID만 보관하며 실패 에러에도 body를 출력하지 않는다. fixture recorder는 승인 합성 자산의 별도 명시 작업이다.

| 불변식·근거 | 담당 | 검증 방법·합격 |
| --- | --- | --- |
| raw self/headMask 어떤 HTTP에도 없음; 마스킹 실패 요청0 (privacy 1~2, D-R9-01) | S05/S10/S11 | raw sentinel 접근/전송 spy와 decoded image GT 역추적. positive 전부 exposedHeadPixels=0, no-person 전부 실패. 오류/취소도0 |
| self1+옷≤6, shop target만 (3) | S03/S10 | 앱 serializer·relay 입력 부정 테스트, 초과 provider0, metadata 호출수와 대응 |
| 종료 trail0·좌표 유지, 삭제 연쇄·job 부활0 (4~6) | S04/S06 | SQLite/Store count·파일 hash·진행중 응답 경합 assert, 외부 전송 캡처에 trail 없음 |
| Spark 검색 요약에 메모 포함/좌표·이미지·mask·embedding 없음 (7) | S02/S07 | 앱→relay 및 relay→Spark 검색 body allowlist. describe 이미지 허용과 구분, 검색 token history도 검사 |
| 옷장/직접자른 shop 이름은 cutout만, 원본 없음 (8, D-R9-02) | S03/S06/S10 | describe-piece decoded image가 승인 cutout과 일치, origin/좌표/원본 필드 없음 |
| 질의 5번째 Spark/4번째 SAM 차단 (9) | S01/S02/S07 | 최신 토큰 체인 입력 부정 테스트, provider 호출0 및 metadata 턴수; fork 방어는 범위 밖 |
| WAV≤15s·Find it만 마이크 (10) | S03/S04/S07/S08 | 실제 sample수·VAD completed1회·AX, 빈 음성 search0·임시 WAV 회수 |
| 내보내기 GPS0·앱 좌표 불변·결과 OFF export0 (11) | S04/S10/S11 | EXIF 검사·MediaStore 전후·provider hash/provenance 비교, 미검증 flag OFF |
| route→OSRM, 타일→OpenFreeMap, 좌표 Meta0 (12) | S03/S09 | outbound host/path/허용 필드 memory capture, Meta body 좌표0, 로그 OSRM URL0. 지도 영역 전송은 명시 허용 |
| 로그/파일/DB에 요청 미디어·좌표 없음 (13) | S01~S03/S11 | default/text flag 양쪽 metadata allowlist와 파일쓰기/temp/DB spy, 성공/오류/취소/validation 검사. query/Spark text 허용 예외에도 좌표0 |
| offline 로컬 가능, 묘사/이름만 queue (14) | S06~S10 | offline HTTP0, 허용 QueueJob kind 두개만, 온라인 단일 재개·중복0 |
| Result 독립 snapshot (D-R9-03) | S06/S09/S10 | target/trip 삭제 후 snapshot 이미지·가게 표시·walkTo 유지, 결과 자기 삭제만 복사본 제거. snapshot 원본 self/Photo/Shop.spot 없음 |
| 앱 키·원본 UID/토큰 유출 없음 (D-R6-01) | S00/S01/S11 | 번들/fixture 공개 검사, outbound safety_identifier 가명, 로그 인증/키0. dev UI0 |

## research 10장 잔여 검증
기존 연구 실측을 앱 통과로 간주하지 않는다. 다음을 `scripts/emulator-lock.sh scripts/e2e/measure.sh --suite research10 --mode live --full-run <live-full-run> --poc-run <16-call-run> --seed-search`와 각 전용 명령으로 기록한다. 수치 SLA/정확도 목표가 합의되지 않은 행은 임의 임계값을 만들지 않고 측정 자체의 완전성과 기능 계약을 합격으로 둔다 [추론·검증 기준]. 현장·실기기 부재는 미확인으로 남기되 이번 에뮬레이터 납품 조건과 분리한다.

| research 항목 | 현재 남은 것·담당 | 검증/합격 조건 |
| --- | --- | --- |
| 마스킹 피팅·재합성 | 실 Muse Image/자동 임계값 · S05/S10/S11 | `tryon-poc.sh --plan 16 --mode live`: 12+3+1 입력/결과 수치, positive 머리0/no-person 실패, 네 지표/thresholdVersion 고정·검증 재현. 초과 자동 faceless, unsafe 출력 실패 |
| 영어 질의 해석 | 실제 모델 가게/시간/메모/과거trip · S02/S07/S11 | agent §8의 의미별 정답 도구/범위·실제 출력 기록. 사전 정답 세트 전부 올바른 ref/시간·4턴 이내, 실패는 미발견/오류와 구분. 구 범위칩 대안은 D-R3-06으로 폐기 |
| 실제 매장 사진 검색 | 합성 외 실제 현장 품질 미확인 · S02/S05/S11 | 연구 호환 22장×7문구 top3 7/7 재현은 필수. 별도 합성/확보된 허용 실제사진 세트 top1/top3 분모·정답 기록. 실제 사진 미확보면 실제 매장 적중률 미확인이라고 명시 |
| SAM 후보 품질 | 실개념 분할 · S02/S05/S11 | 선택 가능한 실제 mask·bbox·점수·후보 수와 정답 IoU 기록, 낮은 점수 제거0, 0후보에서 EdgeTAM fallback으로 사용자 선택 가능. 임의 IoU 목표 없음 |
| 가게 방문 구분 | 자동 알고리즘은 D-R2-03으로 폐기 · S04/S11 | 3가게 GPX에서 수동 New shop만 n증가, 이동만으로 증가0. 현장 자동 경계 튜닝을 납품에 추가하지 않음 |
| 외관 묘사/가게 찾기 | 합성 시연 외 현장 일반화 미확인 · S03/S07/S11 | 서로 다른 외관3개 설명·색/특징 질의 정답 가게 선택, 지명/브랜드/신원 추측0; 메모/방문순서 탐색 대안 작동 |
| 쇼핑 모드 배터리 | 실기기1시간 소모 미확인 · S04/S11 | 에뮬레이터1시간 FGS/위치/서비스 유지·요청 주기 기록. 이를 실제 배터리 수치로 보고하지 않음. 실기기 실측은 이번 D-R7-05 범위 밖 |
| API 지연 | 실제 Spark/SAM/Image/Voice/route · S01~S03/S11 | endpoint별 요청수·성공/실패·wall time·timeout·p50/p95(표본수 함께) 기록, 계약 deadline·중복 재시도0·진행 상태 동작. 미합의 UX 지연 SLA 발명 금지 |
| 앱 종단 지연·메모리 | 질의→후보·모델/화면 수명 · S05/S07/S11 | `adb shell dumpsys meminfo com.streetfitting.app` 및 monotonic 타이밍, 초기/반복 피크·해제 뒤 값 기록, OOM/ANR/잘못된 성공0. standalone 수치를 앱 성능으로 전용하지 않음 |
| relay 메모리/콜드스타트 | 로컬 Mac PE loader · S01/S02/S11 | cold/warm startup 시간·peak RSS·모델1회 load 기록, 요청마다 재로딩0. Cloud Run 1GiB/2GiB 선택은 D-R6-05로 폐기 |
| 도착 확인 | GPX와 현장 확인 구분 · S09/S11 | GPX 경계/외관 유무·수동확인 통과, 자동 arrived0. 붙은 실제 점포 재발견은 현장 미실측으로 남김 |
| DAT Mock | D-R2-06 제외 | 검사/구현하지 않음. debug Capture fixture 검증으로 현재 요구 충족 |
| 워터마크·메타데이터 | 실 provider 보존 미확인 · S03/S04/S10/S11 | `provenance.sh`: 원본 바이트 불변·워터마크/provenance/GPS 동시 보존 검사. 확인 불가/실패면 다운로드 OFF가 합격 상태, 켜면 불합격 |
| Android 16KB | 실제 앱 AAR/ZIP/ELF·추론 · S00/S05/S11 | `android-pages.sh --apk <apk>`: ZIP 및 각 packaged arm64 .so alignment, PAGE_SIZE16384, 실제 모델 load/index/tap/mask 성공. 라이브러리 버전만으로 합격하지 않음 |

## mock 경계와 의존
단위 합격은 해당 slice mock 경계에서, 통합은 실제 native+mock relay 및 실제 native+live relay로 나눈다. mock route/Map은 네트워크 없는 adapter로, live Map은 실제 타일로 확인한다. 에뮬레이터 입력 fixture 사용 사실을 demo/검증 보고에 기록하되 앱 dev 배지를 추가하지 않는다. API/model/Firebase 준비 부족은 skip 성공이 아니다.

## 합격 기준
- 위 슬라이스 명령의 필수 gate와 mock/live E2E 모든 단계·privacy 행이 통과해야 구현 통합 합격이다.
- 프로토타입 새 배치/문구 승인은 S08의 별도 표시 항목이다. 승인되지 않은 화면을 확정 완료로 주장하지 않는다.
- research 측정은 실제 모수·수치·미확인 구분을 제공해야 한다. 허용된 faceless/다운로드 OFF를 결함으로 바꾸거나 실패 결과를 성공으로 속이지 않는다.
- `scripts/emulator-lock.sh scripts/e2e/demo.sh --mode live --seconds 180`으로 실제 API 3분 영상과 public 저장소 제출 준비를 확인한다. APK·클라우드 배포는 하지 않는다(D-R8-01).

## 완료 보고 형식
- 바뀐 파일/fixture manifest/영상/결과 경로.
- 실제 명령·run ID·mock/live·기기/API/모델 버전·통과/실패·미실행 구분.
- 미확인·위험과 research 표 행별 증거. 숫자 없는 항목을 추정해 채우지 않는다.
- 계약 변경 요청 또는 "없음". 결함은 담당 slice·재현 명령·기대/관측을 함께 보낸다.

## 미확인·위험
Host 구현 smoke 범위는 아래에 기록한다. 전체 Android/live 합격은 아직 미확인이다. 개인정보 무저장은 앱/릴레이 경계의 보장이고 Meta 서비스의 즉시 삭제를 보장하지 않는다. 생성 fixture 성공이 실제 사람/실제 매장의 일반 성능을 증명하지 않는다.

## S11 실행 구현과 남은 입력 (2026-11-04)

`scripts/e2e/entry.py`가 10개 shell CLI의 실제 backend다. 종료값은 passed=0, failed=1, blocked/사용법=2이며 새 `verification/results/<UTC-operation-id>/summary.json`에 상태를 남긴다. 예전 결과를 덮어쓰지 않는다. shell은 임의 cwd에서도 저장소 루트로 이동하며 relay의 uv 환경을 사용한다. `scripts/e2e`의 `npm ci`로 Playwright-Android 의존성을 설치한다.

- Android APK는 `VITE_SF_VERIFICATION=1`, `VITE_SF_RELAY_MODE=mock|live`, mock의 `VITE_SF_FIXTURE=e2e`로 빌드한다. native `FLAG_DEBUGGABLE` 확인 뒤 읽기 전용 `window.__sfVerification.inspect()`를 사용한다. 서비스/state setter나 JS clock/ID override는 없다.
- 기기 명령은 `ANDROID_SERIAL`과 상위 `scripts/emulator-lock.sh`를 요구한다. 앱 전용 `getFilesDir()/capture-fixtures`, `capture-cases/<case>`, `voice-fixtures`만 사용한다. shell 임시파일→`run-as cp` 후 임시파일 제거, root/권한 우회/외부 저장소 fallback 없음. 모든 `am start`/deep link에 현재 source/directory extras를 보존한다. 실제 Home으로 Capture를 unmount한 뒤 새 intent/reopen으로 source를 교체한다. `MainActivity.onNewIntent`의 실제 intent 갱신과 두 폴더/index reset은 M1 검증 항목이다.
- full은 실제 UI로 과거2가게 trip, 현재3가게 trip, 검색/저장, Item/Result Walk, 두 조합의 Result를 만든다. 한 Result 삭제 시 다른 Result의 row·모든 복사본 hash 불변을 확인한 뒤 두 번째를 삭제한다. 자체 파일 삭제와 PhotoEmbedding cascade도 확인한다. 추가 오류/경합 변형의 slice suite를 대체하지 않는다.
- mock route는 `e2e-route-start`/`e2e-route-reroute`, 두 번째 조합은 `e2e-tryon-other`(동반1), 분할 tryon 영상은 `e2e-tryon-target-only`(동반0)를 사용한다. harness phase/path만으로 실제 POST의 `X-SF-Fixture` 헤더를 바꾸며 body/response는 그대로 전달한다. 좌표·동반 수를 ignore하지 않으며 잘못된 값은409이다. live는 헤더 interception을 설치하지 않는다. 실제 Android WebView의 header 전달은 **미확인**이며 host Chromium 성공으로 대신하지 않는다.
- `privacy.sh`는 실제 ASGI 입력/HTTPX Meta·OSRM 출력, request-context 파일/DB audit, metadata 로그를 검사한다. body는 메모리에서 폐기하며 hash/count/허용 assertion만 저장한다. native Store 파일 hash inventory와 실제 12개 head 검사 결과를 결합한다. 앱 inspector counter 범위는 `relay-attempts/shared-file-reads/media-export-attempts`이며 native 전체 호출 spy라고 주장하지 않는다. 다운로드 차단은 별도 실제 native export 실패·MediaStore 전후로 확인한다.
- `tryon-poc.sh --plan 16 --mode live`는 12개 calibration 뒤 사람의 구도 승인/최적 mode 선택을 기다리고 `--resume <run-id>`로 나머지3+1을 실행한다. 원본 provider bytes는 로컬 `~/.cache/street-fitting/poc/<run-id>/`에 보관한다. 자동 metric/thresholdVersion과 held-out 재현을 기록하지만 product threshold를 몰래 승격하지 않는다. `provenance.sh --run <poc-run> --app-run <full-run>`으로 실제 앱 download-OFF 증거를 연결한다. 워터마크 판정 미확인은 그대로 OFF이다.
- `measure.sh`는 원본22×7 native proof, 실제 query/SAM 결과·IoU, 1시간 background FGS, 실제 ASGI endpoint 지연·모델 load/encode와 app PSS/relay RSS 표본을 연결한다. `--seed-search`만 S11 test APK의 실제 native repository/인덱싱을 통한 과거 합성 방문 import를 허용한다. 합성 embedding 주입이나 실제 연구 수치 대체는 없다. 표본 peak는 무관측 구간의 절대 peak가 아니다.
- 영상은 `demo.sh --mode live --segment shopping|search|tryon|walk --seconds <1..180>`를 순서대로 실행하고 `demo.sh --concat --inputs <shopping-run> <search-run> <tryon-run> <walk-run>`으로 합친다. 단일 full 영상도 가능하나 실제 시나리오가 녹화시간을 넘으면 실패한다. concat은 성공 live 입력과 전체 흐름 순서, 최종180초 이하, ffmpeg 끝까지 decode를 요구한다.

### 사람이 제공해야 하는 입력

현재 승인/GT는 **0**이다. 생성 초안은 parser/replay smoke에만 사용하며 승인 corpus로 취급하지 않는다.

1. `verification/fixtures/review/head.json`: 12개 정확한 case의 사람 annotation/classification·검토자/일자·source/GT hash. positive6은 실제 머리 GT, negative6은 사람 판정이 필요하다. 자동 person-mask proof는 GT가 아니다.
2. `verification/fixtures/masks/items/cases.json`, `review/items.html`: 실제 사람의 옷 경계 annotation/검토를 `import_review.py --kind items`로 반영한다. manifest public-use 승인과 각 relay recording 승인은 별개다.
3. `verification/fixtures/review/search.json`: `humanAttestation:true`, `reviewer`, `reviewedAt`, `fixtureSha256`(`store/search.json`), 정확한9개 `cases` ID(`normal`, `shop-specific`, `time-specific`, `note-specific`, `past-trip`, `not-found`, `storefront-1..3`). 각 case에 실제 영어 `query`, `expectedStatus`(`results|not_found`), `relevantPhotoIds`, 필요 시 `expectedShopIds`, `maskGroundTruth`(photo ID→GT 경로), `groundTruthSha256`(경로→SHA256)을 기록한다. `time-specific.expectedTime={kind:"relative-minutes",minutes:N}`, `past-trip.expectedTime={kind:"saturday",last:true}`를 요구한다. `storefronts`는 서로 다른3가게의 `{shopId,image,sha256}`이며 해당 자산도 public-use 승인 대상이다.
4. 원본 연구 파일: validator는 `verification/fixtures/research/retrieval/results.json`과 원본22장/7문구·embedding을 요구한다. M1 native bundle은 `/tmp/sf-s05-proof`이며 `SF_ML_PROOF_DIR=/tmp/sf-s05-proof`로 지정한다. `research.json` root는 `images`, `queries`, `segmentation`, `checkpointSha256`; image는 `{id,source,sourceSha256,canonical,canonicalSha256,vector}`, query는 `{query,relevant_ids,vector}`, segmentation은 `{image,x,y,masks,sourceSha256}`이다. vector는512개 little-endian float32 파일, masks는3개 `.u8` 파일이다. adapter는 원본/canonical hash·RGB pixel identity·checkpoint hash를 검사한다. M1 제공 schema를 사용한 host 경계 smoke만 수행했으며, 원본 bundle 실행은 M1 gate다. 원본 연구 path remap만 허용하고 새 embedding/GT 재export나 `SF_MODELS_DIR` 변경으로 대체하지 않는다.
5. 승인 가능한 영어 speech WAV와 자산 배포/생성 서비스 조건 확인. Apple `say` 출력은 commit/배포하지 않는다. `fixture_manifest.py`는 파생 JPEG source/output hash만 연결하며 사람 승인을 만들어내지 않는다.

Host에서 최신 19개 relay scenario/337개 자산의 구조 검사와 production loader replay가 통과했다. `validate-fixtures.sh --all`은 오류0, 승인/GT/원본 연구 누락163건으로 blocked(2)이며, 실제 fragmented ASGI 입력200·privacy 거부 경계·16KB ELF/ZIP parser·host Chromium header-only forwarding만 smoke했다. 성공 fixture의 full-person 응답과 `unsafe-provider`의 head-removed 응답은 둘 다 명시적 수기 합성·미승인 자산이다. Android visual/native/model/live, 실제 corpus 품질·최종3분 영상은 M1에서 실행 전까지 **미확인**이다.
