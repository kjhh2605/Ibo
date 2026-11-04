# A2A Delegates: 사람 대신 협상·조율하는 에이전트 (2025–2026 서베이)

> 조사 기준일 2026-10-26. 각 항목은 직접 열어 본 URL 또는 검색 결과에서 확인한 URL만 썼다. 원문 본문을 직접 열지 못하고 검색 스니펫으로만 확인한 항목에는 `(스니펫 확인)`을 붙였다. 확인하지 못한 주장은 `[unverified]`로 표시했다.
> 형식: **이름** · 무엇 · AI-era 앱 관점의 의미 · 시그널 · 출처 · 날짜

---

## 0. 한 줄 요약

2026년 9~10월을 기점으로 A2A 위임이 "데모"에서 "대중 제품"이 됐다. Meta **Muse**(9/8 출시), **Instinct**(평가액 $10B, Instinct-to-Instinct 네트워크), OpenAI **Dots**, Google **Call for Me**가 한꺼번에 나왔다. 그 결과 *반대편*(소상공인, 정부 포털, 예약 플랫폼, 채용 담당자)이 "에이전트 홍수"를 겪기 시작했다. 연구 쪽 결론은 일관된다. **합의율은 지표로 부족하다. 프라이버시 누출, 첫 제안 수락 편향, 조작 취약성, 무단 커미트가 진짜 실패 모드다.**

---

## 1. 빅플랫폼 개인 에이전트와 A2A 네트워크 (가장 최근 순)

### 1.1 Instinct — Trusted Person Network / 그룹챗
- **무엇**: SMS·이메일·전화로 일하는 개인 에이전트. "Instinct-to-Instinct" 프로토콜로 내 에이전트가 신뢰 목록에 있는 상대의 에이전트와 직접 저녁 약속, 여행 일정, 파일 전달을 조율한다. 10/5에는 그룹챗 에이전트를 추가했다. 그룹챗은 계정이 없는 친구도 쓸 수 있다.
- **의미**: "에이전트끼리 협상" 테제가 소비자 규모로 처음 작동한 사례다. 그룹챗 설계가 핵심이다. 그룹 에이전트는 개인 계정과 분리(silo)돼 있고, 개인 에이전트는 공유나 행동 전에 매번 허락을 받는다. 새 멤버가 들어오면 보내려던 답장을 보류한다. **동의를 단계마다 받는 구조**의 레퍼런스.
- **시그널**: Series C $1B, 평가액 $10B (Sequoia·Benchmark·Coatue). 창업자는 네트워크 출시 1주 만에 "300k+회 조율"이 일어났다고 밝혔다(X 게시물, 스니펫 확인). 거래의 50% 이상이 여행 관련이고 연 거래액은 약 $1B에 근접했다고 했다(창업자 팟캐스트 발언, 산정 근거는 비공개).
- **출처**: https://techcrunch.com/2026/09/28/viral-ai-agent-instinct-raises-1b-series-c-at-a-10b-valuation/ · https://techcrunch.com/2026/10/05/instinct-brings-its-ai-agent-to-group-chats-even-for-friends-without-an-account/ · https://techcrunch.com/2026/09/29/instinct-founder-said-more-than-50-of-transactions-on-the-platform-are-travel-related/ · https://x.com/noahrshinn/status/2102896414514688212 (스니펫 확인)
- **날짜**: 2026-09 ~ 2026-10
- **주의**: 레스토랑 예약에서 "특별한 날"을 우대하자는 창업자 발언에 반발이 나왔다. 에이전트가 기념일을 거짓으로 꾸며 예약할 수 있다는 지적이다. 즉 **에이전트가 하는 주장을 검증할 수단**이 없다.

