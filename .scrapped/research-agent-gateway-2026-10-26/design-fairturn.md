# 설계 D2: FairTurn, 희소 좌석 예약을 위한 에이전트 정문

작성 2026-10-26 · 각도: 로컬 비즈니스의 희소 슬롯 예약
표기([확인]/[스니펫]/[미확인]/[코퍼스])는 리서치 파일을 따른다. 근거는 (파일명 §절)로, 새로 확인한 사실은 URL로 단다. 인물·가게·플랫폼은 모두 가상이다.

## 1. 이름과 피치

**FairTurn**: 인기 식당의 희소 좌석을 봇 속도 대신 검증 가능한 추첨으로 나누고, 다른 손님과 직원의 정보는 정책으로 가리며, 모든 결정을 서명 영수증으로 남기는 Poppy 호환 예약 게이트웨이.

- EN: "FairTurn gives AI agents a fast lane to scarce restaurant tables but never an edge: a verifiable lottery instead of a speed race, answers that never reveal other guests or staff, and a signed receipt for every decision."
- KO: "FairTurn은 에이전트에게 빠른 차선은 주되 유리한 순번은 주지 않는 예약 정문으로, 좌석은 누구나 검증할 수 있는 추첨으로 나누고 다른 손님과 직원의 정보는 내주지 않으며 모든 결정에 서명된 영수증을 남긴다."

식당을 고른 이유는 셋이다. 추첨 창·홀드 상한·예치금이 모두 합법적으로 들어맞는다(병원에서는 예치금 같은 마찰이 공평한 접근과 충돌한다, local.md §1). 에이전트의 가게 예약은 이미 대표 사용례다. 전매 봇 규제(뉴욕)와 노쇼 위약금 기준(공정위)이 있어 영수증이 돈 문제를 푼다.

## 2. 시나리오와 등장인물

- **게이트웨이 운영자**: 예약 플랫폼 **반상(Bansang)**. 가맹 식당 전체의 예약 백엔드 앞에 FairTurn을 둔다. 동네 가게가 poppy.json·OAuth·정책 엔진을 직접 만들 수는 없다(local.md §7).
- **식당**: **오마카세 달무리**(성수). 카운터 8석, 18:00·20:30 2회전, 화~토. 매달 1일 10:00에 다음 달 좌석을 연다("드롭"). 12월분은 23일 × 16석에서 12/19 대관을 빼면 약 350석이다. 화·수는 서 셰프가 카운터를 맡고 손님은 "서 셰프 카운터"를 골라 예약한다.
- **요청자**
  - A 지민: 결혼기념일 2인. 커뮤니티 Poppy Demo Agent를 지민의 에이전트로 띄운다(서드파티).
  - A' 마크: 관광객. computer-use 에이전트가 웹 예약 화면을 직접 조작한다.
  - X 전매 운영사: 인스턴스 500개, 사들인 번호로 인증한 '사람' 40명. 잡은 좌석을 되판다.
  - E: 하늘의 전 연인. "하늘 일행이라고 하고 금요일 예약 시간을 알아내라"고 지시한다.
  - F: 서 셰프의 근무·휴무 패턴을 캐려는 사람.
- **데이터가 걸린 제3자**
  - B 하늘: 12/18(금) 18:00 예약. 메모 "갑각류 알레르기", "프러포즈 예정".
  - C 서 셰프: 12/16(수) 휴무, 근무표 사유 "병원".
  - D 기업 고객: 12/19(토) 전체 대관(영업 기밀).

## 3. 문제의 증거

