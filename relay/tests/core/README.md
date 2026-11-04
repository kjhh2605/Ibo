# S01 relay-core: 통합과 검증

## 변경 내용

- Firebase Admin의 실제 RSA 서명/claim 검증, anonymous UID 및 Android App Check app/project binding을 공통 인증 경계에 적용했다. public certificate/JWKS 확인에는 service-account private key가 필요하지 않다. `FIREBASE_AUTH_EMULATOR_HOST`는 검증 우회를 막기 위해 거부한다.
- JSON streaming 크기 제한, 안전한 오류/no-store, metadata-only 로그, 고정 Meta/OSRM host와 deadline, retry 없는 HTTP adapter, 15분 고정 HMAC query token, 명시 필드 fixture replay를 제공한다.
- 입력 검증 후 provider 시도 직전에만 카운터를 소비한다. 실패 토큰은 provider 출력으로 오염되기 전 상태에서 소비된 카운터와 `closed:true`를 서명한다. oversized history는 provider 호출 전에 거부한다.
- shared runtime factory/exporter/bootstrap 연결은 coordinator가 수정했다. S00 목적별 501 라우트는 그대로이며 S02/S03 소유다.

## Runtime 연결

`app.main.create_app(*, schema_only=False, settings=None, verifier=None, transport=None)`가 production 진입점이다. `uvicorn app.main:create_app --factory`로 실행한다. `create_app(schema_only=True)`만 credential-free OpenAPI 생성용이다; runtime에서 사용하지 않는다.

`install_core(app, Settings.from_env(), verifier=None, transport=None)`를 한 번 호출하면 다음을 설치한다.

| state | 소비자 API |
|---|---|
| `app.state.settings` | 명시 mode, fixture/model 경로, logging flag |
| `app.state.authenticator` | `await authenticate(headers)` → `Principal(sub=<64자리 HMAC hex>)`; `close()` |
| `app.state.tokens` | `start`, `sign`, `verify`, `prepare_turn`, `prepare_segment`, `attempt`, `finish_turn`, `finish_segment` |
| `app.state.meta` | `responses(Operation.SPARK/SAM/IMAGE, payload, sub=...)`, `transcribe(wav_bytes)`, `route(origin, destination)`, `aclose()` |
| `app.state.fixtures` | `prepare(scenario, operation, step, raw_request, tokens=..., sub=...)` → `(Replay, QueryState 또는 None)` |

Main은 `auth_headers` dependency를 `require_auth`로 override한다. Endpoint는 `request.state.principal.sub` 또는 `Depends(require_auth)`를 쓴다. CoreBoundary는 인증을 body 읽기/DTO 검증보다 먼저 수행한다. CORS는 CoreBoundary **밖**에 있어 auth/body 오류도 브라우저에 전달하며 `X-Query-Token`, `Retry-After`를 expose한다. CORS preflight에도 no-store가 있다. Lifespan 종료 시 Meta client와 authenticator를 둘 다 닫는다.

테스트에서 `verifier`는 동기 `verify_id_token(token)`, `verify_app_check(token)` method를 가진 adapter다. transport는 `httpx.MockTransport`를 주입할 수 있다. Production에는 둘 다 주입하지 않는다. live+skip-auth는 startup 오류다.

### 환경

저장소 루트에서 `source scripts/worktree-env.sh`를 실행한다. 설치/setup은 다시 하지 않는다. `RELAY_MODE`는 `live` 또는 `mock`를 명시해야 한다. `RELAY_HMAC_SECRET`은 최소 32 decoded bytes의 canonical standard base64다. `RELAY_MOCK_SKIP_AUTH`, `RELAY_LOG_TEXT`는 `0/1`만 허용한다. 인증 시 `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`가 필요하며 live는 `MODEL_API_KEY`도 필요하다. `PORT`는 설정의 포트이고 worktree helper의 `RELAY_PORT`는 launch command에서 사용한다. `SF_MODELS_DIR`, `RELAY_FIXTURES_DIR`가 local artifact 경로를 지정한다. 키/토큰 값은 문서/fixture/log에 쓰지 않는다.

