# AI 에이전트 시대의 "앱" — 오피니언·에세이·리서치 서베이 (2026-10-26 기준)

범위: "앱이 사람이 직접 쓰는 것에서 AI 에이전트가 대신 쓰는 도구로 바뀐다"는 주장을 둘러싼 강세론·회의론·리스크 논의. 최신순 정렬.
태그: 🟢강세(앱→에이전트 전환 지지) · 🔴회의/반론 · 🟠리스크·보안·법 · 🇰🇷한국 · 🔬연구
모든 항목은 직접 열어본 URL 기준. 직접 열지 못하고 검색 결과로만 확인한 내용은 `[검색 스니펫]`, 검증되지 않은 내용은 `[unverified]`로 표시함.

> 배경 사실 (해커톤 맥락에서 중요): Meta는 2026-09-08에 개인 에이전트 **Muse**(Muse Spark 모델, 사용자별 클라우드 VM)를 출시했음. 이 문서에 나오는 2026년 9~10월 논쟁(Amazon 차단, JPMorgan 차단, Stratechery 분석 등) 상당수가 Muse를 중심으로 돌아감. → 해커톤 결과물은 Muse를 **복제하는 대신 보완하는** 방향이어야 차별화됨.

---

## 1. Karri Saarinen (Linear CEO) — "Someone behind the software" 🔴
- **내용**: 에이전트로 소프트웨어 제작이 "공장화"되면서 각자 에이전트로 기능을 덧붙이면 제품이 "프랑켄슈타인"처럼 된다는 비판. "I want to feel the creator behind the software, not the factories."
- **AI 시대 앱 논지와의 관계**: 기능 생성 비용이 0에 가까워질수록 *관점(point of view)·취향·일관성*이 희소 자원이 된다는 반론. "에이전트가 앱을 대체한다"보다 "에이전트가 앱을 망가뜨릴 수 있다"는 경고.
- **신호**: Linear는 자체 agent platform 운영 중인 에이전트 친화 기업의 CEO가 낸 자기비판이라 무게가 있음.
- **출처**: https://karrisaarinen.com/posts/someone-behind-the-software · **2026-10-15**

## 2. a16z — "Wallet Wars" (Terry Angelos) 🟢🟠
- **내용**: Muse·OpenAI Dots·Instinct 같은 개인 에이전트가 결제권을 갖게 되면서 "누가 에이전트의 결제를 돕나"와 "누가 에이전트가 *나로서* 거래하게 하나"의 두 전쟁이 벌어진다고 분석. Stripe Link 가상카드는 거래는 되지만 가맹점과의 관계(로열티·마일리지)를 깨뜨린다고 지적.
- **핵심 인용**: "We are headed to a world where an agent needs a **payment policy**, not just a payment credential." / "when my agent gets it wrong, who makes it right?"
- **관계**: 앱이 사라지면 *결제·책임·관계*가 어디로 가는지가 새 플랫폼 싸움터. Visa Intelligent Commerce, Mastercard AgentPay, Amex ACE 등 카드사 표준 언급.
- **신호**: a16z 공식 뉴스레터. Link 300M, Shop Pay 250M, PayPal 400M+ 사용자 수치 인용.
- **출처**: https://www.a16z.news/p/wallet-wars · **2026-10-15**

## 3. JPMorgan Jamie Dimon — 외부 에이전트 계좌 접근 차단 🟠
- **내용**: 3Q26 실적 발표에서 Muse·Instinct 등 외부 에이전트의 고객 계좌 로그인/행동을 차단한다고 발언. "We're not going to allow just any outside agent to come in inside the company because it's too risky." "There's a **liability transfer**. They should understand the liability transfer."
- **관계**: 에이전트가 앱을 대신 쓰려 해도 **권한·책임 구조가 없으면 금융 같은 고위험 영역은 닫힌다**는 현실. 동시에 JPM은 자체 Smart Cash 에이전트를 파일럿 중 → "외부 에이전트는 막고 자기 에이전트는 키운다".
- **신호**: 미국 최대 은행. 이후 Reuters(10/23)는 "미국 주요 은행들이 3자 에이전트를 차단 중"이라고 보도 `[검색 스니펫]`.
- **출처**: https://www.bankingdive.com/news/jpmorgan-dimon-ai-agents-bank-customers-liability-transfer/832870/ · https://www.cnbc.com/2026/10/13/jpmorgan-ai-agents-account-access.html · **2026-10-13**

## 4. The Verge (Mia Sato) — "AI agents are ready to shop. Some retailers are wary" 🔴🟠
- **내용**: Muse로 실제 쇼핑을 테스트. Target 봇 체크에 들쭉날쭉 막히고, Amazon은 하드 블록, 결과적으로 "직접 찾는 게 더 빨랐을 것". 더 큰 문제는 *작동할 때*: The RealReal에서 Muse로 신상 10개를 20분 홀드마다 반복 장바구니 담기 → 다른 인간 구매자를 사실상 차단(이후 TRR이 봇 설정 변경).
- **인용**: 에이전트 쇼핑은 "like looking at the world through a pinhole." / "The joy and thrill of discovery is largely gone."
- **관계**: (a) 에이전트-앱 접근은 아직 불안정, (b) **에이전트 간 경쟁이 인간에게 외부효과**를 낳음, (c) 쇼핑의 '발견의 즐거움'은 최적화 대상이 아닐 수 있음.
- **신호**: 메이저 테크 매체의 실사용 리뷰. Delta·Amtrak 예약 차단 사례도 언급.
- **출처**: https://www.theverge.com/report/1015811/ai-shopping-agents-blocked-amazon-the-realreal-target-meta-muse · **2026-10-22**

