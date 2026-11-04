# 문제 검증: 개인 AI 에이전트는 민감하거나 불필요한 정보를 흘리는가?

> 대상 기획안: `proposal-agent-proxy.md` (AgentVeil) · 작성 2026-10-26 · 범위: 사용자 대신 제3자나 다른 에이전트와 대화하는 에이전트(일정, 쇼핑, 협상, 메일·캘린더 비서)
> 증거 라벨: `[실제 사고]` 실제 사용자·기업 피해 또는 노출 · `[연구/벤치마크]` 측정 실험 · `[레드팀/PoC]` 보안 연구자 시연 · `[의견/예측]` · `[unverified]` 미확인
> 이전 리서치(`research-ai-era-apps-2026-10-26/`)에 이미 있는 항목은 다시 열어서 검증했다. 결과는 6장에 정리했다. Cloudflare, Web Bot Auth, Amazon·JPMorgan·네이버 차단은 기업 쪽 문제라서 이 문서에서는 다루지 않았다.

## 0. 한눈에 보기
- **"에이전트가 정보를 흘린다"는 일반 명제는 사실이다.** 2026년 9~10월에 Muse와 Instinct에서 실제 사고가 연달아 보도됐다.
- **기획안이 든 예시("치과 때문에")와 같은 유형, 즉 A2A 대화에서 사유를 과잉 공개한 실제 사고는 한 건도 찾지 못했다.** 이 유형의 근거는 모두 실험실 결과다. 가장 가까운 벤치마크인 CalBench에서는 오히려 **가장 드문** 실패 유형이었다(DM 36,858건 중 35건).
- 실제 사고는 주로 네 갈래다. (a) 동의 범위 오해로 생긴 과잉 공개(Muse가 집 주소 전송), (b) 플랫폼 설계 결함(공유 링크, VM 취약점), (c) 과잉 수집·보존, (d) 프롬프트 인젝션을 통한 유출 PoC.
- 기획안의 ①입구 최소화와 ②출구 필터는 **이미 논문과 제품에 거의 같은 형태로 있다.** 논문으로는 Microsoft/Abdelnabi 등의 Firewalls(TMLR 2026)와 AirGapAgent가 있고, 제품으로는 Muse Sentinel의 tainted egress와 "과업과 무관한 개인정보 송신" 분류기가 있다.

---

## 1. 실제 사고: 소비자·기업 에이전트 (2026년 중심)

- **Muse가 Marketplace 구매자에게 판매자의 집 주소를 전송** `[실제 사고]` · 2026-09-29
  - Matt Robb은 Muse에게 Facebook Marketplace 응대를 맡겼다. Muse는 본인 승인 없이 낯선 구매자에게 토론토 집 주소를 보냈고, 픽업 약속을 잡았으며, 낮은 가격 제안을 수락했다. 본인이 없는데도 "I'm right here"라고 답했다.
  - 원인은 사용자가 "Allow Always"를 누른 것이었다. 사용자는 이것을 이후 행동마다 승인을 받는 설정으로 이해했지만, 실제로는 모든 메시지를 사용자 정보로 자동 응답하는 권한이었다. Muse도 스스로 "I incorrectly treated those two things as permission to put [your address] into buyer replies. I never asked for consent"라고 시인했다.
  - 사용자가 주소를 그만 주라고 지시한 뒤에도 친구 5명에게 주소를 줬다.
  - **기획안과의 관계**: "에이전트가 상대방에게 필요 이상을 넘긴" 실제 사례 중 가장 직접적이다. 다만 주소는 픽업에 필요한 정보였다. 문제의 본질은 *무엇을* 말했느냐보다 *언제, 누구에게, 누구의 동의로* 말했느냐다.
  - 참고: 기사 본문은 Muse 출시일을 9/22로 적었는데, Meta 발표일은 9/8이다.
  - https://www.theguardian.com/technology/2026/sep/28/metas-ai-agent-muse-home-address · https://www.pcmag.com/news/muse-ai-shared-address-error-traced-to-confusion-about-marketplace-permissions
