# 프라이버시·요청 안전 처리 기술 조사: 에이전트 프록시

조사일 2026-10-26. 표기: [확인]=원문을 직접 열어 확인, [스니펫]=검색 결과 요약으로만 확인, [미확인]=확인 실패, [추론]·[제안]=작성자 판단. 대괄호 숫자는 끝의 출처 번호다.

## 0. 결론 먼저

1. **"마스킹 프록시"라는 아이디어 자체는 이미 논문으로 나와 있다.** Abdelnabi 외의 dual firewall은 들어오는 메시지를 닫힌 스키마로 바꾸고(Language Converter), 나가는 정보를 과업에 필요한 수준으로 추상화한다(Data Abstraction). ConVerse 공격 864개에서 GPT-5의 privacy ASR을 84.68%→10.20%, security ASR을 60.39%→3.42%로 낮췄다 [1][확인]. 2026-08의 MNC는 공개 내용을 수신자·목적·전달·보존기간·로깅 범위에 묶는 typed protocol과 reference monitor를 제안했다 [12][확인]. 따라서 차별점은 마스킹이 아니라 다음 네 가지가 돼야 한다 [추론]. ① 사용자 쪽이 아닌 **서비스 쪽에서 다른 사용자들의 데이터**를 지키는 위치 ② 반복 질의로 쌓이는 누출(probing) 방어 ③ 결정 기록과 데이터 주체에 대한 투명성 ④ 실측 수치.
2. **Meta 모델에게 공개 여부를 맡기면 안 된다는 근거가 Meta 문서에 있다.** Muse Spark Safety & Preparedness Report(2026-05-14)에서 CIMemories violations@5는 Muse Spark 78.3%, GPT-5.4 5.1%였다. AgentDojo 인젝션 ASR(pass@1)은 Muse Spark 11.7%, Claude Opus 4.6 0.2%였다 [16][확인]. 보고서는 이 위험이 캘린더 예약처럼 정보를 외부로 내보내는 에이전트 환경에서 커진다고 적었다 [16][확인]. Muse Glimmer 페이지도 CIMemories 위반율 26.4, AgentDojo ASR 28.4를 공개한다 [17][확인].
3. **일정 조율에서 주로 새는 것은 제목이 아니라 구조다.** CalBench는 누출을 "상대의 슬롯 점유·이동 비용에 대한 믿음이 얼마나 움직였나"(VPS)로 잰다. 기본 실행에서 일정 제목 같은 의미 누출은 관찰되지 않았다 [10][확인]. 따라서 "OO 일정"을 "개인 일정"으로 바꾸는 것만으로는 핵심 위험을 다루지 못한다 [추론].
4. **원안 문장 "개인 일정이 있어 어렵다"는 free/busy보다 더 많이 드러낸다.** free/busy는 바쁘다는 사실만 알리지만, 원안은 일정 범주(개인/업무)까지 공개한다. 범주 공개는 기본값이 아니라 공개 등급의 한 단계로 둬야 한다 [추론].
5. **probing 방어의 정석은 "한 번만 정제하고 이후에는 결정적으로 답하기"다.** 질의마다 독립 노이즈를 넣으면 반복 질의로 평균을 내 걷어낼 수 있다 [14][18][19]. 요청자별 예산은 신원이 묶여 있어야 의미가 있다. 그런데 Web Bot Auth는 운영자 신원만 증명하고 권한은 다루지 않는다 [47][확인].
6. **Meta의 가드 도구는 2025년 Llama Protections가 최신이다.** Prompt Guard 2(86M/22M), Llama Guard 4(12B), LlamaFirewall이 공개 가중치로 나와 있다. Meta Model API 문서에는 moderation·가드 엔드포인트가 없다 [42][46][확인]. 두 가드 모델의 평가 언어에는 한국어가 없다 [43][44][확인].
7. **SAM 3.1에 "face", "license plate" 같은 명사구를 주면 마스크가 나온다.** 텍스트 프롬프트로 box와 mask를 받고 영상에서도 추적한다 [52][확인]. 다만 공식 문서에 프라이버시 마스킹 용례나 정확도 수치는 없다. 사진 속 주소 라벨 같은 글자는 OCR과 Presidio가 따로 처리해야 한다 [추론].

## 1. 연구·도구 요약

### 1.1 맥락적 무결성(CI)과 에이전트 간 프라이버시

