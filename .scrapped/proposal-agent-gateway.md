# 에이전트 정문 아이디어 고도화 보고서: Overlap

작성 2026-10-26(월) · 독자: 팀 전원 · 상태: 구현 전 합의용

(파일명 §절)은 `research-agent-gateway-2026-10-26/`에 있는 리서치 파일(local·standards·privacy·ledger·meta·redteam.md)의 절이고, a2a-delegates.md는 `research-ai-era-apps-2026-10-26/`의 파일이다. 세 무대의 원 설계안은 같은 리서치 폴더의 design-overlap·design-fairturn·design-countersign.md에 있다. [추론]은 판단, [스니펫]은 검색 요약으로만 본 것, [미확인]은 확인하지 못한 것이다. 서비스·회사·인물은 가상이다.

> - **한 줄 콘셉트**: 채용 면접 일정을 위한 Poppy 호환 회사 측 에이전트 정문. 길은 열되 밖으로는 모두가 되는 시간만 내보내고, 모든 결정을 서명 영수증으로 남긴다.
> - **원안에서 바꾼 것**: '프록시로만' → 보상이 있는 우선 차선 / "개인 일정이 있어 어렵다" → 목적·관계별 공개 등급과 누적 예산(원 문장은 당사자가 동의했을 때의 D4) / 블록체인 공개 원장 → 체크포인트만 공개하는 투명성 로그 / 새 프로토콜 → Poppy 확장 프로필과 회사 측 게이트웨이
> - **오늘 밤(10/26)**: Claim Form이 오면 참가 승인자마다 크레딧 청구(결제수단·Team ID), 도메인 구입, Glimmer GGUF 다운로드, 공식 규정·개막 생중계 확인
> - **10/27까지 정할 것**: 시나리오(정오, 근거 조사와 함께), 인원·장비·크레딧(정오), Poppy 버전과 데모 상대(밤, PDA 버전 확인 뒤)
> - **인원별 범위**: 1인은 공개 엔진·영수증·로그에 집중하고 드롭(정해진 시각에 한정 수량을 푸는 추첨 행사)·패스키·비트코인 앵커·모니터를 뺀다. 2인은 Poppy 로그인, 조정 가능 후보(D3), 드롭을 더하고 3~4인은 전부 한다(7.1절).

## 0. 한눈에 보는 결론

원안의 세 직관, 곧 에이전트를 막지 말고 길을 내되 그 길에서 남의 정보는 가리고 에이전트가 한 일은 나중에 따져 볼 수 있게 남긴다는 생각은 그대로 살린다. 다만 그대로 만들면 네 군데서 막힌다. '프록시로만' 다니게 할 방법이 없고, "개인 일정이 있어 어렵다"는 답은 free/busy보다 오히려 많이 드러내며, 블록체인식 공개 원장은 지키려던 정보를 퍼뜨린다. 새 프로토콜을 내면 주최사 Meta가 Sierra와 함께 밀고 있는 Poppy와 맞서게 된다는 점도 부담이다.

이를 고친 권장 콘셉트가 Overlap이다. 가상의 면접 일정 SaaS인 MoaCal이 고객사 채용 캘린더 앞에 세우는 Poppy 호환 에이전트 정문으로, 지원자의 에이전트가 오면 면접관 패널, 회의실, 지원자의 가능 시간이 겹치는 시간을 안에서 계산해 후보 몇 개만 내보낸다. 면접관의 상담 일정이나 다른 지원자의 존재는 어떤 질문에도 같은 모양의 답으로 가리고, 면접관이 공개에 동의한 범주만 "외근이 있어 어렵습니다"처럼 이유로 말한다. 수요가 몰리는 '오픈 인터뷰 데이' 현장 슬롯은 누구나 다시 계산할 수 있는 추첨으로 나눈다. 모든 결정은 공개 수준을 담은 서명 영수증이 되어 증인이 공동서명하는 Merkle 로그에 들어가고, 로그의 체크포인트 루트만 비트코인에 고정한다. 면접관은 '내 데이터에 닿은 에이전트 요청'을 리포트로 받는다.

| 원안 | 그대로 두면 | 바꾼 형태 | 근거 |
|---|---|---|---|
| 프록시로만 조작하게 한다 | 강제할 수 없다(UA 위장, Web Bot Auth 헌장, 9th Circuit). 반대로 Amazon은 Muse를 실제로 막았다 | 가장 유리한 차선. 사람 페이지도 같은 엔진이라 우회 이득이 없다 | redteam.md R1, local.md §1 |
| "개인 일정이 있어 어렵다"로 가린다 | free/busy로 이미 되고, 범주까지 드러내며, 반복 질의로 복원된다 | 공개 등급(기본 D2), 결과만 주는 API, 공유 풀과 예산. 원 문장은 동의 시의 D4 | privacy.md §0·§4 |
| (암묵) LLM이 가려 쓴다 | 외부 입력·민감 데이터·외부 송신을 한 LLM이 다 가지면 Rule of Two 위반 | 공개는 Cedar가 정하고 LLM은 파서·라벨러·문장 생성기로 나눈다 | privacy.md §2.1 |
| 비트코인처럼 모두 공개한다 | 공개 원장이 "누가 누구의 일정을 물었나"를 퍼뜨린다 | CT식 투명성 로그. 체크포인트만 공개, 루트만 비트코인에 고정 | ledger.md §0·§1-A |
| 무차별 사용을 막는다 | 작업증명만으로는 약하고, 수수료는 공평한 접근을 해친다 | 신원 등급별 한도, 희소 슬롯 추첨, 로그 기반 평판 | ledger.md §1-C |
| 프로토콜 자체가 해자다 | Poppy가 신원·위임·AI 고지·429를 이미 다룬다 | Poppy 확장 프로필(Disclosure & Receipts)과 회사 측 게이트웨이 | standards.md §0·§4 |

같은 코어로 세 무대(채용 면접, 식당 좌석 드롭, 의류 마켓)를 비교하니 해커톤 관점으로는 식당 안(FairTurn)이, 보안·구현 관점으로는 채용 안(Overlap)이 앞섰다. 이 보고서는 Overlap에 FairTurn의 사건 구조를 옮겨 심었고, 공식 배점으로 남는 영향력 격차는 10/27 정오까지 근거를 찾아 판단한다(4.3절).

## 1. 고도화한 콘셉트

### 1.1 이름과 피치

Overlap(오버랩): 채용 면접 일정을 위한 Poppy 호환 회사 측 에이전트 정문.

- EN: "Overlap gives candidates' AI agents a dedicated lane into a company's interview calendar, but no edge over people who book by hand. Only the overlap ever leaves the building, and every decision becomes a signed receipt in a witnessed log."
- KO: "Overlap은 지원자의 AI 에이전트에게 화면을 긁지 않아도 되는 전용 통로를 열어 주지만, 손으로 예약하는 사람보다 앞자리를 주지는 않는다. 회사 밖으로 나가는 것은 모두가 되는 시간뿐이고, 모든 결정은 서명된 영수증이 되어 증인이 지켜보는 로그에 남는다."
- 마무리 문장: "Agents get a lane, not an edge."

Poppy의 발견(`poppy.json`)·OAuth 위임·DPoP·사람/AI 표기·429·operations는 그대로 쓰고, 비어 있는 목적 선언, 다른 사용자 데이터의 공개 규칙, 서명 영수증, 누적 노출 예산만 확장 프로필로 채운다(standards.md §3·§4).

### 1.2 원안의 예시는 이렇게 살아난다

일정 조율은 Overlap의 중심이다. 쇼핑몰 주문에 해당하는 면접 확정은 Poppy operations(revision, 최대 1회 실행), 사람 승인, 영수증으로 처리하며 같은 모듈이 마켓 주문에도 쓰인다. 리뷰 작성은 채용 무대에 없지만, 확장한다면 Overlap 영수증이 면접 후기의 '실제 참석' 증빙이 되고 후기 플랫폼은 SAM 3.1로 사진 속 다른 지원자 얼굴을 가린다(Could)[추론]. 공개 엔진, Cedar, 영수증·로그, Rule of Two 분리는 업종과 무관하고 업종마다 정책 묶음만 바뀐다.

### 1.3 무대와 등장인물

채용 면접을 고른 까닭은 이렇다. 패널 2~5명과 회의실의 다자 교집합이 일의 본질이라 '겹치는 시간만 내보낸다'가 억지 없이 맞는다. 보호할 제3자가 면접관의 개인 일정과 다른 지원자의 지원 사실로 두 겹이다. 회사가 서류 통과자에게 발급하는 초대(지원서)가 신원의 닻이 되어, 에이전트 ID를 늘려도 초대는 늘지 않으니 Sybil 공격에 강하다.

| 역할 | 가상 설정 |
|---|---|
| 게이트웨이 운영자 | MoaCal: 면접 일정 B2B SaaS. 고객사 캘린더 앞에 Overlap을 둔다(셀프호스트 가능) |
| 고객사 | Pinewheel Robotics: 직원 400명, 엔지니어 40명 채용 중. 서류 통과자 420명은 모두 면접을 본다. 11/12(목) '오픈 인터뷰 데이'에 당일 결과를 주는 현장 면접 60석을 따로 열고 이 자리만 추첨한다 |
| 요청자이자 보호 대상 | 하윤: 재직 중에 몰래 구직한다. 응모가 열리는 10시에 회의 중이라 에이전트가 대신 응모한다 |
| 보호 대상 | 면접관 민준(매주 화 15:00 정신건강의학과 상담, 목요일 외근), 같은 패널의 서연·지호, 다른 지원자 도윤(지원 사실 자체가 민감하다) |
| 사람·적대자 | 코디네이터 유나. 채용 인텔리전스 봇 ScryTalent(대행사로 위장해 지원서를 모은다), 서명 없는 computer-use 봇 |

데모 서사는 하윤과 민준으로 좁힌다. 하윤의 면접이 확정되는 순간 그 일정은 다른 사람의 요청에 대한 제3자 데이터가 된다. 오늘의 요청자가 내일의 보호 대상이 된다.

### 1.4 핵심 메커니즘

#### (1) 공개 계산

공개 수준은 요청자와의 관계(`candidate.invited`, `candidate.applied`, `agency`, `unknown`), 선언한 목적(`interview.*`, `hiringday.enter`), 면접관 일정의 라벨과 본인의 공개 동의, 남은 예산으로 정한다. 관계와 목적은 닫힌 어휘이고, 판정은 forbid가 하나라도 맞으면 거부하는 Cedar가 한다(privacy.md §2.3).