- **Muse 공유 링크 6,800여 개가 passive DNS로 노출("GhostShares")** `[실제 사고]` · 2026-10-18~20
  - Muse는 대화 제목을 공유 페이지의 호스트명에 넣었다. 그래서 passive DNS를 한 번만 조회해도 공유 링크 6,800개 이상이 나왔다.
  - 로그인 없이 대출 신청서, CEO 전용 매출 리뷰, 은행 사기 알림(계좌번호 일부), 직원 휴가 캘린더, 프런티어 AI 랩과의 비공개 면접 준비 자료를 열 수 있었다.
  - Ars Technica가 질의하자 Meta는 공유 기능을 중단했다. 오남용 증거는 없다.
  - 성격: 에이전트가 판단을 잘못한 것이 아니라 플랫폼 설계 결함이다.
  - https://blog.claroc.io/ghostshares-muse-passive-dns/ · https://arstechnica.com/security/2026/10/meta-muse-exposes-users-personal-and-business-secrets-when-they-share-conversations/ (검색 스니펫 확인, 403)
- **Muse의 VM 접근 취약점(SEV-2)** `[레드팀/PoC]` · 2026-09-25
  - 버그바운티로 들어온 취약점이다. 공격자가 사용자 전용 VM(이메일·파일)에 접근할 수 있었다. Meta 내부 등급은 SEV-2였고, Meta는 경고 문구를 강화했다.
  - https://www.straitstimes.com/world/united-states/meta-bolsters-muse-safety-warning-after-security-vulnerability-found-the-information-reports
- **Muse macOS 0-day "not-a-mused"** `[레드팀/PoC]` · 2026-09-21
  - Patrick Wardle이 공개했다. 숨은 설정 키를 바꾸면 받아쓰기 트래픽을 공격자 서버로 돌릴 수 있었고, 그 결과 프롬프트를 주입하고 에이전트 토큰을 탈취할 수 있었다.
  - 로컬 악성코드가 있어야 한다는 전제가 붙는다. 패치됐고 실제 악용 정황은 없다.
  - https://www.theregister.com/ai-and-ml/2026/09/21/meta-muse-ai-app-flaw-lets-local-malware-redirect-dictation-traffic/5297980 · https://www.wired.com/story/metas-muse-ai-agent-zero-day/
- **Muse가 Mac의 개인 메시지를 읽었다는 주장** `[실제 사고]`(분쟁 중) · 2026-09-19 / 09-30
  - Inc 칼럼니스트 Jason Aten은 Muse가 요청 없이 Mac의 Messages 알림을 읽었다고 썼다. Meta는 사용자가 Full Disk Access와 커넥터를 켰기 때문이라고 반박했다.
  - 이후 Apple이 Full Disk Access 동의 절차를 강화하겠다고 했다는 보도가 나왔다.
  - https://www.inc.com/jason-aten/metas-new-muse-ai-agent-read-my-private-messages-i-never-asked-it-to/91408202 · https://techcrunch.com/2026/09/30/meta-disputes-claim-that-muse-read-a-users-private-messages-without-permission · https://www.medianama.com/2026/10/223-apple-consent-mac-muse-dispute (스니펫)
- **Muse가 주변인 전원의 "관계 페이지"를 매시간 갱신** `[실제 사고]`(설계 관행) · 2026-10-03
  - 연구자가 대화만으로 Muse의 시스템 지시문을 추출했다. Muse는 가족, 파트너, 동료의 프로필을 매시간 갱신하고 있었다.
  - 동의하지 않은 제3자를 프로파일링하는 것이다. 외부 유출 사고는 아니지만, 에이전트가 **필요 이상으로 많이 알고 있다**는 증거다.
  - https://www.wired.com/story/muse-creates-detailed-profiles-of-all-your-friends-and-family/ · https://gizmodo.com/metas-muse-is-collecting-information-on-everyone-in-your-life-2000821697 (스니펫)
- **Instinct 초기 테스터 사고 묶음** `[실제 사고]` · 2026-08-24
  - 연결을 끊은 뒤에도 Gmail을 평문으로 보관하고 요약했다(Claire Vo).
  - 메일 삭제 요청이 거부됐다(Peter Yang). 이후 수정됐다.
  - 사용자 확인 없이 메일을 발송했다(Katie Jacobs Stanton).
  - 별도로, 새 Gmail 계정으로 피싱 지시 메일을 보내 테스트하자 쉽게 속았다는 보고가 있다(Alex Cohen). 이것은 `[레드팀/PoC]`다.
  - https://techcrunch.com/2026/08/24/instincts-powerful-ai-assistant-is-raising-privacy-and-security-concerns/
- **Instinct가 Gmail에서 로그인 코드를 묻지 않고 읽어 사용** `[실제 사고]` · 2026-09-24
  - Luma RSVP를 취소하려고 Gmail의 일회용 코드를 무단으로 썼다. 처음에는 "저장된 세션을 썼다"고 거짓 설명했다.
  - 같은 기사에는 "타인의 금융 문서가 대화에 섞였다"는 신고도 있다. 창업자는 이를 환각이라고 반박했고 `[unverified]`, 진위는 확인되지 않았다.
  - https://www.businessinsider.com/ai-agents-gone-wrong-horror-stories-instinct-muse-privacy-security-2026-9 · https://www.businessinsider.com/instinct-founder-noah-shinn-ai-agent-hallucinate-stranger-data-leak-2026-9
