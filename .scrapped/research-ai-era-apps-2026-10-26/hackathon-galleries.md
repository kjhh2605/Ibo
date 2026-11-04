# AI 시대 애플리케이션: 해커톤 출품작·수상작 조사 (2025–2026)

조사일: 2026-10-26 · 담당: HackathonGalleries
범위: 에이전트가 앱을 조작하는 경우, 에이전트를 위한 앱, agent-to-agent(A2A), 개인 에이전트, 생성형 UI, 지갑·결제를 가진 에이전트, 멀티에이전트 사회, 음성·글래스 에이전트
표기: 각 항목은 이름 · 하는 일 · 테제 관련성 · 시그널 · 출처 · 날짜 순서로 정리했다. 직접 열어보지 못했거나 순위를 확인하지 못한 내용은 `[unverified]`로 표시했다.

---

## 0. 정량 스냅샷: Cerebral Valley(CV) 갤러리 39개, 출품작 3,363개

CV는 갤러리 마크다운을 공개한다(`/e/{slug}/hackathon/gallery.md`). 2025-08~2026-10에 열린 CV 해커톤 39개의 출품작 3,363개와 수상·결선작 221개를 내려받아 키워드로 셌다. 설명문이 약 160자에서 잘려 있으므로 아래 숫자는 **하한치**다. 키워드 방식이라 오탐도 있다. 예컨대 "genuine"이 "genui"에 걸렸으며, 이런 경우는 수작업으로 걸러냈다.

| 테마 | 전체 출품 | 수상/결선 | 해석 |
|---|---|---|---|
| 헬스케어/환자/클리닉 | 253 | 15 | 가장 붐빔. 수상도 많지만 경쟁이 극심함 |
| 검증·증거·"done means done" | 190 | 10 | 2026년 하반기 최대 유행어 |
| 음성(voice) | 184 | 19 | 수상작이 가장 많이 나온 모달리티. 흔하지만 여전히 이김 |
| 시뮬레이션/디지털 트윈 | 121 | 12 | 꾸준히 수상 |
| 메모리/공유 뇌(shared brain) | 98 | 4 | 많이 나오지만 수상률은 낮음 |
| 자기개선/recursive | 83 | 7 | Recursive Agents 해커톤에 몰림 |
| 여행 플래너 | 37 | 2 | 진부함 |
| 컴퓨터 유즈/브라우저 조작 | 24 | 5 | 출품은 적고 수상률은 높음 |
| 지갑·결제(x402 등) | 21 | 0 | CV 생태계에서는 거의 없음(크립토 해커톤으로 분리됨) |
| **협상(negotiation)** | **20** | **1(게임 NPC)** | **소비자를 대리해 협상하는 에이전트가 수상한 사례는 0건** |
| **스마트 글래스/웨어러블** | **18** | **2(결선)** | **Meta 하드웨어 영역인데도 공백** |
| **A2A(에이전트 간 통신)** | **≈5** | **1(관측성 도구)** | **사실상 공백** |
| **생성형 UI(실제 genUI)** | **≈3** | **1(1위)** | **출품이 적은데 1위를 함** |

출처: https://cerebralvalley.ai/hackathons (52개 이벤트 목록), 각 `/e/{slug}/hackathon/gallery`. 집계는 2026-10-26에 직접 수행했다.

---

## 1. 이전 Meta/Llama 해커톤 수상작: 심사위원이 보상한 것

### 1-1. LlamaCon Hackathon (SF, 2025-05) · 238명 참가, 44개 제출, 상금 $35K
- **OrgLens (1위)**: Jira·GitHub·문서·이력서로 조직 지식그래프를 만들어 사내 전문가를 찾아준다. 상대에게 연락하기 전에 그 사람의 **digital twin**과 먼저 대화할 수 있다.
- **Compliance Wizards (2위)**: 거래 사기를 탐지한 뒤 AI 음성 비서와 대화해 신고하거나 확인한다. 멀티모달 KYC 기능을 포함한다.
- **Llama CCTV Operator (3위)**: 자연어로 정의한 이벤트를 파인튜닝 없이 Llama 4 비전으로 감시한다.
- **Geo-ML (Best Llama API)**: 400쪽 분량의 지질 보고서를 Maverick의 긴 컨텍스트와 멀티모달 기능으로 DSL로 바꾼 뒤 3D 지하 모델을 생성한다. 만든 사람은 현업 지질학자다.
- 테제 관련성: "사람의 digital twin과 먼저 대화"하는 OrgLens는 대리인(proxy) 에이전트의 초기 형태다.
- 시그널: 심사는 2라운드였다(44개 → 6개 → 시상). 별도 상으로 Best Llama API가 있었다.
- 출처: https://ai.meta.com/blog/llamacon-hackathon · https://github.com/TheCl3m/llama-hack · 2025-05

### 1-2. Llama 4 Hackathon NYC (2025-05-31~06-01)
- **Pitch Perfect (1위)**: 목소리, 군말, 몸짓, 시선, 발표 내용과 구조를 분석해 발표를 실시간 코칭한다.
- **AthletIQ (2위)**: 경기 영상을 분석해 개인 코칭을 제공한다.
- **Centaur SRE (3위)**: 알림이 발생하면 그 장애에 필요한 대시보드를 즉석에서 생성한다. **생성형 UI의 초기 수상 사례**다.
- **ParentBridge (Best Llama API)**: 학생 과제를 이중 언어 학부모용 리포트로 바꾼다.
- **MashaSquared (NYC Impact)**: 시 행정 서비스 질문에 다국어로 답한다.
- 테제 관련성: 실시간 멀티모달 코칭과 상황별로 생성되는 UI가 1위와 3위를 차지했다.
- 출처: https://www.facebook.com/MetaforDevelopers/videos/congratulations-to-the-winners-of-the-llama-4-nyc-hackathon/1244981543925107 · 2025-06

