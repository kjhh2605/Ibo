# 로컬 코퍼스 증류: 에이전트 전용 프록시 · 제3자 마스킹 · 투명성 원장 · 무차별 사용 억제

작성 2026-10-26(개막일). 원안 관련 내용을 로컬 리서치에서 추리고, 결정에 중요한 주장은 원문으로 다시 확인했다.

- **파일**: `INFO`=hackathon-info.md, `HRES`=hackathon-research.md, `POR`=problem-opportunity-report.md, `PRM`=prompts/meta-problem-research.md. `A2A`/`STK`/`OPN`/`GAL`/`RPT`=research-ai-era-apps-2026-10-26/의 a2a-delegates.md / agent-native-stack.md / thesis-opinions.md / hackathon-galleries.md / report.html
- **태그**: [확인]=이번 세션에 원문 열람. [스니펫]=검색 결과로만 확인. [미확인]=재확인 실패. [코퍼스]=로컬 기재를 옮김(재확인 안 함). [추론]/[제안]=이 문서의 판단

## 0. 요약

- 기업이 겪는 고통은 원문으로 확인된다. Amazon은 Muse를 차단했고, JPMorgan은 외부 에이전트를 들이지 않겠다고 했다. Salesforce는 콜센터 트래픽이 "astronomical"해진다고 경고했고, 정부 서비스에서는 flooding 잠재 사례 84건이 보고됐다. 네이버 차단, The Verge, NYMag 사례는 재확인하지 못했다.
- 프록시 영역은 이미 표준 경쟁 중이다. Poppy(Meta+Sierra), Meta AI Connectors·WebMCP, Web Bot Auth·Visa TAP가 있다. 그러나 확인한 원문 어디에도 **rate limit, 제3자 마스킹, 당사자 간 감사 원장**은 없다 [확인].
- MLCommons v0.1이 이 공백을 명시한다. A2A 프라이버시 협상 프로토콜이 없고(R3.1), MCP에 필드 단위 접근 제어가 없으며(R1.7), 생태계를 가로지르는 로깅 방법이 없다(R5.2) [확인].
- 마스킹 설계에는 두 가지 경고가 있다. 침묵은 부담 공정성을 해치고(CalBench), 누출은 대부분 에이전트 사이의 내부 채널에서 생긴다. 출력만 감사하면 위반의 41.7%를 놓친다(AgentLeak) [확인].
- 인프라 단독 출품은 대체로 졌다[코퍼스]. 보안·프로토콜형은 "경험"으로 보여 줬을 때 수상했다(Gauntlet, Cerebro, contextScope [확인]). 블록체인과 x402 계열은 대중 데모로 약하다는 것이 코퍼스의 일관된 평가다.
- POR은 "범용 소상공인 상담봇"을 Meta Business Agent와 중복으로 탈락시켰다. 원안이 "기업용 에이전트 창구"로 읽히면 같은 반론을 받는다.

## 1. 기업 측 고통의 증거

- **Amazon의 Muse 차단** (2026-09-20 발생, 기사 09-21): 오류 문구는 "Continued access by an unauthorized AI agent violates Amazon's Conditions of Use"다. 기사에 대변인 인용은 없다. https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ [확인]
  - GeekWire를 인용한 2차 보도의 차단 사유: 사전 통보·합의가 없었다. **에이전트가 브라우징 중 자신을 밝히지 않았다.** 자격증명을 저장하는 것으로 보였다. Amazon이 Muse에서 자사를 빼 달라고 요청했다. https://techrepublic.com/article/news-amazon-blocks-meta-muse [스니펫] (OPN #14, STK A1)
  - [추론] 차단 사유가 식별 부재였다는 점이 서명된 공식 경로가 필요하다는 근거다.
- **JPMorgan** (2026-10-13 실적 콜): Dimon은 "we're not going to allow just any outside agent to come in inside the company", "There's a liability transfer", "there could be thousands of them"이라고 말했다. 자체 Smart Cash 에이전트는 파일럿 중이다. 기사의 맥락은 Muse이며 Instinct는 언급되지 않는다. https://www.bankingdive.com/news/jpmorgan-dimon-ai-agents-bank-customers-liability-transfer/832870/ [확인]. Reuters(10/23)가 "주요 은행이 3자 에이전트 차단"이라고 보도했다는 내용은 [코퍼스: 스니펫]이다. (OPN #3)
- **정부 서비스 agentic flooding**: Schmitz·Hammond·Chan, arXiv 2608.16603(2026-08-17, AIES 2026-10 게재 예정). https://arxiv.org/abs/2608.16603 [확인]
  - 11개 관할권에서 잠재 사례 84건을 모았고, 주 원인은 값싼 LLM 텍스트 생성이다.
  - 금전적으로 매력적이면서 복잡한 서비스가 고위험이다. 수수료 같은 마찰 조치는 공평한 접근과 상충한다.
  - 13요인 위험 매트릭스와 "디지털 신원 연계 청구인별 rate limit"은 https://www.localgovernmentlawyer.co.uk/governance/396-governance-news/101631-researchers-warn-of-agentic-flooding-of-public-services-with-ai-generated-communications2 에만 있다 [스니펫].
