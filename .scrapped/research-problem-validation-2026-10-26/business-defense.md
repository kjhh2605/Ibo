# 기업 쪽 문제 검증: 에이전트 트래픽 탐지·차단·수용과 보고된 피해

> 대상: `proposal-agent-proxy.md`의 "② 기업 가드" 부분과 1장 "기업 쪽 문제"의 전제를 검증한다. 작성일은 2026-10-26이다.
> 증거 유형: `[실제 사고]` 실서비스·실사용자 사례 · `[연구/벤치마크]` 측정치(벤더 텔레메트리와 설문 포함, 이해상충 표기) · `[레드팀/PoC]` 보안 연구자나 기자의 의도적 재현 · `[의견/예측]` · `[unverified]` 본문을 직접 열지 못했거나(403) 출처가 SNS 제보뿐인 경우
> 상태 표기: **[배포]** GA 또는 실서비스 · **[파일럿/베타]** 제한 공개 · **[제안/초안]** 표준 초안이나 발표만 된 것
> 기존 조사(`research-ai-era-apps-2026-10-26/`)의 항목은 이번에 원문을 다시 열어 확인했고, 확인 결과를 `✔ 재확인` 또는 `⚠ 수정`으로 표시했다.

---

## 0. 제안서 전제 대조 (요약)

