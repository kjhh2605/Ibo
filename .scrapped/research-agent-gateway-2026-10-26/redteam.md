# 레드팀 리뷰: "에이전트 프록시 + 투명성 원장" 원안

기준일 2026-10-26. 표기: [확인]=원문 직접 열람, [스니펫]=검색 결과로만 확인, [미확인]=확인 실패, [추론]=사실에서 끌어낸 판단, [제안]=권고. `S#`는 끝의 출처 목록(URL·날짜)이다.

## 0. 한 줄 판정

방향은 맞다. 차단 대신 통로를 내고, 제3자 프라이버시를 지키고, 사후 책임을 남기자는 것이다. 하지만 "프록시를 통해서만", "블록체인식 공개 원장", "프로토콜 자체가 해자"라는 세 기둥은 그대로 두면 무너진다. 살릴 것은 **협상에 필요한 최소 신호만 내주는 제3자 프라이버시 계층과, 양측이 검증하는 영수증**이다. 이를 Poppy/MCP 위 확장으로 얹어야 한다 [추론].

## 1. Steelman: 원안이 성공한다면 그 이유

**문제는 실재하고 커지고 있다.** Cloudflare에 따르면 올해 처음으로 인터넷 트래픽의 절반 이상이 비인간이었고, AI 에이전트의 일일 요청은 1년 새 1,700% 넘게 늘었다(S9·확인). Salesforce는 개인 에이전트가 콜센터 트래픽을 오히려 늘린다고 봤다. 에이전트는 "주문이 출고될 때까지 몇 시간마다 다시 전화"할 수 있다(S8·확인). 정부 서비스에서는 agentic flooding 잠재 사례 84건이 11개 관할에서 수집됐다(S29·확인). Amazon은 Muse를 "unauthorized AI agent"로 차단했고(S4·확인), Muse가 신원을 증명하지 않고 AI임도 밝히지 않았다는 점을 이유로 들었다(S5·확인). JPMorgan의 Dimon은 "There's a liability transfer"라며 외부 에이전트를 아무나 들이지 않겠다고 했다(S7·확인).

**차단은 답이 아니다.** 9th Circuit은 Amazon v. Perplexity에서 "It is the user who 'accesses' Amazon's computers"라고 판단해 가처분을 취소했다(S28·확인). 사용자 지시형 에이전트를 반해킹법으로 막기 어려워진 것이다. 공공 부문 연구도 수수료 같은 마찰 장치가 공평한 접근을 해친다고 지적한다(S29·확인). "막지 말고 길을 내라"는 출발점에는 근거가 있다.

**제3자 프라이버시는 아무도 맡지 않았다.** Muse는 사용자 주변 모든 사람의 페이지를 매시간 갱신하라는 지시를 받았고, 비사용자도 그 대상이었다(S38·확인, WIRED 원문은 미열람). Muse의 audit trail은 사용자 본인에게 보여주는 기록일 뿐이어서(S3·확인), 상대 기업이나 B가 검증할 기록은 없다 [추론]. Poppy 개요 페이지는 감사·영수증, 제3자 프라이버시, rate limit을 정의하지 않는다(S1·확인, 상세 명세 미열람). IETF Web Bot Auth 헌장은 에이전트 최종 사용자 인증, 의도 어휘, 봇 평판을 범위 밖에 둔다(S11·확인). MLCommons는 "A2A에서 프라이버시 제약을 협상하는 통일 프로토콜이 없다"고 적었다(S19·확인, 2차 보도). AgentLeak에서는 에이전트 간 메시지 누출률이 68.8%로 최종 출력(27.2%)보다 높았다(S18·확인).

**누가 돈을 내고 누가 먼저 쓰나 [추론].** 돈을 내는 쪽은 여러 사람의 데이터를 한 화면에 담는 앱의 운영사다. 그룹 일정, 병원·학원 예약, 코워킹, 커뮤니티, 마켓플레이스가 여기에 속한다. 이들은 세 가지 비용을 진다.
- 에이전트 트래픽 처리
- 제3자 정보가 에이전트 경로로 새면서 생기는 규제 책임
- AI 고지 의무: EU AI Act 제50조 챗봇 고지는 2026-08-02부터 적용됐고(S30·스니펫), 한국 AI 기본법은 2026-01-22 시행됐다(S31·스니펫). FTC는 AI로 만든 가짜 리뷰를 금지했다(S32·확인).

