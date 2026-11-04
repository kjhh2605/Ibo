# 해커톤 자원·주최사·심사 조사

조사일: **2026년 10월 20일**, 갱신 **2026년 11월 2일**  
목적: 개인 참가자의 프로젝트 주제 선정과 구현 계획 수립을 위한 참고 자료.

공식 행사 페이지, 연결된 행사 개요·동의서, Meta 개발 문서를 중심으로 조사했다. 아래의 **제안**은 조사 결과를 바탕으로 한 작업 방향이며 공식 요구사항이 아니다. 계정에 실제 부여된 권한·크레딧과 참가자 전용 공지는 확인하지 않았다.

## 1. 제공 자원

### 참가 지원

| 자원 | 공개된 지원 내용 | 사용 전에 확인할 사항 |
| --- | --- | --- |
| Meta Model API | 선발 참가자에게 10일간 개발용 **150달러 크레딧** 제공 | 지급·활성화 시점, 만료일, 적용 모델, 결제수단 필요 여부 |
| Baseten | 일부 참가자에게 **100달러 크레딧**, **분당 200만 토큰(2M TPM)** 한도. Meta 공개 가중치 모델 이용 지원 | 대상자 선정·신청 방법, 지원 모델, 실제 계정 한도 |
| Modal | 일부 참가자에게 **100달러 크레딧**. Endpoints, 서버리스 GPU, 샌드박스, LLM 학습 도구 안내 | 크레딧 적용 서비스, GPU 가용성, 이용 기간 |
| Fireworks | 일부 참가자에게 **100달러 크레딧**(10월 20일 조사 당시 25달러에서 상향), Meta 공개 가중치 모델 이용 지원 | 대상자·활성화 방법, 지원 모델 |
| 기술 지원 | Meta·파트너 라이브 워크숍, Discord 오피스아워. 행사 일정에는 10월 27일~11월 4일로 표기 | 참가자 초대 링크, 세션별 시간·녹화 제공 여부 |

Meta 크레딧은 [행사 개요·동의서](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver), 파트너 지원과 일정은 [Cerebral Valley 행사 안내](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)에 근거한다. 파트너 혜택을 모두 받을 수 있다고 가정해 예산을 합산하지 않는다.

### 모델·도구별 활용

