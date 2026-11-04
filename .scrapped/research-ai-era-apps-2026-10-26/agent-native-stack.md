# Agent-Native Stack 조사: "사람이 아니라 에이전트가 앱을 조작하는" 시대의 제품·프로토콜·인프라 (2025–2026)

> 기준일: 2026-10-26. 최신순 우선. 각 항목 = 무엇 · 왜 중요한가(AI 시대 앱 관점) · 신호(성숙도/채택) · **10일 해커톤에서 할 수 있는 것** · 출처 · 날짜.
> 표기: `[unverified]` = 1차 출처에서 직접 확인하지 못한 수치·주장. `[secondary]` = 2차 매체/블로그 수치.

---

## 0. 한 장 요약 – 스택 지도 (2026년 10월 현재)

| 계층 | 사실상 표준/주요 플레이어 | 상태 |
|---|---|---|
| 개인 에이전트(수요측) | Meta **Muse**, **Instinct**, OpenAI **Dots**, Chrome Gemini auto browse, Perplexity Comet | 2026년 9월에 폭발적으로 늘어남. 이제 "앱"이 아니라 "문자/전화/WhatsApp"이 인터페이스가 됨 |
| 개인 에이전트 ↔ 기업 | **Personal Agent Protocol(Poppy)** – Meta+Sierra (draft), Visa **Trusted Agent Protocol** | 초안·경쟁 단계 → 표준이 아직 정해지지 않음 |
| 에이전트 ↔ 에이전트 | **A2A v1.0**(AAIF), Instinct-to-Instinct(폐쇄형) | 엔터프라이즈 중심. 소비자 간(P2P) 협상 표준은 비어 있음 |
| 에이전트 ↔ 도구/데이터 | **MCP**(+MCP Apps), **WebMCP**, NLWeb, AGENTS.md, llms.txt, Agent Skills | MCP는 사실상 표준. Meta도 MCP 서버·커넥터를 채택함 |
| 에이전트 UI | **MCP Apps**, A2UI, AG-UI, Builder.io **Agent-Native**, Thesys C1 | 2026년에 표준화됨(1월 MCP Apps 정식 출시) |
| 커머스/결제 | **ACP**(Stripe·OpenAI·**Meta**), **UCP**(Google·Shopify)+AP2, Stripe Link agent wallet/SPT, Visa/Mastercard/Amex, **x402** | 프로토콜이 난립함. 결제 의도(mandate)와 권한 증명이 아직 미완성 |
| 신원/접근 통제 | Cloudflare **Web Bot Auth**, Skyfire **KYA**, A2A Signed Agent Cards | IETF WG 채택. "에이전트도 고객"이라는 패러다임으로 넘어가는 중 |
| 헤드리스 인프라 | Browserbase, AgentMail, Composio | 시드~시리즈 A 단계에서 빠르게 성장 |

---

## A. Meta 자체 방향 (심사 항목 "Meta AI tooling 활용 25%"와 직결)

### A1. Meta **Muse** – 개인 에이전트 앱 (WhatsApp 안에서도 작동)
- **무엇**: 질문에 답하는 데 그치지 않고 실제 일을 하는 개인 에이전트입니다. 전용 클라우드 VM(Muse Secure VM)과 자체 브라우저로 폼을 채우고, 대신 협상하고, 이메일과 예약을 처리합니다. Muse 앱과 **WhatsApp** 양쪽에서 대화할 수 있습니다. 결제는 Stripe **Link**의 일회용 카드로 하고, 메일 발송·구매 같은 민감한 행동 전에는 사용자 승인을 받으며 감사 로그(audit trail)를 남깁니다. 별도의 **Sentinel agent**가 외부로 나가는 모든 행동을 승인합니다.
- **왜 중요한가**: "앱을 여는 대신 메신저로 에이전트에게 맡긴다"는 논제를 Meta가 수십억 명 규모로 공식화한 제품입니다. Meta의 설명에 따르면 Muse는 "can open a browser, fill out forms, and **negotiate on their behalf**"입니다. 사용자가 관찰한 '에이전트끼리 협상' 테제와 정확히 맞닿아 있습니다.
- **신호**: 2026-09-08 미국 출시. CNBC 보도 기준 App Store 1위로 ChatGPT를 앞섰고, Meta는 "미국 사용자 수백만 명"이라고 밝혔습니다. 9/17에 미국 기업 대상 전화 걸기 기능을 추가했습니다(TechCrunch). 반면 Amazon은 스크래핑 우려를 이유로 Meta 에이전트를 차단했습니다(CNBC).
- **10일 해커톤에서**: Muse 자체 API는 없습니다. 대신 Muse가 **호출할 대상**(커넥터·MCP 서버·Poppy 엔드포인트)을 만들거나, Muse 스타일 에이전트를 Muse Spark/Wonder로 직접 구현하는 방향이 현실적입니다. 데모에서 "Muse/WhatsApp에서 이렇게 불린다"를 보여주면 Meta 정합성이 커집니다.
- **출처**: https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ · https://www.cnbc.com/2026/10/06/meta-joins-companies-to-tame-chaos-of-doing-business-with-ai-bots.html · https://techcrunch.com/2026/09/17/rival-ai-agents-instinct-and-metas-muse-both-add-the-ability-to-make-calls/
- **날짜**: 2026-09-08 출시 / 2026-09-17 전화 기능 / 2026-10-06 CNBC

### A2. **Muse for Small Business** + **Muse Connector Platform**
- **무엇**: 소상공인용 Muse입니다. Asana, Canva, Figma, HighLevel, QuickBooks, Klaviyo, Notion, Shopify, Slack, Stripe, Zoom 커넥터와 FB/IG 비즈니스 계정을 연결해 "목표를 주면 실행"합니다. 커스텀 커넥터도 지원합니다. 외부 서비스는 **muse.ai/platform**에 커넥터를 제출해 Muse 디렉터리에 오를 수 있고, 결제는 Stripe Link와 제휴되어 있습니다.
- **왜 중요한가**: 앱스토어 다음의 유통 채널은 "개인 에이전트의 커넥터 디렉터리"라는 점을 Meta가 명시했습니다. SaaS의 고객 접점이 UI에서 커넥터로 옮겨가고 있습니다.
- **신호**: 2026-09-29 발표. 기존 커넥터 파트너가 다수입니다. 커넥터 제출은 심사(기능·보안·법무·E2E 테스트) 후 등재됩니다.
- **10일 해커톤에서**: 정식 등재까지는 어렵습니다. 대신 **커넥터 규격(OAuth+API/MCP)에 맞춘 서비스**를 만들고 "Muse 커넥터로 제출할 수 있는 형태"라고 주장하는 전략이 가능합니다.
- **출처**: https://about.fb.com/news/2026/09/introducing-muse-small-business/ · https://muse.ai/platform (→ platform.muse.ai)
- **날짜**: 2026-09-29

