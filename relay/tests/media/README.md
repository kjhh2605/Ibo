# S03 relay-media 구현·검증

## 구현 경계

담당 경로는 `app/routes/{transcribe,describe,tryon,route}.py`와 `tests/media/**`다. 인증·입력 파일 검사·fixture 선택·오류·로그·provider transport는 S01을 재사용한다. schema/main/config/transport/product 계약 변경은 coordinator 소유이며 이 작업자는 수정하지 않았다. S02의 PE 모델 준비·검색은 별도 gate다.

- `POST /v1/transcribe`: 검증된 WAV를 전용 multipart API로 전송하고 `transcript`를 공백·문장부호까지 그대로 반환한다. 빈 전사도 200이다. 실제 PCM sample/chunk/size 검사는 공통 Audio DTO가 provider 전에 수행한다.
- `POST /v1/describe/storefront`, `/v1/describe/piece`: 이미지 1장과 route 내부 고정 영어 정책을 Spark 1.3 Standard에 보낸다. Responses `text.format`의 JSON Schema 출력과 실제 응답을 검증한다. 거절은 정책 오류, 잘못된 JSON/빈 label/상한 초과/예상치 않은 도구는 상류 오류다. 옷장/바로 자른 가게 조각은 같은 입력을 사용한다.
- `POST /v1/tryon`: 마스킹 본인 → 가게 target → companions 순서, 총 2~7장이다. `headMasked`는 기기 완료 신호이며 시각적 마스킹 증명이 아니다. 원본 본인 사진이나 별도 mask를 요구하지 않는다. Muse Image의 웹/이미지 검색·shell은 false, low reasoning, PNG를 고정한다. 출력은 정확히 1장만 받으며 원래 파일 바이트를 재인코딩하지 않는다.
- D-R11-03 사용자 승인에 따라 **공식 Responses base64 출력만** 받는다. URL-only 출력은 `502 upstream_error`, 추가 GET 0회다. 임의 파일 host allowlist·다운로더·다른 endpoint fallback을 만들지 않았다.
- `POST /v1/route`: FOSSGIS foot 응답 첫 경로, legs 순서의 steps와 2개 snapped waypoints를 변환한다. 원래 destination을 재작성하거나 가짜 직선을 만들지 않는다. 단일 worker/event loop에서 process-wide scheduler를 공유하며 queue와 transport 전체에 15초 deadline을 적용한다. 실제 HTTP 시작 간격을 보수적으로 보장하려고 이전 attempt가 끝난 시각부터 1초를 기다린다. 자동 retry는 없다.
- mock은 `(scenario, operation, 01)`만 사용한다. 입력 실제 파일 검사 후 matching하며 누락 녹화는 501이다. ignore는 유효성 검사를 우회하지 않는다.

## 공식 공개 문서 확인 (2026-11-04)

실호출 성공 증거가 아니라 요청/응답 형식의 1차 출처다.