## 5. Salesforce (Kishan Chetan) — "Personal Agents Will Drive More Contact Center Traffic Than They Offset" 🟢🟠
- **내용**: 개인 에이전트는 지치지 않고 대기·재문의·동시 비교를 하므로 기업 콜센터 트래픽이 "astronomical"하게 증가할 것. 해법: "meet personal agents at the front door with your own business agents."
- **관계**: 소비자 측 에이전트만 늘고 **기업 측 '에이전트 응대 창구'는 비어 있다**는 B2A(Business-to-Agent) 공백을 대기업이 직접 인정. 사용자의 "에이전트 간 협상" 관찰과 정확히 맞닿음.
- **신호**: Salesforce Agentforce/Service Cloud 총괄 EVP의 공식 입장.
- **출처**: https://www.salesforce.com/news/stories/personal-agents-to-drive-more-contact-center-traffic/ · **2026-10-19**

## 6. 🇰🇷 한겨레 — "네이버, 자체 AI 쇼핑비서 키워…카카오, 외부 연대 생태계 확장"
- **내용**: 네이버는 쇼핑·플레이스 데이터를 지렛대로 '독자 노선' — **외부 에이전트의 자사 서비스 접근을 차단**하고 'AI 탭' 아래 버티컬을 묶으며, 네이버플러스 스토어 쇼핑 에이전트에 결제 기능을 연내 시범 검토. 카카오는 '연합 작전' — 3월 '카카오 툴즈'(MCP)에 올리브영·무신사·현대백화점·삼쩜삼·마이리얼트립 입점, 6월 첫 **A2A 파트너로 쿠팡이츠** 낙점.
- **인용**: 네이버 관계자 "결제 프로토콜의 안정성뿐만 아니라 빠른 배송과 반품·교환, 고객상담(CS)까지 쇼핑 전 과정의 완결성이 담보돼야". 두 회사 모두 Muse 같은 전면적 에이전트에는 신중 — "AI가 사람 대신 결제를 수행하는 프로토콜에 대한 정부 가이드라인이 명확히 정립되지 않은 데다, 개인정보 보호 문제".
- **관계**: 한국판 '월드가든 vs 개방' 구도. 한국은 규제 가이드라인 공백이 실제 병목.
- **출처**: https://www.hani.co.kr/arti/economy/it/1283144.html · **2026-10-19**

## 7. 🇰🇷 Kakao — if(kakao)26 "모든 연결에 지능을" (Kanana Space · Kanvas · Project Mosaic)
- **내용**: 카톡 어디서나 두 손가락 스와이프로 호출하는 AI 어시스턴트 '카나나 스페이스'(12월 CBT, 향후 주문·선물·예약·송금 "완결형" 실행), PC에서 나만의 에이전트 팀을 만드는 '칸바스'(에이전트 공유 예정, 타 프레임워크 에이전트도 카톡에서 사용 지원 계획), 흩어진 기억을 맥락으로 묶어 **각 에이전트에게 필요한 정보만 허용 범위 내 전달**하는 'Project Mosaic', 온디바이스+대형모델을 조율하는 'AI Conductor'.
- **관계**: "메신저가 에이전트 OS가 된다"는 한국형 답(Stratechery의 Meta/WhatsApp 논지와 동형). 에이전트 간 맥락 공유·권한 최소화를 설계 원칙으로 명시.
- **신호**: 5천만 사용자 메신저. 내년 상반기 카톡 내 '에이전트 팀' 공간 계획.
- **출처**: https://www.kakaocorp.com/page/detail/12160 · **2026-10-13**

## 8. Notion (Ivan Zhao) — "에이전트가 아니라 컨텍스트 레이어에 집중" 🔴(부분)
- **내용**: 기업 AI 활용을 4단계로 구분(L1 사고 파트너 57%, L2 에이전트 비서 31%, L3 자율 팀원 10%, L4 회사 OS 2%). L2→L3의 벽은 **"context fragmentation"과 조직문화**. 모두가 에이전트에 몰릴 때 Notion은 거버넌스 있는 context layer를 맡겠다.
- **관계**: 에이전트 자체는 범용화되고, 가치는 *에이전트에게 무엇을 먹이느냐(맥락)·누가 통제하느냐(거버넌스)*로 이동한다는 주장. Karpathy의 "context engineering"과 같은 결.
- **신호**: Enterprise ARR +169%(2026-08 기준), 그 성장의 2/3가 AI 관련이라고 발표.
- **출처**: https://ascii.jp/en/elem/000/004/440/4440885 · **2026-10-08**