### A3. **Meta AI Connectors** + Meta AI의 **WebMCP** 지원 (Connect 2026)
- **무엇**: 기존 REST API나 **MCP 서버**를 Meta AI가 호출하는 도구로 등록하는 기능입니다. 한 번 통합하면 AI 안경(Ray-Ban Display), Meta AI 앱, 웹에서 모두 동작합니다. OAuth 계정 연결을 쓰고, 현재 developer preview로 대기자를 순차 선정합니다. 별도로 **WebMCP(developer preview)**를 쓰면 웹앱이 노출한 함수를 Meta AI가 호출해 "안경을 통해 답하는" 구조가 됩니다.
- **왜 중요한가**: Meta가 자사 어시스턴트의 확장 규격으로 **MCP와 WebMCP를 채택**했다는 점이 핵심입니다. 해커톤에서 MCP로 만든 결과물이 Meta 생태계 안으로 바로 이어집니다.
- **신호**: 2026-09-24 Meta Connect에서 발표. 공개 게시와 디스커버리는 "later phase"로 예정되어 있습니다.
- **10일 해커톤에서**: MCP 서버 하나로 Claude/ChatGPT/Meta AI(프리뷰가 승인될 경우)를 동시에 겨냥할 수 있습니다. WebMCP 웹앱을 만들어 Ray-Ban Display 시나리오로 데모하는 것도 가능합니다. 단 프리뷰 승인 여부는 불확실합니다 `[risk]`.
- **출처**: https://developers.meta.com/blog/meta-connect-recap/ · https://dev.meta.ai/products/connectors
- **날짜**: 2026-09-24

### A4. **Personal Agent Protocol ("Poppy")** – Meta + Sierra 주도
- **무엇**: 개인 에이전트가 기업을 **발견**(`/.well-known/poppy.json`)하고, 사용자가 기업 페이지에서 **OAuth로 로그인·권한 범위를 위임**하며, 하나의 세션으로 **API(OpenAPI/MCP)·웹페이지·기업 에이전트와의 대화**를 넘나드는 개방형 표준입니다. 대화에서는 양측이 "지금 말하는 쪽이 사람인지 AI인지"를 밝힙니다. 기업은 "차단 ↔ 검색만 ↔ 로그인 후 조회 ↔ 승인 후 예약 ↔ 전체 권한" 사이에서 단계를 고를 수 있습니다.
- **왜 중요한가**: 사용자가 말한 "**개인 에이전트 ↔ 비즈니스 에이전트**" 협상 구도를 Meta가 직접 표준화하고 있습니다. Meta MSL의 David Singleton은 이를 **이메일 같은 공용 레일**에 비유했습니다. 결제는 v0.1 범위 밖이고 향후 확장으로 남아 있습니다.
- **신호**: 2026-10-06 발표, 10-09 초안 공개. 파트너는 Genesys, Instinct, Rocket, Shopify, Stripe, Walmart입니다. OpenAI와 Anthropic은 아직 참여하지 않았습니다(CNBC). 사이트 예시는 protocol_version 0.3이고 "Path to 1.0"을 진행 중입니다. TNW는 Stripe와 Shopify가 Visa Trusted Agent Protocol에도 동시에 참여하고 있다는 점을 지적합니다.
- **10일 해커톤에서**: **가장 유망한 Meta 정렬 포인트**입니다. 예를 들어 (a) 소상공인용 "poppy.json + OAuth + MCP + 회사 에이전트(Muse Spark 기반)"를 원클릭으로 붙여주는 **Poppy-in-a-box**, (b) 개인 에이전트 쪽 레퍼런스 클라이언트가 가능합니다. 초안 단계라 레퍼런스 구현이 드물어서 기술 깊이를 보여주기에 좋습니다.
- **출처**: https://personalagentprotocol.org/ · https://sierra.ai/blog/introducing-personal-agent-protocol · https://sierra.ai/blog/poppy · https://www.cnbc.com/2026/10/06/meta-joins-companies-to-tame-chaos-of-doing-business-with-ai-bots.html · https://thenextweb.com/news/personal-agent-protocol-sierra-meta
- **날짜**: 2026-10-06 (초안 10-09)

### A5. **Meta Business Agent** (WhatsApp / Messenger / Instagram DM)
- **무엇**: 기업을 대신해 고객 질문에 답하고, 상품을 추천하고, **예약을 잡고**, 리드를 선별하고, 필요하면 사람에게 넘기는 비즈니스 에이전트입니다. 대기업용으로는 Shopify/Zendesk/Shopee와 연결하는 커스텀 에이전트 플랫폼과 **Meta Business Agent APIs**(승인 국가·업종 한정)가 있습니다. 과금은 WhatsApp Business Premium 티어 또는 토큰 사용량 기준입니다.
- **왜 중요한가**: 수요측(Muse 같은 개인 에이전트)과 공급측(Business Agent)을 **둘 다 Meta가 쥐고 있습니다**. "에이전트 대 에이전트" 협상이 가장 먼저 대규모로 일어날 장소가 WhatsApp일 가능성이 높습니다 `[INFERENCE]`.
- **신호**: 2026-06-03 글로벌 출시. "100만 개 이상의 비즈니스가 이미 사용"(Meta 뉴스룸). Q2 2026 실적 콜에서는 "주간 100만+ 비즈니스"라고 언급했습니다.
- **10일 해커톤에서**: WhatsApp Cloud API와 Muse Spark로 "개인 에이전트가 WhatsApp으로 비즈니스 에이전트와 협상"하는 데모를 만들 수 있습니다. Business Agent API 자체는 승인제라 접근이 어려울 수 있습니다 `[risk]`.
- **출처**: https://about.fb.com/news/2026/06/meta-business-agent · https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/ · https://developers.facebook.com/documentation/business-ai/get-started · https://s21.q4cdn.com/399680738/files/doc_financials/2026/q2/META-Q2-2026-Earnings-Call-Transcript.pdf
- **날짜**: 2026-06-03

### A6. Meta 공식 **MCP 서버들** (WhatsApp Business Tools MCP, Ads MCP, Social Technologies MCP)
- **무엇**: 코딩 에이전트(Claude/Codex/ChatGPT/Cursor)가 WhatsApp Business 계정을 개설하고, 번호를 인증하고, 템플릿·웹훅을 설정하도록 해주는 **WhatsApp Business Tools MCP**(9월)가 있습니다. Meta 광고를 생성·분석하는 **Ads MCP 서버**(7월 개방)와 Graph API 디버깅용 MCP(6월)도 있습니다. 상태를 바꾸는 행동은 인증된 사람만 할 수 있고, 모든 호출이 로깅됩니다.
- **왜 중요한가**: Meta 플랫폼의 운영자 자체가 "사람 → 에이전트"로 바뀌는 중이라는 신호입니다.
- **신호**: 공식 문서·블로그가 있습니다. 개발·테스트용으로 명시되어 있고, 대량 프로덕션 발송용은 아닙니다.
- **10일 해커톤에서**: 셋업 시간을 크게 줄일 수 있습니다. "WhatsApp 비즈니스 에이전트를 에이전트가 세팅한다"는 메타 데모도 가능합니다.
- **출처**: https://analyticsindiamag.com/ai-news/meta-launches-whatsapp-business-tool-to-let-ai-agents-handle-setup · https://developers.facebook.com/blog/post/2026/07/16/meta-ads-mcp-server/ · https://developers.facebook.com/documentation/mcp
- **날짜**: 2026-06~09