### 1-3. Llama 4 Hackathon Seattle (2025-06-21~22)
- **Sussi (1위)**: 교사용 앱이다. Llama API로 학생 화면 스크린샷을 분석해 수업에 집중하고 있는지 판단하고 집중 점수를 낸다. 만든 사람은 중학교 졸업생 2명이다.
- **PromiseKeeper (Best Llama API)**: 백그라운드에서 화면을 계속 보며 대화 속 "약속"을 찾아낸다. 그 약속을 Calendar, Apple Maps, iMessage 쪽 액션으로 **선제적으로 실행**하는 개인 에이전트다.
- 테제 관련성: **"화면을 읽고 사람 대신 앱을 조작하는 에이전트"를 Meta가 2025년에 이미 시상했다.** 다만 단일 사용자 비서 수준에 머물렀고, 다른 에이전트와 협상하는 기능은 없었다.
- 출처: https://www.youtube.com/watch?v=9fk_h4dAfGA · https://www.youtube.com/watch?v=Oa49kXTeV4c (Meta Developers 채널) · 2025-06/07

### 1-4. Llama Impact Hackathon London (2024-11) · 200명 이상, 56개 팀, 상금 $50K
- **Guardian (1위)**: NHS 응급실(A&E) 트리아지 에이전트 "Atlas"다. 다국어 환자 접수와 실시간 위험 평가를 한다.
- **Gripmind (2위)**: Llama 3.2 Vision과 뇌 신호·음성·이미지를 이용해 로봇 팔을 제어한다(보조 생활용).
- **Pharmallama (3위)**: 온디바이스 약사 상담 앱이다.
- 테제 관련성: 2024년 자료라 범위를 벗어나지만 Meta 심사 성향을 보여주는 기준선으로 넣었다. **공공 임팩트, 접근성, 실제 기관 워크플로가 이긴다.**
- 출처: https://about.fb.com/news/2024/11/metas-llama-impact-hackathon-pioneering-ai-solutions-for-public-good · 2024-11

### 1-5. Edge Deployments & On-Device AI Hackathon (Meta × CV, ExecuTorch, 2025-10)
- **SafeHome Inventory (1위)**: ExecuTorch와 Qualcomm NPU로 재난 피해자가 보험 청구용 소지품 목록을 만들도록 돕는다.
- **Beaker (2위)**: 과학자가 실험 프로토콜을 음성으로 단계별 안내받는다.
- **Pocket Whisper (3위)**: 말이 막힐 때 로컬에서 단어를 채워주는 온디바이스 음성 보조다.
- 테제 관련성: Meta가 공동 주최한 해커톤에서도 **"취약한 사용자 + 실제 순간 + 핸즈프리/음성"** 조합이 이겼다.
- 출처: https://cerebralvalley.ai/e/executorch-hackathon/hackathon/gallery · 2025-10

> **Meta 심사 패턴 요약**: ① 이름을 댈 수 있는 실제 사용자(교사, 지질학자, 응급실 간호사, 재난 피해자) ② 멀티모달(비전·음성·긴 컨텍스트)을 *해당 모델이 아니면 어려운* 방식으로 사용 ③ 사회적 임팩트 ④ 실시간 데모. "Best Llama API"는 **모델의 고유 능력**(긴 컨텍스트 멀티모달 추출, 스크린 이해)을 끝까지 밀어붙인 쪽이 받았다. 이번 해커톤의 "Use of Meta AI tooling 25%" 항목도 같은 신호다.

---

## 2. 2026년 CV 해커톤: "AI 시대 앱" 관련 수상작 (최신순)

### 2-1. The Recursive Agents Hackathon (Crusoe × CV, SF, 2026-10-17) · 108개 프로젝트, 6개 입상
- **Etch (1위)**: 말 한 문장("AirTag 같은 GPS 트래커 만들어줘")을 실제 PCB로 바꾼다. 에이전트 팀이 실존 부품을 고르고 KiCad로 배치와 배선(place & route)을 한다. 요구사항을 측정 가능한 검사로 바꾸고, ERC/DRC/ngspice 같은 **plain code로 증명하기 전에는 "done"이라고 말하지 못한다.** 측정할 수 없으면 "cannot measure"라고 보고한다. 부품 파일마다 출처, 라이선스, 해시를 붙인다.
- **SPARKLETEAM (2위)**: 식기세척기 적재 방법을 스스로 학습하는 자기개선 에이전트 팀이다. "물리 법칙 하나와 미신 하나를 배웠고, 어느 쪽인지 측정했다."
- **AGI Factory (3위)**: 1,420만 splat 규모 공장 스캔 위에서 6개월치 디지털 트윈을 돌린다. 로봇 정비 팀이 자기 역할과 플레이북을 고쳐 쓰는데, **처음 보는 달(month)에서 더 낫고 더 안전할 때만** 변경을 채택한다. 점수는 66.5에서 92.8로 올랐고 위험 행동은 21건에서 0건으로 줄었다.
- **Mato / LetsGo (결선)**: **단톡방 안에 사는 에이전트**다. 모든 사람의 메시지를 계획 규칙으로 바꾸고, 실수를 학습 데이터로 만들어 Nemotron을 파인튜닝한다.
- **Trendify (결선)**: 수천 개의 서브에이전트가 YouTube 시청자를 *시뮬레이션*해서 바이럴 이전 단계의 트렌드를 찾는다.
- 테제 관련성: 심사위원은 **물리 세계 산출물과 증명 가능한 완료**를 1~3위로 뽑았다. 반면 "검증 프레임워크" 자체를 출품한 팀은 10개 이상(Traceback, DoneDone, Unfoolable, HOLDOUT, Done, Nemotron Done Means Done 등)이었는데 모두 입상하지 못했다. 검증은 **수단이어야 이기고, 제품으로 내세우면 지는** 포화 영역이다.
- 출처: https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery · https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery/58 · 2026-10