## 9. Microsoft Dev Blog / Netlify — Agent Experience (AX) 🟢
- **내용**: AX = "AI 에이전트가 당신의 기술을 *발견·선택·사용*할 때의 경험". 두 지표: **propensity**(제품명을 안 줘도 에이전트가 당신 것을 고르나), **efficacy**(올바르게 쓰나). 실측 결과 "에이전트 친화적으로 보이는" 변경이 오히려 악화되기도 함(CLI에 JSON 모드 추가 → 정확도↓, 비용 4~11배↑). GEO는 AX의 일부(언급되기)일 뿐, AX는 "제대로 쓰이기"까지.
- **원 개념**: Netlify CEO Mathias Biilmann이 2025-01 제안 — "the holistic experience AI agents will have as the user of a product or platform."
- **관계**: "에이전트가 고객이 되면 누구를 위해 디자인하나"에 대한 가장 실무적인 답. UX→DX→AX.
- **출처**: https://developer.microsoft.com/blog/what-is-agent-experience-ax/ (**2026-10-06**) · https://biilmann.blog/articles/introducing-ax (2025-01) · https://www.netlify.com/agent-experience/

## 10. a16z — Top 100 Gen AI Consumer Apps, 7th Edition (Olivia Moore) 🟢🔴
- **내용**: 소비자 AI는 "wide, but not very deep" — 미국 4.5%만 ChatGPT/Gemini/Claude 유료 구독. 상위 1% 지출자가 월 $903, 전체 지출의 19.5%. 개인 에이전트 경쟁: Instinct(iMessage, 3주 만에 10만 명, 연 환산 거래액 $1B+ 주장), Muse(첫 주 DAU 25만, 1개월 내 5M 다운로드), Dots, Grok Bot. "Amazon shut down access for Meta's Muse in under two weeks, while Shopify, Instacart, OpenTable, Expedia, Ticketmaster, Plaid … signed official integrations."
- **핵심 관찰**: "almost none of the top consumer AI products today have any real **multi-player** appeal." / 에이전트는 구독이 아니라 **거래 수수료(take rate)** 모델 가능성.
- **관계**: 개인 에이전트 카테고리는 이미 빅테크 격전지(=포화). 공백은 멀티플레이어·거래 기반 모델.
- **출처**: https://a16z.com/100-gen-ai-apps-7 · **2026-10-05**

## 11. OpenAI — "Introducing dots" 🟢
- **내용**: GPT-6 Astra 기반 always-on 에이전트, **자체 클라우드 컴퓨터** 보유, 4,000+ 앱 플러그인, ChatGPT·Slack·Teams에서 대화. 백그라운드 "proactive research"는 읽기 전용 도구로 제한, Custom Rules로 허용/승인/차단, 비밀번호 변경 같은 민감 작업은 항상 사람에게. 기업용 "specialist dots"(고유 ID·자격증명, Microsoft Agent 365 거버넌스 연동).
- **관계**: "에이전트 = AI + 자기 컴퓨터 + 권한 정책 + 감사 뷰"가 2026년 표준 아키텍처로 수렴했음을 보여줌(Muse와 거의 동일한 설계).
- **신호**: Bloomberg 보도 `[검색 스니펫]`: 신규 $500 유료 티어.
- **출처**: https://openai.com/index/introducing-dots · **2026-09-29**

## 12. Ben Thompson (Stratechery) — "Apps, Agents, and Aggregation" + "The Race to Headless" 🟢
- **내용**: "Are you getting that not only will we not program computers, we won't use them — AI will? Are you getting that pre-built UI — write once, run everywhere, for everyone — is dead?" Muse로 5분 만에 인스타 저장 레시피를 정리하는 개인 앱을 만든 경험 → "the infinite app … effectively disposable". 웹에서 희소했던 것이 *discovery*였다면 에이전트 시대에 희소한 것은 *volition(의지)*: "the problem to be solved is not discovery, but rather **inspiration**." 앱·서비스는 "mere suppliers … scrapping for crumbs from the Agent, the ultimate gatekeeper of not just user demand, but desire." 승자는 배포력을 가진 Meta(모든 사람)와 Microsoft(모든 직장인).
- **후속(9/16, 유료)**: "Salesforce is abandoning UI as a moat, which is a very smart move because it's disappearing for everyone."
- **관계**: 현재 가장 영향력 있는 강세론. 에이전트는 '궁극의 Aggregator' → 개별 앱의 협상력 붕괴.
- **출처**: https://stratechery.com/2026/apps-agents-and-aggregation/ (**2026-09-28**) · https://stratechery.com/2026/salesforce-ai-force-agents-as-ui-the-race-to-headless/ (2026-09-16)