### A7. **Muse 모델 패밀리 & Meta Model API** (해커톤 필수 도구)
- **무엇**: Muse Spark 1.3(에이전트·코딩), **Muse Wonder / Wonder Full**(10/12, 개인·전문 에이전트 작업에서 SOTA를 주장, Active Memory/Active Focus), **Muse Spark Open**(10/15, 816B MoE/42B active, 1M 컨텍스트, 오픈웨이트, HF·OpenRouter·Groq 등에서 제공), **Muse Glimmer**(30B 오픈웨이트, 단일 GPU/Mac Mini), Muse Image, Muse Voice Transcribe, Muse Code(GA)가 있습니다. Meta Model API는 **전 세계 GA**이고 OpenAI SDK와 호환됩니다.
- **왜 중요한가**: 심사 25%(Meta 툴링)를 직접 충족합니다. Glimmer와 Spark Open으로 **온디바이스/로컬 개인 에이전트**(프라이버시 측 에이전트)를 구현할 수 있습니다.
- **신호**: Connect 2026 발표. 해커톤 참가자에게 무료 API 크레딧을 제공합니다.
- **10일 해커톤에서**: 역할 분리 아키텍처를 권장합니다. "사용자 측 로컬 에이전트 = Glimmer/Spark Open(개인정보 보유)", "협상·추론 = Wonder/Spark 1.3", "에이전트가 만드는 UI 이미지 = Muse Image" 식입니다.
- **출처**: https://about.fb.com/news/2026/10/introducing-muse-wonder-models/ · https://research.meta.ai/blog/muse-spark-open · https://developers.meta.com/blog/meta-connect-recap/ · https://dev.meta.ai/resources/blog/build-with-muse-spark
- **날짜**: 2026-09-24 / 10-12 / 10-15

---

## B. 프로토콜 계층 (에이전트 ↔ 도구 / 에이전트 ↔ 에이전트)

### B1. **MCP Apps** – 채팅 안에서 렌더링되는 인터랙티브 UI
- **무엇**: MCP 툴이 `_meta.ui.resourceUri`로 `ui://` HTML 리소스를 가리키면, 호스트가 샌드박스 iframe에서 렌더링합니다. UI는 `postMessage` JSON-RPC로 서버 툴을 호출하고 모델 컨텍스트를 갱신합니다. MCP-UI와 OpenAI Apps SDK를 통합한 **첫 공식 MCP 확장**입니다.
- **왜 중요한가**: "앱"이 독립 창에서 **에이전트 대화 속 컴포넌트**로 축소·재배치되고 있습니다. 한 번 만들면 Claude, ChatGPT, VS Code, Goose, M365 Copilot에서 동작합니다.
- **신호**: 2026-01-26 프로덕션 출시. Claude, ChatGPT, Goose, VS Code가 지원하고 Microsoft 365 Copilot chat도 지원을 추가했습니다(약 6개월 전). JetBrains, AWS Kiro, Google Antigravity도 검토 중입니다.
- **10일 해커톤에서**: 예제 레포(map, pdf, 3D, dashboard)를 포크하면 1~2일 안에 "대화 속 협상 보드/일정 조율 UI"를 만들 수 있습니다. 모델은 Muse를 쓰고 UI는 MCP Apps로 두는 조합이 현실적입니다.
- **출처**: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps · https://github.com/modelcontextprotocol/ext-apps · https://devblogs.microsoft.com/microsoft365dev/mcp-apps-now-available-in-copilot-chat
- **날짜**: 2025-11 제안 → 2026-01-26 정식

### B2. **Agentic AI Foundation (AAIF)** – 중립 거버넌스 허브
- **무엇**: Linux Foundation 산하 재단입니다. MCP, goose, AGENTS.md로 출범했고 이후 **A2A**, Agent Router, agentgateway를 거쳐 2026-10-22에 **Agent Skills**(Anthropic), **Open Responses**(OpenAI), **OpenEnv**(Hugging Face), **OpenSandbox**(Alibaba)가 합류해 총 10개 프로젝트가 되었습니다.
- **왜 중요한가**: 경쟁사들이 핵심 에이전트 표준을 한 재단에 모으고 있습니다. "표준 위에 짓는다"는 서사가 해커톤 심사에서 설득력을 갖습니다.
- **신호**: 1년이 안 되어 회원사 300곳을 넘었고(2026-10-22), Visa, Alibaba, Wells Fargo가 Gold로 합류했습니다(8월).
- **10일 해커톤에서**: Agent Skills 포맷으로 "협상 스킬"을 패키징하고, OpenEnv로 협상 에이전트 평가 환경을 만들면 기술 깊이(20%) 가점을 노릴 수 있습니다.
- **출처**: https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-four-new-projects-agent-skills-open-responses-openenv-and-opensandbox · https://www.linuxfoundation.org/press/agentic-ai-foundation-surpasses-300-members-in-less-than-one-year
- **날짜**: 2025-12 출범 / 2026-10-22

### B3. **A2A Protocol v1.0** – 에이전트 간 통신
- **무엇**: 에이전트끼리 능력을 발견(Agent Card)하고 작업을 위임하는 표준입니다. v1.0에서 **Signed Agent Cards**(암호학적 신원), 멀티테넌시, JSON+HTTP/gRPC/JSON-RPC 바인딩, 폴링/스트리밍/웹훅이 추가되었습니다. MCP와의 관계는 "에이전트 내부는 MCP, 에이전트 사이는 A2A"로 정리됩니다.
- **왜 중요한가**: 다른 회사·다른 사람의 에이전트끼리 대화하는 기본 레일입니다. 다만 **엔터프라이즈 중심**이라, 소비자 대 소비자 협상(일정 조율 등)에 필요한 선호도 비공개, 양보 전략, 합의 증빙 같은 의미 계층은 정의하지 않습니다.
- **신호**: 2026-03-12 v1.0 출시. TSC에는 AWS, Cisco, Google, IBM, Microsoft, Salesforce, SAP, ServiceNow가 참여합니다. 150개 이상 조직이 지지합니다(LF, 2026-04). GitHub 스타 2.2만 이상 `[secondary]`.
- **10일 해커톤에서**: 사용자 A의 에이전트와 사용자 B의 에이전트를 A2A로 연결하고, 그 위에 **협상 프로필/프로토콜 확장**(제안·역제안·합의 영수증)을 얹는 것이 차별점이 됩니다.
- **출처**: https://a2a-protocol.org/latest/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication · https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- **날짜**: 2026-03-12