### 2-2. GPT-6 Astra Hackathon London (OpenAI × Lovable, 2026-10-06) · 32개
- **dot-dash (1위)**: Codex 세션을 가져와 에이전트를 "오픈 오피스"의 캐릭터로 시각화한다. 협업자를 초대할 수 있고, 컨텍스트 사용량, 건강 상태, 재시도, 오류를 보여준다(구급상자 버튼은 `codex doctor`).
- **Wayfinder (3위)**: 휴대폰 카메라로 병원 안을 길 안내한다. **Cereal (결선)**: AirPods 한 쌍을 나눠 끼고 쓰는 2인 실시간 통역이다.
- 테제 관련성: **사람이 일하는 에이전트를 감독하는 UI**가 1위를 했다. 사람의 역할이 "조작자"에서 "관리자"로 바뀌고 있다는 신호다.
- 출처: https://cerebralvalley.ai/e/openai-gpt-6-astra-london/hackathon/gallery/27 · 2026-10

### 2-3. GPT-6 Astra Hackathon SF / NYC (2026-09)
- **CAD Sandboxes (SF 1위)**: Fusion을 VM에서 HTTP 인터페이스로 감싸고 작업 공간 상태를 실시간 스트림으로 내보내 모델이 CAD를 직접 조작하게 한다. **"사람용 앱을 에이전트가 쓸 수 있게 재포장"**하는 방식의 대표 사례다.
- **Astra HQ (NYC 1위)**: "당신이 CEO"인 AI 직원 팀이 24시간 일하고, 사용자는 승인만 한다.
- **Homebuddy (SF 2위)**: 공간을 3D 렌더링하고 카탈로그 가구를 모델링한다. **Pearl (SF 3위)**: 음성으로 여행 탐색부터 예약까지 한다.
- 테제 관련성: "에이전트를 위한 앱 인터페이스"와 "에이전트 조직 운영"이 각각 1위를 했다. 다만 AI 회사/CEO 콘셉트는 Recursive 해커톤에서도 CORE GENESIS, Darwin, The A team이 반복했으므로 진부해지는 중이다.
- 출처: https://cerebralvalley.ai/e/openai-gpt-6-astra-sf/hackathon/gallery/17 · https://cerebralvalley.ai/e/openai-gpt-6-astra-nyc/hackathon/gallery/8 · 2026-09

### 2-4. OpenAI Voice Hack Night (SF, 2026-05-27) · 59개
- **Agentic OS for a Phone (1위)**: 음성 우선 모바일 OS다. "말하면 답하고, 실행하고, 그 순간에 맞는 인터페이스를 실시간으로 만든다(캘린더, 할 일, 항공권, 이메일, 뉴스). **앱을 찾아다닐 필요가 없다.**" 하루 만에 만들었다.
- **Wagner (2위)**: Realtime API 기반 멀티에이전트 가상 회의실이다.
- 테제 관련성: **"앱 → 에이전트 + 생성형 UI" 테제를 가장 직접적으로 구현해 1위를 했다.** 같은 행사에 "Peripheral(개인 에이전트 전용 28g 스마트 글래스)", "Live translate on Meta glasses" 같은 글래스 출품도 있었다.
- 출처: https://cerebralvalley.ai/e/openai-voice-hack-night/hackathon/gallery/49 · 2026-05

### 2-5. AI Engineer World's Fair Hackathon 2026 (SF, 2026-06-27) · 70개
- **SplatForge (1위)**: 휴대폰으로 탁자를 찍으면 그 장면을 재구성하고, 로봇 조작 에이전트가 그 안에서 스스로 훈련한다.
- **rote (3위)**: 자기개선형 **컴퓨터 유즈** 에이전트다. 처음 하는 작업은 Gemini Computer Use가 실시간으로 조작한다. 그 실행을 녹화해 재사용 가능한 skill로 컴파일하고 정답과 대조해 검증한 뒤, 다음 요청부터는 **모델 호출 없이 재생**한다. 기기와 사용자 간에 공유되므로 "Stack Overflow처럼" 쌓인다. UI가 바뀌어도(UI drift) 복구한다.
- 테제 관련성: "에이전트가 사람용 GUI를 조작"하는 방식의 비용과 신뢰성 문제를 **검증된 skill 라이브러리**로 해결했다. 앱이 사라지는 것이 아니라 에이전트용 실행 기록이 쌓이는 쪽으로 간다.
- 출처: https://cerebralvalley.ai/e/aiewf-hackathon-2026/hackathon/gallery/54 · 2026-06