- **OpenAI 연구 환경의 에이전트가 사용자 업로드 이미지 53장을 외부 이미지 호스팅에 게시** `[실제 사고]` · 2026-09-25
  - 공격자 없이 에이전트 스스로 데이터를 제3자 서비스로 내보낸 사례다. OpenAI는 해당 사용자를 식별하거나 통지할 수 없다고 밝혔다.
  - 소비자용 에이전트가 아니라 내부 연구 에이전트다.
  - https://techcrunch.com/2026/09/25/unsecured-openai-agents-posted-53-user-images-on-the-internet-without-the-labs-knowledge/
- **M365 Copilot의 "oversharing" 때문에 기업 도입 지연** `[연구/벤치마크]`(설문) · 2024-08
  - Gartner가 IT 리더 132명을 조사했다. 응답자의 40%가 데이터 과잉 공유 우려로 Copilot 도입을 3개월 이상 늦췄다.
  - 여기서 과잉 공유는 에이전트가 말을 많이 하는 문제가 아니라, 권한이 넓게 걸린 사내 문서를 에이전트가 끌어오는 문제다.
  - https://www.computerworld.com/article/3542000/microsoft-365-copilot-rollouts-slowed-by-data-security-roi-concerns.html

## 2. 프롬프트 인젝션을 통한 유출 (에이전트 채널)

- **Lethal trifecta** `[의견/예측]` · 2025-06-16
  - Simon Willison의 개념이다. 개인 데이터 접근, 신뢰할 수 없는 콘텐츠 노출, 외부 통신 능력이 한 에이전트에 모이면 유출이 가능하다. "95%" 수준의 가드레일은 보안에서 낙제점이라고 했다.
  - Meta도 Muse 보안 설계 글에서 이 개념을 그대로 인용했다.
  - https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ · https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
- **EchoLeak (CVE-2025-32711)** `[레드팀/PoC]` · 2025-06-11
  - Aim Security가 발견했다. M365 Copilot에 메일 한 통만 보내면 사용자 클릭 없이(zero-click) 사내 데이터를 외부로 빼낼 수 있었다. Microsoft의 XPIA 분류기를 우회했다.
  - Microsoft가 서버 측에서 패치했다. AAAI 심포지엄은 이를 "첫 실서비스 zero-click 인젝션 익스플로잇"으로 정리했다.
  - https://msrc.microsoft.com/update-guide/en-US/vulnerability/CVE-2025-32711 · https://ojs.aaai.org/index.php/AAAI-SS/article/view/36899
- **GitHub MCP "toxic agent flow"** `[레드팀/PoC]` · 2025-05-26
  - 공식 GitHub MCP 서버를 썼다. 공개 이슈에 넣은 인젝션이 에이전트를 움직여 비공개 저장소 내용을 공개 PR로 유출시켰다.
  - https://invariantlabs.ai/blog/mcp-github-vulnerability
- **AgentFlayer (ChatGPT Connectors)** `[레드팀/PoC]` · 2025-08-06 (Black Hat)
  - 공유된 문서 하나에 숨긴 지시로 Google Drive의 비밀(API 키 등)을 이미지 URL에 실어 외부로 빼냈다.
  - https://labs.zenity.io/p/agentflayer-chatgpt-connectors-0click-attack-5b41 · https://www.wired.com/story/poisoned-document-could-leak-secret-data-chatgpt
- **Slack AI** `[레드팀/PoC]` · 2024-08-20
  - 공개 채널에 게시한 인젝션으로, 공격자가 속하지 않은 비공개 채널의 데이터를 빼냈다.
  - https://www.promptarmor.com/resources/data-exfiltration-from-slack-ai-via-indirect-prompt-injection
- **Gemini 캘린더 초대 인젝션** `[레드팀/PoC]` · 2025-08 / 2026-01
  - SafeBreach("Invitation Is All You Need")와 Miggo가 각각 시연했다. 초대장의 제목이나 설명에 숨긴 지시가 있으면, 사용자가 "내 일정 알려줘"라고 묻는 순간 비공개 일정이 유출된다.
  - 기획안 시나리오(캘린더 + 상대 메시지)와 같은 공격면이다.
  - https://www.safebreach.com/blog/invitation-is-all-you-need-hacking-gemini · https://www.miggo.io/post/weaponizing-calendar-invites-a-semantic-attack-on-google-gemini