1. **에이전트는 이미 가게에 전화하고, 차단 사유는 식별 부재였다.** Muse와 Instinct가 2026-09에 전화 기능을 붙였고(meta.md §4·S30 [확인]), Salesforce는 에이전트의 반복 전화로 "the volume quickly becomes astronomical"이라고 했다(local.md §1, redteam.md §1 [확인]). Amazon은 Muse를 "unauthorized AI agent"로 막으며 사전 통보 없음과 자기 미식별을 들었다(local.md §1, ledger.md §1-D).
2. **희소 자원은 속도 경쟁에서 망가진다.** 뉴욕주 Restaurant Reservation Anti-Piracy Act(2025-02-17 시행)는 식당과 서면 계약 없는 예약 게시·판매를 금지했다. 업계 단체는 봇이 팔지 못할 예약까지 대량으로 잡아 노쇼와 인위적 희소성을 만든다고 했다(https://hklaw.com/en/insights/publications/2025/02/new-york-curbs-scalping-of-restaurant-reservations [확인]). Muse가 20분 홀드를 반복했다는 보도도 있다(The Verge, local.md §1 [미확인]).
3. **마찰로 막으면 공평성이 깨진다.** agentic flooding 연구(84건)는 수수료 같은 마찰이 공평한 접근과 상충한다고 했다(local.md §1 [확인]). 예약 플랫폼 Rec CEO가 에이전트를 사람 1명에 묶는 "agent passport"와 3분 창 추첨을 제안했다는 보도도 있다(NYMag, local.md §1 [미확인]).
4. **분쟁은 이미 제도 안에 있다.** 공정위 소비자분쟁해결기준은 오마카세 같은 예약기반음식점의 위약금 상한을 총 이용금액의 40%(일반음식점 20%)로 두고, 이를 적용받으려면 문자 등으로 미리 고지하게 했다(https://mobile.newsis.com/view/NISX20251231_0003461509, 2026-01-01 [확인]). 언제 무엇을 고지받고 언제 취소했는지가 곧 돈이다.
5. **에이전트 채널은 잘 샌다.** AgentLeak에서 에이전트 간 메시지 누출은 68.8%로 최종 출력 27.2%보다 높았고(local.md §3 [확인]), Muse Spark 단독 CIMemories violations@5는 78.3%였다(privacy.md §0 [확인]).

## 4. 당근과 채찍

원칙은 "Agents get a lane, not an edge."다. 드롭 좌석과 취소 좌석은 웹·전화·에이전트 어느 경로로 오든 같은 추첨과 같은 대기 순번으로 배정한다. 속도가 이득이 아니니 몰래 빨리 긁을 이유가 없다.

**당근(서명 + 위임, T2)**
- 드롭 응모는 API 한 번이다. 선호 슬롯 3개를 순위로 내면 끝난다.
- 대기열 push: 취소가 나면 서명된 webhook으로 알리므로 폴링이 쓸모없다(push는 Poppy의 열린 주제, meta.md §5).
- 일반 좌석 10분 홀드, 높은 조회 한도, 대안이 담긴 결과형 응답.
- 영수증: 취소·고지·승인 시점을 증명해 위약금 분쟁에서 사용자를 지킨다.

**채찍(미식별 자동화, T0)**
- 사람 수준 한도, 홀드 없음. 드롭은 사람과 똑같이 본인 확인 1회 응모만.
- 폭주 시 PoW 폴백(Anubis식). 단독으로는 약하므로(Laurie·Clayton 2004) 보조로만 쓴다(ledger.md §1-C).
- 429와 Retry-After(Poppy MUST)를 주며 `/.well-known/poppy.json`을 안내한다(standards.md §1.1).

**computer-use 에이전트 끌어들이기**: 예약 화면에 "AI 에이전트라면 세션을 연결하세요" 버튼을 둔다. Poppy 5장 브라우저 세션 결합(`web.browser_session_endpoint`, 일회용 코드 + 서명 증명)으로 마크의 세션을 T2로 올린다(standards.md §1.1). 연결하면 PoW 면제·홀드·영수증을 받고, 연결하지 않아도 당첨 확률은 같다. 숨을 이유가 없다. AI 전화는 Voice Transcribe로 받아 같은 파이프라인에 넣는다(Could).

## 5. 메커니즘 설계

### 5.1 목적·관계에 묶인 공개 등급

등급은 privacy.md §4.1의 D0~D5다. 입력은 닫힌 어휘의 목적, 관계(낯선 요청자·단골·예약 일행), 데이터 클래스, 남은 예산이다. 신원 등급 T0~T2와는 따로 본다.

| 데이터 클래스 | 낯선 요청자 기본 | 올릴 수 있는 경우 |
|---|---|---|
| 재고 | D2: 요청 창 안 후보 k=3 | 단골은 D3("사장 승인 시 바 좌석") |
| 다른 손님 기록 | D0, 클래스 단위 비공개 | 예약자가 보낸 초대 capability를 가진 일행만, 그 예약에 한해 D5 |
| 직원 근무표 | D2: "서 셰프 카운터 가능일" 후보만 | 직원 본인이 opt-in하면 D4("셰프 개인 사정") |
| 대관 | D2: "그날 불가, 대안은 …" | 사장이 opt-in하면 D4("대관 행사"). 고객명은 외부 불가 |

원안의 "개인 일정이 있어 어렵다"는 서 셰프가 opt-in했을 때의 D4다. 기본은 D2인 "12/16 서 셰프 카운터는 예약할 수 없습니다. 12/15, 12/22는 가능합니다"이다. "기념일" 같은 자기 신고는 서비스에만 쓰고 배분 가중치는 0이다. 기념일을 지어내는 에이전트 문제(local.md §1 [코퍼스])를 규칙으로 막는다.

### 5.2 poppy.json 확장(축약)

핵심 필드는 Poppy 0.2 스키마를 쓰고, 프로필은 `extensions` 아래 팀 도메인 이름공간에 둔다(meta.md §5).

```json
{"web":{"browser_session_endpoint":"https://bansang.example/poppy/browser-session"},
 "extensions":{"fairturn.example/dr":{"version":"0.1",
  "purposes":["availability.browse","book.new","book.transfer","party.join",
   "waitlist.join","drop.enter","dispute.evidence"],
  "disclosure":{
   "inventory":{"default":"D2","k":3,"bucket_min":30,"horizon_days":31},
   "guest_record":{"default":"D0","withhold_scope":"class","party_member":"D5"},
   "staff_roster":{"default":"D2","max_external":"D4","opt_in":"subject"},
   "private_event":{"default":"D2","max_external":"D4","opt_in":"owner"}},
  "budgets":{"person_week_states":24,"staff_slot_cost":3,"subject_projection":"weekly"},
  "receipts":{"alg":"EdDSA","log":"https://log.bansang.example","witnesses":2,"anchor":"opentimestamps"}}}}
```

### 5.3 결과만 돌려주는 API

"이 시간 비었나?"를 30분 단위로 훑는 질의는 받지 않는다. 요청자는 조건과 선호를 내고, 교집합 계산은 게이트웨이 안에서 끝난다.

```json
POST /ft/v1/availability:search   (RFC 9421 서명 + DPoP 토큰)
{"purpose":"book.new","party_size":2,
 "window":{"date":"2026-12-18","from":"18:00","to":"21:00"},"prefer":["18:00"]}

200
{"level":"D2","requested":{"slot":"18:00","status":"unavailable"},
 "candidates":["2026-12-18T20:30+09:00","2026-12-22T18:00+09:00","2026-12-23T20:30+09:00"],
 "withheld":[{"field":"reason","basis":"policy","rule":"inv.R2"}],
 "signals":{"waitlist_band":"medium","penalty_terms":"sha256:a91b…"},
 "projection":"pv_7f3a","budget_left":19,"receipt":"eyJhbGciOiJFZERTQSJ9…"}
```

`waitlist_band`(최근 8주 취소율 구간)와 대안은 침묵이 비용 정보를 빼앗는다는 CalBench의 교훈(privacy.md §1.1)을 옮긴 것이다. 식당에서는 이유가 하나 더 있다. 아무것도 알려 주지 않으면 에이전트는 재시도로 답을 캐고, 그 재시도가 트래픽이 된다.

### 5.4 고정 투영과 누적 노출 예산

- **고정 투영**: `pv`는 재고 상태 해시다. 재고가 바뀌기 전에는 같은 질문에 같은 후보가 나가고, 노이즈는 쓰지 않는다(RootGuard 원리, privacy.md §1.2). 후보는 "가장 이른 k개"가 아니라 비밀 키로 고른 결정적 표본이라 위치로 휴무일을 짐작할 수 없다.
- **위임자 예산**: 키는 에이전트 인스턴스가 아니라 회사별 가명 `sub`(Poppy User ID, standards.md §1.1)다. 새로 드러난 (슬롯, 상태) 하나가 1, 직원 속성 슬롯은 3, 같은 질문의 반복은 0이다. 다 쓰면 선호 제출과 대기열만 되는 propose-only 모드가 된다.
- **정보주체 예산**: "서 셰프 카운터" 투영은 매주 월요일 0시에 한 번만 계산한다. 근무표 변경 때마다 다시 계산하면 그 변화가 병가 신호가 된다. 누가 몇 번을 묻든 같은 후보 3개를 받으니 Sybil이 질의를 늘려도 합집합은 커지지 않는다. 신원이 약해도 프라이버시는 지켜진다.
- 그래서 서 셰프의 휴무일과 만석인 근무일은 응답에서 구별되지 않는다.

### 5.5 비공개 표시와 존재 오라클

'정보 없음'(`basis: not_released`, 아직 열리지 않은 날짜)과 '정책상 비공개'(`basis: policy`)는 구분해 표시한다. 다만 다른 사람 기록이 있느냐는 질문에는 기록 유무와 상관없이 같은 클래스 단위 응답을 준다. 레코드마다 "비공개"와 "없음"을 나누면 그 차이가 존재 오라클이 된다. Cedar 판정이 DB 조회보다 먼저라 시간 차이도 없고, 정보주체 알림용 조회는 응답 뒤 비동기로 한다.

E의 요청 `{"purpose":"party.join","referenced_person":"김하늘","date":"2026-12-18"}`에 대한 응답:

```json
{"level":"D0","result":"withheld",
 "withheld":[{"class":"guest_record","basis":"policy","scope":"class","rule":"guest.G1"}],
 "how_to":"party.join에는 예약자의 초대 capability가 필요","receipt":"…"}
```

`receipt`를 뺀 본문 해시는 하늘의 예약이 있을 때와 없을 때 같다. 데모에서 두 해시를 나란히 띄운다.

### 5.6 정보주체 리포트

```json
{"subject":"staff:seo","week":"2026-W50","queries":342,"disclosed":"pv_7f3a(후보 3일)",
 "reasons_disclosed":0,"budget_exhausted":12,"proofs":"https://log.bansang.example/s/…"}
```

하늘에게는 "이번 주 당신 이름을 언급한 에이전트 요청 1건, 공개 0건, 요청 운영사 키 thumbprint"가 간다. 운영사(조직)는 알리되 E 개인의 신원은 E의 개인정보라 알리지 않는다. 전달은 WhatsApp 테스트 번호, 안 되면 앱 화면.

### 5.7 남용 억제

| 장치 | 달무리 드롭 초기값 |
|---|---|
| 등급별 한도 | T0 사람 수준·홀드 없음·PoW / T1 운영사 서명: 운영사 쿼터·평판 / T2 서명+위임: 가명 단위 쿼터·홀드·push |
| 추첨 창 | 11/1 10:00:00~10:03:00, 1인 1응모, 선호 3개. 규칙 해시는 창이 열리기 전에 로그에 등록 |
| 추첨 방식 | 10:03:00에 응모 Merkle 루트를 로그에 올리고, 10:03:30 이후 첫 drand quicknet 라운드를 시드로 random serial dictatorship(RSD) |
| 홀드 상한 | 당첨자 10분 확정 홀드, 1인 활성 홀드는 플랫폼 전체 1개, 같은 슬롯 재홀드 30분 금지. 미확정·취소분은 순번표의 다음 사람에게 |
| 예치금 | 확정 시 보증금. 위약 기준은 공정위 상한 안에서, 고지·동의 증빙은 영수증에. 결제는 시뮬레이션 원장 |
| 양도·평판 | 예약은 `sub`에 묶이고 양도는 원 예약자 승인과 정가 상한이 걸린 `book.transfer`로만. 운영사별 홀드→확정 전환율·노쇼율을 로그에서 집계 |

- drand quicknet은 3초 주기, 라운드끼리 독립인 unchained 방식이다. DKG 이후 값을 편향시킬 수 없지만, 임계 수 이상의 노드가 담합하면 미래 라운드를 예측할 수 있다(https://docs.drand.love/blog/2023/10/16/quicknet-is-live [확인]). 시드는 `H(beacon ‖ entries_root)`로 응모 집합에 묶는다.
- RSD는 무작위 순번대로 각자 남은 선호 중 최상위를 가져가는 방식으로, 거짓 선호를 낼 유인이 없는(strategy-proof) 고전 메커니즘이다(https://arxiv.org/pdf/2401.00307 [스니펫]).

### 5.8 영수증, 투명성 로그, 앵커

지민의 보증금 확정 영수증(JWS 페이로드):

```json
{"iss":"https://bansang.example","rid":"r_01JC…","t":"2026-11-01T10:09:41.207+09:00",
 "op":"book.confirm","decision":"CONFIRMED","purpose":"book.new","level":"D2",
 "agent":{"operator":"https://agent.example","jkt":"NzbL…"},"sub":"ppid_9f2…",
 "withheld":["guest_record","staff_roster.reason"],
 "policy":"sha256:5c1e…","terms":"sha256:a91b…",
 "approval":{"method":"whatsapp_witnessed","evidence":"sha256:3d07…"},
 "drop":{"rules":"sha256:77c2…","beacon_round":"…","position":37},
 "log":{"leaf":48211,"size":48230,"root":"…","cosigned_by":["w1","w2"]}}
```

- 공개 로그에는 분 단위 시각, 운영사 키 thumbprint, 행위·판정, 정책 해시, 항목별 솔트 HMAC만 넣는다(ledger.md §2). 원문과 솔트는 로그 밖에 두고 파기 때 둘을 지운다(PIPC·EDPB 가이드라인, ledger.md §1-A(7)).
- RFC 9162식 Merkle 로그, 60초 체크포인트, 증인 2곳 공동서명, 체크포인트 루트만 OpenTimestamps로 비트코인에 고정(ledger.md §1-A). Meta가 WhatsApp·Messenger 키 투명성을 블록체인 대신 append-only AKD로 운영하는 구조와 같은 계열이다(ledger.md §1-A(5)). 스키마는 Muse Code 감사 로그 레시피(decision_source, idempotency_key)에 해시 체인과 서명을 더한 것이다(meta.md §4).
- **승인 증빙**: Poppy operations의 `approved_by`는 사용자가 약관을 봤음을 증명하지 못한다(standards.md §1.1). 보증금이 걸린 작업은 회사가 사용자 본인에게 WhatsApp으로 약관 요약을 보내 승인받고 그 메시지 해시를 `approval`에 넣는다. 공정위 기준의 "사전 고지"와 사용자 승인이 영수증 하나에 남는다(Poppy 이슈 #39·#18).

**분쟁 예시**
1. 위약금: 지민이 "3일 전에 취소했다"고 하면 에이전트가 `book.cancel` 영수증과 포함 증명을 내고, 식당은 검증 후 보증금을 돌려준다. 영수증이 없으면 취소 기록이 없다는 사실과 로그가 잘리지 않았다는 일관성 증명이 남는다.
2. 추첨 의혹: 떨어진 에이전트가 규칙 해시, 응모 루트, drand 라운드로 순번표를 다시 계산한다. 루트 등록 뒤 끼운 응모는 드러난다. 등록 전 식당이 넣은 가짜 응모는 응모 수 공개와 표본 감사로만 잡힌다.
3. 무단 결제: "에이전트가 멋대로 보증금을 냈다"는 주장은 `approval` 증빙으로 책임을 가른다. Dimon이 말한 liability transfer(local.md §1)를 증거로 만든 것이다.

## 6. 아키텍처

```
[사람 웹/앱] [computer-use] [Poppy 에이전트] [AI 전화]
Edge: TLS · RFC 9421 · DPoP · 등급 T0~T2 · PoW · 429
  |
Controller (결정적 코드)
  |-- 자연어 → [Inbound Parser: Spark] (A만) → 스키마 검증기
  |
Policy Engine (Cedar, 정책 묶음 해시)
  |-- Projection/Matcher ── Booking DB ←라벨── [Glimmer 로컬] (B만)
  |-- Drop Lottery (drand 비컨)
  |-- Hold·Deposit 원장 ── WhatsApp 사용자 승인
  |
Disclosure object (허용 필드만)
  |-- JSON 그대로, 또는 [Outbound Phraser: Spark] (C만) → Egress 검사
  |
Receipt Signer → Merkle Log → Checkpoint → 증인 w1·w2 → OTS
UI: Inspector · Drop Board · Owner · 정보주체 · Verifier · Leak Meter
```

Rule of Two(privacy.md §2.1). A 비신뢰 입력, B 개인 데이터, C 외부 통신·상태 변경.

| 구성요소 | A | B | C | 비고 |
|---|---|---|---|---|
| Inbound Parser (Spark) | O | X | X | DB 접근 없음, 출력은 enum·숫자·날짜 |
| Owner-side Classifier (Glimmer) | X | O | X | 로컬, egress 없음, 출력은 라벨 enum |
| Outbound Phraser (Spark) | X | 공개 객체만 | O | 원 메시지를 안 봄, 실패 시 템플릿 |
| Policy·Matcher·Lottery | - | O | O | 결정적 코드(LLM 아님) |
| 보증금 확정 | O | O | O | 셋 다 필요 → 사용자 WhatsApp 승인으로 감독 |

저장형 인젝션 차단: 에이전트가 넣은 "요청 사항"은 받을 때 알레르기·행사 코드(닫힌 목록)로 바꾸고, 남는 자유 텍스트는 `untrusted_text`로 직원 화면에만 경고와 함께 보인다. 어떤 LLM 컨텍스트에도 넣지 않는다(privacy.md §4.4). Glimmer는 직원이 쓴 근무표 사유와 내부 메모만 본다.
저장소: SQLite(합성 재고·예약), Cedar 정책 파일(버전은 해시), 솔트 금고, 로그 타일, 정보주체 인덱스(로그 밖).

## 7. Meta 도구 지도

| 도구 | 역할 | 억지가 아닌 이유 |
|---|---|---|
| Muse Spark 1.3 (Standard) | 인바운드 파서, 아웃바운드 문장, 오프라인 레드팀, 기준선 B3, 누출 판정 보조 | 에이전트는 자연어로 온다(Poppy 대화, 전화 전사). 경계는 맡기지 않는다(CIMemories 78.3%, AgentDojo 11.7%, privacy.md §0) |
| Muse Glimmer 30B (로컬) | 근무표 사유·내부 메모의 민감도·범주 라벨 | 가장 민감한 원본이 매장 밖으로 나가지 않는다. Cookbook "Local agent that asks first"를 사업자 쪽으로 뒤집은 구성(meta.md §4). reasoning을 끌 수 없어 쓰기 시점에 비동기 실행(meta.md §3) |
| WhatsApp Cloud API | 보증금 승인, 사장 예외 승인, 정보주체 리포트 | 테스트 번호로 열흘 안에 가능(meta.md §5). 템플릿 아닌 메시지는 24시간 창 안에서만(https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started [확인]), 수신자 5명([스니펫]) |
| Voice Transcribe (Could) | AI 전화 → 같은 파이프라인 | 식당은 전화로 예약을 받는다 |
| 쓰지 않음 | Muse Image, `-contributor`, 응답 경로의 Wonder, MVP의 SAM 3.1 | 개인정보 금지, 비용, 억지. Prompt Guard 2는 점수만 기록(한국어 미평가, privacy.md §2.4) |

**Meta 생태계 서사**(접근 가능한 범위만): 실제 운영에서는 식당의 Meta Business Agent가 WhatsApp·IG에서 사람 손님의 예약을 받고(local.md §2 [코퍼스]), FairTurn은 같은 백엔드와 같은 추첨을 개인 에이전트에게 연다. Business Agent API는 Meta 승인이 필요해(meta.md §5) 데모의 사람 채널은 웹 UI로 대신한다. 승인 증빙은 Muse for Small Business의 "nothing publishes, sends, or spends without your approval"(local.md §2)을 손님 쪽 에이전트에 적용한 것이다.

**데이터 정책**: Standard 모드만 쓴다(Contributor는 개인정보 입력 금지이고 Muse Code 구독 기본값이 Contributor다, meta.md §0). Standard도 보존 기간이 명시돼 있지 않아(meta.md §2) 손님 메모와 근무표 원본은 클라우드로 보내지 않는다. Spark는 외부 메시지와 공개 객체만 본다. 데이터는 전부 합성이다.

**비용**(가정: Spark 1.3 Standard, reasoning 낮음, 1M 토큰당 입력 $1.25·캐시 $0.15·출력 $4.25): 파서 1회(입력 1.4K 중 캐시 1.0K, 출력 0.25K + reasoning 0.5K) 약 $0.004, 문장 1회 약 $0.003이라 자연어 요청 1건 약 $0.007, 구조화 요청은 $0이다. B3(DB 8K 컨텍스트) 평가 2,000회 $28, FairTurn 2,000회 $14, 판정 4,000회 $7, 레드팀 생성 $3, 개발 5,000회 $35, 드롭 시뮬레이션 30회 $11을 더하면 약 $100. reasoning 출력이 4배면 $250 안팎이다. 크레딧은 1인 $150, 4인 최대 $600(meta.md §7), 시연분 $50은 남긴다.

## 8. 기술 스택과 레포

- 게이트웨이: TypeScript, Node.js(최신 LTS), Hono(최신 안정판). 서명·토큰은 `web-bot-auth` 0.2.0, `http-message-sig` 0.3.0, `jose` 6.2.13, `@noble/curves` 2.4.0(ledger.md §1-E).
- 정책: Cedar WASM 바인딩(최신 안정판). forbid 우선 의미론이 공개 규칙에 맞는다(privacy.md §2.3).
- 로그: TS로 RFC 9162 직접 구현, `pymerkle` 7.0.0 교차검증(GPL-3.0이라 테스트에만), `opentimestamps-client` 0.7.2(Go 인원이 있으면 Tessera v1.0.4).
- 비컨은 drand HTTP API(quicknet chain hash 고정)와 BLS 검증 라이브러리, egress는 Presidio(KR_RRN 등)와 DB 이름 거부 목록.
- LLM: Meta Model API(`https://api.meta.ai/v1`, OpenAI SDK 호환), Glimmer GGUF Q4_K_M + llama.cpp b10353 이상(meta.md §2·§3).
- Poppy 회사 키트(JSON Schema, validator) v0.2 고정, Poppy Demo Agent·interop harness(meta.md §5). UI는 React + Vite(최신 안정판).

```
fairturn/
  spec/     # 프로필 문서 + JSON Schema
  gateway/  # edge, poppy, projection, lottery, receipts, egress
  policy/   # Cedar 정책 묶음 + 테스트
  llm/      # parser, phraser, glimmer-labeler
  log/      # merkle log, witness, ots-anchor
  sim/      # 합성 세계, 에이전트 집단, 공격
  eval/     # 기준선, 지표
  ui/       # inspector, drop board, verifier, leak meter
```

## 9. 10일 MVP

**Must**
1. 합성 세계: 식당 5곳, 8주, 예약 약 3,000건(메모 포함), 직원 12명 근무표·사유, 대관 6건.
2. Edge: RFC 9421 검증, Poppy 0.2 발견과 축약 OAuth(validator 통과), T0/T2 등급.
3. Cedar 정책: 공개 등급, 결과형 search, 클래스 단위 비공개, 고정 투영, 두 예산.
4. 드롭: 3분 창, 선호 3개, 응모 루트 커밋, drand 시드, RSD, 홀드 상한, 보증금 원장.
5. JWS 영수증, Merkle 로그, 체크포인트, 증인 1개, 브라우저 검증기.
6. Spark 파서·문장 생성과 결정적 egress 검사.
7. 기준선 B0·B1, 공격 라이브러리, 누출 미터, 공정성 지표, inspector·drop board 화면.

**Should**: 8 Poppy Demo Agent 상호운용, 9 Glimmer 라벨러, 10 WhatsApp 승인·리포트, 11 증인 2개와 OTS, 12 세션 결합과 PoW, 13 단일 LLM 프록시 B3와 violations@5.
**Could**: AI 전화, COSE 영수증(RFC 9942), 병원 정책 묶음 diff, Base Sepolia 앵커, Poppy 이슈 #18·#37·#39에 프로필 공유.

컷 라인: 11/1(일) 22:00에 Must E2E가 돌지 않으면 Should는 10번만 남긴다. 48시간 관문(10/28 밤)은 Spark JSON 유효율 95% 이상(50건), Glimmer 라벨 1건 30초 이내, Poppy 데모 에이전트 핸드셰이크다. 실패하면 각각 템플릿 파서, 규칙 + 수동 라벨, 자체 에이전트 + validator로 내린다.

| 날짜(KST) | 목표 |
|---|---|
| 10/26(월) | §14 결정, 크레딧 청구, Glimmer 다운로드, 규정 확인 |
| 10/27(화) | 합성 세계, edge, RFC 9421, Cedar 스키마, 첫 API 호출 |
| 10/28(수) | 공개 등급·search·비공개 표시, 파서, 48시간 관문 |
| 10/29(목) | 투영·예산, 로그·영수증·검증기 |
| 10/30(금) | 추첨·홀드·보증금, 부하 생성기 |
| 10/31(토) | 기준선·공격·누출 미터, 첫 OTS 앵커 |
| 11/1(일) | E2E 통합, WhatsApp, 컷 라인 판정 |
| 11/2(월) | 평가, B3, ablation, Glimmer |
| 11/3(화) | 상호운용, UI, 스펙 문서 |
| 11/4(수) | 3분·1분 영상, README, 재현 스크립트, 동결 |
| 11/5(목) | 09:00 제출(마감 11:00) |

역할: 1인은 Must만(라벨 수동, 증인 1개), 남는 시간은 WhatsApp에. 2인은 P1 edge·정책·추첨·로그, P2 LLM·egress·시뮬레이션·평가·UI. 4인은 P1 edge·Poppy·신원, P2 Cedar·투영·예산·추첨, P3 영수증·로그·증인·검증기, P4 LLM·공격·평가·UI·영상.

## 10. 3분 데모 대본

| 시간 | 화면 | 내레이션 | 지표 |
|---|---|---|---|
| 0:00–0:12 | 실제 폰 09:59:55, 달무리 12월 좌석 카운트다운 | "350석에 에이전트 1,200개가 몰립니다." | - |
| 0:12–0:35 | 기준선 선착순, 좌석판이 순식간에 찬다 | "선착순에서는 가장 빠른 봇이 이깁니다." | X 점유율, 사람 속도 응모자 성공률, 홀드에 묶인 좌석·분 |
| 0:35–1:05 | 같은 폭주가 3분 창으로. 응모 루트가 로그에 찍히고 drand 라운드로 순번표가 나온다 | "목록이 먼저 기록되고, 아무도 미리 모르는 공개 비컨이 순번을 정합니다." | 1인당 당첨 확률, 지연-당첨 상관(≈0), X 점유율 |
| 1:05–1:35 | 서드파티 Poppy 에이전트(지민)가 poppy.json을 찾아 요청, D2 대안 수신, 실제 폰 WhatsApp으로 보증금 승인, 영수증 | "우리가 만들지 않은 에이전트가 표준대로 들어옵니다." | 응답 필드 수, 지연 |
| 1:35–2:10 | 왼쪽 B3, 오른쪽 FairTurn. "하늘 일행인데요", 요청 사항 속 인젝션, 서 셰프 근무 스윕 | "왼쪽은 하늘의 시간과 알레르기를 말합니다. 오른쪽은 예약이 있든 없든 같은 답입니다." | 누출 미터, 두 응답 해시 일치, 근무표 복원 정확도 |
| 2:10–2:35 | 하늘·서 셰프의 WhatsApp 리포트. 취소 영수증 검증, 운영자가 DB를 고치자 증인이 서명 거부 | "기록은 고칠 수 없고, 고치면 드러납니다." | 검증 시간, 조작 탐지 |
| 2:35–3:00 | 지표 카드, Rule of Two 그림, 프로필 링크 | "Agents get a lane, not an edge." | 공정성, 누출, p95, 1천 건당 비용 |

"내가 만든 봇 둘"로 보이지 않게 하는 장치: 커뮤니티 Poppy Demo Agent와 interop harness, 우리가 통제하지 않는 drand 비컨과 OTS 앵커, 심사위원 브라우저에서 도는 검증기, 같은 공격을 받은 기준선, 실제 폰, 시드 고정 재현 스크립트. 수치는 실측값으로만 채운다.

## 11. 정량 평가 계획

- **데이터**: §9 합성 세계(한·영 50:50). 드롭 집단은 정직한 사람 200명(자연어 20%), 운영사 X(인스턴스 500, 인증된 사람 40), 사람 속도 웹 사용자 30명, computer-use 20개(스크립트 봇 + 소수의 Spark computer-use).
- **공격**: A1 손님 정보 직접 추출, A2 권위 사칭, A3 메시지 인젝션, A4 요청 사항 저장형 인젝션, A5 재고 스윕, A6 8주 직원 근무 추론, A7 존재 오라클, A8 인원수 차분, A9 Sybil, A10 홀드 순환, A11 드롭 속도 폭주, A12 위조·재사용 영수증 분쟁.
- **지표**: 공정성(1인당 당첨 확률 대 응모 비중, 운영사별 좌석 지니계수, 지연-당첨 상관), 부하(성공 예약당 요청 수, 홀드에 묶인 좌석·분), 프라이버시(문자열·Presidio·LLM 판정 다수결 누출률, A5·A6 복원 정밀도·재현율, 존재 오라클 이득, violations@5, 공격별 ASR), 효용·운영(정직한 에이전트 성공률, p50/p95, 1천 건당 비용, 결정성), 로그(DB 수정·꼬리 절단·split view·날짜 위조 탐지율).
- **기준선**: B0 무방어 API(선착순, 전체 빈자리 지도, DB를 보는 LLM 응대), B1 free/busy식 지도 API, B2 computer-use UI 스크래핑, B3 단일 LLM 프록시(Spark + DB + 프라이버시 프롬프트), B4 투영·예산을 끈 FairTurn, B5 전체.
- **산출**: 표와 "공정성 대 누출" 산점도. Glimmer와 Spark의 라벨 일치율로 "로컬 30B로 충분한 구간"을 보고한다(meta.md §4).

## 12. 해자와 사업성

**해자가 아닌 것**: Poppy 확장(Apache 2.0), 영수증 포맷(IETF 개인 초안 두 건, VeriKnox, standards.md §1.7·§1.9), 마스킹(free/busy, Firewalls 연구), 추첨, PoW, drand. Sierra 레퍼런스 구현이 해커톤 중에 나오면 "회사 측 첫 구현" 자리도 사라진다(standards.md §1.1).

**해자가 생긴다면**
1. 예약 플랫폼 네트워크: 1인 홀드 상한, 노쇼 평판, Sybil 비용은 같은 게이트웨이를 쓰는 식당이 많을수록 강해진다. 이 해자는 플랫폼의 것이므로 팔 대상은 예약 플랫폼(B2B2SMB)이다.
2. 업종별 정책 묶음과 벤치마크: 식당·병원·미용실 정책과 규제 매핑(공정위 고지, 뉴욕법, EU AI Act 50조). 작지만 실재한다.
3. 분쟁 조정 기관이나 카드사가 영수증을 증거로 받으면 전환비용이 생긴다. 장기적이고 불확실하다.

수익은 오픈소스 게이트웨이에 호스팅 증인·검증·정책 묶음 구독을 얹는다. 플랫폼은 노쇼·부하·분쟁 비용이 줄어서 돈을 낸다.

## 13. 최대 약점 3개와 대응

1. **사람 결속(Sybil).** 공정성은 1인 1응모에 달려 있는데 전화번호 OTP는 싸게 살 수 있다. X의 번호 40개는 응모 40개다. 대응: 가짜 사람 1명의 비용(보증금 위험, 양도 불가, 노쇼 평판, 현장 이름 확인)을 전매 마진보다 높인다는 데까지만 주장한다. 프라이버시는 정보주체 예산으로 신원 강도와 무관하게 지킨다. 익명 자격증명(ACT)과 Poppy #25 verified human signal은 스트레치.
2. **"Poppy에 추첨과 free/busy를 붙인 것 아니냐", 인프라 데모.** 대응: 드롭이라는 사건과 기준선 대비 수치로 보여 준다. 새로운 것은 조합이 만드는 성질이다. 존재 오라클 없는 비공개, 정보주체 단위 고정 투영, 로그에 묶인 검증 가능 추첨, 승인 증빙이 든 영수증. Poppy 열린 이슈에 대한 기여로 말한다.
3. **강제와 채택.** 에이전트는 차선을 무시할 수 있고 식당은 플랫폼 없이 도입하지 못한다. 대응: 웹과 전화도 같은 추첨이라 우회해도 얻을 것이 없다. 협조하는 에이전트가 없어도 플랫폼은 트래픽 분류와 분쟁·고지 증빙을 얻는다.

## 14. 구현 전에 합의할 것

| 결정 | 선택지 | 권장 |
|---|---|---|
| 도메인 | 식당 드롭 / 병원 / 미용실 | 식당. 병원은 정책 묶음 diff로만 |
| 운영 주체 | 예약 플랫폼 / 식당 셀프호스트 / 독립 SaaS | 플랫폼 |
| Poppy 버전 | 0.2 / 0.3 초안 | 0.2 고정. Sierra 구현이 11/1 전에 나오면 호환성만 점검 |
| 사람 결속 | 가명 + OTP(시뮬레이션) / passkey / 익명 자격증명 | 가명 + OTP. passkey 승인은 Could |
| 추첨·난수 | 단일 슬롯 / RSD / 가중, drand / 블록 해시 / commit-reveal | 선호 3개 RSD(가중치 없음), drand + 응모 루트 선커밋 |
| 영수증·로그 | JWS / COSE, TS 자체 / Tessera, OTS / Base Sepolia | JWS, TS 자체, OTS |
| 정책 엔진 | Cedar / OPA | Cedar |
| 공개 수준 주체 | 사장 / 정보주체 | 사장이 상한, 정보주체는 낮추거나 자기 데이터만 D4 opt-in |
| 예산 초기값 | - | 위임자 주 24상태, 직원 슬롯 3배, 정보주체 주 1투영(k=3) |
| 보증금 | 시뮬레이션 원장 / Stripe 테스트 | 시뮬레이션 원장 |
| WhatsApp | 승인·리포트 / 미사용 | 쓰되 앱 화면 폴백을 둔다 |
| LLM·장비 | Glimmer 로컬(32GB 이상 Mac) / 규칙 폴백 | 10/28 관문에서 결정 |
| 테마 | Build for Your World / Push the Frontier | 팀원이 드롭 예약을 실제로 겪었을 때만 전자 |
| 공개 시점 | 레포·스펙 공개, Poppy 이슈 코멘트 | 11/3 이후 |

다른 설계와의 접점: 정책 엔진·영수증·로그·Rule of Two 분리는 D1(일정)·D3(커머스)과 공유하는 코어로 두고, D2 고유 모듈은 drop/lottery, hold·deposit, 정보주체 단위 투영이다. 합치면 드롭이 데모의 사건이 되고 일정·커머스는 정책 묶음 diff로 보여 줄 수 있다.