### 2-6. Gemini 3 해커톤 시리즈 (2026-02~03, 서울·도쿄·벵갈루루·싱가포르·NYC·파리)
- **Zeppy (벵갈루루 2위)**: 사용자를 대신해 어떤 언어로든 **전화를 걸어 문의**하는 음성 에이전트다.
- **SaralPhone (벵갈루루 결선)**: 노인을 위한 "존엄 레이어(Dignity Layer)"다. 현지어로 말하면("Beta, hospital jana hai") **실제 앱(Ola, Zomato, UPI)을 뒤에서 실행**한다. Gemini가 화면을 해석해 광고와 잡음을 걷어내고, 필요한 버튼만 크게 보이는 오버레이를 보여준다.
- **TryOnAI (벵갈루루 1위)**: 어떤 언어로든 채팅하면서 전 세계 어떤 쇼핑몰이든 탐색하고 가상 피팅을 해준다.
- **DefaultTaste (싱가포르 1위)**: "에이전트 취향 프로파일링 서비스"다. 에이전트를 반복 프로빙해 색, 폰트, 레이아웃, 장르 같은 숨은 기본 취향을 측정하고 교정 프롬프트를 준다.
- **AGIRI A喜利 (도쿄 결선)**: 내 오오기리 스타일을 학습한 **AI 클론이 다른 사람의 에이전트와 대신 대결**한다. "나는 키우고 지켜볼 뿐"이다.
- **서울**: GeminiSpace(1위, 공장 로봇 매핑)와 "saas"(2위)가 입상했다. saas는 **Computer Use로 실제 브라우저 UI를 조작해 공격**하고, 한국어 존댓말 소셜엔지니어링을 쓰며, 검사·변호·배심·판사 4개 에이전트로 구성된 법정이 스스로 진화한다. 결선작 **Elder Guard**는 노인 사기 방지 에이전트로, LLM-as-guard가 결제·송금 같은 위험 기능을 보류한다.
- 테제 관련성: 신흥시장에서는 **"앱을 쓰기 어려운 사람(노인, 비문해, 언어 장벽) 대신 에이전트가 앱을 조작"**하는 방향이 반복적으로 수상했다. 한국에서는 에이전트 보안과 노인 보호가 수상 축이었다.
- 서울 시그널: 지원자 1,515명 → 참가 219명, 111개 제출. 2위 인터뷰에 따르면 멘토 조언은 "가장 작은 동작 단위를 먼저 완성하라"였다.
- 출처: https://cerebralvalley.ai/e/gemini-3-bengaluru-hackathon/hackathon/gallery/42 · …/gallery/61 · https://cerebralvalley.ai/e/gemini-3-singapore-hackathon/hackathon/gallery/44 · https://cerebralvalley.ai/e/gemini-3-tokyo-hackathon/hackathon/gallery/24 · https://cerebralvalley.ai/e/gemini-3-seoul-hackathon/hackathon/gallery · https://blog.google/intl/ko-kr/company-news/inside-google/gemini-seoul-hackathon-second/ · 2026-02~04

### 2-7. OpenAI Codex Hackathon (2026-02-05) · 53개
- **openCortex (1위)**: 사람 연구자와 AI 에이전트가 **같은 자격의 사용자**로 아이디어를 올리고, 논문을 쓰고, 서로 리뷰하는 사회과학 플랫폼이다. 에이전트는 클릭 한 번으로 접속해 완전한 자율권을 받는다. PageRank 방식으로 순위를 매기며 작성자가 사람인지 기계인지 구분하지 않는다.
- **Evy (2위)**: 비개발자가 채팅만으로 임의의 도구 연동을 자동 생성하고 실행한다.
- 테제 관련성: **"에이전트를 1급 사용자로 설계한 앱(agent-native app)"이 1위를 했다.** 사람과 에이전트가 섞인 사회의 프로토타입이다.
- 출처: https://cerebralvalley.ai/e/openai-codex-hackathon/hackathon/gallery/20 · 2026-02

### 2-8. Agentic Orchestration (MongoDB, 2026-01) / Agentic Evolution London (2026-05)
- **SOGA: Smart Orchestration Glasses Agent (결선)**: 스마트 글래스에 음성으로 지시해 데스크톱의 에이전트(Scout, Analyzer, Implementer, Tester)를 띄우고, 진행 상황은 **글래스로 흘끗 확인**한다.
- **LiveRecall (런던 결선)**: 의료진이 **Ray-Ban Meta**나 폰 카메라로 낯선 의료 장비를 비추고 질문하면 근거 문서, 썸네일, 인용과 함께 답한다. 멀티에이전트 파이프라인은 비전 → 라우팅 → 검색 → 재정렬 → 답변 순서다.
- **contextScope (MongoDB 2025-10, 2위)**: agent-to-agent 컨텍스트 공유를 평가하고 관측하는 프레임워크다. A2A 주제로 입상한 사실상 유일한 사례다.
- 테제 관련성: 글래스는 **에이전트를 원격으로 지휘하고 결과를 흘끗 보는 장치**로 쓰였다. 둘 다 결선에 그쳤으므로 아직 결정적인 데모가 나오지 않았다는 뜻이다.
- 출처: https://cerebralvalley.ai/e/agentic-orchestration-hackathon/hackathon/gallery/69 · https://cerebralvalley.ai/e/mongo-db-london-hackathon/hackathon/gallery/22 · https://cerebralvalley.ai/e/mongoDB-hackathon/hackathon/gallery/45 · 2025-10~2026-05

