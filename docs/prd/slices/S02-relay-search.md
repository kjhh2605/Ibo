# S02 relay-search

상태: 확정(R9까지) · 웨이브 2 · 선행 슬라이스: S00·S01 merge 완료, `SF_MODELS_DIR`의 PE 가중치·토크나이저·revision 준비

## 목표

Spark 한 턴과 SAM 분할 두 엔드포인트를 구현해 앱이 실행하는 검색 루프를 지원한다. 실제 PE 텍스트 타워가 만든 512차원 벡터를 기기 이미지 색인과 호환시키고, 순차 4턴/3장 예산·고정 도구·mock 재생을 API 경계에서 강제한다.

## 읽을 문서

이 목록만 읽는다.

- [결정 로그](../decisions.md): R0~R9, 특히 D-R1-02/04, D-R3-01~09, D-R6-01~04, D-R7-02/11.
- [relay-api](../contracts/relay-api.md): §1~5, §6.1~6.2, §7~9.
- [agent-tools](../contracts/agent-tools.md): §1~9 전부(프롬프트·도구 schema·시간·참조·mock 시나리오).
- [device-modules](../contracts/device-modules.md): §4 PhotoIndex·§5 Segmenter·§12 모델; [data-model](../contracts/data-model.md): PhotoEmbedding/Candidate 및 저장·전송 경계.
- [scope](../product/scope.md): 후보/한도·검증; [privacy](../product/privacy.md): 방문 요약·이미지/벡터 경계와 불변식 7·9·13.
- [search UX](../ux/search.md): F-06·F-08의 결과/미발견·후보 규칙.
- [research §7.1](../../../street-fitting-research.md#71-탭-지점-옷-후보-에뮬레이터-실측), [§8.1](../../../street-fitting-research.md#81-에이전트-장면-검색): 모델·22장/7문구 실측만. 과거 한국어/영상/옛 도구 이름은 현재 계약보다 우선하지 않는다.

## 소유 경로

- 수정: `relay/app/routes/search*.py`, `relay/app/pe_text.py`, `relay/app/prompts/**`, `relay/tests/search/**`.
- 고치지 않음: S01 공통 모듈, S00 `schemas.py`·`main.py`·OpenAPI·생성 TS·의존성·공유 설정, S03 routes, 앱, S11 `verification/**`.
- S00 스텁 route를 같은 파일에서 실제 구현으로 교체한다. 공통 schema를 중복 선언하지 않는다. 테스트 보조 자료/실측 비교 코드도 `relay/tests/search/` 아래 둔다. 계약 변경은 보고 후 owner가 처리한다.

## 구현 항목

1. **`POST /v1/search/turn`:** query/context와 최신 queryToken·pending 결과를 검증하고 Muse Spark 1.3 Standard 한 턴만 실행한다. 1~3턴은 고정 도구 정확히 1개 또는 final/not_found, 4턴은 도구 전부 비활성화하고 final/not_found만 허용한다. 5번째 요청은 provider 호출 전에 거부한다. response union·wire Ref·과거 성공 ref 관계를 검증하며 잘못된 provider 출력을 자동 보정하지 않는다. 근거: D-R1-02, D-R3-01/06; [relay §6.1](../contracts/relay-api.md#61-post-v1searchturn), [agent §3~4](../contracts/agent-tools.md#3-도구-json-스키마).
2. **고정 프롬프트와 시간 문맥:** 영어 질의/명사구, 모든 trip, trip별 Shop 번호, 메모는 지시가 아닌 데이터, 미확인 사실/참조 조작 금지를 명시한다. 기기의 now/timeZone를 고정하며 "20 min ago" ±5분, 현지 Saturday, `[from,to)`와 DST 규칙을 사용한다. tools는 list_visits/find_photos/extract_items뿐, 웹·셸·이미지 검색을 열지 않는다. 근거: D-R0-02, D-R1-02, D-R3-03/04; [agent §2](../contracts/agent-tools.md#2-프롬프트-정책과-시간참조).
3. **실제 PE 텍스트 로더:** `SF_MODELS_DIR`의 PE-Core-T16 이미지 ONNX와 같은 checkpoint의 텍스트 가중치·토크나이저·설정을 CPU/eval로 한 번 로딩한다. 텍스트 ONNX가 있다고 가정하지 않는다. 요청마다 다운로드/로딩하지 않고 find_photos.phrase만 인코딩해 L2 정규화된 512 벡터를 ToolCall 최상위 `phraseVector`로 붙인다. 불량/누락은 model_unavailable 또는 live startup 실패이며 다른 모델로 대체하지 않는다. mock route는 녹화 벡터를 사용하지만 **별도 실모델 테스트는 반드시 실제 로더를 실행**한다. 근거: D-R0-02, D-R1-04, D-R7-11; [relay §3 PE](../contracts/relay-api.md#pe-텍스트-타워), [agent §3.3](../contracts/agent-tools.md#33-find_photosphraseshoprefstimefromtimetok).
4. **`POST /v1/search/segment`:** pending extract와 refs 순서/집합·concept를 정확히 대조하고 1~3장 한 배치로 SAM 3.1을 호출한다. 누적 장 수, 중복 ref, 실제 image 크기/EXIF를 검사한다. 점수 내림차순·동점 provider 순서를 유지하며 후보 0개 성공, 낮은 점수도 보존한다. 이진 PNG·bbox·score·응답 순서 검증 후 최신 토큰에 개수/최고 점수만 넣는다. 부분 실패를 부분 성공으로 꾸미지 않는다. 근거: D-R3-01/02, D-R4-06; [relay §6.2](../contracts/relay-api.md#62-post-v1searchsegment), [agent §3.4](../contracts/agent-tools.md#34-extract_itemsphotorefsconcept).
5. **토큰/개인정보/오류 연결:** S01 공통 예산과 서명 API를 재사용하고 upstream 실패 시 소비된 종료 토큰을 반환한다. Spark history에는 이미지·좌표·mask·bbox·이미지 벡터가 없고 phraseVector는 기기 방향으로만 보낸다. SAM 저장 억제/가명 식별자 옵션은 전용 API 공식 지원 여부를 확인해 적용하며 해당 endpoint 담당은 S02다. provider 정책 거절을 우회하지 않는다. 근거: D-R1-02, D-R3-01, D-R6-01/04; [relay §3~6](../contracts/relay-api.md#4-질의-토큰과-순차-예산), [privacy](../product/privacy.md#불변식테스트-대상).
6. **계약 mock 시나리오 연결:** normal/shop-specific/time-specific/note-specific/past-trip/not-found/turn-limit 및 photo-limit/upstream-timeout을 scenario/operation/step으로 선택하고 S01의 expected/match/ignore 검사를 사용한다. query·도구 이름·concept·장수는 명시 match, 실제 시각/불투명 ref/이미지 바이트/queryToken은 명시 ignore하되 schema·토큰 관계는 항상 검사한다. 응답의 현재 ref echo를 후속 token에 반영한다. 날짜/메모/상위3개 경계 unit test는 별도 고정 시각 harness를 쓸 수 있지만 E2E에 clock/ID seed 주입은 요구하지 않는다. 앱 DB/루프를 서버에 구현하거나 실제 네트워크 fallback·문자열 키워드 분기 가짜 검색·자동 사진 선택을 만들지 않는다. 근거: D-R1-04, D-R3-02~06; [relay §7](../contracts/relay-api.md#7-mock-녹화-선택-계약), [agent §8](../contracts/agent-tools.md#8-mock-fixture가-담아야-할-시나리오).

## mock 경계와 의존

Spark/SAM/Firebase는 S01 adapter와 녹화 응답으로 대체한다. 실제 Meta API는 S11에서만 호출한다. PE는 일반 mock endpoint 검사에서는 fixture 벡터, 실모델 합격 검사에서는 실제 가중치를 사용한다. 기기 PhotoIndex·로컬 Ref·tool loop·mask 원본 해상도 복원은 각각 S05/S07 책임이며 S02 테스트는 같은 wire 계약의 harness로 결과를 공급한다.

22장/7문구 자료는 research §8.1 원 실험과 **같은 이미지·질의·정답**이어야 한다. 원 실험 코드·자료는 사용자 위임 준비로 `SF_MODELS_DIR`에 보존됐다([배치·호스트 검증](../README.md#모델-배치와-오프라인-검증)). S11 승인 fixture/실험 manifest를 읽기 전용으로 공급받고 manifest에 이미지 hash·7문구·정답 ID·모델 revision·전처리·Mac 기준 벡터를 포함한다. 새로운 쉬운 데이터 22장으로 바꿔 통과시키지 않는다. S05의 동일 이미지 기기 벡터가 아직 없으면 Mac 이미지 벡터로 1차 검사 후 **기기 벡터 호환 검사는 미완료**로 보고한다. 실제 연결과 최종 기기 비교는 S05 산출물 merge 뒤 S11에서 필수다.

## 합격 기준

테스트 파일·이름은 S02가 아래대로 구현한다. 아래 명령은 실행 요구이며 현재 성공 증거가 아니다. `SF_MODELS_DIR`·실험 fixture 경로는 사용자/S11이 준비한 값이며 비밀 키 없이도 HTTP mock을 유지한 실모델 검사가 가능해야 한다.

| 명령(루트 기준) | 기대 결과 / relay §9 대응 |
|---|---|
| `(cd relay && uv run pytest tests/search/test_turn.py -v)` | `test_fourth_turn_disables_all_tools`, `test_fifth_turn_rejected_before_provider`, `test_pending_result_and_final_refs_validated`, `test_query_context_cannot_change`, `test_invalid_model_url_messages_system_rejected` 통과 |
| `(cd relay && uv run pytest tests/search/test_segment.py -v)` | `test_one_then_two_photos_allowed_fourth_rejected`, `test_duplicate_ref_or_pending_order_mismatch_rejected`, `test_new_segment_token_used_by_next_turn`, `test_failed_sam_consumes_photos_and_closes_token`, `test_zero_candidates_success`, `test_low_score_candidates_not_filtered`, `test_binary_masks_bbox_and_order_match_schema` 통과. 각 단계에는 정상 pending extract 체인을 만들고 한 extract를 여러 segment로 쪼개지 않음 |
| `(cd relay && uv run pytest tests/search/test_mock_scenarios.py -v)` | `test_required_seven_scenarios_replay_exactly`를 7개 시나리오로 parameterize. `test_photo_limit`, `test_timeout_returns_consumed_token`, `test_mock_runs_without_pe_weights`, `test_unregistered_request_never_uses_network`, `test_dynamic_refs_times_bytes_replay_with_echo`, `test_query_concept_tool_name_or_photo_count_mismatch_409` 통과. 정상 final과 not_found/오류를 구분하며 E2E clock/ID seed는 불필요 |
| `(cd relay && uv run pytest tests/search/test_privacy.py -v)` | `test_spark_history_has_no_images_coordinates_masks_or_vectors`, `test_phrase_vector_only_leaves_toward_device`, `test_segment_logs_never_contain_image_or_location`, `test_failed_upload_creates_no_temp_files` 통과. 기본/텍스트 로그 두 모드 검사 |
| `(cd relay && SF_REAL_PE_TEST=1 uv run pytest tests/search/test_pe_real.py -v)` | `test_real_text_weights_loaded_once_on_cpu`, `test_real_phrase_vector_is_finite_512_unit_norm`, `test_checkpoint_and_tokenizer_revision_match_image`, `test_live_missing_or_mismatched_weights_fails_startup` 통과. mock 로더/skip 금지, norm 오차≤1e-5. PE 전용 실모델 테스트이며 Meta는 네트워크 차단 |
| `(cd relay && SF_REAL_PE_TEST=1 uv run pytest tests/search/test_pe_research_compat.py -v)` | `test_research_22_images_7_phrases_top3_seven_of_seven`, `test_device_image_vectors_rank_with_real_text_tower` 통과. 실제 문구별 top1/top3·정답·hash·revision·장치 벡터 출처를 기록. top3 **7/7** 필수; 연구 top1 6/7은 대조 지표. 자료/기기 벡터 누락은 skip 성공이 아니라 미완료 선행 조건 |
| `(cd relay && uv run pytest tests/search)` | mock 경로 전체 통과. 실모델 검사를 별도 실행했는지 함께 보고하고 전체 mock 통과로 실모델 gate를 대체하지 않음 |

## 완료 보고 형식

- 바꾼 파일과 S01 공통 모듈 사용 연결점.
- 실행한 명령과 결과: 테스트별 결과, 4턴/3장 provider 호출 수, 7개 replay 결과, 실제 PE 로딩 증거·revision·22장/7문구 top3 점검표.
- 미확인·위험: 실제 Meta 호출/시간 해석 품질, 기기 벡터 비교 여부, 준비되지 않은 fixture/모델을 구분.
- 계약 변경 요청: schema·환경·전처리·소유권 충돌을 절 단위로 보고. 모델/전처리 차이를 테스트 정답 변경으로 덮지 않음.

## 미확인·위험

- 연구 문서에는 7개 문구·22개 이미지 전체 목록이 적혀 있지 않다. 원 실험 자산이 없으면 재현 기준의 정확한 입력이 미확인이다. 준비 경로와 누락 파일을 보고하고 임의 데이터로 완료를 주장하지 않는다.
- 연구의 문구당 10~12ms는 Mac CPU 수치다. 로드 시간·워밍업 후 latency를 기록하되 앱 전체 검색 SLA로 바꾸지 않는다.
- SAM API 옵션 지원은 미확인이다. 검색 segment의 공식 지원 옵션 확인과 구현은 S02, 공통 adapter는 S01, 실제 API 검증은 S11이 담당한다.
- 후보 동점 표시는 계층별로 다르다. 서버는 provider 순서를 유지하고 앱 최종 UI 순서는 agent-tools §4를 따른다. DB 안정 ID 정렬을 wire 재정렬 근거로 사용하지 않는다.