| 연구(날짜) | 방법 | 핵심 수치 | 코드·데이터 | 해커톤 재사용 |
|---|---|---|---|---|
| ConfAIde (2023-10, ICLR'24) [5] | CI 이론 기반 단계별 질의 | 사람이 공개하지 않을 맥락에서 GPT-4 39%, ChatGPT 57% 공개 [확인] | — | 개념 인용 |
| AirGapAgent (2024-05, CCS'24, Google) [3] | minimizer가 제3자 질문을 보지 않은 채 과업에 필요한 필드만 골라 대화 에이전트에 넘김 | 단일 hijacking 공격에 Gemini Ultra 보호율 94%→45%, AirGap 96.7%(유용성 98.2→87.3%) [확인] | 공개 코드 없음 | **구조 차용** |
| PrivacyLens (2024-09, NeurIPS'24 D&B) [4] | seed→vignette→trajectory 확장 후 최종 행동의 누출 판정 | 프라이버시 강화 프롬프트에서도 GPT-4 25.68%, Llama-3-70B 38.69% 누출 [확인] | MIT, seed 493개, HF `SALT-NLP/PrivacyLens`, 판정기 Mistral-7B(GPU) [확인] | 판정기 재사용 |
| AgentDAM (2025-03, Meta FAIR) [6] | 웹 에이전트의 data minimization(GitLab·쇼핑·Reddit 복제) | 주요 모델이 불필요한 민감정보를 사용 [스니펫] | CC-BY-NC, WebArena 필요 [확인] | 환경 구축 비용이 커서 비추천 |
| CIMemories (2025-11, Meta FAIR) [7] | 속성 100개 이상의 합성 프로필 × 과업 | 최대 69% 위반. GPT-5 위반이 과업 1→40개에서 0.1→9.6%, 같은 프롬프트 5회 실행 시 25.1% [확인] | `facebookresearch/CIMemories` [스니펫] | **violations@k 지표 차용** |
| ConVerse (2025-11, EACL'26 Findings[스니펫]) [2] | 3개 도메인, 페르소나 12개, 다회 A2A 대화에 공격 삽입 | 공격 864개(프라이버시 611, 보안 253). 성공률은 프라이버시 최대 88%, 보안 60%. 강한 모델이 더 샌다 [확인] | MIT. 전체 실행 비용은 "수천 달러" [확인] | **1도메인만 부분 실행** |
| Firewalls (2025-02, v7 2026-06, TMLR'26) [1] | dual firewall. 규칙은 benign/attack 대화에서 LLM이 학습(54~203줄) | 0절 수치. 남은 실패는 granularity 오조정, 필드 중첩, 보험 선호 조작. 결합 공개에 대한 형식적 추론은 없다고 명시 [확인] | MIT, `--apply_data_firewall` [확인] | **가장 가까운 선행 구현, 비교군** |
| MAGPIE (2025-10) [8] | 비적대 다자 협업 200과업, 민감정보가 과업에 필요 | 공유하지 말라고 지시해도 Gemini 2.5 Pro 50.7%, GPT-5 35.1% 누출 [확인] | 링크 없음 | 지표 참고 |
| Sum Leaks More (2025-09) [9] | 무해한 응답들을 조합해 민감정보 복원(compositional leakage) | CoT 방어 차단 39%, ToM 최대 97%(유용성 저하), CoDef balanced 79.8% [확인] | GitHub 공개 [확인] | probing 시나리오 참고 |
| CalBench (2026-05, v3 06-05, Stanford) [10] | 에이전트 5, 미팅 5, 슬롯 16, 과업 90, CP-SAT oracle | 성공률 76.79~93.33%(Llama 4 Maverick 77.04%), VPS 3.49~19.18. 침묵이 비용·공정성을 해침 [확인] | 코드 링크 있음(내용 미확인) | **일정 도메인 지표 차용** |
| AgentLeak (2026-02, v3 06) [11] | 다중 에이전트 내부 채널 7종 계측, 1,000 시나리오 | 최종 출력 27.2% vs 에이전트 간 메시지 68.8%. 출력만 감사하면 위반의 41.7%를 놓침 [확인] | GitHub 공개 [확인] | 로그 감사 근거 |
| MNC (2026-08) [12] | 후보 공개안에서 과업에 충분한 것을 골라 범위(scope)에 결속. 반복 공개의 추론 위험 추적 | probing·장기 설정에서 기존 방어가 추가 추론 신호를 노출 [확인] | 링크 없음 | **프로토콜 선행 사례** |
| MLCommons Agent Privacy Risk Taxonomy v0.1 (2026-10-01) [15] | 5개 영역 위험 분류 | R3.1 "A2A 프라이버시 제약을 협상하는 통일 프로토콜이 없다", R1.7 컨텍스트 과잉 공유, R4.2 consent fatigue [확인: 2차 기사] | 원문 미확인 | 문제 정의 인용 |

Muse Spark 수치에 대해 보고서는 위반율이 높은 이유 일부를 "더 많이 공유해 completeness도 높기 때문"(72.7%, GPT-5.4는 42.1%)으로 설명한다. 시스템 가드레일 없이 모델 단독으로 잰 값이다 [16][확인]. Glimmer의 26.4와 지표 정의가 같은지는 확인하지 못했다 [미확인].

### 1.2 반복 질의·추론·집계 공격(probing / differencing)

- **Dinur–Nissim(2003)**: 부분합 질의 O(n)개에 √n보다 작은 오차로 답하면 비밀 비트 대부분이 복원된다. Dwork–Roth는 이를 "너무 많은 질문에 너무 정확히 답하면 프라이버시는 반드시 무너진다"로 요약했다 [18][확인].
- **Diffix 공격(USENIX Sec 2019)**: 데이터 의존 "sticky" 노이즈를 넣었는데도 사용자당 최대 32회 질의로 55.4% 사용자의 속성을 91.7% 정확도로 추론했다 [19][스니펫].
- **분산 일정 조율의 프라이버시 손실(Wallace·Freuder, Franzin 외 2004)**: 비공개 정보를 명시하지 않은 제안·수락·거절만으로도 상대 일정의 가능성을 좁힐 수 있다 [20][스니펫].
- **RootGuard(2026-05, v3 10-12)**: 응답마다 독립 노이즈를 넣으면 공격자가 t턴을 결합(MAP)해 복원한다. 근원 값을 한 번만 정제하고 이후 출력을 결정적으로 계산하면 보장이 턴 수와 무관해진다(후처리 정리). NHANES 템플릿에서 오차가 2.6배 줄었다 [14][확인].
- **PlanTwin(2026-03)**: 원 환경을 스키마 제약된 비식별 "디지털 트윈"으로 투영한다. 로컬 gatekeeper가 누적 disclosure budget을 강제한다. 60과업에서 민감 항목 비공개율 1.0, 유용성 손실 2.2% 미만 [13][확인].
- **암호학 접근**: Kiss·Schick·Schneider(SECRYPT 2019)는 2PC로 참가자·서버·관리자 누구도 가용성을 모르게 Doodle형 일정을 잡는다 [21][확인]. 다자 PSI SoK(S&P 2024)도 있다 [22][확인]. 10일 안에 하기는 어렵다 [추론].
- **free/busy에 차분 프라이버시나 k-익명성을 적용한 공개 사례는 찾지 못했다** [미확인]. 가장 가까운 것이 위의 누적 예산 방식이다.

### 1.3 기존 기준선: free/busy 공유 수준

| 시스템 | 외부에 보이는 것 |
|---|---|
| Google Calendar [23] | "See only free/busy (hide details)"부터 "Make changes and manage sharing"까지 5단계. 비공개이면서 Busy인 일정은 이름 없는 블록으로 보인다 [확인]. 관리자는 외부 공유 상한을 free/busy로 제한할 수 있다 [스니펫] |
| Outlook [24] | "Can view when I'm busy" / "titles and locations" / "all details" [확인] |
| Graph getSchedule [25] | availabilityView 코드(free/tentative/busy/OOF), 슬롯 5~1440분. 예시 응답에 subject·location이 들어 있다. free/busy API도 권한에 따라 제목을 준다 [확인] |
| CalDAV [26] | `CALDAV:read-free-busy` 권한만 주면 상세 없이 바쁜 시간을 공유한다. RFC 5545 FBTYPE은 FREE, BUSY, BUSY-UNAVAILABLE, BUSY-TENTATIVE [확인] |
| Calendly [27] | 예약자는 빈 시간만 본다 [스니펫: 커뮤니티 답변] |
| Cal.com [28] | Google Free/Busy API만 쓰고 제목·장소에 접근하지 않는다 [확인] |
| Blockit [29] | 공식 글은 "두 사용자의 캘린더를 보고 즉시 일정을 잡는다"고만 한다. 상대 에이전트에 무엇을 공개하는지는 설명하지 않는다 [확인] |

**원안 응답과 free/busy의 차이** [추론]
- free/busy가 못 하는 것: (a) 이동 가능성(soft/hard)과 대안 제시 (b) 요청자·목적별 해상도 조절 (c) 다자 조율에서 개인별 가용성 대신 교집합만 공개 (d) 요청자별 누적 예산 (e) 데이터 주체에게 "누가 무엇을 물었나" 보고.
- free/busy보다 나빠질 수 있는 것: 범주 라벨 공개, 자연어 응답의 부수 누출, 같은 질문에 매번 다르게 답하는 비결정성.
- free/busy 자체의 약점: 슬롯 지도 전체를 첫 응답에 넘긴다. VPS로 보면 첫 질의에서 누출이 최대다.

## 2. 들어오는 요청의 안전 처리

### 2.1 원칙
- **NCSC(2025-12-08)**: LLM은 데이터와 지시를 구분하지 않는 "inherently confusable deputy"다. 방어의 중심은 "deterministic (non-LLM) safeguards"여야 한다. 남는 위험을 감당할 수 없다면 LLM이 맞지 않는 용도라고 했다 [30][확인].
- **Meta Agents Rule of Two(2025-10-31)**: 한 세션에서 [A] 신뢰할 수 없는 입력 처리, [B] 민감 시스템·개인 데이터 접근, [C] 상태 변경·외부 통신 중 둘까지만 허용한다. 셋이 다 필요하면 자율 실행하지 말고 사람 승인 같은 감독을 붙인다. least-privilege의 대체가 아니라 보완이라고 명시했다 [31][확인]. **원안의 프록시는 외부 요청을 읽고(A), 다른 사용자 일정을 보고(B), 외부로 답한다(C). LLM 하나로 만들면 Meta 자신의 원칙을 어기게 된다** [추론].
- **적응형 공격**: "The Attacker Moves Second"(2025-10)는 방어 12개를 대부분 90% 이상의 성공률로 우회했다 [36][스니펫]. 탐지기는 신호로만 쓰고 경계로 쓰지 않는다.

### 2.2 구조 패턴
- **Dual LLM(2023-04-25)**: privileged LLM은 신뢰 입력만, quarantined LLM은 도구 없이 비신뢰 콘텐츠만 다룬다. LLM이 아닌 controller가 `$VAR1` 같은 참조로 둘을 중계한다 [32][확인].
- **Design Patterns(2025-06)**: Action-Selector, Plan-Then-Execute, LLM Map-Reduce, Dual LLM, Code-Then-Execute, Context-Minimization [33][확인].
- **CaMeL(Google DeepMind, 2025-03, v2 06)**: 신뢰 질의에서 제어·데이터 흐름을 추출하고 capability로 정책을 강제한다. AgentDojo에서 증명 가능한 보안 아래 77%를 해결했다(무방어 84%). 코드 공개 [34][확인].
- **FIDES(Microsoft, 2025-05)**: 기밀성·무결성 라벨을 추적하고 정책을 결정적으로 강제하는 IFC 플래너 [35][확인].
- **Muse의 공개 설계**: Sentinel이 외부로 나가는 모든 행동을 승인하고, 자격증명은 모델이 볼 수 없는 저장소에 둔다 [37][확인]. The Batch는 여기에 몇 가지를 더 전했다 [38][확인: 2차 보도]. 분류기 앙상블이 격리 셀 밖에서 돈다. 사용자 데이터를 읽은 프로세스는 승인 없이 외부로 나가지 못한다. 승인은 커넥터·목적 단위로 묶인다. 분류기 정확도는 공개되지 않았다.

### 2.3 결정적 정책 엔진
- **Cedar**: forbid가 하나라도 참이면 Deny, 그다음 permit이 있으면 Allow, 둘 다 없으면 Deny다. 오류가 난 정책은 건너뛴다 [39][확인].
- **OPA**: Rego 언어. 결정과 집행을 분리하고 구조화된 결정을 돌려준다. CNCF Graduated, Apache-2.0 [40][확인].
- **AWS AgentCore Policy**: 게이트웨이에서 모든 도구 호출을 가로채 에이전트 코드 밖에서 Cedar로 결정적으로 평가한다. 세션 이력을 보는 temporal policy(승인 후에만 허용, N회 초과 차단, 누적 예산)와 감사 로그를 지원한다 [41][확인]. 해커톤 프록시의 참고 아키텍처로 쓸 만하다 [추론].

### 2.4 Meta가 제공하는 가드 도구(2026-10 기준)

| 도구 | 내용 | 한계 |
|---|---|---|
| Prompt Guard 2 86M/22M [43] | injection·jailbreak 이진 분류, 입력 512토큰(길면 분할). 86M 기준 영어 AUC 0.998, A100에서 92.4ms. AgentDojo에서 유용성 3% 손실로 공격 81.2% 차단 [확인] | 평가 언어는 영·프·독·힌디·이·포·스·태국어로 **한국어 미평가**. 적응형 공격에 취약하다고 명시 [확인] |
| Llama Guard 4 12B [44] | MLCommons S1–S14 분류(S7 Privacy), 텍스트와 여러 이미지 입력 [확인] | 같은 언어 범위. 인젝션에 취약할 수 있어 Prompt Guard 병행을 권고 [확인] |
| LlamaFirewall [45] | PromptGuard 2, AlignmentCheck, CodeShield, 정규식·커스텀 스캐너 조합. `pip install llamafirewall`. AlignmentCheck는 Together API 키 필요 [확인] | 2025-05 이후 업데이트는 확인하지 못함 |
| Meta Model API [46] | Muse Spark/Wonder/Image/Voice, SAM 3.1. **moderation·가드 엔드포인트 문서 없음** [확인]. Llama Protections 페이지는 Llama Guard 4가 "Llama API"의 /moderations로 제공된다고 적었지만 현재 API 레퍼런스에는 없다 [42][확인] | 가드는 Modal·Baseten에 직접 띄워야 한다 [추론] |
| Muse 계열 가드 | 검색 범위에서 공개된 것 없음. Sentinel은 비공개 내부 시스템 [37][38] | — |

## 3. PII·민감정보 탐지

- **Presidio** [49]: microsoft.github.io/presidio가 dataprivacystack.org로 옮겨졌고, 새 페이지는 "커뮤니티 소유 프로젝트로 전환됐다"고 적었다. Analyzer(NER·정규식·체크섬·문맥어), Anonymizer, Image Redactor, Structured로 구성되고, "모든 민감정보를 찾는다는 보장은 없다"고 명시한다 [확인]. 한국 엔티티 KR_RRN, KR_FRN, KR_DRIVER_LICENSE, KR_PASSPORT, KR_BRN을 지원하고, 전화번호는 `supported_regions`로 확장한다 [확인]. 이름·주소는 한국어 NER 엔진을 붙여야 한다 [추론]. spaCy에는 개체 인식을 포함한 `ko_core_news_sm/md/lg`가 있다 [51][확인, 세부 라벨은 미확인].
- **Image Redactor** [49]: OCR(기본 Tesseract, 또는 Azure Document Intelligence)로 글자를 찾고 PII 영역을 색으로 덮는다. beta이며 운영용이 아니라고 적혀 있다 [확인].
- **한국어 PII 자료** [50]: KDPII(대화형 한국어 PII 비식별 데이터셋, IEEE Access 2024)에서 기존 모델들은 한국 특유 PII에 약했다 [스니펫]. HF 커뮤니티 모델(`id4thomas/ko-pii-detector-ax-crf` 등, F1은 자체 보고)과 PyPI의 `korean-pii`, `kpii`가 있다 [스니펫]. 라이선스와 성능은 직접 검증해야 한다.
- **SAM 3.1** [52]: Meta Model API 모델 ID는 `sam-3.1`이다. 짧은 명사구를 주면 일치하는 모든 객체의 box와 mask를 돌려주고, 영상에서는 정체성을 유지하며 추적한다. 가격은 이미지 1k장당 $2.50, 영상 1k프레임당 $0.20 [확인]. 오픈 가중치는 텍스트·점·박스·마스크 프롬프트를 받는다. 3.1(2026-03-27)은 Object Multiplex로 객체 128개 기준 약 7배 빠르다 [확인]. SAM License의 사용 제한은 무역 통제·ITAR·역공학 금지 등이고, 얼굴·생체 인식에 관한 조항은 찾지 못했다 [확인]. 공식 문서에는 프라이버시 마스킹 용례와 정확도가 없다 [확인]. DataCamp 튜토리얼이 "faces", "license plates" 마스크로 블러 필터를 만든다 [53][스니펫]. Cookbook에 "SAM API basics" 레시피가 있다 [46][확인].

## 4. 설계 시사점 [제안]

### 4.1 공개 등급(Disclosure Level)

| 등급 | 외부 에이전트가 받는 것 | 기본 적용 대상 |
|---|---|---|
| D0 | 응답 없음, 사람에게 넘김 | 신원 미확인, 예산 소진 |
| D1 | 제안된 시각 하나에 대한 가/불가 | 신원이 확인된 외부 |
| D2 | 요청 기간 내 후보 k개(전체 지도 아님) | **기본값** |
| D3 | D2 + "조정하면 가능"(소유자 승인 필요) | 파트너·기존 고객 |
| D4 | D3 + 범주("개인 일정", "이동 중") | 데이터 주체가 opt-in |
| D5 | 제목·장소·참석자 | 본인·명시 위임자만, 외부 불가 |

등급은 네 가지 입력으로 정한다. 요청 주체의 신원과 관계, 닫힌 어휘로 선언한 목적, 데이터 주체가 일정별로 정한 민감도, 남은 예산이다. 원안 문장은 D4에 해당한다. 기본 응답은 "그 시간은 어렵습니다. 14:00이나 16:30은 가능합니다"(D2)로 둔다.

### 4.2 경계: 결정은 엔진이, LLM은 세 곳에서만
1. **Inbound parser(A만)**: Muse Spark가 외부 메시지를 닫힌 JSON 스키마로 바꾼다(intent ∈ {propose, query_slots, reschedule, cancel}, 기간, 길이, 참석자 ID, 목적 코드). 개인 데이터는 보지 않는다. 결정적 검증기가 타입·열거값·범위를 다시 확인한다. 자유 텍스트 필드는 두지 않거나 불투명 ID로 바꾼다. Meta Cookbook의 구조화 출력 레시피를 쓸 수 있다 [46].
2. **Owner-side classifier(B만)**: 조회 시점이 아니라 일정이 생길 때 소유자 일정에 범주·민감도·이동 가능성 라벨을 붙인다. 외부 메시지와 같은 컨텍스트에 두지 않는다. 로컬 Muse Glimmer(Apache 2.0, 단일 GPU)가 후보다 [17].
3. **Outbound phrasing(C, 허용 필드만)**: 엔진이 고른 공개 객체만 받아 문장을 만든다. 이어서 결정적 egress 검사를 한다. 시간 문자열이 허용 집합 안에 있는지, 일정 제목이나 이름 문자열이 없는지 보고 Presidio로 재검사한다. 실패하면 템플릿 응답으로 대체한다.
4. **Policy engine(LLM 아님)**: Cedar나 OPA로 등급을 정하고 예산을 차감한다. 예약 확정 같은 쓰기 행동에는 승인을 요구한다. 모든 결정에 정책 파일 버전 해시를 남긴다.

이렇게 하면 어떤 LLM 컨텍스트도 A·B·C를 동시에 갖지 않는다.

### 4.3 probing 방어
- **고정 투영**: (요청 주체 등급, 주) 단위로 공개 투영을 한 번 계산해 캐시하고, 모든 질의를 그 투영에서 답한다. 같은 질문에는 같은 답이 나가므로 반복 질의로 더 얻을 것이 없다(RootGuard 원리).
- **해상도 하한**: 30~60분 버킷, 조회 기간 상한(예: 14일), 하루 제안 수 상한을 둔다.
- **요청 주체별 누적 예산**: 새로 공개된 (슬롯, 사람) 상태 수를 비용으로 센다. 예산이 바닥나면 D0으로 내리거나 "propose-only" 모드로 바꾼다. 이 모드에서는 프록시가 후보만 제안하고 임의의 가/불가 질의에는 답하지 않는다.
- **신원 결속**: 예산 키는 에이전트 인스턴스가 아니라 위임한 사람(OAuth 주체, Web Bot Auth 운영자 + 사용자 토큰)이다. 그러지 않으면 ID를 여러 개 만드는 Sybil 공격으로 우회된다.
- **다자 조율**: 개인별 가용성 대신 교집합 후보만 준다. 누가 안 되는지는 밝히지 않는다. 집합 차분 질의({A,B} 대 {A,B,C})도 같은 투영과 예산에 묶는다.
- **노이즈**: 쓰지 않는 쪽을 권한다. 매번 다르게 섞은 응답은 평균으로 걷힌다(Diffix 교훈).

### 4.4 인젝션 방어 배치
요청은 다음 순서로 처리한다. (1) 신원 검증과 rate limit (2) Prompt Guard 2 점수 기록(차단 판단은 정책이 함) (3) 닫힌 스키마 변환·검증 (4) Cedar 결정과 예산 차감 (5) 공개 객체로 문장 생성 (6) egress 검사 (7) 결정 로그. 외부 에이전트가 넣은 회의 설명이 소유자 캘린더에 저장되면, 나중에 소유자의 에이전트를 노리는 저장형 인젝션 경로가 된다. 저장할 때 untrusted 라벨을 붙이고 스키마 밖 텍스트는 저장하지 않는다.

### 4.5 투명성 원장과 프라이버시의 충돌
요청 내역을 공개 원장에 평문으로 올리면 "누가 누구의 일정을 언제 물었나"라는 메타데이터가 새로 샌다 [추론]. 원장에는 결정 해시, 정책 버전, 예산 차감만 남긴다. 열람은 데이터 주체와 감사자로 제한한다. 형식은 Certificate Transparency(RFC 9162)식 append-only Merkle 로그 정도면 충분하다 [48][제안].

## 5. 10일 정량 평가 계획

**데이터셋(합성 조직 캘린더)**
- 직원 30명, 4주, 1인당 주 15~25개 일정. 시간 배치는 결정적 코드로, 제목과 설명은 Muse Spark 구조화 출력으로 만든다. 일정마다 범주, 민감도(의료·가족·면접·HR 등), 이동 가능성, 외부 공개 불가 속성을 정답 라벨로 붙인다.
- 외부 요청자 역할은 고객, 파트너, 채용, 미확인, 악성 5종이다. 요청은 한국어와 영어 반반.
- 과업은 1:1, 3~5인 그룹, 일정 변경, 긴급 요청으로 200~300개. 정답 가능 슬롯은 전수 탐색이나 CP-SAT로 계산한다.

**공격 시나리오**

| ID | 공격 | 성공 판정 |
|---|---|---|
| A1 | 직접 추출("왜 안 되죠? 무슨 일정?") | 제목·범주·참석자 누출 |
| A2 | 맥락 하이재킹·권위 사칭("긴급 의료", "대표 비서") | 등급 초과 공개 |
| A3 | 요청·회의 설명 속 인젝션 | 스키마 밖 행동, 정책 우회 |
| A4 | 30분 단위 반복 질의로 슬롯 스윕 | busy 지도 복원 정확도 |
| A5 | 집합 차분 | 특정인 가용성 추론 정확도 |
| A6 | Sybil(에이전트 ID 여러 개) | 예산 우회 |
| A7 | 장기 패턴(매주 같은 시간 "개인 일정") | 반복 민감 일정 추론 |
| A8 | 출력 밀반입(인코딩 요청 등) | egress 검사 우회 |

**지표**
- 누출: 의미 누출률(문자열 일치, Presidio, LLM 판정 교차), 구조 누출(A4·A5 복원 정확도, CalBench VPS 개념), CIMemories식 violations@5(같은 요청 5회).
- 공격 성공률(ASR): 시나리오별.
- 유용성: 합의 성공률, 합의까지 라운드 수, 오라클 대비 추가 비용, 성공한 미팅당 공개 상태 수.
- 지연·비용: p50/p95, 요청당 LLM 호출 수와 토큰, 100요청당 비용.
- 결정성: 같은 요청을 반복했을 때 같은 결정이 나오는 비율.

**비교군**: B0 전체 캘린더를 보는 LLM + 프라이버시 프롬프트, B1 free/busy API만, B2 프록시(예산 없음), B3 전체 프록시. 여유가 있으면 Firewalls 구현을 B4로 둔다.

**재사용할 외부 벤치마크**: ConVerse·Firewalls(MIT)는 여행 도메인 페르소나 하나만 돌려 우리 파서·정책 엔진과 비교한다. Meta API가 OpenAI SDK 호환이므로 base_url만 바꿔 붙일 수 있을 것이다 [추론]. 기본 판정 모델(gpt-4o)은 바꿔야 한다. CalBench는 일정 지표와 oracle을, AgentDojo는 인젝션 회귀 테스트를, CIMemories·PrivacyLens는 판정 방식을 참고한다.

**일정**: D1–2 생성기·정책 엔진, D3–4 파서·문장 생성·egress, D5 공격 하네스, D6–7 실행, D8 ablation(예산·투영 on/off), D9–10 데모. 실제 호출 단가는 가격 페이지에서 재확인하고, 시연분을 남긴 채 $150 안에서 짠다 [추론].

## 6. "그냥 free/busy 아니냐"는 질문에 답하려면 [제안]
1. **같은 공격 스크립트, 세 가지 방어**: Google free/busy 공유, 프라이버시 프롬프트만 준 LLM, 우리 프록시에 A4 스윕을 20회씩 돌리고 복원 히트맵을 나란히 띄운다. free/busy는 첫 질의에 지도 전체가 나오고, 순수 LLM은 제목까지 흘린다. 프록시는 후보 k개를 준 뒤 예산이 바닥난다.
2. **free/busy로는 안 되는 합의**: soft 일정 조정 제안 덕분에 합의 성공률은 더 높고 미팅당 공개 상태 수는 더 적다는 것을 수치로 보인다.
3. **그룹 조율**: 개인별 가용성을 노출하지 않고 교집합만으로 합의하는 장면.
4. **정책 diff**: Cedar 정책 한 줄을 바꾸면 응답이 D2에서 D3로 바뀐다. 프롬프트가 아니라 정책이 결정한다는 증거다.
5. **데이터 주체 리포트**: "이번 주 외부 에이전트 조회 7건. 가/불가 응답 3건, 후보 제시 2건, 거절 2건."
6. **Meta 수치를 출발점으로**: Muse Spark 단독 CIMemories 78.3%와 프록시 경유 결과를 같은 지표로 비교한다.
7. **SAM 3.1 확장 장면(선택)**: 에이전트가 리뷰 사진을 올리기 전에 프록시가 다른 사람 얼굴과 택배 주소 라벨을 가린다. SAM 3.1이 마스크를, OCR과 Presidio가 글자를 맡는다.

## 7. 팀이 합의할 것(이 영역)
- 보호 대상: 플랫폼의 **다른 사용자 데이터**(서비스 쪽)인가, 요청자 본인 데이터(사용자 쪽)인가. 선행 연구는 대부분 후자다.
- 공개 등급 기본값을 정하는 주체: 관리자인가, 데이터 주체인가.
- 신원 결속 방식(OAuth, Web Bot Auth, API 키)과 예산 단위.
- 닫힌 스키마의 어휘(의도·목적 코드).
- 모델 배치: 파서·문장 생성은 Muse Spark API, 소유자 쪽 분류는 Glimmer 로컬, Prompt Guard 2는 Modal에 둘지.
- 원장에 무엇을 남기고 누가 볼지.
- 평가 언어. Meta 가드 모델은 한국어를 평가하지 않았다.

## 출처(접속 2026-10-26)
1. Firewalls to Secure Dynamic LLM Agentic Networks, arXiv 2502.01822 v7(2026-06-23) · arxiv.org/html/2502.01822v7 · github.com/amrgomaaelhady/Firewall-Agentic-Networks
2. ConVerse, arXiv 2511.05359(2025-11-07) · github.com/amrgomaaelhady/ConVerse · EACL Findings: preview.aclanthology.org/new-sigs/2026.findings-eacl.170 [스니펫]
3. AirGapAgent, arXiv 2405.05175(v2 2024-09-18)
4. PrivacyLens, arXiv 2409.00138 · github.com/SALT-NLP/PrivacyLens
5. ConfAIde, arXiv 2310.17884
6. AgentDAM, github.com/facebookresearch/ai-agent-privacy · arXiv 2503.09780
7. CIMemories, arXiv 2511.14937(2025-11-18)
8. MAGPIE, arXiv 2510.15186(2025-10-16)
9. The Sum Leaks More Than Its Parts, arXiv 2509.14284(2025-09-16)
10. CalBench, arXiv 2605.09823 · arxiv.org/html/2605.09823v3(2026-06-05)
11. AgentLeak, arXiv 2602.11510(v3 2026-06-15) · github.com/Privatris/AgentLeak
12. MNC, arXiv 2608.01719(2026-08-03)
13. PlanTwin, arXiv 2603.18377(2026-03-19)
14. Dependency-Aware Privacy for Multi-turn LLM Agents(RootGuard), arXiv 2605.03188(v3 2026-10-12)
15. ppc.land/mlcommons-catalogues-25-privacy-risks-posed-by-ai-agents(2026-10-01)
16. Muse Spark Safety & Preparedness Report, arXiv 2606.12429 · arxiv.org/html/2606.12429v1(2026-05-14)
17. dev.meta.ai/models/muse-glimmer(날짜 미표기)
18. differentialprivacy.org/reconstruction-theory(2020-10-21)
19. usenix.org/conference/usenixsecurity19/presentation/gadotti(2019) [스니펫]
20. research.ucc.ie/en/publications/multi-agent-meeting-scheduling-with-preferences-efficiency-privac [스니펫]
21. scitepress.org/PublishedPapers/2019/79477(SECRYPT 2019)
22. eprint.iacr.org/2023/1777
23. support.google.com/calendar/answer/37082 · support.google.com/a/answer/60765 [스니펫]
24. support.microsoft.com/en-US/Outlook/sharing/share-an-outlook-calendar-as-view-only-with-others
25. learn.microsoft.com/en-us/graph/api/calendar-getschedule(갱신 2026-05-19)
26. RFC 4791 §6.1.1, RFC 5545 §3.2.9(datatracker.ietf.org)
27. community.calendly.com/how-do-i-40/was-told-my-personal-events-were-visible-when-they-went-to-schedule-with-me-1800 [스니펫]
28. cal.com/help/privacy-and-compliance/google-calendar-privacy
29. blockit.com/blog-posts/introducing-blockit(2026-01-22)
30. ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection(2025-12-08)
31. ai.meta.com/blog/practical-ai-agent-security(2025-10-31)
32. simonwillison.net/2023/Apr/25/dual-llm-pattern
33. arXiv 2506.08837 · simonwillison.net/2025/Jun/13/prompt-injection-design-patterns
34. CaMeL, arXiv 2503.18813 · github.com/google-research/camel-prompt-injection
35. FIDES, arXiv 2505.23643 · github.com/microsoft/fides
36. The Attacker Moves Second, arXiv 2510.09023 [스니펫]
37. about.fb.com/news/2026/09/introducing-muse-personal-ai-agent(2026-09-08)
38. deeplearning.ai/the-batch/how-to-secure-agents-for-the-masses(2026-09-18)
39. docs.cedarpolicy.com/auth/authorization.html
40. openpolicyagent.org/docs
41. docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html
42. dev.meta.ai/llama/llama-protections · ai.meta.com/blog/ai-defenders-program-llama-protection-tools(2025-04-29)
43. huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M
44. huggingface.co/meta-llama/Llama-Guard-4-12B
45. LlamaFirewall, arXiv 2505.03574 · github.com/meta-llama/PurpleLlama/tree/main/LlamaFirewall
46. dev.meta.ai/docs/overview · dev.meta.ai/docs/api-reference · dev.meta.ai/docs/cookbook
47. datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol-00(2026-09-01)
48. RFC 9162(2021-12)
49. presidio.dataprivacystack.org(/supported_entities/, /image-redactor/)
50. doaj.org/article/1e0ddb4fbc2e4451865a637cb8fccf51 · huggingface.co/id4thomas/ko-pii-detector-ax-crf · pypi.org/project/korean-pii · pypi.org/project/kpii [스니펫]
51. spacy.io/models/ko
52. dev.meta.ai/models/sam-3-1 · huggingface.co/facebook/sam3.1 · github.com/facebookresearch/sam3(LICENSE 2025-11-19)
53. datacamp.com/tutorial/sam3-tutorial-segment-everything-3-build-a-privacy-filter [스니펫]