### 2-9. 의료·전문직 도메인 수상작 (Abridge × Anthropic, Built with Opus 4.6/4.7, Claude Build Day)
- **HomeReady (Abridge 1위, 2026-07)**: 퇴원 전에 집이 안전한지 검증한다. **AloraAI (2위)**: "전화는 절대 Alora가 걸지 않는다. 간호사가 건다." Alora는 통화 준비를 돕고 실시간 통화를 듣는다.
- **CrossBeam (Opus 4.6 1위, 2026-02)**: 캘리포니아 ADU 허가 보완 요청을 처리한다(신청의 90% 이상이 보완 요청을 받는다). **Medkit (Opus 4.7 1위, 2026-04)**: 음성 우선 가상 클리닉으로, 실제 환자를 보기 전에 실수를 다 해보게 한다.
- **sim francisco (Claude Build Day 2위, 2026-06)**: 인구조사 데이터로 만든 SF 합성 인구 디지털 트윈에 여론조사를 하고 what-if를 돌린다.
- 테제 관련성: 결선과 수상 상위는 **실제 직업인의 하루를 바꾸는 작업**이 차지했다. 사람이 최종 행위자로 남는 설계(AloraAI)도 점수를 받는다.
- 출처: https://cerebralvalley.ai/e/abridge-hackathon/hackathon/gallery · https://cerebralvalley.ai/e/claude-code-hackathon/hackathon/gallery/54 · https://cerebralvalley.ai/e/built-with-4-7-hackathon/hackathon/gallery/28 · https://cerebralvalley.ai/e/claude-startups-build-day/hackathon/gallery/90 · 2026

### 2-10. GPT-5 Startup Hackathon (SF, 2025-08)
- **Gentoo (1위)**: Shopify 판매자용 서비스다. 실제 쇼핑 대화 수백만 건으로 **고객의 예측형 "digital clone"**을 만들어 마케팅 전략을 시뮬레이션하고, "Vibe Operation" 한 번으로 스토어에 바로 적용한다.
- **Archon (3위)**: 프롬프트로 컴퓨터를 조작하는 에이전트다.
- 테제 관련성: **사람(고객)을 대리하는 에이전트 집단을 상대로 먼저 실험**하는 패턴이다. 소비자 에이전트가 오기 전에 판매자 쪽에서 시뮬레이션부터 한다.
- 출처: https://cerebralvalley.ai/e/gpt5/hackathon/gallery/25 · 2025-08

---

## 3. CV 외 플랫폼

### 3-1. Gemini Live Agent Challenge (Google, Devpost) · 11,878명, 1,536개, 151개국 · 2026-05 발표
- **ORION (대상)**: 로봇 수술용 음성 코파일럿이다. 손을 씻은 상태를 유지한 채로 데이터, 표시, 시각 보조를 받는다.
- **drone-copilot (Live Agent)**: 조이스틱 대신 대화로 드론을 조종한다.
- **Moonwalk (UI Navigator)**: 음성으로 마우스와 키보드를 대신 조작한다(항공권 예약, 스프레드시트). 개인 선호를 기억한다.
- **Wand**: 손가락으로 가리키면서 말하는 브라우저 에이전트다.
- **VibeCat (가작)**: 화면을 계속 보다가 *먼저 말을 걸고*, 허락을 받은 뒤에 실행하는 macOS 동반자다.
- **Call My Parts (가작)**: 중고 부품을 구할 때 공급업체 웹을 탐색하고 **전화로 재고와 가격을 확인**한 뒤 순위를 매긴다.
- 테제 관련성: 카테고리 이름 자체가 "UI Navigator"였다. 대형 랩이 **에이전트가 사람용 UI를 조작하는 것**을 공식 트랙으로 만들었다. 수상작은 하드웨어나 수술처럼 **물리 세계와 손을 쓸 수 없는 상황**에 집중됐다.
- 출처: https://cloud.google.com/blog/topics/developers-practitioners/winners-and-highlights-of-the-gemini-live-agent-challenge · 2026-05

### 3-2. Microsoft Agent Academy Hackathon (Copilot Studio) · 2026-05-12~06-02, 06-18 발표, 상금 $12K
- **VendorGuard (Operative 1위, 전체 최고점)**: 계약서 PDF가 메일로 오면 오케스트레이터와 전문 에이전트 4개가 15개 규칙, 5개 차원으로 Red/Amber/Green 평가를 한다. 메일 수신부터 리포트까지 2분 미만이다.
- **SprintForge (Special Ops 1위)**: 회의록을 Microsoft Learn MCP와 Jira MCP로 연결해 스프린트 계획을 자동 생성한다(준비 시간 약 70% 감소 보고).
- **Cowork Autonomous ITSM (Cowork 1위)**: 테넌트를 바꾸는 모든 작업은 Teams 카드로 **원탭 승인**을 거친다. 스택 전체를 AI 에이전트가 만들고 유지했다.
- 테제 관련성: 엔터프라이즈 쪽에서는 이미 "이메일 → 에이전트 → 승인" 흐름이 표준이다. 심사 기준에 **Reliability & Safety 10%**가 명시돼 있다.
- 출처: https://microsoft.github.io/agent-academy/events/hackathon/ · https://devblogs.microsoft.com/powerplatform/agent-academy-hackathon-winners/ · 2026-06