첫 도입자는 Amazon이나 은행이 아니다. 에이전트를 성장 채널로 원하지만 OAuth, 정책 엔진, 감사 체계를 직접 만들 여력이 없는 중견 SaaS다. 시기도 맞다. Muse 같은 소비자 에이전트가 9월에 나왔고(S3), 정문(front door) 규격은 아직 초안이라 확장할 자리가 열려 있다(S1, S2). 해자가 생긴다면 프로토콜이 아니라 그 위의 교차 기업 신뢰망(평판·데이터·레퍼런스 구현·감사 포맷)에서 생긴다(R3 참조) [추론].

## 2. Red Team

제목 괄호: 원안 심각도 → 완화 후 심각도.

### R1. 강제력 역설 (치명 → 중간)
**공격.** "computer-use는 막을 수 없다"와 "프록시를 통해서만 조작하게 한다"는 동시에 참일 수 없다. Perplexity는 선언한 크롤러가 막히자 일반 Chrome User-Agent로 바꾸고 IP·ASN을 돌려 가며 하루 300만~600만 건을 요청했다(S10·확인). Web Bot Auth 헌장은 "참여하지 않는 봇과 사람을 구별하는 일"을 범위에서 뺐다(S11·확인). 법으로 강제하기도 어렵다(S28). 정체를 밝히면 손해를 보는 구조라면 에이전트는 숨는다. Cloudflare 판매자들이 가장 많이 한 요청이 "charge agents, not humans"였다(S9·확인).

**정밀화 [추론].** 경우를 둘로 나눠야 한다.
- (a) 경계 밖 질의: A의 에이전트가 B의 데이터를 묻는 경우다. UI도 원래 B의 세부를 보여주지 않으므로 우회할 것이 없다.
- (b) 경계 안 위임: A가 화면에서 보는 B의 정보를 A의 에이전트가 가져가는 경우다(Muse 관계 페이지, S38). computer-use로 언제든 우회된다.

**완화 [제안].** 채찍보다 당근이다. 서명한 에이전트에게는 빠른 구조화 API(WebMCP는 DOM 조작보다 "more reliable and performant", S33·확인), 높은 한도, 예약 홀드 같은 쓰기 권한, 분쟁 때 증거가 될 영수증을 준다. 미서명 자동화에는 사람 수준 한도와 읽기만 허용한다. 대상은 적대적 봇이 아니라 이미 요청에 서명하는 OpenAI·Google·AWS(S9·확인)와 Muse 같은 대형 사업자다. 이들은 Amazon 사태 이후 정당한 통로가 필요해졌다 [추론].

**콘셉트 변화.** "유일한 관문"에서 "가장 유리한 차선(fast lane)"으로 바뀐다. (b)는 기술로 강제하지 않고 계약·정책 대상으로 범위를 명시한다.

### R2. free/busy와 차별성 부족 (높음 → 중간)
**공격.** Google Calendar에는 이미 "See only free/busy (hide details)"가 있고, 비공개 일정은 세부 없는 busy 블록으로 보인다(S16·확인). 원안의 "개인 일정이라 어렵다"는 여기에 범주 한 비트를 더한 수준이다 [추론]. PII 마스킹도 이미 흔하다. Lasso의 오픈소스 MCP Gateway는 Presidio 플러그인으로 PII를 가리고 요청·응답 로그를 남긴다(S15·확인).

**완화 [제안].** 차별점을 "가리기"가 아니라 "협상에 필요한 최소 신호"에 둔다. CalBench는 "privacy-preserving silence"가 공정한 부담 배분에 필요한 비용 정보를 빼앗는다고 보고했다(S17·확인). 그러니 일정 내용은 숨기고, 옮기는 비용 등급(쉬움/어려움/불가)과 대안 시간은 낸다. 공개 범위도 정적 ACL로 정하지 않는다. (요청 에이전트, 위임자, 목적, 남은 예산)마다 계산한다.

**콘셉트 변화.** "마스킹 프록시"가 "목적 한정 공개 계산기(disclosure calculus)"로 바뀐다.

