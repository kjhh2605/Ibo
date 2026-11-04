# S07 app-agent
상태: 확정(R9까지) · 웨이브 1 · 선행: S00 merge 완료. 실제 S02/S05/S06 연결 전에는 계약 mock으로 독립 구현한다.

## 목표
영어 텍스트·음성 질의를 앱 내 도구 루프로 실행해 쇼핑 사진과 옷 후보를 찾는다. 모든 trip을 검색하고 예산·취소·실패·UI 단계 이벤트와 검색 데이터 경계를 일관되게 보장한다.

## 읽을 문서
이 목록만 읽는다.
- [결정 로그](../decisions.md): R0~R9, 특히 D-R1-02, D-R3-01~09, D-R7-09.
- [agent-tools](../contracts/agent-tools.md): 전부. §8의 전체 시나리오가 합격 입력이다.
- [relay-api](../contracts/relay-api.md): §1~5, §6.1~6.3, §7~8.
- [device-modules](../contracts/device-modules.md): §1, §4 PhotoIndex, §5 Segmenter, §8 Voice, §9 Store.
- [data-model](../contracts/data-model.md): Photo/Embedding/Candidate, §4~5.
- [검색 UX](../ux/search.md): F-06~08 / [화면 구조](../ux/navigation.md): Find it·Trip/Pick 진입.
- [제품 범위](../product/scope.md), [데이터 경계](../product/privacy.md): 검색·음성·불변식.

## 소유 경로
- 수정: `app/src/agent/**` 및 그 안의 테스트·mock adapter.
- 금지: S06의 큐 worker/handler, 화면, native 구현, relay 서버/client, generated DTO, package 설정, 계약 문서. 공용 wire 타입은 `app/src/generated/relay-api.d.ts`를 소비한다. 변경 필요 시 S00/통합 담당에게 보고한다.