| 등급 | 외부 에이전트가 받는 것 | 적용 |
|---|---|---|
| D0 | 응답 없음, 코디네이터에게 넘김 | 목적 미선언, 미확인 신원, 예산 소진 |
| D1 | 면접 시간대 안의 제안 접수만(캘린더 정보 없음) | 초대 전 지원자, 면접관 1인 단계 |
| D2 | 패널 전원과 회의실이 겹치는 후보 k=3 | 초대 지원자 기본값 |
| D3 | D2 + "조정하면 가능" 후보와 비용 등급, 면접관 승인 뒤 확정 | 최종 라운드(2인 이상 Must) |
| D4 | D2 + 면접관이 공개에 동의한 범주만 이유로 말함 | 동의 범주와 라벨이 일치할 때(Must) |
| D5 | 제목·장소·참석자 | 외부 불가(forbid) |

원안 문장 "그 시간은 개인 일정이 있어 어렵다"는 범주를 드러내므로 정보주체가 그 범주의 공개에 동의했을 때만 나가는 D4이고, 기본 응답은 D2("그 시간은 어렵습니다. 16:30은 됩니다")다. D4는 동의 범주와 Glimmer 라벨이 일치할 때만 허용하는 Cedar permit 한 줄과 템플릿 문장 하나라(0.5인일 안팎[추론]) Must로 둔다. 데모에서 민준은 '외근'만 공개에 동의해 외근 시간에는 "외근이 있어 어렵습니다", 상담 시간에는 "그 시간은 어렵습니다"가 나간다. Glimmer 라벨이 응답을 실제로 가르고 원안 문장이 정책으로 살아나는 장면이다. D3는 '프라이버시를 위한 침묵'이 비용 정보를 빼앗아 부담 배분을 불공정하게 만든다는 CalBench 결과에 대한 답이다(privacy.md §1.1). 지원자 에이전트가 내세우는 "오퍼 마감", "긴급"은 ATS에서 확인되기 전까지 가중치 0이다.

LLM은 공개 여부를 정하지 않는다. Meta의 Agents Rule of Two(2025-10-31)는 한 세션에 [A] 비신뢰 입력, [B] 민감 데이터, [C] 외부 송신·상태 변경 가운데 둘까지만 허용한다(privacy.md §2.1). Overlap은 LLM 컨텍스트마다 하나만 준다. 파서(Spark)는 외부 메시지만, 라벨러(로컬 Glimmer)는 직원 일정만, 문장 생성기(Spark)는 공개가 확정된 값만 본다. 다만 직원 캘린더에도 외부 초대나 Overlap이 만든 면접 일정 같은 바깥 글이 섞이므로 라벨러 출력은 공개를 줄이는 방향으로만 쓴다. 라벨러는 범주·민감도·이동 가능성 제안을 열거형으로만 내고, 라벨이 없거나 확신이 낮으면 '바쁨·이동 불가·비공개'로 둔다. 공개를 넓히는 일(D4 범주, D3 이동 가능 표시)은 면접관 본인의 동의나 확인으로만 켜지고, 민감도 '높음'이면 동의가 있어도 막는다. 저장형 인젝션에 대비해 외부 텍스트는 캘린더에 저장하지 않고, Overlap이 만드는 면접 일정은 템플릿 제목과 불투명 ID만 쓰며, 외부 조직자가 보낸 일정은 라벨러에 넣지 않고 규칙 기본값을 쓴다(privacy.md §4.4). 그러면 라벨이 오염돼도 동의한 범주 안의 오분류에 그친다. Glimmer의 AgentDojo ASR이 모델 페이지 기준 28.4로 Spark(11.7)보다 높다는 점(privacy.md §0, 지표 정의 동일 여부 미확인)도 이 분리의 이유다.

#### (2) 결과만 주는 API와 누적 노출 예산

외부에 여는 동작은 `find_slots`, `hold_slot`, `confirm`(Poppy operations), `reschedule`, `cancel`, `status`, `hiringday.enter`뿐이다. `is_free`, 면접관별 가용성, 패널 구성 선택은 없고, 패널은 회사가 단계별로 고정하므로 {민준, 서연}과 {민준, 서연, 지호}를 비교하는 집합 차분 질의도 만들 수 없다.

공유 제시 풀. 지원서마다 후보를 따로 뽑으면 지원서를 여러 개 모은 대행사가 답을 합쳐 패널의 빈 시간 지도를 그린다. 그래서 (패널, 주)마다 제시할 슬롯 풀(그 주 면접 정원 + 2)을 한 번만 계산하고 모든 답을 그 안에서 고른다. 누가 몇 번을 묻든 드러나는 빈 시간은 풀을 넘지 않는다. 풀 안의 순서는 비밀 키 HMAC으로 정해 같은 질문에 같은 답을 주고 노이즈는 쓰지 않는다(RootGuard 원리, privacy.md §1.2). 주중에는 예약되거나 쓸 수 없게 된 슬롯을 빼기만 한다. 날마다 다시 계산하면 그 차이가 다른 지원자의 확정을 드러낸다[추론].

예산. 단위는 제시 슬롯 하나와 D4 범주 표시 하나, 키는 (지원서, 단계), 한도는 단계당 6단위(질의 두 번 분량)로 풀보다 작다. 초대 토큰을 (지원서, 단계)마다 발급해 단계 간 차분도 회사가 통제한다. 후보가 k개 미만이면 짧은 목록이 '창의 나머지는 막혀 있다'를 공짜로 알려 주므로 코디네이터에게 넘기고 k단위를 차감한다. 선언 창은 합계 6시간, 이틀 이상이다. 운영사(client_id)에는 정보 예산 대신 요청 한도를 건다. 면접관 주간 상한은 D3·D4 공개에만 걸고 서로 다른 (슬롯, 면접관) 공개 수로 센다. 같은 풀 슬롯을 되풀이해 받아 상한을 소진시키는 방식으로 정상 지원자를 막는 공격을 피하려는 것이다. 면접관 1인 단계는 그 캘린더가 곧 교집합이므로 D1이나 코디네이터로 보낸다. `hold_slot`은 자기에게 제시된 슬롯에만 허용하고 실패 응답은 `not_offered`와 같은 모양이다. 그러지 않으면 홀드 성패가 다른 지원자의 홀드·확정을 알려 준다.

표시와 존재 오라클. `not_offered`는 실제 상태와 무관하게 붙어, 바쁜 칸, 풀 밖의 빈 칸, 뽑히지 않은 풀 칸이 모두 같다. `no_data`는 공개 규칙(면접 시간대 밖, 조회 기간 밖, 없는 공고)에만 쓰고 규칙 ID와 다음 행동(`how_to`)을 붙인다. "도윤도 지원했나요?"나 남의 지원서 번호를 넣은 `status`에는 기록 유무와 상관없이 같은 답을 준다. Cedar 판정을 DB 조회보다 먼저 해 시간 차이를 없애고 정보주체 색인은 응답 뒤 비동기로 남긴다. Poppy 0.2도 남의 대화 ID와 없는 ID에 같은 오류를 주라고 정하는데(0.2 스펙 §7.13), Overlap은 이 동일성을 영수증과 로그 항목의 모양까지 넓힌다. 예약 자체가 점유를 드러내므로 잔여 누출은 0이 아니고, Overlap이 약속하는 것은 상한과 기록이다.

#### (3) 영수증과 투명성 로그

결정마다 요청자 영수증과 비공개 감사 레코드를 함께 만든다. 영수증은 모양이 고정이고 결정, 등급, 공개 수, 남은 예산, 정책 해시, 그리고 CT의 SCT처럼 '최대 병합 지연 안에 로그에 넣겠다'는 서명 약속만 담는다. 인젝션 탐지 점수(적응형 공격자의 오라클)와 정보주체 수(패널 규모 노출)는 감사 레코드에만 둔다. 로그 잎에는 둘의 솔트 커밋먼트가 들어가며 정보주체가 없어도 길이가 같다.