### B4. **WebMCP** – 웹페이지가 브라우저 에이전트에게 함수를 노출
- **무엇**: `navigator.modelContext`(최근 `document.modelContext`로 이동)를 통해 웹사이트가 JS 함수를 AI가 호출할 수 있는 툴로 등록합니다. 에이전트가 버튼 위치를 추측하지 않고 구조화된 함수를 바로 호출합니다. W3C Community Group에서 진행 중이며, Microsoft·Google 엔지니어가 제안했습니다.
- **왜 중요한가**: computer-use(화면 클릭)에서 **"사이트가 에이전트용 API를 직접 제공"**으로 넘어가는 전환점입니다. Meta AI(안경)와 Cloudflare도 지원합니다.
- **신호**: Chrome early preview(2026-02-10), Imperative API 문서(2026-10-16 갱신), Cloudflare Browser Run 지원(2026-09-28), Meta AI developer preview(2026-09-24).
- **10일 해커톤에서**: 기존 웹앱에 WebMCP 툴 몇 개를 추가해 "에이전트 친화 사이트" 데모를 만들 수 있습니다. 반나절이면 됩니다.
- **출처**: https://developer.chrome.com/blog/webmcp-epp · https://developer.chrome.com/docs/ai/webmcp/imperative-api · https://developers.cloudflare.com/changelog/post/2026-09-28-webmcp-api/ · https://developers.meta.com/blog/meta-connect-recap/
- **날짜**: 2026-02-10 ~ 2026-10

### B5. **AGENTS.md / llms.txt / Agent Skills** – 에이전트용 "README" 계열
- **무엇**: AGENTS.md는 코딩 에이전트용 레포 지침 파일입니다. llms.txt는 사이트를 LLM용으로 요약·안내하는 파일입니다.
- **왜 중요한가**: 문서의 1차 독자가 사람에서 에이전트로 바뀌었다는 가장 저비용의 신호입니다. 다만 이미 **흔한 위생(hygiene) 항목**이라 이것만으로 해커톤 차별화는 어렵습니다.
- **신호**: agents.md 사이트에 따르면 6만 개 이상의 오픈소스 프로젝트가 사용합니다. GitHub 상위 100개 레포 중 39개가 루트 AGENTS.md를 보유합니다(2026-09-01 스냅샷) `[secondary]`. llms.txt 상위 1만 사이트 채택률 데이터가 있습니다 `[unverified, 수치 미확인]`.
- **10일 해커톤에서**: 필수 위생 항목으로 처리하면 됩니다(레포에 AGENTS.md, 서비스에 llms.txt).
- **출처**: https://agents.md/ · https://repoagentkit.com/agents-md-adoption · https://chrishumphrey.ai/research/state-of-llms-txt-2026
- **날짜**: 2025-08 출시 ~ 2026-09

### B6. **NLWeb** (Microsoft) – 사이트를 자연어/MCP 엔드포인트로
- **무엇**: schema.org/RSS 데이터를 이용해 웹사이트를 자연어 질의 엔드포인트(겸 MCP 서버)로 만드는 오픈 프로젝트입니다. Cloudflare AI Search와 TollBit이 원클릭 배포를 제공합니다.
- **왜 중요한가**: "HTML for the agentic web"을 표방합니다. 다만 2026년 기준 독립적인 모멘텀은 MCP·WebMCP에 비해 약하다는 인상입니다 `[INFERENCE]`.
- **신호**: Build 2025 발표. 초기 채택사로 Eventbrite, Shopify, Tripadvisor 등이 있습니다(2025). Cloudflare 문서에 통합되어 있습니다.
- **10일 해커톤에서**: 콘텐츠형 서비스라면 NLWeb으로 에이전트 쿼리 엔드포인트를 빠르게 확보할 수 있습니다. 우선순위는 낮습니다.
- **출처**: https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web · https://developers.cloudflare.com/ai-search/how-to/nlweb
- **날짜**: 2025-05 (2026 통합 확산)

---

## C. 커머스 · 결제 · 신원 레일

### C1. **Agentic Commerce Protocol (ACP)** – Stripe · OpenAI · **Meta**
- **무엇**: 에이전트가 기업과 거래하는 개방형 표준입니다. 구성 요소는 체크아웃 세션, 카탈로그/카트, **delegate payment**(결제 토큰 위임), **delegate authentication**(OAuth), 주문 웹훅이며, 스펙 버전은 2026-04-17입니다. ChatGPT Instant Checkout의 기반입니다.
- **왜 중요한가**: Stripe 공식 문서가 ACP를 "**Stripe, OpenAI, and Meta가 만든 표준**"으로 명시합니다. Meta 생태계 해커톤에서 커머스를 다룬다면 ACP가 1순위 정합 선택지입니다.
- **신호**: 2025-09-29 출시. Instacart, Walmart(Sparky) 통합. Checkout.com이 지원을 발표했습니다(2025-11). OpenAI는 초기 Instant Checkout의 유연성이 부족했다고 인정하고 개편했습니다(Payments Dive).
- **10일 해커톤에서**: OpenAPI/JSON Schema가 공개되어 있으므로 **ACP 판매자 엔드포인트**를 목업으로 구현하고 Muse Spark 에이전트가 구매하는 흐름을 보여줄 수 있습니다.
- **출처**: https://docs.stripe.com/agentic-commerce/protocols/acp · https://openai.com/index/buy-it-in-chatgpt · https://www.paymentsdive.com/news/walmart-sparky-chatgpt-instant-checkout/816002 · https://www.checkout.com/newsroom/checkout-adopts-acp-backed-by-openai-to-power-agentic-commerce-for-enterprise-merchants
- **날짜**: 2025-09-29 / 스펙 2026-04-17

### C2. **UCP (Universal Commerce Protocol)** + **Universal Cart** + **AP2**
- **무엇**: UCP는 Google과 Shopify가 공동 개발한 에이전트 커머스 표준(발견부터 체크아웃까지)입니다. **AP2 Mandates** 확장으로 사용자 의도와 승인을 검증 가능한 자격증명으로 첨부합니다. 2026-09-25에는 숙박 예약(Lodging) 드래프트로 리테일 밖까지 확장했습니다. Google **Universal Cart**(2026-10-15 미국 출시)는 Search와 Gemini에서 여러 리테일러를 아우르는 카트를 제공하고, 가격·재고를 백그라운드로 감시하며 UCP로 체크아웃합니다.
- **왜 중요한가**: "쇼핑 앱/사이트" 대신 **에이전트가 관리하는 범용 카트**가 생겼습니다. 리테일러는 데이터 피드 품질로 경쟁하게 됩니다.
- **신호**: Walmart, Wayfair, Ulta가 출시 시점부터 라이브이고 Newegg이 10월에 추가되었습니다. Stripe Link CLI가 UCP 흐름을 지원합니다.
- **10일 해커톤에서**: UCP 숙박 드래프트는 아직 구현 사례가 적어 "에이전트가 숙소를 협상·예약"하는 데모에 활용할 여지가 있습니다. 다만 Meta 정합성은 ACP보다 낮습니다.
- **출처**: https://ucp.dev/ · https://ucp.dev/documentation/announcements/ · http://ucp.dev/documentation/ucp-and-ap2 · https://www.vtex.com/en-us/news/google-universal-cart-is-your-store-ready · https://docs.stripe.com/agentic-commerce/link-cli/commerce-agents-ucp.md
- **날짜**: 2026-01 ~ 2026-10-15