### 3-3. UiPath AgentHack 2026 · 1,400명 등록, 333팀 제출, 결선 31팀 · 2026-07 결선, 2026-09 분석
- **Gauntlet (대상, $8K)**: 매 라운드 전략을 바꾸는 Red Coach 에이전트와 Blue 대상 에이전트를 대결시킨다. 성공한 공격은 OWASP LLM Top-10과 MITRE ATLAS 태그를 붙여 **영구 회귀 테스트**로 등록한다. 수정안은 사람이 승인한다.
- **FlakeWarden, SelfHeal QA 등**: 결정론적 로직과 생성형 추론을 분리했다. 실제 버그는 "고치지 않겠다"고 **거부하는 경로**가 있다.
- 주최 측 분석: "결정론과 생성 추론을 의도적으로 분리", "자율 행동에는 거부 경로를 짝지음", "코딩 에이전트로 오케스트레이션 자체를 빌드"가 수상작 공통 패턴이었다.
- 출처: https://www.uipath.com/community-blog/community-news/agenthack-2026-winning-architectures · 2026-09

### 3-4. ETHGlobal Open Agents (비동기, 2026-04-24~05-06) · 결선 7팀
- **Clan World: Ælder Whispers**: AI 에이전트 4개가 클랜 장로가 되어 협상하고, 물물교환하고, 배신하는 완전 온체인 전략 게임이다. 10틱마다 메모리가 지워지므로 에이전트가 무엇을 저장할지 *결정*해야 하고, 그래서 실력 차이가 측정 가능하다.
- **Slopstock**: 에이전트 주식거래소다. TEE에 봉인된 가중치를 가진 에이전트를 iNFT로 발행하고, 지분 100만 주로 쪼개 IPO하며, 추론 수익을 주주에게 배분한다. 실제로 돌아가는 에이전트 3개(감사, 러그풀 탐지, 오라클)가 있다.
- **LPlens**: 모든 수치에 VERIFIED/COMPUTED/ESTIMATED **정직성 라벨**을 붙인다.
- **Aegis402**: x402 결제 요청을 실행 전 감사와 실행 후 감사로 검사하는 가드 지갑이다. 에스크로와 보험으로 복구하며, 로컬 GPT-OSS-120B로 판단한다.
- **Common OS**: 에이전트마다 별도 VM, 지갑, ID를 주고 P2P(Gensyn AXL)로 통신하게 한다. 2.5D 오피스 화면에서 실시간으로 보여준다.
- 낙선자 회고(Michael Paonam): "나는 인프라를 만들었고, 그들은 *경험*을 만들었다." "결선작마다 '이건 처음 본다' 싶은 메커닉이 하나씩 있었다." "깊이가 넓이를 이긴다." "*지금 실제로 일하고 있는* 에이전트를 보여줘라."
- 출처: https://michaelpaonam.com/web3/2026/05/03/open-agents-hackathon-post-mortem.html · https://ethglobal.com/showcase/aegis402-o8x6z · https://ethglobal.com/showcase/common-os-ywv7j · https://ethglobal.com/showcase/slopstock-7zgd6 (검색 결과로 확인) · 2026-05

### 3-5. Global x402 Challenge (Algorand × GoPlausible) · 115개가 메인넷에 유료 엔드포인트 배포 · 2026-10-22 발표
- 상위 20개(500,000 ALGO)는 **메인넷에서 실제 정산된 USDC 거래량**으로 순위를 매겼다. 상위권은 대부분 **에이전트에게 파는 API**다. Moltworld(모델 게이트웨이), Finality(시장 정보), Tendril(초 단위 컴퓨트 대여), SiteLenz(웹사이트를 구조화된 JSON으로 변환), Callrack(도메인 9개에 걸친 기능 16개), pkgproof(npm 패키지 검증) 등이다.
- **Earnest**: x402에 조건부 결제를 더했다. 조건(구매자 수, 결과물 전달)을 충족할 때까지 에스크로에 보관한다.
- 테제 관련성: 결제 해커톤의 승자는 "에이전트가 쓰는 앱"이 아니라 **"에이전트가 사는 API"**였다. 소비자 대신 결제하고 협상하는 에이전트는 상위권에 없었다.
- 출처: https://algorand.co/blog/the-global-x402-challenge-winners-are-here · 2026-10

### 3-6. Coinbase CDP Agents in Action (2025-07)
- **Cash Drive (x402 + CDP Wallet 1위)**, **MCPay.fun (x402 1위)**, **Neuralabs (Akash 종합 1위)** 등이 수상했다. 분산 급여, 프로토콜 수수료 라우팅, 사용량 과금 마켓플레이스 같은 주제다.
- 테제 관련성: 2025년 중반에는 "에이전트 지갑"이 인프라 단계였다. 1년 뒤 x402 챌린지로 실거래량 경쟁까지 왔다.
- 출처: https://www.coinbase.com/developer-platform/discover/launches/agents-in-action-winners · 2025-07

### 3-7. 생성형 UI 해커톤 (AI Tinkerers "Generative UI Global Hackathon: Agentic Interfaces", Google DeepMind × CopilotKit, 2026-05-09, 여러 도시)
- 시애틀 출품작:
  - **Bedtime School Bridge**: 부모가 한 문장을 말하면 2.5세 아이용 iPad UI를 생성한다. 어조에 따라 모듈 구성이 바뀐다.
  - **DreamFlect**: 모델이 문장을 한 줄도 쓰지 않는다. 모든 화면이 A2UI 도구 호출로 만들어지고, 사용자가 클릭해야 에이전트 루프가 다음으로 넘어간다.
  - **Pair PM**: 채팅 없이 PRD를 쓰는 동안 흐름도와 리뷰 카드를 생성한다.
  - **PR Review Copilot**: PR 유형별로 다른 리뷰 UI를 만든다.
