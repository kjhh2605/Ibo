# S02 relay-search 구현·검증

## 구현 경계

- `app/routes/search.py`는 Spark 한 턴만 실행한다. 고정 세 도구/프롬프트, signed history의 Responses `function_call`/`function_call_output` 재구성, 별도 wire Ref, 과거 성공 참조·shop 관계·마지막 extract concept, provider JSON strict 검증을 적용한다. 실제 기기 검색 루프·DB를 서버에 복제하지 않는다.
- 4번째 턴은 `tools:[]`다. **Meta는 `tool_choice:"auto"`만 지원**하므로 `none`을 보내지 않는다. 반환된 4번째 function call은 `upstream_error`이며 자동 not_found로 바꾸지 않는다. commentary-phase 메시지는 terminal이 아니며 버린다. reasoning 원문/암호문은 요청하지도 토큰에 저장하지도 않는다. 검증된 도구 대화만 재생하므로 reasoning 연속성 품질은 미확인이다.
- `app/routes/search_segment.py`는 1~3장 전체를 하나의 원자적 릴레이 batch로 소비한다. 공식 SAM 요청은 이미지 한 장이므로 장별 Responses를 순차 호출하되 전체 90초 deadline을 사용한다. 일부 성공 뒤 실패도 전체 오류/소비된 closed 토큰이다.
- SAM은 JSON mask 객체가 아니라 공식 special-token `output_text`다. `app/prompts/sam.py`가 frame 0, inclusive bbox, confidence 일치, crop raster 크기를 검사하고 공식 `meta-sam-parser` codec으로 이진 mask를 디코딩한다. 원본 업로드 크기 canvas에 bbox 위치로 붙여 0/255 grayscale PNG를 반환한다. 점수 안정 내림차순; 동점 provider 순서; 낮은 점수/4번째 이후 후보 보존; 빈 text는 0후보 성공이다. 미지원/손상 grammar를 빈 성공으로 바꾸지 않는다.
- S01 `Settings`, 인증, `QueryTokens.prepare_* / attempt / finish_*`, `FixtureLoader.prepare / Replay.result`, `MetaClient.responses`, 공통 오류/로그를 재사용한다. coordinator가 `finish_turn(..., provider_call_id=...)`와 내부 signed `providerCallId`, SAM 고정 metadata, live lifespan PE loading을 추가했다. 공개 schema 복제·변경은 없다.
- `app/pe_text.py:load_pe_text`는 M1 보존 묶음의 이미지 ONNX/실제 checkpoint/PE 코드·설정·BPE hash를 검증하고 CPU `TextTransformer`에 strict state dict를 로딩한다. CLIP의 직접 상속 구조에 맞춰 `visual.*`, `logit_scale`만 제외한다. CPU/eval/frozen inference, thread-safe 1회 로딩, 실제 phrase만 인코딩하고 finite 512/L2 norm≤1e-5 검사. 가중치 누락/불일치·추론 불능은 명시 실패. 다운로드/다른 모델 fallback 없음.

## 공식 API 근거

2026-11-04 public 문서 확인; live Meta 호출 증거가 아니다.