### C3. **Stripe – Link agent wallet / Shared Payment Tokens (SPT) / Issuing for agents**
- **무엇**: 에이전트에게 **일회용 카드나 SPT**를 발급해 결제하게 합니다(`link-cli`, SDK 제공). 판매자는 SPT로 결제를 받습니다. Stripe Sessions 2026에서 Agentic Commerce Suite를 발표했습니다.
- **왜 중요한가**: Muse의 결제 수단이 바로 이 Link agent wallet이고, Link의 구매 보호가 적용되는 첫 AI 에이전트입니다. "에이전트에게 카드를 쥐여주는" 문제를 실무적으로 해결한 레일입니다.
- **신호**: Muse 공식 채택. Muse Connector Platform 결제 파트너.
- **10일 해커톤에서**: 테스트 모드에서 SPT로 실결제 흐름을 1일 안에 구현할 수 있습니다. 데모의 신뢰도가 크게 올라갑니다.
- **출처**: https://stripe.com/blog/giving-agents-the-ability-to-pay · https://docs.stripe.com/agentic-commerce/agents/link-agent-wallet.md · https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens.md
- **날짜**: 2026-04 (Sessions 2026-04-29)

### C4. 카드 네트워크: **Visa Trusted Agent Protocol / Intelligent Commerce Connect**, Mastercard, **Amex Intent Intelligence Framework**
- **무엇**: Visa TAP는 에이전트가 타임스탬프·세션 ID·키가 담긴 서명을 제시해 가맹점이 "신뢰할 수 있는 에이전트"인지 확인하게 합니다. Intelligent Commerce Connect(2026-04-08)는 네트워크·프로토콜·토큰 금고와 무관하게 쓸 수 있는 "온램프"입니다. Mastercard는 2026-09-30 agentic commerce 신뢰·인텔리전스 서비스를 발표했습니다. Amex는 **사용자 구매 의도(가맹점·예산·선호)를 거래 전에 캡처**하는 프레임워크를 제안했습니다(2026-10-13, **라이브 통합 없음**).
- **왜 중요한가**: 결제 계층은 "누가 승인했나(의도 증명)"를 가장 큰 미해결 과제로 보고 있습니다. TNW에 따르면 Visa는 ChatGPT를 통해 약 1.75억 가맹점에 연결되었습니다.
- **신호**: Visa–BILL–Billtrust B2B 라이브 파일럿, 유럽 은행 단계 진입(2026-07). Mastercard 상세 페이지는 403으로 막혀 확인하지 못했습니다 `[unverified 세부]`.
- **10일 해커톤에서**: 실 네트워크 연동은 불가능합니다. 대신 "**의도 명세(mandate) → 에이전트 협상 → 결과 영수증**" 흐름을 오픈 포맷(AP2 mandate 스타일)으로 시연하면 됩니다.
- **출처**: https://developer.visa.com/capabilities/trusted-agent-protocol/overview · https://investor.visa.com/news/news-details/2026/Visa-Opens-the-Door-to-AI-Driven-Shopping-for-Businesses-Worldwide/default.aspx · https://investor.visa.com/news/news-details/2026/Visa-BILL-and-Billtrust-Launch-First-Live-Pilot-for-Trusted-AI-Agent-Payments-Between-Buyer-and-Supplier-Platforms/ · https://www.vtex.com/en-us/news/google-universal-cart-is-your-store-ready (Amex 인용) · https://thenextweb.com/news/personal-agent-protocol-sierra-meta
- **날짜**: 2026-04 ~ 2026-10

### C5. **x402** (Coinbase) – HTTP 402 기반 에이전트 마이크로페이먼트 + 현실 점검
- **무엇**: 서버가 `402 Payment Required`를 응답하면 에이전트가 스테이블코인으로 즉시 결제하고 재요청합니다. Cloudflare Monetization Gateway도 x402를 사용합니다. Coinbase는 Agentic.Market이라는 서비스 마켓을 운영합니다(2026-04-20).
- **왜 중요한가**: API·데이터·툴을 **계정 없이 요청 단위로 판매**하는 헤드리스 비즈니스 모델의 기본 레일입니다.
- **신호/현실 점검**: Chainalysis 기준 Base에서 x402 트랜잭션이 1.38억 건을 넘었습니다(2026-10). 그러나 x402stats 10월 리포트에 따르면 **유기적 매출이 있는 비즈니스는 91곳**, 30일 유기적 거래액은 $793k(-32%), 상위 10개 지갑이 76%를 차지하고, 중앙값 지갑 수익은 $0.01입니다. Startup Fortune은 "절반이 가짜일 수 있다"고 보도했습니다. **트랜잭션 수는 과장되었고 실수요는 작습니다**.
- **10일 해커톤에서**: 구현은 쉽습니다(미들웨어 하나). 다만 "x402 붙인 API"만으로는 차별화가 되지 않습니다. 협상 결과에 따라 **에이전트가 가격을 동적으로 흥정하고 x402로 정산**하는 흐름이라면 흥미롭습니다.
- **출처**: https://x402stats.io/reports/2026-10 · https://www.chainalysis.com/blog/x402-agentic-payments-adoption · https://startupfortune.com/ai-agents-have-moved-over-200-million-payments-on-x402-but-half-may-be-fake/ · https://www.coinbase.com/developer-platform/discover/launches/agentic-market
- **날짜**: 2025 출시 / 2026-10 리포트

### C6. **Cloudflare – "The Internet has a second audience"** (Web Bot Auth, Pay Per Use, Monetization Gateway, Markdown for Agents, WebMCP)
- **무엇**: 사이트 소유자가 에이전트를 **식별**(Web Bot Auth: OpenAI·Google·AWS가 요청에 서명, 주당 5,000억 건 이상의 검증된 봇 요청), **통제**(Search/Agent/Training을 분리한 토글, Disallow AI Training), **과금**(Pay Per Use: 실제 사용 시 지급. Monetization Gateway: 요청·쿼리·토큰 단위 x402 과금, 미국 클로즈드 베타)할 수 있게 합니다.
- **왜 중요한가**: 핵심 데이터로 근거를 대는 항목입니다. **인터넷 트래픽의 절반 이상이 비인간**이고, AI 에이전트의 일일 요청은 1년 사이 1,700% 넘게 늘었으며, 일부 업종에서는 인간 트래픽이 최대 40% 줄었습니다. 대기자 명단에서 가장 많았던 요청은 **"charge agents, not humans"**였습니다.
- **신호**: 2026-09-30(Birthday Week). Web Bot Auth는 IETF WG에서 채택되었습니다(arXiv 2609.11152 언급, 2026-09-01) `[secondary]`.
- **10일 해커톤에서**: Workers와 Web Bot Auth 서명 검증으로 "에이전트 전용 가격표/접근 정책"을 가진 서비스를 데모할 수 있습니다.
- **출처**: https://blog.cloudflare.com/agentic-web/ · https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth · https://blog.cloudflare.com/introducing-pay-per-crawl
- **날짜**: 2026-09-30