### R3. 표준·거대 사업자 잠식과 "프로토콜 해자"라는 착각 (높음 → 중간)
**공격.** 이 자리는 빠르게 채워지고 있다.
- Poppy: 발견(`/.well-known/poppy.json`), OAuth 위임, 차단부터 전체 권한까지의 5단계 접근, 사람인지 AI인지 서로 밝히기를 정의한다(S1·확인). Meta·Sierra에 Genesys·Instinct·Shopify·Stripe·Walmart가 참여했고, Sierra는 "기업이 개인 에이전트가 하는 일을 볼 수 있게" 하겠다고 썼다(S2·확인).
- 신원: Web Bot Auth(S9, S11), RFC 9421 서명 기반 Visa TAP(S12·확인), 의도 선언까지 다루는 Skyfire KYA·Experian·Akamai(S14·스니펫), Okta Agent SSO와 MCP 공식 Enterprise-Managed Authorization 확장인 XAA(S13·확인).
- 트래픽 통제: Cloudflare Search/Agent/Training 토글(S9·확인).

원안의 처방은 이미 공론화됐다. 게이트웨이, 위임 사슬, 고위험 승인, append-only 로그와 서명 영수증을 갖추자는 기고가 10월에 나왔다(S6·확인). 무엇보다 Poppy는 Apache 2.0이고 누구나 구현할 수 있다(S1, S2·확인). 개방 표준은 정의상 해자가 아니다. 해커톤 프로토콜에는 Meta·Walmart·Stripe 연합을 이길 유통력도 없다 [추론].

**해자가 생길 수 있는 곳 [추론].**
- 교차 기업 평판: 네트워크 효과가 있지만 Experian KYA가 이미 '에이전트 신용평가' 자리를 노린다.
- 데이터: 업종별 정책과 누출 벤치마크. 작지만 현실적이다.
- 레퍼런스 구현: 해커톤 팀이 실제로 얻을 수 있는 유일한 자리다.
- 규제 대응: 영수증 포맷이 감사 증거로 채택되면 전환비용이 생긴다.

빈칸(감사·제3자 프라이버시·평판)도 Sierra/Meta가 몇 달 안에 확장으로 채울 수 있다 [추론].

**완화 [제안].** 경쟁 프로토콜을 만들지 않는다. Poppy/MCP용 '제3자 프라이버시·영수증 프로필'과 레퍼런스 게이트웨이를 만든다. 피치에서 해자는 주장하지 않거나 데이터·평판으로 좁힌다.

**콘셉트 변화.** "새 프로토콜"이 "주최사 표준의 빈칸을 채우는 확장"으로 바뀐다. Meta 정합성 서사에도 유리하다.

### R4. 블록체인 부적합 (치명: 개념 모순 → 낮음)
**공격.** 비트코인이 모든 거래를 공개하는 이유는 신뢰할 제3자 없이 이중 지불을 막기 위해서다. 프라이버시는 public key를 익명으로 두는 것으로 지킨다(S24·확인). 원안의 목표는 정반대로 "어느 에이전트가 누구를 대리해 무엇을 했나"를 귀속하는 것이다. 이를 공개하는 순간 원장이 프록시가 가리려던 정보를 퍼뜨린다.

EDPB 가이드라인(v2.0, 2026-07-07)의 요지는 이렇다(S25·확인).
- 해시도 개인정보다.
- 무염(unsalted) 해시는 공개 체인에 불충분하다.
- 체인에는 존재 증명 형태만 두고 데이터는 오프체인에 둔다.

운영 주체도 문제다. 기업이 운영하면 그냥 DB이고, 컨소시엄이면 거버넌스 비용이 들고, 퍼블릭이면 수수료·지연·삭제권 충돌이 생긴다 [추론].

**원하는 속성별로 더 단순한 수단 [제안].**
- 부인 방지: 요청 서명(RFC 9421, Web Bot Auth)과 사용자 위임 증명.
- 변조 탐지: Certificate Transparency의 append-only Merkle 로그와 inclusion/consistency proof(S26·확인).
- 사후 감사: SCITT(RFC 9943, 2026-06) 방식. Signed Statement를 등록하면 오프라인 검증이 가능한 Receipt가 나온다(S27·확인).
- 집계 투명성: 원장 전체가 아니라 운영사별 요청·거절·마스킹 건수 통계만 공개한다.
- 외부 앵커가 꼭 필요하면 Merkle root만 주기적으로 공개 타임스탬프에 걸어 둔다.