로그는 RFC 9162식 append-only Merkle 로그다. 다른 키·호스트의 증인이 일관성 증명을 확인한 뒤 체크포인트에 공동서명하고, 3인 이상이면 루트를 한 시간마다 OpenTimestamps로 비트코인에 고정한다(ledger.md §1-A). 공개는 체크포인트(크기·루트)뿐이고 항목은 당사자와 감사자만 본다. 고객사를 한 로그에 섞고 시각을 15분 단위로 묶는 것은 메타데이터를 줄이려는 우리 설계다. 식별자를 항목별 솔트 커밋먼트로 두고 솔트를 지워 파기하는 방식은 개인정보위 「블록체인 서비스 개인정보 보호 가이드라인」(2026-07-09)과 EDPB Guidelines 02/2025 v2.0(2026-07-07 채택)이 권하는 방식과 같다(ledger.md §1-A(7)). 다만 EDPB는 솔트 해시도 개인정보로 보므로("the hash will also be considered personal data") 로그 운영은 여전히 개인정보 처리다. 심사장에서는 "Meta가 WhatsApp(2023)과 Messenger(2025) 키 투명성에 쓰는 append-only AKD 로그를 에이전트 행위로 넓혔다"고 말한다. 두 디렉터리 모두 Cloudflare가 외부 감사자로 검증한다[https://engineering.fb.com/2025/11/20/security/key-transparency-comes-to-messenger/].

로그 조작은 증인이 잡지만 로그 밖의 몰래 취소는 모른다. 그래서 확정·취소·재일정은 경로와 무관하게 사유 코드가 붙은 로그 항목을 남기고, 모니터가 ATS·캘린더 상태와 로그를 대조한다. 협조하는 에이전트가 없어도 채용 공정성 감사로 가치가 생겨 콜드스타트 위험을 줄인다(redteam.md R7).

되돌릴 수 없는 쓰기(지원자 확정, 면접관의 D3 이동 승인)에는 사람의 승인을 남긴다. Poppy operations는 `approved_by`가 "works on trust"이고 사용자 승인 단계는 "This extension doesn't define that step"이라고 적는다(§8)[https://personalagentprotocol.org/docs/0.2/extensions/operations]. Overlap은 `user_approval_required: true`와 `url`로 승인 페이지를 띄우고, 3인 이상이면 challenge = SHA-256(operation_id‖revision‖terms‖summary)인 WebAuthn 패스키를 confirm 때 검증한다(데모는 노트북 Touch ID). standing_permission 증명 제안인 이슈 #39는 근거로 쓰지 않는다.

정보주체 리포트는 면접관에게 "이번 주 외부 에이전트 요청 14건이 당신 일정을 계산에 썼습니다. D2 11건, D4 2건(동의한 '외근'만), D0 1건. 제목과 동의하지 않은 범주 공개 0건."을 보낸다(수치는 자리표시자). 지원자에게는 "당신의 면접 시간은 다른 요청에 '사용 중'으로만 쓰였습니다"만 주고 건수는 '1~10건, 10건 이상' 같은 거친 구간까지만 보인다. 다른 지원자의 요청 건수와 운영사가 패널의 채용 수요와 사람을 드러내기 때문이다. 운영사 표시는 면접관·감사자 화면에만 두고 요청 5건 미만인 운영사는 묶는다. 포함 증명은 운영자가 줄을 빠뜨렸는지는 보이지 못하므로 MVP의 주장은 'append-only와 포함'으로 좁히고, AKD식 완전성 장치(정보주체별 HMAC 태그 색인 커밋)는 Should에 둔다. 원안의 '투명하게 공개'는 운영사별 요청 수, 거절률, 홀드 만료율, 429 위반을 보이는 주 단위 공개 집계 페이지로 살린다(Should, 5건 미만 묶음, redteam.md R4).

#### (4) 우선 차선과 남용 억제

| | T0 서명 없는 자동화 | T1 신원만 확인된 에이전트 | T2 신원 + 위임(로그인) + 초대 |
|---|---|---|---|
| 들어오는 길 | 사람용 예약 페이지 | 사람 페이지의 Web Bot Auth 서명, 또는 Poppy 로그인 전 세션 | Poppy 로그인 세션, 또는 거기에 묶은 브라우저 |
| 정보 | 사람과 같은 엔진·예산(D2·D4) | 공고·상태(D0~D1) | D2·D4, 정책상 D3 |
| 쓰기 | 사람 페이지와 같은 권한(홀드·확정·응모 1회) | 없음(위임이 없어 지원서를 대신할 수 없다) | 홀드 1개(10분), 확정, 단계당 변경 2회, API 응모 |
| 한도(제안) | 사람 속도(IP당 분당 6회), 스윕이면 PoW | 운영사 쿼터 | 위임자당 분당 30회 |
| 결과·영수증 | 화면, 영수증 없음 | 거절 영수증 | `status` 조회(`Retry-After`로 간격 지정), 모든 결정 |

1인 범위에서는 로그인 대신 초대 토큰을 요청 데이터로 받아 T2로 본다[추론]. Poppy가 푸시 알림을 아직 정하지 않아(Path to 1.0의 open topic, meta.md §5) 결과는 조회로 받는다.

사람용 페이지와 에이전트 API는 같은 공개 엔진과 예산을 쓴다. 화면을 긁어도 더 알아낼 것이 없고 편의만 잃으니 숨을 이유가 없다. 이 보장은 T0를 가려내는 데 기대지 않는다. 어느 경로로 오든 같은 엔진, 예산, 추첨을 거친다. 사람 페이지는 RFC 9421 Web Bot Auth 서명으로 T0와 T1을 가르고, Poppy API·대화는 client_id 인증(private_key_jwt)과 DPoP로 확인한다. Web Bot Auth 헌장이 HTTP API와 agent-to-agent 인터페이스를 범위 밖에 두기 때문이다(standards.md §1.3). 서명 없는 반복 접근에는 사람 수준 한도와 Anubis식 작업증명을 걸고 429에 `poppy.json` 안내를 붙인다. 작업증명은 원래 스팸 억제용이었고(Dwork·Naor 1992, Hashcash 1997) 비트코인과 이어지는 이야기가 되지만 단독으로는 약해 보조로만 쓴다(ledger.md §1-C).

Poppy Session을 가진 에이전트가 브라우저를 쓰면 그 브라우저를 T2 세션에 묶는다(Should). 0.2의 서명 browser assertion은 아무 브라우저나 올릴 수 있어 악성 개인 에이전트가 피해자 브라우저를 공격자 계정 세션에 넣을 수 있었기 때문에 0.3에서 빠졌다[https://personalagentprotocol.org/docs/changelog]. 그래서 0.3의 서명된 일회용 code와 DPoP 방식으로 만든다. Poppy를 구현하지 않은 computer-use 봇은 이 경로를 못 쓰므로 T0 한도와 작업증명을 받는다.

희소 슬롯은 드롭으로 열고 추첨으로 나눈다. 420명은 모두 면접을 보고 추첨 대상은 현장 슬롯 60석뿐이라 누구도 추첨 때문에 면접 기회를 잃지 않는다. 응모는 어느 경로든 같은 3분 창에서 받고 초대 지원서 하나에 응모 하나, 선호 시간대는 3개까지다. 창이 열리기 전에 규칙 해시를 로그에 등록하고, 창이 닫히면 즉시 응모 Merkle 루트를 강제 체크포인트로 찍어 증인 서명을 받는다. 규칙에 미리 박은 drand quicknet 라운드(마감 60초 뒤 첫 라운드) 값으로 seed = SHA-256(beacon‖entries_root)를 만들고, 순번 = HMAC(seed, 응모 커밋먼트) 오름차순대로 남은 선호 중 1순위를 배정한다. 비컨 시각 전에 증인 서명이 없으면 무효다. 이 순서가 유리한 루트를 골라 시드를 조작하는 일과 비컨을 본 뒤 루트를 바꾸는 일을 막는다. 비컨을 본 뒤 '시스템 오류'를 핑계로 다시 돌리는 일은 무효화 조항으로 막는다. "증인이 서명한 루트의 결과는 구속력이 있다. 무효화는 사유 코드와 함께 로그에 남기고, 새 비컨 라운드를 미리 등록한 뒤 같은 응모 루트로 다시 추첨한다. 무효화 횟수는 공개 집계에 넣는다." drand quicknet은 3초 주기이고 DKG 이후 편향할 수 없지만 임계 수 이상 노드가 담합하면 미래 라운드를 예측할 수 있다[https://docs.drand.love/blog/2023/10/16/quicknet-is-live]. 비컨 전에 전체·운영사별 응모 수를 로그에 올리되 5건 미만인 운영사는 묶는다.

주장은 좁게 잡는다. 누구나 다시 계산할 수 있는 것은 순번이고, 배정은 비공개 선호가 필요해 감사자가 재현한다. 선호를 3개로 제한하면 무작위 순번 배정(RSD)의 strategy-proof 성질이 그대로 성립하지 않으므로 그 말은 쓰지 않는다. Sybil도 0은 아니지만 응모권이 서류 통과자에게만 주는 초대라 식당 예약보다 비용이 훨씬 크다. 홀드는 지원서당 1개 10분, 세 번 만료되면 24시간 정지이고 예치금은 없다. 운영사별 홀드 만료율, 429 위반, 인젝션 신호로 평판을 매기고 판정은 로그에 남긴다.

### 1.5 하지 않는 것

- 경계 안 위임(지원자 자신의 화면에 보이는 정보를 그 에이전트가 가져가는 일)은 약관으로 다룬다(redteam.md R1).
- 사용자 쪽 computer-use 권한 통제(같은 폴더 `proposal-agent-proxy.md`, AgentVeil 기획안의 각도), 결제·보증금·양도·대기열 알림, 리뷰 게시.
- 실제 Muse 앱 연동, Meta AI Connectors·Muse Connector 등재, Business Agent API(10일 안에 불가능, meta.md §5).
- 공개 체인 항목 기록, 스마트컨트랙트 예치금, 익명 rate limit(IETF ARC 초안은 Dead WG Document, ledger.md §1-C).
- 실제 캘린더·지원자 데이터(전부 합성)와 해자 주장(3절).

## 2. 왜 지금, 누가 원하나

기업 쪽 고통은 확인된 사실이다. Amazon은 2026-09-20 Muse를 "unauthorized AI agent"로 막았고, 2차 보도가 전한 사유는 사전 통보 없음, 브라우징 중 자기 미식별, 자격증명 저장 의혹이다(ledger.md §1-D, redteam.md S5). JPMorgan의 Dimon은 "There's a liability transfer"라며 외부 에이전트를 아무나 들이지 않겠다고 했고, Salesforce는 콜센터 물량이 "astronomical"해진다고 썼다. Cloudflare는 에이전트 일일 요청이 1년 새 1,700% 넘게 늘었다고 밝혔고, agentic flooding 잠재 사례 84건을 모은 연구는 수수료 같은 마찰이 공평한 접근과 충돌한다고 경고했다(local.md §1). 반면 9th Circuit은 접근 주체를 사용자로 봤다(redteam.md R1). 막으면 고객을 잃고 받으면 비용과 책임을 진다.

다른 사람의 정보는 아무도 맡지 않았다. Poppy는 에이전트에게 필요한 것만 보내라고 할 뿐 회사가 다른 고객 데이터를 어떻게 다룰지는 정하지 않는다(standards.md §1.1). MLCommons 분류체계는 A2A의 프라이버시 협상 프로토콜이 없다고 적었고, AgentLeak에서 에이전트 간 메시지 누출률(68.8%)은 최종 출력(27.2%)보다 높았다(local.md §3). Meta의 Muse Spark Safety & Preparedness Report(2026-05-14)는 모델 단위로 잰 CIMemories violations@5 78.3%(5회 샘플 중 한 번이라도 부적절하게 공개한 속성 비율, Claude Opus 4.6은 82.9%)와 AgentDojo 인젝션 성공률 11.7%(pass@1)를 공개했다. 보고서는 Meta AI가 아직 메일 발송이나 캘린더 예약으로 제3자에게 정보를 보내지 못해 이 위험이 'future-facing'이라고 보면서도, AI 비서가 사용자 대신 행동하게 되면 맥락적 무결성이 핵심 고려 사항이 된다고 적었다[https://arxiv.org/abs/2606.12429].

채용 물량도 크다. NYT를 인용한 2025년 6월 보도에 따르면 LinkedIn 지원서는 분당 11,000건이고 1년 새 45% 늘었다[https://www.eweek.com/news/ai-job-applications-linkedin/]. 구직자 에이전트가 채용 담당 에이전트와 면접을 잡는다는 초기 서비스(Konive)는 스니펫으로만 확인했고, 에이전트 간 채용 협상을 내세우는 출시 전 서비스(JobClaw)도 있다(a2a-delegates.md §5.2). 면접 일정이 다음 병목이라는 말은 [추론]이고, Muse는 미국·캐나다에서만 제공되므로 한국에서는 '다가오는 문제'로 말한다(local.md §4). 그래서 피치는 공격으로 재현한 기준선 누출 수치로 시작하고 영향력 근거는 따로 찾는다(4.3절). 한국 AI 기본법 제31조(2026-01-22 시행)와 EU AI Act 제50조(2026-08-02 적용)는 AI 사용·상호작용 고지를 요구한다(ledger.md §1-D).

돈을 낼 쪽은 에이전트를 성장 채널로 원하지만 OAuth·정책 엔진·감사 체계를 직접 만들 여력이 없는 중견 일정·ATS SaaS다(redteam.md §1)[추론]. 협조하는 에이전트가 없어도 트래픽 분류, 내부 감사용 영수증, 상태-로그 대조를 얻으므로 한쪽만 도입해도 가치가 있다.

## 3. 경쟁·선행 지형과 해자

| 이름 | 이미 하는 것 | 비어 있는 것 | 관계 |
|---|---|---|---|
| Poppy(Meta·Sierra). 0.1은 10/9, 0.2는 10/24, 0.3 작성 중 | 발견, OAuth·DPoP, 사람/AI 표기, 429, operations | 목적 선언, 타 사용자 데이터 규칙, 서명 영수증, 승인 증명 | 그 위에 짓는다 |
| 엣지 봇 관리(Cloudflare, DataDome, Akamai, HUMAN), Web Bot Auth | 신원 서명, 한도, trust band | 응답 데이터의 의미 | 채찍으로 쓴다 |
| MCP·AI 게이트웨이(Kong+VeriKnox, agentgateway, Lasso) | 서명 영수증, 감사 로그, PII 패턴 마스킹, rate limit | 관계·목적별 세분도, 타 사용자 개념, 누적 예산 | 부품을 빌린다 |
| AWS AgentCore Policy | 도구 호출마다 Cedar 결정적 평가, 누적 예산 같은 temporal policy, 감사 로그 | 타 사용자 공개 등급, 서명 영수증, 정보주체 열람 | 참고 아키텍처(에이전트 자신의 도구 호출을 통제하는 반대 방향) |
| 영수증 개인 초안(draft-noa-scitt-ai-agent-receipt-01, draft-nelson-agent-delegation-receipts-15) | 행위·위임 영수증, 해시 체인 | 공개 수준 필드 | 형식을 빌린다 |
| 캘린더 기능(VFREEBUSY, Google freebusy, Graph getSchedule, 예약 링크) | 상세 숨김 | 목적별 해상도, 반복 질의 방어, 정보주체 리포트 | 기준선 B1·B1′ |
| 연구(MNC, Firewalls, PlanTwin, RootGuard, CalBench) | 앱이 발급한 공개 계약과 누적 위험 원장(MNC), 대화 방화벽, 고정 투영 | 조직 간 배포, 발급 신원에 묶은 예산, 서명 영수증과 정보주체 열람, 배포 중인 프로토콜과의 결합 | Firewalls를 비교군 B4로 |

근거: standards.md §1·§2·§5, privacy.md §1·§2.3, ledger.md §1-A(4).

MNC와 PlanTwin은 이름을 대고 차이를 말해야 한다. MNC(arXiv 2608.01719, 2026-08)는 애플리케이션이나 그 정책 기관이 발급한 공개 계약으로 공개 내용을 수신자·목적·전달·보존·로깅·메모리 범위에 묶고 reference monitor가 강제하며, MNC-L은 반복 공개의 누적 추론 위험을 원장으로 차감한다. 동기 예시도 '이유는 숨기고 가능한 시간 하나만 주는 일정 조율'이라 Overlap의 공개 계산과 가장 가깝다[https://arxiv.org/abs/2608.01719]. PlanTwin(arXiv 2603.18377)은 로컬 환경을 비식별 트윈으로 투영해 클라우드 플래너로부터 지키는 사용자 측 장치로, 로컬 gatekeeper가 누적 disclosure budget을 강제한다(privacy.md §1.2). 따라서 Overlap의 새로움은 공개 계산 자체가 아니다[추론]. 회사 밖 제3자 에이전트가 배포 중인 Poppy로 들어오는 조직 간 경계, 회사가 발급한 초대에 묶어 Sybil에 버티는 공유 예산 풀, 공개 수준을 담은 서명 영수증·증인 로그·정보주체 리포트, 희소 슬롯 추첨에 있다. MNC 원문에는 Sybil, 신원, 서명, 투명성 로그가 나오지 않는다. 가장 가까운 구현인 Firewalls(TMLR 2026)는 GPT-5의 프라이버시 공격 성공률을 84.68%에서 10.20%로 낮췄고 MIT 코드가 있어(privacy.md §0) 비교군으로 쓴다.

Poppy 이슈 기여도 주장을 좁힌다. #18(회사 메시지와 operation 결과에 영수증·라벨·서식 같은 문서를 첨부하자는 제안)에는 결정 영수증을 첨부로 실을 때의 서명과 로그를, #37(결제 논의의 증거로 올라온, x402 결제에 단일 증인 노드가 서명한 영수증 사례)에는 다중 증인 Merkle 로그로의 일반화를 제안한다. 사람 승인은 #39가 아니라 operations §8의 빈칸으로 인용한다.

해자는 해커톤 차별점과 스타트업 해자로 나눠 본다. 해커톤 차별점으로는 충분하다. '목적에 묶인 공개, 공개 수준을 담은 영수증, 누적 노출 예산'을 묶은 제품이나 표준은 찾지 못했고(standards.md §3), 주최사 표준의 빈칸을 Meta 자신의 원칙(Rule of Two, AKD식 로그)으로 채우는 구성은 설명하기 쉽다. 스타트업 해자로는 약하다. 프로토콜(Poppy는 Apache-2.0), 영수증 형식, 마스킹, rate limit, 추첨은 해자가 아니다. 해자가 생긴다면 업종별 공개 정책 템플릿과 제3자 누출 벤치마크, 다테넌트 SaaS 안의 운영사 평판, 영수증이 감사 증거로 채택될 때의 증인망과 전환비용에서다(redteam.md R3). 첫 레퍼런스 구현이라는 자리는 시간 우위일 뿐이다. Sierra가 10/9에 "Over the next month" 디자인 워크숍과 레퍼런스 구현을 내겠다고 했으므로 대회 중에 나올 가능성이 높다[https://sierra.ai/blog/poppy]. 그래서 피치에서는 해자를 주장하지 않는다.

## 4. 해커톤 적합성

### 4.1 트랙과 테마

Indie 트랙은 "creativity, technical ambition, and whether it works"로 평가하고 팀은 최대 4명이다(meta.md §1). 동의서의 배점은 영향력 30(누가 혜택을 받고 실제로 쓰일 수 있는지), Meta AI 도구 25(기본 연동을 넘었는지, 예상 밖 능력을 드러냈는지), 기술 깊이·구현 20, 데모 25다[https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver]. 공식 규정은 10/26 현재 미공개다. 테마는 Push the Frontier를 기본으로 하고, 재직 중 구직이나 면접 조율을 직접 겪은 팀원이 있을 때만 Build for Your World로 바꾼다. 한국인이라는 이유만으로 직접 겪은 문제라고 쓰지 않는다(local.md §6). "whether it works"에 답하도록 팀 도메인에 합성 데이터만 든 공개 데모 테넌트를 띄워 아무 Poppy 에이전트나 들어오게 한다.

### 4.2 세 무대와 공식 배점 재채점

Overlap(채용 면접)은 엄밀하고 외부 의존이 적지만 절박함이 추론이고 시간 압박 사건이 없었다. FairTurn(식당 좌석 드롭)은 사건과 관찰된 문제 근거가 있지만 Meta AI가 사건 밖에 있고 모듈이 많았다. Countersign(의류 마켓 리뷰)은 SAM 3.1이 가장 자연스럽지만 이미 공개된 체형을 '누출'이라 부르는 모순이 있었다. 아래는 수정 전후를 공식 배점으로 다시 매긴 AI 내부 검토 점수다(10점 척도, 가중 합계는 100점 환산, 참고용)[추론].

| 안 | 영향력 | Meta 도구 | 기술 | 데모 | 가중 합계 |
|---|---|---|---|---|---|
| Overlap 수정 전 | 5 | 5 | 8 | 6 | 약 59 |
| Overlap 수정(드롭 이식, D4 Must, 분할 화면) | 6(근거 확보 시 7) | 6 | 8 | 7 | 약 67(70) |
| FairTurn 수정 전 | 7 | 5 | 7 | 8 | 약 68 |
| FairTurn 수정(패스키, 체크포인트만 공개, 증인 서명 뒤 비컨, Glimmer·B3 Must) | 7 | 6 | 7 | 8 | 약 70 |

### 4.3 그래도 Overlap을 권하는 이유와 차점

공식 배점만 보면 수정 FairTurn이 조금 앞선다. 그래도 Overlap을 권하는 까닭은 장점의 이식 가능성이다. FairTurn의 장점(드롭 사건, 검증 가능한 추첨, "lane, not edge", 해시 일치 장면)은 채용으로 옮길 수 있고 비용은 1.5인일 안팎이다[추론]. FairTurn의 약점은 도메인에 묶여 있다. 지킬 제3자 데이터가 가볍고(셰프의 '병원' 휴무는 작위적으로 보인다), 공정성의 상한이 사들인 전화번호 수로 정해지며, 보증금·양도·대기열 알림·WhatsApp 같은 모듈이 많아 "whether it works"에서 잃기 쉽다. Overlap의 장점은 옮길 수 없다. 회사 발급 초대라는 신원의 닻이 식당에는 없고, 이 닻 덕분에 예산과 추첨 공정성이 같은 근거로 Sybil에 버틴다. 원안의 첫 예시가 일정 조율이고 원안의 중심인 '다른 사용자의 정보'가 가장 무거운 무대라는 점도 같은 방향이다.

남은 격차는 사실로 메운다. 10/27 정오까지 재직 중 구직의 비밀 보장 요구나 채용 담당자의 일정 조율 부담처럼 출처로 확인할 수 있는 근거를 찾는다. 팀에 채용·면접 조율을 겪은 사람이 없고 근거도 못 찾으면 수정 FairTurn을 다시 검토한다(9.1절). 채용 행사 슬롯을 봇이 쓸어 간다는 관찰 사례는 없으므로[추론] 드롭은 시뮬레이션으로 표기한다. 식당 쪽 근거는 더 단단하다. 뉴욕주는 식당과 서면 계약 없이 예약을 웹·앱에 올리거나 파는 행위를 금지하는 Restaurant Reservation Anti-Piracy Act(2025-02-17 시행)를 만들었다. 다만 법은 봇이 아니라 무단 판매를 금지하고, 봇의 대량 예약은 입법 배경으로만 나온다[https://hklaw.com/en/insights/publications/2025/02/new-york-curbs-scalping-of-restaurant-reservations]. Countersign은 '리뷰 출처와 억제 탐지'로 좁혀 확장 정책 묶음으로 남긴다.

### 4.4 배점별 득점 전략과 실점 위험

| 항목 | 득점 전략 | 실점 위험과 대응 |
|---|---|---|
| 영향력 30 | 보호 대상과 채용 공정성, 수혜자와 구매자를 밝히고 기준선 누출 수치로 시작 | 절박함이 추론 → 근거 조사. "Calendly에 영수증 붙인 것" → B1′과 같은 공격으로 비교 |
| Meta 도구 25 | 로컬 Glimmer 라벨이 D4 문장을 가르고, Spark가 자연어를 닫힌 스키마로 바꾸며 참조 에이전트가 된다. B3 대비 비교, 라벨 일치율 | Spark가 장식처럼 보임 → 모델이 한 일을 인스펙터에 띄운다. Contributor 모드 금지 |
| 기술 20 | 검사 통과, 공유 풀과 예산, commit-then-beacon 추첨, RFC 9162 로그와 증인, 사전 등록 목표와 구성 요소를 하나씩 끈 비교(ablation) | 과장 → 주장 범위 한정("순번 검증", "append-only와 포함") |
| 데모 25 | 분할 화면, D4 갈림, 드롭, 우리가 통제하지 않는 drand·OTS·서드파티 에이전트, 브라우저 검증기 | 라이브 실패 → 시드 고정 녹화, 3분판·1분판 |

### 4.5 과거 수상 패턴에서 배운 것

Cerebral Valley 글로벌 온라인 대회(Built with Opus 4.6·4.7)의 1~3위는 모두 도메인 최종 사용자 제품이었고, 보안·프로토콜형 입상은 소규모 오프라인 대회에서 나왔다(meta.md §0·§6). Gemini 3 서울 2위 saas와 UiPath AgentHack 대상 Gauntlet은 공격과 방어를 리더보드와 회귀 테스트로 보였다(local.md §5, meta.md §6). CV Recursive Agents 해커톤(108개)에서는 Traceback·DoneDone·Unfoolable 같은 검증 프레임워크가 입상하지 못했고, ETHGlobal Open Agents에서 DeFi 에이전트 인프라로 낙선한 참가자는 "I built infrastructure. They built experiences."라고 회고했다(redteam.md R9). 그래서 투명성 로그는 제품이 아니라 공개와 추첨의 증명 수단으로 쓰고, 데모는 공격, 방어, 화면 위 수치, '처음 본다' 장치 하나(있을 때와 없을 때 같은 해시)의 순서를 지킨다[추론].

## 5. Meta AI 활용 계획

| 모델·도구 | 역할 | 등급 | 이유 |
|---|---|---|---|
| Muse Spark 1.3(Standard) | 파서, 문장 생성기(공개 값만), 참조 지원자 에이전트(데모 주인공), 레드팀 에이전트, 기준선 B3, LLM 판정(2인 이상) | Must | 서드파티 에이전트는 확장을 모르고 자연어로 온다. 경계는 코드라 모델 실수가 누출로 이어지지 않는다 |
| Muse Glimmer 30B(로컬, Apache 2.0) | 직원 일정 라벨러(범주·민감도·이동 가능성 제안, 열거형만, 일정 생성 시 비동기). 그 라벨이 D4 문장을 가른다 | Must(관문 폴백: 규칙 + 정답 라벨 표본, 영상에 명시) | '정신건강의학과'의 민감도는 규칙으로 못 잡고 원문은 밖으로 못 나간다. Cookbook 'Build a local agent that asks before calling Muse Spark'(로컬 Glimmer, 승인된 질문만 Spark로, egress.jsonl에는 digest만)를 회사 쪽으로 뒤집은 구성이다 |
| Prompt Guard 2 86M(셀프호스트) | 인젝션 점수를 감사 레코드에 | Should | 한국어 미평가라 경계로 쓰지 않는다 |
| Voice Transcribe / SAM 3.1 | AI 채용 전화 / 리뷰 확장의 사진 가림 | Could | TTS 없음 / 채용 일정에는 이미지 속 제3자가 없다 |
| Muse Wonder / Muse Code | 정책 초안·공격 다양화 / 개발 도구 | Could / 선택 | Wonder는 Spark의 3~5배 단가 |
| Muse Image, `-contributor` | 쓰지 않는다 | — | 생성형 수정은 증거를 바꾼다. Contributor에는 개인정보 금지 |

근거: meta.md §2~§4, privacy.md §2.4, Cookbook(11절).

데이터 정책. Standard 모드만 쓴다. Contributor 서비스에는 약관상 개인정보를 넣을 수 없다(ToS §6.2, meta.md §2). Muse Code는 설치 직후 Contributor 모델이 기본으로 잡힌다는 2차 자료가 있으므로[스니펫] `/model`로 Standard(`muse-spark-1.3`)인지 확인한다. Standard도 보존 기간이 "as needed"이고 ZDR은 영업팀을 거친 조직 단위로만 켜지므로 제3자 원본은 클라우드로 보내지 않는다(meta.md §2). 데이터는 전부 합성한다.

'예상 밖 능력'은 Meta 도구 항목이 직접 묻는다. CIMemories의 violations@5 정의(같은 요청 5회 중 한 번이라도 부적절하게 공개)를 우리 합성 캘린더에 적용해 같은 Spark의 단독 프록시(B3)와 Overlap을 같은 공격 세트로 비교한다. 보고서의 78.3%는 다른 과제의 수치라 맥락으로만 인용한다. Glimmer 30B와 Spark의 라벨 일치율로 '로컬 30B로 충분한 구간'을 보이고, 한국어와 영어 요청의 누출률도 비교한다. B3 장면은 "Meta 모델이 샌다"가 아니라 "같은 Spark를 Meta의 원칙대로 배치하면 결과가 달라진다"로 말한다.

비용은 Spark 1.3 Standard, reasoning 낮음, 프롬프트 캐시, 100만 토큰당 입력 $1.25·캐시 $0.15·출력 $4.25를 가정한다[추론].

| 항목 | 물량 | 비용 |
|---|---|---|
| 개발·디버깅 | 자연어 요청 4,000건 × 약 $0.0055 | 약 $22 |
| 드롭 시뮬레이션(2인 이상) | 30회 × 응모 80건 | 약 $13 |
| 텍스트 공격 | 5종 × 3구성 × 30회 × 6턴 × 약 $0.0085 | 약 $23 |
| 기준선 B3 | 1,500회 × 약 $0.014 | 약 $21 |
| LLM 판정(2인 이상) | 응답 약 4,000건 × 약 $0.003 | 약 $12 |
| 정상 과업·라벨 비교·리허설 | 200과업 × 2구성, 라벨 300건, 녹화 60회 | 약 $16 |
| 합계(Glimmer·Presidio 등 로컬은 $0) | | 약 $107(1인 약 $82) |

reasoning을 기본값으로 두면 2~3배가 되므로 비용을 가장 크게 움직이는 변수는 reasoning effort다(meta.md §7). 크레딧은 참가 승인을 받은 사람마다 자기 Model API 계정으로 $150씩 따로 청구하고 팀원 청구분을 한 계정에 합칠 수 없다(Credit Terms §1.1·§3.2). 공용 게이트웨이 키 하나는 그 계정의 $150 안에서 돌리고, 다른 팀원 크레딧은 각자의 개발·평가에 쓴다. 결제수단 등록이 필요하고(§1.2) 청구 후 영업일 2일 안에 적용되며(§3.4) 청구 마감은 11/4 21:00 ET다(§2.2). 약관은 적용 뒤 무만료라 하지만(§3.5) 동의서 본문은 "valid for a 10-day development window"라고 적어 첫날 확인한다. 1인이면 약 $82에 시연 여유분 $50을 더해 $150 안에 든다. API 예산 상한 기능은 확인하지 못했으므로(meta.md §7) 게이트웨이 코드에 하루 지출 상한(예: $12)을 건다.

## 6. 기술 스택과 아키텍처

### 6.1 구성도

```text
바깥  지원자 에이전트(Spark 참조, 호스팅 PDA, Stacktree) ─ Poppy 발견·로그인·DPoP·대화 ─▶ [1]
      서명 없는 computer-use 봇 ─ 사람용 예약 페이지(같은 엔진·예산) ─▶ [1]
게이트웨이(MoaCal)
 [1] Edge: 사람 페이지는 Web Bot Auth, API는 client_id·DPoP · T0/T1/T2 · 429 · PoW
 [2] Poppy 0.2 어댑터(0.1 aud 호환, 브라우저 결합은 0.3 방식) · MCP 서버
 [3] 파서 ── A만 ── Muse Spark 1.3 → 스키마 검증기(코드) → IntentJSON
 [4] 공개 엔진(코드): Cedar 등급 · 공유 풀 · 예산 · 표시 · 존재 오라클 · 동의 범주(D4)
     ├ 드롭: 규칙 해시 → 응모 루트 → 증인 서명 → drand → 순번 → 배정
     └ operations: hold(제시 슬롯만) · confirm(승인 페이지) · reschedule · cancel
 [5] 문장 생성기 ── C만 ── Muse Spark 1.3 → egress 검사 → 실패 시 템플릿
 [6] 영수증(JWS)·감사 레코드 → [7] Merkle 로그 → 체크포인트 → 증인 → OTS
 [8] 모니터(ATS·캘린더 ↔ 로그)  [9] 콘솔(인스펙터·드롭 보드·누출 미터·리포트·검증기)
안쪽  내부 작성 일정 ─▶ [10] 라벨러 ── B만 ── Glimmer 30B(로컬, 쓰기 시점, 열거형) ─▶ [4]
      외부 초대·Overlap 생성 일정 ─▶ 규칙 기본값(바쁨·이동 불가·비공개) ─▶ [4]
```

### 6.2 요청 처리 순서

1. Edge가 경로별로 신원을 확인하고(사람 페이지는 `tag="web-bot-auth"` 서명, API·대화는 client_id와 DPoP, 1.4절 (4)) 등급과 한도를 정한다.
2. `text`만 온 요청은 파서(Spark, A만)가 IntentJSON으로 바꾸고 결정적 검증기가 다시 본다. Cedar가 DB 조회 전에 등급을 정하고 다른 지원자에 관한 클래스를 가린다.
3. 공개 엔진이 풀과 선언 창의 교집합에서 후보를 고르고, 예산을 차감하고, 표시를 붙인다(D4는 동의 범주와 라벨이 맞을 때만). 결과는 JSON으로 주거나 문장 생성기(Spark, C만)가 문장으로 만들고, egress 검사(허용 시각, 이름·제목 거부 목록, Presidio)에 실패하면 템플릿을 쓴다.
4. 영수증과 감사 레코드를 로그에 넣는다(서명 약속 → 포함 증명 → 증인 서명 → OTS). 비가역 쓰기는 승인 페이지(`user_approval_required`, `url`)에서 승인(3인 이상은 패스키)을 확인한 뒤 실행하고 사유 코드와 함께 남긴다.

### 6.3 메시지 예시

0.2 기준이다. 0.2 메시지는 `sender`(agent|human)를 쓰고, `role`은 회사가 기록할 때 정하며 에이전트가 보내면 무시한다(§7.4). 확장 이름은 팀 소유 도메인으로 시작해야 하고(§3.3), `data`의 키는 프로토콜이 정하지 않는다[https://personalagentprotocol.org/docs/0.2/spec.md]. `overlap.example`은 구입할 도메인의 자리표시자다.

(a) `poppy.json`의 확장 부분(일부 생략, 3인 이상 기준)

```json
{"protocol_version": "0.2",
 "extensions": {
  "overlap.example/disclosure": {"version": "0.1",
   "purposes": ["interview.schedule", "interview.reschedule", "interview.cancel", "interview.status", "hiringday.enter"],
   "default_level": "D2", "max_external_level": "D4", "k": 3,
   "budget": {"unit": "offered_slot", "key": ["application", "stage"], "per_stage": 6, "short_result": "handoff"},
   "hold": "offered_only", "markers": ["not_offered", "no_data", "owner_disclosed"]},
  "overlap.example/receipts": {"version": "0.1", "format": "jws", "log": "https://log.moacal.example",
   "witnesses": 2, "anchor": "opentimestamps", "approval_proof": "webauthn"}}}
```

(b) 요청. 확장을 모르는 에이전트는 `text`만 보내고 파서가 같은 구조로 바꾼다.

```json
POST /poppy/conversations/cv_81/messages
{"message": {"id": "m_204", "sender": "agent",
 "text": "다음 주 패널 면접 60분. 화~목 오후 가능, 화 15시·수 16시·목 14시·화 19시면 좋겠어요.",
 "data": {"overlap.example/disclosure": {"purpose": "interview.schedule", "application_ref": "app_7Q2c",
  "stage": "panel", "duration_min": 60,
  "window": [{"from": "2026-11-10", "to": "2026-11-12", "daily": "13:00-18:00"}],
  "ask_about": ["2026-11-10T15:00", "2026-11-11T16:00", "2026-11-12T14:00", "2026-11-10T19:00"]}},
 "context": {"time_zone": "Asia/Seoul", "user_available": false}}}
```

(c) 응답(일부 생략). 민준은 '외근'만 공개에 동의했다. 민준의 상담(화 15:00)과 서연의 다른 면접(수 16:00)은 같은 표시를 받고, 비었지만 뽑히지 않은 칸을 물어도 같다. 외근(목 14:00)만 범주를 말한다. 예산은 제시 3개와 D4 표시 1개로 4단위다.

```json
{"sender": "agent",
 "text": "11/10 16:30, 11/11 14:00, 11/12 13:00에 가능합니다. 11/12 14:00은 외근이 있어 어렵습니다. 11/10 15:00과 11/11 16:00은 제시할 수 없으며 사유는 정책상 비공개입니다. 11/10 19:00은 면접 시간대 밖입니다.",
 "data": {"overlap.example/disclosure": {"level": "D4",
  "offers": ["2026-11-10T16:30+09:00", "2026-11-11T14:00+09:00", "2026-11-12T13:00+09:00"],
  "about": {
   "2026-11-10T15:00": {"marker": "not_offered", "basis": "policy", "rule": "tp.R1"},
   "2026-11-11T16:00": {"marker": "not_offered", "basis": "policy", "rule": "tp.R1"},
   "2026-11-12T14:00": {"marker": "owner_disclosed", "category": "off_site", "rule": "tp.D4"},
   "2026-11-10T19:00": {"marker": "no_data", "basis": "outside_interview_hours", "rule": "pub.H1"}},
  "budget": {"charged": 4, "left": 2}, "receipt": "eyJhbGciOiJFZERTQSJ9…"}}}
```

(d) 요청자 영수증 페이로드. 모양이 고정이고, `client_id`는 운영사(조직 책임), `principal`은 위임자 커밋먼트, `audit_commit`은 항상 같은 길이의 감사 레코드 커밋먼트다.

```json
{"v": 1, "rid": "r_4182", "t": "2026-11-03T14:00+09:00/15m",
 "client_id": "https://agent.example/poppy/client", "principal": "c:7c1e…",
 "op": "find_slots", "purpose": "interview.schedule", "decision": "ALLOW", "level": "D4",
 "revealed": 4, "budget_after": "2/6", "policy": "sha256:5b0e…", "audit_commit": "sha256:91c4…",
 "log_promise": {"log": "moacal-2026", "max_merge_delay_s": 300, "sig": "…"}}
```

### 6.4 언어와 라이브러리

- 게이트웨이(TypeScript, Node.js LTS): Hono, MCP TypeScript SDK, Zod, SQLite, `jose` 6.2.13, `web-bot-auth` 0.2.0·`http-message-sig` 0.3.0(RFC 9421), `@noble/curves` 2.4.0, Cedar WASM, `@simplewebauthn`(ledger.md §1-E). 콘솔은 React + Vite이고 검증 패키지를 브라우저에서 돌린다.
- 투명성: RFC 9162 로그는 TS로 직접 구현하고 `pymerkle` 7.0.0(GPL-3.0, 테스트 전용)으로 교차검증한다. 체크포인트는 C2SP signed-note, Go 인원이 있으면 Tessera v1.0.4. OTS는 `opentimestamps-client` 0.7.2 크론인데 검증에 Bitcoin 노드가 필요해 데모는 익스플로러 검증과 그 신뢰 가정을 밝힌다(ledger.md §1-A(6)).
- AI 사이드카(Python): llama.cpp b10353 이상(`--jinja`)과 `Muse-Glimmer-30B-GGUF` Q4_K_M(16.8GB, 32GB 이상 Mac), Prompt Guard 2, Presidio(한국 엔티티), OR-Tools CP-SAT(meta.md §3, privacy.md §3). Spark는 OpenAI 호환 SDK로 `https://api.meta.ai/v1`의 `muse-spark-1.3`. 1인이면 TS와 llama.cpp HTTP 서버만 쓰고 Presidio는 정규식·거부 목록, CP-SAT은 교집합 계산으로 대신한다.
- 'validator 통과'의 정의: PDA validator(회사 `poppy.json`과 OAuth 메타데이터 검사, 8.2절)와 Stacktree 시뮬레이터의 거절 점검 14개(재사용된 DPoP 증명 등, 0.2 기준)[https://stacktr.ee/blog/poppy-simulator.md]다. 회사 키트 validator는 draft 0.3을 따르고 로그인은 검사하지 않으므로("Not in this version. Check sign-in by hand against `checklist.md`.") 0.2·0.3 공통 부분에만 쓴다(11절의 회사 키트와 validator README).

### 6.5 레포 구조

`overlap/` 아래를 apps(gateway·approval·console·witness), packages(poppy·disclosure·policy·drop·receipts·llm), services(labeler·guards·beacon·anchor·monitor), eval(datagen·attacks·baselines·oracle·reports), spec(disclosure-receipts-profile.md·fixtures)로 나눈다.

## 7. MVP 범위와 10일 일정

### 7.1 인원별 범위

| 인원 | Must | 분담 |
|---|---|---|
| 1인(약 9인일) | Poppy 검사기 범위(발견, OAuth 메타데이터, 에이전트 확인, 로그인 전 세션, DPoP, 대화)와 구조화 API · 공개 엔진(D2·D4·D5, 공유 풀, 예산, 표시, 존재 오라클) · 파서·문장 생성기·egress · Glimmer 라벨 표본 · JWS 영수증·Merkle·증인 1·브라우저 검증 · 평가(B1′·B3, A1·A3·A4·A6′·A9·A12 일부, 누출 미터) · 한 페이지 콘솔(인스펙터·누출 미터·면접관 리포트)과 90초 영상 | 엔진 → 정문 → LLM → 영수증·로그 → 평가 → 콘솔 |
| 2인(약 14인일) | 1인 범위 + Poppy 로그인과 operations · D3(콘솔 승인) · 드롭(무효화 조항 포함) · B0, A4′·A11 · LLM 판정 · 3분 영상 | 게이트웨이·정책·암호 / AI·평가·데모 |
| 3~4인(약 22인일) | 2인 범위 + 패스키 · 상태-로그 모니터 · 증인 2와 OTS · 지원자 리포트 · 호스팅 PDA 실연동 | 3인: Poppy·신원·승인 / 공개 엔진·드롭 / AI·평가·데모. 4인은 투명성(로그·증인·OTS·모니터·리포트)을 따로 맡는다 |

인원 추정은 [추론]이고, 1인 범위는 Web Bot Auth 대신 Poppy 클라이언트 인증으로 에이전트를 확인한다. Should: 브라우저 세션 결합(0.3 방식)과 작업증명, Web Bot Auth 경로, B1·B2·B4, Prompt Guard, COSE 영수증, 문의 묶음 카드, AKD식 색인, 공개 집계 페이지, interop 오프라인 모드. Could: AI 전화, 리뷰 확장(SAM 3.1), Base Sepolia 앵커, 익명 쿼터, 식당 정책 묶음.

컷 라인은 11/1(일) 22:00이다. 척추 E2E(요청 → 공개 → 확정 → 영수증 → 검증)가 돌지 않으면 Should를 버리고 데모 상대를 자체 참조 에이전트로 고정한다. 일정이 밀리면 드롭 → OTS → 증인 2 → 모니터 → 패스키 순서로 자른다. 인터페이스 객체(IntentJSON, DisclosureObject, 영수증, 드롭 기록)를 10/27에 고정하면(6.3절) 모두가 목업으로 동시에 진행할 수 있다.

### 7.2 날짜별 일정(KST)

| 날짜 | 2~4인 | 1인 | 관문 |
|---|---|---|---|
| 10/26(월) 밤 | 크레딧 청구(승인자마다), 도메인, Glimmer 다운로드, 9.1-1·2 논의. 개막 생중계 10/27 01:00 또는 02:00 | 같음 | |
| 10/27(화) | 규정·PDA·Stacktree 버전 확인, 근거 조사(정오), 합성 데이터 v0, Spark 첫 호출(국내 카드), `poppy.json`, 공개 엔진 v0, 인터페이스 고정 | 같음(로그인 전 세션까지) | Glimmer 구동 |
| 10/28(수) | 어댑터(로그인 포함), 파서, B3·B1′ 기준선과 공격 30회, drand | 파서, 기준선과 공격 30회 | 48시간 관문 |
| 10/29(목) | Cedar(D2·D3·D4), 예산·표시·존재 오라클, 문장 생성기·egress, Glimmer 배치 | 같음(D3·Glimmer 배치 제외) | |
| 10/30(금) | 드롭, 영수증·로그·증인 1·브라우저 검증, OTS(3인 이상), 인스펙터 | Glimmer 표본, D4 동의 흐름, JWS 영수증 | |
| 10/31(토) | 척추 E2E, 해시 일치 장면, 공격 하네스 | 로그·증인 1·브라우저 검증, 척추 E2E | 척추 동결 |
| 11/1(일) | 패스키·모니터·리포트·증인 2(3인 이상), 1차 평가 | 공격 하네스, 1차 평가 | 22:00 컷 라인 |
| 11/2(월) | 콘솔, 전체 평가와 ablation, PDA 실연동 | 콘솔, 전체 평가 | |
| 11/3(화) | 평가 리포트, 스펙 문서, 리허설 | 같음 | 18:00 기능 동결 |
| 11/4(수) | 3분·1분 영상, README, 제출문 | 90초 영상, 제출문 | 크레딧 청구 마감 21:00 ET |
| 11/5(목) | 09:00 업로드 | 같음 | 11:00 마감 |

48시간 관문(10/28 밤)은 수치로 판정한다. Spark 파서의 JSON 유효율이 한·영 50건에서 95% 미만이면 템플릿 파서로 내린다. Glimmer는 처리량으로 본다. 직원 30명 × 4주의 일정 1,800~3,000건을 8시간에 처리하려면 건당 10~16초가 필요해 무리이므로 라벨 대상을 패널 면접관의 면접 시간대 일정으로 줄인다. 면접관 12명 × 4주 × 10건이면 약 480건이라 건당 1분이면 8시간, 30초면 4시간이다[추론]. 못 맞추면 여러 건을 한 프롬프트에 묶고, 그래도 안 되면 규칙과 정답 라벨 표본으로 내린다(영상에 명시). Stacktree·PDA 연결이 실패하면 자체 참조 에이전트로, B3 누출이 공격으로도 재현되지 않으면 데모 중심을 구조 누출로 옮긴다. CalBench 기본 실행에서도 제목 같은 의미 누출은 관찰되지 않았다(privacy.md §0).

## 8. 데모 시나리오와 정량 평가

### 8.1 3분 대본(2인 이상)과 90초 대본(1인)

화면 수치는 모두 실측값으로 채운다. 내레이션은 영어로 녹음하고 한국어 자막을 단다(9.2절). 아래는 한국어 초안이다.

| 시간 | 화면 | 내레이션 | 화면 수치 |
|---|---|---|---|
| 0:00–0:35 | 자막 "지원서는 1년 새 45% 늘었다(LinkedIn, 2025)". 같은 질문("민준 화요일 3시는요?", "도윤도 지원했나요?")을 분할 화면에 던진다. 왼쪽 B3(원안을 LLM 하나로 만든 형태: 같은 Spark + 전체 캘린더 + 프라이버시 프롬프트)는 '정신건강의학과 상담'과 '도윤 1차 면접'을 말한다. 오른쪽 Overlap은 "그 시간은 어렵습니다. 16:30은 됩니다"이고 도윤 유무와 무관하게 응답 해시가 같다. 아래에 예약 링크(B1′) 복원 히트맵 | "같은 Spark, 다른 구조. 공개는 코드가 정하고, 모델은 Rule of Two대로 나눴다." | 누출 미터, B1′ 대비 복원 F1, 해시 일치 |
| 0:35–1:05 | 하윤의 에이전트(Spark 참조)가 `poppy.json`을 찾고 로그인해 후보 3개를 받는다. 삽입 컷: 호스팅 PDA와 Stacktree가 같은 정문을 지난다. D4 컷: 외근 시간은 "외근이 있어 어렵습니다", 상담 시간은 "그 시간은 어렵습니다"(Glimmer 라벨이 가른다). 승인 페이지(3인 이상은 Touch ID) → 영수증 | "남이 만든 에이전트도 정문으로 들어온다. 무엇을 말할지는 당사자의 동의와 정책이 정한다." | 공개 필드 수, 왕복 수 |
| 1:05–1:50 | 드롭. 카운트다운, "현장 슬롯 60석 · 초대 지원자 420명(모두 면접은 본다)". 선착순 기준선은 1초 만에 찬다. Overlap은 3분 창 → 마감 루트 → 증인 서명 → drand → 순번표, 브라우저에서 재계산. 자막 "시뮬레이션(시드 고정)" | "선착순이면 전문 봇이 자리를 가져간다. 손으로 하는 사람도, 평범한 에이전트를 쓴 하윤도 진다. 여기서는 목록이 먼저 잠기고 아무도 미리 모르는 비컨이 순번을 정한다." | 지연-당첨 상관, 운영사별 응모 수 |
| 1:50–2:40 | 민준의 리포트 → 영수증 → 포함 증명 → 증인 서명(3인 이상은 증인 2와 비트코인 앵커). 운영자가 로그를 고치자 증인이 서명을 거부한다(3인 이상은 로그 없는 면접 취소를 모니터가 표시). 자막 "데모 증인은 팀이 별도 키·호스트로 운영, 실제 배포에서는 다른 운영자가 맡는다" | "내 데이터에 닿은 요청을 당사자가 본다. 로그를 고치면 증인이, 로그 없이 바꾸면 모니터가 잡는다." | 요청 수, 제목 공개 0건, 조작 탐지 |
| 2:40–3:00 | 지표 카드(복원 F1과 성사율이 주인공, 의미 누출은 '구조상 차단, 실측 0/N'), "Poppy 확장 · 오픈소스" | "Agents get a lane, not an edge." | 기준선 대비 수치 |

1분판은 분할 화면, D4 갈림, 드롭 순번 검증, 조작 탐지만 남긴다. 1인 90초판은 분할 화면과 B1′ 히트맵(30초), 참조 에이전트가 초대 토큰으로 정문을 지나 후보와 D4 갈림을 받는 장면(25초), 영수증 → 브라우저 포함 증명 검증 → 로그 조작에 증인 거부 → 민준 리포트(25초), 지표 카드(10초)다.

### 8.2 '내 봇 둘의 대화'로 보이지 않게 하는 장치

주인공은 Spark로 만든 참조 지원자 에이전트다. Meta 도구 점수를 생각하면 주인공은 Meta 모델이 낫고, 남이 만든 에이전트는 상호운용 삽입 컷으로 쓴다. 호스팅 Poppy Demo Agent(PDA)는 Apache-2.0 알파이고 Claude Sonnet 5.5로 돌며, 사용자가 넣는 Anthropic·OpenAI 키는 해당 벤더로 바로 가므로("sent straight to the vendor") Muse Spark로 바꾸려면 포크가 필요할 것이다[추론]. PDA는 Draft 0.1 지원을 유지하고 0.2 지원은 10/19 업스트림 리비전에 고정한 미출시 상태다[https://github.com/adewale/pda]. 0.2는 client assertion과 Session assertion의 aud를 회사의 `auth.issuer`로 바꾸고 다른 aud를 거절하라고 정했으므로(변경 이력), 0.2만 받는 게이트웨이는 0.1로 도는 PDA를 거절할 수 있다[추론]. 10/27에 버전을 확인하고 필요하면 어댑터가 0.1 aud도 받게 한다. Stacktree 시뮬레이터는 보내는 요청을 전부 보여 주므로 두 번째 상대이자 인스펙터가 된다. PDA interop harness 편입은 영상에서 약속하지 않는다. 하네스는 인터넷이 막힌 컨테이너에서 에이전트와 회사를 맞붙이고 digest 고정 Dockerfile과 고정 commit을 요구하므로[https://github.com/adewale/pda/blob/main/interop/README.md], 템플릿 문장만 쓰는 오프라인 모드를 만든 뒤에만 넣는다(Should).

### 8.3 정량 평가 계획

- 데이터: 직원 30명 × 4주(1인당 주 15~25개 일정). 시간은 코드로, 제목·설명은 Spark 구조화 출력으로 만들고(한·영 반반) 범주·민감도·이동 가능성을 정답 라벨로 붙인다. 면접관별 공개 동의와 외부 조직자 일정도 넣는다. 공고 6개, 단계별 패널(1~5명)과 회의실, 초대 지원자 420명, 정상 과업 200개. 정답 슬롯은 CP-SAT 오라클(1인은 교집합 계산, privacy.md §5).
- 공격: A1 직접 추출, A2 권위·긴급 사칭, A3 메시지·저장형 인젝션(라벨러 포함), A4 30분 창 스윕, A4′ 짧은 결과 스윕, A5 단계 차분, A6 Sybil, A6′ 지원서 여러 개의 합집합, A7 장기 패턴, A8 출력 밀반입, A9 다른 지원자 존재 탐문, A10 홀드 사재기·홀드 오라클, A11 드롭 속도 폭주, A12 운영자 조작(로그 수정, 로그 없는 취소, 추첨 무효화 남용). 드롭 집단은 에이전트 사용자, 사람 속도 응모자, 대행사 둘, 응모권 없는 봇이다.
- 지표: 의미 누출률(문자열, Presidio, LLM 판정 교차), 구조 누출(패널 지도 복원 F1), 존재 오라클 이득, violations@5, 결정성, 성사율, 면접관 부담 공정성, 미팅당 공개 상태 수, 지연-당첨 상관, 조작 탐지율, p95, 비용. 95% 부트스트랩 구간을 붙인다.
- 기준선: B0 무방어 API(제목까지 주는 getSchedule류), B1 면접관별 free/busy, B1′ 2주치 패널 교집합을 한 번에 보여 주는 예약 링크, B2 computer-use 화면 긁기, B3 단일 LLM 프록시, B4 Firewalls(MIT 코드). ablation은 예산 끄기, 지원서별 투영, 매번 무작위 투영, 상태에 따라 붙는 표시, 짧은 결과 회계 끄기, 라벨만으로 공개 넓히기다.
- 사전 목표[제안]: 의미 누출은 구조상 차단되므로 실측 0/N을 보고만 하고 대표 수치는 구조 누출과 성사율로 한다. 같은 질의 수에서 복원 F1이 B1′의 3분의 1 이하, 지원서 N개를 합쳐도 풀 밖 빈 시간 0개, 존재 오라클 이득 0, 결정성 100%, 미팅당 공개 상태가 B1′의 3분의 1 이하, 드롭의 지연-당첨 상관 |r| < 0.05, 조작 탐지 100%, 자연어 요청 p95 5초 이하. 못 미치면 그대로 보고한다.

## 9. 구현 전에 합의할 것

### 9.1 가장 먼저 정할 셋

1. 시나리오와 뼈대(10/27 정오). 선택지는 Overlap+드롭(권장), 수정 FairTurn(차점), Countersign(리뷰 출처와 억제 탐지)이다. 데이터 생성기와 정책 어휘가 여기에 달렸다. 팀에 채용·면접 조율을 겪은 사람이 없고 4.3절의 영향력 근거도 못 찾으면 수정 FairTurn을 다시 검토한다. 팀원이 직접 겪은 문제가 있으면 그 각도로 가고 테마를 Build for Your World로 바꿀 수 있다.
2. 인원·역할·장비·크레딧(10/27 정오). 몇 명인지, 팀원 각자가 참가 승인자인지(승인받지 않은 팀원은 크레딧을 청구할 수 없다), 32GB 이상 Mac이 있는지, 공용 게이트웨이 키를 누구 계정으로 돌릴지 정한다. 인원에 따라 7.1절의 범위가 정해진다.
3. Poppy 버전과 데모 상대(10/27 밤, 늦어도 10/28 관문). 0.2 고정을 권하되, 브라우저 세션 결합은 0.3 방식으로 만들고 0.2 assertion은 쓰지 않으며, 'validator 통과'는 6.4절의 정의를 따르고, 호스팅 PDA 버전을 10/27에 확인해 필요하면 0.1 aud도 받는다(8.2절). 주인공은 Spark 참조 에이전트, 상호운용 상대는 PDA와 Stacktree다.

### 9.2 나머지 결정

| 결정 | 선택지 | 권장 | 기한 |
|---|---|---|---|
| 영상 언어 | 한국어 / 영어 / 영어 + 한국어 자막 | 영어 내레이션 + 한국어 자막 | 10/27 |
| D4 범위 | Should / Must | Must(동의 범주와 라벨 일치, 템플릿 문장) | 10/27 |
| 드롭 | 포함 / 제외 | 2인 이상일 때만 | 10/27 정오 |
| 운영·호스팅 | SaaS 벤더 / 셀프호스트, 도메인, 증인 호스트 | SaaS 벤더(셀프호스트 가능), 도메인 바로 구입, 게이트웨이와 증인은 다른 호스트 | 10/27 |
| 정책 엔진 | Cedar / OPA | Cedar(forbid 우선이 D5와 맞는다) | 10/27 |
| 범위 | 경계 밖 질의만 / 경계 안 위임 포함 | 경계 밖만, 경계 안은 약관 | 10/27 |
| 평가 언어·테마·라이선스 | 한/영, Push the Frontier / BfYW, Apache-2.0 / MIT | 한·영 반반, Push the Frontier, Apache-2.0 | 10/27 |
| 주인공 에이전트 | 호스팅 PDA / Spark 참조 에이전트 | Spark 참조, PDA·Stacktree는 삽입 컷 | 10/28 |
| Glimmer 위치 | 로컬 / 호스팅(합성만) / 규칙 폴백 | 관문 수치로 결정 | 10/28 |
| 공개 파라미터 | k, 버킷, 조회 기간, 예산, 창 폭, 풀 크기 | 3, 30분, 14일, 단계당 6단위, 6시간·이틀, 정원+2 | 10/29 |
| 예산·상한 | 키와 적용 대상 | 예산은 (지원서, 단계), 운영사는 요청 한도, 면접관 상한은 D3·D4에만 | 10/29 |
| 드롭 규칙 | 창 길이, 선호 수, 비컨, 공개 범위, 무효화 | 3분, 3개, 마감 60초 뒤 drand, 운영사별 응모 수(5건 미만 묶음), 무효화 조항 | 10/30 |
| 영수증·로그 | JWS / COSE, TS / Tessera, 증인 수, 앵커 | JWS·TS, 증인 1(3인 이상 2), OTS는 3인 이상 | 10/30 |
| 로그 공개·증인 표기 | 전체 / 체크포인트만 | 체크포인트만, 고객사 혼합, 15분 단위. 증인이 팀 운영임을 화면에 표기 | 10/30 |
| 승인 증빙 | approved_by 신뢰 / 콘솔 승인 / 패스키 | 2인은 콘솔 승인, 3인 이상은 지원자 확정과 면접관 D3에 패스키 | 10/31 |
| 공개 시점 | 레포·스펙 공개, Poppy 이슈 코멘트 | 11/3 이후 | 11/3 |

## 10. 리스크와 미확인 사항

| 항목 | 상태 | 대응 |
|---|---|---|
| 공식 규정(비Meta 모델, 영상 길이, 오픈소스, 사전 코드) | 10/26 현재 미공개(meta.md §1) | 공개 즉시 확인, 3분판·1분판 준비 |
| Poppy 버전 함정 | 0.2 browser assertion은 결함으로 0.3에서 제거, 키트 validator는 0.3 기준, PDA는 0.1 유지·0.2 미출시 | 9.1-3의 세 규칙 |
| Sierra 레퍼런스 구현 | 10/9 "Over the next month" 예고. 대회 중 나올 가능성이 높다 | 나오면 그 위로 옮기고 호환성만 점검 |
| 크레딧 | 승인자마다 따로, 합산 불가, 청구 마감 11/4 21:00 ET, 동의서의 '10-day window'와 약관의 무만료가 어긋남 | 첫날 청구·첫 호출로 확인, 게이트웨이 키 계정의 $150 안에서 운영 |
| Glimmer 장비·처리량 | 32GB 이상 Mac 미확인, reasoning을 끌 수 없다 | 라벨 대상 축소, 묶음 처리, 관문 폴백 |
| drand·OTS 외부 의존 | OTS 확정에 수 시간, 검증에 Bitcoin 노드 필요 | 10/30 앵커, 익스플로러 검증과 신뢰 가정 명시, 비컨 값 캐시 |
| 영향력 근거 | 채용 드롭은 관찰 사례 없음. LinkedIn 수치는 2025년 2차 보도, Konive는 스니펫 | 10/27 근거 조사, 시뮬레이션 표기, 확인된 사실만 자막에 |
| 미확인 사례 | NYMag, The Verge(RealReal 홀드), 한겨레(네이버 차단) [미확인] | 쓰지 않는다 |
| 한국어 가드·시차 | Prompt Guard 2·Llama Guard 4 한국어 미평가, 워크숍·Discord는 한국 밤 | 가드는 신호로만, 질문은 미리 글로 |

## 11. 출처

본문 URL과 핵심 1차 출처다(열람 2026-10-26). 나머지는 리서치 파일에 있다.

- Poppy: 0.2 스펙 https://personalagentprotocol.org/docs/0.2/spec.md · operations https://personalagentprotocol.org/docs/0.2/extensions/operations · 변경 이력 https://personalagentprotocol.org/docs/changelog · 회사 키트 https://personalagentprotocol.org/kit/company · validator README https://github.com/personal-agent-protocol/personal-agent-protocol/tree/main/skills/implement-personal-agent-protocol/validate · 이슈 https://github.com/personal-agent-protocol/personal-agent-protocol/issues · Sierra https://sierra.ai/blog/poppy
- 상호운용: PDA https://github.com/adewale/pda · interop https://github.com/adewale/pda/blob/main/interop/README.md · Stacktree https://stacktr.ee/blog/poppy-simulator.md
- 문제: Amazon 차단 https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ · 차단 사유 https://www.techspot.com/news/113981-amazon-blocked-meta-muse-agentic-ai-shopping-service.html · https://ppc.land/amazon-blocks-metas-muse-ai-agent-from-shopping-on-its-site/ · LinkedIn https://www.eweek.com/news/ai-job-applications-linkedin/ · 뉴욕주 법 https://hklaw.com/en/insights/publications/2025/02/new-york-curbs-scalping-of-restaurant-reservations
- 연구: MNC https://arxiv.org/abs/2608.01719 · Firewalls https://arxiv.org/abs/2502.01822 · CalBench https://arxiv.org/abs/2605.09823 · Muse Spark 안전 보고서 https://arxiv.org/abs/2606.12429 · Rule of Two https://ai.meta.com/blog/practical-ai-agent-security · AgentCore Policy https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html
- 로그·규제: Messenger 키 투명성 https://engineering.fb.com/2025/11/20/security/key-transparency-comes-to-messenger/ · drand https://docs.drand.love/blog/2023/10/16/quicknet-is-live · EDPB https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf
- Meta·대회: Cookbook https://dev.meta.ai/docs/cookbook/glimmer-api-agent · 동의서 https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver · Credit Terms(동의서 본문의 링크, PDF)