## 13. Simon Willison — "2026 in LLMs (so far)" + "The lethal trifecta" 🟠
- **내용(2026-09)**: OpenClaw(일명 "Claw")가 개인 에이전트라는 새 카테고리를 정의 — "A Claw is really just a coding agent wearing a less threatening hat." 경쟁은 "**safe Claw**" 만들기. Muse에 대해 "I'm not yet convinced you *can't* shoot yourself in the foot with Muse." 에이전트 소셜넷 MoltBook은 출시 4일 만에 "slop and spam"에 묻힘(이후 Meta가 인수). AI의 PMF는 2026년 coding agents로 달성.
- **내용(2025-06)**: **Lethal trifecta** = 개인 데이터 접근 + 신뢰 못 할 콘텐츠 노출 + 외부 통신 능력. 세 가지가 결합되면 프롬프트 인젝션으로 데이터 탈취 가능. "we still don't know how to 100% reliably prevent this"; 가드레일의 "95%"는 보안에서 낙제점.
- **관계**: "에이전트가 앱을 대신 쓴다"의 정의 자체가 trifecta(메일·결제·웹 브라우징)를 만족함 → 구조적 리스크. Muse의 'Sentinel' 분리 설계는 이에 대한 대응.
- **출처**: https://simonwillison.net/2026/Sep/27/2026-in-llms-so-far (**2026-09-27**) · https://simonwillison.net/2025/Jun/16/the-lethal-trifecta (2025-06-16)

## 14. Amazon의 Muse 차단 + Muse macOS 0-day 🟠
- **내용**: Amazon은 Meta가 Muse에서 Amazon을 빼달라는 요청을 거부하자 차단. Amazon 대변인: "third-party applications that offer to make purchases on behalf of customers from other businesses should operate openly and respect service provider decisions about whether or not to participate." 같은 날 Patrick Wardle이 Muse macOS 앱의 문서화되지 않은 설정 키로 임의 로컬 프로세스가 받아쓰기 트래픽 탈취·프롬프트 주입·세션 하이재킹 가능함을 공개(약 12시간 후 핫픽스). Forkast는 Amazon이 "에이전트가 AI임을 밝히지 않고 자격증명을 저장"한 것을 문제 삼았다고 전함 `[unverified: Forkast 2차 보도]`.
- **관계**: "**agent-as-attack-surface**" — 사용자 대신 넓은 권한을 가진 에이전트는 그 자체가 최우선 공격 대상. 월드가든은 보안을 명분으로 강화됨.
- **출처**: https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ · https://forkast.news/muses-undocumented-endpoint-turns-macos-agent-into-a-local-backdoor · **2026-09-21~22**

## 15. Meta — Muse 출시 / Muse for Small Business 🟢 (해커톤 주최사 자체 비전)
- **내용**: "It doesn't just answer questions, it actually does the work." Muse Spark 모델, 사용자별 **Muse Secure VM**(자체 브라우저), 별도 **Sentinel 에이전트**가 인터넷 송신을 승인, 자격증명은 모델이 볼 수 없는 저장소, 구매·메일 전 승인, 전체 audit trail. "It can open a browser, fill out forms, and **negotiate on their behalf**." 결제는 Stripe Link 일회용 카드. 9/29 Small Business 버전: Shopify·Stripe·QuickBooks·Notion 등 커넥터, "nothing publishes, sends, or spends without your approval", 파트너는 muse.ai/platform으로 커넥터 신청.
- **관계**: 해커톤 심사의 "Meta AI tooling" 맥락. Meta가 정의한 안전 패턴(VM 격리, Sentinel, 승인 게이트, 감사 로그)을 따르는 프로젝트는 설득력이 높음. 반면 "또 하나의 개인 비서"는 Muse와 정면 중복.
- **출처**: https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent (**2026-09-08**) · https://about.fb.com/news/2026/09/introducing-muse-small-business/ (2026-09-29)

## 16. Benedict Evans — "AI, tools and transformation" 🔴
- **내용**: "모두가 모델에게 필요한 소프트웨어를 만들어 달라고 하면 앱은 죽는다"는 생각은 실리콘밸리 tool-builder의 착각. 대부분 사람은 tool-builder가 아니고, 어려운 건 *도구가 필요하다는 걸 아는 것*과 *도구가 무엇을 해야 하는지 아는 것*. 반복·고위험 작업은 결국 감사·보안·책임 때문에 **제도화(institutionalized)** 되어 앱이 된다. "AI doesn't change the question: it creates new choices and moves the thresholds."
- **관계**: "앱이 사라진다" 대신 "앱과 즉흥 도구(채팅) 사이 경계가 이동한다"는 가장 정교한 반론. 기업 배포는 여전히 파일럿 절반 실패의 구식 CIO 게임.
- **출처**: https://www.ben-evans.com/benedictevans/2026/9/3/ai-tools-and-transformation · **2026-09-03**

## 17. Amazon v. Perplexity (Comet) — 9th Circuit 가처분 취소 🟠
- **내용**: 2025-11 Amazon 제소 → 2026-03 지방법원 가처분 → **2026-08-04 9th Circuit 취소**: 사용자가 Comet 에이전트에게 Amazon 작업을 지시하면 "it's the user—not Perplexity—accessing Amazon's computers"라 CFAA 위반 주장이 성공 가능성 낮다고 판단. 본안은 진행 중(Amazon 수정 소장 2026-09, Perplexity 기각 신청 2026-10 `[검색 스니펫: MLex]`).
- **관계**: "에이전트 = 사용자의 대리인" 법리가 일단 우세. 다만 약관(ToS)으로 에이전트를 막을 수 있는지는 미결 → 플랫폼은 기술적 차단(Muse 사례)으로 대응.
- **신호**: eMarketer: Amazon 광고 매출 2026년 $83.34B 전망 — 에이전트가 광고 노출을 우회하는 게 핵심 이해관계.
- **출처**: https://www.emarketer.com/content/perplexity-comet-amazon-ai-shopping-agents-ruling · 판결문 https://cdn.ca9.uscourts.gov/datastore/opinions/2026/08/04/26-1444.pdf · **2026-08-04/05**

