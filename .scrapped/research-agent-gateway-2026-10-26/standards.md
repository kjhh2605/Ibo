# 에이전트 신원·권한·접근 표준과 경쟁 제품 갭 분석

기준일 2026-10-26. 표기: **[확인]** 원문 직접 열람, **[스니펫]** 검색 결과 요약으로만 확인, **[미확인]** 확인 실패, **[로컬·미재확인]** 로컬 리서치(research-ai-era-apps-2026-10-26)에서 가져왔고 이번에 재확인하지 못함, **[추론]/[제안]** 사실이 아닌 판단.

8개 축: ①에이전트 신원 ②사용자→에이전트 위임 범위 검증 ③요청 목적·의도 선언 ④제3자·타 사용자 데이터 노출 최소화(맥락별 추상화) ⑤감사·영수증·변조 불가 기록 ⑥무차별 요청 억제(rate limit·비용·평판) ⑦AI 고지 ⑧결제

---

## 0. 결론 먼저

1. **①②⑥⑧은 이미 붐빈다.** 신원(Web Bot Auth, KYA), 위임(OAuth·MCP auth·Okta XAA·AP2 mandate), 남용 억제(Cloudflare·DataDome·Akamai), 결제(ACP·AP2·TAP·Agent Pay·x402) 모두 표준과 상용품이 있다.
2. **비어 있는 것은 ③(결제 밖의 목적 선언)과 ④(타 사용자 데이터의 맥락별 추상화)다.** ⑤는 결제(AP2, Mastercard Verifiable Intent), 게이트웨이 플러그인(VeriKnox), 개인 IETF 초안(SCITT 영수증, Agent Passport System)이 빠르게 채우는 중이다.
3. **Meta가 공동 주도하는 Personal Agent Protocol(Poppy) Draft 0.3이 원안의 "기업이 정한 통로로만 조작" 구도를 이미 표준화하고 있다.** 10/9에 OpenAI·Visa·Mastercard·Cloudflare·Okta 등 35곳이 디자인 파트너로 합류했다. Poppy에 없는 것은 목적 선언, 타 사용자 데이터 공개 정책, 서명된 영수증, 비용·평판 기반 억제다.
4. **원안의 일정 예시는 앱 안에서는 이미 풀린 문제다.** Google Calendar `freebusy`는 busy 구간만 주고, Microsoft Graph `getSchedule`은 열람 권한에 따라 제목·장소를 주거나 상태만 준다. 새로운 것은 이를 **외부 에이전트에게, 목적에 따라, 앱 공통 규칙으로 강제하고 증빙을 남기는 계층**이다.
5. **④+⑤+⑥을 앱 데이터 계층에서 묶은 제품·표준은 찾지 못했다.** 그러나 부품(PII 마스킹 게이트웨이, 서명 영수증, rate limit)은 모두 상용품이고, Cloudflare·Kong·agentgateway·Poppy 작업반이 수개월 안에 메울 수 있는 자리다. 해자는 약하다 [추론].
6. 그래서 **새 프로토콜보다 "Poppy 확장 프로필 + 회사 측 게이트웨이(프록시) 레퍼런스 구현"**을 권한다 [제안]. 블록체인 대신 SCITT·Certificate Transparency식 해시 체인 투명성 로그가 프라이버시와 양립한다 [제안].

---

## 1. 항목별 요약

### 1.1 Personal Agent Protocol(Poppy)

- **무엇**: 개인 에이전트가 기업을 발견(`/.well-known/poppy.json`)하고, 사용자를 로그인시키고, API(OpenAPI/MCP)·웹·기업 에이전트 대화로 일하게 하는 개방형 프로토콜. Apache 2.0 [확인] https://personalagentprotocol.org/ (10-26 열람)
- **누가**: Sierra와 Meta. 10/6 발표 때 파트너는 Genesys·Instinct·NiCE·Rocket·Shopify·Stripe·Walmart [확인] https://sierra.ai/blog/introducing-personal-agent-protocol (2026-10-06). 10/9 초안 공개와 함께 35곳이 추가됐다 [확인] https://sierra.ai/blog/poppy (2026-10-09) · https://personalagentprotocol.org/docs/path-to-1
  - 개인 에이전트: Instinct·Meta·**OpenAI**
  - 기업: Bank of America·Target·United·Wells Fargo 등
  - 기술: Cloudflare·Okta·Visa·Mastercard·Stripe·Plaid·1Password 등
  - Anthropic·Google·Amazon·Apple은 목록에 없다. 로컬 리서치의 "OpenAI 미참여"(10/6 CNBC)는 10/9부로 바뀌었다.