### S02 search 연결

1. `SearchTurnRequest`/`SearchSegmentRequest`를 검증하고 `tokens.prepare_turn(dto, sub, scenario=...)` 또는 `prepare_segment`를 호출한다. CoreBoundary도 raw queryToken의 서명/사용자/시나리오/만료/상한을 body DTO보다 먼저 확인한다.
2. 모든 추가 의미 검증과 mock matching을 끝낸 뒤 `with tokens.attempt(state, 'spark') as consumed:` 또는 `with tokens.attempt(state, 'sam', photos=len(dto.photos)) as consumed:`를 연다.
3. 그 block **안**에서 provider를 호출하고 출력도 검증한 뒤 `finish_turn(consumed, body_without_queryToken)` 또는 `finish_segment`로 응답한다. 오류를 삼키지 않는다; `RelayError` handler가 소비된 closed `X-Query-Token`을 보낸다.
4. `phraseVector`는 endpoint 응답에만 있고 token history/pending에는 없다. Token에는 raw provider response/function output/media/좌표를 추가하지 않는다. 후속 provider 요청의 function-call 연결은 서명된 wire call ID/history에서 복원한다.
5. SAM 여러 사진 전체에는 `async with deadline(Operation.SAM):`을 씌운다. 개별 request timeout을 전체 endpoint deadline으로 착각하지 않는다. OSRM scheduler 대기도 `deadline(Operation.OSRM)` 안에 둔다. Spark/SAM/Voice/Image/OSRM deadline은 각각 60/90/30/180/15초다.

### S03 provider 연결

Meta `responses`는 `https://api.meta.ai/v1/responses`만 호출하며 model/store/safety ID를 adapter가 결정한다. Spark의 function tools는 list_visits/find_photos/extract_items뿐이다. Image의 image_generation에는 image_search/web_search/shell을 false로 강제한다. Voice 전용 API에는 공식 multipart WAV/English 필드만 보낸다. OSRM은 `routing.openstreetmap.de`의 foot service 고정 경로이며 Meta Authorization을 보내지 않는다. Dedicated API에 지원 여부가 확인되지 않은 store/safety 필드를 추가하지 않는다. 실제 모델 입력/출력 변환과 PE 로딩은 S02/S03 책임이다.

### S11 fixture 연결

- `<root>/<scenario>/<operation>.<step:02d>.request.json`과 `.response.json`을 정확히 선택한다. search-turn step은 `sparkTurns+1`, search-segment는 `samPhotos+1`, 단발 operation은 1이다. mock 기본 scenario는 `normal`, live에서 X-SF-Fixture는 거부한다.
- request는 `{expected,match,ignore}`만 가진다. match/ignore는 RFC6901 pointer 배열이며 wildcard가 아니다. match 순서 및 내부 pointer 순서의 첫 불일치만 409에 포함한다. ignore는 descendant 값만 생략하며 배열 길이/순서는 유지한다. match 자체/ancestor를 ignore하는 정의는 500이다.
- `prepare`는 schema/실제 media/token binding/budget/fixture matching을 먼저 검사한다. 반환된 state로 `tokens.attempt`를 열고 그 안에서 `replay.result(tokens=tokens,state=consumed)`를 호출한다. 단발은 `replay.result()`다. Fixture 오류도 실제 provider 실패와 같은 소비/closed 전이를 따른다.
- response는 `{status,body,headers?}`다. header는 429의 숫자 Retry-After만 허용한다. body 어디에도 queryToken을 저장하지 않는다; runtime이 현재 ref와 상태로 서명한다.
- ref echo는 exact `{{toolResults[0].result[0].photoRef}}` 형태만 허용한다. source/destination 모두 photoRef/shopRef/tripRef/pieceRef/toolCallId/id 또는 허용 ref 배열/index여야 한다. 부분 문자열/임의 텍스트 echo는 없다.
- binary data는 `{ "asset": "assets/name.png" }`로 response의 data 필드에서만 읽는다. **scenario directory 안**으로 resolve돼야 한다. 절대경로, URL, traversal, 바깥 symlink는 500이다. Response도 schema/실제 media를 다시 검증한다.
- missing501/mismatch409/invalid500이며 live fallback/자동 녹화는 없다.