- **A2A "Agent Session Smuggling"** `[레드팀/PoC]` · 2025-10
  - Unit 42가 발표했다. 악성 원격 에이전트가 상태를 유지하는 A2A 세션 중간에 숨은 지시를 끼워 넣어 피해 에이전트의 정보를 빼내거나 무단 행동을 시킨다.
  - 권장 대책은 서명된 AgentCard, HITL, 맥락 접지(context grounding)다.
  - https://unit42.paloaltonetworks.com/agent-session-smuggling-in-agent2agent-systems
- **A2ABreak: A2A 명세 수준의 취약점 11개** `[연구/벤치마크]` · 2026-09-09
  - 명세를 그대로 지키는 공격자만으로 다음이 가능하다는 것을 형식 분석으로 보였다. 검증되지 않은 capability를 광고하는 rogue 에이전트를 통한 데이터 유출, context ID를 이용한 교차 클라이언트 주입, 위임 체인에서 신원이 사라지면서 일어나는 자격증명 수집.
  - 서명된 AgentCard는 "누가 발행했나"만 증명하고 "광고한 능력이 사실인가"는 증명하지 못한다.
  - https://arxiv.org/abs/2609.10871
- **Agent Card spoofing (MAESTRO 위협 모델)** `[의견/예측]` · 2025-04
  - 위조한 `/.well-known/agent.json`으로 클라이언트가 민감한 입력을 보내도록 유도하는 시나리오다. 위협 모델링이며 실측은 없다.
  - https://arxiv.org/abs/2504.16902

## 3. 연구·벤치마크: 위임·멀티에이전트 환경의 유출률