- **상태**: Draft 0.3이고, 1.0 전까지 호환성이 깨질 수 있다. Sierra는 레퍼런스 구현을 "다음 달 안에" 공개한다고 했다(10/9 기준). **해커톤 기간에 나올 수 있다.** GitHub는 문서 사이트와 회사용 키트(JSON Schema, validator)뿐이고 "APIs를 구현하지 않는다"고 명시한다. 52 stars [확인] https://github.com/personal-agent-protocol/personal-agent-protocol
- **스펙 원문 대조** [확인] https://personalagentprotocol.org/docs/0.3/spec
  - *discovery*: poppy.json(`auth.scopes/scope_hints`, `agent.protocols`, `apis`, `web.browser_session_endpoint`, `excluded_tasks.url`, `extensions` 등)
  - *신원*: `client_id`는 메타데이터 문서를 주는 HTTPS URL이고 인증은 `private_key_jwt`, 세션마다 새 키를 쓴다. User ID는 회사마다 다른 opaque 값이다. 등록 절차는 범위 밖이고, 회사는 허용·차단 목록을 둘 수 있다(MAY).
  - *위임*: Direct(PKCE), Device(RFC 8628), Mediated(자격증명 전달, 과도기 한정 SHOULD). 스코프는 회사가 정의하고 DPoP(RFC 9449)로 바인딩하며, 권한이 부족하면 다시 로그인한다.
  - *접근 단계*: 홈페이지의 "차단→검색→조회→승인 후 예약→전체 권한"은 **예시일 뿐**이다. 스펙은 스코프와 `scope_hints`(changes, personal_data)로만 표현한다.
  - *AI 고지*: 메시지에 `author.type = agent|human`을 붙이고, 사용자 말의 요약·번역은 `agent`로 표기한다(7.8).
  - *감사·영수증*: 없다. 로그 조항은 "토큰을 로그에 남기지 말라"뿐이다.
  - *제3자 데이터*: 에이전트 쪽 "SHOULD share only what the task needs"뿐이고, **회사가 다른 고객 데이터를 어떻게 다룰지는 없다**.
  - *rate limit*: 429+`Retry-After`(MUST 준수), client_id별 세션 제한, 오용한 client_id 폐기.
  - *결제·목적*: 없다. 결제·첨부(영수증)·자가호스팅은 Path to 1.0의 open topic이다.
  - *웹 브라우징(5장)*: 일회용 코드와 서명 증명으로 브라우저를 세션에 묶는다. computer-use 에이전트를 식별된 세션 안으로 끌어들이는 장치다 [추론].
- **operations 확장(공식)**: 에이전트가 revision을 confirm하면(`approved_by: user | standing_permission`) 회사는 같은 작업을 최대 한 번 수행한다. 그러나 스펙 스스로 "doesn't prove that the User saw the terms or approved them"라고 쓰고, 서명·해시·영수증은 없다 [확인] https://personalagentprotocol.org/docs/0.3/extensions/operations
- **원안과 직결되는 열린 이슈** [확인] https://github.com/personal-agent-protocol/personal-agent-protocol/issues
  - #18 첨부(영수증)
  - #37 x402 witnessed receipt(10/25)
  - #39 standing_permission이 신뢰 기반이라는 문제와 ZK 증명 확장 제안(10/26)
  - #25 verified human signal
  - #31 자가호스팅 에이전트 프라이버시

### 1.2 Meta Muse와 Muse Connector Platform

- **Muse** [확인] https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ (2026-09-08, 09-30 갱신)
  - Sentinel이 시스템 수준으로 분리되어 있다: "Nothing Muse does reaches the internet unless the Sentinel approves it."
  - 사용자에게 "complete audit trail"을 보여 주고, 민감한 행동 전에 확인을 받는다. 결제는 Link 일회용 카드다.
  - 웹사이트에 자신을 어떻게 식별하는지(서명, AI 고지)는 **언급이 없다**.
  - Amazon은 9/20 Muse를 막고 "Continued access by an unauthorized AI agent violates Amazon's Conditions of Use"라는 메시지를 띄웠다 [확인] https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/
  - Muse의 감사·승인은 사용자 측 안전장치이고, 상대 기업이 검증할 수 있는 증빙은 아니다 [추론].
- **Connector Platform 등재 요건** [확인] https://platform.muse.ai/docs
  - OAuth 연결 시 Read Only 옵션(§3.1)
  - 툴별 최소 데이터. 판매·무관 광고·프로파일링·민감 특성 추론·학습 금지(§4.2)
  - 사용자별 격리, 로그에 비밀정보 금지(§4.4). 48시간 내 사고 통지(§4.8)
  - 문서에 rate limit 기재(§5.4)
  - 보안·프라이버시 심사, 민감한 쓰기가 매번 승인을 요구하는지 E2E QA(§6)
  - Poppy, 요청 서명, 감사 의무는 **없다**. 폼은 MCP 엔드포인트를 받고, 인증은 API key / OAuth with PKCE 중 고른다 [스니펫] https://stacktr.ee/blog/muse-connector-platform

