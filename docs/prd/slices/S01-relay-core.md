# S01 relay-core

상태: 확정(R9까지) · 웨이브 1 · 선행 슬라이스: S00 merge 완료

## 목표

모든 릴레이 경로가 같은 인증·무저장·오류·질의 토큰·mock 규칙을 사용하게 한다. 실제 목적별 모델 호출 구현은 S02/S03에 남기고, 최신 토큰 체인의 4턴/3장 예산과 안전한 provider 경계를 공통 모듈로 제공한다.

## 읽을 문서

이 목록만 읽는다.

- [결정 로그](../decisions.md): R0~R9, 특히 D-R1-02/04, D-R3-01, D-R6-01~05, D-R7-02/05/07, D-R8-01.
- [relay-api](../contracts/relay-api.md): §1~5, §7~9 전부; §6은 공통 오류·타임아웃 연결점.
- [agent-tools](../contracts/agent-tools.md): §1~4의 토큰 history/pending·도구 envelope, §8 fixture.
- [device-modules](../contracts/device-modules.md): §1의 개인정보 경계; [data-model](../contracts/data-model.md): §3의 전송/로컬 저장 분리.
- [scope](../product/scope.md): 전제·제외 범위·검증; [privacy](../product/privacy.md): 릴레이와 로그, 불변식 7·9·13.

## 소유 경로

- 수정: `relay/app/{auth,errors,logging,meta_client,mock,token,config}.py`, `relay/tests/core/**`만.
- 고치지 않음: S00 `main.py`, `schemas.py`, `pyproject.toml`, lockfile, `openapi.json`, 라우터 자동 등록·생성 TS, S02/S03 route 파일·프롬프트·PE, 앱 전체, `verification/**`.
- 공유 dependency 연결점이 없으면 S00 owner에게 요청한다. 기존 계약 파일은 변경하지 않는다. 로컬 테스트 fixture는 `relay/tests/core/` 안에서만 만들고 S11 공유 시연 자산을 대신 만들지 않는다.

## 구현 항목

