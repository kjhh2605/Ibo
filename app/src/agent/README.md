# S07 앱 검색 에이전트

## 공개 계약

`index.ts`는 실제 `Store`, `PhotoIndex`, `Voice`, `Network`, relay client와 공용 `native/files`를 연결한 `agent`를 내보낸다. 테스트는 `createAgentController(deps)`로 명시적인 mock 의존성을 주입한다. production entrypoint에는 fixture import, 성공 타이머, 자동 재시도 또는 mock fallback이 없다.

- `getState()` / `subscribe(listener)`는 `useSyncExternalStore`에 연결할 수 있는 headless 상태 계약이다. 정확한 타입은 `types.ts`에 있다.
- `submit(query)`, `startVoice()`, `stopVoice()`, `cancel()`, `dispose()`는 비동기다. `stopVoice()`의 반환 녹음은 사용하지 않고 `completed` 이벤트만 전사를 시작한다.
- `setStepsExpanded(boolean)`은 단계 이력을 접고 펼친다. `setShowAll(boolean)`은 전체 캐시에서 상위 3개/전부를 바꾸며 네트워크를 사용하지 않는다.
- `running` 동안 `photos`, `candidates`, `visibleCandidates`는 비어 있다. 유효한 final 이후에만 결과가 공개된다. 후보가 0개여도 final 사진은 수동 탭 선택용으로 남는다.
- Pick을 여는 동안 controller를 유지한다. `Store.saveCandidate()`를 **await한 뒤** 검색 흐름을 떠날 때 `cancel()`한다. 취소는 저장되지 않은 임시 mask를 회수하므로 저장과 취소를 동시에 시작하지 않는다.
- 구독 콜백은 상태 변경만 알린다. event는 run별 이력에 있고, 오류에는 안전한 `code`/`retryable`만 있다. 토큰은 snapshot, 파일 또는 로그에 노출하지 않는다.

## 구현 불변식

모든 trip과 Store 페이지를 읽는다. 방문 요약은 좌표 없는 allowlist로 직렬화하며 메모 원문을 보존한다. photoRef/shopRef/tripRef는 run마다 새로 생성한다. 시간 범위는 `[from,to)`이고 질의 시작 이후 미래 행은 제외한다. `find_photos`는 item 사진에 가게/시간 조건을 먼저 적용하고 그 ID 목록을 PhotoIndex에 넘긴다. native가 정한 순서를 유지하고 PE 점수로 SAM 후보를 제거하지 않는다.

한 controller의 작업은 직렬 실행한다. 새 질문/취소는 이전 AbortSignal을 즉시 중단하고 늦은 응답을 무시한다. transport가 abort를 무시하더라도 이전 요청이 끝나기 전에 다음 HTTP 요청을 시작하지 않는다. 최신 opaque token을 바로 교체하며 Spark 4턴, 누적 SAM 3장을 초과 전송하지 않는다. 오류나 만료에서 토큰 fork/재전송을 하지 않는다.

Store 변경 이벤트와 비동기 경계에서 참조의 존재를 다시 확인한다. 삭제는 `data_changed`로 끝내며 후보와 ref를 회수한다. 늦게 끝난 mask 쓰기도 먼저 cleanup 집합에 등록한 뒤 취소 여부를 검사한다. 캐시 파일은 `writeTemp`에 `ownerId: photo.id`를 전달한다.

SAM 입력은 선택된 shop item 사진만 픽셀로 다시 그려 EXIF/GPS를 제거한 최대 2048px/4MiB JPEG다. 후보 PNG는 원본 사진 크기로 nearest-neighbor 복원한 grayscale-8 0/255 mask다. bbox는 tight `[x,y,width,height]`이고 ID는 `SHA256(UTF8(photoId) + UTF8('sam') + 원본 크기의 binary pixels)`다. provider ID와 PE 점수는 후보 ID/필터에 사용하지 않는다.

WAV는 실제 RIFF/fmt/data 헤더, PCM16/mono/16kHz, sample 수 1..240000, 메타데이터 chunk 부재를 검사한다. 비어 있지 않은 전사문은 공백/대소문자 포함 그대로 새 검색에 사용한다. 빈 전사/무음은 idle 안내이고, 오프라인/전사 실패는 오류다. 양쪽 모두 WAV를 회수한다.

## 실행 검증

2026-11-04 실행 결과:

```sh
cd app
npx vitest run src/agent
# 2 files passed, 49 tests passed
npx vitest run src/agent -t scenario # 22 passed
npx vitest run src/agent -t state    # 9 passed
npx vitest run src/agent -t privacy  # 1 passed
npx vitest run src/agent -t voice    # 7 passed
```

`controller.test.ts`는 Date만 2026-11-04 14:00 +09:00으로 고정한다. 오늘/지난 토요일의 같은 Shop 2, 13:35 포함/13:45 제외, 메모, 전체 trip, pending 결과, 후보 tie 순서, top3/Show all, 0후보 탭, 5번째 turn 차단, 누적 SAM 초과 차단, 취소/삭제/늦은 파일, 중복 completed, WAV/오프라인/전사 오류를 검증한다. `tools.test.ts`는 wire allowlist와 잘못된 참조/벡터/시간 및 실제 PNG 압축 해제를 검증한다. native 색인 대기 30초/모델 정확도 자체는 S05 소유다.

실제 Chromium + HTTP smoke:

```sh
# 저장소 루트, 첫 터미널
source scripts/worktree-env.sh
VITE_SF_RUNTIME=web-mock npm --prefix app run dev -- --host 127.0.0.1 --port 5197 --strictPort
# 두 번째 터미널
S07_APP_ORIGIN=http://127.0.0.1:5197 \
S07_EVIDENCE=/tmp/s07-agent-smoke.json node app/src/agent/smoke.mjs
```

`smoke.mjs`는 실제 controller, relay fetch, Canvas JPEG 재인코딩, PNG decode/encode를 실행한다. endpoint만 로컬 HTTP 명시적 mock이며 Store/PhotoIndex/Voice 의존성은 테스트 구현이다. 관찰 결과: 4 turn + 1 SAM batch, 후보 4개 보존, 처음 3개/펼친 뒤 4개, segment token 전달, 원본 좌표 bbox `[2,0,2,4]`, grayscale-8 PNG, 같은 mask의 안정 ID, dispose 후 임시 파일 0개. 검색 HTTP payload의 로컬 ID/좌표/미디어 부재와 JPEG의 EXIF 부재도 assert한다. 실제 실행 증거는 `evidence/smoke.json`이다.

## 통합 경계

- 실제 Meta Spark/SAM/Voice 호출과 provider의 자연어 시간·메모 해석: 이 검증에서는 **미확인**, S02/S11 live 통합 대상이다. fixture는 올바른 tool arguments를 전달할 뿐 언어 이해의 증거가 아니다.
- Android 파일 접근, 실제 Store 영속성/삭제 cascade, native PhotoIndex/Voice: 이 smoke에서는 **미확인**, S04/S05/S06 및 S11 대상이다.
- production compile은 coordinator의 공용 `app/src/native/files.ts`와 S06 repository 선행 변경에 의존한다. 현재 `npx tsc -b`는 해당 미존재 module 하나만 보고하며 S07 자체 타입 진단은 없다. 선행 변경을 받은 후 최종 build/doctor 결과로 이 항목을 갱신한다.