### 1.3 Web Bot Auth 계열과 Cloudflare

- **RFC 9421**(HTTP Message Signatures, Proposed Standard, 2024) [확인] https://www.rfc-editor.org/rfc/rfc9421
- **IETF webbotauth WG**: 자동화 클라이언트가 웹사이트에 암호학적으로 인증하는 것을 다룬다 [확인] https://datatracker.ietf.org/wg/webbotauth/about/
  - **헌장이 명시한 범위 밖**: 최종 사용자 인증, HTTP API·agent-to-agent 인터페이스, **의도·목적 어휘**, **봇 추적·평판**.
  - 마일스톤은 2026-04-30 IESG 제출이었지만 WG 문서는 `draft-ietf-webbotauth-httpsig-protocol-00`(09-01) 하나뿐이다. 지연 [확인] https://datatracker.ietf.org/wg/webbotauth/documents/
- **개인 초안**
  - `draft-meunier-webbotauth-registry-03`(Cloudflare·Amazon, 06-26): Signature Agent Card에 `purpose`(AIPREF 어휘), `trigger`(fetcher/crawler), `rate-expectation`(형식 TODO)이 있다 [확인]
  - `draft-rescorla-anonymous-webbotauth-01`(07-19): 익명 자격증명으로 봇별 rate limit을 건다. 감사와 허용 목록은 불가 [확인] https://datatracker.ietf.org/doc/draft-rescorla-anonymous-webbotauth/
- **Cloudflare**
  - signed agents(2025-08-28): 사용자가 지시하는 에이전트를 Web Bot Auth로 분류 [확인] https://blog.cloudflare.com/signed-agents/
  - 2026-09-30 발표: 인간 트래픽이 절반 아래로 내려갔고, AI 에이전트 일일 요청은 1,700% 넘게 늘었다. verified bot 요청은 주당 5,000억 건 이상이다. Search/Agent/Training 제어, Pay Per Use, x402 Monetization Gateway(클로즈드 베타)를 내놨고 "Every paid request leaves a receipt"라고 썼다 [확인] https://blog.cloudflare.com/agentic-web/
  - 2026-10-16: robots.txt·429 준수로 설명 가능한 trust band를 매기고 Radar에 공개할 예정 [확인] https://blog.cloudflare.com/verified-bots-accountability/
- **Google**도 Google-Agent 요청에 Web Bot Auth 서명을 시험 중이다 [스니펫] https://searchenginejournal.com/google-testing-web-bot-auth-to-verify-ai-agent-requests/573949/

### 1.4 결제·커머스 레일

- **Visa TAP**: RFC 9421 서명을 가맹점 도메인과 작업에 바인딩한다. 소비자 식별자는 "as consented" 범위에서만 공유한다 [확인] https://github.com/visa/trusted-agent-protocol . 의도 태그는 `agent-browser-auth`/`agent-payer-auth` [확인] https://blog.cloudflare.com/secure-agentic-commerce/ (2025-10-24)
- **Mastercard**
  - Agent Pay에 Web Bot Auth를 통합했다 [확인: 같은 글]
  - **Verifiable Intent**(03-05 발표 [스니펫]): SD-JWT 3계층(L1 발급자 서명 신원, L2 사용자가 에이전트에 건 제약, L3 네트워크·가맹점용 분할 증명)으로 금액·가맹점·품목 제약을 걸고 역할별로 선택 공개한다. Draft v0.1 [확인] https://github.com/agent-intent/verifiable-intent
  - Google은 이를 "tamper-proof log of user-authorized agent actions"라고 소개했다 [확인] https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/ (04-28)
- **Skyfire KYAPay**: JWT에 사람(`hid`)·플랫폼(`apd`)·에이전트(`aid`) 클레임을 담는다. `scope`은 의미가 정의되지 않았고 목적·감사·선택 공개도 없다 [확인] https://www.ietf.org/archive/id/draft-skyfire-oauth-kyapay-token-00.html (07-05)
  - Experian Agent Trust(04-30) [스니펫]
  - DataDome이 Experian 생태계에 합류(10-01) [확인]
- **AP2**: Checkout·Payment Mandate를 VDC 체인으로 묶고 "non-repudiable, cryptographic audit trail"을 주장한다. v0.2와 FIDO 기증은 04-28 [확인] https://ap2-protocol.org/
- **ACP**: "open standard created by Stripe, OpenAI, and Meta". checkout, delegate payment/authentication, 주문 웹훅. 스펙 2026-04-17 [확인] https://docs.stripe.com/agentic-commerce/protocols/acp
- **UCP**: Google·Shopify 등. OAuth identity linking과 AP2 mandate를 쓴다. rate limit과 AI 고지는 없다 [확인] https://ucp.dev/