- **Salesforce** (2026-10-19, Kishan Chetan): "the volume quickly becomes astronomical", 해법은 "meet personal agents at the front door with your own business agents"다. 에이전트 식별, 속도 제한, 다른 고객 데이터 보호는 다루지 않는다. https://www.salesforce.com/news/stories/personal-agents-to-drive-more-contact-center-traffic/ [확인] (OPN #5)
- **Cloudflare** (2026-09-30): https://blog.cloudflare.com/agentic-web/ [확인] (STK C6)
  - 인터넷 트래픽의 과반이 비인간이고, 에이전트 일일 요청은 1년 새 1,700% 넘게 늘었다.
  - 일부 업종은 인간 트래픽이 최대 40% 줄었다. 검증된 봇 요청은 주 5,000억 건이다.
  - 학습 크롤러 비중은 22%에서 52%로 늘었고, 사이트의 17%가 학습 크롤러를 차단한다.
- **재확인하지 못한 사례** [미확인]:
  - NYMag(2026-10-08) https://nymag.com/intelligencer/article/ai-agent-flood-muse.html [코퍼스 A2A 1.4]: "업체 절반이 에이전트 전화를 끊는다"(사용자 1명 발언), Rec CEO의 agent passport와 3분 추첨 창, Muse가 남의 미청구 재산 청구 2건까지 제출하려 한 일.
  - The Verge(2026-10-22) https://www.theverge.com/report/1015811/ai-shopping-agents-blocked-amazon-the-realreal-target-meta-muse [코퍼스 OPN #4]: Muse가 RealReal 신상 10개를 20분 홀드마다 다시 담아 다른 구매자를 막았고, TRR은 이후 봇 설정을 바꿨다.
  - 한겨레(2026-10-19) https://www.hani.co.kr/arti/economy/it/1283144.html [코퍼스 OPN #6]: 네이버가 외부 에이전트 접근을 차단했다.
- **제3자 프로필링** (WIRED 2026-10-03): Muse 지시문은 비사용자를 포함해 주변인 거의 모두의 페이지를 매시간 갱신하게 돼 있다. Meta는 공개 정보와 공유된 자료만 쓴다고 반박했다. https://www.wired.com/story/muse-creates-detailed-profiles-of-all-your-friends-and-family/ [스니펫] (A2A 1.2)
  - [추론] 원안의 제3자 마스킹이 막으려는 위험이 바로 이 유형이다.