SCITT 문서 말대로 투명성은 부정을 막지 못하고 "책임지게" 할 뿐이다(S27·확인). 억지력은 원장 자체보다 기록에 묶인 결과(감속·차단·평판)에서 나온다.

**콘셉트 변화.** 피치에서 "블록체인"을 뺀다. 남는 것은 "transparency log + 양측 영수증"이다.

### R5. LLM을 보안 경계로 쓰는 위험 (치명 → 중간)
**공격.** 프록시는 Willison이 말한 lethal trifecta, 즉 비공개 데이터 접근, 신뢰할 수 없는 입력, 외부 통신을 모두 갖춘다. 그는 보안에서 95%는 "failing grade"라고 했다(S20·확인). LLM이 B의 원본 일정("정신과 상담")을 보고 "개인 일정"으로 바꿔 쓰는 구조라면, 적대적 에이전트가 주입으로 원문을 빼낼 수 있다. 같은 질의에 다른 답이 나오는 비결정성도 문제다. 반대로 과잉 마스킹하면 협상 자체가 불공정해지거나 불가능해진다(S17).

**완화 [제안].** CaMeL처럼 제어 흐름과 데이터 흐름을 분리해, 신뢰할 수 없는 데이터가 실행 경로를 바꾸지 못하게 한다. AgentDojo에서 CaMeL은 증명 가능한 보안 아래 77%를 해결했고, 무방어 시스템은 84%였다(S21·확인).
- 런타임 경계는 결정적 정책 엔진이 맡는다.
- LLM은 격리된 상태에서 요청을 구조화된 의도로 파싱하고, 정제된 결과를 문장으로 바꾸는 일만 한다.
- 레코드 분류(개인/업무, 이동 가능 여부)는 오프라인에서 LLM이 제안하고 사람이 확정한다.

**콘셉트 변화.** "AI 프록시"가 아니라 "LLM 앞단이 붙은 정책 엔진"이다. 데모의 핵심 증거는 주입 시도가 결정적으로 실패하는 장면이다.

### R6. 반복 질의 추론 공격 (높음 → 중간)
**공격.** 응답마다 가려도 질의를 반복하면 원본이 재구성된다. Dinur–Nissim은 잡음이 부족한 부분합 질의로 데이터베이스를 복원할 수 있음을 보였다(S22·스니펫). 공개된 일정표도 역스케줄링으로 비공개 작업 정보를 흘린다(S23·확인). "매주 화요일 15시 개인 일정" 같은 라벨과 반복 패턴만으로도 정기 치료 같은 민감한 사실을 추론할 수 있다 [추론]. 여러 신원으로 예산을 쪼개는 Sybil 공격도 가능하다.

**완화 [제안].** (요청자, 대상, 목적)별로 질의 예산을 두고, 시간 단위를 거칠게 묶고, 예산이 소진되면 거절한다. 핵심은 API 모양이다. "X시에 비었나?"에는 답하지 않는다. 교집합은 프록시 안에서 계산하고 "양쪽 모두 가능한 후보 3개"만 돌려준다. Sybil에는 검증된 신원(Web Bot Auth/KYA)에 묶은 에이전트 간 공통 한도로 대응한다.

**콘셉트 변화.** "질의 인터페이스"가 "협상 인터페이스"로 바뀐다.

### R7. 양면 시장 콜드스타트 (사업 관점 높음 → 중간)
**공격.** 기업은 지원하는 에이전트가 없어서, 에이전트는 지원하는 기업이 없어서 쓰지 않는다. Poppy조차 출발 시점에 Meta·Walmart·Shopify·Stripe를 묶어야 했다(S2) [추론].

**완화 [제안].** 한쪽만 써도 가치가 있어야 한다. 협조하는 에이전트가 하나도 없어도 기업은 에이전트 트래픽 가시화(서명/미서명 분류), 내부 감사용 영수증, 정책 시뮬레이션을 얻어야 한다. 에이전트 쪽은 새 SDK 없이 이미 쓰는 MCP/WebMCP/Poppy로 붙게 한다.

**콘셉트 변화.** 프로토콜보다 B2B 게이트웨이 제품이 먼저다.

### R8. 기업 도입 비용과 책임 소재 (중간 → 중간)
**공격.** Dimon은 외부 에이전트를 막으면서 자체 도구(Smart Cash 파일럿)를 키운다(S7·확인). 민감 데이터 앞에 제3자 프록시를 두면 보안 심사와 처리 위탁 계약이 따라온다. 프록시에서 새면 책임은 누가 지는가 [추론].

