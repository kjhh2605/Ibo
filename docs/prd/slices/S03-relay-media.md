# S03 relay-media

상태: 확정(R9까지) · 웨이브 2 · 선행 슬라이스: S00·S01 merge 완료

## 목표

영어 음성 전사, 외관/옷 조각 설명, 마스킹 피팅 생성, 도보 경로를 목적별 stateless API로 구현한다. 모든 미디어 입력 상한과 데이터 경계를 provider 호출 전에 검사하고 Meta·OSRM mock으로 관찰 가능한 오류/성공 계약을 완성한다.

## 읽을 문서

이 목록만 읽는다.

- [결정 로그](../decisions.md): R0~R9, 특히 D-R2-04, D-R3-07, D-R4-01~11, D-R5-01~05, D-R6-01~05, D-R9-02/03.
- [relay-api](../contracts/relay-api.md): §1~5, §6.3~6.7, §7~9.
- [agent-tools](../contracts/agent-tools.md): §6 음성 결과 처리·§8 voice-empty.
- [device-modules](../contracts/device-modules.md): §6 FaceMask, §7 Media, §8 Voice, §10 Route.
- [data-model](../contracts/data-model.md): SelfPhoto·Piece·Result, §3·5·6의 snapshot/대기열/전송 규칙.
- [scope](../product/scope.md), [privacy](../product/privacy.md): 확정 한도·기기 밖 경계·불변식 1~3·8~13.
- [search UX](../ux/search.md): F-07, [capture UX](../ux/capture.md): F-04, [tryon UX](../ux/tryon.md): F-10~13, [walk UX](../ux/walk.md): F-15 기능 규칙만. 화면 설계는 S08이다.

## 소유 경로

- 수정: `relay/app/routes/{transcribe,describe,tryon,route}.py`, `relay/tests/media/**`.
- 고치지 않음: S00 schemas/main/OpenAPI/생성 타입/설정, S01 공통 adapter·인증·토큰·mock, S02 search/PE/prompts, 앱, `verification/**`.
- 외관/조각/피팅의 고정 프롬프트와 endpoint 전용 helper는 자기 route 모듈 내부에 둔다. S02 소유 `prompts/`를 공동 수정하지 않는다. 공유 변경은 계약/S00 owner에 요청한다.

## 구현 항목