| 출처 | 확인 내용 |
|---|---|
| [Meta speech-to-text](https://dev.meta.ai/docs/speech-to-text) | `/v1/asr/transcribe`, request/audio multipart, WAV PCM16 mono 16/24kHz, PUSH_TO_TALK, 응답 `transcript` |
| [Meta overview](https://dev.meta.ai/docs/overview) | Standard `muse-spark-1.3`, `muse-image-1.0`, `muse-voice-transcribe-1.0` |
| [Meta structured output](https://dev.meta.ai/docs/structured-output) | Responses는 `text.format`; Chat의 `response_format`과 혼용하지 않음 |
| [Meta image generation](https://dev.meta.ai/docs/image-generation) | interleaved input_image 순서, `output[].image_generation_call.result` base64, output_format PNG, low reasoning, 내부 도구 false 제어, size는 정확한 픽셀 수가 아닌 비율 |
| [Meta images schemas](https://dev.meta.ai/docs/api-reference/images/schemas) | WxH 문자열 비율; 고정된 3개 aspect ratio enum을 임의로 가정하지 않음 |
| [Meta Responses schemas](https://dev.meta.ai/docs/api-reference/responses/schemas) | store:false, safety_identifier, input_image, structured output |
| [FOSSGIS about/usage](https://routing.openstreetmap.de/about.html) | 최대 1req/s, 유효한 User-Agent, 무거운 이용/스크래핑 금지, provider 자체 경로 요청 로그 존재 |

Voice `languageBias:["English"]`는 공식 문서상 **힌트**이며 강제 영어 변환이나 번역 옵션이 아니다. Dedicated Voice에 지원 근거가 없는 store/safety 필드를 넣지 않았다. 이미지 size는 self의 WxH를 그대로 사용하되 공식 가이드의 최대 비율 16:1/1:16로 제한한다. 출력 픽셀 크기·비율 정확도·머리 마스킹 유지 여부는 실제 API에서 미확인이다. 공식 Responses 경로에 URL-only 출력 형식/파일 host 근거가 없어 승인받은 base64 cutover를 적용했다.

## 최종 MacBook 관측

```sh
cd relay
uv run pytest tests/media -q
```

- **120 passed**, skip/xfail 0, 4.38초. 기존 Starlette/httpx deprecation warning 1개다. 실제 외부 socket connect를 차단하고 Firebase verifier 및 provider HTTP transport만 합성 adapter로 주입했다.
- 포함: 15초 허용/16초·잘못된 PCM·metadata chunk 거부, WAV/file 상한, 전사 원문/무음, 설명 두 출처·스키마·거절, 피팅 2~7장 순서·불법 구성, 정책·rate/timeout/upstream 오류, synthetic PNG/JPEG 원본 digest와 metadata 보존, URL 거부, OSRM NoRoute/NoSegment·잘못된 경로·snapped 목적지·알 수 없는 maneuver 보존, 가상 clock 간격·queue deadline·취소, fixture mismatch/ignore/missing/오류, 개인정보 로그·파일 무저장 검사.
- 첫 실행에서 strict JSON+공통 before-validator 조합이 GeoJSON 배열을 tuple로 허용하지 않아 정상 route가 502였다. 좌표 컨테이너만 tuple로 변환하고 strict number 검증은 유지하여 해결했다. 정상/숫자 문자열 거부 회귀 검사를 유지한다.
- 첫 HTTP smoke에서 예약 clock은 1초 간격이었지만 request 준비시간 차이로 실제 transport 시작 간격 하나가 0.999986초였다. scheduler를 이전 attempt 종료 후 1초 간격으로 보수화했고, preparation jitter 회귀와 실제 HTTP 재실행으로 확인했다.

### 실제 loopback HTTP smoke

메모리 내 Python `-c` 스크립트로 **실제 `create_app` + Uvicorn**을 `127.0.0.1`의 임시 TCP 포트에서 실행했다. ASGI TestClient만 호출한 결과가 아니다. 스크립트 파일은 만들지 않았고 server/thread/socket 종료를 확인했다. 상세 관측은 [`http-smoke.json`](http-smoke.json)이다.

- 33개 실제 HTTP 응답: 담당 5개 endpoint 성공, 음성 빈 문자열/15초/16초/형식/크기, 피팅 2장/7장/6번째 companion/중복/두 self/wardrobe target/unmasked, policy/URL/missing/timeout/5xx, route 성공/no-route/429/5xx/timeout/queue deadline, 인증 우선 401·App Check 403, GPS 입력 거부.
- mock provider transport 19회, 외부 provider 연결 0회, 요청 중 builtins file-write spy 0회, 모든 응답 `Cache-Control:no-store`다. 개발 text logging을 켠 DEBUG 로그에 이미지·음성·좌표·OSRM URL·provider 오류 원문·원본 UID·키/토큰 sentinel이 없었다.
- 실제 route transport 시작 간격(초): `1.003332, 1.003109, 1.002651, 1.002787, 1.002254`; 모두 1초 이상이다. queue deadline은 20ms로 축소한 같은 deadline 경로에서 provider 호출 0회를 확인했다. 기본 production deadline은 15초이며 테스트 뒤 복구했다.
- generated synthetic PNG와 HTTP 반환 파일의 SHA-256이 동일하다. 실제 Muse watermark/provenance 보존 승인으로 확대하지 않는다.
- media suite와 smoke의 live-mode transport adapter 검사를 위해 **PE loader만 테스트 범위에서 격리**했다. 실제 PE 로딩·검색 성공 또는 통합 production startup 성공을 뜻하지 않는다. 파일/임시 파일/취소 무저장 검사는 suite에도 있으며 RAM 즉시 zero화/OS swap/provider 무보관을 보증하지 않는다.

## 남은 실제 gate

이 작업에서 Meta/OSRM live 호출, M1 실행, emulator E2E, 실제 Firebase token 발급은 하지 않았다. coordinator가 M1의 통합 suite/HTTP 및 실제 API gate를 수행해야 한다. 영어 음성 정확도, 외관/조각 설명 품질, Muse 이미지 생성·마스킹 유지·픽셀 정렬·실제 provenance, provider latency, 앱 queue/빈 전사 Spark 0회/FaceMask 실패 업로드 0회/Result 저장·기기 재합성·길 안내는 이 mock 증거로 완료 처리하지 않는다. 결과 다운로드 플래그는 계속 OFF다. main/PR merge나 commit은 수행하지 않았다.