### 1.5 에이전트 프로토콜

- **A2A v1.0**(03-12) [확인] https://a2a-protocol.org/latest/specification/
  - Signed Agent Card(JWS+JCS), 매 요청 인가(MUST)
  - "SHOULD provide audit trails", "SHOULD implement rate limiting"
  - AI 고지는 없다.
- **MCP Authorization**(현행 2026-07-28): OAuth 2.1, PRM·RFC 8707 MUST, CIMD SHOULD(DCR deprecated), step-up. 목적·감사·rate limit은 없다 [확인] https://modelcontextprotocol.io/specification/latest/basic/authorization
- **WebMCP**(W3C Draft CG Report, 10-20) [확인] https://webmachinelearning.github.io/webmcp/
  - 에이전트가 사용자 세션과 쿠키를 그대로 상속한다.
  - 파라미터가 많은 툴로 사용자 데이터를 빼낼 수 있다고 스펙 스스로 경고한다.
  - 사이트가 에이전트 호출을 식별하는 장치는 확인하지 못했다 [미확인].
- **AAIF**(10-22 기준 10개 프로젝트): 신원·위임·감사 전용 프로젝트는 없고, Poppy는 AAIF 밖이다 [확인: 목록] https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-four-new-projects-agent-skills-open-responses-openenv-and-opensandbox

### 1.6 봇·신원 벤더

- **DataDome Agent Trust**: 신원 검증, 세션 전체의 "continuous intent verification", 100점 trust score [스니펫]. Experian 발표에서는 에이전트 행동이 "consistent with delegated authority"인지 평가한다고 했다 [확인] https://www.experianplc.com/newsroom/press-releases/2026/datadome-joins-experian-agent-trust--ecosystem-to-add-continuous (10-01). Forrester는 카테고리 이름을 "Bot and Agent Trust Management"로 바꿨다 [스니펫].
- **Akamai** Agentic Security Framework(06-15): 신원·인간 귀속, adaptive trust, 엣지 집행, KYA, TollBit·Skyfire 과금. 마스킹·감사·AI 고지 언급은 없다 [확인] https://www.akamai.com/newsroom/press-release/akamai-unveils-agentic-security-framework-to-power-trusted-ai-driven-interactions-and-commerce
- **HUMAN**: AgenticTrust(2025-07), 오픈소스 Verified AI Agent(RFC 9421) [스니펫]
- **Okta** Agent SSO GA(08-24): 기업 앱 대상이고 소비자 개인 에이전트는 다루지 않는다 [확인] https://okta.com/newsroom/press-releases/okta-brings-first-class-identity-to-ai-agents-with-agent-sso/
- **Auth0 for AI Agents**: Token Vault, CIBA 승인, FGA for RAG [스니펫]
- **Stytch**: IsAgent, Connected Apps [스니펫]
- **WorkOS**: AuthKit for MCP [스니펫]
- **국내**: 라온시큐어 '원액세스'(에이전트별 식별자와 VC 기반 권한) [스니펫] https://byline.network/2026/07/3-425/

### 1.7 MCP·AI 게이트웨이

- **Kong**
  - AI Gateway 3.14(04-14): "Full audit logging of A2A conversations" [확인]
  - AI PII Sanitizer [스니펫]
  - 서드파티 **VeriKnox** 플러그인: LLM·MCP·A2A 요청과 응답마다 Ed25519+ML-DSA-65로 서명한 영수증을 만들고, 정책을 위반하면 403으로 막는다. 투명성 로그 언급은 없다 [확인] https://developer.konghq.com/plugins/veriknox/
- **agentgateway**(AAIF/LF): MCP·A2A·LLM 프록시. JWT/OIDC, 툴 스코핑, "tamper-evident audit logs", prompt redaction, rate limit [확인] https://agentgateway.dev/
- **기타**: Gravitee(PII 필터, 06-26), Lasso(Presidio 마스킹), Docker MCP Gateway(`--block-secrets`, `--log-calls`), Obot(OAuth·툴 정책·감사) [모두 스니펫]
- **공통 한계**: 마스킹은 PII 유형 패턴 방식이다. 대부분 기업 내부 에이전트의 egress 보호용이다 [추론]

### 1.8 집중 검색: "외부 에이전트에게 타 사용자 데이터를 맥락별로 추상화해 응답"

영어와 한국어로 검색했지만 이 기능을 내세운 제품·표준은 찾지 못했다. 가까운 것은 넷이다.