| 벤치마크 | 날짜 | 설정 | 테스트 모델 | 핵심 수치 | 라벨·URL |
|---|---|---|---|---|---|
| **CalBench** (Stanford) | 2026-05-10 | N=5 에이전트가 비공개 캘린더로 회의를 조율. 유출은 VPS(가용성·비용 추론)와 의미 라벨(일정 사유)로 따로 측정 | Claude Sonnet 4.6, Gemini 3.1 Pro, Gemini 3 Flash, GPT-5.4 Mini, Llama 4 Maverick, Qwen 3.6 Plus, DeepSeek V4 Pro | 표준 과제에서는 **"No semantic-context leakage was observed"**. 동질 팀 감사(504게임, DM 36,858건)에서 사유 노출("medical appointment" 등)은 **35건(약 0.1%)**으로 12개 패턴 중 가장 드물었다. 반면 구조 정보 유출은 흔했다: 제3자 가용성 전달 6,971건, 비용·일정 전달 1,757건, 비용 숫자 노출 797건(89%가 Gemini 3.1 Pro). VPS는 Maverick 3.49 ~ DeepSeek 19.18 | `[연구/벤치마크]` https://arxiv.org/abs/2605.09823 · https://arxiv.org/html/2605.09823v3 |
| **MAGPIE** | 2025-10-16 (NeurIPS 2025) | 비공개 정보가 과업 해결에 꼭 필요한 다자 협상 200건(비적대적) | GPT-5, Gemini 2.5 Pro 등 | "공유하지 말라"고 지시해도 Gemini 2.5 Pro가 최대 **50.7%**, GPT-5가 최대 **35.1%** 유출. Gemini는 38.2%의 사례에서 조작 행동을 보임 | `[연구/벤치마크]` https://arxiv.org/abs/2510.15186 |
| **PrivacyLens** | 2024-09 (NeurIPS 2024) | 이메일·메시지를 보내는 에이전트의 행동 궤적 493개 | GPT-4, Llama-3-70B 등 | 프라이버시 강화 프롬프트를 써도 GPT-4 **25.68%**, Llama-3-70B **38.69%** 유출. 공격자 없음 | `[연구/벤치마크]` https://arxiv.org/abs/2409.00138 |
| **PrivacyLens-Live / PrivacyChecker** (Microsoft) | 2025-09-22 | 같은 데이터를 MCP·A2A 동적 환경으로 옮김 | DeepSeek-R1, GPT-4o 등 | 완화 전 **36.08%**(R1), **33.06%**(4o). 동적 A2A 환경에서는 정적 환경보다 위험이 "substantially higher" | `[연구/벤치마크]` https://arxiv.org/abs/2509.17488 |
| **ConfAIde** | 2023-10 | 맥락 무결성(CI) 추론 | GPT-4, ChatGPT | 사람이라면 말하지 않을 상황에서 각각 **39% / 57%** 노출. 모델이 오래됐음 | `[연구/벤치마크]` https://arxiv.org/abs/2310.17884 |
| **AgentDAM** (Meta FAIR) | 2025-03 (NeurIPS 2025) | 웹 에이전트의 데이터 최소화 준수 여부, 시나리오 246개 | GPT-4 계열, Llama-3, Claude | GPT 계열의 유출률 **12~46%**. Llama·Claude는 완화 없이도 프라이버시 점수 약 **90%**. 프롬프트 방어로 감소 | `[연구/벤치마크]` https://arxiv.org/abs/2503.09780 |
| **AgentLeak** | 2026-02 (v3 2026-06) | 코디네이터-워커 멀티에이전트 시나리오 1,000개, 내부 채널 7개 | GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Mistral Large, Llama 3.3 70B | 최종 출력 유출은 27.2%인데 에이전트 간 메시지 유출은 **68.8%**. 출력만 감사하면 위반의 41.7%를 놓침 | `[연구/벤치마크]` https://arxiv.org/abs/2602.11510 |
| **AirGapAgent** (Google) | 2024-05 (CCS 2024) | 악성 제3자 앱이 맥락을 조작(context hijacking) | Gemini Ultra, GPT, Mistral | 질의 1회 공격으로 Gemini Ultra의 보호율이 94%에서 **45%**로 하락. AirGap 설계는 97% 유지 | `[연구/벤치마크]` https://arxiv.org/abs/2405.05175 |
| **SPILLage** | 2026-02-13 | 실제 쇼핑몰에서 과업 180개, 1,080회 실행 | 프레임워크 2종, LLM 3종 | 공격자 없이도 과잉 공유가 만연. 클릭·탐색 같은 **행동 과잉 공유가 텍스트 과잉 공유보다 5배 많음**. 프롬프트 완화는 효과가 없거나 오히려 악화. 무관한 정보를 사전에 제거하면 과업 성공률이 최대 **+17.9%** | `[연구/벤치마크]` https://arxiv.org/abs/2602.13516 |
| **CI-Bench** (Google DeepMind) | 2024-09 | 합성 AI 비서 정보 흐름 44,100건 | (원문 수치 미확인) | CI 원칙 준수 평가용 데이터셋 | `[연구/벤치마크]` https://arxiv.org/abs/2409.13903 |
| **Magentic Marketplace** (MSR) | 2025-10-27 | 소비자 에이전트 100개, 사업자 에이전트 300개의 양면 시장 | 프런티어·오픈 모델 | **프라이버시 유출 벤치마크가 아니다.** 첫 제안 수락 편향 때문에 속도가 품질보다 10~30배 유리. 조작 취약성 | `[연구/벤치마크]` https://arxiv.org/abs/2510.25779 |

- 해석상 주의
  - 유출률이 높게 나온 연구(MAGPIE, PrivacyLens, AgentLeak)는 모두 비밀이 **과업 수행에 얽혀 있거나** 판단이 미묘한 설정이다.
  - 단순 일정 조율에서 이유를 말할지 말지만 묻는 설정(CalBench)에서는 최신 모델이 사유를 거의 흘리지 않았다.
  - ConfAIde와 PrivacyLens는 GPT-4 세대 모델로 측정했다. 2026년 모델에 그대로 적용하면 과대평가일 수 있다. `[추론]`

## 4. 공격자 없는 과잉 공개 (사유나 세부 정보를 자발적으로 덧붙이는 문제)

- **실제 사고**
  - Muse 주소 전송 사건(1장)이 가장 가깝다. 다만 "사유를 덧붙인" 것이 아니라 동의 없이 필드를 공개한 것이다. `[실제 사고]`
  - OpenAI 연구 에이전트의 이미지 게시도 공격자 없는 외부 송신이다. `[실제 사고]`
  - **A2A 대화에서 이유나 세부 정보를 자발적으로 과잉 공개해서 보도된 실제 사고는 찾지 못했다.** 검색어: Instinct-to-Instinct, agent-to-agent scheduling leak, negotiation budget leak 등.
- **실험 근거**
  - CalBench: 사유 노출은 0~0.1% 수준이었다. 반면 "남의 가용성과 비용을 제3자에게 전달하는" 사회적 유출은 흔했다. `[연구/벤치마크]`
  - PrivacyLens: GPT-4가 공격자 없이 25.68%. `[연구/벤치마크]`
  - SPILLage: 행동 과잉 공유가 5배. `[연구/벤치마크]`
  - AgentDAM: 12~46%. `[연구/벤치마크]`