### C7. **Skyfire KYA (Know Your Agent)** – 에이전트 신원 + 결제 토큰
- **무엇**: 실제 신원을 한 번 검증하면 구매자·판매자 에이전트가 그 신원을 상속합니다. `kya`(신원)와 `pay`(결제) 토큰을 사이트, API, MCP 서버에 제시합니다.
- **왜 중요한가**: "이 에이전트 뒤에 누가 있나"라는 문제를 다룹니다. Experian KYA 프레임워크의 신원 계층으로 채택되었고(2026-04-30), F5와 제휴했습니다(2026-03-18). Mastercard 스토리에도 등장합니다.
- **10일 해커톤에서**: 협상 상대 에이전트의 신원과 권한 증명을 보여주는 데 쓸 수 있습니다. 다만 PAP/OAuth 기반을 쓰는 편이 Meta 정합성은 더 높습니다.
- **출처**: https://docs.skyfire.xyz/docs/kya · https://skyfire.xyz/skyfires-kya-protocol-is-now-the-identity-layer-for-experians-know-your-agent-framework · https://www.f5.com/company/news/press-releases/f5-skyfire-secure-agentic-commerce
- **날짜**: 2026-03 ~ 2026-10

---

## D. 개인 에이전트 / 에이전트형 브라우저 (수요측 인터페이스)

### D1. **Instinct** – "앱이 없는" 개인 에이전트, **Instinct-to-Instinct 프로토콜**
- **무엇**: 문자나 전화로 쓰는 개인 비서입니다. 자체 전화번호와 컴퓨터로 장보기, 구독 해지, 여행 계획을 끝까지 처리합니다. **Trusted Person Network**에서는 Instinct-to-Instinct 프로토콜로 사용자들의 에이전트끼리 약속을 조율하고 파일을 공유합니다. 그룹 채팅(10/5)에서는 계정이 없는 친구도 함께 쓸 수 있고, 개인 에이전트는 그룹과 정보를 공유하기 전에 허락을 받습니다.
- **왜 중요한가**: 사용자가 말한 "**에이전트끼리 일정 협상**"을 상용으로 가장 먼저 구현한 사례입니다. 단 **폐쇄형**(Instinct 사용자끼리만)이라는 점이 곧 공백입니다.
- **신호**: 2026-09-28 $1B Series C, 기업가치 $10B(Sequoia/Benchmark/Coatue). 아직 early access 단계이고 직원 14명이라는 보도가 있습니다 `[secondary]`. 프라이버시 우려도 보도되었습니다(TechCrunch 2026-08-24).
- **10일 해커톤에서**: "**개방형·크로스벤더 개인 에이전트 간 협상**"(Muse 사용자와 다른 에이전트 사용자가 A2A/Poppy 위에서 일정과 조건을 합의)을 구현하면 Instinct의 폐쇄형 해자에 대한 대안 서사가 됩니다.
- **출처**: https://www.morningstar.com/news/business-wire/20260928153437/instinct-raises-1-billion-in-series-c-funding-from-sequoia-benchmark-and-coatue-at-10-billion-valuation · https://techcrunch.com/2026/10/05/instinct-brings-its-ai-agent-to-group-chats-even-for-friends-without-an-account · https://instinct.com/
- **날짜**: 2026-09-28 / 2026-10-05

### D2. **OpenAI Dots / ChatGPT plugin extensions / Apps SDK / ChatGPT Spaces**
- **무엇**: Dots는 GPT-6 Astra 기반의 상시 실행 개인 에이전트로, 백그라운드에서 목표를 추구하고 Slack/Teams로 메시지를 보낼 수 있습니다(Pro/Business Premium). Apps SDK(MCP 기반, 2025-10) 앱 디렉터리는 2025-12에 열렸고, DevDay 2026에서 **plugin extensions**(사이드바 홈, 패널, 파일 뷰어)와 Sign in with ChatGPT가 나왔습니다.
- **왜 중요한가**: OpenAI도 "**앱 → 에이전트 내부 플러그인**" 경로로 수렴하고 있습니다. 다만 Apps SDK는 디지털 상품 수익화를 제한한다는 점이 지적되었습니다(커뮤니티, 2026-01).
- **신호**: Dots 출시 2026-09-29. 디렉터리에 1,400개 이상의 앱이 있다는 수치가 있습니다 `[secondary: usecarly 블로그, 미확인]`.
- **10일 해커톤에서**: MCP Apps로 만들면 ChatGPT에서도 동작합니다. 경쟁사 플랫폼이므로 데모의 주 무대는 Meta 쪽에 두는 편이 좋습니다.
- **출처**: https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/ · https://openai.com/index/developers-can-now-submit-apps-to-chatgpt · https://www.cnbc.com/2026/09/29/openai-devday-2026-live-updates.html · https://community.openai.com/t/chatgpt-app-monetization-apps-sdk/1372343/4
- **날짜**: 2025-10 / 2025-12 / 2026-09-29

### D3. 에이전트형 브라우저 – **Atlas 폐기**, Comet, Chrome Gemini auto browse, Opera Neon(MCP), Dia
- **무엇과 현황**:
  - **ChatGPT Atlas**: 2025-10-21 출시 후 OpenAI 공식 페이지에 "**has since been deprecated**"로 표기되었습니다. 2026-08-09에 서비스를 중단했고(약 292일), 기능은 ChatGPT와 Codex로 흡수되었습니다.
  - **Chrome Gemini auto browse**: 2026-01-28 출시, 유료(AI Pro/Ultra). 2026-08-18 미국 Android로 확대되었습니다.
  - **Perplexity Comet**: 무료이고 Android 앱이 있습니다. Amazon이 2025-11 소송을 냈습니다.
  - **Opera Neon**: 2026-03 MCP 서버 지원을 추가해 외부 에이전트(ChatGPT/Claude/n8n)가 브라우저를 조종하게 했고, 2026-08 무료화했습니다.
  - **Dia**(Atlassian): 업무용 Skills와 Atlassian Connections에 집중합니다.
- **왜 중요한가**: **독립 AI 브라우저는 유통에서 졌습니다**(Atlas 폐기). 승자는 기존 설치 기반(Chrome)이거나, 브라우저를 **에이전트용 실행기(MCP 서버)로 재정의**한 쪽(Opera Neon)입니다. 동시에 사이트들은 에이전트 차단(Amazon)과 수용(Cloudflare/PAP) 사이에서 줄다리기 중입니다.
- **10일 해커톤에서**: 새 브라우저를 만드는 것은 **피해야 합니다**. computer-use는 "에이전트 친화 인터페이스가 없는 레거시 사이트용 폴백"으로만 쓰는 것이 좋습니다.
- **출처**: https://openai.com/index/introducing-chatgpt-atlas · https://tech-insider.org/ca/chatgpt-atlas-vs-perplexity-comet-vs-gemini-chrome-2026/ `[secondary]` · https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse · https://9to5mac.com/2026/03/31/opera-neon-doubles-down-on-agentic-browsing-with-mcp-support/ · https://blogs.opera.com/news/2026/08/your-ai-agents-can-use-opera-neon-free-of-charge/ · https://www.diabrowser.com/changelog
- **날짜**: 2025-10 ~ 2026-10

