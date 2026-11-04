# 해커톤 적합성·Meta 도구 활용 검증: 에이전트 게이트웨이 + 투명성 원장

조사일: 2026-10-26 KST 저녁(개막 전) · 담당: 해커톤 적합성·Meta 도구 검증
표기: [확인] 원문 직접 열람 · [스니펫] 검색 요약만 확인 · [미확인] 확인 실패 · [추론]/[제안] 작성자 판단. S번호는 문서 끝 출처 목록을 가리킨다.

## 0. 결론 먼저

1. **공식 규정(Official Rules)은 아직 공개되지 않았다.** 두 행사 페이지 모두 "개막 전 공개 예정" 문구만 있다(S1·S3 [확인]). 그래서 데모 영상 길이, 오픈소스 의무, 사전 코드 범위, 비Meta 모델 허용 여부는 알 수 없다. 심사 배점(30/25/20/25), 개인 트랙 최대 4인, 크레딧 조건은 동의서와 Credit Terms 원문으로 확인했다(S2·S4 [확인]).
2. **"프록시" 아이디어의 상당 부분은 Meta·Sierra의 Personal Agent Protocol(Poppy)이 이미 다룬다.** 에이전트 신원(DPoP 세션 키), 메시지별 사람/AI 표기, client_id별 429 rate limit, 범위 동의, 실행 전 확인이 여기에 해당한다(S25 [확인]). 프록시 자체를 발명으로 내세우면 "Poppy와 뭐가 다르냐"는 질문에 막힌다 [추론].
3. **남은 빈칸은 두 가지다.** (a) 제3자 정보를 최소 공개로 바꾸는 규칙이 없다. Poppy의 `personal_data` 힌트는 요청한 사용자 *본인* 데이터 기준이다. (b) Poppy는 사용자 승인 기록 `approved_by`가 "works on trust"라고 스스로 적었다(S25 [확인]). 그래서 **"Poppy 호환 Company 게이트웨이 + 자체 확장 disclosure·receipts"**로 재정의하는 것을 제안한다 [제안].
4. **핵심 Meta 도구는 Muse Spark 1.3(Standard)과 로컬 Muse Glimmer 30B다.** Cookbook의 "로컬 Glimmer + 승인된 텍스트만 Spark로" 레시피를 기업 쪽 공개 방화벽으로 뒤집어 쓰는 구성이 가장 자연스럽다(S15 [확인]).
5. **`-contributor` 모델에 개인정보를 넣으면 약관 위반이다**(S9 [확인]). Muse Code 구독도 기본값이 Contributor다(S12 [확인]). 그러므로 Standard 모드만 쓴다.
6. **CV 글로벌 온라인 대회(Opus 4.6·4.7)의 1~3위는 모두 도메인 사용자 제품이었다.** 보안·프로토콜형 입상은 소규모 오프라인 대회에서만 나왔다(S37 [확인]). 영향력 30%를 얻으려면 업종, 실제로 새는 정보, 측정 수치를 함께 보여줘야 한다 [추론].

## 1. 확인된 규정·요건

| 항목 | 내용 | 상태 |
|---|---|---|
| 공식 규정 | 링크 없음, "will be published before the Hackathon begins" 문구만 | 미공개 (S1·S3 [확인]) |
| 트랙·팀 | Indie/Startup 중 1개. Indie는 "creativity, technical ambition, and whether it works"로 평가, 최대 4인. 대표자가 제출하며 팀원을 명시 | S1·S2 [확인] |
| 테마 | Build for Your World(직접 겪은 문제) / Push the Frontier(소프트웨어·로봇 등) | S1 [확인] |
| 작품 심사 | Impact 30%(수혜자, 실사용, problem statement 적합) · Meta AI Tooling 25%(창의성, 기본 연동 이상, 예상 밖 능력 발견) · Technical 20% · Demo 25%(라이브 안정성, 영상 품질) | S2 [확인] |
| 상금(Indie) | $150K/$100K/$75K/$50K/$25K, 보너스 최대 $50K(커뮤니티 투표 등, 11/10경 발표) | S2 [확인] |
| Meta 도구 필수 | '필수' 문구 없음. 오픈웨이트만으로도 참가 가능, 크레딧 사용 여부는 심사와 무관 | S4 [확인], 비Meta 모델 허용 여부 미공개 |
| 제출 | CV 포털 …/hackathon/submit | 주소 S2 [확인], 양식 [미확인] |
| 영상 길이 | "quality of the demo video" 문구만 | 미공개 |
| 오픈소스 | OSS를 포함하는 건 허용(라이선스 준수, 개선·확장 조건). 저장소 공개 의무는 미공개 | S2 [확인] |
| 사전 코드 | "original work product" 요구, 기간 제한 문구 없음 | 미공개 |
| IP | 소유권은 참가자. 주최 측·파트너에 영구·무상 이용권 부여 | S2 [확인] |
| 자격·심사위원 | 한국은 제외국 아님. 심사위원 명단 없음 | S2 [확인] |