## 18. 🔬 arXiv 2608.19551 — "Delegating or Doing? Understanding User Behavior in Hybrid Human-Agent Interfaces"
- **내용**: MCP로 LLM 에이전트를 붙인 CMS에서 N=73 실험(GUI만 / AI 우선 / 하이브리드). AI 보조는 클릭·페이지 이동·스크롤을 크게 줄였지만 **작업 시간은 줄지 않음**. 사용자는 고위험 CRUD(삭제 등)를 체계적으로 피하지 않았고, 위임 정도는 **과업보다 사람에 따라** 달랐음(ICC=.50).
- **관계**: "UI가 사라진다"보다 "GUI+에이전트 하이브리드, 그리고 개인별 자율성 슬라이더"가 맞다는 HCI 근거. 위험 작업을 사용자가 알아서 피하지 않으므로 **시스템이 위험 기반 승인 게이트를 강제**해야 함.
- **출처**: https://arxiv.org/abs/2608.19551 · **2026-08-20** (HAI 2026, 오사카)

## 19. 🇰🇷 오마이뉴스(임선영) — "앱의 종말, 화웨이는 스마트폰을 AI폰으로"
- **내용**: PC 시대 사람→Web→Service, 스마트폰 시대 사람→App→Service, AI폰 시대 **사람→AI Agent→Service**. 화웨이 HarmonyOS '원서비스(Atomic Service)'로 앱을 AI가 호출 가능한 서비스 단위로 분해(JD.com은 쇼핑을 200개+ 상황별 카드로 분해). Apple App Intents, Google AppFunctions도 같은 방향. 에이전트 시대 권력은 "누가 사용자의 첫 번째 의도를 받는가 / 누가 서비스를 선택하는가 / 누가 결제와 실행까지 완수하는가"로 이동하며, 슈퍼앱(위챗)도 슈퍼 에이전트에게 우회당할 수 있음.
- **관계**: 한국어권에서 가장 명료한 '앱 → 서비스 단위(capability)' 분해 논지. arXiv 2603.20300의 "invocable capabilities"와 동일 구조.
- **출처**: https://v.daum.net/v/5DdKLJWI0C · **2026-08-16**

## 20. Y Combinator — Requests for Startups, Fall 2026 🟢
- **에이전트 관련 요청**: **Multiplayer AI**(Aaron Epstein) — "AI hasn't had its multiplayer moment yet … Anyone on a team should be able to drop into the same live agent session to watch it work, redirect it, and hand it off." **A Cloud for Small Software**(Pete Koomen) — 에이전트로 만든 1인/소수용 소프트웨어는 쉽게 만들지만 배포·공유·권한이 어렵다, "as easy to share … as a Google Doc." **Proving You're Human** — 딥페이크·봇 시대 인간 검증 레이어. **Self-Maintaining APIs** — API 제공자의 에이전트가 고객 코드베이스에 PR을 직접 연다. **AI-Powered Consumer Products for 1B People** — "you can treat an agent like a person", 토큰 비용이 연 10x 하락. Crypto RFS에서도 "agents are going to use crypto networks as financial rails".
- **관계**: YC가 공식적으로 *개인 에이전트*보다 **멀티플레이어·공유·신원·에이전트 간 유지보수** 쪽에 공백이 있다고 봄.
- **출처**: https://www.ycombinator.com/rfs (Fall 2026 탭) · **2026-07~08** (Inc. 보도 2026-07-27: https://www.inc.com/lucia-auerbach/y-combinator-requests-for-startups-fall-2026/91379840)

## 21. Cloudflare — "Content Independence Day, one year on: building the business model for the agentic Internet" 🟠
- **내용**: "more than 50% of traffic on the Internet is now non-human." 정보 탐색 1시간 중 오픈웹 체류는 15분. 일부 카테고리 인간 트래픽 1년 새 최대 40% 감소, 퍼블리셔는 "Google Zero" 대비. AI 학습 크롤러 비중 52%(2025 봄 22%). 해법으로 bot 자기신원 증명(Web Bot Auth), 크롤 의도 선언, Pay Per Crawl → Pay Per Use.
- **관계**: '죽은 인터넷/에이전트가 고객' 논제의 정량 근거. 웹의 수익모델이 "트래픽↔노출"에서 "**에이전트 접근 허가·과금**"으로 재편 중.
- **출처**: https://blog.cloudflare.com/agentic-internet-bot-report · **2026-07-01**