행사 소개에서 직접 언급한 자원은 Muse Spark 시리즈, Muse Wonder, Muse Image, SAM 3.1, Meta 공개 가중치 모델, Muse Code다. Muse Wonder는 11월 2일 기준 Cerebral Valley 행사 페이지에만 추가돼 있다. [Cerebral Valley 행사 안내](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), [Meta 공식 행사 소개](https://dev.meta.ai/events/global-hackathon)

| 모델·도구 | 확인된 기능 | 주제·구현에 활용하는 방법 — 제안 |
| --- | --- | --- |
| Muse Spark | 에이전트 작업, 도구 호출, 장문 컨텍스트. API 모델 ID에 `muse-spark-1.3` 등이 있음 | 문서나 화면을 이해하고 실제 도구 실행까지 이어지는 업무 자동화 |
| Muse Image | 텍스트 기반 이미지 생성·편집, 여러 차례 수정 | 요구사항을 검토하고 반복 수정하는 시각 콘텐츠 제작 |
| SAM 3.1 | 이미지·영상의 객체 검출, 마스크 생성, 영상 내 객체 추적 | 사진·영상에서 관심 객체를 분리하고 변화나 작업 결과를 시각화 |
| Muse Code | 터미널·CI에서 계획, 파일 편집, 명령 실행을 수행하는 코딩 에이전트 | 개발 보조 또는 개발 도구 프로젝트의 구성 요소로 검토 |
| Muse Spark Open | 공개 가중치 모델. 자체 GPU 또는 호스팅 제공자를 통해 실행 | 배포 제어가 핵심일 때 검토. 개인 개발은 호스팅 API부터 비교 |
| Muse Glimmer | 로컬·엣지 실행용 공개 가중치 모델 | 로컬 처리가 중요한 시나리오의 후보. 보유 장비에서 먼저 성능 측정 |

기능 출처: [Meta 개발 문서 개요](https://dev.meta.ai/docs/overview), [SAM 3.1 소개](https://dev.meta.ai/models/sam-3-1), [Muse Code 소개](https://dev.meta.ai/products/muse-code).

**추가 검토 후보:** Muse Wonder는 복잡한 코딩과 장기 에이전트 작업용 모델이며 API에서 preview로 표기된다. 11월 2일 기준 행사 페이지의 사용 가능 도구 목록에도 들어 있다. Contributor 모드는 없다. Voice Transcribe는 화자 구분을 포함한 음성 전사 모델이며 음성 합성은 제공하지 않는다. 한국어를 포함한 25개 언어와 언어 혼용(code-switching), 어휘 바이어싱을 지원한다. 파일 전사는 1건당 10분·32MB 이하의 모노 16-bit WAV(16/24kHz)만 받고, 실시간 세션은 최대 60분이다. 타임스탬프는 단어 단위가 아니라 발화 단위로 제공되며, 요금은 시간당 0.18달러다. [Meta 개발 문서](https://dev.meta.ai/docs/overview), [Speech to text](https://dev.meta.ai/docs/speech-to-text)

**Muse Code 확장 기능(11월 2일 확인):** Muse Code는 다음 확장 기능을 지원한다. [Extending and automating](https://dev.meta.ai/docs/muse-code/extending), [Session messaging](https://dev.meta.ai/docs/muse-code/session-messaging), [가격](https://dev.meta.ai/docs/pricing-rate-limits)

- MCP 서버: `mcp_servers`에 stdio 또는 streamable_http로 등록하고, OAuth 2.1 로그인을 지원한다.
- 스킬: 프로젝트의 `.agents/skills`에 두며 Claude·Codex 스킬도 가져올 수 있다.
- 훅: SessionStart, PostToolUse, Stop 등 17개 이벤트에 연결한다.
- 헤드리스 실행: `muse exec --json`으로 터미널 UI 없이 실행한다.
- 세션 간 메시지: 한 사용자의 로컬 세션끼리만 메시지를 주고받는다.

구독 요금은 월 5·15·50·200달러이고 **기본값은 Contributor 모드**다. 개인정보가 들어간 작업에는 Standard 모드로 바꿔야 한다.

**Meta AI 소비자 앱 연동:** Meta AI Connectors는 여전히 developer preview이며 개발자를 순차 선정한다. 공개·검색 노출은 이후 단계로 미뤄져 있다. 해커톤 기간 안에 Meta AI 앱이나 Muse 앱이 외부 도구를 호출하게 만들 수 있다고 가정하지 않는다. [Meta AI Connectors](https://dev.meta.ai/products/connectors)

### 구현 자료

| 자료 | 활용 목적 |
| --- | --- |
| [API Quickstart](https://dev.meta.ai/docs/quickstart) | 인증과 첫 요청 검증 |
| [공식 Cookbook](https://dev.meta.ai/docs/cookbook) | 도구 호출, 구조화 출력, 재시도, 에이전트 루프 예제 |
| [Cookbook GitHub](https://github.com/meta-models/meta-model-cookbook) | 예제를 내려받아 작은 기능부터 실행 |
| [가격·호출 한도](https://dev.meta.ai/docs/pricing-rate-limits) | 선택 모델의 실제 단가와 한도 확인 |
| [Muse Image](https://dev.meta.ai/models/muse-image) | 이미지 생성·편집 기능 검토 |
| [SAM 3.1](https://dev.meta.ai/models/sam-3-1) | 객체 분리·추적 기능 검토 |

Cookbook에는 스크린샷 기반 오류 수정, 차트 분석, 샌드박스 실행, GitHub 에이전트, 영상 스티커, 화자와 인물을 연결한 자막 등의 예제가 있다. **제안:** 가장 가까운 예제를 기술 검증에 활용하고, 프로젝트의 차별점은 특정 사용자의 문제와 평가 가능한 결과로 설계한다. [공식 Cookbook](https://dev.meta.ai/docs/cookbook)

## 2. 주최사와 관심 방향

### Meta / Meta Superintelligence Labs

Meta는 모델·개발 플랫폼을 제공하는 공동 주최사다. Meta Connect 공식 발표는 이번 행사를 최신 모델을 실제 개발에 활용하도록 돕는 프로그램으로 소개하며, Meta Superintelligence Labs의 엔지니어·연구자가 실습 워크숍을 진행한다고 설명한다. [Meta Connect 2026 공식 정리](https://developers.meta.com/blog/meta-connect-recap/)

같은 발표에서 강조하는 방향은 다음과 같다.

- 추론 모델과 여러 단계로 진행되는 코딩·에이전트 작업.
- 이미지·음성 등 다양한 입력과 출력을 이용한 서비스.
- 직접 API, 파트너 인프라, 로컬 실행 등 배포 방식의 선택.
- 모델을 개발자가 실제 사용할 수 있는 도구로 빠르게 전환하는 것.

**해석:** Meta 모델이 프로젝트의 핵심 문제를 어떻게 해결하는지 보여주는 구성이 행사 취지에 잘 맞는다. 다만 특정 제품군, 모델 개수, 스마트 안경 사용에 가산점이 있다는 공식 근거는 확인하지 못했다. 위 방향은 주최사의 공개 제품 전략이지 별도의 채점표가 아니다. [Meta Connect 발표](https://developers.meta.com/blog/meta-connect-recap/)

### Cerebral Valley

Cerebral Valley는 AI 연구소·기업과 개발자를 연결하고, 해커톤·워크숍·데모 행사를 운영하는 조직이다. 공식 사이트에는 GPT-5 Launch Hackathon, Gemini 3 Asia Tour, Llama 3 Impact Hackathon 등의 운영 사례가 소개되어 있다. [Cerebral Valley 공식 소개](https://cerebralvalley.ai/)

이번 행사에서는 공동 주최사로 표기되며 신청·제출 포털을 제공한다. 기술 지원은 Meta·파트너 세션, 참가 운영은 행사 포털·참가자 공지를 우선 참고하는 것이 합리적이다. [행사 안내](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

Baseten·Modal·Fireworks는 행사에서 **추론 파트너**로 소개된다. 공동 주최사나 심사위원으로 표기된 것은 아니다. [파트너 안내](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

## 3. 심사위원과 심사 기준

### 심사위원 공개 상태

**이번 조사에서 이름·소속이 확인된 심사위원은 없다.** 공식 행사 페이지 두 곳, 연결된 행사 개요·동의서와 공식 도메인 검색에서 명단을 찾지 못했다. 이는 공개 확인 범위에 대한 설명이며, 참가자 전용 채널의 공지 여부까지 확인한 것은 아니다.

행사 개요에는 심사위원단이 결선 진출자를 선정한다고 명시되어 있다. Fireworks의 **Sinan Ozdemir**는 워크숍 진행자로 소개되지만 심사위원이라는 근거는 없다. Cerebral Valley 홈페이지의 과거 행사 참석자 역시 이번 행사 심사위원으로 간주하면 안 된다. [행사 개요](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver), [워크숍 안내](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

따라서 현재는 개인별 취향을 추정하기보다 공개 채점 기준에 맞춰 주제를 평가하는 것이 유용하다.

### 작품 평가 배점

| 항목 | 비중 | 공식 설명 요약 | 준비할 증거 — 제안 |
| --- | --- | --- | --- |
| Impact | **30%** | 실제 효용, 수혜자, 문제의 중요성, 사용 가능성, 주제 적합성 | 구체적 사용자, 기존 방식의 문제, 개선 전후 비교 |
| Use of Meta AI Tooling | **25%** | 창의적인 도구 활용, 기본 연결을 넘어선 활용, 새로운 가능성 | 모델이 맡는 핵심 단계와 선택 이유, 실패를 개선한 과정 |
| Technical Depth & Execution | **20%** | 탄탄하고 다듬어진 구현, 기술적 완성도 | 실제 실행 흐름, 오류 복구, 측정 결과 |
| Demo | **25%** | 작동하는 인상적인 데모, 라이브 안정성, 영상 품질 | 입력부터 결과까지 이어지는 시연과 명확한 설명 |

배점 출처: [행사 개요·동의서](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver)에 들어 있는 공식 규정(Hackathon Terms & Conditions)의 **Hackathon Judging Criteria**. 신청 심사에 쓰인 아이디어·기술 역량 동등 비중과는 별도의 작품 평가 기준이다.

10월 20일 조사 시점에는 "개막 전 공개 예정"이었던 공식 규정이 같은 페이지에 게시됐고, 배점은 바뀌지 않았다. 규정 요약은 [hackathon-info.md](hackathon-info.md#공식-규정-official-rules)에 있다.

## 4. 개인 참가자의 주제 선정에 적용

이 절은 **작업 제안**이다. 아직 프로젝트 주제를 결정한 것은 아니다.

### 후보 비교표

각 후보를 1~5점으로 평가하고 공식 비중을 적용한다.

`비교 점수 = 영향력 × 0.30 + Meta 도구 활용 × 0.25 + 기술 구현 × 0.20 + 데모 × 0.25`

점수와 별개로 다음 조건을 충족하는지 먼저 확인한다.

1. 실제 문제를 설명해 줄 사용자 또는 직접 경험이 있는가?
2. 필요한 데이터와 API 권한을 행사 초반에 확보할 수 있는가?
3. 혼자서 핵심 흐름을 완성하고 반복 시연할 수 있는가?
4. 가장 어려운 기술 가정을 작은 실험으로 빠르게 검증할 수 있는가?

### 검토할 방향

| 방향 | 구성 후보 | 먼저 검증할 것 |
| --- | --- | --- |
| 특정 직무의 작업 완료 에이전트 | Spark + 해당 업무 API + 실행 결과 검증 | 핵심 작업 하나의 성공률, 외부 서비스 접근 가능성 |
| 사진·영상 기반 현장 작업 도구 | SAM + Spark + 결과 오버레이 | 실제 촬영 데이터에서 객체 분리 품질과 지연 |
| 반복 수정이 필요한 시각 제작 도구 | Image + Spark + 사용자 피드백 | 수정 지시 반영과 기존 요소 보존 수준 |
| 로컬 처리가 중요한 개인 업무 도구 | Glimmer + 로컬 자료·도구 | 보유 장비의 처리 속도와 작업 정확도 |

주제의 범위를 좁히고, **한 사용자가 하나의 중요한 일을 끝내는 흐름**을 완성하는 쪽을 우선 검토한다. 모델을 추가할 때는 실제로 품질이나 사용성을 개선하는지 비교한다.

## 5. 구현 시작 시 확인할 순서

1. **지원 자원 확인:** 승인 안내에서 API 크레딧 활성화, Discord, 파트너 혜택 경로를 확인한다.
2. **기술 검증:** 선택한 모델에 실제 입력을 보내고 결과 품질·지연·비용을 기록한다.
3. **작은 수직 구현:** 입력 → 모델 처리 → 도구 실행 → 결과 확인까지 한 번 연결한다.
4. **반복 평가:** 정상·어려운·실패 사례를 준비하고 성공률과 사용자 수정 횟수를 측정한다.
5. **데모 준비:** 핵심 가치가 드러나는 시나리오를 반복 실행하며 영상과 설명을 다듬는다.

API 비용은 `실행당 평균 비용 × 개발·평가·시연 횟수`로 추정한다. 호출 제한과 재시도 상한을 두고, 개발 중 전체 크레딧을 소진하지 않도록 시연 여유분을 남긴다.

## 6. 후속 확인 항목

| 미확인 항목 | 결정에 미치는 영향 | 확인 경로 |
| --- | --- | --- |
| 심사위원 명단·전문 분야 | 발표 설명의 깊이와 배경 정보 조절 | 행사 공지·킥오프·Discord |
| ~~API 크레딧 활성화·만료·대상 모델~~ | 해소: 신청 마감 11월 4일 21:00 ET, 적용된 크레딧은 만료 없음(크레딧 약관 §3.5) | 주최 측 메일·크레딧 약관 |
| 파트너 혜택 수령 조건 | 공개 가중치 모델의 호스팅 선택 | 참가자 전용 혜택 안내 |
| ~~사전 작성 코드·기존 프로젝트 허용 범위~~ | 해소: 공식 규정에는 기간 제한이 없지만, 참가자 가이드와 Discord #rules가 해커톤 기간(10월 26일~11월 4일) 작업만 발표하도록 요구한다. 구분하지 못하면 실격. 이 기준을 따른다 | 참가자 가이드·Discord #rules·#faqs |
| ~~외부 모델 사용 조건~~ | 해소: 금지 문구 없음. Meta 도구 활용은 배점 25% | 공식 규정 |
| ~~제출 영상 길이·필수 자료~~ | 해소: 3분 영상, public GitHub 저장소가 필수. 상세 내용은 [hackathon-info.md](hackathon-info.md#제출-요건-11월-4일-확인) | 제출 양식·참가자 가이드 |
| ~~심사위원의 live product 접근 방법~~ | 해소(결정): 배포하지 않고 영상과 저장소로만 평가받는다(D-R8-01) | [decisions.md](docs/prd/decisions.md) |

제출 포털: [Cerebral Valley 제출 포털](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). 로그인한 상태에서 양식 필드는 11월 4일에 확인했다.

### 조사 메모

행사 개요·동의서는 웹 텍스트 추출 도구에서 본문이 표시되지 않아, 공개 페이지 HTML에 포함된 문서 데이터를 추가로 확인했다. 그 결과 API 크레딧, 작품 평가 배점, 제출처, 트랙별 상금 정보를 확인했다. 기존 `hackathon-info.md`의 미확인 항목도 이에 맞춰 보완했다.