**일정(KST):** 10/26 22:00 승인 통보 → 개막 생중계는 "Oct 26 12:00 PM (EST)"로 표기돼 있다. EDT라면 10/27 01:00, 표기 그대로 EST라면 02:00이다 [미확인]. 10/27~11/4 워크숍·Discord → **11/5 11:00 제출 마감**(미국 서머타임이 11/1에 끝나므로 EST 기준) → 11/9 결선(S1 [확인]).
**워크숍:** 공개된 세션은 Fireworks Sinan Ozdemir 워크숍 하나이고 날짜는 없다. MSL이 열흘간 실습 워크숍을 연다는 안내만 있다(S1·S22 [확인]). Discord 링크와 세션표는 참가자 전용 메일로 오는 것으로 보이며, 이 아이디어와 관련된 세션이 있는지는 [미확인]이다.

## 2. Meta Model API 실무 정보

- **접속:** `https://api.meta.ai/v1`, 키는 `MODEL_API_KEY`. OpenAI·Anthropic SDK 호환, Responses·Chat Completions·Messages API 지원(S5·S8 [확인]).
- **모델 ID:** `muse-spark-1.3`(권장)·`-1.2`·`-1.1`, 각 `-contributor` 변형, `muse-wonder-1.0`(preview), `muse-image-1.0`, `muse-voice-transcribe-1.0`, `sam-3.1`(S5·S6 [확인]).
- **기능:** Spark와 Wonder는 텍스트·이미지·영상·오디오·PDF 입력, 컨텍스트 1,048,576토큰, tool calling, structured output, 검색 grounding을 지원한다. 1.3은 오디오 품질 저하를 명시하고 오디오에는 1.2를 권한다(S6 [확인]). Cookbook에 JSON schema 출력, vision, 에이전트 루프, computer use 예제가 있다(S14 [확인]).
- **가격(1M 토큰당 입력/캐시/출력):** Spark $1.25/$0.15/$4.25. Contributor $0.10/$0.002/$0.20으로 약 95% 싸다(S31 [확인]). Wonder $4/$0.20/$20. Image $0.01/장, Voice $0.18/시간, SAM 이미지 1천 장 $2.50·영상 1천 프레임 $0.20. reasoning 토큰은 출력으로 과금된다(S7·S8 [확인]).
- **한도(팀 단위):** Spark·Wonder 3,000 RPM·4M TPM, SAM 3,000 RPM, Image 150 RPM, Voice 동시 256 스트림(S7 [확인]). 해커톤 규모에서는 문제가 되지 않는다.
- **가드 모델:** Model API에는 없다(S5 [확인]). Meta 오픈소스 PurpleLlama(10/12 갱신)에 LlamaFirewall, Llama Guard 4, Prompt Guard 2가 있다(S34 [확인]). 상대 에이전트 메시지에 숨은 인젝션 방어용이다.