## 22. Google A2UI v0.9 — 생성형 UI 표준과 반발 🟢🔴
- **내용**: 에이전트가 임의 코드를 보내지 않고 *UI 의도*만 선언하면 앱의 기존 디자인 시스템 컴포넌트로 웹·모바일·데스크톱에 네이티브 렌더링. MCP·A2A 1.0·AG-UI 위에서 동작. 경쟁 표준: MCP Apps, Vercel json-render 등. 반론: HN "Why on earth would you trust an LLM to output a UI? You're just asking for security bugs, UI impersonation attacks…", Reddit "every UI will become the same".
- **관계**: "UI가 사라진다" vs "UI가 생성된다" 논쟁의 현실적 타협점 = **고정 카탈로그 + 동적 조합**. Karpathy는 이를 "horseless carriage"(구 UI를 복제하는 과도기)라 부름.
- **출처**: https://www.infoq.com/news/2026/07/google-a2ui-genui/ · **2026-07-03**

## 23. Andrej Karpathy — Sequoia AI Ascent 2026 / "Build for agents" (2025) 🟢
- **내용(2026-04)**: Software 3.0 = 컨텍스트 윈도가 새 프로그래밍 표면. MenuGen 일화 — 메뉴 사진 OCR→요리 추출→이미지 생성→UI로 만든 앱이, Gemini에 사진을 주고 "메뉴 위에 음식 이미지를 overlay하라"는 한 번의 요청으로 대체 → "**A lot of AI apps are temporary wrappers around model limitations.**" "Don't just ask what AI can help you build faster. Ask what AI makes unnecessary." OpenClaw 설치는 bash 스크립트 대신 "에이전트를 위한 지시문 블록". "Vibe coding raised the floor. Agentic engineering raises the ceiling."(Stephanie Zhan 요약)
- **내용(2025)**: "The primary audience of your thing … is now an **LLM, not a human**. LLMs don't like to navigate, they like to scrape … don't like to click, they like to curl." 동시에 "The term 'ChatGPT wrapper' is tired and really, really wrong" — 앱 레이어는 context engineering·생성-검증 UI·가드레일로 두껍다.
- **관계**: 강세론의 원조이면서도 "모델이 흡수할 래퍼"와 "두꺼운 앱 레이어"를 구분하라는 경고를 함께 줌.
- **출처**: https://www.theaiopportunities.com/p/sequoia-ai-ascent-2026-andrej-karpathy (2차 요약, **2026-04-30**) · 영상 https://www.youtube.com/watch?v=96jN2OCOfLs · 2025 포스트 모음 https://github.com/btbujiangjun/karpathy-wiki/blob/main/wiki/sources/karpathy-x-2025-build-for-agents.md · YC 강연(2025-06) https://www.ycombinator.com/library/MW-andrej-karpathy-software-is-changing-again

## 24. Salesforce — "Headless 360. No Browser Required." 🟢
- **내용**: "Why should you ever log into Salesforce again?"(Parker Harris). 모든 기능을 API·MCP tool·CLI로 노출(60+ MCP 툴). "If your platform requires humans to click through UIs … it is not ready for the Agentic Enterprise." 에이전트용 UI는 'Experience Layer'로 Slack·ChatGPT·Claude·Gemini 등 MCP Apps 지원 클라이언트에 렌더.
- **관계**: Nadella가 예언한 "SaaS가 에이전트 아래로 붕괴"를 SaaS 1위가 스스로 수용(Thompson: UI를 해자로 포기). Workday도 2026-10 "headless access" 발표 `[검색 스니펫]`.
- **출처**: https://www.salesforce.com/news/stories/salesforce-headless-360-announcement/ · **2026-04-15**

## 25. 🔬 arXiv 2603.20300 — "From Human Interfaces to Agent Interfaces: Rethinking Software Design in the Age of AI-Native Systems"
- **내용**: 소프트웨어의 1차 소비자가 인간에서 에이전트로 바뀌는 패러다임 전환을 주장. **agent interface**를 정형화하고 **invocable capabilities**를 AI 지향 소프트웨어의 기본 단위로 제시. 설계 원칙: machine interpretability, composability, invocation reliability. "monolithic applications → capability-based systems that can be dynamically composed by AI agents."
- **관계**: 사용자 논지("앱이 에이전트가 운용하는 도구가 된다")의 학술적 정식화. 다만 개념 논문(실증 없음), 인용 0 `[arxiv.gg 기준]`.
- **출처**: https://arxiv.org/abs/2603.20300v1 · **2026-03-19**

## 26. Satya Nadella의 "SaaS 붕괴" 발언과 역풍 — SiliconANGLE "Satya's sacrifice" 🟢🔴
- **원 발언(2024-12 BG2 팟캐스트)**: "the notion that business applications exist, that's probably where they'll all collapse, right, in the agent era … they are essentially CRUD databases with a bunch of business logic. The business logic is all going to these agents" `[검색 스니펫: 2차 인용, 원 팟캐스트 미시청]`.
- **2026 재해석(Vellante & Gilbert)**: 예언은 *단일 사용자 앱*(Office)에만 맞고 *다중 사용자 SaaS*에는 틀림 — 다중 시스템을 건드리는 에이전트 행동은 트랜잭션 일관성과 거버넌스가 필요해 "System of Intelligence" 계층이 생김. 아이러니하게 Claude Cowork가 Office 파일 포맷을 직접 조작하며 Office를 "container에서 component"로 격하 → 2026-01~02 'SaaSpocalypse'. 좌석 과금 → 토큰 과금 → (꿈) 결과 과금.
- **관계**: "앱이 사라진다"가 아니라 **"앱의 UI·로직이 에이전트 계층으로 이동하고, 데이터·권한·거버넌스만 남는다"**는 중간 입장.
- **출처**: https://siliconangle.com/2026/02/28/satyas-sacrifice-agents-threaten-office-microsoft-responds · **2026-02-28** · 원 발언 정리 https://www.windowscentral.com/microsoft/hey-why-do-i-need-excel-microsoft-ceo-satya-nadella-foresees-a-disruptive-agentic-ai-era-that-could-aggressively-collapse-saas-apps