- 스택: A2UI v0.9, AG-UI 프로토콜, CopilotKit, MCP가 사실상 표준으로 굳고 있다.
- 순위: 쇼케이스 페이지에서 확인하지 못했다 `[unverified]`.
- 테제 관련성: 생성형 UI는 전문 해커톤까지 생길 만큼 툴체인이 성숙했다. 그런데 메인스트림 모델 해커톤에서 실제 genUI 출품은 3건 내외였고, 그중 하나(Agentic OS for a Phone)가 1위를 했다.
- 출처: https://seattle.aitinkerers.org/hackathons/h_x_n9rN2gpzc/showcase · 2026-05

### 3-8. A2A·협상 출품작 (순위 미확인 또는 미입상)
- **Barnraise (AWS Agents for Humans, 2026-10)**: 이웃한 비영리 단체(도서관, 푸드뱅크, 학교 등)마다 에이전트를 하나씩 둔다. 각 에이전트는 **자기 단체 데이터만** 알고, A2A로 협상해 유휴 자원(화요일 밴, 토요일 교실)을 교환한다. 양쪽 사람이 모두 승인해야 실행되며, 거래 원장이 쌓이면 연합 보조금 지원의 증거가 된다. 결과 발표 전이다 `[unverified 순위]`.
- **NEGO (SF Agentic Commerce x402 Hackathon, 2026-02)**: 구매자 에이전트와 판매자 에이전트가 5라운드 협상한다. 가격 결정은 규칙 기반이고 LLM은 말투만 생성한다. 협상 결과는 HTTP 402/200으로 표현하고 온체인에서 정산한다. 수상 여부는 미확인 `[unverified]`.
- **CV 갤러리의 협상 출품작**: Cadbury(Zero to Agent NYC, 사용자 대신 협상하는 마켓), Agorai(Gemini Paris, 구매자·판매자 에이전트 마켓), Gambit(AIEWF, 중고거래 자동 협상), Decision Sabha(벵갈루루, 이해관계자별 에이전트로 집단 의사결정), Swarm Saver(GPT-5 NYC, 보험 재협상 스웜) 등. **모두 미입상**이다. OpenEnv SF에는 협상 RL 환경이 5개 이상 출품됐다.
- 연구 맥락: **CalBench** (Stanford, 2026-05)는 개인 비서 에이전트들이 *비공개 캘린더*를 가진 채 일정을 조율하는 상황을 벤치마크했다. 이때 프라이버시 누출, 부담의 공정성, 과잉 비용을 측정한다. Llama 4 Maverick 같은 모델이 완료율만으로는 드러나지 않는 실패를 보였다.
- 테제 관련성: **"내 에이전트가 남의 에이전트와 협상한다"는 사용자 테제는 출품작은 있어도 수상 사례가 없는 영역이다.** 기존 출품작은 ① 구매자와 판매자 둘 다 내가 띄운 *가짜 상대* ② 규칙 기반 가격 + LLM 말투 ③ 프라이버시나 권한 위임 개념 부재가 공통점이다.
- 출처: https://github.com/kasbsquall/barnraise · https://github.com/karagozemin/NEGO · https://cerebralvalley.ai/e/zero-to-agent-nyc/hackathon/gallery · https://arxiv.org/html/2605.09823 · 2026

### 3-9. 한국 해커톤 (참고)
- **Gemini 3 서울 해커톤 (2026-02-28)**: 2-6 참조. 에이전트 보안(공격·방어 공진화)과 노인 사기 방지 가드 에이전트가 입상하거나 결선에 올랐다.
- **사내 AI 해커톤 붐 (2026)**: SK AI 해커톤(271팀, 대상은 SK이노베이션의 신소재 실험 설계 에이전트 "SynthOS"), LG헬로 사내 에이전트 해커톤(83개 과제), 요기요, KPR 등이 열렸다. 모두 **사내 업무 자동화 에이전트**다 `[검색 결과로만 확인, 본문 미열람]`.
- 출처: https://blog.google/intl/ko-kr/company-news/inside-google/gemini-seoul-hackathon-second/ · https://kpinews.kr/newsView/1065580661458988 · https://nwww.newsis.com/view/NISX20260513_0003627136 · 2026

---

## 4. 반복되는 콘셉트와 수상 데모 패턴

**포화되어 피해야 할 것**
1. 검증 프레임워크 자체 ("done means done", proof-of-done, evidence gate): Recursive 해커톤에서만 10개 이상 나왔고 전부 미입상이다. 검증은 산출물(PCB, 로봇 정비)을 증명하는 *수단*으로 쓸 때만 이겼다(Etch, AGI Factory).
2. "AI 직원 회사, 당신이 CEO", 에이전트 오피스 시각화: Astra HQ와 dot-dash가 이미 1위를 했고 Common OS, CORE GENESIS, Darwin, The A team이 뒤를 이었다. 신선도가 끝났다.
3. 에이전트 공유 메모리 / "shared brain": 출품 98건 이상, 수상 4건으로 수상률이 낮다.
4. 일반 의료 스크라이브, 트리아지, 클리닉 백오피스: 출품 253건 이상으로 가장 붐빈다. 도메인 전문가가 직접 만든 경우가 아니면 차별화가 어렵다.
5. 여행 플래너 멀티에이전트, 일반 RAG 챗봇, MCP 서버 래퍼.
6. 구매자·판매자 에이전트 협상 마켓(내가 띄운 두 봇끼리 흥정): 출품 여러 건, 수상 0건이다.