**기업이 제3자 개인정보를 Meta API로 보내도 되는가**
- Standard는 학습에 쓰지 않는다. Contributor는 학습에 쓰며 "must not submit sensitive, confidential, or personal information"이라고 명시한다(ToS 10/9 갱신, S9 [확인]).
- Standard도 "as needed" 보존이고 기간은 명시돼 있지 않다. ZDR은 영업팀을 거쳐 조직 단위로만 켤 수 있다. 정책 위반으로 플래그된 데이터는 최대 2년 보관될 수 있다(S10·S11 [확인]).
- AUP는 근거 없는 민감 정보 추론, 생체정보로 특정인을 식별하는 일, AI 산출물을 사람이 쓴 것처럼 표시하는 일을 금지한다(S13 [확인]).
- [추론] 해커톤 계정에는 ZDR이 없다. 그러니 **"제3자 원본은 클라우드로 보내지 않는다"**를 설계 규칙으로 삼는다. 원본은 로컬 Glimmer와 정책 엔진만 보고, Spark는 "15:00 불가, 사유: 개인 일정" 같은 최소화된 사실만 받는다. 이 경계 자체가 데모의 핵심 장면이다. 데이터는 전부 합성으로 만든다.

## 3. 오픈웨이트

| | Muse Glimmer 30B | Muse Spark Open |
|---|---|---|
| 구조 | 30B dense, 텍스트+이미지 입력, 128K (S20 [확인]) | 816B MoE(42B active), 1M, 10/15 공개 (S21 [확인]) |
| 라이선스 | Apache 2.0 (S20 [확인]) | Muse Model License, "limited commercial terms" (S21 [확인]) |
| 위치 | HF `meta-models/Muse-Glimmer-30B`·`-GGUF`·`-ExecuTorch-PTE` (S20 [확인]) | HF `Muse-Spark-Open-816B-A42B`(+NVFP4), 다운로드 전 양식 작성 [스니펫] |
| Mac | Q4_K_M 16.8GB, 비전 포함 약 19~20GB 메모리. llama.cpp b10353 이상, `--jinja` 필요. **reasoning을 끌 수 없고** `reasoning_strength`로 깊이만 조절 (S20 [확인]) | M5 Ultra Mac Studio 2대(대당 512GB) 레시피뿐 (S14·S21 [확인]) |
| 호스팅 | Together·DeepInfra [스니펫], 가격 [미확인] | Baseten·Fireworks·Groq·Modal·Nebius·OpenRouter·Together. Fireworks $1.25/$0.15/$4.25 (S21 [확인]) |

[추론] "사내 추론" 논리는 Glimmer로 성립한다. 32GB 이상 Mac 한 대면 된다. 다만 reasoning 때문에 지연이 생기므로 정규식과 정책 엔진이 먼저 거르고, Glimmer는 사유를 추상화하는 문장 생성에만 쓴다. Spark Open은 파트너 크레딧이 있을 때 "기업 전용 배포" 서사에 쓸 선택지다.

## 4. Meta 도구별 활용 지도

| 도구 | 판정 | 역할과 이유 |
|---|---|---|
| Muse Spark 1.3 (Standard) | 필수 | ① 방문 개인 에이전트 ② 의도 분류·정책 판단(structured output) ③ 마스킹된 입력으로 최소 공개 응답 작성 ④ 데모의 '미등록 computer-use 에이전트'(Cookbook 레시피, S14 [확인]) |
| Muse Glimmer 30B (로컬) | 필수 | 제3자 원본을 보는 유일한 모델. "회의명 → 개인 일정" 같은 추상화를 맡는다. Cookbook의 egress 승인 + `egress.jsonl` 원장 패턴을 기업 쪽에 적용(S15 [확인]) |
| Muse Code | 선택(개발) | 감사 로그 레시피(append-only JSONL, `decision_source`, 실행 전 intent 기록, `idempotency_key`)가 원장 스키마의 출발점이다. 해시 체인과 서명은 없다(S16 [확인]). 구독 기본값이 Contributor이니 설정을 바꾸거나 실데이터를 넣지 않는다(S12 [확인]) |
| SAM 3.1 | 선택(자연스러움) | 리뷰 사진·첨부 이미지 속 제3자 얼굴·번호판·서류 마스킹. 명사구 하나당 요청 1회(S17 [확인]). 원안의 "리뷰 작성 에이전트"와 이어진다. 식별은 하지 않는다(AUP) |
| SAM 3.1로 앱 화면 마스킹 | 쓰지 말 것 | 화면은 기업이 렌더링하므로 DOM·API 단계에서 가리는 편이 정확하고 싸다 [추론] |
| Voice Transcribe | 선택(스트레치) | AI가 거는 전화(Muse 통화 베타 9/17, S30 [확인])를 전사해 같은 정책·원장으로 처리. 한국어 지원은 [스니펫], TTS 없음(S5 [확인]) |
| Muse Wonder (preview) | 선택(오프라인) | 레드팀 시나리오 생성, 자연어 정책 → 코드 변환. 단가가 Spark의 3~5배라 응답 경로에서는 제외 |
| LlamaFirewall·Prompt Guard 2 | 선택 | 인젝션 탐지. Muse 계열보다 점수 효과는 약할 수 있다 [추론] |
| Muse Image | 쓰지 말 것 | 생성형 인페인팅은 증거를 바꿔 투명성 서사와 충돌한다. 블러로 충분하다 [추론] |
| `-contributor`, 검색 grounding | 쓰지 말 것 | 개인정보 금지 조항, 이 아이디어와 무관한 비용 |