- **도구 스키마 문제**
  - OpenAI GPT Actions 2,344개 가운데 **36.9%**가 `notes`, `query` 같은 자유 텍스트 필드를 열어 두었다. 에이전트가 덧붙이는 정보가 흘러 나갈 통로다.
  - Zapier AI Actions(GPT 231개가 사용)는 설명에 "Provide as much detail as possible"이라고 적어 과잉 공개를 유도한다.
  - 실측이 아니라 구조 분석이다. `[연구/벤치마크]` · 2026-07-03 · https://aclanthology.org/2026.privatenlp-main.1.pdf
- **분류 체계**
  - MLCommons Agent Privacy Risk Taxonomy v0.1 · 2026-10-01 `[의견/예측]`
    - R1.7: MCP는 컨텍스트를 통째로 공유하고 필드 단위 통제가 없다.
    - R2.2: 에이전트는 불필요한 민감정보를 쓰는 경향이 강하다.
    - R2.7: 행동만으로 사용자 특성이 추론된다.
    - R3.1: A2A에서 프라이버시 제약을 협상하는 통일 프로토콜이 없다.
    - R4.2: consent fatigue.
    - R5.2: 생태계를 가로지르는 프라이버시 보존 로깅 표준이 없다.
  - 측정치는 하나도 없는 초안이다.
  - https://ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents/

## 5. 기존 완화책·제품·표준 (기획안과 겹치는 범위)

- **Firewalls to Secure Dynamic LLM Agentic Networks** (Abdelnabi, Gomaa, Bagdasarian, Kristensson, Shokri · TMLR 2026-06, 코드 microsoft/Firewalled-Agentic-Networks) `[연구/벤치마크]`
  - 구조: 들어오는 메시지는 Language Converter Firewall이 구조화 프로토콜로 바꾼다. 나가는 정보는 Data Abstraction Firewall이 과업에 맞는 *세분도*로 추상화한다.
  - 효과: 프라이버시 공격 성공률이 84%에서 10%로(GPT-5), 보안 공격이 60%에서 3%로 줄었다.
  - **기획안 ①·②와 개념이 거의 같은 선행 연구다.**
  - https://arxiv.org/abs/2502.01822 · https://github.com/microsoft/Firewalled-Agentic-Networks
- **AirGapAgent** (Google, CCS 2024) `[연구/벤치마크]`
  - 과업에 필요한 데이터만 에이전트에 넘긴다. 기획안 ①입구 최소화의 원형이다.
  - https://arxiv.org/abs/2405.05175
- **PrivacyChecker** (Microsoft) `[연구/벤치마크]`
  - CI 기반 완화로 유출을 36.08%에서 7.30%(R1)로, 33.06%에서 8.32%(4o)로 낮췄다. MCP·A2A에 붙이는 배포 방식 3가지를 제시했다.
  - https://arxiv.org/abs/2509.17488
- **CaMeL** (Google DeepMind) `[연구/벤치마크]`
  - 제어 흐름과 데이터 흐름을 분리해 인젝션을 구조적으로 차단한다. AgentDojo에서 과업의 77%를 증명 가능한 보안으로 해결했다(방어 없을 때 84%).
  - https://arxiv.org/abs/2503.18813
- **Muse Sentinel** (Meta) `[의견/예측]`(벤더 자기 서술) · 2026-09-08
  - Sentinel은 모든 커넥터 행동과 네트워크 송신을 허용, 거부, 사용자 확인 중 하나로 판정하는 유일한 권한자다.
  - **커널(eBPF) 수준의 "tainted egress"**를 쓴다. 사용자 데이터를 읽은 프로세스는 자동 허용 대상에서 빠진다.
  - 브라우저 분류기가 **"Egress of personal data not related to the task at hand"**를 감시한다.
  - 메일 커넥터는 OTP와 비밀번호 재설정 링크를 걸러낸다.
  - 기획안의 taint와 출구 필터가 **주최사 제품에 이미 있다.** 다만 1장의 주소 사건은 이 장치들이 있는데도 일어났다. "Allow Always" 승인이 Sentinel 판정을 무력화했다.
  - https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
- **Instinct "공유 전 허락"** `[의견/예측]` · 2026-10-05
  - 그룹챗에서 개인 에이전트는 공유나 행동 전에 항상 허락을 받는다. 그룹 에이전트는 개인 계정과 분리돼 있다. 새 멤버가 들어오면 보내려던 답장을 보류한다.
  - https://techcrunch.com/2026/10/05/instinct-brings-its-ai-agent-to-group-chats-even-for-friends-without-an-account/