1. **`POST /v1/transcribe`:** Muse Voice Transcribe에 영어 전사를 요청한다. 엄격한 WAV PCM 16-bit LE/mono/16kHz, sample 1~240000(≤15초), 파일≤512KiB·본문≤1MiB·메타데이터 chunk 금지를 검사한다. duration 선언을 믿지 않는다. `text`를 번역/교정하지 않고 빈 문자열도 정상 200으로 반환한다. 도구·Files API·음성 저장 없음. 근거: D-R0-02, D-R3-05/07; [relay §6.3](../contracts/relay-api.md#63-post-v1transcribe).
2. **`POST /v1/describe/storefront`:** image 1장만 Spark 1.3 Standard로 보내 영어 1~300자의 짧은 시각 설명을 받는다. 지명·좌표·가게 이름·인물 신원 추정을 금지하고 tools 없음, store:false, 가명 safety ID를 적용한다. 큐·DB 저장은 앱 S06 책임이며 카메라 동작을 릴레이에서 대기시키지 않는다. 근거: D-R2-04/07, D-R6-01/03; [relay §6.4](../contracts/relay-api.md#64-post-v1describestorefront).
3. **`POST /v1/describe/piece`의 두 출처:** 옷장 cutout과 검색 concept 없이 trip에서 직접 자른 shop cutout 모두 동일 `{image:Image}`로 이름/종류를 받는다. origin·trip 원본·좌표를 추가하지 않는다. label 1~120, category 1~64의 영어 자유 명사구를 검증하고 신원/브랜드/주인을 추정하지 않는다. 검색 concept가 있는 shop은 앱이 이 API를 호출하지 않는다. 오프라인 "Picked item"/label_piece와 응답 적용은 S06 소유다. 근거: D-R4-06/08, D-R6-03, D-R9-02; [relay §6.5](../contracts/relay-api.md#65-post-v1describepiece), [data §5~6](../contracts/data-model.md#5-저장피팅-불변식).
4. **`POST /v1/tryon`:** `selfPhoto.headMasked=true` 1장 + origin=shop target 1장 + companions 0~5장의 2~7장 입력만 허용한다. 중복 pieceRef, 두 번째 selfPhoto, 6번째 companion, wardrobe target을 provider 전에 거부한다. 고정 Muse Image에 self→target→companions 순서·출력 1장·store:false·tools 없음·가명 ID를 적용한다. 별도 mask 인자는 쓰지 않는다. raw 사진을 요구하거나 headMasked flag를 마스킹 증명으로 주장하지 않는다. 근거: D-R4-01~04/07~11; [relay §6.6](../contracts/relay-api.md#66-post-v1tryon).
5. **결과와 정책 오류 보존:** 공식 Responses의 `image_generation_call.result` base64 파일을 재인코딩/metadata stripping 없이 그대로 반환한다. URL-only 출력은 upstream_error로 거부하고 추가 HTTP 다운로드를 하지 않는다. oversized/missing/잘못된 출력은 오류다. 얼굴 재합성·faceless 결정은 기기 S05/S10, providerFile과 R9 snapshot 저장은 S06/S10, export gate는 S04/S10이며 서버가 대신하지 않는다. 근거: D-R4-04/10/11, D-R9-03, D-R11-03; [relay §6.6](../contracts/relay-api.md#66-post-v1tryon), [data Result](../contracts/data-model.md#result).
6. **`POST /v1/route`:** origin/destination만 고정 FOSSGIS routed-foot OSRM에 `[lng,lat]` 순으로 전달한다. 전체 process 단일 worker에서 monotonic clock으로 시작 간격≥1초, 대기 포함 deadline 15초를 지킨다. routes[0]의 LineString·거리/시간·legs steps·2 waypoints를 검증해 반환한다. NoRoute/NoSegment/빈 경로는 404 route_unavailable, 429/5xx/timeout 등은 공통 표로 매핑하며 가짜 직선 경로를 만들지 않는다. 원래 목적지는 snapped waypoint/Shop.spot로 대체하지 않는다. 근거: D-R5-01~05, D-R6-02/04; [relay §6.7](../contracts/relay-api.md#67-post-v1route).
7. **공통/fixture 연결:** 인증·입력·무저장·로그·timeout·오류는 S01을 재사용한다. transcribe/describe/tryon/route의 scenario/operation/step으로 녹화를 선택하고 expected/match/ignore pointer 계약을 따른다. direct-cut-shop은 image MIME을 match하고 유효한 실제 cutout 바이트를 ignore하며 digest로 다른 녹화를 찾지 않는다. voice-empty·tryon-policy·route-unavailable·upstream-timeout도 같은 규칙으로 재생하고 ignore 필드에도 실제 미디어/장수/토큰 검증은 유지한다. live 자동 녹화·자동 retry·누락 fixture의 live fallback은 없다. 근거: D-R1-04, D-R6-01/03/04, D-R9-02; [relay §2~5·7](../contracts/relay-api.md#7-mock-녹화-선택-계약).

## mock 경계와 의존

Meta·OSRM은 HTTP transport mock/승인 녹화로 대체한다. 입력 파일은 합성 fixture만 사용하며 S11 `verification/fixtures/relay`는 읽기 전용이다. 독립 테스트의 작은 fixture는 `relay/tests/media/` 안에 둔다. 실제 API는 S11 통합에서 호출한다. 앱의 빈 전사 Spark 0회·라벨링 대기열·FaceMask 실패 시 tryon 0회·방향 모드·Result 저장/길 안내까지 서버 테스트로 완료했다고 하지 않는다. 해당 앱 슬라이스가 같은 응답 계약으로 검사한다.

## 합격 기준

아래 명령/테스트를 구현 후 실행한다. 개인정보 테스트는 성공뿐 아니라 실패·취소·timeout에서도 검사한다.

| 명령(루트 기준) | 기대 결과 / relay §9 대응 |
|---|---|
| `(cd relay && uv run pytest tests/media/test_transcribe.py -v)` | `test_15_seconds_allowed_16_rejected_before_provider`, `test_real_sample_count_wav_format_and_metadata_validated`, `test_empty_transcription_is_200`, `test_english_transcript_preserved_verbatim`, `test_audio_size_limit_413` 통과. 앱의 Spark0 검사는 S07/S11 |
| `(cd relay && uv run pytest tests/media/test_describe.py -v)` | `test_storefront_one_image_and_short_english_description`, `test_wardrobe_and_direct_shop_cutouts_share_request_schema`, `test_direct_cut_shop_fixture_returns_label_category`, `test_origin_trip_photo_and_coordinates_not_accepted`, `test_empty_or_oversize_labels_rejected` 통과. 검색 concept가 있는 옷의 호출 생략은 S06/S07 테스트와 연결 |
| `(cd relay && uv run pytest tests/media/test_tryon.py -v)` | `test_two_to_seven_images_allowed_in_order`, `test_sixth_companion_and_second_self_photo_rejected`, `test_wardrobe_target_duplicate_refs_unmasked_self_rejected`, `test_content_policy_violation_400_not_retryable`, `test_provider_bytes_metadata_and_watermark_unchanged`, `test_url_only_provider_output_rejected_without_fetch`, `test_missing_or_oversize_output_is_upstream_error` 통과. invalid 입력 provider 호출0 |
| `(cd relay && uv run pytest tests/media/test_route.py -v)` | `test_fixed_foot_endpoint_lng_lat_order`, `test_no_route_no_segment_empty_routes_map_404`, `test_osrm_429_5xx_timeout_and_bad_schema_mapping`, `test_global_start_interval_at_least_one_second`, `test_queue_wait_included_in_deadline`, `test_steps_and_two_waypoints_preserved`, `test_no_fake_line_and_no_destination_rewrite` 통과. 가상 monotonic clock으로 경계값 검사 |
| `(cd relay && uv run pytest tests/media/test_privacy.py -v)` | `test_responses_store_false_no_tools_pseudonymous_id`, `test_default_logs_have_no_body`, `test_text_mode_has_no_image_audio_coordinates_or_osrm_url`, `test_upload_cancel_failure_create_no_temp_or_cache_files`, `test_request_exif_gps_rejected`, `test_provider_error_does_not_echo_input` 통과. raw SelfPhoto를 서버에 보내 검사하는 방식 금지 |
| `(cd relay && uv run pytest tests/media/test_mock.py -v)` | `test_voice_empty_tryon_policy_route_unavailable_timeout_replay`, `test_direct_cut_shop_replays_with_changed_valid_image_bytes`, `test_target_origin_or_photo_count_mismatch_409`, `test_ignored_audio_still_rejects_invalid_format_or_duration`, `test_request_limits_precede_mock_lookup`, `test_missing_fixture_501_no_live_fallback` 통과. 녹화 body/headers 의미 일치, provider 출력 바이트 digest 일치. 입력 digest 비교는 하지 않음 |
| `(cd relay && uv run pytest tests/media)` | 전체 정상·오류 응답이 S00 OpenAPI에 일치하며 테스트 통과, 실제 Meta/OSRM 호출0 |

## 완료 보고 형식

- 바꾼 파일과 담당 5개 endpoint의 연결점.
- 실행한 명령/결과: 장수·WAV 경계·오류 코드·replay·provider digest·OSRM 가상 clock 간격, privacy 결과.
- 미확인·위험: 실제 API ID/옵션/출력 비율/마스킹 유지·OSRM 이용 정책은 통합 전 미확인으로 구분.
- 계약 변경 요청: 임의 옵션/응답 shape를 추가하지 말고 공식 근거와 schema 영향을 보고.

## 미확인·위험

- 전용 Voice API의 `store`/`safety_identifier` 지원과 Muse Image 비율·마스킹 유지는 미확인이다. Responses 형식을 전용 API에 억지로 전송하지 않는다. URL-only 결과 다운로드는 D-R11-03으로 제외했다.
- origin을 전송하지 않는 describe/piece API는 출처 판별을 하지 않는다. 두 출처 테스트는 서로 다른 합성 cutout을 같은 schema로 보내는 것이며 앱 큐/표시까지 흉내 내지 않는다.
- OSRM 응답의 `driving` 경로 문자열은 routed-foot 서버의 형식이다. 앱을 자동차 안내로 바꾸거나 경로 없음에 직선 성공을 반환하지 않는다.
- 결과 원본 보존은 서버의 바이트 동일성 gate이며, 갤러리 내보내기 승인은 S11 provenance 검사 후에만 가능하다.