## 구현 항목
1. 질의당 runId 하나와 HTTP 작업 하나를 유지한다. 첫 요청의 now/timeZone 고정, 질의 문자열 유지, 최신 queryToken 교체, 새 질문/화면 이탈의 취소와 늦은 응답 무시를 구현한다. 토큰을 디스크에 저장하거나 fork/자동 재전송하지 않는다. Spark≤4턴·SAM 누적≤3장을 앱과 릴레이 경계에서 지킨다. [agent §1~2](../contracts/agent-tools.md#1-소유권과-루프), [relay §4](../contracts/relay-api.md#4-질의-토큰과-순차-예산); D-R1-02, D-R3-01.
2. `list_visits`는 Store 모든 페이지를 읽어 모든 trip을 대상으로 한다. note·description·방문 시각은 포함, 좌표·파일·사진·임베딩은 제외한다. run별 불투명 ref 맵과 삭제 무효화를 구현한다. 상대 시간은 계약의 now/timeZone 및 [from,to)를 지킨다. [agent §2·§3.2](../contracts/agent-tools.md#2-프롬프트-정책과-시간참조); D-R3-03~04.
3. `find_photos`는 item 사진에 가게/시간 필터를 먼저 적용한 범위(`photoIds`)와 `phraseVector`, k(기본/상한 3)를 `PhotoIndex.search`에 넘긴다. pending은 최대 30초 대기, failed/시간 초과는 index_unavailable이다. 정렬(score↓ → takenAt↓ → photoId↑)과 k 자르기는 `PhotoIndex.search`가 한 번에 하며, S07은 반환 순서 그대로 photoRef로 바꿔 돌려주고 다시 정렬하지 않는다. 임계값/의류 분류로 후보를 제거하지 않는다. [agent §3.3](../contracts/agent-tools.md#33-find_photosphraseshoprefstimefromtimetok), [device §4](../contracts/device-modules.md#4-photoindex--s05); D-R3-02~03.
4. `extract_items`는 이전 find 결과의 1~3개 ref만 허용하고 EXIF 없는 파생 사진을 SAM endpoint에 보낸다. 새 토큰을 즉시 교체하고 mask/bbox를 원본 좌표로 복원해 로컬 후보 캐시에 둔다. Spark에는 개수·최고 점수만 보낸다. final ref/가게 관계를 검사하고 0후보 final은 EdgeTAM 탭 선택으로 이어지게 한다. [agent §3.4·§4](../contracts/agent-tools.md#4-최종-응답과-후보-ui); D-R3-01~02, D-R3-06.
5. `idle/running/results/not_found/error`와 §5의 모든 이벤트를 구현한다. 단계 이력은 도구 완료를 꾸미지 않으며 단일 가게에만 scope_narrowed를 보낸다. 결과/미발견에서 한 줄 접기·재확장용 상태를 제공한다. 실패는 오류이고 예산 소진만 계약의 not_found다. 문구 배치는 S08이다. [agent §5·§7](../contracts/agent-tools.md#5-ui-이벤트와-상태-머신); D-R3-06, D-R3-09, D-R6-03.
6. Voice completed 한 경로에서만 WAV를 전사한다. 15초 이내 16 kHz mono PCM16 WAV, 비어 있지 않은 전사문은 그대로 즉시 검색, 무음은 idle와 Spark 0회. 성공/실패/취소 시 WAV와 임시 참조를 회수한다. offline 검색·음성은 큐에 넣지 않는다. [agent §6](../contracts/agent-tools.md#6-음성-질의-경로), [device §8](../contracts/device-modules.md#8-voice--s04); D-R3-05, D-R3-07, D-R7-09.
7. wire serializer는 allowlist를 사용한다. 검색 Spark 요청/도구 결과에 lat/lng/spot/trail, 이미지/base64/URI, mask/bbox, 사진 벡터, 원본 UID가 없는지 테스트한다. **Spark 전체의 이미지 금지가 아니라 검색 루프 경계**다. 외관·옷 이름 Spark 요청은 S06의 별도 허용 기능이다. [privacy](../product/privacy.md#불변식테스트-대상), [agent §9](../contracts/agent-tools.md#9-검증-항목); D-R1-02, D-R3-04, D-R6-04.

## mock 경계와 의존
relay client, Store, PhotoIndex, Voice를 같은 인터페이스의 mock으로 주입한다. 시스템 프롬프트/PE 텍스트 타워/네이티브 추론을 이 슬라이스에서 구현하지 않는다. S11 fixture가 도착하기 전 자체 테스트 fixture를 `app/src/agent/**`에 두되 §8 전체 시나리오를 생략하지 않는다. 실제 연결은 S02/S03/S04/S05/S06 merge 후 S11 통합에서 한다. UI 상위3/Show all 렌더링은 S08, 후보 전체와 단계 상태 공급은 S07이다.
relay 녹화 재생은 §7의 (scenario, operation, step), 명시 match/ignore, 현재 요청 ref echo를 따른다. 앱 clock/ID seed hook은 추가하지 않는다. 아래 고정 날짜/시간 경계는 단위 테스트 함수 입력으로 검사하며 native E2E는 실제 촬영 시각·ID를 유지한다.

## 합격 기준
아래 명령은 구현 후 실행 요구이며 현재 실행 결과가 아니다. 테스트 이름에 표의 그룹 이름을 포함하고 0개 실행은 실패다.

| 명령(저장소 루트) | 합격 조건 |
| --- | --- |
| `(cd app && npx vitest run src/agent)` | 전체 통과. §8의 normal, shop-specific, time-specific, note-specific, past-trip, not-found, turn-limit, voice-empty, photo-limit, upstream-timeout 모두 실행 |
| `(cd app && npx vitest run src/agent -t 'scenario')` | 고정 시각 2026-11-04 14:00 +09:00, 오늘/토요일 동일 Shop 2 구분, 13:35 포함/13:45 제외, 메모 검색, 후보 4개 이상 보존, 5번째 turn/4번째 사진 전송 없음 |
| `(cd app && npx vitest run src/agent -t 'state')` | 모든 상태 전이·단계 순서·단일가게 이벤트·완료 접힘/재확장·다른 run 응답 무시·오류/미발견 구별·취소 회수 검증 |
| `(cd app && npx vitest run src/agent -t 'privacy')` | HTTP spy에 검색 좌표/이미지/마스크/벡터/파일 경로 0개. SAM 요청은 허용 사진만, raw self는 전혀 접근 안 함. 에러/취소 시 로그 유출 없음 |
| `(cd app && npx vitest run src/agent -t 'voice')` | 무음은 search-turn 0회, 15초 경계, 원문 자동 검색 1회, 중복 completed/stop 전사 0회 추가, offline/취소 WAV 회수 |

추가 필수 변형은 score 동점·빈 방문·모든 trip·색인 pending/failed·진행 중 삭제·SAM 0후보 탭·시간대/자정/DST·정책 거절·오프라인 로컬 탐색·토큰 만료/잘못된 ref다. UI 클릭과 native 음성은 S08/S11에서 확인하며 이 슬라이스 단위 테스트를 에뮬레이터 E2E로 대신하지 않는다.

## 완료 보고 형식
- 바꾼 파일.
- 실행 명령과 테스트 수/결과, §8 시나리오별 통과 여부.
- 미확인·위험: 실모델 질의 해석과 native 연결은 별도 명시.
- 계약 변경 요청: DTO/ref 정렬/PhotoIndex 조회 경계 등, 없으면 "없음".

## 미확인·위험
- 고정 fixture 통과는 Spark 실제 영어/시간 해석 정확도의 증명이 아니다. 실호출은 S11 통합에서 한다.
- 검색 사진 순서는 `PhotoIndex.search` 한 곳에서 정한다(agent-tools §3.3 규칙 5와 같은 순서). S07이 따로 다시 정렬하면 두 순서가 어긋날 수 있으므로 하지 않는다.
- 검색 결과의 여러 사진 후보 표시 순서는 agent-tools §4, 개별 Candidate 저장·안정 ID는 data-model §5를 따른다. 둘을 임의 공통 정렬로 바꾸지 않는다.