- [Tool calling](https://dev.meta.ai/docs/tool-calling): flat function tools, `parallel_tool_calls:false`, tool_choice auto-only, call_id 1~64자, stateless call/result pairing.
- [Responses](https://dev.meta.ai/docs/protocols/responses): typed input/output, assistant commentary phase, store:false 및 stateless history. opaque reasoning replay는 이 앱의 검증된 token history 경계 때문에 사용하지 않는다.
- [SAM prompting](https://dev.meta.ai/docs/sam/segmenting): **non-streaming도 지원**, 한 image+concept, `metadata.include_confidence:"true"`, `mask_encoding:"one_bit"`, base64 data URL 입력. Responses의 `store:false`, safety_identifier는 S01 adapter가 강제한다. 전용 API의 미확인 필드를 발명하지 않았다.
- [SAM output](https://dev.meta.ai/docs/sam/reading-segmentation), [client library](https://dev.meta.ai/docs/sam/client-libraries), [official Python package](https://pypi.org/project/meta-sam-parser/0.1.0/): inclusive box와 cropped mask, confidence, base85 codec. `harness.sam_text`의 mask payload는 공개 package README 예제이고 provider 실호출 녹화라고 주장하지 않는다.
- [PE checkpoint revision](https://huggingface.co/facebook/PE-Core-T16-384/tree/8b4722741a516c18e7d311f158f13c600fea6c78), [PE source revision](https://github.com/facebookresearch/perception_models/tree/3e352cca660658d4b5c90f42a7808b11469e4c66): public hash와 M1 coordinator read-only hash가 일치했다. 이것은 이 loader의 M1 실행 성공을 뜻하지 않는다.

## 관측: MacBook mock/HTTP gate

```sh
cd relay
uv run pytest tests/search -q
uv run python tests/search/http_smoke.py
```

- **67 passed**, skip/xfail 0, 최종 fixture 수정 후 1.30초. Starlette/httpx deprecation warning 1개. 기본 suite는 두 실모델 파일을 collection에서 제외한다. 실모델 gate 미실행을 skip 성공으로 합산하지 않는다.
- normal/shop-specific/time-specific/note-specific/past-trip/not-found/turn-limit **7/7** replay. query/tool/concept/photo-count mismatch 409, 누락 fixture 501, dynamic time/ref/byte echo, token binding, provider Ref·최종 관계, [from,to) 경계 검증.
- provider HTTP transport mock을 쓰는 실제 endpoint loop에서 Spark **4회 + SAM 1회**, 네 번째 `tools:[]`, 원래 provider call IDs의 다음 요청 재생을 확인했다. 추가 Spark 요청은 provider 전에 409. 1장→2장 batch와 처음부터 3장 batch 모두 성공 뒤 4번째 사진 거부. SAM partial failure/timeout/malformed output은 전체 오류 및 consumed closed token.
- 실제 **create_app + Uvicorn + loopback TCP**에서 기본/텍스트 로그 두 모드 합계 **18 HTTP 응답**을 관측했다. 모드별 status는 `200×5,409,504,409,400`: list/find/extract/segment/final, 5번째 턴, timeout, fixture mismatch, invalid request. 모든 응답 no-store. 정상 token은 `(sparkTurns=4,samPhotos=1,closed=true)`, timeout token은 소비된 1턴/closed였다.
- HTTP smoke는 4개 SAM 후보 보존, 외부 socket 0, request file write 0, 이미지/위치/token sentinel 로그 부재를 확인했다. 서버/thread/socket은 종료했다. 프로덕션은 파일을 쓰지 않으며 synthetic fixture 파일은 harness가 서버 실행 전에 임시 디렉터리에 생성하고 종료 후 제거한다.
- 테스트의 upstream 응답/PE 벡터/시나리오는 **합성 계약 fixture**다. S11 승인 시연 이미지/실제 Meta 녹화가 아니며 기본 `verification/fixtures/relay` 디렉터리를 만들거나 대체하지 않았다. 배포 mock은 S01 규칙으로 S11 fixture root를 읽는다.

## 별도 실모델 gate: 현재 미완료

MacBook에서 아래 명령을 실제 실행했다.

```sh
env SF_REAL_PE_TEST=1 uv run pytest tests/search/test_pe_real.py tests/search/test_pe_research_compat.py -q
```

결과: **1 passed, 5 setup errors**, skip 0. 실제 `create_app` live startup의 가중치 누락/불일치 거부는 통과했다. CPU 로딩/벡터/revision 세 검사는 `/Users/gnar/.cache/street-fitting/models` 부재로 실패했다. 연구 두 검사는 현재 환경의 `onnxruntime` 미설치로 실패했다. 연구 bundle과 S05 기기 벡터도 이 Mac에 제공되지 않았다. 실제 모델 로딩·top3 7/7·Android 비교·live Meta 품질을 통과했다고 주장하지 않는다.

### M1에서 실행할 정확한 입력

```sh
cd relay
uv sync --extra research
SF_MODELS_DIR="$HOME/.cache/street-fitting/models" SF_REAL_PE_TEST=1 \
  uv run --extra research pytest tests/search/test_pe_real.py -v -s
SF_MODELS_DIR="$HOME/.cache/street-fitting/models" SF_REAL_PE_TEST=1 \
  uv run --extra research pytest tests/search/test_pe_research_compat.py \
  -k research_22_images -v -s
# S05/S11가 아래 device manifest를 제공한 뒤 별도 실행:
SF_MODELS_DIR="$HOME/.cache/street-fitting/models" SF_REAL_PE_TEST=1 \
  SF_DEVICE_PE_MANIFEST="<실제 S05/S11 manifest 경로>" \
  uv run --extra research pytest tests/search/test_pe_research_compat.py \
  -k device_image_vectors -v -s
```

- 기존 `hf_cache/hub/models--facebook--PE-Core-T16-384/snapshots/8b4722741a516c18e7d311f158f13c600fea6c78/PE-Core-T16-384.pt`와 `perception_models/core/vision_encoder/` 및 `pe_image.onnx`가 필요하다. checkpoint SHA-256 `868f89f066b7c1ae51add02d2cb7b925fd051076282773f2ec3c71359fbdaf3b`, image SHA-256 `10b2683490922a82a61ee108673fc94ea455c6ad3996b1f2dc86f93a935d114c`.
- **원 연구** `retrieval_r4/manifest.json` SHA-256 `db6a42b61f9f111e29525d4123f8038d2856aa7a028f775afa36b43a6d663d8e`, `results.json` SHA-256 `039d4247eb1db1b9b639066aa076f1dcaecfda45564df6c5aafcfc32fba490ba`, `image_embeddings.npy`, manifest 순서 그대로 22개 이미지가 필요하다. `/tmp/edgetam-poc/` prefix는 메모리에서만 SF_MODELS_DIR로 바꾼다. 원 `run_*.py` 실행/재-export/기준 파일 덮어쓰기 금지.
- 연구 gate는 실제 이미지 ONNX로 22장을 다시 인코딩하고 보존 Mac 벡터와 max abs≤1e-4를 비교한다. 실제 text loader로 원 7문구를 인코딩해 top3 **7/7**과 원 top3 순서를 검사한다. 이미지 hash, revision, 로딩/7문구 시간, 각 query의 정답/top1/top3를 stdout에 출력한다. 원 top1 6/7은 대조 지표다.
- device manifest는 S05/S11 owner가 제공할 JSON이다: `checkpointRevision`, `imageModelSha256`, `source:{platform:"android",appId:"com.streetfitting.app",device,command}`, `images:[{id,sha256}, ...]`(원 manifest의 22행 순서), `vectorsFile`(manifest 디렉터리 안 상대 .npy), `vectorsSha256`. numpy array shape `(22,512)`, finite/unit norm이어야 한다. 기기 벡터를 Mac 벡터로 대신 넣지 않는다. 이 파일 누락은 명시 실패이며 Mac gate 성공으로 Android gate를 대체하지 않는다.
- 전체 실모델 실행에도 socket connect는 차단된다. 모델/연구 자산은 저장소에 추가하지 않는다. **M1 새 loader 실행, S05 Android 벡터, S11 live Meta 호출/시간 해석 품질/시연 fixture 승인**은 별도 미완료 gate다.

## 공통 통합 gate (MacBook)

- coordinator가 S01/S02/S03을 함께 실행한 `uv --directory relay run pytest -q`: **266 passed**, warning 1개. core/media의 동일 test module 이름 충돌을 package 및 상대 helper import로 해결했다. 범위를 줄이거나 캐시 삭제로 숨기지 않았다.
- 같은 현재 소스의 `tests/search/http_smoke.py`는 위 18개 TCP 응답과 privacy 경계를 다시 통과했다. `scripts/e2e/validate-fixtures.sh --relay`도 10개 chain/12개 production boundary 검사, provider 0회로 통과했다.
- 사용되지 않는 501 bootstrap 함수를 삭제하고 OpenAPI/앱 TS를 다시 생성했다. 501은 이제 fixture not found만 설명하며 정상 제품 endpoint의 대안이 아니다. 실제 PE/Android/live gate는 위 별도 명령 그대로다.

## M1 후속: 연구 query metadata 수정

M1 coordinator는 실제 loader 검사 4개 통과(cold 16.388s, warm 14ms)를 보고했다. 연구 비교 두 검사는 추론 전에 잘못된 metadata equality에서 중단됐다. 두 고정 SHA가 맞는 원본에서도 manifest의 과거 query 목록은 6개이고, 최종 `results.json`에는 실제 평가 7개가 있다.

그 두 목록이 같아야 한다는 부수적인 assertion만 제거했다. 고정 manifest/results SHA, 22개 원본 이미지·전처리·벡터 오차, 최종 results의 7문구·정답·top3 순서, 실제 Android 벡터의 독립 provenance gate는 그대로다. 기준 파일이나 허용 오차를 바꾸지 않았다. 수정 후 두 실제 연구 비교의 결과는 M1 실행 후 기록한다.