**"예상 밖 능력" 후보 [제안]:** 합성 일정·예약 데이터로 CalBench식 지표(누출률, 과잉 비용, 부담 공정성, S32 [확인])를 측정한다. 여기서 Glimmer와 Spark의 사유 추상화 품질을 비교해 "로컬 30B로 충분한 구간"을 수치로 제시한다.

## 5. Meta 생태계 정렬: 열흘 안에 되는 것과 안 되는 것

**Poppy 현황**(S25·S26 [확인]): 0.1(10/9), 0.2(10/24)가 공개됐고 0.3은 작성 중이며 breaking change가 많다. 라이선스는 Apache-2.0이다. 설계 파트너로 개인 에이전트 쪽 Meta·OpenAI·Instinct, 기업 쪽 Walmart·Target 등 21곳이 참여한다. Sierra는 레퍼런스 구현을 예고했다(S27 [확인]).
- **있는 것:** poppy.json 발견, OAuth와 회사 정의 scope, `scope_hints.personal_data`, DPoP, `author.type`, 429 `rate_limited`, client_id 허용·차단, 제외 업무, operations(정확한 조건 승인, 채널 간 단일 기록, 최대 1회 실행).
- **빈칸:** 제3자 최소 공개, 승인 증명, 양측이 검증할 수 있는 변조 탐지 로그. open topics에는 결제·푸시·버전·첨부·자가 호스팅만 있다.
- **기회:** 누구나 자기 도메인 이름으로 확장을 정의할 수 있다. `{팀도메인}/disclosure`·`/receipts`를 만들고 GitHub 이슈로 피드백한다 [제안].
- **바로 쓸 자산:** Company 구현 키트(skill, JSON Schema, validator)가 있다. 커뮤니티 데모 에이전트로 Poppy Demo Agent(Apache-2.0, validator와 interop harness 포함)와 Cliffside Retail Atlas(protocol inspector)가 있다. 대부분 v0.2 기준이다. 이들을 상대방으로 쓰면 "내가 띄운 봇 두 개" 데모라는 약점을 피할 수 있다.

[추론] Muse도 외부 행동을 Sentinel이 승인하고 감사 기록을 남긴다(S28 [확인]). 게이트웨이는 이를 기업 쪽에 거울처럼 놓는 구조라 설명하기 쉽다.

| 대상 | 열흘 안에 | 근거 |
|---|---|---|
| Poppy 스펙·키트·데모 에이전트 | 가능(버전 고정 필요) | S25 [확인] |
| 실제 Muse 앱이 게이트웨이를 호출 | 불가로 가정 | Muse 공개 API 없음, Muse의 Poppy 지원 공식 발표 없음 [미확인] |
| Meta AI Connectors(REST·MCP) | 신청만 가능 | developer preview, "selecting developers in waves", 승인 시점 미기재(S23 [확인]) |
| Meta AI WebMCP | 불확실 | developer preview 발표, 신청 절차 미기재(S22 [확인]) |
| Muse Connector Platform 등재 | 불가 | 기능·보안·법무 리뷰와 E2E 테스트, 기간 미기재(S24 [확인]) |
| WhatsApp Cloud API 테스트 | 가능 | 개발자 계정, 포트폴리오, 앱(S39 [확인]) |
| Meta Business Agent API | 사실상 불가 | "Meta-granted access" 필요(S39 [확인]) |