- **(a) 앱 내장 기능**
  - Google `freebusy.query`: busy 구간만 반환 [확인] https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
  - Graph `getSchedule`: 한 응답 안에서도 사람에 따라 subject·location을 주거나 status만 준다 [확인] https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
- **(b) 연구**: Abdelnabi 외 "Firewalls to Secure Dynamic LLM Agentic Networks"(TMLR 2026, v7 06-23) [확인] https://arxiv.org/abs/2502.01822 . 코드 공개.
  - Data Abstraction Firewall이 과업별 규칙으로 공개 세분도를 조정한다("binary disclose-or-redact"를 넘어섬).
  - GPT-5의 프라이버시 공격 성공률을 84%에서 10%로 낮췄다.
  - 단 **사용자 측** 관점이고 제품이 아니다.
- **(c) 수신 측 게이트웨이**
  - Aimdoc Agent Gateway(08-17): 공개 에이전트만 노출하고, 자기신고 신원은 "unverified hints"로 취급하며, 트래픽 한도와 세션 로그가 있다 [확인] https://aimdoc.ai/blog/agent-gateway-new-website-front-door
  - Lorikeet B2A: Poppy 지원을 표방하지만 통제 기능은 공개되지 않았다 [확인] https://www.lorikeetcx.ai/blog/personal-agent-protocol
- **(d) 진단**: MLCommons Agent Privacy Risk Taxonomy v0.1(10-01) [확인: ppc.land 경유] https://ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents/
  - R3.1: "no unified protocol to negotiate privacy constraints in A2A"
  - R1.7: MCP에 필드 단위 접근 제어가 없다

### 1.9 2026 하반기 유사 시도 (최신순)

| 날짜 | 시도 | 근거 |
|---|---|---|
| 10-26/25 | Poppy #39 ZK `verifiable_permissions`, #37 witnessed receipt | [확인] |
| 10-16 | Cloudflare verified bot trust band | [확인] |
| 10-09 | Poppy 초안과 파트너 35곳 | [확인] |
| 09-28 | `draft-pidlisnyi-aps-04` Agent Passport System(개인 초안): 신원, 주체 결합, 7개 facet 위임 축소, intent·결정·결과 서명 영수증, MCP/A2A/OAuth 바인딩 | [확인] https://datatracker.ietf.org/doc/draft-pidlisnyi-aps/ |
| 09-01 | AIR $50M "firewall for agents"(에이전트를 입력 공격에서 보호하는 쪽) | [스니펫] |
| 09 | `draft-ietf-wimse-aims-00`(WIMSE 채택, OpenAI·Okta 등 저자) | [스니펫] |
| 08-15 | `draft-noa-scitt-ai-agent-receipt-01`: 행동 영수증을 해시 체인과 SCITT Signed Statement로 등록. 원문 대신 해시, "does not claim that the agent was correct" | [확인] https://www.ietf.org/archive/id/draft-noa-scitt-ai-agent-receipt-01.html |
| 06~07 | Workday Agent Passport, ServiceNow AI Passport(기업 내부용), ITU 에이전트 신원 작업 착수 | [스니펫] |
| 참고 | ERC-8004(온체인 신원·평판·검증 레지스트리, 2026-01 메인넷 보도, 날짜 불일치) | [스니펫] |

---

## 2. 8개 축 × 항목 매트릭스

●완전 ◐부분 ○없음 ?확인불가. ●는 그 항목의 적용 영역 안에서 해당 축을 정면으로 다룬다는 뜻이다(예: AP2의 ⑤는 결제 승인 범위에 한정). 근거는 1장의 해당 항목에 있다.