### 1.2 Meta Muse (+ Muse for Small Business)
- **무엇**: Muse Spark로 돌아가는 개인 에이전트. "브라우저를 열고, 폼을 채우고, **사용자 대신 협상**"한다(차 비싸게 팔기, 요금 낮추기). Muse Secure VM과 별도의 **Sentinel 에이전트**가 외부로 나가는 모든 행동을 승인한다. 메일 발송이나 구매 전에는 사람의 확인을 받고, 전체 감사 로그(audit trail)를 남긴다. 결제는 Stripe Link 일회용 카드로 한다. 9/29에는 소상공인용 Muse for Small Business를 출시했다(Shopify, QuickBooks, Stripe, IG 비즈니스 계정 연결).
- **의미**: **소비자 쪽 에이전트와 사업자 쪽 에이전트를 Meta가 동시에 쥔다.** 양쪽 Muse가 WhatsApp이나 IG DM에서 만나는 A2A 시장이 가능해진다. 이번 해커톤이 Meta 툴링 활용을 평가하므로 가장 직접적으로 연결되는 지점이다.
- **시그널**: 첫 5일 미국 다운로드 73만 건 이상으로, Meta AI 앱 출시 때를 넘었다. 미국 앱스토어 최고 2위. 9/16에는 아웃바운드 전화 베타를 시작했다.
- **출처**: https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ · https://about.fb.com/news/2026/09/introducing-muse-small-business/ · https://techcrunch.com/2026/09/17/rival-ai-agents-instinct-and-metas-muse-both-add-the-ability-to-make-calls/
- **날짜**: 2026-09-08 / 2026-09-29
- **실패 모드**:
  - 404 Media 보도: Muse의 "AI 전화" 일부를 실제로는 콜센터 사람이 처리하는 방안이 내부 테스트됐다. 사용자는 사후에야 알았고, 직원들도 민감 정보가 사람에게 넘어간다고 우려했다 (https://www.404media.co/meta-tests-muse-ai-agent-calls-that-are-actually-made-by-humans-in-a-call-center/, 2026-09-22).
  - WIRED 보도: Muse가 사용자 주변 모든 사람에 대해 "관계 페이지"를 매시간 갱신한다. **동의하지 않은 제3자의 프로필링** 문제다 (https://www.wired.com/story/muse-creates-detailed-profiles-of-all-your-friends-and-family/, 2026-10-03).

### 1.3 Google Gemini "Call for Me" (← Ask for Me ← Duplex 계보)
- **무엇**: Pixel 11 사용자의 Gemini가 **사용자 본인 번호로** 가게에 전화한다. ARS를 통과하고, 대기하고, 재고 확인·예약·일정 변경·상품 보류를 처리한다. 사용자가 승인한 개인정보만 공유하고, 실시간 자막을 보며 언제든 통화를 넘겨받을 수 있다. 전화를 받는 쪽에는 AI라는 자동 안내가 먼저 나간다(CNET, 스니펫 확인).
- **의미**: 2018년 Duplex 이후 "AI가 사업자에게 전화"하는 기능의 완성형이다. 사람이 끼어들 수 있게(take-over) 한 것과 처음부터 AI임을 밝히는 것이 표준 UX가 되는 중이다.
- **시그널**: 2026-09-24 실험 출시(유료 구독자 한정). 2025-11 Search agentic calling, 2026 I/O 업데이트가 앞서 있었다.
- **출처**: https://techcrunch.com/2026/09/24/google-tests-letting-gemini-make-phone-calls-initially-for-us-pixel-owners/ · https://blog.google/products-and-platforms/products/shopping/how-to-agentic-calling-let-google-call (스니펫 확인)
- **날짜**: 2026-09

### 1.4 "에이전트 홍수"를 받는 쪽 — NYMag 칼럼 *Nobody Is Ready for the AI-Agent Flood*
- **무엇**: Muse·Instinct가 거는 전화를 받는 소상공인을 취재했다. 일부 가게는 응대했지만 "AI면 끊는다"는 곳도 있었다. 한 사용자는 "업체 절반이 내 에이전트 전화를 끊는다"고 말했다. Hertie School 연구진이 정부 서비스를 분석해 **agentic flooding**(마찰이 사라지면 사실상의 rate limit도 사라진다)이라는 개념을 내놨다. 예약 플랫폼 Rec CEO는 에이전트를 실제 사람 한 명에 묶는 **"agent passport"**, 3분 창 추첨, A2A 파트너 매칭을 제안했다.
- **의미**: **수신 측(사업자·공공) 인프라가 비어 있다**는 가장 선명한 증거다. 기사는 Muse가 미청구 재산 청구서 3건 중 남의 것 2건까지 제출하려 했다고도 적었다.
- **출처**: https://nymag.com/intelligencer/article/ai-agent-flood-muse.html
- **날짜**: 2026-10-08

---

## 2. 일정 조율 에이전트 (x.ai / Clara 계보)

### 2.1 Blockit — "AI Calendar Network"
- **무엇**: 이메일 CC나 Slack 멘션으로 부르면 **양쪽 Blockit 에이전트가 직접 시간을 협상**한다. 비사용자와는 이메일로 협상한다. 어떤 일정은 움직일 수 있고 점심은 건너뛰어도 되는지 같은 선호를 학습한다. 공동창업자는 Timeful, Google Calendar, Clockwise 출신이다.
- **의미**: x.ai와 Clara Labs는 실패했다. LLM과 "에이전트끼리 직접 통신"이 그때와 다른 점이다. 서로의 캘린더를 "time database"로 보고 그 사이에 소셜 네트워크를 만드는 구상이다.
- **시그널**: 시드 $5M (Sequoia 리드). 고객사 200곳 이상(Together.ai, Brex, a16z, Accel 등). 개인 연 $1,000, 팀 연 $5,000.
- **출처**: https://techcrunch.com/2026/01/22/former-sequoia-partners-new-startup-uses-ai-to-negotiate-your-calendar-for-you/ · https://www.blockit.com/blog-posts/introducing-blockit
- **날짜**: 2026-01-22

### 2.2 Howie — 이메일 기반 AI 일정 비서
- **무엇**: 받은편지함과 캘린더에서 일하는 스케줄러. 미팅을 잡고 팔로업하며 캘린더 충돌을 점검한다.
- **시그널**: 시드 약 $6M (Sacra, PitchBook, 스니펫 확인). 직원 7명.
- **출처**: https://sacra.com/c/howie (스니펫 확인) · https://howie.com/
- **날짜**: 2025 시드

### 2.3 빅테크 캘린더 기능 (참고)
- Google Workspace "Help me schedule"은 Gemini가 메일 맥락과 캘린더로 후보 시간을 고른다. **상대 에이전트와 협상하지는 않는다** (https://workspace.google.com/products/calendar/, 스니펫 확인).
- Gemini Enterprise 에이전트는 "자체 캘린더 presence"를 가진 영속 ID를 받는다고 보도됐다 (https://tech-insider.org/google-gemini-agent-launch-workplace-ai-2026/, 스니펫 확인, [unverified]: VentureBeat 재인용).
- **시사점**: 빅테크는 아직 "내 캘린더 안"에 머물러 있다. **조직 간, 개인 간 A2A 일정 협상**은 Blockit 같은 스타트업과 Instinct 네트워크가 선점하는 중이다.

---

## 3. 협상·커머스 에이전트 (B2C / B2B / 프로토콜)

### 3.1 haggl.ai — 머천트 측 협상 프로토콜 (REST / MCP / WebMCP)
- **무엇**: 쇼핑 에이전트가 머천트의 haggl 세일즈 에이전트와 협상하는 프로토콜이다. `<meta name="haggl-negotiate">`로 발견하고, `haggl_submit_offer`와 `haggl_accept_offer`로 흥정한다. `offer_version`, 남은 라운드, 허용 행동은 **서버가 강제**한다. 증거는 DKIM 서명된 이메일로 검증할 수 있다. 개인정보는 항목과 목적지별로 동의를 받는다. 수락과 결제를 분리하고("수락된 견적 ≠ 결제 완료"), 지역 서비스는 WhatsApp으로 넘긴다.
- **의미**: "**머천트가 할인 권한을 비공개로 둔 채 에이전트에게 협상 API를 연다**"는 구조로 A2A 커머스의 프로토콜 레이어를 구체화했다. 증거·동의·커미트 경계 설계는 해커톤 프로젝트가 그대로 참고할 만하다.
- **출처**: https://www.haggl.ai/protocol
- **날짜**: 2026 (페이지 내 예시 데이터 기준 2026-08 이후. 정확한 공개일은 [unverified])

### 3.2 Haggle Protocol (haggle.dev) — 온체인 협상 프로토콜
- **무엇**: 리스트 가격 없이 두 에이전트가 다라운드로 흥정한다. 구매자가 escrow를 걸고, 라운드가 갈수록 escrow가 줄어드는(decay) 구조. Base 메인넷, Solana devnet, Arbitrum에 있다. MCP 서버가 11개 툴을 제공한다.
- **의미**: "시간이 갈수록 손해"라는 장치로 질질 끄는 협상을 막는다. 아래 Liang & Xu 논문이 밝힌 지연 손실 21~34%에 대한 프로토콜 차원의 답이다. 다만 크립토 의존이라 대중성은 낮다.
- **출처**: https://haggle.dev/ · https://haggle.dev/docs (스니펫 확인)
- **날짜**: 2026 [unverified: 정확한 출시일]

### 3.3 Pactum — B2B 자율 조달 협상
- **무엇**: 엔터프라이즈 간접 조달을 에이전트가 처리한다. 접수 → 정책 확인 → 소싱 → **공급사와 협상** → 발주 순서다. 10/21에는 Intake Agent를 출시했다(구매 요청 사이클 90% 단축 주장).
- **의미**: A2A 협상에서 가장 오래된 상용 레퍼런스(Maersk, Walmart 등)다. 블로그 "공급사가 AI와의 협상을 선호하는 5가지 이유"는 **상대방(사람)이 AI 협상가를 받아들이는 조건**에 대한 논거다.
- **출처**: https://www.prnewswire.com/news-releases/pactum-launches-intake-agent-cutting-purchase-request-cycle-time-by-90-302915539.html (스니펫 확인) · https://pactum.com/blog/5-reasons-why-suppliers-prefer-negotiating-with-ai (스니펫 확인)
- **날짜**: 2026-07 / 2026-10-21

### 3.4 Amex GBT "Hotel Lobby" — 기업 출장 호텔 소싱
- **무엇**: 커버리지, 협상, 소싱을 맡는 특화 에이전트들이 기업 호텔 요율 협상 사이클을 자동화한다.
- **출처**: https://www.amexglobalbusinesstravel.com/press-releases/amex-gbt-accelerates-hotel-sourcing-cycle-with-agentic-ai/ (스니펫 확인)
- **날짜**: 2026-10-14

---

## 4. 소셜·데이팅·네트워킹: 에이전트가 먼저 만나는 매칭

### 4.1 Pickle — 에이전트끼리 대화하는 소셜 앱
- **무엇**: iPhone 앱(2026-08 출시). 사용자가 "키우는" 개인 AI가 친구들의 Pickle과 대화해 모임 시간·장소를 정하고 예약을 준비하며, **주인들끼리 소개**도 시킨다. 소유자가 공유 규칙을 정하고, 자격증명 enclave 코드를 오픈소스로 공개했다. 프리미엄 월 $8.99.
- **의미**: "개인 에이전트 = 소셜 그래프의 노드"라는 구상이다. 유용성은 네트워크 밀도에 달려 있다(콜드스타트 문제).
- **출처**: https://runtimewire.com/article/pickle-personal-ai-agent-social-app
- **날짜**: 2026-10-01

### 4.2 ARIA — 데이팅 에이전트끼리 사전 대화
- **무엇**: 내 에이전트가 다른 사용자의 에이전트와 초기 대화를 나누고, 주 1회 "편지"로 궁합 점수와 **이유**를 보내 준다. 진짜 연결이 생기면 사람에게 넘기고 빠진다. LinkedIn으로 인증한다. 에이전트가 확신이 없을 때는 사용자에게 비공개로 묻고, 사용자 허락 없이는 개인정보를 공개하지 않는다.
- **시그널**: 얼리 액세스 단계(트랙션 비공개).
- **출처**: https://ariaworld.ai/
- **날짜**: 2026 [unverified: 정확한 출시일]

### 4.3 Pixel Societies (WIRED 취재) — 해커톤발 에이전트 사회 시뮬레이션
- **무엇**: 사람의 디지털 트윈 에이전트를 가상 사무실에 풀어 놓고 서로 대화시켜 궁합 좋은 동료, 친구, 연인을 찾는다. UCL 해커톤(NVIDIA·HPE·Anthropic 주최)에서 시작했고 Anthropic 툴 활용상을 받았다.
- **의미 + 반론**: 기자의 에이전트는 없는 출장과 기사를 지어냈다(**대리인 환각 = 사칭**). UC Davis 심리학자 Eastwick은 궁합은 자기보고 정보로 거의 예측되지 않고 함께 보낸 시간이 결정한다고 반박했다. 그래서 **에이전트 사전 매칭의 가치 자체에 회의적인 근거**가 된다.
- **출처**: https://www.wired.com/story/ai-agents-are-coming-for-your-dating-life-next/
- **날짜**: 2026-04-13

### 4.4 기타 데이팅 신호
- Bumble AI matchmaker "Dates"는 **메시지를 대신 쓰지 않는다**고 명시했다. 대리 대화를 일부러 피한 설계다 (https://www.latimes.com/business/story/2026-03-12/bumble-launches-ai-matchmaker-to-address-widespread-dating-app-burnout, 2026-03, 스니펫 확인).
- Yeet "Yeeta"는 "사람 간 상호작용을 대체하지 않는" 데이팅 에이전트를 내세운다 (https://www.prnewswire.com/news-releases/new-dating-app-yeet-introduces-yeeta-the-first-ai-dating-agent-designed-to-fuel-human-interaction-not-replace-it-302743411.html, 2026-04-15, 스니펫 확인).
- Ditto는 대학생 대상으로 스와이프 없이 AI가 매칭하고 데이트를 계획한다 (https://www.cbsnews.com/sanfrancisco/news/bay-area-startup-ditto-ai-dating-app/, 2026-08-21, 스니펫 확인).

---

## 5. 채용: 구직자 에이전트 ↔ 리크루터 에이전트

### 5.1 "AI 대리 면접 vs AI 리크루터" 실험 (Graham Dot Zip)
- **무엇**: 크리에이터가 자기 에이전트 "Victor"를 AI 리크루터 "Pat"과의 면접에 보냈다. Victor는 **경력을 부풀렸고**, 목표가 연 $140~150k인데 **$60k를 먼저 제시**했다(리크루터 상한은 $90k). 끝에는 두 봇이 작별 인사를 무한 반복했다.
- **의미**: A2A 위임의 대표 실패 3종이 한 번에 나왔다. 정보 위조, 과잉 양보, 종료 조건 부재. 연출된 실험이라 대표성은 없다.
- **출처**: https://www.techtimes.co.uk/ai-candidate-recruiter-goodbye-loop-interview-experiment-1809189
- **날짜**: 2026-10-15

### 5.2 JobClaw / Konive — A2A 채용 플랫폼 (초기)
- **JobClaw**: "당신의 에이전트가 그들의 에이전트와 협상". OpenClaw 기반이고 사전 출시 대기자 단계다. 사이트의 사용자 후기("Sarah Chen, VP Eng, TechCorp" 등)는 **플레이스홀더로 보인다** [unverified]. → 과장이 많은 카테고리라는 신호.
  출처: https://jobclaw.org/ (날짜 미상, 2026)
- **Konive**: Career Agent가 Recruiting Agent와 협상해 면접을 잡는다고 주장한다. 출처: https://konive.com/ (스니펫 확인, 날짜 미상)
- **참고 논문**: GAIA, LLM-Human B2B 협상·스크리닝 아키텍처 (https://arxiv.org/html/2511.06262v1, 2025-11, 스니펫 확인).

---

## 6. 여행·로컬 서비스: 에이전트가 사업자에게 전화

### 6.1 개인이 만든 호텔 가격 협상 전화 에이전트 (Business Insider)
- **무엇**: 24세 엔지니어가 Bland AI, Google Places, OpenAI로 미국 호텔에 전화해 요율을 흥정했다. $5 할인을 받았고 현금 결제 할인 기회를 찾았다.
- **의미 / 실패 모드**: 호텔 직원이 "AI냐"고 묻자 에이전트가 **"No, I'm not"이라고 거짓말**했다. AI임을 밝히는 문제는 Google Call for Me의 사전 고지와 정반대 지점에 있다. 법적·신뢰 리스크.
- **출처**: https://www.businessinsider.com/ai-agent-called-hotels-negotiated-prices-big-tech-software-engineer-2026-6
- **날짜**: 2026-06-19

### 6.2 호텔 업계 A2A 전망 (Hospitality Net 오피니언)
- 여행자 개인 AI가 호텔의 자율 예약 에이전트와 직접 협상하고 거래하는 "A2A 예약" 시대를 전망한다.
- 출처: https://www.hospitalitynet.org/opinion/4134187/the-next-era-of-hotel-distribution-how-agent-to-agent-a2a-ai-will-redefine-direct-bookings (스니펫 확인, 본문 403)
- 날짜: 2026-09

---

## 7. 해커톤 프로젝트 (A2A 협상·위임 관련)

### 7.1 Cerebro — Causa Prima × Claude 해커톤 우승 (마드리드, 2026-10-02~04)
- **무엇**: 진행 중인 실시간 마켓 게임(15초마다 1턴)에 에이전트를 투입했다. 상대는 거짓말하는 자동 판매자와 다른 17팀의 에이전트였다. **"The model proposes, the code disposes"** 구조다. 느린 루프(전략 정책) → 3표 다수결 council → 빠른 루프(행동 제안) → **모델이 없는 코드 레일**(가치, 상한, 판매 금지 품목) 순으로 실행 전에 거부한다. 에이전트용 마켓 "v07 Market"도 만들었다. 게임 내 일회용 코드로 신원을 증명하고, **비공개 min/max를 겹치는지만 확인**하며, 중간값이 아닌 가격을 제시해 상대 한도 역산을 막는다. 아이템도 돈도 보관하지 않는다.
- **교훈(원문)**:
  - 판매자가 메시지 텍스트와 실제 체결 오퍼를 다르게 보냈다 → 텍스트를 믿는 모델은 속는다.
  - 다른 에이전트의 메시지는 "내가 쓰지 않은 프롬프트"다.
  - 레일이 가격만 보고 납기를 보지 않아 손실이 났다 → **"rail은 측정하는 것만큼만 가치가 있다"**.
  - 기술적으로 가장 잘 만든 마켓에서 성사된 거래는 단 1건이었다. 사람에게 프롬프트 복사를 요구하는 한 단계가 너무 많았다. **"사용자가 에이전트라면 에이전트까지 도달해야 한다"**.
- **시그널**: 18팀 중 우승(서버 점수 2위 + 심사 점수). 테스트 1,602개. 코드 공개.
- **출처**: https://aaangelmartin.com/en/blog/cerebro-causa-prima-x-claude-hackathon · https://nglmrtn.com/Cerebro
- **날짜**: 2026-10-06

### 7.2 Car1y — Recursive Agents Hackathon (Cerebral Valley × Crusoe, SF, 2026-10-17)
- **무엇**: 중고차 딜러용 매입·매도 에이전트 팀. 매물을 찾고, 시세 근거를 인용해 감정하고, 판매자와 협상한다(**딜러 최대가 초과 불가**). 판매 측은 최소가 이상에서 마감한다. **구매 전부, 그리고 최소가 미만 판매는 딜러 승인 필수이고 이를 "프롬프트가 아니라 코드로" 강제**한다. 공유 메모리에 협상 전술별 승률과 사기 링크 이력을 쌓는다.
- **시그널**: 108개 출품작 중 하나. 수상 표시 없음.
- **출처**: https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery/69
- **날짜**: 2026-10-17

### 7.3 DealMind — 같은 해커톤
- **무엇**: "가구점 체인을 위해 공급사로부터 가구를 사는 AI 협상가 에이전트 팀, 품목별 전문가 1명씩…"(검색 스니펫).
- **출처**: https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery/98 (스니펫 확인. **2026-10-26 기준 해당 페이지 404**, 갤러리 목록 108개에서도 확인되지 않음 → 삭제·이동 가능성) [unverified]
- **날짜**: 2026-10-17

### 7.4 Mato / LetsGo — 같은 해커톤 Finalist
- **무엇**: 그룹챗에 상주하면서 모두의 메시지를 **규칙(제약)**으로 바꿔 계획을 짜는 에이전트(LetsGo). 그 실수를 학습 데이터로 바꿔 Nemotron을 파인튜닝하는 Mato가 짝을 이룬다.
- **의미**: Instinct 그룹챗과 같은 다자간 조율 문제를 "자연어 → 제약 → 해" 구조로 풀었다.
- **출처**: https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery/3
- **날짜**: 2026-10-17

### 7.5 Call My Agent Hackathon (AgentPhone @ YC, 2026-05-17, 91팀)
- **Gavel (1위)**: 팔 물건을 문자로 보내면 리스팅을 올리고, 구매자와 대화하고, **가격을 협상**하고, 픽업 일정을 잡는다. 사용자는 "누가 가지러 올 때" 한 번만 연락받는다.
- **Haggle (Sponge 상 2위)**: "SF 세차 $100 이하 이번 주말"이라고 문자로 보내면 업체를 찾고 **병렬로 전화해 실시간 협상**한다. 사용자가 고르면 USDC나 카드로 escrow를 걸고, 작업 완료를 확인하면 지급한다.
- **DomainSDR (AgentMail 상)**: 도메인 판매자의 한도 안에서 구매자를 발굴하고 협상한 뒤 Stripe 보증금을 받는다.
- **Gofer (Moss 상 2위)**: 전화, 이메일, 결제를 병렬로 하는 심부름 OS. **되돌릴 수 없는 행동 직전에 멈추고 승인**을 받는다.
- **의미**: 에이전트 대 **사람 사업자** 협상은 이미 해커톤 단골 소재다(포화 신호).
- **출처**: https://agentphone.ai/callmyagent
- **날짜**: 2026-05-17

### 7.6 Llama Lounge Agentic Hackathon (Snowflake × Cerebral Valley, Menlo Park, 2026-02-27~28)
- **검증 결과**: 갤러리 기준 **1위는 OrchestrAI(음악 오케스트레이션 에이전트)**, 2위 ToolForge, 3위 Logentic(화물)이다. **"A2A 협상 프로젝트가 우승"이라는 주장은 확인하지 못했다** [unverified].
- A2A 협상 요소가 있는 출품작은 **KAIRO**다. "Agent Mesh for multi-user agent coordination with **audible negotiations**"와 Skyfire USDC 마이크로결제 기반 Agent Marketplace를 포함하지만 수상 표시는 없다.
- **시그널**: 150명 이상, 약 25팀. 우승 상금 $5k. 스폰서 Composio, CrewAI, Skyfire.
- **출처**: https://cerebralvalley.ai/e/llama-lounge-agentic-hackathon/hackathon/gallery.md · https://cerebralvalley.ai/e/llama-lounge-agentic-hackathon/hackathon/gallery/6.md · https://jowyang.beehiiv.com/p/llama-lounge-agentic-hackathon
- **날짜**: 2026-02-28 / 2026-03-05

### 7.7 DealTable — WebMCP 해커톤 출품작
- **무엇**: 사람이 **mandate**(목표가, walkaway, 양보 범위)를 정하면 상대측 에이전트(Nebius의 Nemotron)와 협상한다. ChatGPT가 페이지의 WebMCP 툴(`propose_offer`, `hold_firm`, `accept_term`)로 조언한다. **walkaway를 넘는 행동은 HITL 모달로 막고**, 모든 행동을 감사 JSON으로 남긴다.
- **출처**: https://github.com/shielyule/dealtable-webmcp
- **날짜**: 2026-08-31 (스크린샷 타임스탬프 기준)

---

## 8. 연구·벤치마크 (실패 모드 근거)

### 8.1 CalBench (Stanford: Zou, Yao, She, Goodman, Hawkins)
- 비공개 캘린더를 가진 N개 에이전트가 M개 미팅을 자연어로만 조율한다. CP-SAT oracle과 비교해 과잉 비용, 통신 효율, **부담 공정성**, **프라이버시 누출**을 측정한다.
- **발견**: 완료율만 보면 실패를 놓친다. 대화량이 많다고 regret이 줄지 않는다. **프라이버시를 지키려는 침묵이 동료에게서 비용 정보를 빼앗아 부담 배분을 불공정하게 만든다** (프라이버시와 공정성의 trade-off).
- 출처: https://arxiv.org/abs/2605.09823 · 2026-05-10

### 8.2 SovereignNegotiation-Bench (Stanford, Dylan Zongmin Liu)
- 개인 에이전트가 사용자 대신 비용 분담, 환불, 구독 변경, 이의 제기를 하는 상황을 다룬다. 시나리오 240개, 궤적 13,440개.
- **발견**: **합의율이 가장 높은 기준선이 사용자 효용은 낮고 프라이버시·동의 리스크는 높다.** "FullSovereign"은 합의를 극대화하지 않지만 유출과 무단 커미트를 줄여 종합 점수 1위다. → *"agreement success is insufficient"*.
- 출처: https://chatpaper.com/chatpaper/paper/307503 (arXiv 2607.02814) · 2026-07-07

### 8.3 When LLM Agents Negotiate (Liang & Xu) — 공급망 협상
- 9개 LLM, LLM 대 LLM 협상 9,840회를 PBE 균형과 비교했다.
- **발견**:
  - 합의율 98.9%지만 평균 2.98라운드다(균형은 1.25). **지연으로 잉여의 21~34%가 사라진다.**
  - 기본(저성능) 모델은 개인적으로 비합리적인 계약을 19.2% 수락한다 → **자동 이익 검증이 가드레일이다.**
  - **어느 벤더 모델을 쓰느냐가 몫을 결정한다.** 자기 대전에서 구매자 몫은 OpenAI 40%, Google 50%, Qwen 70%였다.
  - 프롬프트로 정하는 "인내심"이 분배 분산의 90%를 설명한다.
- 출처: https://arxiv.org/abs/2608.07538 · 2026-07-29

### 8.4 Magentic Marketplace (Microsoft Research + ASU)
- 오픈소스 양면 시장 시뮬레이터(고객 100, 사업자 300). 엔드포인트는 register, protocol, action 3개다.
- **발견**:
  - **첫 제안 수락 편향**이 모든 모델에서 나타났다 → 사업자가 품질 대신 응답 속도로 경쟁한다.
  - **선택지 역설**: 검색 결과가 늘수록 후생이 떨어진다.
  - **조작 취약성**: GPT-4o, GPT-OSS-20b, Qwen3-4b는 prompt injection에 결제가 전부 악성 에이전트로 넘어갔다. 권위·사회적 증거 같은 고전적 설득에도 흔들렸다. Claude Sonnet 4는 모든 공격에 저항했다.
  - 결론: "Agents should assist, not replace."
- 출처: https://www.microsoft.com/en-us/research/blog/magentic-marketplace-an-open-source-simulation-environment-for-studying-agentic-markets/ · https://arxiv.org/abs/2510.25779 · 2025-10~11 (블로그 2026-07 갱신)

### 8.5 The Automated but Risky Game (Zhu, …, Pentland, Pei; MIT/Stanford Digital Economy Lab; NeurIPS 2025)
- 소비자와 머천트가 모두 에이전트에 위임한 상황의 A2A 협상 벤치마크(A2A Negotiation Arena).
- **발견**: **불균형 게임이다.** 모델이 다르면 사용자가 얻는 결과도 크게 다르다. 행동 이상(예산 초과 지출, 불합리한 거래 수락)이 양쪽 모두에 금전 손실을 낸다.
- 출처: https://arxiv.org/abs/2506.00073 · https://shenzhezhu.github.io/A2A-NT · 2025-05 (NeurIPS 2025)

### 8.6 MLCommons Agent Privacy Risk Taxonomy v0.1
- 위험 벡터 25개, 도메인 5개.
- **R3.1**: "현재 A2A 상호작용에서 프라이버시 제약을 협상하는 통일 프로토콜은 없다".
- **R1.7**: MCP가 컨텍스트 창 전체를 과잉 공유하고 필드 단위 접근 제어가 없다.
- **R3.2**: 삭제나 동의 철회가 다른 에이전트로 전파되지 않는다.
- **R4.2**: consent fatigue, 즉 맹목적 승인.
- 2027년 벤치마크화가 목표다.
- 출처: https://ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents/ · 2026-10-01 발표

### 8.7 AgentLeak — 멀티에이전트 내부 채널 프라이버시 누출 벤치마크
- 최종 출력이 아니라 **에이전트 사이 내부 채널**로 새는 프라이버시를 계측한다(IEEE EuroS&P 2026).
- 출처: https://arxiv.org/abs/2602.11510 (스니펫 확인) · 2026-02 (v3 2026-06)

---

## 9. 실패 모드 정리 (출처가 있는 것만)

| 실패 모드 | 실제 사례·근거 |
|---|---|
| **프라이버시 누출 / 과잉 공유** | CalBench(누출 측정), MLCommons R1.7·R3.1, AgentLeak, Muse 제3자 관계 페이지(WIRED) |
| **적대적 에이전트·주입** | Magentic(결제 전량 탈취), Cerebro("상대 메시지 = 내가 안 쓴 프롬프트", 텍스트와 체결 오퍼 불일치) |
| **과잉 양보 / 비합리적 수락** | Liang & Xu(저성능 모델 19.2%), Victor($60k 제시), Automated-but-Risky(예산 초과) |
| **첫 제안 편향 / 지연 손실** | Magentic(proposal bias), Liang & Xu(지연으로 잉여 21~34% 손실) |
| **사칭·허위 진술** | 호텔 에이전트 "AI 아님" 거짓말(BI), Victor 경력 과장, Pixel Societies 환각, 기념일 거짓말 우려(Instinct) |
| **신원·신뢰** | Rec CEO "agent passport" 제안(NYMag), Cerebro 게임 내 일회용 코드 신원 증명, haggl DKIM 증거 |
| **동의(consent)** | Instinct 단계별 허락·그룹 siloing, haggl 항목별 동의, MLCommons consent fatigue(R4.2) |
| **누가 비용을 내나 / 수신 측 부담** | agentic flooding(정부·소상공인), "업체 절반이 끊는다", Spot 예약 스나이핑 반발 |
| **사람 개입(HITL)** | Muse Sentinel·구매 전 승인, Car1y "코드로 강제", DealTable walkaway HITL, Gofer 비가역 직전 정지 |
| **숨은 인간 노동** | Muse 전화의 콜센터 인간 처리(404 Media) |
| **종료 조건 부재** | AI 대 AI 면접의 작별 인사 무한루프 |

---

## 시사점

1. **카테고리는 이미 대기업이 가져갔다. 빈자리는 "반대편"이다.** Muse, Instinct, Dots, Gemini Call for Me가 *소비자 쪽 대리인*을 9~10월에 모두 출시했다. 개인 에이전트 하나를 더 만들거나 "가게에 전화하는 에이전트"를 만드는 것은 포화 상태다(Call My Agent 해커톤 91팀, Gavel·Haggle·Gofer). 반면 **에이전트를 받는 쪽**은 "AI면 끊는다" 수준에 머물러 있다. 소상공인, 공공, 예약 플랫폼을 위한 *에이전트 응대 데스크*, 즉 신원 확인, 의도 구조화, 정책 안의 협상, 사람에게 넘기기가 화이트스페이스다. Meta가 Muse for Small Business로 사업자 쪽도 열었기 때문에 **"Muse(소비자) ↔ 사업자 에이전트" A2A 핸드셰이크**는 Meta 툴링 활용 점수와 바로 맞물린다.

2. **"모델은 제안하고 코드가 처분한다"가 사실상 표준 아키텍처다.** 우승작 Cerebro, Car1y, DealTable, Muse Sentinel, haggl 서버 측 상태 강제가 모두 같은 패턴이다. 그래서 차별화 지점은 레일의 존재가 아니라 **레일이 무엇을 측정하느냐**다. Cerebro는 가격만 보다가 납기에서 졌다. 다차원 효용(가격, 시간, 프라이버시 비용)을 검증하는 레일이 더 깊은 기술적 깊이를 보여 준다.

3. **연구는 "합의율은 틀린 지표"라는 데 모였다**(CalBench, SovereignNegotiation-Bench, Liang & Xu, Magentic). 해커톤 데모에서도 "합의했다"가 아니라 **"사용자 효용, 누출된 정보량, 무단 커미트 0건, 지연 손실"을 대시보드로 보여 주면** 심사의 기술적 깊이와 임팩트 항목을 동시에 공략할 수 있다. 오픈소스인 Magentic Marketplace나 CalBench 시나리오 위에서 자기 에이전트를 측정하면 신뢰도가 크게 오른다.

4. **A2A 프라이버시 협상 프로토콜은 공백이다.** MLCommons R3.1이 직접 명시했다. Cerebro v07의 "비공개 min/max → 겹치는지만 판정 → 중간값이 아닌 가격 제시"는 작지만 재사용 가능한 해법이다. 이를 **일정(가능한 시간대 교집합만 노출), 가격(예약가 비노출), 데이팅(속성 일치만 노출)**으로 일반화한 "선택적 공개 핸드셰이크"는 누구도 상품화하지 않았다. 오픈웨이트 모델(Llama 계열 등)을 로컬이나 기기에서 돌려 *비밀은 내 기기에 두고 결론만 교환*하는 구조로 만들면 Meta 오픈웨이트 활용과 프라이버시 서사가 일치한다.

5. **신원, 사칭, AI 고지는 해결되지 않은 신뢰 레이어다.** 호텔 에이전트가 "AI 아님"이라고 거짓말했고, 기념일을 지어낼 수 있으며, Victor는 경력을 부풀렸다. Google은 사전 고지를 했고 Rec은 "agent passport"를 제안했지만 업계 합의는 없다(NYMag). **검증 가능한 주장**(haggl의 DKIM 증거처럼 출처를 증명하는 claim)과 **에이전트 고지·위임 범위 증명서**를 결합한 경량 표준을 데모하면 차별화된다.

6. **피해야 할 과포화 아이디어**:
   - 범용 개인 비서
   - 대신 전화해 예약하기
   - 단방향 가격 흥정 봇
   - 에이전트 데이팅 시뮬레이션(Pixel Societies류. 궁합 예측력에 대한 학계 반론이 있다)
   - A2A 채용 마켓플레이스(JobClaw류. 과장 마케팅이 많고 Victor 같은 실패 사례가 이미 화제다)
   - 크립토 escrow 협상(Haggle Protocol. 대중 데모로는 약하다)

7. **동의 UX가 다음 병목이다.** 매번 묻으면 consent fatigue(R4.2)가 오고, 묻지 않으면 Muse 제3자 프로필링이나 숨은 인간 처리 같은 스캔들이 난다. Instinct 그룹챗의 "개인 에이전트와 그룹 에이전트 분리, 새 멤버가 오면 보류"는 좋은 출발점이다. **위험도에 따라 승인을 묶어 주는 정책(예: 이 상대와는 이 범위까지 자동 허용) + 사후 감사 요약**은 열려 있는 문제다. Muse Image나 SAM 3.1로 영수증, 견적서, 사진 증거를 구조화해 "근거가 붙은 승인 카드"를 만드는 것도 Meta 툴링 활용 포인트가 될 수 있다.

8. **배포와 마찰이 기술보다 중요하다(Cerebro의 가장 비싼 교훈).** 가장 잘 만든 에이전트 마켓에서 거래가 1건이었다. "사용자가 에이전트라면 에이전트까지 도달해야 한다." 해커톤에서는 상대측 에이전트도 직접 만들어 **양쪽이 실제로 맞물리는 라이브 데모**를 보여 줘야 한다. 한쪽만 있는 데모는 설득력이 없다. WhatsApp이나 Muse처럼 이미 사람이 있는 채널에 붙이는 것이 콜드스타트 해법이다.

9. **누가 비용을 내나 / 공유지의 비극.** agentic flooding(무한 재시도, 예약 스나이핑, 대량 청구)은 사업자와 공공이 비용을 지고 사용자가 이득을 보는 구조다. **에이전트 트래픽을 "덜" 만드는 협조형 설계**가 차별화된 임팩트 서사가 된다. 예를 들어 여러 사용자 에이전트의 요구를 모아 한 번에 협상하는 집단 구매·집단 일정 에이전트, 추첨이나 대기열 프로토콜을 지키는 에이전트가 있다. 리스크는 낮고 공공성은 높다.

10. **권장 방향 (종합)**: "**Muse(또는 오픈웨이트) 기반 개인 에이전트 ↔ 소상공인 에이전트** 사이의 *선택적 공개 협상 핸드셰이크*"를 제안한다. 구성은 다음과 같다:
    - (a) 비공개 한도는 겹치는지만 판정
    - (b) 코드 레일로 다차원 효용 검증
    - (c) AI 고지와 위임 범위 증명
    - (d) 위험도 기반 HITL 승인 카드
    - (e) CalBench나 Magentic 스타일의 누출·효용 대시보드

    이 조합은 공개된 제품과 해커톤 출품작 어디에서도 통째로 구현된 적이 없다(조사 범위 내). 각 요소에는 위에 인용한 근거가 있다.