---

## E. 에이전트 UI / 앱 프레임워크 (생성형·일시적 UI)

### E1. **Builder.io Agent-Native** (오픈소스 프레임워크, Beta)
- **무엇**: 에이전트와 UI가 **같은 actions·data·app state를 공유**하는 TypeScript 프레임워크입니다. action 하나를 정의하면 **UI, 에이전트 툴, HTTP API, CLI, MCP, A2A** 6개 표면에 동시에 노출됩니다. 모든 앱이 MCP 서버이자 A2A 에이전트가 되고, MCP Apps 호스트에서는 UI가 인라인으로 렌더링됩니다. 인증, 권한, 실시간 협업, 승인 게이트, "누가 바꿨나(사람/에이전트)" 표시가 들어 있습니다. Slack, Teams, **WhatsApp**, Telegram으로 호출할 수 있고, OpenAI 호환 엔드포인트라면 어떤 모델이든 붙습니다(즉 Meta Model API도 가능 `[INFERENCE]`).
- **왜 중요한가**: computer-use(화면을 보고 클릭)는 느리고 토큰이 많이 듭니다. Builder.io는 "에이전트는 UI가 쓰는 action을 직접 호출하라"는 **사람·에이전트 공동 운영 앱**을 정식화했습니다. 사용자의 "앱 → 에이전트가 조작하는 도구" 테제를 프레임워크 수준에서 구현한 것입니다.
- **신호**: 2026-10-14 베타, MIT 라이선스. 레퍼런스 앱(Clips, Slides, Design)이 오픈소스이고, 2026-04부터 개념 글이 연재되었습니다.
- **10일 해커톤에서**: `npx @agent-native/core@latest create`로 시작해 action 기반 앱을 만들고 Meta Model API를 연결하면 됩니다. MCP, A2A, WhatsApp 진입점이 **기본으로 딸려와** 10일 안에 다면적인 데모가 가능합니다. 다만 프레임워크 자체가 새롭기 때문에 차별점은 도메인 로직에 두어야 합니다.
- **출처**: https://www.builder.io/blog/introducing-agent-native · https://github.com/builderio/agent-native · https://www.builder.io/blog/agent-native-architecture
- **날짜**: 2026-10-14

### E2. **A2UI** (Google) · **AG-UI** (CopilotKit) – 선언적 생성형 UI 프로토콜
- **무엇**: A2UI는 에이전트가 **JSON으로 UI를 선언**하면 클라이언트가 네이티브 컴포넌트(Web/Angular, **Jetpack Compose**, Flutter 등)로 렌더링하는 방식입니다. 임의 코드를 실행하지 않아 안전합니다. v0.9.1이 프로덕션 버전이고, v1.0 RC는 client→server RPC(`actionResponse`)를 추가했습니다. AG-UI는 에이전트와 프론트엔드 사이의 이벤트 스트림 전송 계층입니다. CopilotKit이 AG-UI, A2UI, MCP Apps를 모두 지원합니다.
- **왜 중요한가**: "앱 화면"이 고정 설계물에서 **에이전트가 상황별로 생성하는 일시적 UI**로 바뀌고 있습니다. Google Opal이 핵심 사용처입니다.
- **신호**: v0.9 블로그(2026-04-17). Android Jetpack에 공식 렌더러가 있습니다.
- **10일 해커톤에서**: 협상 결과나 선택지를 에이전트가 카드와 폼으로 즉석 생성하게 할 수 있습니다. Muse Image와 결합하면 시각적 데모(25%)에 유리합니다.
- **출처**: https://a2ui.org/ · https://developers.googleblog.com/en/a2ui-v0-9-generative-ui · https://github.com/CopilotKit/generative-ui · https://developer.android.com/jetpack/androidx/releases/a2ui
- **날짜**: 2025-11 ~ 2026-06 (v1.0 RC)

### E3. **Thesys C1 / OpenUI** – 생성형 UI API
- **무엇**: LLM 응답을 텍스트 대신 차트, 폼, 카드 같은 **타입이 지정된 UI 스펙**으로 반환하는 API이자 React SDK입니다. BYOK를 지원합니다.
- **왜 중요한가**: 생성형 UI를 서비스형으로 제공합니다. 다만 A2UI와 MCP Apps라는 개방형 표준이 나오면서 독자 포맷의 해자는 약해지고 있습니다 `[INFERENCE]`.
- **신호**: 회사 페이지 기준 $4M 이상을 조달했고, 콘솔에는 "3M+ downloads"라고 표기되어 있습니다 `[self-reported]`.
- **10일 해커톤에서**: 빠른 프로토타이핑에는 쓸 만합니다. 표준 정합성을 생각하면 A2UI/MCP Apps를 우선하는 편이 낫습니다.
- **출처**: https://docs.thesys.dev/guides/what-is-thesys-c1.md · https://www.thesys.dev/company · https://console.thesys.dev/
- **날짜**: 2025-04 출시 ~ 2026

---

## F. 헤드리스 SaaS / "에이전트가 고객인" API 비즈니스

### F1. **Browserbase** – 에이전트용 클라우드 브라우저
- **무엇**: 헤드리스 브라우저 인프라(세션 녹화, 스텔스, 인증)입니다. 2026-06-30에 **Browserbase Agents**를 출시해 자연어 목표만으로 API 한 번에 브라우저 에이전트를 실행할 수 있게 했습니다.
- **왜 중요한가**: 에이전트 친화 인터페이스가 없는 레거시 웹을 위한 폴백 레일입니다.
- **신호**: 2025-06 Series B $40M, post-money $300M(Sacra) `[secondary]`.
- **10일 해커톤에서**: PAP/MCP가 없는 상대(예: 동네 병원 예약 페이지)를 처리하는 폴백으로 씁니다.
- **출처**: https://browserbase.com/blog/introducing-browserbase-agents · https://sacra.com/c/browserbase
- **날짜**: 2026-06-30

### F2. **AgentMail** – 에이전트 전용 이메일 인박스 API
- **무엇**: API 한 번으로 에이전트에게 실제 이메일 주소를 만들어 줍니다. 송수신, 검색, 스레드 관리를 지원합니다.
- **왜 중요한가**: 사람용 Gmail 대신 **에이전트를 1급 사용자로 설계한 SaaS**의 전형입니다. 이메일은 PAP가 비유한 "에이전트 간 공용 레일"의 원형이기도 합니다.
- **신호**: 2026-03-10 $6M 시드(General Catalyst 리드, YC).
- **10일 해커톤에서**: 상대가 에이전트가 아닐 때(사람이나 레거시 기업) 이메일로 협상하는 폴백 채널로 씁니다.
- **출처**: https://techcrunch.com/2026/03/10/agentmail-raises-6m-to-build-an-email-service-for-ai-agents · https://www.agentmail.to/blog/agentmail-seed-launch
- **날짜**: 2026-03-10