| 항목 | ①신원 | ②위임 | ③목적 | ④제3자 | ⑤영수증 | ⑥억제 | ⑦고지 | ⑧결제 |
|---|---|---|---|---|---|---|---|---|
| Poppy Draft 0.3 | ● | ●/◐ᵃ | ○ | ○ᵇ | ◐ᶜ | ◐ | ● | ○ |
| Meta Muse(사용자 측) | ? | ◐ | ○ | ○ᵈ | ◐ | ○ | ? | ● |
| Muse Connector 요건 | ◐ | ◐ | ○ | ◐ᵉ | ○ | ○ | ○ | ◐ |
| Web Bot Auth(+WG, Agent Card) | ● | ○ | ◐ᶠ | ○ | ○ | ◐ | ◐ | ○ |
| Cloudflare 제품군 | ● | ○ | ◐ | ○ | ◐ | ● | ◐ | ● |
| Visa TAP | ● | ◐ | ◐ | ○ | ○ | ○ | ◐ | ● |
| Mastercard Agent Pay+VI | ● | ● | ● | ◐ᵍ | ◐ | ○ | ◐ | ● |
| Skyfire KYAPay(+Experian) | ● | ◐ | ○ʰ | ○ | ○ | ◐ | ◐ | ● |
| AP2 | ◐ | ● | ● | ◐ | ● | ○ | ◐ | ● |
| ACP | ◐ | ◐ | ○ | ○ | ◐ | ○ | ○ | ● |
| UCP | ◐ | ◐ | ◐ | ○ | ◐ | ○ | ○ | ● |
| A2A v1.0 | ● | ◐ | ○ | ○ | ◐ | ◐ | ○ | ○ |
| MCP Authorization | ◐ | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| WebMCP | ○ | ○ⁱ | ○ | ○ | ○ | ○ | ? | ○ |
| DataDome·Akamai·HUMAN | ● | ◐ | ◐ʲ | ○ | ○ | ● | ◐ | ◐ |
| Okta XAA / Auth0 | ●ᵏ | ● | ○ | ◐ᵏ | ? | ○ | ○ | ○ |
| Stytch / WorkOS | ◐ | ● | ○ | ○ | ○ | ○ | ◐ | ○ |
| MCP·AI 게이트웨이 | ◐ | ◐ | ○ | ◐ˡ | ◐ | ● | ○ | ○ |
| VeriKnox | ◐ | ◐ | ○ | ○ | ● | ◐ | ○ | ○ |
| SCITT 영수증 초안 | ◐ | ○ | ○ | ○ | ● | ○ | ○ | ○ |
| Agent Passport System 초안 | ● | ● | ◐ | ? | ● | ◐ | ? | ◐ |
| Data Abstraction Firewall(연구) | ○ | ○ | ◐ | ●ᵐ | ○ | ○ | ○ | ○ |
| Aimdoc / Lorikeet | ◐ | ◐ | ○ | ◐ | ◐ | ◐ | ? | ○ |
| ERC-8004 | ◐ | ○ | ○ | ○ | ◐ | ◐ | ○ | ○ |