1. **인증·환경 검증:** Firebase ID token 서명/알고리즘/만료/aud/iss/UID·anonymous provider, App Check 프로젝트/app ID를 계약 순서로 검사한다. `RELAY_MODE` 명시 필수, live+skip-auth 시작 실패, mock skip은 Firebase만 생략한다. `HMAC-SHA256(secret,"safety:v1:"+UID)`의 가명만 Meta로 보낸다. 키/토큰/원본 UID는 앱·fixture·로그에 없다. 근거: D-R6-01, D-R7-07; [relay §2](../contracts/relay-api.md#2-인증과-환경).
2. **안전한 공통 I/O:** JSON/base64만 수용하고 streaming body 크기 제한, 엄격한 MIME/크기/메타데이터 검사 공용 함수를 제공한다. 이미지 GPS·원격 URL·추가 필드·압축 본문을 거부하고 UploadFile/temp spill을 쓰지 않는다. 모든 응답에 `Cache-Control:no-store`, FastAPI 422를 400 `invalid_request`로 변환하며 오류에 입력 원문을 붙이지 않는다. 근거: D-R0-02, D-R6-04, D-R7-02; [relay §1·5](../contracts/relay-api.md#1-경계와-공통-전송-규칙).
3. **질의 토큰 primitive:** prefix 분리 HMAC·constant-time 검증·15분 고정 만료·sub/query/context binding·pending/history·closed를 구현한다. 토큰에는 이미지/음성/좌표/mask/phraseVector를 넣지 않는다. 최신 체인의 카운터는 validation 뒤 provider 시도 직전에 증가하며, 실패면 소비된 closed 토큰을 `X-Query-Token`으로 돌려주는 공통 API를 제공한다. 4턴 초과 검사는 closed 검사보다 먼저다. 재전송/fork 원장·쿼터 DB는 만들지 않는다. 근거: D-R1-02, D-R3-01, D-R6-02; [relay §4](../contracts/relay-api.md#4-질의-토큰과-순차-예산).
4. **provider 공통 adapter:** 서버 고정 host/model만 받는 내부 interface와 HTTP timeout/취소, 안전한 오류 매핑을 만든다. 사용자 provider URL/임의 system/tools를 받아서는 안 된다. Responses에는 `store:false`·가명 safety ID·허용 도구만, 전용 API는 공식 지원 필드만 보낸다. deadline은 Spark 60/SAM 90/Voice 30/Image 180/OSRM 15초이며 자동 retry 없음. endpoint별 요청/응답 변환은 S02/S03 소유다. 근거: D-R1-02, D-R6-01/03/04; [relay §5·6](../contracts/relay-api.md#5-공통-오류-계약).
5. **무저장과 허용 목록 로그:** 정적 endpoint·가명·latency·status·sparkTurns만 기본 기록한다. `RELAY_LOG_TEXT=1`도 허용 schema의 query/Spark 텍스트만이며 좌표가 섞이면 필드 전체를 생략한다. SDK tracing·HTTP body dump·OSRM URL·validation 입력·queryToken을 차단한다. 취소/오류에도 요청 미디어를 파일/DB/cache에 남기지 않는다. 근거: D-R6-04; [relay §3](../contracts/relay-api.md#3-무저장로그모델-준비), [privacy 불변식](../product/privacy.md#불변식테스트-대상).
6. **명시 필드 mock replay:** `RELAY_FIXTURES_DIR/<scenario>/<operation>.<step>`의 **scenario/operation/step**으로 파일을 선택한다. request fixture의 `{expected,match,ignore}`와 RFC 6901 pointer로 query·도구 이름·concept·사진 장수·출처를 비교하고 시각/불투명 ID/base64/queryToken은 명시 ignore한다. digest 비교나 앱 clock/ID seed 주입은 요구하지 않는다. ignore도 OpenAPI·실제 미디어·인증·토큰 관계·예산 검증은 면제하지 않는다. 처음 불일치 pointer만 409 fixture_request_mismatch에 넣고 실제/기대값은 숨긴다. response ref echo는 허용 dot/index 경로만 치환하고 토큰 history에도 현재 ref를 반영하며 최종 응답 schema를 재검증한다. 무효 echo/정의는 500 fixture_invalid, 없는 키는 501 fixture_not_found다. asset path escape·live fallback·실사용자 자동 녹화는 없다. 근거: D-R1-04, D-R6-04, D-R7-06; [relay §7](../contracts/relay-api.md#7-mock-녹화-선택-계약).

## mock 경계와 의존

Firebase는 unit test에서 서명·claim 검증 adapter를 통제하고 Meta/OSRM은 HTTP transport mock으로 대체한다. 이것을 live skip-auth로 사용하지 않는다. S02/S03은 S01 merge 뒤 이 모듈을 사용한다. S00 501 라우트를 S01이 기능 라우트로 바꾸지 않는다. 따라서 S01은 공통 primitive와 테스트용 ASGI app으로 기능을 검증하고, 실제 경로 wiring은 해당 라우트 소유자 테스트와 S11에서 확인한다. PE 모델 로딩은 S02 책임이다.

## 합격 기준

아래 테스트 이름을 `relay/tests/core/`에 구현한다. 명령은 저장소 루트 기준이며 전부 네트워크 차단 mock 환경에서 실행한다. 현재 실행 결과가 아니라 구현자의 합격 요구다.

| 명령 | 기대 결과 / relay §9 대응 |
|---|---|
| `(cd relay && uv run pytest tests/core/test_auth.py -v)` | `test_invalid_signature_audience_issuer_uid_provider_rejected`, `test_wrong_app_check_app_rejected`, `test_live_skip_auth_fails_startup`, `test_mock_skip_preserves_query_token_validation`, `test_meta_receives_pseudonym_not_uid` 통과 |
| `(cd relay && uv run pytest tests/core/test_token.py -v)` | `test_tamper_other_uid_expiry_rejected`, `test_query_context_pending_mismatch_rejected`, `test_expiry_never_extends`, `test_fifth_turn_rejected_before_provider`, `test_fourth_sam_photo_rejected_before_provider`, `test_failed_attempt_closes_consumed_token`, `test_restart_with_same_secret_accepts_unexpired_token` 통과. 카운터 primitive 검사이며 endpoint 테스트는 S02에서 추가 |
| `(cd relay && uv run pytest tests/core/test_validation.py -v)` | `test_unknown_fields_models_urls_messages_system_rejected`, `test_chunked_body_limit_without_content_length`, `test_invalid_base64_mime_dimensions_gps_rejected`, `test_validation_error_has_no_input`, `test_all_responses_no_store` 통과 |
| `(cd relay && uv run pytest tests/core/test_errors.py -v)` | `test_policy_400_false`, `test_rate_limit_429_safe_retry_after`, `test_provider_credentials_502_not_client_401`, `test_timeout_504`, `test_bad_response_502`, `test_no_automatic_retry` 통과. 안전한 영어 message만 반환 |
| `(cd relay && uv run pytest tests/core/test_privacy.py -v)` | `test_default_logs_contain_no_request_or_response_body`, `test_text_logs_never_contain_image_audio_coordinates_tokens`, `test_coordinate_text_field_omitted`, `test_osrm_url_not_logged`, `test_success_failure_cancel_create_no_upload_files` 통과. sentinel을 로그·temp·파일 쓰기 spy에서 검사하며 테스트가 sentinel 본문을 실패 로그에 덤프하지 않음 |
| `(cd relay && uv run pytest tests/core/test_mock.py -v)` | `test_scenario_operation_step_select_exact_response`, `test_match_pointer_mismatch_returns_409_without_values`, `test_ignored_time_refs_bytes_and_token_replay`, `test_ignore_does_not_bypass_schema_media_or_limits`, `test_echo_refs_propagate_to_response_and_token`, `test_invalid_echo_or_definition_returns_500`, `test_runtime_resigns_query_token`, `test_scenario_cannot_change`, `test_live_fixture_header_rejected`, `test_missing_fixture_returns_501_without_network`, `test_asset_path_escape_rejected` 통과 |
| `(cd relay && uv run pytest tests/core)` | 전체 통과, skip/xfail로 미완료 항목을 숨기지 않음. live API 호출 0 |

## 완료 보고 형식

- 바꾼 파일: 위 소유 경로만 열거.
- 실행한 명령과 결과 요약: pytest 명령·통과/실패 수, provider 호출 0 및 privacy sentinel 결과.
- 미확인·위험: live 인증·Meta/OSRM 연결은 미실행으로 구분.
- 계약 변경 요청: S00 연결점·공유 타입 변경이 필요하면 구체 절/시그니처/소비자를 기록.

## 미확인·위험

- stateless HMAC 토큰은 재사용/fork 방어가 아니다. 이 제한을 버그처럼 숨기거나 사용자별 원장을 추가하지 않는다.
- Python 런타임에서 RAM 즉시 zero화·OS swap 부재까지 보장하지 않는다. 합격 범위는 애플리케이션의 파일/로그/DB 무저장이다.
- provider 전용 API의 `store`/`safety_identifier` 지원 여부는 미확인이다. S02/S03이 공식 지원을 확인하고 S11 live 증거로 남긴다.
- 릴레이는 로컬 Mac만 실행하며 클라우드 배포·APK 공개·비용 상한은 범위 밖이다(D-R6-02/05, D-R8-01).