## 6. 이전 해커톤: 보안·인프라·프로토콜형

- **Meta LlamaCon(2025-05, 44개 제출):** 수상작 중 보안·프로토콜·개발 도구는 없다. 가장 가까운 것은 2위 Compliance Wizards(사기 탐지 + 음성)다(S38 [확인]).
- **CV 글로벌 온라인 대회:** Built with Opus 4.7(288개 중 9개 입상)과 4.6(227개 중 8개)의 1~3위는 의료 시뮬레이터, 전자기기 수리, 코딩 교육, ADU 인허가, 어린이 IDE, 심장내과 앱이었다(S37 [확인]).
- **보안·프로토콜형 입상(소규모 오프라인, S37 [확인]):** Gemini 3 서울 2위 saas(computer-use로 실제 브라우저를 공격하고 4-Agent 법정이 방어 규칙을 갱신, Live Arena 리더보드), MongoDB 2위 contextScope(A2A 컨텍스트 전달 측정·시각화), Mistral MCP 2위 S3 Butler(권한 가시화), GPT-6 Astra SF 1위 CAD Sandboxes(사람용 앱을 HTTP로 감싸 모델이 조작).
- **데모 패턴 [추론]:** 공격 → 방어 작동 → 차이를 수치·시각화로. 프로토콜형은 흐름 인스펙터 화면이 필수에 가깝다.

## 7. 비용 추정 (가정 명시)

가정: Spark 1.3 Standard, reasoning은 낮게 둔다.
- 게이트웨이 호출 1회: 입력 4K(캐시 2.5K) + 출력 1K ≈ $0.0065
- 클라이언트 턴 1회: 입력 6K(캐시 3K) + 출력 1K ≈ $0.0085
- 협상 시나리오 1회: 위 두 호출을 각 8회 ≈ $0.12
- 제3자 원본 처리: 로컬 Glimmer라 $0

| 항목 | 물량 | 비용 |
|---|---|---|
| 개발 | 4인×8일×30 시나리오 | ≈ $115 |
| 평가 | 단발 누출 프로브 300×4구성 + E2E 100×3 | ≈ $44 |
| 리허설·녹화 | 60 시나리오 | ≈ $7 |
| SAM / Voice | 500장×3개념 / 3시간 | ≈ $4 / $0.5 |
| Wonder(선택) | 입력 1M, 출력 0.3M | ≈ $10 |
| **합계(중간)** | | **≈ $180** |

- 범위: reasoning을 minimal로 두면 약 $70이다. 기본값이라 출력이 4K로 늘면 $450을 넘는다. 비용을 가장 크게 좌우하는 변수는 reasoning effort다 [추론].
- 크레딧: 팀원 각자 $150를 청구할 수 있어 최대 $600이다. 결제수단 등록이 필수이고, 소진 뒤에는 표준가로 청구된다. 적용은 청구 후 영업일 2일 이내이며 만료되지 않는다(S4 [확인]). 예산 상한 기능은 [미확인]. 데모 여유분 $50은 남겨 둔다 [제안].
- 32GB 이상 Mac이 없으면 Modal·Baseten 크레딧 대상인지 확인한다("select participants") [미확인].

## 8. 심사 배점별 득점 방법과 실점 위험