**수상 데모 패턴**
- **물리 세계나 실제 산출물로 끝난다**: PCB(Etch), CAD(CAD Sandboxes), 드론(drone-copilot), 수술(ORION), 공장 트윈(AGI Factory).
- **"이건 처음 본다" 메커닉이 하나 있다**: 메모리 와이프(Clan World), 정직성 라벨(LPlens), 모델 호출 0회로 재생하는 skill(rote), 취향 프로파일링(DefaultTaste).
- **측정 수치를 제시한다**: 66.5→92.8 / 위험 21→0(AGI Factory), 정확도 90.7%(FlakeWarden), 준비 시간 약 70% 감소(SprintForge).
- **이름을 댈 수 있는 사용자가 있고 만든 사람이 그 당사자다**: 현업 심장내과 의사(PostVisit), 수부외과 의사(Surgical Triage), 지질학자(Geo-ML), 할아버지를 둔 손주(SaralPhone).
- **실시간으로 "지금 일하고 있는" 장면을 보여준다**: 음성 실시간 응답, 화면을 즉석 생성하는 UI, 실제 거래량.
- **사람의 최종 승인이나 거부 경로가 구조에 들어 있다**: AloraAI, Cowork ITSM, Gauntlet, Barnraise.

---

## 시사점

- **A2A로 사용자를 대리하는 에이전트는 진짜 공백이다.** CV 출품작 3,363개 중 A2A는 약 5개, 협상은 약 20개였고 소비자 대리 협상의 수상 사례는 0건이다. 기존 시도는 "내가 띄운 두 봇의 흥정"이나 규칙 기반 가격에 LLM 말투를 입힌 수준이었다. **서로 다른 주인을 가진 에이전트**가 비공개 정보(캘린더, 예산, 선호)를 지키면서 합의하는 장면은 아직 아무도 제대로 보여주지 못했다. CalBench가 지적한 프라이버시 누출, 부담 공정성, 과잉 비용이 그대로 해자 후보다.
- **"앱 대신 에이전트 + 즉석 생성 UI"는 이긴 패턴이지만 아직 드물다.** Agentic OS for a Phone(1위), Centaur SRE(Llama NYC 3위), SaralPhone이 이 계열이다. 메인스트림 해커톤의 실제 genUI 출품은 한 자릿수다. **에이전트가 협상한 결과를 사람이 승인하는 순간에만 UI가 생성되는** 식으로 A2A와 결합하면 차별화된다.
- **Meta 고유 자산(글래스, WhatsApp, Muse, SAM)은 경쟁자에게 거의 안 쓰였다.** 글래스 출품은 18건에 수상 0건(결선 2건)이고, 그것도 대부분 "흘끗 보는 HUD"나 "카메라 Q&A" 수준이다. Ray-Ban Display 웹앱과 Device Access Toolkit 1.0(2026-09)이 막 열렸다. **"에이전트가 합의안을 들고 와서 글래스에 띄우면 사람은 고개를 끄덕여 승인한다"** 같은 장면은 Meta 툴링 점수(25%)와 데모 점수(25%)를 동시에 노릴 수 있다.
- **이전 Meta 심사는 "실존 사용자 + 모델 고유 능력 + 사회적 임팩트 + 실시간"을 보상했다.** OrgLens(사람의 digital twin과 먼저 대화)와 PromiseKeeper(화면을 보고 약속을 선제 실행)는 이번 테제의 전신이다. 같은 계보를 **두 사람 이상의 에이전트가 서로 대화하는 단계**로 확장하면 심사위원에게 연속성과 진보가 함께 보인다.
- **검증과 안전은 "기능"이 아니라 "증명 장면"으로 넣어야 한다.** 검증 프레임워크 단독 출품은 포화되어 지고 있다. 대신 Etch식으로 "합의가 실제 캘린더와 결제와 제약을 만족하는지 plain code로 검사하고, 측정할 수 없으면 정직하게 말한다", 또는 LPlens식 정직성 라벨을 협상 결과에 붙이면 기술 깊이 점수에 직결된다.
- **결제와 지갑은 인프라가 이미 레드오션이다.** x402 상위권은 전부 "에이전트에게 파는 API"였다. 소비자 대리 결제는 Aegis402 같은 *가드* 역할 외에는 비어 있다. 결제를 쓴다면 조건부 에스크로(Earnest식)처럼 "합의 → 조건 충족 → 정산"의 마지막 단계로만 짧게 보여주는 편이 낫다.
- **데모 설계 원칙**: ① 3분 대본을 먼저 쓰고 각 기능은 화면에 보이는 순간이 있을 때만 만든다(Open Agents 회고) ② "이건 처음 본다" 메커닉을 하나만 정해 깊게 판다 ③ 수치(성공률, 프라이버시 누출, 절약 시간)를 화면에 띄운다 ④ 가짜 상대가 아니라 **실제로 주인이 다른 2개 이상의 에이전트**가 라이브로 협상하게 한다.
- **피할 것**: AI 직원 회사, 에이전트 오피스 시각화, shared memory 레이어, 범용 의료 스크라이브, 여행 플래너, MCP 래퍼, 셀프 검증 프레임워크 단독 출품, 구매자·판매자 봇 흥정 마켓.
- **한국 쪽 기회**: 서울 수상작은 에이전트 보안과 노인 보호에 집중됐다. "부모님 대신 에이전트가 병원 예약, 통신사, 택배 상대 에이전트와 협상하고, 위험한 결제는 보류한다"처럼 **대리와 보호를 결합**하면 임팩트 점수(30%)와 연결된다. 다만 글로벌 심사위원이 이해할 수 있게 문제를 보편적으로 정의해야 한다.