## 관측된 검증 (2026-11-04, 기준 M1)

저장소 루트 명령:

```sh
source scripts/worktree-env.sh
uv --directory relay run pytest -q
bash scripts/emulator-lock.sh node relay/tests/core/live_auth_smoke.mjs
env -u RELAY_MODE -u RELAY_HMAC_SECRET -u MODEL_API_KEY -u FIREBASE_PROJECT_ID -u FIREBASE_APP_ID \
  uv --directory relay run python scripts/export_openapi.py --output /tmp/s01-openapi.json
cmp relay/openapi.json /tmp/s01-openapi.json
```

- 통합 pytest: **63 passed**, skip/xfail 없음. Core 56 + bootstrap 7. Core fixture는 socket connect를 차단하며 Meta/OSRM은 HTTP transport mock이다. 실제 RSA-signed Firebase token의 서명/알고리즘/audience/issuer/UID/provider/App Check app 검증과 실패를 Firebase Admin으로 실행했다. 실제 model API 호출 0.
- 예상했던 oversized query/provider-output 전이와 integer/cardinal coordinate text omission을 regression으로 유지한다. 좌표 opt-in logging 누락은 실패 재현 후 수정했다.
- privacy sentinel: 기본 body 로그 없음; opt-in에서도 media/audio/token/좌표 없음; success/error/cancellation에서 file/temp write spy 호출 0. OSRM URL 로그 없음.
- 위 credential-free exporter/cmp: exit 0, 기존 OpenAPI와 byte-identical. 생성된 API/TS 계약 변경 없음.
- 실제 auth smoke는 기존 emulator의 **native SfAuth**에서 받은 토큰을 메모리에서만 HTTP로 전송했다. 실제 `create_app`와 Firebase public-key 검증을 사용했으며 mock skip-auth는 **false**다. 기존 product route가 의도된 S00 `501 not_implemented`까지 도달한 것을 확인하고, test-only `/v1/core-auth-proof`가 검증된 가명을 반환했다. 이것은 S02/S03 제품 기능 완료 증거가 아니다.

| 실제 HTTP scenario | status | 관측 |
|---|---:|---|
| native ID + App Check → 기존 product route | 501 | 인증 통과 후 S00 route 도달 |
| native tokens → test-only principal proof | 200 | 64자리 가명 |
| ID signature 변조 | 401 | unauthenticated |
| App Check signature 변조 | 403 | app_check_failed |
| App Check 누락 | 403 | app_check_failed |
| auth 누락 + invalid JSON | 401 | body보다 인증 우선 |
| valid auth + invalid DTO | 400 | invalid_request |

모든 위 HTTP response에 no-store와 `https://localhost` CORS가 있었다. Logcat을 메모리에서만 검사했고 반환된 ID token/App Check token/등록 debug secret의 exact match는 없었다. 새 emulator/APK 설치/secret 등록은 하지 않았다.

## 제한과 후속 소유자

- 미확인: live Meta/OSRM 연결 및 실제 model-output 변환은 실행하지 않았다; S02/S03 구현 후 S11 mock/live E2E가 소유한다. S01 외부 차단 prerequisite는 없다.
- stateless token은 최신 체인 상한만 검증한다. 재사용/fork 원장, 사용자 quota/비용 DB가 아니다.
- 애플리케이션 파일/로그/DB 무저장을 검사했다. Python RAM 즉시 zero화/OS swap 부재/provider zero retention을 보장하지 않는다.
- Starlette TestClient의 httpx deprecation warning 1개가 남는다. 새 dependency는 추가하지 않았다.