| 항목 | 득점 방법 [제안] | 실점 위험 |
|---|---|---|
| Impact 30% | 한 업종(예약형 소상공인, 학교 시설, 클리닉)의 구체적 장면. 근거로 Amazon의 9/20 Muse 차단("operate openly" 요구, S29 [확인])과 정부 서비스 agentic flooding 84건·11개 관할(S33 [확인])을 든다. 메시지는 "차단 대신 받아들이는 길" | 인프라라 수혜자가 추상적이다. "Poppy가 이미 한다"는 지적 |
| Meta Tooling 25% | 데이터 민감도로 Glimmer와 Spark의 경계를 나누고 원장에 기록. SAM 첨부 마스킹. 누출 벤치마크로 "로컬 30B면 충분" 수치 발견 | Spark를 분류기 하나로만 쓰면 basic integration. Contributor 사용이 드러나면 신뢰 상실 |
| Technical 20% | Poppy validator 통과, "model proposes, code disposes" 정책 엔진, Tessera Merkle 로그(S36 [확인]), SCITT(RFC 9943, S35 [확인])식 서명 영수증, 포함·일관성 증명 CLI | "블록체인"이 유행어로 들린다. 공개 체인은 메타데이터 노출과 삭제권 충돌이 있으므로 해시만 기록하고 주기적으로 앵커링한다고 설명 [제안] |
| Demo 25% | 분할 화면: 외부 에이전트 ↔ 게이트웨이 인스펙터(원본과 공개본 diff, 실시간으로 쌓이는 영수증). 미등록 스크래퍼는 429를 받고 poppy.json으로 안내된다. 마지막에 검증 CLI가 위조를 탐지 | 라이브 지연(Glimmer reasoning), API 장애. 영상 길이 미공개라 3분판과 1분판 준비 |

## 9. 외부 의존성 체크리스트 (열흘)

1. **1일차:** 승인 메일과 "know before you go" 메일에서 크레딧 Claim Form을 확보한다(S4 [확인]).
2. **크레딧 청구:** 팀원별 Model API 계정, 결제수단, Team ID를 준비한다. 마감은 11/5 11:00 KST다. 한국은 제한 지역이 아니지만 "Meta has enabled access" 조건이 붙어 있으니, 국내 카드 결제와 함께 첫 API 호출로 확인한다(S12 [확인]).
3. **공식 규정 공개 시:** 영상 길이, 오픈소스, 사전 코드, 비Meta 모델 허용 여부를 확인하고 계획을 조정한다.
4. **Discord·워크숍:** 일정을 받고 Poppy·보안 관련 세션이 있으면 질문을 준비한다.
5. **파트너 크레딧:** Baseten·Modal·Fireworks 대상 여부를 확인한다.
6. **Glimmer 준비:** GGUF(약 18~20GB) 다운로드, llama.cpp b10353 이상.
7. **Poppy 버전:** 0.2와 0.3 중 하나로 고정하고 데모 에이전트와 상호운용을 시험한다.
8. **(선택)** Connectors preview 신청, WhatsApp 테스트 번호. 일정을 걸지 않는다.
9. **Muse Code:** 쓴다면 Standard 모드로 설정한다.

## 10. 구현 전 팀 합의 사항 (Meta 도구 관점)

- **데이터 경계 규칙:** 제3자 원본은 로컬, Spark에는 최소화된 사실만.
- **노선:** Poppy 확장인가, 독자 프로토콜인가 → 확장 권장 [제안].
- **원장:** 기록할 것(해시, 정책 버전, 결정 주체, 공개 필드)과 기록하지 않을 것(원문), 삭제 방식(crypto-shredding).
- **데모:** 도메인 하나, 상대방 하나. 테마는 직접 겪는 예약 도메인이 있으면 Build for Your World, 아니면 Push the Frontier.
- **지표와 기준선:** 누출률, 과잉 공개 필드 수, 지연, 요청당 비용을 쓴다. 기준선은 게이트웨이 없음 / 정규식만 / 전체 구성.

## 출처 (별도 표기 없으면 열람일 2026-10-26)

