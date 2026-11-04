# 설계 D1: Overlap, 팀 캘린더 앞에 선 에이전트 정문 (채용 면접 일정)

2026-10-26. 출처: (파일명 §절)=scratchpad/research/(a2a-delegates.md만 로컬 research-ai-era-apps-2026-10-26/), [URL]=이번에 원문 확인, [추론]·[제안]=판단. 서비스·인물은 가상이다.

## 1. 이름과 피치

**Overlap(오버랩)**: 외부 AI 에이전트에게 '모두가 되는 시간'만 알려 주는 팀 캘린더용 Poppy 호환 에이전트 정문.

- EN: *Overlap gives outside AI agents a fast lane into team calendars, but only the overlap ever leaves the building, and every answer carries a signed, auditable receipt.*
- KO: 외부 에이전트에게는 사람보다 빠른 예약 통로를, 직원과 다른 지원자에게는 "겹치는 시간 말고는 아무것도 새지 않는다"는 보장과 영수증을 준다.
- 포지션: 새 프로토콜이 아니라 Poppy 회사 측 게이트웨이와 확장 프로필 `Disclosure & Receipts`다. Poppy에 없는 목적 선언, 타 사용자 데이터 규칙, 서명 영수증, 누적 노출 예산을 채운다(standards.md §3·§4).

## 2. 시나리오와 등장인물

**왜 채용 면접인가 [추론].** ① 다자 교집합이 본질이다(패널 3~5명 + 회의실). ② 제3자가 두 겹이다. 면접관의 개인 일정, 그리고 다른 지원자의 구직 사실 자체. ③ 에이전트가 몰릴 유인과 공정성 쟁점이 함께 있다. 영업 미팅은 같은 엔진의 Could 모드로 두고, 연구실은 영향이 작아 제외한다.

| 역할 | 가상 설정 |
|---|---|
| 운영 기업 | **MoaCal**: 팀 캘린더·면접 일정 B2B SaaS. 고객사 직원 캘린더 앞에 Overlap을 둔다(셀프호스트 가능) |
| 고객사 | **Pinewheel Robotics**: 400명, 엔지니어 40명 채용 중. `jobs.pinewheel.example`을 MoaCal에 위임 |
| 요청자 A | 재직 중 몰래 구직하는 **하윤**과 그의 Poppy 개인 에이전트 |
| 제3자 B·C·D | 면접관 **민준**(매주 화 15:00 '정신건강의학과 상담'), **서연**(수 16:00 '도윤 1차 면접'), HR **지호**(목 10:00 '조직개편 TF') |
| 제3자 E | 다른 지원자 **도윤**. 면접을 본다는 사실 자체가 민감하다 |
| 사람 | 코디네이터 **유나**: D3 승인, 트래픽 콘솔 |
| 적대자 | 채용 인텔리전스 봇 **ScryTalent**, 홀드 사재기·악성화된 초대 지원자 에이전트, 서명 없는 computer-use 봇 |

**흐름.** A의 에이전트가 `/.well-known/poppy.json`을 찾고 초대 링크로 OAuth 로그인해 패널 면접을 요청한다. Overlap은 (패널 ∩ 회의실 ∩ A의 가능 시간)을 안에서 계산해 후보 3개만 주고, 홀드 뒤 확정한다. A는 영수증을, B·C·D는 리포트 항목을 받는다. 확정된 A의 면접은 곧 남의 요청에 대한 제3자 데이터다. **오늘의 요청자가 내일의 보호 대상**이 된다.

## 3. 문제의 증거