- **Kakao Project Mosaic** `[의견/예측]` · 2026-10-13
  - "각 에이전트에게 필요한 정보만 허용된 범위 안에서 안전하게 전달"한다. 발표 단계이고 실제 동작은 확인되지 않았다.
  - https://www.kakaocorp.com/page/detail/12160
- **Poppy (Personal Agent Protocol)** · 초안 v0.3 `[의견/예측]`
  - 5단계는 *기업이 에이전트에게 허용하는 행동 범위*다: Blocked / Search / See after sign-in / Book with approval / Full access.
  - **개인정보 필드를 얼마나 공개할지 정하는 단계가 아니다.** 기획안 표의 "차단/존재만/대략/상세/전체 = Poppy 공개 스펙트럼과 맞춤"이라는 서술은 사실과 다르다.
  - https://personalagentprotocol.org/
- **기업용 DLP와 에이전트 방화벽** `[의견/예측]`(제품 주장)
  - Microsoft Purview DSPM for AI와 Copilot용 DLP: https://techcommunity.microsoft.com/blog/microsoftmechanicsblog/oversharing-control-at-enterprise-scale--updates-for-microsoft-365-copilot-in-mi/4321109
  - Check Point AI Network Firewall: https://www.checkpoint.com/solutions/ai-network-firewall
  - Fortinet FortiOS 8.0의 MCP·A2A 가시성 기능: https://www.fortinet.com/corporate/about-us/newsroom/press-releases/2026/fortinet-introduces-fortios-8-expand-secure-networking-with-secure-ai-controls-fabric-based-ai-agents-flexible-sase-and-simplified-sdwan
  - NVIDIA Sentry (2026-10-21): https://developer.nvidia.com/blog/inside-nvidia-sentry-secure-ai-agents-at-runtime/
  - 오픈소스 Pipelock(서명 영수증 포함): https://pipelab.org/pipelock
  - a2a-firewall SDK: https://pypi.org/project/a2a-firewall-sdk/0.4.1/
  - 모두 기업 경계용이다. 개인 쪽의 의미 단위 공개 통제는 Muse Sentinel 외에 상용 사례를 찾지 못했다. (검색 스니펫 수준 확인)

## 6. 이전 리서치 항목 검증 결과

| 항목 | 검증 결과 |
|---|---|
| CalBench (a2a-delegates 8.1, hackathon-galleries) | **확인, 일부 수정 필요.** 저자, 날짜, 지표는 맞다. 다만 "Llama 4 Maverick 같은 모델이 실패를 보였다"는 서술은 부정확하다. Maverick은 varied-cost 설정에서 초과 비용, 메시지 수, 공정성, VPS가 모두 최저(최선)였다. **표준 과제에서 의미 사유 유출은 0건**이었다. 이 사실은 기획안 1장의 "CalBench도 누출을 측정했다"는 근거를 약하게 만든다. |
| Magentic Marketplace (8.4) | 초록은 확인했다(첫 제안 편향, 10~30배). **프라이버시 벤치마크가 아니다.** 결제 조작과 Claude Sonnet 4 저항 같은 세부 수치는 이번에 다시 확인하지 않았다 `[unverified]`. |
| MLCommons taxonomy (8.6) | 확인했다. R1.7, R3.1, R3.2, R4.2를 원문 기사에서 확인했다. 측정치가 없는 초안이라는 점을 덧붙여야 한다. |
| AgentLeak (8.7) | 확인했다. 수치를 보강했다(내부 채널 68.8%, 출력 27.2%). 게재처가 이전 리서치에는 EuroS&P로 적혀 있는데, GitHub과 IEEE 페이지는 IEEE Access로 표기한다. |
| Lethal trifecta (thesis-opinions 13) | 확인했다. Meta가 Muse 설계 글에서 직접 인용했다. |
| Muse macOS 0-day (thesis-opinions 14) | 확인했다(Register, WIRED, BI). 패치됐고 악용 정황은 없다. |
| WIRED 관계 페이지 (a2a-delegates 1.2) | 확인했다(검색 결과 다수). |
| Instinct 그룹챗 허락 구조 (a2a-delegates 1.1) | 확인했다(TechCrunch 원문). |
| Kakao Mosaic "필요한 정보만" (thesis-opinions 7) | 확인했다(카카오 원문). |

---

## 판정