**완화 [제안].** 셀프호스트 오픈소스로 만들어 데이터가 밖으로 나가지 않게 한다(아래 Glimmer). 영수증에는 "사용자 위임 → 에이전트 운영사 → 기업 정책 결정"으로 이어지는 책임 사슬을 증거로 남긴다. Dimon이 말한 liability transfer를 증거로 명시하는 셈이다. 은행이 아니라 일정·예약 같은 저위험 업종부터 시작한다.

**콘셉트 변화.** 파는 것이 "보안"에서 "책임 소재의 명확성"으로 바뀐다.

### R9. 해커톤 적합성 (높음 → 중간)
**데모가 지루할 위험.** 인프라를 내고 떨어진 참가자는 회고에 "I built infrastructure. They built experiences."라고 썼고, 결선작에는 깊게 판 새 메커닉이 하나씩 있었다고 했다(S35·확인). Recursive Agents 해커톤(108개)에서도 Traceback, DoneDone, Unfoolable 같은 검증 프레임워크는 모두 입상하지 못했고 1위는 Etch였다(S36·확인). 따라서 대시보드가 아니라 사건을 보여준다 [제안]. 두 사람의 에이전트가 회의를 잡는다 → 악성 에이전트가 B의 일정을 캐려 한다 → 누출 미터는 0을 지키고 성사율은 유지된다 → 양측에 영수증이 도착한다. 같은 공격을 날것의 computer-use 에이전트에 걸어 "정신과 상담"이 그대로 노출되는 기준선도 나란히 보여준다.

**10일 범위를 넘을 위험.** 명세부터 평판망까지 다 만들 수는 없다. 업종 1개(일정), 목업 앱 1개, 에이전트 2개(정직/적대), 기존 라이브러리로 만든 Merkle 로그로 줄이고, 평판은 정적 목록으로 흉내만 낸다 [제안].

**Meta 도구가 억지스러울 위험.** 핵심 경계가 코드이면 LLM은 장식처럼 보인다. 자연스러운 배치는 다음과 같다.
- Muse Glimmer(Apache 2.0, 로컬·엣지 모델, S37·확인): 제3자 데이터를 클라우드로 보내지 않고 사내에서 분류한다.
- Muse Spark 1.3(parallel tool calling): 정직한 에이전트와 레드팀 에이전트를 맡는다. 추론·주입 공격을 자동으로 만들어 평가 하네스가 된다.
- structured output: 자연어 정책을 정책 DSL로 바꾸고 사람이 검토한다.

모순 하나에 주의한다. 분류를 호스팅 API에 맡기면 B의 일정이 외부로 나가 프라이버시 서사가 무너진다. 팀 장비에서 Glimmer가 돌아가는지는 [미확인]이다. SAM 3.1로 캡처 속 얼굴·문서를 가리는 기능은 억지스러워 보일 수 있어 선택 사항이다.

**심사 관점.** 개인 트랙은 "creativity, technical ambition, and whether it works"로 심사하고, 열람 시점에 최종 규정은 공개 전이었다(S34·확인). 배점(영향력 30/도구 25/구현 20/데모 25)은 로컬 hackathon-info.md 기준이며 다시 확인하지 않았다. 작동 여부를 보므로 누출률, 성사율, 예산 소진 시점 같은 실측치를 화면에 띄운다 [제안].

## 3. 대안 프레이밍 3개 [제안]

**F1. Agent Fast Lane(에이전트 우선 차선).** Poppy/MCP 호환 셀프호스트 게이트웨이다. 서명한 에이전트에게는 협상형 엔드포인트("후보 시간 찾기", "예약 홀드")와 높은 한도를 주고, 미서명 자동화에는 사람 수준 한도만 준다.
- 장점: 강제력 역설을 당근으로 푼다. 주최사 표준과 맞고 기업 혼자 써도 가치가 있다.
- 단점: Salesforce가 이미 기업 에이전트로 "front door"에서 맞으라는 처방을 판다(S8). 'Poppy-in-a-box'로 보일 위험도 있다.