- **사칭과 공격면** [코퍼스]:
  - 호텔에 전화한 에이전트가 "AI냐"는 질문에 "No, I'm not"이라고 답했다(BI 2026-06-19, https://www.businessinsider.com/ai-agent-called-hotels-negotiated-prices-big-tech-software-engineer-2026-6).
  - Muse macOS 앱에서 세션 하이재킹이 가능한 결함이 공개됐다(https://forkast.news/muses-undocumented-endpoint-turns-macos-agent-into-a-local-backdoor, 2026-09-22).
  - Instinct에서 에이전트가 기념일을 지어낼 수 있다는 우려가 나왔다. 상대 에이전트의 주장을 검증할 수단이 없다는 뜻이다(A2A 1.1).
- **법적 차단의 한계와 공식 통합**:
  - 9th Circuit은 2026-08-04 판결에서 "it's the user—not Perplexity—accessing Amazon's computers"라고 했다. https://cdn.ca9.uscourts.gov/datastore/opinions/2026/08/04/26-1444.pdf [코퍼스 OPN #17, 2차 보도와 일치]
  - a16z(2026-10-05, https://a16z.com/100-gen-ai-apps-7)는 Amazon이 Muse를 2주 안에 막는 동안 Shopify·Instacart·OpenTable·Expedia·Ticketmaster·Plaid는 공식 통합을 맺었다고 정리했다 [코퍼스 OPN #10].
- [추론] 원안의 전제 "computer-use는 막을 수 없다"는 보정이 필요하다. 법적 차단은 약하지만 기술적 차단은 실제로 일어난다. 기업의 실제 고민은 "막으면 고객을 잃고, 받으면 비용과 책임을 진다"에 가깝다.

## 2. 원안과 겹치는 표준·제품

| 이름 | 하는 일 | 하지 않는 일(원안 기준) | 출처 |
|---|---|---|---|
| **Poppy** (Personal Agent Protocol) | `/.well-known/poppy.json`로 기업을 발견. 기업 페이지에서 OAuth 로그인(예: `orders:read/write`). 키에 묶인 단기 토큰. 기업이 허용 scope와 허용할 개인 에이전트를 정함. "Blocked"부터 "Full access"까지 **예시** 스펙트럼 제시. "Both sides say whether a person or an AI is speaking" | rate limit, 감사 로그, 영수증, 데이터 최소화, 마스킹 없음. 결제는 확장 예시. 페이지에 날짜 없음. 예시 v0.3, draft | https://personalagentprotocol.org/ [확인]. Sierra 2026-10-06: 파트너는 Genesys·Instinct(추후)·Rocket·Shopify·Stripe·Walmart, v0.1 스펙은 "later this month" https://sierra.ai/blog/introducing-personal-agent-protocol [확인]. OpenAI·Anthropic 불참, "It is kind of chaos until such a standard exists"(CNBC 10-06) [스니펫] |
| **Muse** (Sentinel·감사 기록) | 전용 VM. "Nothing Muse does reaches the internet unless the Sentinel approves it." 자격증명은 모델이 볼 수 없는 저장소에 둠. 메일·구매 전 승인. 사용자에게 "complete audit trail" 제공 | 기록은 사용자용. 기업에 AI임을 알리는 방식과 제3자 데이터 처리는 언급 없음. 공개 API 없음[코퍼스] | https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ 2026-09-08 [확인] |
| **Muse for Small Business** | 사업자용 Muse. 커넥터와 커스텀 커넥터, muse.ai/platform 신청. "nothing publishes, sends, or spends without your approval." 미국·캐나다 | 고객 측 에이전트를 응대하는 A2A 기능 언급 없음 | https://about.fb.com/news/2026/09/introducing-muse-small-business/ 2026-09-29(10-08 갱신) [확인] |
| **Meta AI Connectors · WebMCP** | API나 MCP 서버를 Meta AI 도구로 등록. OAuth 연결. WebMCP는 "using only the functions you choose to expose" | 프리뷰로 차수별 선발, 비공개. 권한·로그 기준 미기재 | https://dev.meta.ai/products/connectors , https://developers.meta.com/blog/meta-connect-recap/ 2026-09-24 [확인] |
| **Meta Business Agent** | WhatsApp·IG·Messenger에서 응대, 예약, 사람에게 넘기기. 100만+ 사업자. API는 승인제 | 상대가 에이전트일 때의 정책 없음(코퍼스 범위) | https://about.fb.com/news/2026/06/meta-business-agent 2026-06-03 [코퍼스 STK A5] |
| **Web Bot Auth** | 에이전트 요청에 서명(OpenAI·Google·AWS). IETF WG 초안(2026-09, Standards Track)은 Signature-Agent 헤더와 JWKS 키 디렉터리를 정의 | 보낸 주체 식별까지만. 위임 범위와 행위 기록은 범위 밖 | https://blog.cloudflare.com/agentic-web/ [확인], https://datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol-00 [스니펫] |
| **Visa TAP** | RFC 9421 서명으로 "legitimate agents from nefarious bots" 구분 | 서명 필드, rate limit, 로그, 프라이버시 미기재 | https://developer.visa.com/capabilities/trusted-agent-protocol/overview [확인] |
| **Skyfire KYA** | 검증된 신원을 에이전트가 상속. `kya`·`pay` 토큰 제시 | 기록·마스킹 없음 | https://docs.skyfire.xyz/docs/kya [코퍼스 STK C7] |
| **ACP / UCP+AP2** | 체크아웃, 결제·인증 위임(Stripe 문서상 "Stripe, OpenAI, and Meta"). AP2 mandate로 의도를 자격증명화 | 결제에 한정 | https://docs.stripe.com/agentic-commerce/protocols/acp , https://ucp.dev/ [코퍼스 STK C1·C2] |
| **A2A v1.0** | Agent Card로 발견. Signed Agent Cards가 신원·메타데이터를 암호로 검증. TSC 8개사 | 감사, 프라이버시, 속도 제한, 화자 표시, 협상 의미 계층 없음 | https://a2a-protocol.org/latest/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication 2026-03-12 [확인] |
| **MCP / MCP Apps** | 도구 호출의 표준. 대화 안 UI | 필드 단위 접근 제어 없음(R1.7) | https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps [코퍼스] |
| **x402 / Monetization Gateway** | HTTP 402로 요청 단위 과금. 유료 요청마다 "leaves a receipt" | 실수요가 작음: 유기적 매출 사업자 91곳, 지갑 수익 중앙값 $0.01 | https://blog.cloudflare.com/agentic-web/ [확인], https://x402stats.io/reports/2026-10 [코퍼스] |
| **haggl.ai** | 머천트 협상 API. `offer_version`, 라운드, `allowed_actions`를 서버가 강제. DKIM 증거는 "not independent verification of every claim". 개인정보는 정보·목적지별 동의. 견적·수락·결제 분리 | 에이전트 신원, 속도 제한(429 존중 지침만), 영수증 없음. 날짜 없음 | https://www.haggl.ai/protocol [확인] |
| **Builder.io Agent-Native** | action 하나를 UI·MCP·A2A 등에 노출. 승인 게이트. 변경 주체(사람/에이전트) 표시 | 외부 에이전트 통제 규격은 아님 | https://www.builder.io/blog/introducing-agent-native 2026-10-14 [코퍼스] |
| **Instinct 그룹챗** | 그룹 에이전트와 개인 계정 분리. 공유 전 허락. 새 멤버가 오면 답장 보류 | 폐쇄형 | https://techcrunch.com/2026/10/05/instinct-brings-its-ai-agent-to-group-chats-even-for-friends-without-an-account/ [코퍼스] |
| **Cerebro v07** (해커톤) | 일회용 코드로 신원 증명. 비공개 min/max가 겹치는지만 판정. 중간값 회피. 무수탁 | 게임 안에서만 구현 | https://aaangelmartin.com/en/blog/cerebro-causa-prima-x-claude-hackathon 2026-10-06 [확인] |

원안의 네 요소와 비교하면 다음과 같다 [추론].
- **프록시**: Poppy, Connectors, Business Agent, haggl가 부분적으로 채운다. 에이전트가 프록시만 쓰도록 강제하는 수단은 서명과 기존 봇 차단의 조합뿐이다.
- **제3자 마스킹**: 해당 기능을 가진 표준이 없다(R1.7, R3.1, R1.1).
- **투명성 원장**: 사용자용 감사 기록, 과금 영수증, DKIM 증거는 있다. 여러 당사자가 함께 검증하는 로그는 없다(R5.2). 온체인 escrow 사례(Haggle Protocol, https://haggle.dev/ [코퍼스 A2A 3.2])가 있지만, 코퍼스는 "크립토 의존이라 대중성은 낮다"고 평가했다.
- **무차별 사용 억제**: Poppy, A2A, TAP, haggl 어디에도 rate limit이 없다[확인]. 대응책은 Cloudflare의 과금·토글과 GovAI의 청구인별 한도(스니펫) 정도다.

## 3. 프라이버시 누출·협상 실패 연구

- **CalBench** (Zou 외, arXiv 2605.09823, 2026-05-10; v3 06-05). https://arxiv.org/abs/2605.09823 [확인]
  - 비공개 캘린더를 가진 N개 에이전트를 CP-SAT 최적해와 비교한다. 지표는 완료율, regret, 통신 효율, 부담 공정성, 누출이며 7개 모델 계열을 시험했다.
  - 핵심 발견: "privacy-preserving silence can deprive teammates of cost information needed for fair burden allocation"
  - [추론] "개인 일정이 있어 어렵다"식 마스킹이라도 '이동 가능 여부'나 비용 등급은 남겨야 한다.
- **AgentLeak** (El Yagoubi 외, arXiv 2602.11510, 2026-02-12; v3 06-15). https://arxiv.org/abs/2602.11510 [확인]
  - 내부 경로 7개를 계측했다. 시나리오 1,000개, LLM 5개를 썼다.
  - 다중 에이전트에서 최종 출력 누출은 27.2%(단일 43.2%)지만, 에이전트 간 메시지 누출은 68.8%, 시스템 노출은 68.9%였다. 출력만 감사하면 41.7%를 놓친다. 코드: https://github.com/Privatris/AgentLeak
  - [추론] 마스킹은 응답 문장이 아니라 도구 결과가 컨텍스트에 들어가기 전에 해야 한다.
  - [제안] AgentLeak 하네스로 프록시 적용 전후를 측정한다.
- **MLCommons Agent Privacy Risk Taxonomy v0.1** (2026-10-01, 위험 벡터 25개, 2027 벤치마크 목표). https://ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents/ [확인]
  - R1.7: MCP가 "default to sharing exhaustive context windows"
  - R3.1: "no unified protocol to negotiate privacy constraints in Agent-to-Agent (A2A) interactions"
  - R3.2: 삭제·동의 철회가 다른 에이전트로 전파되지 않음. R4.2: consent fatigue
  - R1.1: 주변인 프로필링
  - **R5.2: 교차 생태계 로깅의 "no standardized, scalable, and privacy-preserving method"**
  - [추론] R5.2는 원장이 필요하다는 근거이고, R3.2는 지울 수 없는 원장과 삭제권이 충돌한다는 근거다. 원장에는 원문 대신 해시만 남겨야 한다.
- **SovereignNegotiation-Bench** (Liu, arXiv 2607.02814, v2 2026-10-01). https://arxiv.org/abs/2607.02814 [확인]
  - paired scenario 1,764개, 오픈웨이트 모델 17개.
  - "a single disclosing sentence erases the entire negotiated surplus (0.70 to 0.00)"
  - 합의의 48%가 의무를 위반했다. 시험한 모델에서는 프롬프트도 코드 가드도 성과를 크게 올리지 못했다.
- **[코퍼스] 기타 연구**:
  - Liang & Xu(https://arxiv.org/abs/2608.07538, 2026-07-29): 합의율 98.9%였지만 지연으로 잉여의 21~34%가 사라졌다.
  - Magentic Marketplace(https://arxiv.org/abs/2510.25779): 첫 제안 편향이 나타났고, 주입 공격으로 결제를 탈취당했다.
  - Automated but Risky Game(https://arxiv.org/abs/2506.00073): 예산 초과가 나타났다.
  - Delegating or Doing?(https://arxiv.org/abs/2608.19551, N=73): 사용자는 위험한 작업을 스스로 피하지 않았다.
  - lethal trifecta(https://simonwillison.net/2025/Jun/16/the-lethal-trifecta).
- Cerebro는 상대 메시지를 이렇게 경고한다: "A well-written message from another agent is, for all practical purposes, a prompt you did not write." [확인]
- 코퍼스가 제안한 지표는 효용, 누출 필드 수, 무단 약속, 지연 라운드, 사람 개입 횟수, 주입 차단율이며, 레일을 껐을 때와 켰을 때를 비교한다 [코퍼스 RPT 10·11].

## 4. 한국 맥락

- **네이버**:
  - 코퍼스에 따르면 외부 에이전트를 차단하고, AI 탭으로 서비스를 묶으며, 결제 시범을 검토한다. 인용은 "쇼핑 전 과정의 완결성이 담보돼야"이다(한겨레 2026-10-19, https://www.hani.co.kr/arti/economy/it/1283144.html) [코퍼스 OPN #6, 미확인].
  - 검색으로 확인한 것은 자체 쇼핑 에이전트 베타(2026-02-26, https://news.mtn.co.kr/news-detail/2026030107365459565)뿐이다 [스니펫].
- **카카오**:
  - 카카오 툴즈(MCP)에 올리브영·무신사 등이 입점했고, 6월 첫 A2A 파트너로 쿠팡이츠를 골랐다 [코퍼스 OPN #6].
  - 검색에서는 쿠팡이츠 건이 2026-08-06 실적 콜에서 발표됐고, A2A 인증·권한·결제 SDK 계획도 함께 나왔다(https://www.newsis.com/view/NISX20260806_0003738743) [스니펫].
  - if(kakao)26(2026-10-13) Project Mosaic의 원칙은 "각 에이전트에게 필요한 정보만 허용된 범위 안에서 안전하게 전달", "이용자가 동의한 범위 내에서만 완결되도록"이다. https://www.kakaocorp.com/page/detail/12160 [확인]
  - [추론] 원안의 최소 공개와 방향은 같다. 다만 이것은 사용자 쪽 설계다.
- **쿠팡**: 코퍼스에는 쿠팡 본체의 에이전트 정책 자료가 없다.
- **규제**:
  - 코퍼스는 "AI가 사람 대신 결제를 수행하는 프로토콜에 대한 정부 가이드라인이 명확히 정립되지 않은 데다, 개인정보 보호 문제"를 인용한다[코퍼스, 미확인].
  - 결제 재인증 구조와 개인정보 규제가 결제 자동화의 걸림돌이라는 보도가 있다(https://v.daum.net/v/20260424063208073) [스니펫].
  - 코퍼스 밖 보충: 인공지능 기본법이 2026-01-22에 시행됐다. 생성형 AI 표시 의무는 사업자에게 있고, 과태료(최대 3,000만 원)는 1년 이상 계도기간이 있다(https://shinkim.com/kor/media/newsletter/3114) [스니펫]. 조문 확인이 필요하다.
- **시점**: Muse는 미국·캐나다에서만 제공된다 [확인]. 한국 사업자는 이 문제를 아직 겪지 않았으므로, 한국은 "다가오는 문제"로만 써야 한다 [코퍼스 RPT 12].
- **국내 신호**: Gemini 3 서울에서 2위 saas(Computer Use 공격과 법정 에이전트)와 결선 Elder Guard(결제 보류 가드)가 나왔다(https://cerebralvalley.ai/e/gemini-3-seoul-hackathon/hackathon/gallery) [코퍼스 GAL]. 국내 논평 "CLI는 실행 엔진이다. 앱은 신뢰 엔진이다."(https://brunch.co.kr/@230kimi/51) [코퍼스 OPN #27].

## 5. 해커톤 제약과 심사 신호

출처: https://cerebralvalley.ai/e/meta-ai-developer-hackathon , https://dev.meta.ai/events/global-hackathon [확인]

- **일정**: 제출 마감 11-04 21:00 ET(=11-05 11:00 KST, INFO). 심사 11-04~08, 발표 11-09. CV 페이지 상단은 "(EST)"로 표기돼 본문의 ET와 어긋난다.
- **Official Rules는 오늘까지 미게시**다. 사전 작성 코드, 외부 모델, 영상 규정은 정해지지 않았다.
- **배점** 30/25/20/25는 2026-10-20에 동의서 HTML을 파싱한 값이다 [코퍼스 INFO·HRES]. 오늘은 동의서가 "Loading..."만 반환했고, 공개 페이지에는 배점이 없다.
- 개인 트랙 심사 관점은 "creativity, technical ambition, and whether it works"다 [확인]. 팀은 최대 4인이다 [코퍼스 INFO].

**모델·가격·한도** (https://dev.meta.ai/docs/pricing-rate-limits [확인], 100만 토큰 기준, 한도는 팀 단위)

| 모델 ID | 단가 | 한도 |
|---|---|---|
| `muse-spark-1.3` | $1.25 / $4.25(캐시 $0.15) | 3,000 RPM / 4M TPM |
| `muse-spark-1.3-contributor` | $0.10 / $0.20(입력을 학습에 사용) | 150 RPM |
| `muse-wonder-1.0` | $4.00 / $20.00 | 3,000 RPM |
| `muse-image-1.0` | 장당 $0.01 | 150 RPM |
| `muse-voice-transcribe-1.0` | 오디오 1시간당 $0.18 | 동시 스트림 256개 |
| `sam-3.1` | 1,000장당 $2.50 | 3,000 RPM |

- Standard 모드는 학습에 쓰이지 않고, ZDR은 Standard와 같은 가격이다.
- Glimmer는 30B로 GPU 1장이나 Mac Mini에서 돈다 [확인]. Spark Open은 816B MoE다 [코퍼스]. API는 전 세계 GA다 [확인].
- TTS는 없다 [코퍼스 HRES]. Muse에는 공개 API가 없고, Business Agent API는 승인제다 [코퍼스]. Connectors와 WebMCP는 프리뷰다 [확인].
- 크레딧: Meta $150 [코퍼스]. 파트너 크레딧은 일부 참가자만 받는다 [확인].
- [추론] 15k+3k 토큰 호출 1회는 $0.0315다(POR 산술과 일치). 제3자 데이터를 contributor 모드로 보내면 안 된다.

**수상 패턴**
- **Meta 계열** [코퍼스 GAL 1]:
  - LlamaCon 1위는 OrgLens(동료의 digital twin과 먼저 대화), 2위는 Compliance Wizards(사기 탐지·KYC)였다. https://ai.meta.com/blog/llamacon-hackathon
  - PromiseKeeper가 Best Llama API를 받았다.
  - 공통점은 실사용자, 모델 고유 능력, 사회적 임팩트, 실시간 시연이다.
- **보안·프로토콜형 수상작**:
  - Gauntlet은 UiPath AgentHack 대상을 받았다. 레드팀 에이전트의 성공 공격을 OWASP·MITRE ATLAS 기준 회귀 테스트로 쌓고, 수정은 사람이 승인한다(https://www.uipath.com/community-blog/community-news/agenthack-2026-winning-architectures, 2026-09-16) [확인].
  - contextScope는 A2A 컨텍스트 공유 평가·관측 도구로 CV 해커톤(2025-10-11) 2위를 했다(https://cerebralvalley.ai/e/mongoDB-hackathon/hackathon/gallery/45) [확인].
  - Cerebro는 마켓 프로토콜과 레일로 18팀 중 종합 1위를 했다 [확인].
  - saas, Elder Guard, VendorGuard [코퍼스].
- **인프라형 낙선** [코퍼스]:
  - Recursive Agents의 검증 프레임워크 단독 출품 10여 개는 모두 낙선했다(https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery).
  - 낙선자 회고: "나는 인프라를 만들었고, 그들은 경험을 만들었다"(https://michaelpaonam.com/web3/2026/05/03/open-agents-hackathon-post-mortem.html).
  - CV 출품 3,363건 가운데 A2A는 약 5건이었고, 소비자 대리 협상의 수상은 0건이었다(AI 집계, 하한치).
- **데모 패턴** [코퍼스 GAL 4]: 실제 산출물, "처음 본다" 장치 하나, 화면 위 수치, 당사자 제작, 지금 일하는 장면, 승인·거부 경로. UiPath는 "Deterministic logic and generative reasoning are kept separate on purpose", "Autonomous actions are paired with a refusal path"를 꼽았다 [확인].
- **RPT 점수** [코퍼스, 판단값]: Agent Front Desk 4.55, 다자 일정 4.20, 위임 증명·영수증 단독 2.85("인프라 단독은 진다").

## 6. 이전 리포트의 교훈 적용

1. 경쟁 제품과 실제로 비교하지 않고 "기존 해결책이 못 하는 일"이라고 단정하지 않는다. 공개 소개에 없다고 그 기능이 없다고 보지 않는다(POR §1·§5). [추론] Poppy v0.1 스펙과 레퍼런스 구현을 확인한 뒤 차별점을 말해야 한다.
2. 연결 가능성과 확보된 권한은 다르다(POR §9). Muse API, Connectors, Business Agent를 데모의 핵심 의존성으로 두지 않는다.
3. 가장 중요한 추가 정보는 실제로 접근 가능한 사용자다. "접근이 쉬울 것이라는 추정만으로 선정하지 않는다"(POR §10). [제안] 기업 쪽 사용자 1곳을 확보할 수 있는지 확인한다.
4. 중복 선례: "범용 소상공인 상담봇: Meta Business Agent 자체 기능과 중복"(POR §8, https://about.fb.com/news/2026/06/meta-business-agent/ 2026-06-03). [추론] 차별점은 상대가 에이전트일 때의 식별, 마스킹, 기록, 속도 제한이어야 한다.
5. 업체가 기능을 설명한 것과 실제로 작동하는 것을 구분한다(POR §2). 개인 게시글을 발생률로 늘려 쓰지 않는다. NYMag의 "절반"은 1명의 발언이다.
6. 사회적 의미, 안경 사용, 여러 모델 사용에 가산점이 있다는 근거는 없다. 모델을 억지로 붙이지 않는다(POR §3·§9).
7. 개인 자료는 Standard 모드로 처리하고, "학습 미사용"을 "무보관"으로 해석하지 않는다(POR §9).
8. 한국인이라는 이유만으로 직접 경험한 문제라고 쓰지 않는다(POR §3).
9. 통과 기준은 "기존 방법 대비 명확한 이점, 핵심 입력의 확보, 모델의 최소 동작 확인"이다. 핵심 관문을 48시간 안에 통과하지 못하면 우선순위를 내린다. D1~D10 일정을 따른다(POR §7·§10).
10. PRM 기준: "메타 ai모델을 사용하였을 때 전과 후의 변화가 제3자에게 뚜렷하게 보여지는지", "기존에 없는 혁신적 변화". [추론] 의미 기반 마스킹 판단처럼 모델이 꼭 맡아야 하는 역할을 사용 전후로 비교해 보여 줘야 한다.

## 7. 기존 시사점 중 원안과 맞닿는 것

- **A2A**: 1 받는 쪽 응대 데스크(신원, 의도, 정책 안 협상, 사람 이관) · 4 선택적 공개 핸드셰이크 · 5 AI 고지와 위임 범위 증명서 경량 표준 · 7 위험도 기반 승인과 사후 감사 요약 · 9 트래픽을 줄이는 협조형 설계(추첨, 대기열, 집단 협상)
- **STK**: 4 롱테일 가게용 에이전트 수용 키트 · 5 위임 범위를 기계로 검증하고 범위 준수를 증명 · 7 computer-use는 폴백 · 8 협상 타임라인, 승인 카드, 감사 로그 화면 · 10 주인이 다른 에이전트 2개 이상
- **OPN**: 2 B2A 접수처 · 4 수집 창, 하드 제약, 비신뢰 처리, 합의 영수증 · 5 범위 한정 위임 레이어 · 6 승인·감사 화면 · 7 모델 밖에 남는 정책과 책임을 해자로 · 9 카카오식 최소 권한
- **GAL**: 검증은 "증명 장면"으로 보여 주고, 인프라만 단독으로 내지 않으며, 가짜 상대를 쓰지 않는다
- **RPT**:
  - 해자 ①(응대 창구), ②(선택적 공개), ④(위임 증명과 영수증, 단독 출품 금지), ⑤(협조형)
  - 11.3 흐름: poppy.json·OAuth·AI 고지 → 상대 메시지 격리 → 코드 레일 → 위험한 건만 WhatsApp 승인 → 양측 합의 영수증(공개 필드 목록, 승인자, 서명)
  - 11.6 E1~E5 실험과 12 리스크
- **원안이 코퍼스보다 더 나간 지점** [추론]:
  1. 코퍼스의 프라이버시는 "내 비밀"을 지키는 문제다. 원안은 기업이 가진 **다른 사용자**의 정보를 지킨다. 코퍼스에는 이 해법 자료가 거의 없다.
  2. 코퍼스의 기록은 양측 영수증이다. 원안은 모든 행위를 공개하고 역추적한다. R5.2로 공백은 확인되지만, 코퍼스는 블록체인 구현을 약하다고 본다.
  3. 무차별 사용 억제는 해자 ⑤와 GovAI의 청구인별 한도가 가장 가깝다.

## 8. 충돌과 미검증 주장

1. **SovereignNegotiation-Bench**: A2A 8.2의 "시나리오 240개·궤적 13,440개·FullSovereign 1위"는 arXiv v2와 다르다. v2는 시나리오 1,764개, 모델 17개, 프롬프트·코드 가드 효과가 작다고 보고한다 [확인].
2. **Amazon 대변인의 "operate openly…" 인용**(OPN #14)은 TechCrunch 기사에 없다 [확인]. [추론] 2025년 Perplexity 소송 때의 성명으로 보이나 확인하지 못했다.
3. 네이버의 외부 에이전트 차단은 [미확인]이다. 카카오-쿠팡이츠 A2A 시점은 코퍼스가 6월, 검색은 8월이다.
4. NYMag과 The Verge 사례는 [미확인]이다. GovAI 원문에는 "마찰이 사라지면 rate limit도 사라진다"는 문장이 없고, 청구인별 한도는 스니펫에만 있다.
5. Cerebro: 코퍼스의 "rail은 측정하는 것만큼"은 원문이 "worth exactly what its definition is worth"이고, "거래 1건"은 원문이 "one third-party operation"이다. 테스트 1,602개는 [코퍼스]다.
6. Poppy의 단계는 정식 등급이 아니라 예시다. 버전 표기도 v0.3과 v0.1로 엇갈린다 [확인].
7. AgentLeak 게재처: 코퍼스는 EuroS&P라고 했지만 arXiv DOI는 IEEE Access를 가리킨다. CalBench의 "Llama 4 Maverick"은 초록에 없다.
8. Muse 순위는 1위와 2위로 엇갈리고, 전화 기능 출시일도 9/16과 9/17로 다르다. 국가는 미국에서 미국·캐나다로 바뀌었다(시점 차이) [확인].
9. Visa TAP의 서명 필드는 개요 페이지에 없다. Cloudflare "charge agents, not humans", Instinct 수치, 404 Media 보도는 [코퍼스]다.
10. 배점과 Official Rules는 오늘 재확인하지 못했다. POR이 링크한 research/*.md 6개는 로컬에 없다. RPT의 "카드게임 접근성 도구" 후보는 어느 파일에도 없다. OPN은 Muse Spark를 오픈웨이트라고 썼지만 이는 Spark Open과 혼동한 것이다. CV 집계는 AI가 센 하한치다.
