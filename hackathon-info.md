# 해커톤 정보

### 대회 링크

[https://cerebralvalley.ai/e/meta-ai-developer-hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)

## 개요

- **대회:** Meta Global AI Developer Hackathon
- **주최:** Meta · Cerebral Valley
- **방식:** 전 세계 온라인, 선발 참가자 무료
- **기간:** 2026년 10월 26일~11월 4일(ET), 10일간
- **총상금:** 미화 100만 달러
- **규모:** 최대 20,000명, 수시 심사·선발. 신청은 마감됐다.

## 주요 일정

| 항목 | 미국 동부시간(ET) | 한국시간(KST) |
| --- | --- | --- |
| 신청 시작 | 10월 13일 09:00 | 10월 13일 22:00 |
| 신청 마감 | 10월 25일 23:59 | 10월 26일 12:59 |
| 승인 통보 완료 | 10월 26일 09:00까지 | 10월 26일 22:00까지 |
| 개막 생중계 | 10월 26일 12:00(페이지 표기 EST) | 10월 27일 새벽 (종료) |
| 워크숍·Discord 상담 | 10월 27일~11월 4일 | — |
| 작품 제출 마감 | 11월 4일 21:00 EST | **11월 5일 11:00** |
| 심사 | 11월 4~8일 | — |
| 결선·수상 발표 | 11월 9일 | — |
| 보너스상 발표 | 11월 10일경 | — |

미국 서머타임은 11월 1일에 끝났다. 따라서 제출 마감 21:00 EST는 UTC 11월 5일 02:00, 한국시간 11월 5일 11:00이다. 행사 페이지의 데이터(`hackathonSubmissionDueDate: 2026-11-05 02:00`)도 같은 시각이다. 같은 데이터에 `submissionDueDateGracePeriodHours: 6` 값이 있지만 공지된 유예 시간은 아니므로 계획에 넣지 않는다. 일정은 Meta 재량으로 바뀔 수 있다.

## 트랙과 주제

프로젝트마다 하나의 트랙에 참가한다.

| 트랙 | 대상 | 심사 관점 | 상금 |
| --- | --- | --- | --- |
| 개인 개발자(Indie) | 개인·학생, 최대 4인 팀 | 창의성, 기술적 도전, 작동 여부 | 1~5위 15만·10만·7.5만·5만·2.5만 달러, 합계 40만 |
| 스타트업 | 제품을 만드는 기술 창업자 | 기술 구현, 실제 운영 가능성 | 1~5위 25만·15만·7.5만·5만·2.5만 달러, 합계 55만 |

보너스상은 합계 최대 5만 달러다. 커뮤니티 투표상, 가장 화제가 된 프로젝트상 등이 후보이며 11월 10일경 발표한다. 트랙 상금에서 차감하지 않는다.

- **Build for Your World:** 자신의 분야에서 직접 경험한 문제 해결.
- **Push the Frontier:** 소프트웨어·로봇·제조·에너지·소재 등의 기술적 한계에 도전.

## 개발 지원

행사 페이지가 안내하는 도구는 Meta Model API의 Muse Spark 시리즈·**Muse Wonder**·Muse Image·SAM 3.1, Meta 공개 가중치 모델, 코딩 에이전트 Muse Code다. Muse Wonder는 10월 중순 이후 안내 문구에 추가됐고, API에서는 preview 상태다. 공식 규정은 "Muse Spark, Glimmer, SAM 3 및 행사 페이지에 명시된 기타 Meta AI 제품"으로 범위를 적는다.

선발 참가자에게는 10일간 개발용 **Meta Model API 크레딧 150달러**를 제공한다. 청구 전에 Credit Terms를 확인해야 한다.

일부 참가자에게 Baseten·Modal·Fireworks가 각각 **100달러** 크레딧을 제공한다. Baseten은 2M TPM 한도도 함께 준다. Fireworks는 이전 안내의 25달러에서 100달러로 바뀌었다.

## 공식 규정 (Official Rules)

공식 규정은 별도 문서가 아니라 [행사 개요·동의서](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) 페이지에 "Hackathon Terms & Conditions ("Official Rules") and Event Waiver"라는 제목으로 들어 있다. 본문 서명일은 2026년 10월 25일이다. 작품과 관련된 조항은 다음과 같다.

- **독창성:** 제출물은 참가자(팀)의 원작이어야 하고, 다른 사람의 권리가 없어야 한다. 외부 기술 지원을 받을 수 있지만 구성 요소의 권리는 참가자에게 있어야 한다.
- **오픈소스:** 라이선스를 지키고, 제출물이 원래 오픈소스를 개선·확장하는 경우에 허용한다.
- **사전 작성 코드:** 공식 규정에는 기간 제한 문구가 없고 원작 요건만 있다. 그러나 참가자 가이드("New work only")와 Discord #rules가 모두 기간 제한을 둔다. Discord #rules 원문: "Everything you present has to be built during the hackathon, Oct 26 to Nov 4." CV는 빌드 기간이 킥오프 이후부터라고 정정했다. 원작 기여를 구분하지 못하면 실격된다. 기존 코드를 쓰는 경우의 FAQ 지침: 저장소는 "a fresh repo containing only work done during the event"로 만들고, 영상은 "with one line stating what was pre-existing and what you built this week"로 시작한다. 우리는 이 기준을 따른다.
- **비Meta 모델:** 금지 문구는 없다. 다만 심사의 25%가 Meta AI 도구 활용이다.
- **권리:** 소유권은 참가자에게 남는다. 주최 측과 파트너는 영구·무상의 비독점 이용권을 받는다.
- **기밀 유지 없음:** 주최 측은 참가자 자료에 대해 비밀 유지 의무를 지지 않는다. 공유한 자료는 기밀로 취급되지 않는다. 실제 팀 대화·개인정보는 동의를 받았거나 합성한 자료만 쓴다.
- **팀:** 대표자가 제출하며 팀원을 모두 명시한다. 개인 트랙은 최대 4인이다. 스타트업 트랙의 대표자는 해당 스타트업의 현직 직원이어야 하고, 공지와 상금을 받을 권한이 있어야 한다("The startup Representative must be an active employee of the startup…", 공식 규정, 11월 4일 확인).
- **자격:** 만 18세 이상이고 거주지 성년이어야 한다. 한국은 제외 국가가 아니다.
- **상금 지급:** Cerebral Valley가 Tremendous 은행 송금으로 지급한다. 비미국 거주자는 W-8BEN을 내야 하며, 확인 후 30일 이내에 지급한다. 송금·환전 수수료와 세금은 수상자가 부담한다.

## 작품 심사

공식 규정의 Hackathon Judging Criteria 기준이다.

| 항목 | 비중 | 내용 |
| --- | --- | --- |
| Impact | 30% | 실제 효용, 수혜자, 중요도, 실사용 가능성, 주제 적합성 |
| Use of Meta AI Tooling | 25% | 창의적 활용, 기본 연동을 넘는 활용, 예상 밖 능력의 발견 |
| Technical Depth & Execution | 20% | 탄탄하고 다듬어진 엔지니어링 |
| Demo | 25% | 작동하는 데모, 라이브 안정성, 데모 영상 품질 |

심사위원단이 결선 진출자를 정하며, 그 결정이 최종이다. 심사위원 명단은 공개 페이지에서 확인되지 않았다.

## 제출 요건 (11월 4일 확인)

로그인한 [제출 양식](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit), [참가자 가이드](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details), 대시보드 공지, 주최 측 메일(11월 2·3일 리마인더)에서 확인했다.

- **필수 입력:** Team Name, 트랙(Indie Developer / Startups), 문제 주제(Build for Your World / Push the Frontier), Project Description, Public GitHub Repository URL, 3-Minute Demo Video URL, Meta 제품 활용 설명, Meta 모델이 중요한 이유, Meta Model API 사용 의향·전반적 평가(5점 척도 2문항).
- **선택 입력:** Most Viral용 X 게시물 링크, 파트너 기술 피드백, 홍보 이용 동의 체크박스(필수 표시 없음), 설문 7문항. 프로젝트 제목·파일 업로드·라이브 데모 URL·APK 필드는 없다. 글자 수 제한 표시도 없다.
- **팀원:** 대표자가 제출하고, 참여자 전원을 "Add Team Member"(이름·핸들·이메일 검색)로 등록한다.
- **저장소:** "Open source: Repositories must be public." 공지는 이를 모든 프로젝트의 필수 요건이라고 강조한다.
- **영상:** 3분 분량이다. 해커톤 기간에 만든 기능·코드만 보여야 하며, 원작 기여를 구분하지 못하면 즉시 실격될 수 있다. 예시 URL은 YouTube이고, 공개 범위 요건은 명시되지 않았다. 링크 접근 가능 여부를 확인하라고 안내한다.
- **심사 자료:** 영상, 코드, "live product"를 본다. 루브릭에는 "Does the product hold up live?"가 있다. 결선(트랙별 상위 5팀)에서는 심사위원이 영상을 실시간으로 보며 순위를 매긴다. 결선·시상: 11월 9일 12:00 ET(한국시간 11월 10일 02:00).
- **늦은 제출:** "Late submissions won't be considered." 공지는 일찍 제출하라고 권한다.
- **API 크레딧:** $150 신청 마감은 제출 마감과 같다(11월 4일 21:00 ET). 적용된 크레딧은 만료되지 않는다(크레딧 약관 §3.5). 호출하려면 카드 등록이 필요하다. 카드를 등록하면 일시 승인 금액이 잡혔다가 해제된다. 이 승인에 실패하면 계정이 제한되고 API를 호출할 수 없다. Billing 페이지에는 "While using free credits your content may be used for product improvement."라고 적혀 있다(11월 4일 확인).
- **보너스상:** Most Viral은 X 게시물의 참여도를 11월 8일 EOD까지 집계한다. Open Weight상은 Muse Glimmer와 Muse Spark Open만 대상이다.

## 우리 제출 계획

[decisions.md](docs/prd/decisions.md) R8에 따른다.

- **제출물:** 3분 데모 영상(YouTube)과 public GitHub 저장소(D-R8-01).
- **배포 안 함:** APK 공개와 클라우드 릴레이를 모두 하지 않는다. 심사위원이 직접 실행할 수 있는 "live product"는 없다. 따라서 영상에서 실제 API로 동작하는 장면을 보여 주는 것이 Demo 평가의 근거가 된다(D-R8-01).
- **문제 주제:** Build for Your World(D-R8-02).
- **참가 트랙:** Indie Developer. 팀원 없이 개인으로 제출한다(D-R8-03).

## 아직 확인되지 않은 것

- 제출 후 수정할 수 있는지 여부. 양식, 가이드, 규정 어디에도 명시되지 않았다.
- 심사 시작일. 대시보드는 11월 4~8일, 가이드는 11월 5~8일로 표기한다.
- 심사위원이 live product에 접근하는 방법(APK, 기기, 테스트 계정). 별도 안내가 없다. 우리는 배포하지 않기로 했으므로(D-R8-01) 준비할 것은 없다. 다만 심사위원이 live product를 직접 보려 한다면 Demo 점수에 불리할 수 있다.
- Discord: #questions와 #office-hours에서 Android/APK 관련 안내는 검색하지 못했다. #rules, #faqs, #announcements는 11월 4일에 확인했다.
- W-8BEN 제출 절차와 시점. 수상 후 안내가 오는지 미확인이다.

자원·주최사·심사위원 조사와 주제 선정 참고사항은 [hackathon-research.md](hackathon-research.md)에 정리했다.

출처: 공식 행사 페이지(Cerebral Valley·Meta), 행사 개요·동의서의 공식 규정, 로그인한 제출 양식·참가자 가이드, 주최 측 메일. 최종 확인일: 2026년 11월 4일.