**F2. 제3자 프라이버시 방화벽 + 합의 영수증.** 에이전트의 주인이 아닌 사람(B)을 지키는 데 집중한다. 결정적 공개 계산기, 질의 예산, 결과만 반환하는 협상 API, 양측 사람이 검증하는 SCITT식 영수증으로 구성한다.
- 장점: 원안의 예시와 가장 가깝고 공백이 가장 뚜렷하다(S11, S17, S18, S19). "누출 미터"라는 메커닉 하나로 측정까지 보여줄 수 있다.
- 단점: B를 지키는 비용을 누가 내는지, 즉 구매자가 모호하다. 잘못 보여주면 "프라이버시 필터"로 작아 보인다.

**F3. 앱 데이터 계층의 Cloudflare(에이전트 책임 원장 라이트).** 신원 검증, 운영사별 할당량과 평판, transparency log, 공개 집계 리포트로 구성한다.
- 장점: "무차별 사용 억제, 투명한 공개"라는 원안 직관에 가장 가깝고, 네트워크 효과 해자 후보다.
- 단점: Cloudflare, Akamai 같은 엣지 사업자가 선점했다(S9, S14). 평판망은 규모가 있어야 의미가 있고 데모가 대시보드라 지루하다.

**권고 [추론].** F2를 핵심 메커닉으로 삼고 F1의 차선 위에 포장한다. F3에서는 영수증과 로그만 최소한으로 가져온다.

## 4. 결론

**원안을 그대로 가면 안 되는 지점 Top 5**
1. "프록시를 통해서만" → 강제할 수 없다. 보상이 있는 우선 차선으로 바꾸고, 경계 안 위임은 범위 밖임을 명시한다.
2. 블록체인/공개 원장 → 귀속 정보를 공개하면 프라이버시와 정면으로 충돌한다(S24, S25). 서명, Merkle 로그, 양측 영수증, 집계 통계로 대체한다.
3. LLM이 직접 가려 쓰는 구조 → 주입과 비결정성에 취약하다. 경계는 결정적 정책 엔진이 맡고 LLM은 파싱·렌더링·오프라인 분류만 한다.
4. 질의형 API → 반복 질의로 원본이 복원된다. 결과만 반환하는 협상형 API와 질의 예산으로 바꾼다.
5. "프로토콜 해자" 주장과 독자 프로토콜 → Poppy/MCP/Web Bot Auth 위의 확장 프로필로 만든다. 해자 주장은 빼거나 데이터·평판으로 좁힌다.

**반드시 지켜야 할 원안의 핵심 Top 3**
1. 막지 말고 길을 낸다. 판례(S28), 공공정책 연구(S29), 트래픽 데이터(S9)가 이 방향을 뒷받침한다 [추론].
2. 제3자, 곧 에이전트의 주인이 아닌 사람의 프라이버시를 일급 대상으로 둔다. "개인 일정이라 어렵다" 수준으로 이유만 공개하는 발상은 현 표준들이 공통으로 비워 둔 칸이다(S1, S11, S19).
3. 에이전트 행위의 사후 책임성. Amazon이 요구한 "operate openly"(S5)와 SCITT의 "holds them accountable"(S27)을 영수증으로 구현한다.

**구현 전에 팀이 합의할 질문 [제안]**
- 시나리오 하나: 일정 조율, 예약, 리뷰 작성 중 무엇인가.
- 프록시 운영 주체: 앱 기업 셀프호스트, 제3자 SaaS, B 본인의 에이전트 중 누구인가.
- 다룰 범위: 경계 밖 질의만인가, 경계 안 위임까지인가.
- 영수증 공개 범위: 양측 사람, 기업, 공개 집계 중 어디까지인가.
- LLM 위치와 장비: Glimmer를 로컬로 돌릴 수 있는가.
- 성공 지표: 누출률, 성사율, 지연을 어떤 기준선과 비교하는가.