**셀 주석**
- ᵃ 계정 스코프 위임은 ●이다. 그러나 개별 행동 승인은 `approved_by`가 신뢰에 기반해 증명되지 않는다(operations §8, #39).
- ᵇ 에이전트가 회사로 보내는 방향의 SHOULD 한 줄뿐이다. 회사 응답의 타 고객 데이터 규정은 없다.
- ᶜ 고정 revision과 1회 수행까지는 있다. 서명·영수증은 없고 첨부는 open topic이다.
- ᵈ WIRED는 Muse가 지인 "관계 페이지"를 만든다고 보도했다 [로컬·미재확인].
- ᵉ 커넥터가 Muse 사용자 데이터를 최소한으로 다루라는 규칙이다. 타인 데이터 추상화는 아니다.
- ᶠ 에이전트 단위로 스스로 신고하는 값이고, WG 헌장은 목적 어휘를 범위에서 뺐다.
- ᵍ 결제자 **본인** 정보의 역할별 선택 공개다.
- ʰ 초안에는 목적이 없다. 보도자료만 "의도 선언"을 주장한다.
- ⁱ 사용자 세션의 권한을 통째로 상속한다.
- ʲ 선언된 목적이 아니다. 행동으로 '의도'를 추정한다.
- ᵏ ①은 기업 내부 에이전트 한정이다. ④는 Auth0 FGA for RAG(사용자 권한에 따른 문서 필터)다. Agent SSO 페이지에는 감사 기능 설명이 없어 ⑤는 ?로 둔다.
- ⑦의 ◐는 대부분 사이트가 에이전트임을 **기계 수준에서 식별**한다는 뜻이다. 사람에게 알리는 고지는 Poppy `author.type` 정도만 해당한다.
- ˡ PII 유형 패턴 마스킹이다.
- ᵐ 사용자 측 연구이고 제품이 아니다.

---

## 3. 빈 칸 분석: 원안의 쐐기 후보

**열별 밀도** [추론]
- ①②⑥⑧: ●가 많다. 경쟁하면 진다.
- ⑦: Poppy `author.type`이 사실상 답이다. EU AI Act 제50조 투명성 의무도 2026-08-02부터 적용된다 [스니펫] https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026 . 고지만으로는 차별화되지 않는다.
- ⑤: 결제·게이트웨이·IETF 개인 초안에서 ●가 생기는 중이다.
- ③: 결제 의도만 ●이다. 데이터 접근의 목적 선언은 비어 있고, webbotauth는 이를 **명시적으로 범위에서 뺐다**.
- ④: 제품·표준 중 ●가 없다.

**아무도 다루지 않는 조합**
1. **③×④ 목적에 묶인 공개.** 같은 데이터를 목적과 관계에 따라 다른 세분도로 내준다. 예: 목적이 일정 조율이면 타인 일정은 busy·category 수준, 목적이 본인 예약 변경이면 본인 데이터 전체. 이를 위한 규칙 언어와 집행 지점이 없다.
2. **④×⑤ 공개 수준을 담은 영수증.** 기존 영수증 초안과 VeriKnox는 행동·판정·파라미터 해시를 담는다. "타인 데이터를 어떤 정책으로 어느 수준까지 공개했나"를 담는 필드는 없다.
3. **④×⑦ 의도적 비공개 표시.** 상대 에이전트가 "정보 없음"과 "정책상 비공개"를 구분하게 하는 기계 판독 표시가 없다.
4. **④×⑥ 누적 노출 예산** [추론]. 응답 하나를 마스킹해도, free/busy를 반복 탐침하면 타인의 생활 패턴을 재구성할 수 있다. 지금의 rate limit은 요청 수나 비용을 세지, 타인 정보에 대한 누적 노출을 세지 않는다.

**냉정한 판정: ④+⑤+⑥을 앱 데이터 계층에서 묶는 자리는 비어 있는가?**
- **제품·표준 단위로는 비어 있다.**
  - Poppy는 레일뿐이다(④○ ⑤◐).
  - 엣지 벤더는 HTTP 경계에서 멈추고 응답 데이터의 의미를 보지 않는다.
  - 게이트웨이(Kong+Sanitizer+VeriKnox, agentgateway)는 세 기능을 조립할 수 있다. 하지만 패턴 마스킹이고 egress 중심이며, 소비자 위임이나 "타 사용자" 개념이 없다.
- **부품 단위로는 비어 있지 않다.** 원안의 대표 예시(일정 마스킹)는 앱 내장 기능으로 이미 있다.
- **메워지는 속도가 빠르다** [추론]. Cloudflare와 Okta는 Poppy 파트너이면서 Workers·AI Gateway·FGA를 갖고 있다. agentgateway는 LF 산하에서 가드레일·감사·rate limit을 이미 갖췄다. Poppy 작업반은 영수증과 standing permission 검증을 지금 논의하고 있다.
- **결론**: 쐐기는 마스킹·로그·rate limit이라는 **기능**이 아니라 **의미 계층**이다. 목적·관계별 공개 정책 언어, 공개 수준을 담은 영수증, 누적 노출 예산을 Poppy 호환 게이트웨이로 처음 구현해 보이는 것이다. 스타트업 해자로는 약하지만, 해커톤 차별점과 Meta 정렬로는 충분하다 [추론].

**원안 전제 점검** [추론]: "computer-use는 막을 수 없다"는 절반만 맞다. Amazon은 실제로 Muse를 막았고, 엣지 벤더는 서명 없는 에이전트를 행동으로 거른다. 현실적인 구도는 채찍(엣지 봇 관리)과 당근(식별된 Poppy 통로의 더 나은 서비스)이다. 원안의 프록시는 당근 쪽에 집중해야 한다.

---

## 4. 새 프로토콜인가, 확장 프로필·게이트웨이인가 [제안]

**확장 + 게이트웨이 쪽 근거**
1. **네트워크 효과.** Poppy는 해커톤 주최사 Meta가 공동 주도하고, OpenAI·Instinct·Visa·Mastercard·Okta·Cloudflare가 붙어 있다. 새 프로토콜은 콜드스타트에서 진다. 로컬 리서치의 Cerebro 사례에서 가장 잘 만든 마켓의 거래가 1건뿐이었다 [로컬·미재확인].
2. **Poppy가 확장을 요청하고 있다.** 열린 주제와 이슈(#18, #37, #39, #25)가 원안의 빈칸과 겹치고, 레퍼런스 구현도 아직 없다. "첫 회사 측 구현 중 하나"가 될 여지가 있다.
3. **목적·평판은 HTTP 계층 표준에 들어갈 수 없다.** webbotauth 헌장이 둘 다 범위 밖이라고 정했다. 앱 계층(Poppy 세션·operation)이 자연스러운 자리다.
4. **결제는 AP2·Verifiable Intent·ACP를 참조만 한다.**
5. **블록체인은 비용과 프라이버시 문제가 있다.** "누가 누구의 데이터를 언제 조회했나"를 공개 체인에 올리면 그것 자체가 메타데이터 유출이고, 삭제 요구와도 충돌한다. 대안은 세 겹이다.
   - 해시 체인에 서명한 영수증을 쓴다(SCITT 초안 형식).
   - Merkle 체크포인트를 공개해 사후에 변조를 검증하게 한다.
   - 필요하면 체크포인트 해시만 공개 체인에 앵커링한다.

**반론(새 프로토콜 쪽)**
- Poppy의 데이터 모델은 "로그인한 본인 계정" 중심이고 **타 사용자 개념이 없다**.
- 개인 사이의 일정 중개는 A2A에 더 가깝다.
- 다만 둘 다 "개념 추가 + A2A 바인딩"으로 풀 수 있어, 새 프로토콜을 만들 근거로는 약하다.

**권장안**(작업명 *Poppy Disclosure & Receipts Profile*)
- **purpose**: 세션과 operation에 목적을 선언한다(AIPREF 확장 + 과업 타입). 목적을 밝히지 않으면 공개 수준을 최저로 둔다.
- **disclosure policy**: poppy.json에 데이터 클래스별·관계별 공개 수준을 선언한다(예: `third_party.calendar: busy|category|detail`). 응답에는 의도적 비공개 표시를 넣는다.
- **receipts**: 읽기·쓰기마다 JWS/COSE 서명 영수증을 발행한다. 요청 해시, 목적, 정책 ID, 공개 수준, 판정을 담고 해시 체인으로 묶는다. SCITT 등록은 선택이다.
- **quotas**: 주체·목적·대상별 누적 노출 예산을 두고 429와 함께 쓴다. x402는 선택이다.
- **집행**: 기존 API·MCP 앞에 두는 게이트웨이(원안의 "프록시")가 맡는다. 판정은 결정적 정책 엔진이 하고, LLM은 자연어 요약에만 쓴다. 외부 메시지를 보는 모델과 공개를 결정하는 부분을 분리한다(Firewall 연구의 교훈).

---

## 5. 가장 가까운 경쟁자 3개와 차별점

| # | 경쟁자 | 겹침 | 차별점 | 위협 |
|---|---|---|---|---|
| 1 | **Poppy + 회사 측 구현(Sierra, Lorikeet)** | 기업 통제 통로, 에이전트 식별, `author.type`, 429 | ③④와 서명된 ⑤, 타 사용자 개념을 **확장 + 게이트웨이**로 채운다. 경쟁이 아니라 기여로 포지셔닝 | 높음: 레퍼런스 구현이 11월 초 나올 수 있고, 영수증·검증 확장이 진행 중 |
| 2 | **엣지 Bot & Agent Trust(Cloudflare, DataDome, Akamai, HUMAN)** | ①⑥⑦ 강함. 유료 요청 영수증, trust band | HTTP 경계에서 멈춘다. 응답 데이터를 목적·관계별로 추상화하지 않고, 데이터 접근 영수증도 없다. 우리는 **앱 데이터 계층**에 있다 | 중~높음: Cloudflare가 Poppy 파트너이고 Workers·AI Gateway가 있다 |
| 3 | **MCP·AI 게이트웨이(Kong+Sanitizer+VeriKnox, agentgateway, Gravitee, Lasso)** | ④(패턴), ⑤(서명 영수증), ⑥ 조립 가능 | egress용 패턴 마스킹이다. 관계·목적별 세분도, 소비자 위임, 의도적 비공개 표시, 누적 노출 예산이 없다 | 중간: inbound로 돌려 쓸 수 있고 agentgateway는 LF 산하 |

차점자는 두 가지다.
- 결제가 들어가면 **Mastercard Verifiable Intent·AP2**가 ②③⑤를 이미 해결했다. 만들지 말고 연동한다.
- 기법의 선행 연구는 **Data Abstraction Firewall**(TMLR 2026)이다. 심사에서 "이미 있는 연구"라는 질문이 나올 수 있다. 이 연구는 사용자 측이고 우리는 데이터 보유자(회사) 측의 표준 통로라는 차이를 분명히 해야 한다.

---

## 6. 팀 합의 포인트와 미확인 사항

**합의 포인트** [제안]
1. Poppy 위에 지을지(권장) 정한다.
2. 데모 도메인을 하나로 고른다. 일정은 freebusy가 이미 있으므로 "목적별 세분도 + 누적 예산"을 보여 주지 못하면 약하다.
3. 영수증 저장 방식을 정한다. 해시 체인과 체크포인트를 쓰고, 블록체인은 앵커링만 한다.
4. 공개 판정은 결정적 엔진이 맡고, LLM은 어디까지 허용할지 정한다.
5. Sierra 레퍼런스 구현이 나오면 맞출지 정한다.

**미확인 사항**
- Muse가 웹 요청에 서명하거나 AI임을 고지하는지
- WebMCP에서 사이트가 에이전트 호출을 식별할 수 있는지
- DataDome 원문(403)
- Verifiable Intent 발표일
- ERC-8004 메인넷 날짜
- NYMag "agentic flooding"과 Rec CEO의 "agent passport" 발언(nymag 접근 불가)
- 로컬 리서치의 Amazon "operate openly" 인용은 TechCrunch 원문에서 확인되지 않음(오류 메시지만 확인)