## 27. 🇰🇷 브런치(kimdonglin) — "클로드 코드와 오픈클로가 보여준 것: 앱 다음은 CLI" 
- **내용**: "GUI의 종말"이 아니라 "실행 인터페이스의 이동". 에이전트 업무는 버튼보다 파이프(조합성·재현성). 그러나 실행력이 강해질수록 **권한·리뷰·감사·협업** 같은 거버넌스 UI가 더 중요해짐 → 권장 구조 "CLI 커널 + 앱 셸": "**CLI는 실행 엔진이다. 앱은 신뢰 엔진이다.**"
- **관계**: 앱의 역할이 '조작 화면'에서 '신뢰·승인 화면'으로 바뀐다는 실용적 재정의.
- **출처**: https://brunch.co.kr/@230kimi/51 · **2026-02-15**

## 28. Gartner — "40%+ of agentic AI projects will be canceled by end of 2027" 🔴
- **내용**: 비용 증가, 불명확한 비즈니스 가치, 부적절한 리스크 통제로 2027년 말까지 에이전틱 AI 프로젝트 40% 이상 취소 예측. 기존 챗봇·RPA를 에이전트로 리브랜딩하는 "**agent washing**" 경고. 2026 Hype Cycle 글에서도 같은 전망 반복 `[검색 스니펫]`.
- **관계**: 엔터프라이즈 측 대표 회의론. "자율성"보다 "신뢰성"이 병목.
- **출처**: https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 · **2025-06-25** · https://www.gartner.com/en/articles/hype-cycle-for-artificial-intelligence (2026)

## 29. 🔬 Microsoft Research "Magentic Marketplace" + MIT/Media Lab "The Automated but Risky Game" — 에이전트 대 에이전트 거래의 실패 양상 🟠
- **Magentic Marketplace(2025-10/11)**: 소비자 대리 Assistant 에이전트 vs 사업자 Service 에이전트 양면시장 시뮬레이션. 규모가 커지면 성능 급락, 모든 모델에 심한 **first-proposal bias**(품질보다 응답 속도가 10~30배 유리), 프롬프트 인젝션·설득 기법으로 결제를 조작 가능.
- **Automated but Risky Game(2025-05)**: 소비자·판매자 양쪽이 에이전트에게 협상·거래를 전권 위임하는 시나리오. "AI-mediated deal-making is an inherently **imbalanced game**" — 모델에 따라 결과 격차가 크고, 과지출·불합리한 거래 수락 같은 행동 이상으로 양측 금전 손실.
- **관계**: 사용자가 주목한 "에이전트 간 협상" 미래의 **핵심 미해결 문제** — 공정성·조작 내성·검증. 2026년에도 협상 벤치마크(AgenticPay, ICLR 2026; arXiv 2608.07538 등)가 활발 `[검색 스니펫]`.
- **출처**: https://arxiv.org/abs/2510.25779 · https://www.microsoft.com/en-us/research/blog/magentic-marketplace-an-open-source-simulation-environment-for-studying-agentic-markets · https://arxiv.org/abs/2506.00073

---

## 시사점