## 출처 (열람일 2026-10-26)
- S1. Personal Agent Protocol 개요 https://personalagentprotocol.org/ [확인]
- S2. Sierra 발표 https://sierra.ai/blog/introducing-personal-agent-protocol (2026-10-06) [확인]
- S3. Meta Muse 발표 https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ (2026-09-08) [확인]
- S4. TechCrunch https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ (2026-09-21) [확인]
- S5. TechSpot https://www.techspot.com/news/113981-amazon-blocked-meta-muse-agentic-ai-shopping-service.html (2026-09-25) [확인]
- S6. Infosecurity Magazine https://www.infosecurity-magazine.com/opinions/amazon-metas-ai-shopping-agent/ (2026-10-21) [확인]
- S7. Banking Dive https://www.bankingdive.com/news/jpmorgan-dimon-ai-agents-bank-customers-liability-transfer/832870/ (2026-10-13) [확인]
- S8. Salesforce https://www.salesforce.com/news/stories/personal-agents-to-drive-more-contact-center-traffic/ (2026-10-19) [확인]
- S9. Cloudflare https://blog.cloudflare.com/agentic-web/ (2026-09-30) [확인]
- S10. Cloudflare https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/ (2025-08-04) [확인]
- S11. IETF webbotauth 헌장 https://datatracker.ietf.org/wg/webbotauth/about/ [확인]
- S12. Visa TAP https://developer.visa.com/capabilities/trusted-agent-protocol/overview [확인]
- S13. Okta https://www.okta.com/newsroom/press-releases/okta-brings-first-class-identity-to-ai-agents-with-agent-sso/ (2026-08-24) [확인]
- S14. Skyfire KYA https://skyfire.xyz/skyfires-kya-protocol-is-now-the-identity-layer-for-experians-know-your-agent-framework/ · Experian–Akamai 보도(2026-05-15) [스니펫]
- S15. Lasso MCP Gateway https://github.com/lasso-security/mcp-gateway [확인]
- S16. Google Calendar 도움말 https://support.google.com/calendar/answer/37082 [확인]
- S17. CalBench https://arxiv.org/abs/2605.09823 (2026-05-10) [확인]
- S18. AgentLeak https://arxiv.org/abs/2602.11510 (2026-02-12, v3 2026-06-15) [확인]
- S19. MLCommons 분류체계 보도 https://ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents/ (2026-10-01) [확인]
- S20. Simon Willison https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ (2025-06-16) [확인]
- S21. CaMeL https://arxiv.org/abs/2503.18813 (2025-03-24) [확인]
- S22. Dinur & Nissim, PODS 2003 https://doi.org/10.1145/773153.773173 [스니펫]
- S23. AAAI 2023 https://ojs.aaai.org/index.php/AAAI/article/view/26412 [확인]
- S24. Bitcoin 백서 §2, §10 https://bitcoin.org/bitcoin.pdf (2008) [확인]
- S25. EDPB 02/2025 v2.0 https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf (2026-07-07) [확인]
- S26. RFC 9162 https://www.rfc-editor.org/rfc/rfc9162.html (2021-12) [확인]
- S27. RFC 9943 https://www.rfc-editor.org/rfc/rfc9943.html (2026-06) [확인]
- S28. 9th Cir. No. 26-1444 https://cdn.ca9.uscourts.gov/datastore/opinions/2026/08/04/26-1444.pdf (2026-08-04) [확인]
- S29. Agentic flooding https://arxiv.org/abs/2608.16603 (2026-08-17) [확인]
- S30. Houthoff https://www.houthoff.com/insights/news/ai-act-transparency-obligations-and-the-ai-omnibus-regulation/ [스니펫]
- S31. 법무법인 세종(신&김) https://shinkim.com/kor/media/newsletter/3114 [스니펫]
- S32. FTC https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials (2024-08-14) [확인]
- S33. Chrome WebMCP https://developer.chrome.com/blog/webmcp-epp (2026-02-10) [확인]
- S34. 행사 페이지 https://cerebralvalley.ai/e/meta-ai-developer-hackathon [확인]
- S35. Open Agents 회고 https://michaelpaonam.com/web3/2026/05/03/open-agents-hackathon-post-mortem.html (2026-05-03) [확인]
- S36. Recursive Agents 갤러리 https://cerebralvalley.ai/e/crusoe-recursive-agents-hackathon/hackathon/gallery.md (행사 2026-10-17) [확인]
- S37. Meta Model API 문서 https://dev.meta.ai/docs/overview [확인]
- S38. Gizmodo(WIRED 2026-10-03 보도 인용) https://gizmodo.com/metas-muse-is-collecting-information-on-everyone-in-your-life-2000821697 (2026-10-05) [확인]
- 미확인(본문 미사용): NYMag 기사의 'agent passport' 제안, 한겨레의 '네이버 외부 에이전트 차단' 보도.
