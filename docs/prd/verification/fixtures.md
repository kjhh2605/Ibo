# 검증 fixture 명세
상태: 계약 확정(R10까지) · 2026-11-04 보존된 생성 원본으로 portable corpus 재생성·host CLI 검증 완료 · 사람 GT/공개 승인/영어 음성/M1 연구 자료 미충족으로 전체 gate는 **blocked(exit 2)**. 아래 실행 관측은 앱 E2E 합격이 아니다.

## 목표
다른 슬라이스가 실제 개인정보 없이 같은 사진·시각·GPS·음성·응답으로 재현 가능하게 만든다. 합성 검증 자산과 실제 사용자 데이터, provider 원본과 앱 파생 파일의 경계를 유지한다(D-R1-04, D-R7-06, D-R9-01).

## 읽을 문서
- [결정 로그](../decisions.md): R7~R9.
- [relay-api §7](../contracts/relay-api.md#7-mock-녹화-선택-계약), [agent-tools §8](../contracts/agent-tools.md#8-mock-fixture가-담아야-할-시나리오).
- [device-modules](../contracts/device-modules.md): Capture fixture, Voice, FaceMask 자동 평가, Walk.
- [data-model](../contracts/data-model.md): 엔티티·스냅샷 / [privacy](../product/privacy.md): 무저장·허용 경계.
- [S11](../slices/S11-verification.md), [통합 합격 기준](acceptance.md).

## 소유 경로
S11만 `verification/**`, `docs/prd/verification/*`, `scripts/e2e/**`를 변경한다. 앱/릴레이/shared script와 계약은 변경하지 않는다. 아래 경로는 산출물 이름 계약이며, 현재 생성 여부·미충족 항목은 마지막 실행 관측 절을 따른다.

## 구현 항목
### 1. 공통 manifest와 목록
`verification/fixtures/manifest.json`은 각 asset의 상대 경로, SHA-256, MIME·크기·해상도/오디오 길이, 생성 도구/버전/날짜, prompt 또는 제작 절차, sourceType, 출처 URL/원본 ID, 이용조건 URL·확인일, 파생 부모 hash, 사용 slice/scenario를 담는다. sourceType은 `codex-generated`, `hand-authored`, `macos-say`, `provider-recording` 등을 구분한다 [추론·검증 형식]. 생성물이라고 임의 CC0/MIT 라이선스를 붙이지 않는다. 이용조건 미확인 자산은 public 저장소 포함 승인을 하지 않는다(D-R7-06, D-R8-01).

| 경로 | 만드는 방법·필수 내용 | 사용 슬라이스 | 출처·라이선스 기록 |
| --- | --- | --- | --- |
| `verification/fixtures/images/shops/shop-{1,2,3}-items.png` | Codex로 서로 다른 옷/배경의 가게 사진. 파란 재킷·줄무늬·회색/빨강 구별, 복수 후보 포함 | S02/S04/S05/S07/S08/S10/S11 | Codex 생성 버전·prompt·조건 URL/확인일 |
| `verification/fixtures/images/storefronts/shop-{1,2,3}.png` | 서로 다른 외관(예: 파란 천막), 지명/실제 상표·개인정보 없이 생성. 외관 없는 가게 변형도 둠 | S03/S04/S06/S07/S08/S09 | 동일 |
| `verification/fixtures/images/wardrobe/*.png` | 청바지·신발 등 함께 입을 옷. 원본과 실제 mask 적용 RGBA cutout을 구별 | S03/S05/S06/S08/S10 | 생성 원본·파생 부모 hash |
| `verification/fixtures/images/self/positive/*.png` | 성인 합성 정면 전신 최소 2장. 장발/모자 등 지원 의도 사례 포함, 평가 전에 positive 목록 고정 | S05/S10/S11 | 합성 성인, 실제 사용자 사진 사용 안 함 |
| `verification/fixtures/images/self/negative/*.png` | 반신·목 가림·다인·머리 프레임 잘림 등 거부 의도 세트 | S05/S10/S11 | 생성 prompt·거부 의도 사전 기록 |
| `verification/fixtures/images/self/no-person/*.png` | 옷걸이/빈 배경/사람 형태 유사 물체, 반드시 register 실패 | S05/S10/S11 | 생성 출처·negative 분류 |
| `verification/fixtures/masks/head/<image-id>.png` | 사람이 얼굴·머리카락 전체를 직접 표시한 0/255 GT, 원본과 동일 정방향 w×h | S05/S10/S11 | annotator·일시·원본 hash·검토 기록 |
| `verification/fixtures/masks/items/**` | 손으로 검토한 SAM/EdgeTAM 마스크·bbox·탭 좌표·점수, 4개 이상 SAM 후보와 3개 tap mask | S02/S05/S07/S08/S10 | 수기 GT와 provider 산출물 구분, provider 원본 출처 |
| `verification/fixtures/images/derived/**` | 실제 mask 적용 cutout, opaque masked self, compose/faceless 예제. raw를 이름만 바꾸지 않음 | S05/S06/S08/S10 | 부모 hash·변환 규칙·모드/offset 로컬 sidecar |
| `verification/fixtures/store/search.json` | agent §8의 오늘/2026-10-31 두 trip, 각각 Shop 1/2, 고정 시각·메모·photo refs·512차원 정규화 벡터 | S06/S07/S08 | 수기 합성 DB seed, 이미지 provenance 연결 |
| `verification/fixtures/store/e2e.json` | 지난 trip seed와 새 촬영용 manifest. 현재 3가게 trip은 UI로 만들어 seed로 완료를 가장하지 않음 | S04/S06/S08/S11 | 수기 seed, 앱 데이터 DTO 준수 |
| `verification/fixtures/gpx/shopping-three-shops.gpx` | 촬영 중 3곳 이동, shop 시작/셔터 위치가 다른 구간, `<time>` 포함 WGS84 track | S04/S06/S11 | 수기 합성 GPS, 실제 사용자 이동 기록 아님 |
| `verification/fixtures/gpx/walk.gpx`, `walk-off-route.gpx`, `walk-boundaries.gpx` | 정상/이탈/재탐색/50·65m/20m·도착/정확도 변형 | S09/S11 | 수기 GPX, accuracy/기대 이벤트는 `*.expected.json` sidecar |
| `verification/fixtures/audio/query.wav`, `silence.wav`, `limit-15s.wav`, `over-15s.wav` | query는 동의·재배포 허가를 받은 실제 사람의 영어 녹음, 나머지는 결정적 PCM 신호. 16 kHz mono PCM16, 마지막 파일은 거부 전용 | S03/S04/S07/S11 | 사람 녹음 hash·발화·동의·권한; Apple System Voice 출력은 배포하지 않음 |
| `verification/fixtures/relay/<scenario>/**` | 아래 키 선택·명시 match/ignore·ref echo 녹화, 응답 assets 포함 | S01/S02/S03/S06/S07/S09/S10/S11 | 수기 오류인지 provider recording인지 명시, 실제 출력 provenance 보존 |
| `verification/fixtures/quality/thresholds.json`, `cases.json` | PoC로 정한 thresholdVersion·색 차이/어긋남 임계값·보정/고정 검증 세트; 미보정은 null | S05/S10/S11 | PoC run ID·산정 근거, 임의 숫자 금지 |
| `verification/fixtures/capture/` | 위 생성 이미지의 파일명순 촬영 staging 사본. S04 push-fixtures 입력과 일치 | S04/S11 | 원본 manifest hash 연결, 별도 생성 출처로 꾸미지 않음 |
| `verification/fixtures/voice/` | audio 원본의 순서 지정 WAV staging 사본. S04 adb push 입력과 일치 | S04/S11 | 원본 WAV hash 연결. E2E normal 폴더에는 정상 query만, 오류 suite는 해당 변형만 배치 |
| `verification/fixtures/research/**` | 사용자 준비 연구 자산의 22장/7문구·두 tap 이미지·Mac mask/vector·모델 revision/전처리 manifest를 수집 | S02/S05/S11 | 기존 연구의 원출처/이용조건과 hash 유지. 누락 자료를 새 합성 그림으로 바꾸어 연구 재현이라고 하지 않음 |

### 2. Codex 이미지 생성 절차
근거: D-R7-06. 보존된 Codex 0.166 비대화 생성 원본 2개와 당시 invocation/prompt/sourceId는 `source/generation.json`에 있다. 이번 작업에서는 새 image generation을 호출하지 않았고, 기존 원본 hash를 고정해 재사용했다. 다음은 새 원본이 필요한 경우의 절차다.
1. `codex --version`, `codex --help`, `codex exec --help`로 설치 버전과 출력/이미지 저장 지원을 먼저 읽는다. 문서화된 image_generation 사용법으로 작은 합성 테스트 이미지를 만들고 실제 이미지 파일이 저장되는지 확인한다. 텍스트 `--output-last-message`가 이미지 저장을 보장한다고 가정하거나 지원하지 않는 flag를 발명하지 않는다.
2. 비대화 저장이 지원되면 확인한 명령·실제 출력 경로를 provenance에 기록하고 위 목록을 생성한다. 지원하지 않으면 `codex` 대화형에서 같은 prompt로 생성 후 실제 생성 파일을 지정 fixture 경로로 옮긴다. 화면 캡처를 생성 원본이라고 기록하지 않는다.
3. 인물은 성인 합성·가상의 인물임을 prompt에 명시한다. 실제 사용자의 얼굴/사진·상표·주소·촬영 GPS를 입력하지 않는다. 원하는 장발/모자/다인/사람 없음 속성이 실제 출력에 있는지 사람이 확인한다.
4. 생성 일시/도구·prompt·부모·이용조건·hash를 manifest에 기록한다. 검사 후 해상도·방향을 고정하고 GT를 작성한다. 이미지 수정 후에는 hash와 GT를 함께 갱신한다.

### 3. GPS와 촬영 입력
근거: D-R2-03, D-R5-04, D-R7-10.
- GPX는 lon/lat/time를 가진 합성 경로다. `shopping-three-shops`의 각 가게에 도착한 뒤 사용자가 "New shop"/셔터를 누르는 checkpoint를 sidecar에 둔다. 자동 가게 판정 시험이 아니다.
- walk trace는 같은 대상 Photo.location을 목적지로 사용한다. Shop.spot과 충분히 다른 좌표를 넣어 잘못된 목적지 선택을 검출한다. 경로 끝 waypoint와 실제 목적지 차이도 포함한다.
- replay는 S00 `scripts/gpx-replay.sh`를 사용하고 내부적으로 `adb -s "$ANDROID_SERIAL" emu geo fix <lng> <lat>`를 호출한다(에뮬레이터 콘솔 `geo fix`, D-R10-01). 다른 GPS·카메라 주입 도구를 가정하지 않는다. accuracyM은 GPX 표준 필드로 속이지 않고 unit mock sidecar에 주입하며, AVD 실제 accuracy는 관측값을 보고한다.
- 촬영 폴더는 UTF-8 파일명 순서이므로 `01-shop1-storefront.png`, `02-shop1-item.png`처럼 셔터 일정에 맞게 배열한다. debug extra `sf_capture_source=fixture`, `sf_capture_fixture_dir=/sdcard/Android/data/com.streetfitting.app/files/capture-fixtures/`를 사용한다. EXIF 시간이 아닌 셔터 시각과 주입 GPS가 DB에 들어가야 한다.

### 4. WAV 제작과 배포 경계
Apple `say` 출력은 공개 fixture로 배포하지 않는다. 기존 say 예제는 배포 절차에서 제거했으며 `build_fixtures.py`도 say/afconvert를 호출하지 않는다. `query.wav`와 `voice/normal/01-query.wav`는 실제 사람의 영어 녹음·명시 동의·재배포 권한을 받은 뒤 `import_review.py --kind speech`로만 등록한다. 아직 두 경로 모두 배포용 입력이 없으며 `--all`은 이를 nonzero로 보고한다.

형식은 RIFF PCM format=1, 16bit/16000Hz/1ch, 실제 samples≤240000이다. 발화 뒤 1초 무음을 **샘플로** 붙인다. importer는 유효 wire WAV, 발화 구간의 비영(非零) samples, 마지막 16000 samples의 무음을 검사한다. 이는 영어 발화나 사람 출처를 자동 판정하는 모델이 아니므로 실제 reviewer의 발화·출처 확인도 필요하다.

`build_fixtures.py`는 silence=80000, limit-15s=240000, over-15s=240001 samples를 만들고 staging에 byte-identical 복사한다. `tone-silence`는 400ms 220Hz + 1초 무음, `leading-5s`는 5초 무음 뒤 400ms 신호다. 이 신호는 amplitude VAD/경계 시험용이며 영어 음성·전사 품질의 대체물이 아니다. mock transcribe의 silent WAV→수기 문장은 wire replay일 뿐 실제 전사 증거가 아니다.

음성 E2E는 [device §8](../contracts/device-modules.md#8-voice--s04)의 debug 전용 `sf_voice_source=fixture`, `sf_voice_fixture_dir=/sdcard/Android/data/com.streetfitting.app/files/voice-fixtures/`를 사용한다. WAV를 adb push한 뒤 Find it 마이크를 누르면 start마다 파일명순 PCM을 실시간 속도로 **실제와 동일한 VAD**에 공급한다. 무음 자동 종료→completed 1회→실제 전사 endpoint 연결까지 검증한다. 직접 WAV를 HTTP로 보내는 시험만으로 native VAD 검증을 대체하지 않는다. 호스트 마이크/사람 발화는 합격 기준이 아니다. release에서는 extra/fixture 코드가 없고 화면 표시도 없어야 한다(D-R7-10 원칙 확장의 계약상 [추론·기술 결정], D-R7-07).

### 5. relay mock과 실제 API 녹화
근거: [relay §7](../contracts/relay-api.md#7-mock-녹화-선택-계약), D-R1-04, D-R6-04.
- 디렉터리 `relay/<scenario>/`, 파일 `<operation>.<step>.request.json`의 `{expected:object,match:string[],ignore:string[]}`, `.response.json`의 `{status,body,headers?}`, 바이너리는 `assets/`다. operation은 search-turn/search-segment/transcribe/describe-storefront/describe-piece/tryon/route다.
- 응답 선택 키는 **(scenario, operation, step)**다. search-turn step은 Spark 턴 번호, segment는 전송 전 samPhotos+1, 나머지는 01이다. query·시각·ID·미디어 digest로 다른 응답을 검색하지 않는다. 미등록 키는 501 `fixture_not_found`, match 불일치는 409 `fixture_request_mismatch`이며 첫 불일치 JSON pointer만 오류에 쓰고 입력값은 쓰지 않는다.
- match/ignore는 RFC 6901 JSON pointer 목록이다. 시각(`/context/now`, 각 takenAt), 불투명 ref/toolCallId, base64 data, queryToken은 해당 실제 경로를 ignore에 명시한다. digest 비교도 하지 않는다. 객체/배열 match는 하위 ignore 값만 제거한 나머지 값·길이·순서를 정확히 비교한다. wildcard/regex/임의 코드, 동일 pointer의 match+ignore는 금지다.
- 모든 입력의 OpenAPI·인증·토큰/pending/ref 관계·4턴/3장/7장/15초·미디어 실제 형식 검사는 항상 실행한다. ignore는 녹화값 비교만 생략한다. 최종 응답도 echo·asset 치환 후 OpenAPI로 검증한다.
- response ref는 `"{{toolResults[0].result[0].photoRef}}"`, `"{{photos[0].photoRef}}"` 같은 현재 요청 echo로 치환한다. list_visits 결과는 실제 schema의 `.result.visits[index].shopRef` 경로를 사용한다. ref가 아닌 값/누락 경로/미해결 placeholder는 500 `fixture_invalid`다. 문자열 전체의 dot 경로/숫자 인덱스만 허용하며 임의 연산은 없다. 치환 ref를 후속 token history/pending에도 사용한다.
- response queryToken은 저장하지 않고 runtime에서 발급한다. data 자리는 `{asset:"assets/..."}`로 관리하고 wire 전 base64로 확장한다. mock 헤더 `X-SF-Fixture`는 live로 보내지 않는다. 실패에 다른 fixture/live fallback은 없다.
- 필수 scenario: `normal`, `shop-specific`, `time-specific`, `note-specific`, `past-trip`, `not-found`, `turn-limit`, `voice-empty`, `photo-limit`, `upstream-timeout`, `tryon-policy`, `route-unavailable`, `direct-cut-shop`. agent §8 추가 변형과 label queue·마스킹 실패·download OFF도 앱 fixture로 포함한다.
- 웨이브 1에는 합성 입력과 계약에 맞는 수기 mock 응답으로 준비한다. 수기 성공 응답을 실제 API 녹화라고 쓰지 않는다. 실제 API 사용은 통합 단계에만 허용한다.
- 통합에서 `scripts/e2e/record-relay.sh --scenario normal --source live`를 사용한다. 이 도구는 **별도 S11 검증 클라이언트**이며 승인된 manifest 합성 자산만 허용한다. Firebase/App Check·Meta 키는 환경/저장소 밖 자격 증명으로 공급한다. 앱과 같은 목적별 endpoint를 호출하고 응답은 클라이언트가 메모리에서 검토·정규화하여 승인 fixture만 명시 저장한다.
- relay 프로세스에 자동 녹화/body dump를 추가하지 않는다. recorder는 token/auth/UID를 제거하고 response ref를 요청 echo로 바꾸며 request에는 expected/match/ignore를 명시한다. provider 원본 파일 bytes·워터마크·메타데이터를 보존한 뒤 schema 검사한다. asset SHA-256은 무결성/provenance용 manifest에만 쓰고 mock 요청 선택·비교에는 쓰지 않는다. provider/model 버전·날짜·출처·조건을 manifest에 기록한다. 원본 self/headMask는 recorder 입력 allowlist 밖이다.

| operation | match에 넣을 의미 필드 | ignore/응답 처리 |
| --- | --- | --- |
| search-turn 첫 요청 | `/query`, `/context/timeZone` | `/context/now` ignore. 이후 tool 이름·의미 결과 구조를 검증하고 toolCallId/시간/ref/token을 ignore |
| search-turn 도구 결과 | `/query`, `/toolResults/0/name`, 방문 목록의 n/note/descriptionState 등 scenario 의미, 사진 결과/후보 요약 배열 길이와 점수/개수 | 실제 배열 인덱스별 ref/takenAt 등 ignore, 응답 shopRef/photoRef는 현재 ToolResult echo |
| search-segment | `/concept`, `/photos`의 길이·순서 및 MIME/해상도 | `/photos/0/photoRef`, `/photos/0/image/data` 등 모든 실제 인덱스, `/queryToken` ignore. 응답 ref는 photos echo |
| transcribe | `/audio/mimeType` 등 현재 OpenAPI의 비휘발 형식 필드 | `/audio/data` ignore. 실제 WAV/15초는 매번 validator 검사 |
| describe-storefront / describe-piece | `/image/mimeType`; 필요한 경우 의미 있는 해상도 | `/image/data` ignore, label/category/description 녹화. direct-cut-shop에 origin 요청 필드 추가 금지 |
| tryon | `/selfPhoto/headMasked`, `/target/origin`, target/companions label/category·출처·배열 길이/순서 | pieceRef와 각 image/data ignore; body의 위치 없는 정상 형식/2~7장은 항상 검증 |
| route | `/origin`, `/destination` | 합성 GPX의 고정 좌표를 정확히 비교. 좌표를 오류/로그에 출력하지 않음 |

표의 pointer는 반드시 최종 OpenAPI 필드명을 사용한다. 명시적인 index 없이 wildcard를 만들지 않는다. request examples는 schema와 대조해 작성한다.

### 6. 머리 정답과 자동 수치 평가
근거: D-R9-01, [device FaceMask](../contracts/device-modules.md#자동-지표-정의와-poc-합격-절차).
- 원본 정방향 해상도에서 사람이 얼굴·머리카락 전체를 표시한다. 자동 FaceMask 산출물을 GT로 복사하지 않는다. positive·negative·no-person 분류를 평가 전에 고정한다.
- 전송 변환을 원본 좌표로 역추적하고 interpolation footprint까지 고려해 `exposedHeadPixels`를 계산한다. RGB 우연한 일치 비교가 아니다. positive 전부 등록 성공+노출 0, no-person 전부 등록 실패, negative의 기대 거부를 assert한다.
- 목/어깨 ΔE95·offsetRatio95, thresholdVersion·decision을 수치 자료로 저장한다. PoC 보정 세트와 고정 검증 세트를 분리하고 같은 판정을 재현한다. 임계값 null/측정 불가/초과는 faceless, 출력 안전성 실패는 결과 저장 금지다. 임계값을 임의 3%/10%로 확정하지 않는다.

## mock 경계와 의존
합성 fixture는 테스트 전용이며 production 자동 fallback이 아니다. 앱에 clock/ID seed hook을 추가하거나 S00에 그 변경을 요청하지 않는다. E2E는 실제 셔터 시각·ID·유효 바이트를 유지하고 명시 ignore와 response echo로 재생한다. 고정 날짜/시간은 단위 테스트의 입력 예시일 뿐 앱 시계를 변경하지 않는다. live에는 fixture selector·가짜 결과 주입이 없어야 한다.

## 합격 기준
- `scripts/e2e/validate-fixtures.sh --all`: manifest 누락/조건 미확인 공개 자산/잘못된 hash·GT 크기·WAV/GPX/JSON schema를 실패 처리. 모든 필수 scenario를 검사한다.
- `scripts/e2e/validate-fixtures.sh --relay`: 항상 OpenAPI 검증, 키 선택·명시 match/ignore·ref echo·token 재발급을 검사한다. 의미 필드 변경은 409+첫 pointer, 휘발값 변경은 정상 재생, 미등록 키501, 잘못된 echo500, ignore 필드도 잘못된 미디어/토큰은 거부해야 한다.
- `scripts/emulator-lock.sh scripts/e2e/head-mask.sh --all`: 실제 S05 evaluateFixture로 positive 노출0/등록성공, no-person 실패, negative 기대 결과를 자동 확인한다.
- 현재 host 실행 결과는 아래 절에 기록한다. 전체 corpus가 사람 검토 없이 통과하도록 승인 flag를 채우거나 GT를 합성하지 않는다.

## 완료 보고 형식
파일/manifest 항목, 생성·녹화 명령과 출처, 검사 명령과 결과, 미확인 이용조건·모델 품질, 계약 모순을 보고한다. clock/ID seed hook 추가 요청은 하지 않는다.

## 미확인·위험
공개 asset 이용조건·사람 분류/머리 GT/item mask·배포 가능한 영어 음성은 미충족이다. 실제 Meta 출력 provenance와 M1 앱/모델 품질은 미확인이다. 합성 fixture만으로 실제 매장 검색·배터리·현장 도착 품질을 일반화하지 않는다. 개인정보가 들어 있는 HTTP 캡처를 fixture 디렉터리에 복사하지 않는다.

## 2026-11-04 host 실행 관측

이번 Mac host에서 아래 명령을 실제 실행했다. M1 native/device, Firebase HTTP 인증, Meta/OSRM live 호출, 앱 mock/live E2E는 실행하지 않았다.

```sh
uv --directory relay run python ../scripts/e2e/build_fixtures.py
uv --directory relay run python ../scripts/e2e/relay_fixtures.py --build
uv --directory relay run python ../scripts/e2e/fixture_manifest.py
bash scripts/e2e/validate-fixtures.sh --relay
uv --directory relay run python ../scripts/e2e/validate_fixtures.py --all --output /tmp/s11-fixtures-all.json
```

`--output`은 Python validator의 선택 인수다. shell dispatcher에는 이 인수를 전달하지 않는다. 출력 경로는 실행자가 정하며 기본 validator 보고서는 `verification/results/s11-fixtures-*/`에 생긴다. 생성기·manifest·importer·validator·직접 production replay probe는 `SF_FIXTURES_DIR`로 별도 corpus root를 지정할 수 있고, 코드/OpenAPI 원본은 계속 저장소에서 읽는다.

| 실제 검사 | 관측 |
| --- | --- |
| 임시 corpus에서 생성기→relay 생성기→manifest 두 번 실행 | inventory bytes 동일 |
| 현재 portable manifest | 307 assets, 생성 원본 2개의 고정 hash/sourceId/prompt 연결 |
| `--relay` | exit 0, 14 scenarios, 10 search token chains, production loader/token boundary 검사 12개, 외부 provider 호출 0 |
| Python `--all` | exit 2 / blocked, 구조 오류 0, 선행 조건 148개 |
| 선행 조건 구성 | 공개 승인 132개 + head 분류/GT 12개 + item review 1개 + 영어 speech 경로 2개 + M1 원본 연구 corpus 1개 |
| 불승인 importer 입력 | head/items/assets/speech 4종 모두 exit 1 |
| 손상·틀린 입력 | stale hash, 최신 manifest여도 잘못된 cutout alpha, match ancestor ignore, 잘못된 error retryability, 출처 없는 relay binary, 불완전한 연구 corpus 모두 exit 1 |
| 실제 사람 승인 생성 | 0; 성공 human-import 경로는 실제 승인 입력이 없어 미실행 |

production replay 근거: [`validate-relay.json`](../../../verification/results/s11-fixtures-20261104T234017-bd7b3d0c/validate-relay.json). OpenAPI/생성 TS drift 검사도 같은 CLI에서 실행했다. fixture 이름 `e2e`는 relay scenario 이름이며 실제 Android E2E 성공을 의미하지 않는다.

### 고정된 generator/runtime 인터페이스
- `source/generation.json`의 원본 hash가 다르면 crop 재생성을 거부한다. sourceId/prompt는 보존된 generation evidence에서 읽고, 다른 표현을 임의로 만들어 쓰지 않는다.
- GT 또는 item review가 승인된 corpus에는 `build_fixtures.py`가 쓰기 전에 실패한다. 재생성으로 사람 검토를 AI draft로 덮어쓰지 않는다. 승인 후에는 필요하면 relay/manifest만 재생성한다.
- manifest의 공개 승인과 사람 GT 승인은 별개다. head review만으로 이미지 공개·모델 품질을 승인하지 않는다. 공개 승인은 정확한 경로/hash/실제 reviewer/시각/권한에 연결되며, 알 수 없는 relay binary를 수기 생성물이나 provider recording으로 가장하지 않는다.
- `relay/e2e`: 현재 ended trip의 3가게(각 storefront+item, Shop1 note=`blue tarp, near the entrance`)와 UI로 만든 이전 ended trip 2가게(각 item 1장, descriptionState=`none`, 메모/외관 없음). query=`Find the blue jacket in the second shop`, target 1 + companions 2.
- 모든 toolResults/companions 배열 길이·순서·의미 필드를 비교한다. 실제 refs/timestamps/media data, native PE score, try-on 입력 이미지 width/height는 정확한 pointer로 ignore한다. 날짜 표현이 없는 `e2e`만 device-dependent `context.timeZone`도 명시 ignore하며, 다른 semantic scenario의 timeZone 비교는 유지한다.
- Shop2 셔터의 GPX 목적지는 `walk` destination과 같다. Shop.spot과 route waypoint는 별도 좌표다. token/auth/media 검증을 ignore로 생략하지 않는다.
- item validator는 source/mask/cutout 크기, 0/255 mask, 실제 bbox, mask 내부 정수 tap, cutout RGB 원본 일치·alpha mask 일치, score 범위와 review hash를 검사한다.

### 사람이 제공할 구체 입력
로컬 review 화면은 `python3 -m http.server --bind 127.0.0.1 --directory verification/fixtures 8767`로 열고 `http://127.0.0.1:8767/review/`를 사용한다. 화면은 업로드하지 않는다. agent가 사람 이름이나 attestation을 대신 작성하지 않는다.

1. **Head/classification:** positive 6개와 negative/no-person 6개를 확인한다. positive는 원본 해상도에서 얼굴·귀·머리카락·모자 경계를 직접 그린다. 페이지가 내보내는 bundle에는 `id`, `sourceSha256`, `expectedPerson`, `expectedRegistration`, `annotator`, `annotatedAt`, `reviewer`, `reviewedAt`, `humanAttestation:true`, positive의 opaque PNG `maskDataUrl`이 필요하다. negative는 `maskDataUrl:null`이다. 현재 분류가 틀리면 승인하지 말고 frozen case를 명시 수정한 뒤 다시 검토한다.
   Canvas polygon의 anti-alias 경계는 Fill 직후 보수적으로 이진화한다(coverage>0인 픽셀을 255, 나머지 0, alpha 255). 사람의 polygon 선택을 재해석하거나 AI GT로 채우지 않는다. 실제 review UI에서 기울어진 검사용 polygon의 중간값 123개가 수정 뒤 0개가 됨을 확인했다. annotator/reviewer/attestation은 입력하지 않았고 검사용 polygon을 지웠으며 승인 bundle을 만들지 않았다.
2. **Items:** `review/items.html`에서 12개 source/mask/bbox/tap을 실제 확인한다. AI 사각형이 부정확하면 승인하지 않는다. 외부 편집기로 mask와 일치하는 cutout/bbox/tap을 수정한 뒤 페이지를 다시 열어 새로운 hash로 검토한다. export는 공통 reviewer/시각/attestation과 후보별 `mask`, `sourceSha256`, `maskSha256`, `approved:true`를 포함한다. 승인 mask가 자동 SAM/EdgeTAM 품질 증거로 바뀌지는 않는다.
3. **Publication assets:** 별도 JSON bundle의 `assets` 배열에 직접 검토한 각 `path`, `sha256`, `publicUseApproved:true`, `termsUrl`, `permission`을 넣고, 최상위에 실제 `reviewer`, `reviewedAt`, `humanAttestation:true`를 넣는다. 생성물에 CC0/MIT를 임의 부여하지 않는다. 복사된 relay/capture 파일도 각각의 manifest 경로/hash로 승인한다.
4. **Speech:** 사람이 녹음한 실제 영어 WAV와 bundle을 제공한다. 공통 reviewer/시각/attestation 외에 `sourceType:"human-recording"`, `sourceId`, WAV `sha256`, `permission`, `termsUrl`, `speakerConsent:true`, `redistributionApproved:true`, `language:"en"`, 실제 발화 `text`가 필요하다. 일반 human recording 권한을 Apple 음성 출력 권한으로 바꾸지 않는다.

```sh
uv --directory relay run python ../scripts/e2e/import_review.py /absolute/path/head.review.json --kind head
uv --directory relay run python ../scripts/e2e/import_review.py /absolute/path/items.review.json --kind items
uv --directory relay run python ../scripts/e2e/import_review.py /absolute/path/assets.review.json --kind assets
uv --directory relay run python ../scripts/e2e/import_review.py /absolute/path/speech.review.json --kind speech --speech-file /absolute/path/query.wav
uv --directory relay run python ../scripts/e2e/fixture_manifest.py
bash scripts/e2e/validate-fixtures.sh --all
```

검토 시각은 timezone이 있는 실제 과거/현재 ISO timestamp여야 한다. importer는 형식·hash·geometry를 검사할 뿐 서명된 신원 증명이나 사람의 판단 정확성을 자동 보증하지 않는다. 실제 승인 bundle이 없으므로 이번 smoke에서는 불승인 bundle만 importer에 전달했고, 성공을 만들기 위해 가짜 GT/승인을 생성하지 않았다.

### M1 연구 corpus 외부 입력
coordinator가 전달한 원본 위치는 `/Users/user/.cache/street-fitting/models/retrieval_r4/`다. `manifest.json` 22개 image rows/원출처, `results.json` 7 query/relevant_ids/top3, `image_embeddings.npy` 22×512를 보존하고, 오래된 `/tmp/edgetam-poc/...` path는 실행 시 메모리에서만 remap한다. 원본 `run_retrieval.py`를 실행해 historical 결과를 덮어쓰지 않는다.

전달된 PE checkpoint revision은 `8b4722741a516c18e7d311f158f13c600fea6c78`; image preprocessing은 RGB squash384 bilinear→ToTensor→mean/std 0.5, center crop 없음; text context32, normalized512다. 이는 coordinator 제공 metadata이며 이 host에서 모델/파일 hash를 직접 확인한 결과가 아니다. 실제 복사본과 파일별 원본 hash/unaltered 기록(`research/preservation.json`), 모델 revision/전처리 기록(`research/preprocessing.json`), 두 tap 이미지·기존 mask/vector·라이선스를 M1 owner가 제공해야 한다. 누락 자료를 새 합성 그림이나 임의 revision으로 대체하지 않는다.