- S1 https://cerebralvalley.ai/e/meta-ai-developer-hackathon [확인]
- S2 https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver (HTML 내장 본문) [확인]
- S3 https://dev.meta.ai/events/global-hackathon [확인]
- S4 Hackathon Credit Terms PDF(S2의 "Credit Terms" 링크, fbcdn 호스팅) [확인]
- S5 https://dev.meta.ai/docs/overview [확인]
- S6 https://dev.meta.ai/docs/models [확인]
- S7 https://dev.meta.ai/docs/pricing-rate-limits [확인]
- S8 https://dev.meta.ai/docs/quickstart [확인]
- S9 https://dev.meta.ai/legal/terms-of-service (2026-10-09 갱신) [확인]
- S10 https://dev.meta.ai/legal/commitments [확인]
- S11 https://dev.meta.ai/help/policies-and-privacy/zero-data-retention [확인]
- S12 https://dev.meta.ai/legal/geographic-use-policy (2026-10-12 갱신) [확인]
- S13 https://dev.meta.ai/legal/acceptable-use-policy [확인]
- S14 https://dev.meta.ai/docs/cookbook [확인]
- S15 https://dev.meta.ai/docs/cookbook/glimmer-api-agent [확인]
- S16 https://dev.meta.ai/docs/cookbook/audit-agent-sessions [확인]
- S17 https://dev.meta.ai/docs/cookbook/sam-api-basics · https://dev.meta.ai/models/sam-3-1 [확인]
- S18 https://dev.meta.ai/docs/cookbook/voice-api-fundamentals [확인] · 한국어 포함 25개 언어 목록 https://aiwiki.ai/wiki/muse_voice_transcribe [스니펫]
- S19 https://dev.meta.ai/products/muse-code [확인]
- S20 https://dev.meta.ai/docs/muse-glimmer/ · https://huggingface.co/meta-models/Muse-Glimmer-30B-GGUF · https://huggingface.co/meta-models [확인]
- S21 https://research.meta.ai/blog/muse-spark-open (2026-10-15) · https://fireworks.ai/models/fireworks/muse-spark-open [확인]
- S22 https://developers.meta.com/blog/meta-connect-recap/ (2026-09-24) [확인]
- S23 https://dev.meta.ai/products/connectors [확인]
- S24 https://platform.muse.ai/ (muse.ai/platform 리다이렉트) [확인]
- S25 https://personalagentprotocol.org/ (llms.txt, changelog, path-to-1, 0.3 spec, operations, demos, kit/company) [확인]
- S26 https://github.com/personal-agent-protocol/personal-agent-protocol (2026-10-14 생성) [확인]
- S27 https://sierra.ai/blog/introducing-personal-agent-protocol (2026-10-06) [확인]
- S28 https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ (2026-09-08) [확인]
- S29 https://www.thestar.com.my/tech/tech-news/2026/09/22/amazon-blocks-metas-muse-ai-agent-from-its-retail-site (Bloomberg, 2026-09-22) [확인]
- S30 https://techcrunch.com/2026/09/17/rival-ai-agents-instinct-and-metas-muse-both-add-the-ability-to-make-calls/ [확인]
- S31 https://techcrunch.com/2026/09/03/meta-is-paying-to-peek-at-how-you-use-their-latest-ai-model/ [확인]
- S32 https://arxiv.org/abs/2605.09823 (CalBench, 2026-05-10) [확인]
- S33 https://arxiv.org/abs/2608.16603 (2026-08-17) [확인]
- S34 https://github.com/meta-llama/PurpleLlama (2026-10-12 갱신) [확인] · https://arxiv.org/abs/2505.03574 [스니펫]
- S35 https://www.rfc-editor.org/rfc/rfc9943 (2026-06) [확인]
- S36 https://github.com/transparency-dev/tessera (2026-10-23 갱신) [확인] · https://blog.sigstore.dev/rekor-v2-alpha/ [스니펫]
- S37 CV 갤러리 md(https://cerebralvalley.ai/e/{slug}/hackathon/gallery.md): built-with-4-7-hackathon, claude-code-hackathon, gemini-3-seoul-hackathon/94, mongoDB-hackathon/45, mistral-mcp-hackathon/27, openai-gpt-6-astra-sf/17 [확인]
- S38 https://ai.meta.com/blog/llamacon-hackathon (2025-05-13) [확인]
- S39 https://developers.facebook.com/docs/whatsapp/cloud-api/get-started · https://developers.facebook.com/documentation/business-ai/get-started [확인]