1. **포화 영역 — "또 하나의 개인 비서/쇼핑 에이전트"는 피할 것.** 2026년 9~10월에 Muse(Meta), Dots(OpenAI), Instinct, Grok Bot, 카카오 카나나 스페이스가 한꺼번에 나왔고, 모두 같은 구조(자체 클라우드 VM + 커넥터 + 승인 게이트 + 감사 로그)로 수렴함(#11, #15). 해커톤에서 이걸 다시 만들면 주최사 제품의 열화판이 됨. 단, Muse의 안전 패턴(VM 격리, Sentinel, 승인 전 대기)은 **그대로 차용해 기술 깊이 근거로 쓰는 게 유리**함.
2. **가장 큰 공백 — 사업자 측(B2A) "에이전트 응대 창구".** 소비자 에이전트는 급증하는데 기업 쪽은 봇 차단이나 콜센터 폭주로만 대응 중(#4, #5, #14). Salesforce조차 "business agent로 앞문에서 맞이하라"고만 말하고, 중소상공인용 구현은 비어 있음. → *소상공인/로컬 비즈니스가 외부 개인 에이전트와 정책 범위 안에서 예약·견적·협상하는 "에이전트 접수처"*는 Impact(소상공인)와 Meta 생태계(WhatsApp·Instagram 비즈니스·Muse for Small Business 커넥터 #15)에 모두 맞음 `[INFERENCE]`.
3. **멀티플레이어/다자 조율은 강세론자와 VC가 모두 지목한 미해결 영역.** a16z "almost none … have any real multi-player appeal"(#10), YC "AI hasn't had its multiplayer moment yet"(#20). 사용자가 예로 든 *여러 사람의 에이전트가 서로 일정을 협상하는 문제*가 정확히 이 공백. 1인 에이전트가 아니라 **N명의 에이전트가 각자 주인의 선호·제약을 지키며 합의에 이르는 과정**을 보여주는 데모는 차별화됨.
4. **에이전트 간 협상의 진짜 난제는 '공정성·조작 내성·검증'.** 연구는 first-proposal bias, 모델 간 격차, 프롬프트 인젝션으로 인한 조작을 반복 확인함(#29). 그리고 The Verge 사례처럼 에이전트끼리의 경쟁은 사람에게 외부효과를 줌(#4). → 협상 프로토콜에 *제안 수집 창 강제(첫 제안 편향 제거), 주인 정책 하드 제약, 상대 메시지의 비신뢰 처리(trifecta 차단), 합의 영수증*을 넣으면 그 자체가 기술 깊이이자 데모 포인트가 됨 `[INFERENCE]`.
5. **신뢰·위임·책임 레이어는 아직 주인이 없음.** "payment policy, not just a payment credential"(#2), Dimon의 "liability transfer"(#3), 법원은 "에이전트 = 사용자"로 봤지만 약관 문제는 미결(#17), 한국은 결제 위임 가이드라인 자체가 공백(#6). 웹 쪽에서는 Web Bot Auth 같은 bot 신원 증명이 표준화 중(#21). → *사람이 에이전트에게 준 범위 한정 위임(누가·무엇을·얼마까지·언제까지)을 기계가 검증할 수 있는 형태로 발급·제시·감사하는 레이어*는 열려 있는 영역 `[INFERENCE]`.
6. **UI는 사라지지 않고 역할이 바뀜: '조작 화면' → '승인·감사·협업 화면'.** HCI 실험에서 에이전트는 노력은 줄였지만 시간은 줄이지 못했고, 위임 성향은 과업보다 사람에 따라 갈렸으며, 사용자는 위험 작업을 알아서 피하지 않았음(#18). "CLI는 실행 엔진, 앱은 신뢰 엔진"(#27), A2UI/MCP Apps의 '고정 카탈로그 + 생성 조합'(#22). → 데모 UI는 채팅창이 아니라 **에이전트 간 협상 타임라인 + 위험도 기반 승인 + 개인별 자율성 슬라이더**로 보여주는 게 설득력 있음.
7. **회의론에서 배울 점: '래퍼'와 '제도화된 앱'을 구분할 것.** Karpathy의 MenuGen 교훈(모델이 흡수할 래퍼는 사라짐, #23), Evans의 "반복·고위험 작업은 결국 제도화된다"(#16), Saarinen의 "관점 없는 기능 덧붙이기 비판"(#1), Gartner의 agent washing(#28). → 다음 모델이 나오면 흡수될 기능이 아니라 **다자간 상태·정책·책임처럼 모델 밖에 남아야 하는 것**을 해자로 삼아야 함.
8. **에이전트가 고객이 되면 측정이 해자.** AX(propensity/efficacy)와 GEO는 "에이전트가 나를 고르고 제대로 쓰는가"를 다룸(#9). 에이전트가 넘쳐나는 시장에서 *사업자 쪽 에이전트가 얼마나 잘 발견·선택·처리되는지 측정하는 대시보드*는 B2A 제품과 자연스럽게 붙음 `[INFERENCE]`.
9. **한국 맥락의 기회.** 네이버는 외부 에이전트를 막고 카카오는 MCP·A2A로 연합하는 중이며(쿠팡이츠가 첫 A2A 파트너, #6, #7), 결제 위임 규제는 공백. 카카오는 Project Mosaic에서 "에이전트에게 필요한 정보만 허용 범위 내 전달"을 원칙으로 명시함. → 한국 소상공인/플랫폼 간 에이전트 상호운용과 최소권한 맥락 전달은 Impact 서사로 쓸 만함. 다만 해커톤은 글로벌 심사이므로 한국은 '구체적 시장 사례'로만 쓰는 게 안전함 `[INFERENCE]`.
10. **눈에 띄는 해커톤 프로젝트 공식(제안).** (a) 1인 비서가 아니라 *다자/양면* 구조(개인 에이전트 ↔ 사업자 에이전트, 또는 N명의 에이전트), (b) Muse Spark 같은 open-weight 모델로 에이전트를 돌리고 *협상 결과를 검증 가능한 영수증*으로 남김, (c) trifecta를 끊는 아키텍처를 그림으로 설명(비신뢰 메시지 격리 + 승인 게이트), (d) 데모 2분 안에 "인간이 앱을 하나도 열지 않고 3자가 합의하는 장면 + 위험 행동에서 사람이 승인하는 장면"을 보여주기. 이 조합은 Impact·Tooling·Depth·Demo 네 축에 모두 대응함 `[INFERENCE]`.