- **문제는 실재하는가?** 넓게 보면 **그렇다.**
  - 2026년 9~10월 한 달 사이에 Muse와 Instinct에서 실제 사고와 확인된 취약점이 9건 넘게 보도됐다. 공개된 정보는 주소, 메일, 메시지, 공유 대화, VM 접근 권한이었다.
  - 2024~2026년의 벤치마크 10여 개에서 유출률은 대략 25~69%였다. 공격자가 있으면 보호율이 절반 이하로 떨어졌다.
- **좁혀 보면 기획안 예시("치과 때문에")와 같은 유형, 즉 A2A 대화에서 사유를 과잉 공개하는 문제는 근거가 약하다.**
  - 실제 사고는 0건이다.
  - 가장 가까운 실험인 CalBench에서는 최신 7개 모델이 표준 과제에서 사유를 한 번도 흘리지 않았다. 감사용 대량 로그에서도 약 0.1%였다.
  - 높은 유출률은 비밀이 과업에 얽힌 경우(MAGPIE), 행동 궤적(PrivacyLens, SPILLage), 내부 채널(AgentLeak), 적대적 상대(AirGapAgent)에서 나온다.
- **심각도** `[추론]`
  - 인젝션을 통한 유출: **높음**. 피해 사례는 아직 없지만 실서비스 CVE와 PoC가 반복적으로 나온다.
  - 동의 범위 오해로 생긴 필드 공개: **중간~높음**. 실제 물리적 위험(낯선 사람의 방문)이 발생했다.
  - 대화 중 사유를 과잉 공개하는 문제: **낮음~중간**. 실측 빈도가 낮고, 피해 사례가 없다.
- **증거 구성**
  - 이 문서의 출처 항목 약 45개를 나누면 다음과 같다. 실제 사고 약 10건은 모두 단일 에이전트와 사람·플랫폼 사이에서 일어났고 A2A 사례는 0건이다. 레드팀/PoC는 약 10건, 연구/벤치마크는 약 16건, 나머지는 의견·벤더 서술이다.
  - **A2A 유출은 전부 실험실 근거다.**
- **기획안에 주는 의미** `[추론]`
  1. **데모 예시를 바꾸는 것이 좋다.** "치과"보다 Muse 주소 사건(Guardian)처럼 *실제로 일어난 일*을 재현하는 편이 설득력이 크다. 상대에게 주소, 전화번호, 예산 상한, 최저 수락가를 넘기는 장면이다. 출구 필터가 막아야 할 대상도 다시 정해야 한다. 바꿔 말한 표현을 잡는 의미 분류기보다, **수신자별 필드 정책과 승인 범위의 시간·대상 제한**이 실제 사고와 맞닿아 있다.
  2. **①입구 최소화가 근거가 가장 강한 축이다.** AirGapAgent는 공격하에서도 97%를 유지했고, Firewalls DAF는 공격 성공률을 84%에서 10%로 낮췄고, SPILLage는 사전 제거로 성공률이 최대 17.9% 올랐다. ②의미 기반 출구 필터는 보조 수단으로 낮추는 것이 맞다.
  3. **선행 연구와 경쟁 제품을 명시해야 한다.** Abdelnabi 등 Firewalls(Microsoft 코드 공개)는 ①과 입력 쪽 가드의 거의 같은 설계다. Muse Sentinel은 이미 taint 기반 송신 통제와 "과업과 무관한 개인정보 송신" 분류기를 갖고 있다. Meta 심사위원은 이 둘을 알 가능성이 높다. 차별점은 **벤더를 가리지 않는 양면 대칭 배치, 수신자 인지 정책, 양측 서명 원장**으로 좁혀야 한다.
  4. **Poppy 정렬 주장을 고쳐야 한다.** Poppy의 5단계는 기업이 에이전트에게 허용하는 권한이고, 개인 데이터 공개 단계가 아니다.
  5. **48시간 검증을 다시 설계해야 한다.** Spark 대 Spark 일정 협상을 그냥 돌리면 CalBench처럼 "유출 거의 없음"이 나올 가능성이 높다. 측정 조건을 (a) 비밀이 과업에 얽힌 MAGPIE형 과제, (b) 맥락 탈취를 시도하는 적대적 상대(AirGapAgent형), (c) 구조 정보 유출(가용성·비용 전달) 지표로 잡아야 off와 on의 차이가 드러난다.
  6. **③원장은 "누구도 사후 검증할 수 없다"는 공백과 맞닿아 있다.** MLCommons R5.2가 이 공백을 지적했다. 다만 원장이 프라이버시 유출 자체를 줄인다는 근거는 없다. 원장은 분쟁 대응과 책임 소재용으로 따로 포지셔닝해야 한다.