1. **선택지는 차단 아니면 무방비다.** Amazon은 2026-09-20 Muse를 막으며 사전 통지 없음과 자기 식별 부재를 들었고(ledger.md §1-D), Dimon은 "liability transfer"를 경계했다(redteam.md S7). Poppy 0.3 초안 §9.5도 프로토콜 밖 로그인 에이전트는 전면 차단 외에 막을 길이 없다는 취지다 [https://personalagentprotocol.org/docs/0.3/spec].
2. **채용은 이미 AI 물량에 잠겼다.** LinkedIn 지원서는 분당 11,000건, 1년 새 45% 늘었다(NYT 2025-06-21 인용) [https://www.eweek.com/news/ai-job-applications-linkedin/]. 구직자 에이전트가 리크루터 에이전트와 면접을 잡는 서비스도 나왔다(Konive, a2a-delegates.md §5.2, 스니펫). 일정 조율이 다음 병목이라는 것은 [추론]이다. 마찰로 막으면 공평한 접근과 충돌한다(agentic flooding 84건 연구, local.md §1).
3. **제3자 데이터 규칙이 없다.** Poppy는 에이전트에게 "필요한 것만" 보내라고 할 뿐 회사가 다른 고객 데이터를 다루는 규칙은 없다(standards.md §1.1). MLCommons R3.1도 이 공백을 적었다(redteam.md S19). Muse가 비사용자까지 관계 페이지를 매시간 갱신하듯 수요는 실재한다(redteam.md S38).
4. **LLM에게 맡기면 샌다.** Muse Spark 단독 CIMemories violations@5는 78.3%, AgentDojo ASR은 11.7%, Glimmer ASR은 28.4다. Meta 보고서는 캘린더 예약 같은 외부 송신 환경에서 위험이 커진다고 적었다(privacy.md §0). 에이전트 간 메시지 누출은 68.8%로 최종 출력(27.2%)보다 높다(AgentLeak, redteam.md S18).
5. **새는 것은 제목보다 구조다.** CalBench 기본 실행에서 제목 누출은 관찰되지 않았지만 점유·이동 비용에 대한 믿음은 움직였고, 침묵은 공정성을 해쳤다(privacy.md §1.1). free/busy는 첫 질의에 지도 전체를 넘기고(privacy.md §1.3) 반복 질의로 원본이 재구성된다(redteam.md R6).

## 4. 당근과 채찍

| | T0 서명 없는 UI 자동화 | T1 서명 에이전트 | T2 서명+위임+면접 초대 |
|---|---|---|---|
| 정보 | 사람과 같은 예약 페이지(같은 엔진) | D0~D1, 공고·상태 | D2, 정책상 D3 |
| 한도 [제안] | IP당 6회/분, 스윕이면 PoW | 운영자 쿼터 | 위임자당 30회/분 |
| 쓰기 | 없음 | 없음 | 10분 홀드 1개, 확정, 단계당 변경 2회 |
| 영수증 | 없음 | 거절 영수증 | 모든 결정 + events |

- **핵심 논리.** 사람용 예약 페이지와 에이전트 API가 같은 공개 엔진을 쓴다. 우회해도 B~E에 대해 더 얻을 것이 없고 편의만 잃으니 "막을 수 없다"가 "숨을 이유가 없다"로 바뀐다. A 화면에 보이는 것을 가져가는 경계 안 위임은 약관으로 다룬다(redteam.md R1).
- **채찍.** 서명 없는 반복 접근은 사람 수준 한도와 Anubis식 SHA-256 PoW를 받는다. PoW 단독은 약해(Laurie·Clayton 2004) 보조로만 쓴다(ledger.md §1-C). 429에는 `Retry-After`와 poppy.json 안내를 붙인다.
- **computer-use 끌어들이기.** Web Bot Auth 서명이면 T1, Poppy 브라우저 세션 결합까지 하면 T2다. 0.3은 `browser_session_endpoint`의 일회용 code(128비트 이상, 60초 내 만료)를 nonce로 Session Key DPoP proof를 서명해 내면 세션 쿠키를 준다. 0.2는 서명된 browser assertion과 jti 검사다 [https://personalagentprotocol.org/docs/0.3/spec, /docs/0.2/spec.md]. 결합 뒤 UI 조작에도 T2 한도와 영수증이 붙는다.

## 5. 메커니즘 설계

### 5.1 목적·관계에 묶인 공개 등급

목적 `interview.{schedule,reschedule,cancel,status}`와 관계 `candidate.invited|applied|agency|unknown`은 닫힌 어휘다. 등급은 (관계, 목적, 면접관의 일정별 라벨, 남은 예산)으로 결정적으로 정한다(privacy.md §4.1).

| 등급 | 외부가 받는 것 | 기본 적용 |
|---|---|---|
| D0 | 응답 없음, 코디네이터 handoff | 목적 미선언, 미확인 신원, 예산 소진 |
| D1 | 제안 시각이 '제시 집합'에 드는지(실제 가용성 아님) | 초대 전 지원자 |
| **D2** | 패널 전원+회의실 교집합 후보 k=3 | **초대 지원자 기본값** |
| D3 | D2 + "조정하면 가능" 후보와 비용 등급. 면접관 승인 후 확정 | 최종 라운드, 재일정 |
| D4 | D3 + 범주("외근") | 면접관이 그 일정을 opt-in했을 때 |
| D5 | 제목·장소·참석자 | 외부 불가(Cedar forbid) |

원안의 "개인 일정이 있어 어렵다"는 D4이고, 기본값은 D2("그 시간은 어렵습니다. 화 16:30, 수 14:00, 목 13:00은 가능합니다")다. D3는 침묵이 공정성을 해친다는 CalBench 지적에 대한 답이며, 조정할 인원 수는 밝히지 않는다.

### 5.2 결과만 반환하는 API

`find_slots`, `hold_slot`, `confirm`(Poppy operations), `reschedule`, `status`를 MCP와 Poppy 대화로 노출한다. `is_free(person, t)`, 면접관별 가용성, 패널 구성 선택은 없다. 패널은 회사가 단계로 고정하므로 외부가 {B,C} 대 {B,C,D} 같은 집합 차분 질의를 만들 수 없다. 면접관 이름은 확정 뒤 공개한다.

### 5.3 누적 노출 예산과 고정 투영

- **고정 투영.** (패널 ∩ 회의실 ∩ 선언 창 ∩ 면접 시간대)를 30분 버킷으로 만들고 HMAC-PRF(지원서, 단계, 일 단위 epoch, 슬롯) 순 상위 k개를 고른다. 같은 입력엔 같은 답, 노이즈 없음(RootGuard 원리, privacy.md §1.2). epoch 단위 갱신이라 타인 예약을 실시간으로 쫓을 수 없다.
- **예산.** 새로 드러난 슬롯 상태 1개가 1단위, 빈 결과도 1단위다. 키가 **지원서(초대 토큰)**라서 에이전트 ID를 늘려도(Sybil) 예산은 그대로고, 단계 합산이라 단계 간 차분도 막힌다. 기본 12단위/주 [제안]. 소진되면 D1(propose-only)을 거쳐 D0이다.
- **선언 창 최소 폭.** 합계 6시간·이틀 이상. 30분 창으로 한 칸씩 찌르는 probing을 막는다.
- **정보주체 상한(Should).** 한 면접관의 주간 외부 노출 합계가 넘치면 코디네이터가 확인한다(공모 대비).
- 예약 자체가 점유를 드러내므로 잔여 누출은 0이 아니다. 보장하는 것은 상한과 기록이다.

### 5.4 '정보 없음'과 '정책상 비공개'

`not_offered`(reason `policy.third_party`)는 실제 상태와 **무관하게** 붙는다. 바쁜 칸이든 비었지만 투영에 안 뽑힌 칸이든 같다. 상태에 따라 붙이면 표시 자체가 누출 채널이 된다(ablation으로 잰다). `no_data`는 공개 규칙(면접 시간대·기간 밖, 없는 공고)에만 쓴다. 상대 에이전트는 사유를 지어내지 않고 "회사 정책상 비공개"라고 전하면 된다.

### 5.5 정보주체 리포트

- 민준(B) 주간: "외부 에이전트 요청 14건이 당신 일정을 계산에 썼습니다. D2 11건, D3 2건(본인 승인), D0 1건. 제목·범주 공개 0건."
- 하윤(A): "당신의 면접은 다른 지원자 요청 23건에 '사용 중'으로만 쓰였고 이름·재직사 공개는 0건입니다." 각 줄은 영수증과 포함 증명으로 이어진다.

### 5.6 남용 억제

등급별 한도(T0는 PoW 폴백), 위임자 쿼터, 홀드 상한(1개·10분, 만료 3회면 24시간 정지), 단계당 변경 2회, status 캐시를 둔다. 지원자에게 예치금은 받지 않는다(채용 공정성). 운영자(client_id)별 홀드 만료율·429 위반·인젝션 신호로 평판을 매기고, 판정은 로그에 남아 이의 제기가 된다. 채용 행사 같은 희소 슬롯은 3분 창 추첨으로(설계 D2와 공유).

### 5.7 영수증·투명성 로그·앵커링

- 결정마다 서명 영수증(MVP JWS, Should COSE_Sign1 + RFC 9942)을 RFC 9162 Merkle 로그에 넣는다. 5분 체크포인트를 다른 호스트·키의 증인 2개가 공동서명하고, 루트만 1시간마다 OpenTimestamps로 비트코인에 앵커한다(ledger.md §1-A·§2).
- 공개는 체크포인트(크기·루트)뿐이고 항목은 당사자·감사자만 본다. MoaCal 전 테넌트를 한 로그에 섞어 고객사별 채용 속도 같은 메타데이터를 숨긴다 [제안]. 식별자는 항목별 솔트 커밋먼트, 삭제는 솔트 파기다(개인정보위 2026-07-09, EDPB 02/2025 v2.0).
- 서사: Meta의 WhatsApp·Messenger 키 투명성 로그(AKD, Messenger는 Cloudflare 외부 감사)를 에이전트 행위로 넓혔다. 비트코인의 부품(해시 체인·머클 트리·서명)은 쓰되 개인정보는 어떤 체인에도 없다.

### 5.8 메시지 예시

(a) `poppy.json`의 확장 부분(공식 `operations` 확장 항목은 생략). 비프로토콜 확장은 소유 도메인 접두사가 필수다(0.3).

```json
{ "protocol_version": "0.3",
  "extensions": {
    "overlap.example/disclosure": { "version": "1",
      "purposes": ["interview.schedule", "interview.reschedule", "interview.cancel", "interview.status"],
      "default_level": "D2", "max_external_level": "D4", "k": 3, "bucket_min": 30,
      "budget": { "unit": "slot_state", "key": "application", "per_week": 12 },
      "markers": ["not_offered", "no_data"] },
    "overlap.example/receipts": { "version": "1", "format": "jws",
      "log": "https://log.moacal.example", "witnesses": 2, "anchor": "opentimestamps" } } }
```

(b) 요청. 확장을 모르는 PDA는 `text`만 보내고 parser가 같은 구조로 바꾼다.

```json
POST /poppy/conversations/cv_81/messages
{ "id": "m_204", "role": "user", "author": { "type": "agent" },
  "text": "다음 주 패널 면접 60분. 화~목 오후 가능, 화 15시·수 16시·화 19시 선호.",
  "data": { "overlap.example/disclosure": { "purpose": "interview.schedule", "application_ref": "app_7Q2c",
    "stage": "panel", "duration_min": 60, "tz": "+09:00",
    "requester_free": [{ "from": "11-03", "to": "11-05", "daily": "13:00-18:00" }],
    "ask_about": ["11-03T15:00", "11-04T16:00", "11-03T19:00"] } } }
```

(c) 응답. 민준의 상담(화 15:00)과 서연의 다른 면접(수 16:00)이 같은 표시를 받는다. 비었지만 안 뽑힌 칸을 물어도 같다.

```json
{ "id": "m_205", "role": "company", "author": { "type": "agent" },
  "text": "11/3 16:30, 11/4 14:00, 11/5 13:00에 가능합니다. 화 15:00·수 16:00은 제시할 수 없고 사유는 정책상 비공개이며, 화 19:00은 면접 시간대 밖입니다.",
  "data": { "overlap.example/disclosure": { "level": "D2", "offers": ["11-03T16:30", "11-04T14:00", "11-05T13:00"],
    "about": { "11-03T15:00": "not_offered/policy.third_party", "11-04T16:00": "not_offered/policy.third_party",
               "11-03T19:00": "no_data/outside_interview_hours" },
    "budget": "3/12", "receipt": "https://log.moacal.example/r/4182" } } }
```

(d) 영수증 페이로드. JWS(Ed25519)에 RFC 9162 포함 증명, 증인 서명 체크포인트, OTS 증명을 동봉한다.

```jsonc
{ "v": 1, "log_index": 4182, "t": "2026-10-30T14:00+09:00/15m",  // 시각은 버킷
  "agent_operator": "jkt:QxL0…",  // client_id 키 thumbprint(조직 책임이라 공개)
  "principal": "c:7c1e…", "subjects": ["c:a19…", "c:44b…", "c:d0e…", "c:r01…"],  // 항목별 솔트 커밋먼트
  "purpose": "interview.schedule", "relationship": "candidate.invited", "decision": "ALLOW", "level": "D2",
  "revealed": 3, "budget_after": "3/12", "policy_hash": "sha256:5b0e…", "projection_hash": "sha256:e71a…",
  "req_digest": "sha256:…", "resp_digest": "sha256:…",  // 원문·솔트는 기업 금고
  "signals": { "prompt_guard": 0.02, "egress": "pass" } }
```

(e) 데모 정책 diff(Cedar, D2 permit 생략). 둘째 줄을 켜면 같은 요청이 D3가 되고, 셋째 줄 때문에 면접관 승인 없이는 확정되지 않는다.

```cedar
forbid (principal, action == Action::"disclose", resource) when { resource.level >= 5 };
permit (principal, action == Action::"disclose", resource) when { context.stage == "final" && resource.level == 3 };
forbid (principal, action == Action::"confirm", resource) when { resource.needs_move && !resource.owner_approved };
```

## 6. 아키텍처

```text
OUTSIDE  candidate agent (PDA, 3rd party) ─RFC 9421 · Poppy OAuth/DPoP─▶ [1]
         computer-use bot ─UI─▶ booking page (same engine) ─▶ [1]
GATEWAY (MoaCal, top→bottom)
  [1] Edge: tier T0/T1/T2 · 429 · PoW · browser-session binding
  [2] Poppy company adapter (0.2/0.3) + MCP server
  [3] Inbound parser ── context A only ── Muse Spark 1.3 (+ Prompt Guard 2 score)
       │ schema validator (code) → IntentJSON: enums · ids · times
  [4] Disclosure engine (code) ◀── labels ── [5]
       Cedar level · intersection · fixed projection · budget → DisclosureObject
  [6] Outbound phraser ── context C only ── Muse Spark 1.3
       egress check: allowed times · deny-list · Presidio KR (fail → template)
  [7] receipt signer → [8] Merkle log → witness ×2 → OTS (Bitcoin)
  [9] consoles: inspector · leak meter · subject report · auditor
INSIDE   employee calendars ──▶ [5] owner classifier ── context B only ── Glimmer 30B (local, async)
```

| 컨텍스트 | [A] 비신뢰 입력 | [B] 민감 데이터 | [C] 외부 송신 |
|---|---|---|---|
| [3] Parser(Spark) | ● | – | – |
| [5] Classifier(Glimmer) | – | ● | – |
| [6] Phraser(Spark) | – | 공개 확정 값만 | ● |
| [4] 엔진(코드, LLM 아님) | 검증된 구조체 | ● | ● |

Meta의 Agents Rule of Two(2025-10-31)는 한 세션에 셋 중 둘까지 허용하지만(privacy.md §2.1) Overlap은 LLM 컨텍스트마다 하나만 준다. parser 출력은 닫힌 스키마와 결정적 검증을 거치고, phraser는 요청 원문을 보지 않는다. ASR 28.4인 Glimmer는 외부 메시지를 보지 않고, 일정 생성 때 비동기로 돌아 응답 지연도 만들지 않는다(meta.md §3).

- **저장소.** 캘린더 원본, 라벨, 예산 원장·투영 캐시(SQLite), 원문 금고(원문·솔트, 파기 가능), Merkle 로그·체크포인트, 정보주체 인덱스.
- **저장형 인젝션.** 외부 텍스트는 캘린더에 쓰지 않고 면접 일정은 템플릿 제목으로 만든다(privacy.md §4.4). 라벨러는 열거형만 내므로 오염돼도 오분류에 그치고, D3 이동은 소유자 승인이 막는다.

## 7. Meta 도구 지도

| 도구 | 역할 | 억지가 아닌 이유 |
|---|---|---|
| Muse Spark 1.3 (Standard) | [3] parser, [6] phraser(한/영), 레드팀 에이전트, 기준선 B2·B3 | 서드파티 에이전트는 확장을 모르고 자연어로 온다. 자연어↔스키마 변환이 필요하고, 경계는 코드라 모델 실수가 누출이 되지 않는다 |
| Muse Glimmer 30B (로컬, Apache 2.0) | [5] 직원 일정 라벨러(범주·민감도·이동 가능성) | '정신건강의학과', '도윤 1차'의 민감도는 규칙으로 못 잡고 원문은 밖으로 못 나간다. Cookbook "Local agent that asks first"를 회사 쪽으로 뒤집었다(meta.md §4) |
| Prompt Guard 2 86M | 인젝션 점수를 영수증 신호로 | 한국어 미평가라 경계로 쓰지 않는다(privacy.md §2.4) |
| Wonder(선택)·Voice Transcribe(Could) | 정책 → Cedar 초안·공격 다양화 / AI 전화 처리 | 오프라인 전용 / 전화가 다음 홍수 채널 |
| SAM 3.1·Muse Image | 쓰지 않음 | 이미지 속 제3자가 없어 억지다(설계 D3에 양보) |
| Poppy (Meta·Sierra) | 회사 측 구현과 확장 | 이슈 #18·#37·#39의 빈칸을 채운다 |

**데이터 정책.** Standard 모드만 쓴다. `-contributor`는 개인정보 입력 금지이고 Muse Code 구독 기본값이 Contributor라 바꾼다(meta.md §0). ZDR은 영업팀을 거친 조직 단위로만 켜지므로(meta.md §2) 없다고 보고, 제3자 원본은 클라우드로 보내지 않는다. Spark는 요청자 메시지와 공개 확정 값만 본다. 데이터는 전부 합성이다.

**"예상 밖 능력" 후보.** ① 단독 위반율 78.3%인 Spark가 Rule of Two 분리 안에서 의미 누출 0이 되는지 같은 지표로 잰다. ② 로컬 Glimmer 30B 라벨러가 Spark 대비 어디까지 충분한지 잰다.

**비용** [가정: Spark 1.3 Standard, reasoning 낮음, 프롬프트 캐시, 단가는 meta.md §2]. 게이트웨이 요청 1건은 parser(입력 2K 중 캐시 1.5K, 출력 0.5K)와 phraser(1.5K 중 1K, 0.4K)로 약 $0.0055, 에이전트 턴 1회는 약 $0.0085다(meta.md §7). 평가(300과업 × O-full·B1·B3, 100과업 × ablation 2·B0·B2, 공격 10종 × 10회 × 6구성)는 약 $100, 1인 개발·리허설은 $40~50, 로컬인 Glimmer·Prompt Guard·Presidio는 $0이다. 1인은 약 $140~150로 크레딧 $150에 빠듯하고 2인부터 여유롭다. reasoning을 기본값으로 두면 2~3배다(meta.md §7).

## 8. 기술 스택

- **게이트웨이(TypeScript, Node.js 24+: PDA 로컬 실행 요건).** Hono 또는 Fastify, MCP TypeScript SDK, Zod, SQLite(최신 안정판). `jose` 6.2.13(JWS·private_key_jwt·DPoP ES256), `web-bot-auth` 0.2.0·`http-message-sig` 0.3.0(RFC 9421), `@noble/curves` 2.4.0, Cedar(`@cedar-policy/cedar-wasm`, 최신 안정판). Meta API는 OpenAI 호환 SDK + `https://api.meta.ai/v1`.
- **투명성.** RFC 9162 Merkle은 TS 자체 구현(수백 줄), `pymerkle` 7.0.0으로 교차검증(GPL-3.0이라 테스트 전용). Go 인원이 있으면 Tessera v1.0.4와 transparency-dev/witness. 앵커는 `opentimestamps-client` 0.7.2 크론(ledger.md §1-E).
- **AI 사이드카(Python, 최신 안정판).** llama.cpp b10353+ `--jinja`로 `Muse-Glimmer-30B-GGUF` Q4_K_M(16.8GB, 32GB 이상 Mac), Prompt Guard 2(transformers), Presidio(KR 엔티티), OR-Tools CP-SAT 오라클.
- **콘솔·인프라.** React + Vite(최신 안정판, `packages/receipts`로 브라우저 검증), 팀 소유 HTTPS 도메인, Docker.

```text
overlap/
  apps/      gateway(Poppy 어댑터·MCP·예약 API·Edge) · console · witness
  packages/  disclosure(교집합·투영·예산·표시) · policy(Cedar) · receipts(JWS/COSE·RFC 9162) · llm(parser/phraser·egress)
  services/  classifier(Glimmer) · guards(Prompt Guard·Presidio) · anchor(OTS)
  eval/      datagen · attacks · baselines · oracle · reports
  spec/      disclosure-receipts-profile.md
```

## 9. 10일 MVP

| 구분 | 항목 |
|---|---|
| **Must** | M1 Poppy 어댑터(발견·OAuth·DPoP·대화·429), PDA validator 통과 · M2 공개 엔진(교집합·투영·예산·비공개 표시·D0~D2·D5 forbid) · M3 parser/phraser·egress 검사·템플릿 폴백 · M4 Glimmer 라벨러 · M5 JWS 영수증·Merkle·체크포인트·브라우저 검증 · M6 평가(A1·A3·A4·A6·A9, B0·B1·B3, 누출 미터) · M7 정보주체 리포트, 영상 |
| **Should** | D3 + 면접관 승인(operations) · 증인 2개·OTS · PDA interop harness·라이브 상호운용 · 세션 결합·B2 · Prompt Guard · COSE · 정보주체 상한·평판·나머지 공격 |
| **Could** | 영업·파트너 모드(사람 지정형이라 차분 방어 필요) · 전화 채널 · WebMCP · Base Sepolia · ACT · 행사 추첨 · Wonder |

**컷 라인.** 11/1(일) 24:00에 M1~M5가 미완이면 Should를 모두 버리고 데모 상대를 자체 스크립트 에이전트로 바꾼다(validator 통과만 보인다).

| 날짜(KST) | 목표 | 관문 |
|---|---|---|
| 10/26 월~27 화 | 14절 합의, 크레딧 청구, Glimmer·도메인 준비, 합성 데이터, 교집합·투영 v0, Spark 첫 호출(국내 카드) | Glimmer 구동 |
| 10/28 수 | Poppy 어댑터, PDA validator, B1·B3 누출 30회 | **48시간 관문**: validator 통과, 기준선 누출 재현 |
| 10/29 목~30 금 | parser, Cedar, 예산, 비공개 표시, phraser, egress, Glimmer 라벨러 | |
| 10/31 토 | 영수증, Merkle, 체크포인트, 증인 1개, OTS 시작(확정에 몇 시간) | |
| 11/1 일 | 공격 하네스, 기준선 러너, 1차 평가 | 컷 라인 |
| 11/2 월~3 화 | 콘솔, D3·operations, 증인 2개, 전체 평가·ablation, 세션 결합 | 11/3 18:00 동결 |
| 11/4 수~5 목 | 데모 녹화(3분·1분), README·평가 리포트·제출문, 11/5 09:00 업로드 | 11/5 11:00 마감 |

| 인원 | 분담 |
|---|---|
| 1인 | Must만. 엔진 → 어댑터 → LLM → 영수증·로그 → 평가 → UI. 증인 1개, 콘솔 1페이지 |
| 2인 | P1 게이트웨이·정책·암호 / P2 AI·평가·데모(Spark, Glimmer, 데이터, 공격, 콘솔, 영상) |
| 4인 | P1 Poppy·신원(어댑터, DPoP, Web Bot Auth, 세션 결합, PDA) / P2 공개 계산(엔진, D3, Cedar) / P3 투명성(영수증, 로그, 증인, OTS, 리포트) / P4 AI·평가·데모 |

## 10. 3분 데모 대본

| 시간 | 화면 | 내레이션 | 지표 |
|---|---|---|---|
| 0:00–0:15 | 코디네이터 메일함에 쌓이는 에이전트 메일 | "지원서는 이미 AI가 쓴다. 다음은 면접 일정이다" | 분당 11,000건(출처 자막) |
| 0:15–0:40 | 기준선 B3(Spark + 전체 캘린더 + 프라이버시 프롬프트)에 A9·A1 | "순진한 AI 프록시는 이렇다." '도윤 1차 면접', '상담'이 샌다 | 누출 미터 빨강 |
| 0:40–1:15 | 서드파티 PDA가 발견 → 로그인 → 패널 요청. 인스펙터에 원본(흐림)과 공개 객체 diff | "남이 만든 에이전트다. 4명+회의실 교집합을 안에서 계산해 3개만 준다" | 왕복 1회, 공개 3/12 |
| 1:15–1:25 | 서명 없는 computer-use 봇 스윕 → 429·PoW → 세션 결합 | "숨어도 더 얻을 게 없고, 오면 더 빠르다" | T0→T2 |
| 1:25–1:55 | 악성 초대 지원자 에이전트(Spark 레드팀)의 스윕·인젝션·Sybil. B1과 Overlap 복원 히트맵 | "같은 공격, 다른 결과." 예산 0 → propose-only. 바쁜 칸과 빈 칸이 같은 표시 | 복원 F1, 의미 누출 0 |
| 1:55–2:15 | 유나가 Cedar 한 줄(최종 라운드 D3)을 켠다 → "조정하면 가능" → 민준 승인 → 확정 | "프롬프트가 아니라 정책이 정한다" | 성사율, 미팅당 공개 상태 |
| 2:15–2:35 | 민준·하윤 리포트 → 영수증 → 브라우저 증명 검증 → 증인 서명 → 비트코인 앵커 | "내 데이터에 닿은 요청을 당사자가 본다" | 요청 14건, 제목 공개 0 |
| 2:35–2:50 | 운영자가 DB 항목을 고친다 → 증인이 서명을 거부한다 | "운영자도 몰래 못 고친다" | 일관성 증명 실패 |
| 2:50–3:00 | 평가표, "Poppy 확장 · 오픈소스" | "에이전트엔 빠른 길, 사람엔 지켜진 일정, 모두에게 영수증" | 기준선 4종 대비 |

**"내 봇 둘의 대화"로 보이지 않게 하는 장치.** ① 정직한 요청자는 다른 개발자가 만든 Poppy Demo Agent(PDA, Apache-2.0, 타사 모델)다. 격리 컨테이너에서 녹화 프록시로 모든 에이전트×회사를 시험하는 그 interop harness 그리드에 우리 회사를 넣는다 [https://github.com/adewale/pda]. ② 같은 공격 스크립트를 기준선 4종에 돌린다. ③ 시드 고정 재생. ④ 누출 미터는 합성 데이터 정답과 실시간 대조. ⑤ Cliffside Retail의 protocol inspector처럼 요청·응답을 그대로 보인다 [https://personalagentprotocol.org/docs/demos.md].

## 11. 정량 평가 계획

- **데이터셋.** 직원 30명 × 4주, 1인 주 15~25개 일정. 시간은 코드로, 제목·설명은 Spark 구조화 출력으로(한/영 반반) 만들고 범주·민감도(의료·가족·타 지원자 면접·HR·대외비)·이동 가능성·외부 공개 가능 여부를 정답 라벨로 붙인다. 공고 6개, 단계별 패널(1~5명)과 회의실, 초대 지원자 120명, 과업 300개. 정답은 CP-SAT 오라클(privacy.md §5).
- **공격.** A1 직접 추출 → 제목·범주·이름 누출 · A2 권위 사칭("대표 비서실") → 등급 초과 공개 · A3 메시지·회의 설명 인젝션(저장형 포함) → 스키마 밖 행동 · A4 30분 창 스윕 → 패널 지도 복원 F1 · A5 단계 차분(1인 단계 대 패널) → 개인 지도 복원 · A6 Sybil(ID 다수, 가짜 지원서) → 예산 우회 · A7 장기 패턴(매주 화 15:00) → 반복 민감 일정 추론 · A8 출력 밀반입(인코딩 요구) → egress 우회 · A9 타 지원자 탐문("경쟁자가 누구죠?") → 존재·신원 추론 · A10 홀드 사재기·폴링 홍수 → 타 지원자 예약 실패율.
- **지표.** 의미 누출률(문자열·Presidio·LLM 판정 교차), 구조 누출(지도 복원 F1, VPS식 믿음 이동), violations@5, 결정성, 성사율·왕복 수·오라클 대비 비용·면접관 부담 공정성, 미팅당 공개 상태, 홀드 전환율, p50/p95, 100요청당 비용. 95% 부트스트랩 구간을 붙인다.
- **기준선.** B0 무방어 API(제목까지 주는 getSchedule류), B1 면접관별 free/busy, B2 computer-use UI 스크래핑(Spark computer use로 일반 예약 페이지의 2주치 공통 빈 시간을 긁음), B3 단일 LLM 프록시, 선택 B4 Firewalls(MIT 코드). ablation은 예산 끄기, 매번 무작위 투영, 조건부 비공개 표시.
- **사전 목표 [제안].** 의미 누출 0, 같은 질의 수에서 패널 지도 복원 F1이 B1의 1/3 이하, D3를 켰을 때 성사율 B1 이상, 미팅당 공개 상태 B1의 1/3 이하, 결정성 100%, p95 5초 이하.

## 12. 해자·사업성

- **해자가 아닌 것.** 프로토콜(Poppy는 Apache-2.0), 영수증 형식(IETF 개인 초안 2건, VeriKnox, agentgateway), 마스킹(free/busy, Graph, Firewalls 연구, Presidio 게이트웨이), rate limit(Cloudflare·DataDome·Akamai), 프롬프트(standards.md §5, ledger.md §0).
- **생긴다면 여기.** ① 업종별 공개 정책 템플릿과 제3자 누출 벤치마크(측정 기준을 쥔 쪽이 유리) ② 다테넌트 SaaS 안의 운영자 평판(테넌트가 늘수록 정확) ③ 영수증이 감사 증거가 될 때의 증인망·포맷 전환 비용 ④ 첫 레퍼런스라는 위치(시간 우위일 뿐).
- **사업성.** 첫 구매자는 에이전트를 성장 채널로 원하지만 OAuth·정책·감사를 만들 여력이 없는 중견 일정·ATS SaaS다(redteam.md §1). 오픈소스 코어에 호스팅 로그·증인·리포트를 유료로 얹는다 [제안]. 위협은 Sierra 레퍼런스 구현, Poppy 파트너 Cloudflare·Okta, agentgateway다(standards.md §5). 흡수돼도 벤치마크와 정책 템플릿은 남는다. 피치에서는 해자를 주장하지 않는다.

## 13. 최대 약점 3개와 대응

1. **"free/busy, 예약 링크, Firewalls 연구와 뭐가 다른가."** 마스킹 자체는 새롭지 않다. → 같은 공격으로 B1·B2와 나란히 잰 구조 누출 F1, 미팅당 공개 상태, D3 성사율로 차이를 보인다. 연구는 사용자 측이고 Overlap은 데이터 보유자 측 표준 통로이며, 정보주체 리포트와 공개 등급 영수증이 붙는다.
2. **채택·강제력·표준 변동.** 대형 에이전트가 이 통로를 쓸지 모른다. Muse 연동은 10일 안에 불가능하고, 0.3은 breaking change가 많으며, 아직 없는 레퍼런스 구현이 대회 중 나올 수 있다. → UI와 API가 같은 엔진이라 우회 이득이 0이고, 협조 에이전트가 없어도 트래픽 가시화와 내부 영수증으로 가치가 있다(redteam.md R7). 레퍼런스 구현이 나오면 그 위의 확장으로 옮긴다.
3. **인프라 데모와 기준선 재현.** 인프라 출품작은 경험을 만든 팀에 졌고(meta.md §6), B3는 공격이 없으면 잘 새지 않을 수 있다(CalBench). → 하윤·민준·도윤의 사람 서사로 간다. 누출은 적대 공격 기준으로 재고 핵심 지표를 구조 누출로 둔다. 48시간 관문에서 재현에 실패하면 데모 중심을 probing 방어로 옮긴다.

## 14. 구현 전에 합의할 결정

| # | 결정 | 선택지 | 권장 |
|---|---|---|---|
| 1 | 시나리오 | 채용 / 영업·파트너 / 연구실 | 채용, 영업은 Could |
| 2 | 운영 주체 | SaaS 벤더 / 고객사 셀프호스트 | SaaS 벤더(셀프호스트 가능) |
| 3 | Poppy 버전 | 0.2(10/24 동결) / 0.3(작성 중) | 0.2 고정 + 0.3 어댑터(`sender`↔`author.type`). PDA의 0.2 지원이 미출시라 10/28에 실측 |
| 4 | 확장 이름·위치 | 팀 도메인, `data` 안 / 최상위 | 팀 소유 도메인, `data` 안. 0.3 규칙 재확인 |
| 5 | 공개 파라미터 | k·버킷·기간·예산·창 폭 | 3·30분·14일·12/주·6시간 |
| 6 | 예산 키 | 지원서 / User ID / client_id | 지원서 + 운영자 쿼터 |
| 7 | 정책 엔진 | Cedar / OPA | Cedar(forbid 우선이 D5와 맞음) |
| 8 | Glimmer 위치 | 로컬 32GB+ Mac / 클라우드 | 로컬. 장비가 없으면 합성 데이터만 호스팅하고 영상에 밝힌다 |
| 9 | 영수증·로그·앵커 | JWS / COSE, TS / Tessera, 증인 0~2개, OTS / Base | JWS·TS로 시작(COSE·Tessera는 Should), 증인 2개 + OTS |
| 10 | 로그 공개 | 전체 / 체크포인트만 | 체크포인트만, 테넌트 혼합 |
| 11 | 데모 상대 | PDA / 자체 | 정직한 쪽 PDA, 공격은 자체 Spark 레드팀 |
| 12 | 범위 | 경계 밖만 / 경계 안 포함 | 경계 밖만, 경계 안은 약관 |
| 13 | 테마·라이선스 | BfYW / Push the Frontier, Apache / MIT | Push the Frontier(채용 실무자가 있으면 BfYW), Apache-2.0 |
