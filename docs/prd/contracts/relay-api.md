# 릴레이 API 계약

상태: R0~R9 결정 반영. S01~S03의 구현 입력이며 S07 등 앱 호출자도 이 문서를 따른다. 아래 `[추론·기술 결정]`은 인터뷰에 없던 전송 형식·기본값을 구현 계약으로 정한 것이다. 실제 Meta API 연동 성공을 뜻하지 않는다. 근거: D-R1-01, D-R7-02, D-R7-04.

관련 문서: [에이전트 도구](agent-tools.md), [기기 모듈](device-modules.md), [데이터 모델](data-model.md), [결정 로그](../decisions.md), [데이터 경계](../product/privacy.md). 조사 근거: [research §6.3](../../../street-fitting-research.md#63-마스킹-후-생성형-피팅), [§7.1](../../../street-fitting-research.md#71-탭-지점-옷-후보-에뮬레이터-실측), [§7.3](../../../street-fitting-research.md#73-중계-서버-보안), [§8.1](../../../street-fitting-research.md#81-에이전트-장면-검색), [§8.2](../../../street-fitting-research.md#82-비용-최소화-구성), [§10](../../../street-fitting-research.md#10-남은-미정검증-항목).

## 1. 경계와 공통 전송 규칙

- Python + FastAPI가 로컬 Mac에서만 동작한다. 에뮬레이터는 `http://10.0.2.2:8787`; HTTP는 앱 debug 빌드의 이 개발 대상에만 허용한다. 원격 접속은 HTTPS를 쓴다. Cloud Run·Firestore 원장은 만들지 않는다. 근거: D-R6-02, D-R6-05, D-R7-02, D-R7-05.
- 엔드포인트는 아래 7개뿐이다. 클라이언트가 provider URL, 모델, 시스템 프롬프트, 임의 도구, `store`, 생성 옵션을 지정할 수 없다. 검색 루프는 앱, 시스템 프롬프트와 도구 정의는 릴레이의 책임이다. 근거: D-R1-02, D-R6-01; research §7.3.
- `[추론·기술 결정]` 모든 요청·응답은 `application/json; charset=utf-8`이며 이미지·WAV는 **JSON 안의 표준 base64**다. multipart, data URL, 원격 파일 URL, Files API를 받지 않는다. FastAPI `UploadFile`의 임시 디스크 spill도 쓰지 않는다. 요청 압축은 받지 않는다. 근거: D-R1-02, D-R6-04; research §6.3.
- `[추론·기술 결정]` JSON Schema 2020-12/OpenAPI 3.1을 쓴다. 이하 객체는 모두 `additionalProperties:false`, 표에서 `?` 없는 필드는 필수, `?`는 생략 가능(별도 표시 없으면 null 불가)이다. 숫자는 유한수, 시간은 offset이 있는 RFC3339, 배열은 별도 표시 없으면 순서를 보존한다. 미정의 필드·잘못된 MIME·불일치 크기는 `invalid_request`다. 근거: D-R7-02.
- `[추론·기술 결정]` 본문 상한: search/turn 16 MiB, search/segment 20 MiB, transcribe 1 MiB, describe/* 7 MiB, tryon 44 MiB, route 4 KiB. 스트리밍 수신 중 바이트 수를 세어 초과 즉시 413으로 중단한다. `Content-Length`만 믿지 않는다. MiB는 1,048,576바이트다. 근거: D-R6-04.
- 업로드 이미지는 기기에서 EXIF GPS를 제거하고 방향을 픽셀에 적용한 파생본이다. 릴레이는 메모리에서 헤더·실제 디코딩 크기·메타데이터를 검사하고 GPS를 포함한 입력을 거부한다. 본인 사진 마스킹 실패 시에는 앱이 전송 자체를 하지 않는다. 릴레이의 필드 검사는 얼굴 제거의 시각적 증명이 아니다. 근거: D-R0-02, D-R4-11; research §6.3.

### 공통 JSON 스키마 정의

`$ref` 이름은 OpenAPI `components.schemas` 이름이다. 스키마 밖 설명의 교차 필드 제약도 서버 validator로 강제한다. `[추론·기술 결정]`, 근거: D-R7-02.

```json
{
  "$defs": {
    "Ref": {"type":"string","minLength":1,"maxLength":128,"pattern":"^[A-Za-z0-9_-]+$"},
    "Phrase": {"type":"string","minLength":1,"maxLength":160},
    "Image": {
      "type":"object","additionalProperties":false,
      "required":["mimeType","data","width","height"],
      "properties":{
        "mimeType":{"enum":["image/jpeg","image/png"]},
        "data":{"type":"string","contentEncoding":"base64","minLength":4,"maxLength":5592408},
        "width":{"type":"integer","minimum":1,"maximum":2048},
        "height":{"type":"integer","minimum":1,"maximum":2048}
      }
    },
    "Point": {
      "type":"object","additionalProperties":false,"required":["lat","lng"],
      "properties":{"lat":{"type":"number","minimum":-90,"maximum":90},"lng":{"type":"number","minimum":-180,"maximum":180}}
    },
    "Error": {
      "type":"object","additionalProperties":false,"required":["error"],
      "properties":{"error":{"type":"object","additionalProperties":false,"required":["code","message","retryable"],"properties":{"code":{"type":"string"},"message":{"type":"string","maxLength":256},"retryable":{"type":"boolean"}}}}
    }
  }
}
```

- `Image.data`의 디코딩 크기는 **장당 최대 4 MiB**, width×height는 최대 4,194,304픽셀이다. base64 패딩·문자열을 엄격 검사하고 실제 파일 MIME·해상도가 선언과 같아야 한다. 애니메이션·다중 페이지 이미지는 받지 않는다. 축소는 앱이 종횡비를 유지해 한다. 근거: D-R0-02, D-R4-07; `[추론·기술 결정]`.
- `Ref`는 앱 내부 파일 경로·DB 키를 노출하지 않는 질의별 불투명 참조다. 개인정보·좌표를 문자열에 넣지 않는다. `Phrase`는 공백만인 값을 금지하고 영어 명사구를 뜻한다(영어 여부는 Spark 프롬프트 정책과 fixture로 검증하며 ASCII만 강제하지 않는다). 근거: D-R0-02, D-R1-02.

## 2. 인증과 환경

### 인증 헤더·검증 순서

| 순서 | 처리 | 실패 | 근거 |
|---|---|---|---|
| 1 | `Authorization: Bearer <Firebase ID token>` 필수. Firebase Admin SDK로 서명·알고리즘·만료·발급자 `https://securetoken.google.com/<project>`·audience·비어 있지 않은 UID 검증 | 401 `unauthenticated` | D-R6-01 |
| 2 | ID token의 `firebase.sign_in_provider`가 `anonymous`인지 검사. 이 앱의 개발 Firebase 프로젝트 외 토큰 불가 | 401 `unauthenticated` | D-R6-01, D-R7-07; `[추론·기술 결정]` |
| 3 | `X-Firebase-AppCheck: <token>`을 Admin SDK로 검증. 프로젝트와 허용 Android app ID에 맞아야 함. debug provider도 Firebase가 발급한 정상 App Check 토큰으로 검사 | 403 `app_check_failed` | D-R6-01 |
| 4 | queryToken이 있으면 서명·만료·UID 가명 바인딩·본문 일치·진행 단계 검사 | 401 또는 409(§5) | D-R1-02, D-R3-01 |
| 5 | JSON·미디어·기능 상한 검사 후에만 provider 호출 | 400/413/409 | D-R3-01, D-R4-07, D-R3-07 |

`[추론·기술 결정]` `safety_identifier = hex(HMAC-SHA256(RELAY_HMAC_SECRET, "safety:v1:" + Firebase UID))`로 64자리 가명 ID를 만든다. UID·ID 토큰·App Check 토큰 자체는 Meta와 로그에 보내지 않는다. 이 가명 ID는 인증 사용자 바인딩에도 쓰며 HMAC 용도를 문자열 prefix로 분리한다. 근거: D-R6-01; research §7.3.

`RELAY_MOCK_SKIP_AUTH=1`은 **`RELAY_MODE=mock`일 때만** 두 Firebase 검증을 건너뛰고 고정 mock UID를 쓴다. live와 조합하면 서버 시작을 실패시킨다. mock skip도 queryToken 서명·예산·스키마 검증은 건너뛰지 않는다. 앱 화면에 dev 배지는 없다. 근거: D-R1-04, D-R7-07; `[추론·기술 결정]`.

### 환경 변수

| 이름 | 필수·기본값·용도 | 근거 |
|---|---|---|
| `MODEL_API_KEY` | live 필수. Meta 키, 서버 프로세스에서만 읽음. 앱 번들·fixture·로그 금지 | D-R6-01; research §7.3 |
| `RELAY_HMAC_SECRET` | 두 모드 모두 필수. base64로 인코딩한 무작위 최소 32바이트. queryToken·가명화에 사용 | D-R1-02, D-R6-01; `[추론·기술 결정]` |
| `RELAY_MODE` | `live` 또는 `mock`; 미지정이면 시작 실패(실수로 live 실행 금지) | D-R1-04; `[추론·기술 결정]` |
| `PORT` | 정수 1~65535, 기본 `8787` | D-R6-05; `[추론·기술 결정]` |
| `SF_MODELS_DIR` | 기본 `~/.cache/street-fitting/models`; PE 가중치·토크나이저·모델 설정을 읽을 디렉터리 | D-R7-11; `[추론·기술 결정]` |
| `FIREBASE_PROJECT_ID` | 인증 검증 시 필수. 개발 프로젝트 ID | D-R6-01, D-R7-07 |
| `FIREBASE_APP_ID` | 인증 검증 시 필수. 허용 Android Firebase app ID | D-R6-01; `[추론·기술 결정]` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase Admin용 로컬 서비스 계정 경로. ADC가 준비돼 있으면 생략 가능. 키 파일은 저장소 밖 | D-R6-01; `[추론·기술 결정]` |
| `RELAY_MOCK_SKIP_AUTH` | `0` 기본; `1`은 mock 전용 | D-R1-04 |
| `RELAY_LOG_TEXT` | `0` 기본; 로컬 개발자가 명시적으로 `1` 설정 시 질의·Spark 응답의 허용 텍스트만 기록 | D-R6-04 |
| `RELAY_FIXTURES_DIR` | 기본 `verification/fixtures/relay`; mock에서 읽기 전용 | D-R1-04; `[추론·기술 결정]` |

위 목록은 계약의 환경 변수다. 클라이언트가 모델·provider 호스트를 바꾸는 옵션은 없다. live의 정확한 Meta API 모델 ID·버전별 파라미터는 조사에서 실호출하지 않아 **미확인**이다. S02/S03은 아래 제품 모델에 대응하는 공식 모델 ID를 서버 상수에 고정하고, 실제 ID와 응답 스키마를 S11 통합 증거에 남긴다. 임의 모델이나 Contributor로 대체하지 않는다. 근거: D-R0-02, D-R1-04; research §8.1·§10.

## 3. 무저장·로그·모델 준비

### 무저장 불변식

- 이미지, 음성, 좌표는 **요청 처리 메모리에서만** 다룬다. DB·파일·임시 파일·HTTP body dump·오류 추적 attachment·SDK tracing·응답 캐시·live fixture 자동 녹화를 금지한다. 프록시/ASGI/HTTP 클라이언트의 body logging과 OSRM URL logging도 끈다. 성공·취소·타임아웃 모두 버퍼 참조를 해제한다. managed runtime에서 RAM의 즉시 0화나 OS 메모리 관리까지 보증하는 문구는 쓰지 않는다. 근거: D-R6-04; research §7.3.
- queryToken·Spark 대화는 서버에 보관하지 않는다. 토큰은 앱의 현재 질의 메모리에만 둔다. 서버 재시작 후에도 같은 HMAC 비밀이면 미만료 토큰 검증은 가능하다. 외관 묘사·옷 라벨의 저장은 앱 `Store`만 한다. 근거: D-R1-02, D-R6-03.
- `Cache-Control: no-store`를 모든 응답에 붙인다. Meta에도 가능한 저장 억제 설정을 쓰지만 Meta의 안전 목적 보관까지 없어진다는 뜻은 아니다. 근거: D-R0-02, D-R6-04; research §6.3; `[추론·기술 결정]`.

### 로그 허용 목록

| 모드 | 기록 가능 | 언제나 금지 | 근거 |
|---|---|---|---|
| 기본 | `endpoint`(정적 경로), `pseudonymousId`, `latencyMs`, `statusCode`, `sparkTurns`(비검색 null) | 요청·응답 본문, queryToken, 인증 헤더, 원본 UID, 비밀 키, 이미지/base64/파일 내용, 음성, 좌표, 좌표를 포함한 OSRM URL | D-R6-04 |
| `RELAY_LOG_TEXT=1` | 기본 필드 + `queryText`, 검증 후 Spark의 텍스트/도구 응답 본문 | 위 금지 항목은 그대로. provider 원문 덤프·미디어·임베딩·방문 메모 전체를 통째로 기록하지 않음 | D-R6-04 |

`[추론·기술 결정]` 텍스트 예외도 좌표를 허용하지 않는다. query/summary/도구 문자열에 위경도·위치 payload가 섞이면 그 텍스트 필드 전체를 생략한다. provider 응답은 좌표 없는 허용 스키마로 검증한 값만 기록한다. 범용 예외 serializer는 사용하지 않으며 검증 오류의 입력값도 로그에 넣지 않는다. 근거: D-R6-04.

### PE 텍스트 타워

- **PE 텍스트 타워 ONNX는 없다.** 사용자 위임 준비에서 원 묶음을 `SF_MODELS_DIR`에 보존했다. `hf_cache/`에 가중치, `perception_models/core/vision_encoder/`에 토크나이저·설정·코드, 루트 `pe_image.onnx`에 이미지 모델이 있다. [안정 배치·revision·호스트 검증](../README.md#모델-배치와-오프라인-검증)을 읽고, 준비 완료를 릴레이 구현 완료로 취급하지 않는다. 근거: D-R7-11; research §7.1·§8.1.
- `[추론·기술 결정]` live 서버 시작 시 Meta PE-Core-T16 이미지 타워와 **동일한 체크포인트 쌍**의 텍스트 가중치·토크나이저·전처리 설정을 CPU inference/eval 모드로 한 번 로딩한다. 요청마다 로딩·다운로드하지 않는다. 모델/토크나이저 revision·이미지 ONNX 출처가 일치해야 한다. 누락·불일치 시 live 시작 실패다. 근거: D-R0-02, D-R1-02.
- `find_photos.phrase`만 인코딩하고 512차원 float 벡터를 L2 정규화(`v/||v||₂`)해 `phraseVector`에 붙인다. 0 norm/비유한수/차원 불일치는 `model_unavailable`; 기기에 이미지 임베딩을 올리라고 요구하지 않는다. mock은 녹화된 정규화 벡터를 쓰므로 PE 로딩이 필요 없다. 근거: D-R1-04; research §8.1; `[추론·기술 결정]`.

## 4. 질의 토큰과 순차 예산

`[추론·기술 결정]` 토큰은 `base64url(UTF-8 JSON payload) + "." + base64url(HMAC-SHA256(secret, "query:v1:" + 첫 부분))`이다. padding 없는 base64url, 서명은 constant-time 비교다. 임의 알고리즘 선택 헤더는 없다. **서명이지 암호화가 아니다.** 앱은 읽거나 편집하지 않는 opaque 값으로 취급한다. 근거: D-R1-02, D-R3-01.

| payload 필드 | 타입·규칙 | 근거 |
|---|---|---|
| `v`, `qid`, `sub` | `v:1`; 서버 무작위 UUID `qid`; `sub`는 인증 UID 가명 ID | D-R1-02, D-R6-01 |
| `sparkTurns`, `samPhotos` | 정수 0~4, 0~3. 각각 호출 시도 수·전송 장 수의 누계 | D-R3-01 |
| `iat`, `exp` | UTC epoch seconds. 첫 발급부터 15분 고정 만료; 갱신해도 연장하지 않음 | D-R1-02; `[추론·기술 결정]` |
| `query`, `context` | 최초 질의와 `{now,timeZone}`; 후속 요청에서 바꿀 수 없음 | D-R1-02, D-R3-03; `[추론·기술 결정]` |
| `history` | 검증된 Spark 도구 호출·최종 출력·앱 도구 결과의 대화. 텍스트/불투명 참조/수치만. 서버가 Responses input을 재구성 | D-R1-02 |
| `pending` | 아직 결과가 필요한 도구 호출 0~1개. `id`, `name`, `arguments`; extract이면 SAM 완료 요약도 포함 | D-R1-02; `[추론·기술 결정]` |
| `closed` | boolean. final/not_found 또는 불확실한 상류 실패 뒤 true | D-R3-01; `[추론·기술 결정]` |
| `fixtureScenario?` | mock에서만 fixture 시나리오 식별자; live에는 없음 | D-R1-04 |

- 첫 `/search/turn`은 토큰 없이 새 qid를 만들고 Spark 1턴을 소비한다. 다음 `/search/turn`은 `pending`과 정확히 일치하는 `toolResults`를 받은 뒤 1턴을 더 소비한다. `sparkTurns>=4`이면 **상류 호출 전** `turn_limit_exceeded`. 4번째 요청에서는 Spark의 도구 선택을 끄고 final/not_found만 허용한다. 최종 응답은 `closed=true`. 근거: D-R1-02, D-R3-01.
- `/search/segment`도 새 토큰을 반환한다. 앱은 이를 **즉시 최신 토큰으로 교체**하고 다음 `/search/turn`에 사용한다. pending `extract_items`의 사진·concept와 같아야 하며 한 번의 extract 호출은 한 번의 segment 배치(1~3장)로 처리한다. `samPhotos + photos.length > 3`이면 상류 호출 전에 `photo_limit_exceeded`; 같은 사진의 재전송도 장 수를 소비한다. 근거: D-R3-01; `[추론·기술 결정]`.
- 갱신마다 history/pending/카운터를 다시 서명한다. 이미지·음성·좌표·마스크·phraseVector는 토큰에 넣지 않는다. SAM 후보의 개수·최고 점수만 토큰에 넣고 extract 도구 결과와 대조한다. 토큰 문자열 최대 12 MiB, history가 이를 넘으면 `invalid_request`로 끝내며 조용히 이전 trip을 버리지 않는다. 근거: D-R1-02, D-R3-03, D-R6-04; `[추론·기술 결정]`.
- **최신 토큰 체인 기준으로 강제한다. 토큰 재전송·fork는 방어하지 않는다. 위협 모델 밖(D-R6-02).** HMAC은 카운터 변조를 막지만 이미 발급된 토큰의 재사용은 감지하지 못한다. 앱은 질의당 네트워크 작업 하나만 실행하고 최신 토큰만 사용한다. qid 원장·nonce 소비 원장·쿼터 DB는 추가하지 않는다. 근거: D-R1-02, D-R6-02.
- validation 실패는 호출 전이므로 카운터를 쓰지 않는다. 상류 호출을 시도한 뒤 실패하면 소비된 카운터와 `closed=true` 토큰을 `X-Query-Token` 응답 헤더에 넣고 앱은 그 질의를 종료한다. 전송 후 응답을 못 받은 경우도 오래된 토큰으로 자동 재시도하지 않는다. 사용자가 다시 묻기는 새 질의다. 만료·HMAC 비밀 교체 때도 자동 갱신/처음부터 재실행하지 않고 다시 묻기로 간다. 근거: D-R3-01, D-R3-06, D-R6-03; `[추론·기술 결정]`.

## 5. 공통 오류 계약

모든 비2xx는 `Error` 스키마를 사용한다. `message`는 정해진 안전한 영어 문구이며 provider 원문·입력값·키를 포함하지 않는다. `retryable`은 사용자가 네트워크/일시 장애 해소 후 다시 요청할 수 있다는 뜻이지 같은 검색 토큰 자동 재전송 허가가 아니다. 아래 공통 표는 7개 엔드포인트 모두에 적용되고, 각 절은 추가 오류와 관련 행을 명시한다. 근거: D-R6-03, D-R6-04; `[추론·기술 결정]`.

| HTTP | `error.code` | `retryable` | 발생/상류 매핑 |
|---|---|---|---|
| 401 | `unauthenticated` | false | Firebase ID token 검증 실패 |
| 403 | `app_check_failed` | false | App Check 검증 실패 |
| 400 | `invalid_request` | false | JSON/필수 필드/미디어/도구 결과 불일치. FastAPI 기본 422 본문 대신 이 형식 |
| 413 | `payload_too_large` | false | 본문·디코딩 파일·해상도 상한 초과 |
| 401 | `invalid_query_token` | false | 서명·sub·버전·형식 불일치 |
| 401 | `query_token_expired` | false | exp 도달 |
| 409 | `query_closed` | false | 이미 종료된 토큰으로 계속 요청(단, 4턴 초과 검사는 우선) |
| 409 | `turn_limit_exceeded` | false | 최신 토큰의 Spark 4턴 소진 |
| 409 | `photo_limit_exceeded` | false | 최신 토큰의 누적 SAM 3장 초과 |
| 400 | `content_policy_violation` | false | Meta 400 `content_policy_violation`, 명시적 정책 거절/필터 중단. 모델을 바꾸어 우회하지 않음 |
| 429 | `upstream_rate_limited` | true | Meta/OSRM 429. 안전한 숫자 `Retry-After`만 전달 |
| 504 | `upstream_timeout` | true | provider 응답 deadline 초과 |
| 502 | `upstream_error` | true | provider 5xx, 연결 실패, 잘못된 응답/스키마, 기대한 이미지 없음 |
| 502 | `upstream_error` | false | provider 401/403(서버 자격 증명 문제), 정책 오류 외 provider 4xx. 사용자 인증 오류로 오인시키지 않음 |
| 503 | `model_unavailable` | false | PE 추론 불능·벡터 불량. 다른 모델로 대체하지 않음 |
| 404 | `route_unavailable` | false | OSRM `NoRoute`/`NoSegment` 또는 비어 있는 경로 |
| 501 | `fixture_not_found` | false | mock의 (scenario, operation, step)에 해당하는 파일 없음. live로 fallback하지 않음 |
| 409 | `fixture_request_mismatch` | false | mock fixture의 match 필드 불일치. message에 처음 불일치한 JSON pointer를 포함하며 실제/기대 입력값은 노출하지 않음 |
| 500 | `fixture_invalid` | false | mock fixture 정의 오류, 해석할 수 없는 echo 참조 또는 치환 후 응답 스키마 위반 |

`[추론·기술 결정]` provider deadline은 Spark 60초, SAM 배치 90초, Voice 30초, Muse Image 180초, OSRM 15초다. 서버 내부 자동 재시도는 하지 않는다. 인증 재발급·사용자 다시 시도·오프라인 대기열은 해당 앱 계약이 담당한다. 근거: D-R3-01, D-R6-03.

## 6. 엔드포인트별 계약

### 6.1 `POST /v1/search/turn`

목적: Muse Spark **1.3 Standard** 한 턴을 실행하고, 앱이 실행할 도구 또는 종료 응답을 만든다. `store:false`, `safety_identifier`를 고정하고 웹 검색·이미지 검색·셸 등 provider 내장 도구는 끈다. 1~3턴만 [고정 도구 3개](agent-tools.md)를 허용하며 4턴에는 모든 도구를 끈다. 외부 이미지 입력은 없다. 근거: D-R1-02, D-R3-01, D-R6-01; research §6.3·§7.3·§8.1.

요청 스키마(`[추론·기술 결정]`):

```json
{
  "type":"object","additionalProperties":false,"required":["query"],
  "properties":{
    "query":{"type":"string","minLength":1,"maxLength":2000},
    "context":{"$ref":"#/components/schemas/QueryContext"},
    "queryToken":{"type":"string","minLength":1,"maxLength":12582912},
    "toolResults":{"type":"array","maxItems":1,"items":{"$ref":"#/components/schemas/ToolResult"}}
  }
}
```

- `QueryContext={now: RFC3339, timeZone: IANA timezone}`는 첫 턴 필수다. 후속에서는 생략하거나 최초 값과 동일해야 한다. `query`도 최초와 같아야 한다. 첫 턴 `toolResults`는 생략/빈 배열만, 후속은 pending 1개에 대응하는 결과 1개가 필수다. 임의 messages/system/history를 받지 않는다. 근거: D-R1-02, D-R3-03.
- `ToolResult`, `ToolCall`, `Final`, `NotFound`의 완전한 스키마는 [agent-tools §3~4](agent-tools.md#3-도구-json-스키마)에 있다. 응답은 다음 **서로 배타적** 세 모양 중 하나다. 각 모양은 표에 적힌 필드만 받는다. 근거: D-R1-02, D-R3-06; `[추론·기술 결정]`.

| 200 응답 | 필수 필드·제한 |
|---|---|
| 도구 실행 | `{queryToken:string, toolCalls:ToolCall[]}`; toolCalls 정확히 1개 |
| 찾음 | `{queryToken:string, final:Final}` |
| 못 찾음 | `{queryToken:string, not_found:NotFound}` |

`find_photos`에는 릴레이가 정규화된 `phraseVector:number[512]`를 ToolCall 최상위 필드로 붙인다. Spark가 벡터를 생성하거나 앱이 벡터를 provider에 돌려보내지 않는다. response schema 위반은 `upstream_error`, 도구 인자를 자동으로 고쳐 다른 동작을 실행하지 않는다. 공통 오류 중 인증·입력·토큰·턴·PE·Meta 오류 적용. 근거: D-R1-02, D-R3-01; research §8.1.

mock: `search-turn.01`~`04`의 대응 녹화에서 toolCalls/final/not_found를 읽고 PE 벡터는 녹화값을 사용한다. 토큰은 fixture 값을 복사하지 않고 현재 카운터·context로 새로 서명한다. 상세 선택 규칙은 §7. 근거: D-R1-04.

### 6.2 `POST /v1/search/segment`

목적: pending `extract_items`의 사진 1~3장에 영어 concept 하나로 **SAM 3.1** 후보를 얻는다. 근거: D-R1-02, D-R3-01, D-R3-02.

```json
{
  "type":"object","additionalProperties":false,"required":["queryToken","photos","concept"],
  "properties":{
    "queryToken":{"type":"string","minLength":1,"maxLength":12582912},
    "concept":{"$ref":"#/components/schemas/Phrase"},
    "photos":{"type":"array","minItems":1,"maxItems":3,"items":{
      "type":"object","additionalProperties":false,"required":["photoRef","image"],
      "properties":{"photoRef":{"$ref":"#/components/schemas/Ref"},"image":{"$ref":"#/components/schemas/Image"}}
    }}
  }
}
```

사진 Ref는 중복 불가, pending extract의 순서·집합 및 concept가 정확히 같아야 한다. 본문 20 MiB와 누적 3장 중 더 엄격한 한도를 적용한다. SAM 전송 이미지 상한은 공통 Image와 같다. 근거: D-R3-01; `[추론·기술 결정]`.

| 200 응답 필드 | 타입·제약 | 근거 |
|---|---|---|
| `queryToken` | 새 서명 토큰. 누적 SAM 장 수와 extract 요약 반영 | D-R3-01 |
| `photos` | 요청과 동일 순서·개수의 `{photoRef:Ref,candidates:SegmentCandidate[]}` | D-R3-02 |
| `SegmentCandidate.id` | 해당 사진 응답 안에서 고유한 Ref | D-R3-02; `[추론·기술 결정]` |
| `.label`, `.score` | label=요청 concept; score 유한 number 0~1 | D-R4-06; `[추론·기술 결정]` |
| `.mask` | `{mimeType:"image/png",data:base64,width:int,height:int}`. 업로드 해상도와 같은 이진 8비트 grayscale PNG, 값 0/255. 최대 8 MiB/마스크 | D-R3-02; `[추론·기술 결정]` |
| `.bbox` | `[x,y,w,h]` 정수 4개. 업로드 이미지 픽셀, 좌상단 원점. x/y≥0, w/h>0, x+w≤width, y+h≤height | D-R3-02; `[추론·기술 결정]` |

후보 배열은 score 내림차순, 동점은 provider 순서다. **유효한 후보를 PE 점수나 임의 threshold/top-k로 삭제하지 않는다.** 후보 0개는 성공이며 빈 배열이다. 이미지별 일부 실패면 배치 전체를 오류로 끝내고 성공한 척 결과를 합성하지 않는다. 앱은 mask를 원본 크기로 nearest-neighbor 복원하고 bbox를 원본 크기 비율로 복원한 뒤 Candidate 캐시에 저장한다. mask·bbox는 Spark에 절대로 보내지 않는다. 근거: D-R3-02, D-R4-06; `[추론·기술 결정]`.

SAM 전용 API에는 사용자 선택 도구가 없으며 서버 고정 concept만 넣는다. provider가 Responses 형식을 쓰는 경우 `store:false`, 도구 없음, `safety_identifier`를 적용한다. 전용 API의 `store`/`safety_identifier` 필드 지원 여부는 **미확인**이므로 지원하지 않는 JSON 필드를 임의 전송하지 않는다. S02는 공식 지원 필드에서 저장 억제·가명 식별자 전달을 확인해 통합 증거에 남긴다. Files API는 사용하지 않는다. 근거: D-R0-02, D-R6-01; research §6.3·§7.3.

오류: 공통 인증·입력·토큰·`photo_limit_exceeded`·Meta 오류. mock은 `search-segment.<누적 SAM 장 수 + 1, 두 자리>`로 선택하고 응답 사진 refs와 후보 마스크를 반환한다. 최신 토큰은 새로 서명한다. 근거: D-R1-04, D-R3-01.

### 6.3 `POST /v1/transcribe`

목적: **Muse Voice Transcribe**로 15초 이하 음성을 영어 전사한다. 전사문 편집 단계 없이 바로 질의로 쓴다. 근거: D-R3-05, D-R3-07.

```json
{
  "type":"object","additionalProperties":false,"required":["audio"],
  "properties":{"audio":{
    "type":"object","additionalProperties":false,"required":["mimeType","data"],
    "properties":{"mimeType":{"const":"audio/wav"},"data":{"type":"string","contentEncoding":"base64","minLength":4,"maxLength":699052}}
  }}
}
```

`[추론·기술 결정]` PCM signed 16-bit little-endian, mono, 16,000 Hz WAV만 받는다. 디코딩 파일 최대 512 KiB, 실제 PCM sample 수 `1~240000`(15초), 부가 메타데이터 chunk는 거부한다. 선언 duration을 믿지 않고 헤더와 sample 수로 검사한다. 앱 Voice 모듈이 필요한 리샘플링·형식 변환을 한다. `200 {text:string, language:"en"}`; text 최대 2000자, 무음이면 `""` 가능. 번역·요약·문구 보정은 하지 않는다. 근거: D-R0-02, D-R3-07.

Voice 전용 전사 API의 language를 영어로 고정한다. 도구는 없음. Responses가 아니므로 `store:false` 지원 여부는 **미확인**이며 전용 API에서 공식 지원하는 경우에만 적용한다. `safety_identifier` 역시 공식 필드 지원을 확인하고 적용한다. 음성 upload storage/Files API는 사용하지 않는다. 근거: D-R6-01; research §6.3·§7.3·§8.1.

오류: 인증·입력·크기·Meta 오류. 15초 초과는 `400 invalid_request`, 파일 크기 초과는 413. 빈 전사는 정상 200이며 앱은 Spark를 호출하지 않는다. mock은 `transcribe.01`, 시나리오에 따라 실제 문장 또는 빈 text를 돌려준다. 근거: D-R1-04, D-R3-07.

### 6.4 `POST /v1/describe/storefront`

목적: 외관 사진 한 장을 짧은 영어 외관 설명으로 바꾼다. 카메라 UI를 막지 않는 후처리다. **Muse Spark 1.3 Standard**, `store:false`, 도구 없음, `safety_identifier` 고정. 지명·좌표·가게 이름을 추정하거나 얼굴을 식별하지 않는다. 근거: D-R2-04, D-R2-07, D-R6-01, D-R6-03.

| 방향 | JSON 스키마(모든 필드 필수) | 제한 |
|---|---|---|
| 요청 | `{image:Image}` | 정확히 1장, 공통 Image 상한, 추가 필드 불가 |
| 200 응답 | `{description:string}` | 영어 1~300자, 공백만 불가, 한두 문장의 시각적 묘사 |

오류: 공통 인증·입력·크기·Meta 오류. 오프라인에서는 호출하지 않고 앱 QueueJob에 넣는다. 온라인 일시 실패의 재시도/영구 실패 상태는 데이터 모델의 대기열 계약을 따른다. mock은 `describe-storefront.01`에 매칭된 사진의 녹화 설명을 반환한다. 근거: D-R1-04, D-R2-04, D-R6-03; `[추론·기술 결정]`(문자 수).

### 6.5 `POST /v1/describe/piece`

목적: **옷장 옷 또는 검색 없이 trip 사진에서 바로 잘라낸 가게 옷의 이미지** 한 장에 이름·종류를 붙인다. 검색으로 얻은 가게 옷(SAM concept가 있는 것)만 concept를 이름으로 쓰므로 이 엔드포인트를 호출하지 않는다. **Muse Spark 1.3 Standard**, `store:false`, 도구 없음, `safety_identifier` 고정. 근거: D-R4-06, D-R4-08, D-R6-01, D-R9-02.

| 방향 | JSON 스키마(모든 필드 필수) | 제한 |
|---|---|---|
| 요청 | `{image:Image}` | 정확히 1장의 cutout, PNG 투명 배경 허용, 공통 Image 상한 |
| 200 응답 | `{label:string,category:string}` | label 영어 1~120자; category 영어 명사구 1~64자. 둘 다 공백만 불가; enum 없음 |

`[추론·기술 결정]` 요청에 `origin`은 추가하지 않는다. 두 출처 모두 같은 cutout 입력·프롬프트·label/category 출력으로 처리하므로 릴레이의 동작을 가르는 정보가 아니다. 앱은 `Piece.origin`과 검색 concept 유무로 호출 필요성을 판단하고, `QueueJob.refId=Piece.id`로 응답을 원래 옷에 적용한다. 출처를 바꾸거나 추정하지 않으며 출처별 처리를 위해 원본 trip 사진·가게 위치를 보내지 않는다. 근거: D-R4-06, D-R4-08, D-R9-02.

사용자가 나중에 수정할 수 있으며 옷의 주인·브랜드·사람 신원을 추정하지 않는다. 오류: 공통 인증·입력·크기·Meta 오류. 두 출처 모두 오프라인은 앱 `label_piece` QueueJob 대상이다. 바로 자른 가게 옷은 저장한 옷에 자동으로 들어가고, 라벨링 대기 중에는 "Picked item"으로 표시하다가 성공 응답의 label/category를 적용한다. mock은 `describe-piece.01`에 매칭된 cutout의 녹화 label/category를 반환하며, 바로 자른 가게 옷은 §7의 `direct-cut-shop` 시나리오로 검증한다. 근거: D-R1-04, D-R4-06, D-R4-08, D-R6-03, D-R9-02; `[추론·기술 결정]`(문자 수·category 자유 문자열).

### 6.6 `POST /v1/tryon`

목적: 마스킹 본인 1장 + 대상 1벌 + 함께 입을 옷 0~5벌로 **Muse Image** 이미지 1장을 생성한다. **입력 총 2~7장, 옷은 최대 6벌**이다. 이전 1+9 규칙은 쓰지 않는다. 근거: D-R4-01, D-R4-02, D-R4-07, D-R4-09.

```json
{
  "type":"object","additionalProperties":false,"required":["selfPhoto","target","companions"],
  "properties":{
    "selfPhoto":{"type":"object","additionalProperties":false,"required":["image","headMasked"],"properties":{"image":{"$ref":"#/components/schemas/Image"},"headMasked":{"const":true}}},
    "target":{"$ref":"#/components/schemas/TryOnPiece"},
    "companions":{"type":"array","minItems":0,"maxItems":5,"items":{"$ref":"#/components/schemas/TryOnPiece"}}
  }
}
```

`TryOnPiece={pieceRef:Ref, image:Image, label:string(1~120), category:string(1~64), origin:"shop"|"wardrobe"}`; 전부 필수. target.origin은 반드시 `shop`, 모든 pieceRef는 중복 불가다. 앱이 저장되지 않은 임시 조각을 골랐다면 먼저 저장한 옷으로 만든다. 본문 44 MiB, 장당 공통 Image 상한을 적용한다. `headMasked:true`는 앱의 완료 신호이며 릴레이가 원본 얼굴을 요구하거나 얼굴 마스크 파일을 요구하지 않는다. 근거: D-R4-08, D-R4-09, D-R4-11; `[추론·기술 결정]`.

Muse Image Responses에 `store:false`, 도구 없음, `safety_identifier`, 출력 1장을 고정한다. 입력 순서는 selfPhoto, target, companions 배열 순이다. Muse Image의 `mask` 파라미터는 쓰지 않고 이미 얼굴·머리가 제거된 이미지 자체를 보낸다. `[추론·기술 결정]` 초기 reasoning_strength는 `low`, 출력 비율은 본인 이미지의 가장 가까운 provider 지원 비율로 서버에서 선택한다(동률은 세로 비율 우선). 정확한 지원 비율·마스킹 유지·픽셀 정렬은 **미확인**, S11 실호출에서 확인한다. 근거: D-R4-03, D-R4-04; research §6.3·§10.

| 200 응답 필드 | 타입·제한 | 근거 |
|---|---|---|
| `image` | `{mimeType:"image/jpeg"|"image/png",data:base64,width:int,height:int}`. 생성 이미지 정확히 1장. 최대 디코딩 32 MiB, 가로·세로 각 8192 이하, 총 33,554,432픽셀 이하 | D-R4-07; `[추론·기술 결정]` |

provider가 준 파일 바이트를 **재인코딩·메타데이터 제거·워터마크 제거 없이** base64로 감싼다. provider가 URL만 주면 릴레이가 공식 Meta 파일 호스트 allowlist로 검증하고 메모리에 다운로드한다(사용자 URL은 받지 않음). 이미지 크기가 앱 계약 상한을 넘으면 `upstream_error`로 종료하고 임의 축소하지 않는다. 앱은 받은 바이트 그대로 `Result.providerFile`에 보존하고 별도 기기 파생본으로 얼굴 재합성/얼굴 없는 결과를 만든다. 서버는 `faceless`를 결정하지 않는다. 결과 내려받기는 보존 검증까지 기능 플래그로 꺼 둔다. 근거: D-R4-04, D-R4-10; research §6.3.

오류: 인증·입력·크기·Meta 오류. 6번째 companion/두 번째 selfPhoto/wardrobe target은 호출 전 `invalid_request`. Meta `content_policy_violation`은 400 false로 그대로 의미를 보존한다. 마스킹이 실패했다면 앱은 이 API를 호출하지 않는다. mock은 `tryon.01`에서 선택한 조합에 맞는 provider 원본 파일을 재생하며 입력 이미지를 합성한 척하지 않는다. 근거: D-R1-04, D-R4-07, D-R4-11.

### 6.7 `POST /v1/route`

목적: 현재 위치에서 **대상 옷의 촬영 위치**까지 도보 경로를 받는다. 가게 spot으로 바꾸거나 핀을 옮기지 않는다. Meta 모델은 호출하지 않는다. 근거: D-R5-01~D-R5-05.

요청 JSON 스키마: `{origin:Point,destination:Point}`; 둘 다 필수, 추가 필드 불가. accuracy·trip 기록·원본 trail은 받지 않는다. 출발·도착만 OSRM에 전달한다. 근거: D-R0-03, D-R5-01; `[추론·기술 결정]`.

`[추론·기술 결정]` 고정 upstream:

```text
GET https://routing.openstreetmap.de/routed-foot/route/v1/driving/{origin.lng},{origin.lat};{destination.lng},{destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false
```

`routed-foot`가 도보 프로필 서버이며 OSRM 경로의 `driving` 문자열을 자동차 안내로 해석하지 않는다. 공식 서버 형식은 통합 때 확인한다. 요청 전체를 통틀어 **초당 1회 이하**, monotonic clock 기반 process-wide 직렬 스케줄러와 단일 worker로 시작 간격 1초 이상을 지킨다. 이 임시 스케줄링은 대화 상태·사용자 쿼터 원장이 아니다. 좌표 포함 URL/응답을 로그나 캐시에 남기지 않는다. 대기와 연결 시간을 합쳐 15초를 넘으면 `upstream_timeout`. 공용 서버 이용 정책·SLA 제한은 출시 전 별도 과제다. 근거: D-R6-02, D-R6-04; research §6.4·§8.2.

| 200 응답 필드 | JSON 타입·제약 |
|---|---|
| `geometry` | `{type:"LineString",coordinates:[lng,lat][]}`; 좌표 2개 이상, 각 Point 범위 |
| `distanceM`, `durationS` | number ≥0; 선택한 routes[0]의 총 거리·시간 |
| `steps` | `{distanceM:number≥0,durationS:number≥0,name:string,maneuver:{type:string,modifier?:string,location:[lng,lat],bearingBefore:number,bearingAfter:number}}[]`; OSRM legs[].steps 순서로 평탄화. name은 빈 문자열 가능, bearing은 0~360 미만 |
| `waypoints` | `{location:[lng,lat],distanceM:number≥0}[]` 정확히 2개. 출발·도착 순; OSRM이 길 위로 snap한 좌표와 요청 좌표까지의 거리 |

앱은 geometry와 steps로 지도·턴바이턴을 만들고, 끝 구간/미연결 구간은 원래 destination을 향하는 방향·직선 거리로 표시한다. 반환 waypoint를 저장한 목적지로 덮어쓰지 않는다. 알 수 없는 maneuver type/modifier는 일반 방향 안내로 표시한다. 근거: D-R5-01, D-R5-04; `[추론·기술 결정]`.

오류: 인증·입력·OSRM 429/5xx/timeout 매핑과 `route_unavailable`. 경로가 없다고 서버가 가짜 직선 LineString을 성공 반환하지 않는다. 앱은 `route_unavailable`에서 기기 방향·거리 모드로 전환하고, 오프라인은 연결 오류와 다시 시도를 표시한다. mock은 `route.01`에 매칭된 출발·도착의 녹화 경로 또는 NoRoute 오류를 반환한다. 근거: D-R1-04, D-R5-04, D-R6-03.

## 7. mock 녹화 선택 계약

`[추론·기술 결정]` 디렉터리는 `verification/fixtures/relay/<scenario>/`이며 파일 이름은 `<operation>.<step>.request.json`, `<operation>.<step>.response.json`, 바이너리 자료는 `assets/<asset-name>.png|jpg|wav`다. operation은 위 절의 `search-turn`, `search-segment`, `transcribe`, `describe-storefront`, `describe-piece`, `tryon`, `route`다. step은 두 자리이며 search-turn=새 Spark 턴 번호, search-segment=전송 전 samPhotos+1, 나머지는 `01`. 근거: D-R1-04, D-R7-06.

- mock 요청은 `X-SF-Fixture: <scenario>`를 보낸다. 생략하면 `normal`. 값은 `[a-z0-9-]{1,64}`만 허용한다. live에서 이 헤더를 보내면 `invalid_request`. 첫 검색 토큰에 scenario를 서명하며 이후 다른 scenario로 바꿀 수 없다. UI 컨트롤을 만들지 않고 검증 harness가 설정한다. 근거: D-R1-04, D-R7-07.
- 응답 파일은 **(scenario, operation, step)** 순서로 선택한다. query·이미지 digest·실제 시각·불투명 ID로 다른 응답을 찾지 않는다. 이 키의 파일이 없으면 501 `fixture_not_found`다. 선택한 fixture의 요청 검증이 실패해도 다른 fixture나 live로 fallback하지 않는다. 근거: D-R1-04; `[추론·기술 결정]`.
- 모든 요청은 **OpenAPI 스키마 검증을 항상 수행**하고, 인증(선택적 skip 제외)·토큰의 참조 관계·기능 상한·실제 미디어 형식 검증도 그대로 적용한다. ignore는 녹화 당시 값과의 비교만 생략하며 유효성 검증을 생략하지 않는다. fixture가 있어도 4턴·3장·7장·15초 상한을 넘는 성공을 반환하지 않는다. 근거: D-R1-04, D-R3-01, D-R4-07.
- `<operation>.<step>.request.json`은 `{expected:object,match:string[],ignore:string[]}`다. match는 정확히 비교할 **RFC 6901 JSON pointer 목록**, ignore는 녹화값과 비교하지 않을 휘발성 필드의 pointer 목록이며 둘 다 명시한다(없으면 빈 배열). expected에는 match 대상의 기대값과 배열 구조를 둔다. pointer는 HTTP JSON 본문 루트를 기준으로 하고 `/`·`~` 이스케이프 및 명시적 배열 인덱스를 쓴다. wildcard·임의 코드·정규식 매칭은 없다. 근거: D-R1-04; `[추론·기술 결정]`.
- 휘발성 필드는 `context.now`·`takenAt` 등 시각, `photoRef`·`shopRef`·`tripRef`·tool call ID 등 불투명 참조, base64 이미지·음성 data, queryToken이다. 해당 요청에 있는 경로를 ignore에 열거한다. 바이트 digest도 비교하지 않는다. 앱에 **clock이나 ID seed를 주입할 필요가 없고**, 실제 촬영 시각·ID·유효한 이미지 바이트가 달라도 같은 녹화를 재생한다. 다만 토큰 자체의 만료·서명·pending 일치와 앱 내 참조 관계는 여전히 검증한다. 근거: D-R1-04, D-R7-10; `[추론·기술 결정]`.
- match에는 query 텍스트(`/query`), 도구 이름(`/toolResults/0/name`), concept(`/concept`), 사진 배열(`/photos`), 출처(`/target/origin` 등 시나리오가 확인할 필드를 둔다. 사진 장수는 배열 구조로 정확히 비교한다. match가 객체/배열이면 양쪽에서 그 하위 ignore 값만 제거한 뒤 나머지 값·배열 길이·순서를 정확히 비교한다. 배열 원소를 삭제하거나 순서를 바꾸지는 않는다. match와 ignore가 같은 pointer이거나 ignore의 하위에 match가 있으면 fixture 정의 오류다. 단순 match scalar는 정확히 동일해야 한다. 근거: D-R1-04; `[추론·기술 결정]`.
- 비교 순서는 match 배열 순서, 구조 비교의 하위 경로는 RFC 6901 pointer 사전순이다. 불일치/필수 match 경로 누락 시 409 `fixture_request_mismatch`, `retryable:false`, 예를 들어 `{error:{code:"fixture_request_mismatch",message:"Fixture request mismatch at /concept",retryable:false}}`를 반환한다. 공통 Error 형식을 유지하면서 **처음 불일치한 pointer를 message에 명시**한다. 실제/기대값·미디어·좌표는 응답이나 로그에 넣지 않는다. 요청 자체가 OpenAPI 위반이면 기존 `invalid_request`이며 mock 비교 실패와 구분한다. 근거: D-R1-04, D-R6-04; `[추론·기술 결정]`.
- response 파일은 `{status:int,body:object,headers?:object}`다. body의 ref 값에는 현재 요청을 echo하는 자리표시자를 쓸 수 있다. 예: `"{{toolResults[0].result[0].photoRef}}"`, `"{{photos[0].photoRef}}"`. dot 경로·숫자 배열 인덱스만 파싱하고 문자열 전체가 자리표시자일 때 요청의 해당 ref로 치환한다. 임의 표현식 평가·문자열 부분 삽입·파일/네트워크 조회는 금지한다. 실제 ToolResult 스키마에 맞는 경로를 써야 하며 누락 참조나 ref가 아닌 값을 반환하려 하면 500 `fixture_invalid`다. 녹화된 가짜 ID 대신 치환한 ref를 후속 토큰 history/pending에도 넣어 정상 루프의 참조 관계를 유지한다. 근거: D-R1-04; `[추론·기술 결정]`.
- queryToken은 response fixture에 저장하지 않고 runtime에서 생성한다. base64 위치의 fixture 전용 `{asset:"assets/..."}` 참조는 loader가 읽어 base64 문자열로 확장한다. 파일은 fixture root 안으로만 resolve한다. echo·asset 치환 후의 최종 body를 실제 응답 OpenAPI 스키마로 검증하며 실패하면 `fixture_invalid`다. 자리표시자/asset 객체를 실제 wire로 보내지 않는다. 모든 성공·녹화 오류는 앱이 live와 동일하게 처리한다. 근거: D-R1-04; `[추론·기술 결정]`.
- `normal`, `shop-specific`, `time-specific`, `note-specific`, `past-trip`, `not-found`, `turn-limit`의 검색 요청은 [agent-tools의 시나리오 표](agent-tools.md#8-mock-fixture가-담아야-할-시나리오)에 정의한다. 추가로 `voice-empty`, `photo-limit`, `tryon-policy`, `route-unavailable`, `upstream-timeout`을 둔다. 같은 정상 이미지/오디오 요청이라도 시나리오 헤더로 원하는 녹화 오류를 선택할 수 있다. 근거: D-R1-04.
- `direct-cut-shop`은 검색·SAM concept 없이 trip 사진을 탭해 잘라 저장한 가게 옷의 라벨링 시나리오다. `direct-cut-shop/describe-piece.01.request.json`은 `{image:Image}`의 `/image/mimeType`을 match에, `/image/data`를 ignore에 둔다. 해상도는 OpenAPI·실제 디코딩 검증으로 확인하며 고정 digest로 비교하지 않는다. 대응 `.response.json`은 `200`과 녹화된 `{label,category}`를 반환한다. 이 API에는 origin 필드가 없으므로 fixture도 요구하지 않는다. 앱 fixture에는 origin=shop인 Piece와 해당 `label_piece` QueueJob을 연결해 오프라인의 "Picked item" → 연결 복구 후 라벨 반영을 검증한다. 근거: D-R1-04, D-R4-08, D-R6-03, D-R9-02.
- fixture는 S11이 승인된 시연 합성 자료와 허용된 응답으로 준비하는 **읽기 전용 검증 자산**이다. 사용자 요청을 live 서버가 자동 저장하는 녹화기가 아니다. 실제 provider 출력 파일을 기록할 때 워터마크·메타데이터를 보존한다. 근거: D-R6-04, D-R7-06, D-R4-10.

## 8. OpenAPI 원본과 타입 생성

1. **code-first**로 진행한다. S00은 `relay/app/schemas.py`에 공통·엔드포인트·도구 스키마 전부를 FastAPI/Pydantic으로 정의하고, 병렬 구현 시작 전에 501을 반환하는 스텁 라우트를 준비한다. S01은 인증·공통 처리, S02/S03은 담당 endpoint를 구현하며 같은 스키마를 사용하고 스텁을 실제 동작으로 교체한다. 스텁은 선행 작업용이며 기능 완료 상태가 아니다. 이 문서의 표/제약을 반영한 **FastAPI가 내보낸 `relay/openapi.json`이 기계 계약의 원본**이다. 예제 JSON을 원본으로 삼지 않는다. 근거: D-R7-02, D-R7-04; `[추론·기술 결정]`(S00 준비 방식).
2. `[추론·기술 결정]` OpenAPI를 `relay/openapi.json`으로 결정적으로 내보내고, 앱은 `openapi-typescript`로 `app/src/generated/relay-api.d.ts`를 생성한다. 생성 파일을 손으로 수정하지 않고 앱에서 동일 DTO를 따로 선언하지 않는다. 도구 arguments/result 타입도 포함한다. `relay/openapi.yaml`, `datamodel-code-generator`, `app/src/relay/types.ts`는 사용하지 않는다. 근거: D-R7-02.
3. S11은 스키마와 생성 파일 차이가 없는지, 각 fixture가 같은 schema를 만족하는지 계약 검증한다. HTTP 요청 wrapper와 기기 Photo/Candidate 변환은 앱 코드지만 wire 타입 원본은 하나다. 변경 시 문서·OpenAPI·생성 타입·fixture를 같은 변경에 갱신한다. 근거: D-R7-02, D-R7-04.

## 9. 검증 항목

아래는 S11이 실행할 계약 테스트 요구이며 이 문서 작성 중 실행한 결과가 아니다. 근거: D-R1-04, D-R7-05.

- [ ] 일곱 경로의 정상·오류 JSON이 OpenAPI와 일치하고 앱 TS 생성 결과와 어긋나지 않는다. 미지 필드/모델/임의 URL/messages/system을 거부한다. (D-R1-02, D-R7-02)
- [ ] 잘못된 Firebase 서명·aud/iss·UID·provider와 다른 App Check app ID를 거부한다. live+skip-auth는 시작 실패, mock skip도 token 검증은 유지한다. (D-R6-01)
- [ ] 토큰 변조·다른 UID·만료·다른 query/context·pending 결과 불일치를 거부한다. 만료는 갱신해도 늘지 않는다. (D-R1-02)
- [ ] 정상 최신 토큰 체인의 **5번째 Spark 턴을 상류 호출 없이 거부**, 4번째에는 도구 비활성. 재전송/fork 방어를 테스트 통과 조건으로 오인하지 않는다. (D-R3-01, D-R6-02)
- [ ] segment 1장 후 2장은 허용하고 **4번째 사진은 거부**. segment 토큰을 다음 turn에 사용하며 SAM 실패도 시도한 장 수가 소비된 종료 토큰을 돌려준다. (D-R3-01)
- [ ] 요청 카운트 조작·중복 ref·본인 2장·옷 7벌·16초 WAV·선언 MIME/실제 해상도 불일치를 provider 호출 전에 거부한다. (D-R4-07, D-R3-07)
- [ ] 무음 WAV의 `text:""`는 성공, 앱 검색 호출은 0회. voice 영어 전사문을 수정하지 않는다. (D-R3-07)
- [ ] SAM 0후보는 성공, 유효한 낮은 점수 후보도 남는다. 업로드→원본 mask/bbox 좌표 변환이 일치한다. (D-R3-02)
- [ ] 옷장 cutout과 검색 없이 바로 자른 가게 cutout 모두 `{image:Image}`로 `/v1/describe/piece`를 호출해 label/category를 받는다. 검색 concept가 있는 가게 옷은 호출하지 않으며, 릴레이 요청에 origin·trip 원본 사진·좌표가 없다. (D-R4-06, D-R4-08, D-R9-02)
- [ ] `direct-cut-shop` mock에서 오프라인에 저장한 가게 옷은 "Picked item"으로 표시되고 `label_piece` 대기열에 남는다. 연결 복구 후 녹화 응답을 해당 Piece에 적용해 이름·종류를 갱신하되 origin=shop을 유지한다. (D-R1-04, D-R6-03, D-R9-02)
- [ ] PE 512차원 L2 norm이 1(허용 오차 1e-5)이고 이미지 타워 checkpoint와 맞는다. live 가중치 없으면 시작 실패, mock은 실제 모델 없이 fixture로 동작한다. (D-R1-04, D-R7-11)
- [ ] Meta `content_policy_violation`, 429, 401/403, 5xx, timeout, 잘못된 응답이 표대로 매핑되고 본문 원문을 노출하지 않는다. Responses 호출은 `store:false`, 내장 도구 없음, 가명 safety_identifier다. (D-R6-01, D-R6-04)
- [ ] 기본 로그에 **요청/응답 본문이 없음**. text 플래그를 켜도 이미지·음성·좌표·OSRM URL·토큰·입력 포함 validation 오류가 없다. 업로드/실패/취소 동안 임시 파일 생성이나 body dump가 없다. (D-R6-04)
- [ ] Muse Image 원본 바이트가 반환·providerFile 저장 후 동일하고 다운로드 플래그는 보존 검증 전 꺼져 있다. (D-R4-10)
- [ ] OSRM 호출 간격은 전체 프로세스에서 1초 이상; 좌표 lng/lat 순서, NoRoute 매핑, 원래 목적지 보존, 경로 없음의 앱 방향 모드를 확인한다. (D-R5-01, D-R5-04)
- [ ] mock은 (scenario, operation, step)으로 응답을 선택하고 OpenAPI·인증·토큰·미디어·기능 상한 검증을 항상 수행한다. 미등록 키는 fixture_not_found이며 실제 네트워크 호출을 하지 않는다. 검색 7개 필수 시나리오와 음성/피팅/경로 오류 시나리오가 포함된다. (D-R1-04)
- [ ] match의 query·도구 이름·concept·사진 장수·출처 중 하나를 바꾸면 fixture_request_mismatch가 발생하고 message에 불일치 pointer가 나온다. 잘못된 OpenAPI 입력의 invalid_request와 구분하며 입력값을 오류·로그에 노출하지 않는다. (D-R1-04, D-R6-04)
- [ ] ignore에 명시한 실제 촬영 시각·불투명 ID·유효한 base64 바이트·queryToken은 녹화값과 달라도 재생된다. clock/ID seed 주입 없이 에뮬레이터 촬영부터 검색이 이어지고, echo ref가 응답·후속 토큰에 반영돼 참조 관계가 유지된다. (D-R1-04, D-R7-10)
- [ ] 무효 echo 경로·미해결 자리표시자·치환 후 응답 스키마 위반은 fixture_invalid다. ignore한 필드라도 잘못된 MIME·해상도·15초 초과 음성·무효 토큰을 허용하지 않는다. (D-R1-04, D-R3-01, D-R3-07)