### F3. **Composio** – 1000개 이상의 사전 인증 툴킷 / MCP
- **무엇**: 에이전트가 1000개 이상의 앱을 사용자별 OAuth 세션으로 호출하게 해주는 통합 계층입니다. 트리거, 샌드박스, CLI를 제공합니다.
- **왜 중요한가**: 커넥터 롱테일 문제를 SaaS로 해결합니다. 다만 Muse, ChatGPT, Claude가 자체 커넥터 디렉터리를 키우면서 압박을 받고 있습니다 `[INFERENCE]`.
- **신호**: 2026-09-14 $25M Series A `[secondary: thesaasnews]`.
- **10일 해커톤에서**: 캘린더, Gmail, Notion 연동을 몇 시간 만에 붙일 수 있습니다. 일정 협상 데모의 배관으로 적합합니다.
- **출처**: http://github.com/composiohq/composio · https://www.thesaasnews.com/news/composio-raises-25m-series-a
- **날짜**: 2026-09-14

---

## 시사점

1. **"앱의 소비자 = 에이전트"는 이제 데이터로 확인됩니다.** Cloudflare 기준 웹 트래픽의 절반 이상이 비인간이고, 에이전트 요청은 1년 새 +1,700%입니다. Muse는 App Store 1위, Instinct는 기업가치 $10B, OpenAI는 Dots를 냈습니다. 2026년 9~10월에 소비자 개인 에이전트가 주류로 들어왔습니다. **수요측은 이미 만들어졌고, 공급측(기업·서비스가 에이전트를 받는 쪽)은 비어 있습니다.**
2. **Meta의 전략 축은 명확합니다.** 수요측 Muse(WhatsApp 포함)에서 공급측 Meta Business Agent로, 그 사이를 **Personal Agent Protocol(Poppy)**(로그인·권한·대화)과 **ACP**(커머스, Stripe 공동)로 잇고, 확장 규격은 **MCP/WebMCP**(Meta AI Connectors, Muse Connector Platform)입니다. 해커톤 프로젝트가 이 다섯 점을 관통하면 "Meta 툴링 활용 25%"와 "임팩트 30%"를 함께 노릴 수 있습니다.
3. **가장 큰 공백은 '개방형 개인 에이전트 ↔ 개인 에이전트 협상'입니다.** A2A는 엔터프라이즈 위임, PAP는 개인↔기업, Instinct-to-Instinct는 폐쇄형입니다. **서로 다른 벤더의 개인 에이전트끼리** 선호를 다 공개하지 않고(프라이버시) 일정과 조건을 합의하고 **합의 영수증**을 남기는 표준은 없습니다. 사용자가 관찰한 테제(일정 조율 협상)는 정확히 이 빈자리에 있습니다.
4. **두 번째 공백은 '롱테일 비즈니스의 에이전트 수용'입니다.** UCP Universal Cart, ACP, PAP는 Walmart나 Shopify급만 바로 붙습니다. 동네 병원, 학원, 미용실 같은 소상공인은 poppy.json, OAuth, MCP, 회사 에이전트를 직접 만들 수 없습니다. **WhatsApp Business 위에서 "에이전트가 받을 수 있는 가게"를 원클릭으로 만드는 키트**는 Meta 생태계와 임팩트 양쪽에 맞습니다.
5. **세 번째 공백은 의도·권한·감사 계층입니다.** Amex는 라이브 통합이 없다고 밝혔고, AP2 mandates는 확장 단계이며, PAP의 결제는 '향후 확장'입니다. Muse는 Sentinel 승인과 감사 로그를, Instinct는 공유 전 허락을 핵심 기능으로 내세웁니다. "**사용자가 위임한 범위를 기계 검증 가능하게 명세하고, 협상이 그 범위를 넘지 않았음을 증명하는**" 구성요소는 기술 깊이(20%)를 보여줄 재료입니다.
6. **포화/회피 영역**: (a) 새 AI 브라우저(Atlas가 10개월 만에 폐기), (b) "X용 MCP 서버" 단독 제품(Meta 자체도 MCP 서버를 쏟아냄), (c) 범용 쇼핑 체크아웃 봇(ACP/UCP와 빅테크가 장악), (d) 범용 여행 플래너나 이메일 요약 에이전트(Muse, Dots, Instinct의 기본 기능), (e) llms.txt나 AGENTS.md 생성기, (f) x402 붙인 유료 API(실수요 91개 비즈니스 수준, 중앙값 $0.01).
7. **computer-use는 폴백이지 주력이 아닙니다.** 업계 방향은 "화면 클릭"에서 **구조화 action**(WebMCP, MCP, Agent-Native shared actions, PAP API)으로 가고 있습니다. 데모에서는 상대가 구조화 인터페이스를 지원하면 API를, 아니면 Browserbase/전화/이메일(AgentMail)로 단계적으로 폴백하는 **graceful degradation**을 보여주면 성숙해 보입니다.
8. **UI는 사라지지 않고 위치가 바뀝니다.** MCP Apps(대화 속 UI), A2UI(에이전트가 생성하는 선언적 UI), Agent-Native(사람·에이전트 공동 편집)가 모두 "**사람은 승인·수정·감독만 한다**"로 수렴합니다. 해커톤 데모의 핵심 화면은 앱 화면이 아니라 **협상 타임라인, 승인 카드, 감사 로그**여야 합니다.
9. **10일 실행을 위한 추천 조합** `[INFERENCE]`:
   - Muse Spark/Wonder: 협상 두뇌
   - Muse Glimmer/Spark Open: 로컬 개인정보 보유 에이전트
   - A2A, 또는 PAP 초안 구현: 에이전트 간 레일
   - MCP 서버: Meta AI Connectors/Claude/ChatGPT 호환
   - MCP Apps 또는 A2UI: 승인 UI
   - WhatsApp Cloud API: 실사용 채널
   - Stripe SPT 테스트 결제: 거래 마무리
   - (선택) Builder.io Agent-Native: 골격과 다채널 진입점을 한 번에 확보
10. **돋보이는 조건**: (i) 서로 다른 소유자의 **에이전트 2개 이상이 실제로 협상하는 장면**을 라이브로 보여줄 것, (ii) Meta의 신규 표준(PAP, Muse Connector, WebMCP on Meta AI)을 **레퍼런스 구현 수준**으로 다룰 것(희소성), (iii) 사람의 개입을 '승인 한 번'으로 줄이되 권한과 프라이버시 경계를 명시적으로 보여줄 것, (iv) 롱테일(소상공인, 비영어권)까지 닿는 임팩트 서사를 갖출 것.