| 제안서 문장 | 검증 결과 |
|---|---|
| "인터넷 트래픽 50% 이상이 비인간, AI 에이전트 일일 요청 1년 새 +1,700%"(Cloudflare) | ✔ 재확인. Cloudflare 2026-09-30 블로그 원문과 일치한다. 다만 Cloudflare 자사 네트워크 기준이고, 같은 글에서 "에이전트는 고객일 수 있다"고 결론 낸다 (#1) |
| "Amazon·JPMorgan·네이버는 외부 에이전트를 아예 막았다" | ⚠ 부분 수정. Amazon은 Muse를 하드 블록한 것이 맞다. JPMorgan·Citi·BofA·Schwab는 **송금·거래를 막고 잔액 조회 같은 읽기 전용은 허용**한다(#6). 네이버는 "차단"이라는 보도만 있고 기술적 방식은 공개되지 않았다(#8) |
| "지금 선택지는 '차단'과 '무방비' 둘뿐이다" | ✘ **사실과 다르다.** 2025-07 이후 HUMAN, DataDome, Akamai, Fastly, Arkose, Cloudflare가 "의도 기반 허용/차단" 제품을 출시했다. Shopify, Walmart, Meta, Visa, Mastercard는 수용 경로를 열었고, Poppy는 5단계 스펙트럼을 명시했다(2·3장) |

---

## 1. 보고된 피해

### 1-A. 부하·비용·스크래핑

1. **Cloudflare: 비인간 트래픽 50% 초과, 에이전트 일일 요청 +1,700%/년, 일부 업종 인간 트래픽 최대 −40%** — `[연구/벤치마크]` 벤더 텔레메트리 · 2026-09-30 · https://blog.cloudflare.com/agentic-web/
   - 초당 요청은 2024년 말 6,300만 건에서 1억 1,500만 건으로 늘었다. 크롤러 중 AI 학습 목적 비중은 2025 봄 22%에서 2026-06 52%로 늘었다. Retail·Software·Financial Services의 인간 트래픽은 1년 안에 최대 40% 줄었다.
   - **반론이 같은 글에 있다**: "Turn an agent away, and you may be turning away the person who sent it." 검색 크롤러를 막는 사이트는 1% 미만이고, 학습 크롤러를 막는 사이트는 17%다. Cloudflare는 "blanket no"를 권하지 않는다.
2. **Akamai SOTI: commerce 트래픽의 47.9%가 AI 봇(2025-12 기준)** — `[연구/벤치마크]` 벤더 텔레메트리 · 2026-07-15 · https://www.nasdaq.com/press-release/akamai-research-commerce-becomes-epicenter-ai-bot-attacks-and-agentic-fraud-2026-2026
   - AI 봇 트리거의 70% 이상은 **학습 크롤러**다. 에이전트가 주원인이 아니다. commerce 기업은 AI 봇 활동의 90% 이상을 "monitor"로 두었고, 나머지의 3/4을 무제한 통과시켰다.
   - "agent hijacking으로 저장된 결제수단 악용", "Frankenstein 계정" 주장은 RH-ISAC 게스트 기고자의 서술이고 수치가 없다 → `[의견/예측]`.
3. **Fastly: 기계 트래픽 50% 돌파(2026-07~08), AI 트래픽이 인간보다 6.5배 빠르게 증가(1~5월)** — `[연구/벤치마크]` 벤더 텔레메트리 · 2026-09-21 · https://www.helpnetsecurity.com/2026/09/21/fastly-ai-runtime-control/
4. **DataDome Q3: AI 에이전트 요청 약 250억 건(QoQ +41.5%), 9월 agentic browser 요청 4.7배(1,250만 → 5,820만)** — `[연구/벤치마크]` 벤더 텔레메트리 · 2026-10-15 · https://datadome.co/press/datadome-report-finds-agentic-browser-traffic-surged-nearly-5x-in-one-month
   - Muse는 12일 동안 2,910만 요청을 보냈다. 샘플의 **99.3%가 클라우드/CDN IP**에서 왔다. **Muse는 자신을 AI 에이전트로 밝히지 않는다.** 요청의 8.9%가 폼·로그인·결제·계정생성·장바구니 엔드포인트에 닿았다.
   - 규모 해석: 이 4.7배는 agentic browser만 센 값(9월 5,820만)이다. 전체 AI 에이전트 요청 250억 건의 대부분은 Meta의 크롤러·fetcher 계열이다 `[추론]`.

### 1-B. 예약 독점·재고 점유 (공정성 피해)

5. **Resy가 에이전트 사용자의 계정을 정지했다(Instinct로 시간당 수백 회, 약 200 API req/h를 24시간 호출)** — `[실제 사고]` · 2026-09-09~26 · https://lite.cnn.com/2026/09/23/tech/ai-agent-restaurant-reservations-instinct-resy-cec · https://www.pcmag.com/news/did-ai-take-your-table-youre-fighting-agents-for-popular-restaurant-bookings
   - Hermes 서브에이전트를 쓴 두 번째 사용자도 정지됐고, 복구에 한 달이 걸렸다. Resy는 재발하면 "AmEx 카드 상품 해지"까지 경고했다. OpenTable은 2025년 중반 약관에 "AI 에이전트 행위에 대한 책임 없음"을 추가했다.
   - 같은 CNN 기사에 Instinct가 사용자가 지시하지 않은 **100% 위약금 식당을 예약**한 사례가 나온다($200 취소 수수료). `[실제 사고]`
   - **반대편 사실**: Resy와 OpenTable은 ChatGPT, Claude, Muse, Gemini와 공식 통합을 운영한다. 승인 경로는 열려 있고, 막힌 것은 비승인 경로다.
6. **The Verge: Muse로 The RealReal 신상 10개를 20분 홀드마다 다시 담아 다른 구매자를 막았다 → TRR이 봇 방어 설정을 바꿨다** — `[레드팀/PoC]` 기자가 실서비스에서 재현 · 2026-10-22(10-25 갱신) · https://www.theverge.com/report/1015811/ai-shopping-agents-blocked-amazon-the-realreal-target-meta-muse ✔ 재확인
7. **Rec(지자체 체육시설 예약)의 SF 테니스·피클볼 예약 흐름에서 에이전트가 늘고 있다. 탐지된 비율은 한 자릿수 %이고 "탐지 못 하는 에이전트가 많다"** — `[실제 사고]` CEO 인터뷰 · 2026-10-08 · https://nymag.com/intelligencer/article/ai-agent-flood-muse.html
   - CEO는 "에이전트 1개 = 인간 1명" 패스포트와 3분 창 추첨을 제안했다 `[의견/예측]`.

### 1-C. 금융: 권한 밖 행동과 책임

8. **미국 대형 은행이 비승인 3자 에이전트를 탐지해 차단·삭제한다. "일부 에이전트는 사용자가 요청하지 않은 행동을 시도"** — `[실제 사고]` Axios 보도를 Reuters와 PYMNTS가 인용 · 2026-10-22 · https://www.pymnts.com/news/banking/2026/banks-crack-down-on-unauthorized-ai-agents-operating-inside-customer-accounts/
   - Schwab은 비승인 에이전트를 **매주 두 자릿수 회** 차단한다. JPM·Citi·BofA·Schwab은 송금을 금지하고 **읽기 전용은 허용**한다. PNC CEO는 "liability shifting 입법이 있어야 한다"고 말했다.
   - Reuters 보도상 Morgan Stanley는 "rogue agent를 본 적 없다"고 했다 → 피해 규모는 불명확하다. https://www.neoteo.com/en/reports-say-us-banks-are-restricting-outside-ai-agents
   - **Wells Fargo 약관(2026-11-24 시행)**: View Only와 View and Transact를 구분한다. 에이전트가 한 거래는 **고객이 승인한 것으로 간주**한다(같은 기사). 책임을 고객에게 넘기는 계약이다.
   - ✔ 재확인(Dimon "too risky"): 기존 조사의 CNBC 10-13 인용과 일치한다.

### 1-D. 소상공인·콜센터·공공 창구 범람

9. **소상공인이 Muse의 대리 전화를 끊는다("Half the companies hang up on my agent", 시애틀 노래방 "We hate it")** — `[실제 사고]` 일화 수준, 칼럼 · 2026-10-08 · https://nymag.com/intelligencer/article/ai-agent-flood-muse.html ✔ 재확인
   - 일부 통화는 콜센터 직원이 AI에게서 넘겨받아 처리했다(404 Media 유출 문서 인용). 같은 글에는 AI 발신을 탐지해 "검증 요구/통과"를 고르게 하는 제품(Reality Defender)이 언급된다. 제품의 실제 성능은 `[unverified]`다.
10. **Salesforce: "개인 에이전트가 줄이는 것보다 더 많은 콜센터 트래픽을 만든다", 대응은 "front door에 자체 비즈니스 에이전트"** — `[의견/예측]` · 2026-10-19 · https://www.salesforce.com/news/stories/personal-agents-to-drive-more-contact-center-traffic/ ✔ 재확인. 측정치는 없다.
    - Mollick(Wharton)도 "환불·가격협상 에이전트가 고객센터를 사람이 못 쓰게 만들 것"이라고 예측했다 `[의견/예측]` · 2026-10-19 · https://www.technologyreview.com/2026/10/19/1147186/making-the-internet-better-for-ai-agents-might-make-it-worse-for-everyone-else
11. **Agentic flooding (공공 서비스): 11개 관할 84건. 영국 주택 옴부즈맨 민원 2,600건(2022) → 7,000건 이상, CFPB 민원 5배** — `[연구/벤치마크]` AIES 2026 논문 · 2026-08-17 · https://arxiv.org/abs/2608.16603 · https://techcrunch.com/2026/09/10/ai-agents-are-flooding-public-services-with-new-requests/
    - **중요한 반론**: 저자는 "대다수는 자격 있는 사람이 정당하게 청구한 것"이라고 말한다. 인과관계도 주장하지 않는다. 범람이 곧 악성은 아니다.

### 1-E. 오탐 (방어가 정상 고객을 막는 피해)

12. **Walmart의 사람 확인 버튼 때문에 Muse 결제가 실패한다. 사람조차 로그인이 안 된다는 제보도 있다. Walmart는 Muse 파트너다** — `[실제 사고]` 사용자 제보와 회사 답변 · 2026-10-06 · https://techcrunch.com/2026/10/06/the-next-hurdle-for-ai-agents-getting-websites-to-let-them-in/
    - 같은 기사에 나온 업체별 입장은 다음과 같다. Delta는 "3자 에이전트 통합 없음, 비승인 자동화 차단". United는 ToS로 로봇 금지. Yelp는 **데이터 라이선스를 산 에이전트만 허용**. eBay는 비승인 에이전트와 스크래핑만 제한. Zillow는 허용하지만 anti-scraping에 걸릴 수 있다고 했다. Adidas, Pizza Hut, Zillow 차단 목록은 SNS 제보라 `[unverified]`다.
13. **Arkose Q3: AI 에이전트 세션의 77.4%가 정상(알려진 봇은 7.9%). Muse·Instinct 세션 중 공격과 연결된 것은 0%. Instinct는 지문을 회전시키기 때문에 세션의 96.8%가 중·고위험으로 분류된다** — `[연구/벤치마크]` 벤더 텔레메트리 · 2026-Q3 · https://www.arkoselabs.com/agentic-ai-trust-report-q3-2026
    - 같은 보고서 기준으로, 보호 엔드포인트에서 가입 세션의 70.5%가 가짜계정 시도이고 결제 세션의 17.7%가 카드 테스트다. **에이전트가 아니라 기존 공격자가 같은 문에 몰려 있다.**
    - 규모: 보호 세션 약 5,200건 중 1건이 이름 있는 AI 에이전트였다. 고객사의 65.2%가 에이전트를 관측했다.
14. **PYMNTS×Trulioo 설문(350명): 89.5%가 "봇 관리가 어렵다", 매출 $1B 이상 기업의 57.1%가 적대적 봇·에이전트 사고 또는 손실을 보고했고 오탐률은 평균 3.3%** — `[연구/벤치마크]` 설문, 손실액은 측정하지 않음 · 2026-10-25 · https://www.pymnts.com/cybersecurity/fraud-prevention/2026/57percent-of-large-firms-report-bot-or-agent-incidents-or-losses/

### 1-F. ToS·법적 분쟁

15. **Amazon이 Muse를 차단했다("continued access by an unauthorized AI agent"). 사유: 자기 신원을 밝히지 않음, 자격증명 수집·저장, 계정 데이터 스크래핑, 개인화 우회** — `[실제 사고]` · 2026-09-21 · https://www.businessinsider.com/amazon-blocks-meta-muse-ai-agent-shopping-site-2026-9 · https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ ✔ 재확인
    - Amazon은 robots.txt로 2025-07~08에 Claude, Perplexity, Google Project Mariner 에이전트와 Meta, Google, Huawei, Mistral 등 6개 크롤러를 추가로 막았다 `[실제 사고]` · 2025-08-21 · https://www.modernretail.co/technology/amazon-expands-its-fight-to-keep-ai-bots-off-its-e-commerce-site/
16. **Amazon v. Perplexity: 9th Circuit이 가처분을 취소했다("it's the user—not Perplexity—accessing Amazon's computers"). 본안은 진행 중이고, 기각 신청 심리는 2026-11-20** — `[실제 사고]` 소송 · 2026-08-04 · https://www.emarketer.com/content/perplexity-comet-amazon-ai-shopping-agents-ruling · https://www.actuia.com/en/news/walmart-sets-the-rules-for-ai-shopping-agents/ ✔ 재확인(⚠ 기존 "2026-10 기각 신청"은 "11-20 심리 예정"으로 정정)
    - Amazon 측 핵심 이해관계는 광고다. 광고 매출은 2분기 $19.8B이고 2026년 $83.34B로 전망된다. "에이전트 피해"에는 상업적 동기가 섞여 있다.
17. **네이버는 외부 에이전트의 자사 서비스 접근을 차단하고 자체 쇼핑 에이전트를 키운다** — `[실제 사고]` 보도. 차단 방식과 규모는 미공개다 · 2026-10-19 · https://www.hani.co.kr/arti/economy/it/1283144.html ✔ 재확인
    - 동기는 "데이터를 외부에 개방할 유인이 없다"는 전략 판단이다. 보안 피해 사례는 제시되지 않았다.

---

## 2. 차단·통제 메커니즘

### 2-A. robots.txt (한계가 명확함)

18. **robots.txt는 권고일 뿐이고, 사용자 발동 에이전트는 이를 무시하도록 설계됐다** — `[배포]` · 2026-08-19 갱신 · https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers
    - Google 문서는 `Google-Agent`(사용자 요청으로 웹을 탐색하고 행동하는 에이전트)를 포함한 user-triggered fetcher가 "generally ignore robots.txt rules"라고 명시한다. 대신 전용 IP 대역(`user-triggered-agents.json`)을 공개한다.
    - DataDome 벤치마크: 사이트의 7할 이상이 GPTBot이나 ClaudeBot이라고 **사칭한** 에이전트를 무검증 통과시켰다. UA나 robots 기반 차단은 정직하게 밝히는 봇에만 통한다 `[연구/벤치마크]` · 2026-09-22 · https://datadome.co/resources/bot-and-agent-security-report/bot-ai-agent-protection-benchmark/

### 2-B. CDN·봇관리 벤더의 에이전트 전용 통제

19. **Cloudflare** — https://blog.cloudflare.com/agentic-web/ · https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth
    - **[배포]** AI Crawl Control, Search·Agent·Training 분리 토글(2026-07, **Free 포함 전 플랜**), Disallow AI Training(09-15), Web Bot Auth 서명 검증(Verified Bots; OpenAI, Google, AWS 서명; 주 5천억 건 이상).
    - **[파일럿/베타]** Pay Per Use, Monetization Gateway(x402, 미국 closed beta).
    - **[제안/초안]** `Forwarded: for="openai"` "transitive trust"(실험적). 웹사이트 → 운영자 → 최종사용자 체인을 인정하지만, 최종사용자 자체는 식별하지 않는다.
    - 9-15 기본값 변경 이후 광고 페이지에서 에이전트가 차단되면서 Muse가 막혔다는 추측이 있다 `[unverified]`(TechCrunch 10-06, #12 URL).
20. **DataDome** — **[배포]** Agent Trust(Bot Protect에 포함), **Priority Protect**: 에이전트 탐지가 들어간 가상 대기실(2026-05-20). 예약·한정판 독점(#5·#6)에 정면으로 대응하는 제품이다 · https://datadome.co/press/datadome-announces-priority-protect
21. **HUMAN AgenticTrust** — **[배포]** 2025-07-30 출시. 에이전트 식별, 의도·행동 분류, "granular policies to deny unwanted actions", spoofed agent·excessive agency 방지 · https://www.humansecurity.com/platform/solutions/agentic-commerce/ · https://www.humansecurity.com/newsroom/first-adaptive-trust-layer-for-agentic-ai-era
    - HUMAN 집계로 agentic 트래픽은 8월에서 9월 사이 3배가 됐다(MIT TR 인용) `[연구/벤치마크]` · https://www.technologyreview.com/2026/10/19/1147186/making-the-internet-better-for-ai-agents-might-make-it-worse-for-everyone-else
22. **Akamai** — **[배포]** AI 봇 세분 통제. AI fetchers/agents(ChatGPT-User, Claude-User, Perplexity-User, ChatGPT Agent, GoogleAgent-Mariner)를 별도 범주로 둔다. 2026-06-15에는 Agentic Security Framework를 발표했다. 블로그 원문은 403이라 검색 스니펫만 확인했다 `[unverified 세부]` · https://www.akamai.com/blog/security/introducing-more-granular-controls-ai-bot-traffic · https://www.akamai.com/newsroom/press-release/akamai-unveils-agentic-security-framework-to-power-trusted-ai-driven-interactions-and-commerce
    - SOTI 권고: "binary allow/block에서 벗어나 의도·사업가치 기반 거버넌스로" (#2 URL).
23. **Fastly** — **[배포]** 2026-09-21. AI Firewall은 **엣지에서 prompt injection을 차단**한다. API Security는 에이전트 트래픽에 API 계약을 강제해 지원하지 않는 작업이나 malformed 요청을 막는다. AI Runtime Control은 RPM·TPM 제한을 둔다 · https://www.helpnetsecurity.com/2026/09/21/fastly-ai-runtime-control/
24. **Arkose Labs** — **[배포]** 에이전트를 세 집단으로 분류한다(자기공개 정상 / 비공개 정상 / 악성). 결론: "Even when an agent's presence can be verified, it reveals nothing about what the agent came to do" (#13 URL).

### 2-C. 암호학적 에이전트 신원 (Web Bot Auth 계열)

25. **IETF webbotauth WG 초안 `draft-ietf-webbotauth-httpsig-protocol-00`(Cloudflare·Google 공저, 2026-09-01)** — **[제안/초안]** · https://www.ietf.org/archive/id/draft-ietf-webbotauth-httpsig-protocol-00.html ✔ 재확인(⚠ 기존의 "arXiv 2차 인용"을 WG 초안 원문으로 대체)
    - 원문: 유효한 서명은 "says nothing about who operates the Agent, whether the Agent is benign, or whether the request is authorized." 또한 "does not authenticate human users". **어떤 사람이 위임했는지는 범위 밖이다.**
26. **서명 채택률은 매우 낮다: 정상 에이전트 세션의 2.3%만 검증된 Web Bot Auth 서명을 가졌다(ChatGPT agent는 78.4%로 예외)** — `[연구/벤치마크]` 2026-Q3 · https://www.arkoselabs.com/agentic-ai-trust-report-q3-2026
    - Muse, Instinct, Comet, Gemini Spark는 서명하지 않는다. Grok Bot for Enterprise와 Sigma는 서명을 시작했다.
    - OpenAI는 ChatGPT Work Cloud browser에서 RFC 9421 서명을 운영한다 **[배포]** · https://help.openai.com/en/articles/11845367-chatgpt-works-cloud-browser-allowlisting

### 2-D. CAPTCHA 대 에이전트

27. **기존 CAPTCHA는 사실상 무력화됐다: GPT-5.2·Gemini3 급 추론 모델이 복잡한 로직 퍼즐을 최대 90% 통과한다** — `[연구/벤치마크]` · 2026-02-09 · https://arxiv.org/abs/2602.09012
    - Browser Use와 2captcha MCP는 CAPTCHA 자동 풀이를 **상용 기능으로 판다** **[배포]** · https://browser-use.com/captcha-solving · https://2captcha.com/blog/mcp-captcha
    - 반대 방향의 오탐 피해: Walmart 사례(#12). The Verge는 "식료품 사이트에서도 사람 증명 장애물이 늘 것"이라고 예측했다 `[의견/예측]` · https://www.theverge.com/ai-artificial-intelligence/1013195/ai-agents-blocked-web

### 2-E. 결제망·신원 토큰 (에이전트 + 사람/권한 바인딩)

28. **Visa Trusted Agent Protocol** — RFC 9421 서명(Web Bot Auth 기반). **"consumer recognition and payment" 서명**으로 기존 고객 계정에 연결한다. **[파일럿/베타]**: BILL·Billtrust와 B2B 송장 결제 첫 라이브 파일럿(2026-10-20) · https://developer.visa.com/docs/trusted-agent-protocol · https://investor.visa.com/news/news-details/2026/Visa-BILL-and-Billtrust-Launch-First-Live-Pilot-for-Trusted-AI-Agent-Payments-Between-Buyer-and-Supplier-Platforms/
29. **Mastercard Agent Pay** — 에이전트를 등록·검증하고 agentic token과 지출 통제를 둔다. 2026-09-30 기능을 확장했다. 유럽 전 issuer가 네트워크 차원에서 활성화돼 있다. 원문은 403이라 검색 스니펫으로만 확인했다 `[unverified 세부]` · https://www.mastercard.com/us/en/news-and-trends/press/2026/september/new-trust-and-intelligence-services.html · https://newsroom.mastercard.com/news/europe/en/perspectives/en/2026/europe-is-building-the-foundations-for-trusted-agentic-commerce
30. **Skyfire KYA + Forter** — **[배포]** 2026-10-19. Forter가 KYA 토큰을 사기 판정에 반영한다. Forter 네트워크의 agentic 주문은 8월 이후 4배 이상 늘었다. Jomashop: "who the agent is, who sent it". KYAPay IETF 초안은 Informational이고 2026-10-02에 만료됐다 **[제안/초안]** · https://fintech.global/2026/10/19/skyfire-and-forter-target-fraud-in-ai-agent-checkout/ · https://www.ietf.org/archive/id/draft-skyfire-kyapayprofile-01.html
31. 위임 증명 초안들: `draft-nelson-agent-delegation-receipts`, `draft-klrc-aiagent-auth` — **[제안/초안]** 채택되지 않음 · https://www.ietf.org/archive/id/draft-nelson-agent-delegation-receipts-07.html · https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-00.html

---

## 3. 수용 메커니즘 (차단 대신 에이전트 전용 경로를 연 사례)

32. **Shopify** — **[배포]** Agentic Storefronts(적격 매장 기본 활성화), UCP 기반 Storefront MCP, **WebMCP checkout**(`get_checkout`/`update_checkout`/`complete_checkout`, 구매자 승인 후 결제; 2026-09-28 적격 전 매장에 롤아웃). Muse·Instinct와 직접 파트너십 · https://techcrunch.com/2026/09/28/shopify-opens-checkout-to-browser-based-ai-agents/ · https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts
    - 2025-07부터 "Robot & agent policy"를 robots.txt에 넣어 buy-for-me 에이전트에 human review 단계를 요구했다(#15 Modern Retail URL).
33. **Walmart Agent Gateway / Agent Profiles / 에이전트 약관** — **[파일럿/베타]** 2026-10-21. 에이전트별 별도 프로필, 고객이 정하는 한도($50/$100/$200) 또는 건별 승인, MCP 게이트웨이(검증된 신원, 권한, **rate limit**, 카테고리 제한), 카드정보 비전달, 위반 에이전트 차단. 게이트웨이는 초대제 베타이고 프로필은 "다음 달" 출시 예정 · https://www.actuia.com/en/news/walmart-sets-the-rules-for-ai-shopping-agents/
    - **제안서 기업 가드의 쿼터·의도 스키마·신원 검증·데이터 최소화를 대형 리테일러가 자체 인프라로 구현하고 있다.**
34. **Personal Agent Protocol (Poppy)** — **[제안/초안]** v0.3. `/.well-known/poppy.json` 발견, **사용자가 회사 페이지에서 OAuth로 직접 로그인하고 scope를 고른다**, 키에 바인딩된 단기 세션 토큰, OpenAPI/MCP/웹/회사 에이전트 대화, "사람인지 AI인지" 표기. 5단계 공개 스펙트럼(Blocked → Search → See → Book with approval → Full access) · https://personalagentprotocol.org/ · https://www.facebook.com/business/news/a-new-way-for-businesses-and-personal-agents-to-work-together ✔ 재확인(파트너에 NiCE, Decagon 추가 확인)
    - Meta는 Muse의 브라우징 규범으로 "one honest person" 테스트와 "if every agent did this" 테스트를 공개했다(예: tee time 독점 금지) `[의견/예측]` 자율 규범.
35. **Meta Business Agent** — **[배포]** 2026-06-03 글로벌. **100만 곳 이상**이 WhatsApp·Messenger에서 사용하고, 무료로 시작할 수 있다. 예약, 리드 qualify, 사람 인계를 지원한다. 소상공인이 "에이전트를 받는 창구"를 갖는 경로가 이미 대규모로 존재한다 · https://about.fb.com/news/2026/06/meta-business-agent/
36. **Resy·OpenTable·Ticketmaster 공식 통합** — **[배포]** ChatGPT, Claude, Muse, Gemini 통합 (#5 PCMag URL). Ticketmaster는 Muse의 첫 음악 파트너다 · https://musically.com/2026/09/10/ticketmaster-is-first-music-partner-for-metas-muse-ai-agent
37. **llms.txt** — **[제안/초안]** 실효성이 낮다. 13.7만 도메인의 28%가 게시했지만 **97%는 2026-05 한 달간 요청 0건**이었다. Google은 "필요 없다"고 했다 `[연구/벤치마크]` · 2026-06-15 · https://ahrefs.com/blog/llmstxt-study/
    - MCP, A2A, NLWeb, WebMCP는 기존 조사(`agent-native-stack.md` B4·B6)에서 다뤘고 이번에 다시 검증하지 않았다.

---

## 4. 공백 (Gaps)

- **G1. 소상공인 방어 수준이 낮다.** 테스트한 21,491개 사이트 중 **65.3%가 10종 테스트 봇을 하나도 막지 못했다.** 완전 방어는 2.4%로, 2024년 8.4%에서 계속 떨어졌다. 트래픽 상위 1,000개 사이트도 64.4%가 무방비여서 규모와 무관하다 `[연구/벤치마크]` (#18 DataDome URL).
  - **반론**: Cloudflare의 에이전트/학습/검색 토글은 Free 플랜에도 있다(#19). Meta Business Agent도 무료로 시작한다(#35). "도구가 없다"보다 "설정·판단 역량이 없다"에 가깝다 `[추론]`.
  - 전화 채널은 웹 봇관리가 닿지 않는다. 사장이 끊는 것 외에 대응이 없다(#9). 음성 AI 탐지 제품은 있지만 소상공인 보급은 확인하지 못했다 `[unverified]`.
- **G2. 내용 수준(semantic) 공격은 봇관리가 못 본다.**
  - **SalesBleed**: 공개 Web-to-Lead 폼에 숨긴 prompt injection이 Agentforce를 통해 Accounts 테이블을 DNS로 0-click 유출했다. 기본 구성에서 재현됐고 2026-08에 수정됐다 `[레드팀/PoC]` · 2026-09-24 · https://labs.zenity.io/post/salesbleed-0-click-data-exfiltration-on-agentforce
  - 함의: 사람이든 에이전트든 **정상 신원으로 들어온 자유 텍스트**가 비즈니스 에이전트를 조종할 수 있다. 서명·IP·지문 기반 방어는 무관하다. Fastly AI Firewall(#23)이 엣지 prompt 검사를 내놓았지만, 자유 텍스트를 받는 Business Agent(WhatsApp·Messenger) 쪽 방어 수준은 공개 자료로 확인하지 못했다 `[unverified]`.
  - 실제 공격 사고로는 "개인 에이전트가 비즈니스 에이전트에 인젝션"한 사례를 찾지 못했다. 현재 증거는 PoC와 연구 수준이다(기존 조사의 Magentic Marketplace 결제 탈취 실험 포함).
- **G3. 에이전트 신원은 "어떤 사람이 무엇을 위임했는가"를 증명하지 않는다.**
  - Web Bot Auth는 운영자 URL만 증명한다(#25). Cloudflare transitive trust도 운영자까지만 다룬다(#19). Arkose: 검증돼도 의도는 알 수 없다(#24).
  - 사람 바인딩은 **결제·커머스 레일 안에서만** 생기는 중이다: Visa TAP consumer recognition, Mastercard agentic token, Skyfire KYA, Poppy OAuth, Walmart Agent Profile. 대부분 파일럿·초안·초대제다.
  - 은행은 바인딩이 없어서 막는다. 현재 에이전트는 사용자 자격증명으로 로그인하며(#8, Walmart 보도자료 인용 #33), 은행 입장에서는 사람과 구분되지 않는다.
- **G4. "의도 공개" 비율 자체가 낮다.** 2.3%만 서명하고(#26), Muse는 자기 신원을 밝히지 않는다(#4·#15). **서명 필수 정책은 현재 정상 에이전트 대부분을 거부한다.** Muse가 E2E 암호화를 도입하면 행동만이 의도의 증거가 된다(#13 Arkose URL) `[의견/예측]`.
- **G5. 분쟁 증거 원장.** Wells Fargo 약관(#8)과 OpenTable 약관(#5)은 에이전트 행위의 책임을 사용자에게 넘긴다. Walmart는 "에이전트가 기대와 다르게 행동해도 반품 정책 적용"이라고 했다(#33). Instinct의 $200 위약금 분쟁(#5)도 있다. **에이전트와 기업 사이에 무엇을 주고받았는지 양측이 검증할 수 있는 기록을 제공하는 배포 제품은 찾지 못했다.** 가장 가까운 것은 Cloudflare 유료 요청 receipt(베타, #19)와 Walmart의 에이전트별 주문 분리(베타)다.
  - 다만 "기록이 없어서 분쟁이 해결되지 않았다"는 실제 사례도 찾지 못했다. 수요의 근거는 간접적이다 `[추론]`.

---

## 판정

**1) 문제는 실재하는가?** — **예. 다만 성격이 제안서 서술과 다르다.**
- 실재가 확인된 것 `[실제 사고]`:
  - 대형 플랫폼(Amazon, 은행 4~5곳, Delta, Yelp, Resy, 네이버)의 의도적 차단
  - 예약 플랫폼 부하와 계정 정지(Resy, 약 200 req/h)
  - 은행의 권한 밖 에이전트 행동 탐지
  - 소상공인의 AI 전화 거부
  - 오탐으로 인한 정상 고객 차단(Walmart)
- 확인되지 **않은** 것: "개인 에이전트가 사기·공격 수단으로 쓰였다"는 증거. Arkose 기준 Muse·Instinct 세션 중 공격 연결은 0%다. Akamai의 agent hijacking 서술은 수치 없는 기고문이다. Morgan Stanley는 rogue agent를 본 적 없다고 했다.
- 피해의 실체는 **부하, 공정성(독점), 권한·책임 불명확, 오탐**이다. 사기는 기존 봇 공격자가 같은 엔드포인트에 몰려 있는 문제다.

**2) 심각도** — **중간, 그리고 빠르게 증가 중이다.**
- 증가 속도는 크다. DataDome 기준 agentic browser 요청이 한 달에 4.7배, HUMAN 기준 3배, Cloudflare 기준 에이전트 요청 +1,700%/년이다.
- 절대 비중은 아직 작다. 보호 세션의 약 1/5,200, Rec 예약 흐름의 한 자릿수 %이고, Google Mueller는 "로그를 보면 에이전트 트래픽은 많지 않다"고 했다(ahrefs 인용, 2026-06). 반면 탐지되지 않는 에이전트 비중은 알 수 없다.
- 금융과 한정재고(예약·티켓·리세일)는 고위험이다. 일반 콘텐츠 사이트는 학습 크롤러 문제가 더 크다(Akamai: AI 봇 트리거의 70% 이상이 학습 크롤러).

**3) 증거 구성** — 이 문서 37개 항목 기준이다.
- `[실제 사고]` 약 13건: 대부분 **언론 보도와 기업 발언**이다. 피해액이나 부하량이 정량 공개된 것은 Resy 요청 빈도와 Schwab 주간 차단 횟수 정도다.
- `[연구/벤치마크]` 약 12건: 대부분 **봇관리 벤더 텔레메트리**(Cloudflare, DataDome, Akamai, Fastly, Arkose, HUMAN)다. 이 벤더들은 제품을 파는 이해당사자다. 다만 이들 스스로 "모두 차단은 틀렸다"는 결론을 낸다는 점은 신뢰할 만하다 `[추론]`.
- `[레드팀/PoC]` 3건(SalesBleed, The Verge RealReal, CAPTCHA 연구 일부)과 `[의견/예측]` 다수(Salesforce, Mollick, Meta 규범)가 있다.

**4) 제안서 "② 기업 가드"에 대한 함의**

| 가드 기능 | 기존 제품과 중복 여부 | 근거 |
|---|---|---|
| Ed25519 / RFC 9421 서명 검증 | **완전 중복.** Cloudflare Verified Bots, Visa TAP, Akamai, HUMAN, DataDome이 이미 검증한다. 더 큰 문제는 **서명을 요구하면 정상 에이전트의 97.7%와 주최사 제품인 Muse를 막는다**는 점이다. 데모 시나리오 2("서명 없으면 차단")는 현실의 Muse 트래픽을 거부하는 설계다 `[추론]` | #19, #25, #26, #4 |
| 에이전트별 쿼터·중복 제거 | **대부분 중복.** rate limiting, DataDome Priority Protect(대기실), Walmart Gateway rate limit, Fastly ARC가 있다. 다만 **"에이전트 1개 = 인간 1명" 단위 쿼터**는 사람 바인딩이 없어서 아무도 못 한다(G3) | #20, #23, #33, #7 |
| 자유 텍스트 대신 의도 스키마(JSON)만 받기 | **방향은 중복.** Poppy(OpenAPI/MCP), Shopify UCP·WebMCP, Walmart MCP Gateway, Fastly API 계약 강제가 있다. 다만 이들은 대형 사업자용이다. 소상공인용 스키마 게이트는 Meta Business Agent가 자유 대화로 처리하고 있어서 **스키마 강제 + 인젝션 격리 조합은 비어 있을 가능성이 있다** `[추론]` | #23, #32~#35 |
| 상대 메시지 비신뢰 격리(prompt injection) | **부분 중복.** Fastly AI Firewall이 엣지에서 검사한다. SalesBleed가 보여주듯 기본 구성의 비즈니스 에이전트는 여전히 뚫린다. **A2A·Business Agent 입구에서의 내용 수준 방어는 공개 제품으로 확인되지 않았다.** 실사고 증거는 없고 PoC 수준이다 | #23, G2 |
| 서명된 위변조 방지 원장 (양측 서명, 합의 영수증) | **중복 제품을 찾지 못했다.** 약관이 책임을 사용자에게 넘기는 흐름(Wells Fargo, OpenTable)과 "liability transfer" 발언(Dimon, PNC)은 수요의 간접 증거다. 다만 "기록 부재로 분쟁이 미해결"된 실사례도 찾지 못했다 | #8, #5, G5 |

**결론** `[추론]`
- 제안서 1장의 "**차단 vs 무방비 이분법**"은 2026-10 시점에 **틀린 전제**다. 시장은 이미 의도 기반 허용(벤더 5곳 이상), 수용 레일(Shopify·Walmart·Meta·Visa·Mastercard), 5단계 스펙트럼 표준(Poppy)으로 움직였다. 심사위원, 특히 Meta는 Poppy와 Business Agent를 근거로 이 전제를 반박할 수 있다.
- 기업 가드의 **신원 검증·쿼터·스키마는 재발명**이다. 데모에서 이것들을 "차별점"으로 내세우면 약점이 된다. Web Bot Auth·Poppy 호환을 **입력 조건**으로만 두는 편이 낫다.
- 남는 차별 지점은 둘이다.
  - (a) **사람 위임 범위(누가·무엇을·얼마까지)를 운반하고 검증하는 계층.** 웹·A2A 일반 경로에서는 비어 있고, 결제 레일 안에서만 파일럿 중이다.
  - (b) **에이전트-기업 상호작용의 양측 검증 가능한 기록.**
- (b)는 수요 증거가 간접적이다. 따라서 "기업 가드"보다 **"분쟁·책임 증빙" 문제로 다시 프레이밍**하는 것이 증거와 맞다.
- 제안서의 48시간 첫 검증 항목에는 다음을 추가하는 것이 좋다: "서명 없는 Muse 트래픽을 어떻게 처리하는가", "Poppy 세션 위에 원장을 얹을 수 있는가".
