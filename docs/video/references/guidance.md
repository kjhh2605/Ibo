# Street Fitting 3분 제출 영상: 전문가 지침과 지침에 인용된 사례

조사일: 2026-11-04. 저장소·앱 UI/UX는 열람하지 않았다. 현재 제품 설명은 이번 과업의 brief만 사용했다. 이 문서에서 **관찰**은 읽은 원문·YouTube 메타데이터·자동 자막·5초 간격 영상 프레임에 근거한다. **[추론/제안]**은 그 근거를 Street Fitting에 적용한 편집 판단이다. 레퍼런스 동영상은 가이드가 추천한 **프로젝트에 대응하는 공개 영상**이며, 가이드가 그 특정 YouTube 편집본 자체를 추천했다고 과장하지 않는다.

## 1. 결론부터

- **긴 문제 설명 → 솔루션 소개 → 시연**보다 **필수 공개문 5초 → 문제와 한 줄 솔루션 13초 → 실제 시연**이 적합하다. 첫 제품 행동을 약 18초에 시작한다.
- 네 기능을 각각 발표하지 말고 **동묘에서 본 바로 그 옷 한 벌**을 사진 → 영어 음성 검색 → 조합 피팅 → 같은 노점 복귀로 계속 추적한다.
- **under-the-hood는 없애지 말되, 24초 한 장의 단계별 데이터 흐름으로 제한**한다. 모델 로고 모음이나 코드 스크롤 대신 방금 본 입력·선택된 옷·마스킹 이미지·결과를 재사용하고, PHONE / META API의 경계를 드러낸다.
- 제출물은 **실제 동작을 녹화한 edited demo**가 적합하다. API 대기를 줄일 수 있지만 `Wait shortened — actual run: …s`처럼 실제 측정값을 밝힌다. 이 라벨 형식은 특정 대회의 명시 규정이 아니라 투명성 원칙에서 도출한 **[추론/제안]**이다.
- 얼굴·머리카락을 마스킹한 이미지가 업로드되는 brief이므로 **“No photos leave your phone”, “Everything runs on-device”, “Fully anonymous”는 쓰지 않는다.** “Face and hair are masked on-device before upload; the face is restored locally”처럼 실제 처리 경계를 좁혀 말하고 화면으로 보여준다.

## 2. 출처별 규칙과 타임라인 적용

### S1. Devpost 공식: “6 Tips for making a winning hackathon demo video”
URL: https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video
저자: Stephanie Rochon, Devpost Content Marketing Manager. 여러 해커톤 참가자의 조언과 Devpost 자체 팁을 구분해 제시한다.

**원문 규칙**
1. 약 3분 영상은 심사위원이 가장 먼저 보는 자료 중 하나다. 초 단위 스크립트를 먼저 짠다.
2. 첫 몇 초에 elevator pitch로 앱의 기능·대회와의 관련성을 설명한다.
3. 입력을 넣고 실제 동작·문제 해결을 보여준다. 텍스트 설명에 더 긴 정보를 둔다.
4. 기술적 측면도 조금 보여주되 지나치게 깊게 들어가지 않는다.
5. 시간에 맞추려고 **오디오를 배속하지 않는다**. 좋은 마이크, 보이는 화면, 접근 가능한 링크가 중요하다.
6. Devpost 자체 팁: 마지막 순간 업로드 금지, private 링크 주의, 실제 앱 작동을 보여줄 것.

**Street Fitting 적용 [추론/제안]**
- 원안의 0:05–0:25 문제 + 0:25–0:35 솔루션을 합쳐 0:05–0:18로 줄인다. 동묘 사진 한 장이 설명 다섯 문장보다 낫다.
- 영어 나레이션은 본인 음성 그대로, 영어 자막은 보조로 사용한다. 분량이 넘치면 문장을 자르지 말고 속도만 올리는 방식은 피한다.
- 기술 설명은 24초만 따로 확보하고, 모델 이름은 해당 실제 행동 장면에도 짧게 표시한다.

### S2. Devpost 창업자: “How to present a successful hackathon demo”
URL: https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo
저자: Brandon Kessler, CEO / Founder at Devpost.

**원문 규칙**
1. 왜 만들었는지 몇 문장으로 빠르게 상황을 잡는다.
2. 핵심은 working project. 계정 생성 같은 평범한 흐름은 건너뛴다.
3. 핵심 기술·어려운 기술적 도전을 **짧게** 언급한다.
4. 처음 제기한 문제의 해결을 반드시 보여줘야 완성된 핵심 기능이 입증된다.
5. 마지막은 한두 문장으로 잠재력과 장기적 영향.

**Street Fitting 적용 [추론/제안]**
- 로그인·권한 허용·빈 옷장 등록·긴 촬영 준비는 제외한다.
- 피팅 결과로 끝내지 말고 **같은 옷의 촬영 위치로 돌아오는 장면**까지 넣는다. 그래야 “이름도 지도도 없는 노점에서 옷을 다시 찾을 수 없다”라는 처음의 문제가 닫힌다.
- 확장 계획을 30초 말하기보다 실제 동묘 사용자에게 줄 효용 한 문장과 repo 링크로 마무리한다.
- 이 가이드가 The Homework Machine과 Vrban을 좋은 상황 설정 사례로 직접 연결한다. 아래 5절의 두 영상은 이 프로젝트들의 공개 기록이다.

### S3. Devpost: “How to win a hackathon: Advice from 5 seasoned judges”
URL: https://info.devpost.com/blog/hackathon-judging-tips
심사위원: Square Richard Moot, Databricks Karen Bajza-Terlouw, Google Kelvin Boateng, NEAR Maria Yarotska, Atlassian Warren Marusiak.

**원문 규칙 / 감점 요소**
- Richard: 영상으로 먼저 맥락을 얻고 테스트한다. 심사 기준 하나에만 과하게 치우치면 점수가 깎인다.
- Karen: 기본 요건 미충족이 흔하다. **모호함, 세련된 인트로에 비해 빈약한 코드·세부사항**은 red flag. 음성 설명과 실제 프로젝트 구성요소를 함께 보여준 사례를 좋게 봤다.
- Kelvin: 최종 사용자 경험, 성능, 시각적 매력을 확인한다. 템플릿 색만 바꾼 결과물은 좋은 점수를 받기 어렵다.
- Maria: 기술만이 아니라 본인이 이해하는 문제와 맥락이 중요하다.
- Warren: 프롬프트가 여러 제품의 협업을 요구한다면 그 실제 사용례를 보여줘야 높은 점수를 줄 수 있다.

**Street Fitting 적용 [추론/제안]**
- Impact만 설명하는 관광·시장 다큐멘터리도, 모델 7개를 읽는 기술 목록도 피한다.
- 사용자의 입력 → 실제 툴 호출/검색 결과 → 선택된 의상 → 피팅 결과를 연결해 “기본 API wrapper 이상”임을 증명한다.
- 영상의 24초 기술 장면은 **그럴듯한 설명 슬라이드만으로 끝내지 않고 실제 run의 산출물**과 연결한다.
- 혼자 만들었다는 사실은 차별화할 수 있으나 개발자 자기소개에 시연 시간을 희생하지 않는다.

### S4. AngelHack 운영 전문가: “10 Hackathon Demo Tips From Behind the Scenes”
URL: https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/
저자: Estelle Chua, Operations Lead. 페이지 표시 날짜 2026-08-25.

**원문 규칙**
- 3분 기준 권장: **0:00–0:30 문제/한 줄 솔루션, 0:30–2:00 live 또는 recorded demo, 2:00–2:30 tech stack와 어려웠던 부분, 2:30–3:00 다음 단계/영향**.
- 시간 배분의 비율이 정확한 시각보다 중요하며 demo가 대략 절반은 되어야 한다.
- 핵심 엔지니어링 의사결정을 소리 내어 설명한다. 백엔드에 어려운 일이 있어도 프런트엔드 화면 위에서 설명할 수 있다.
- AI를 썼다는 말 대신 **어떤 모델, 왜 선택했는지, 출력 품질을 어떻게 확인했는지** 말한다.
- 이미 보이는 폼을 읽어주지 말고 검색 파이프라인·모델 라우팅 등 안 보이는 일을 설명한다.
- 슬라이드는 선택사항이며, 있다면 문제 또는 architecture용 한두 장이면 충분하다.
- recorded backup을 준비하고, 긴 API 대기 때문에 발표가 멈추지 않도록 준비한다.

**Street Fitting 적용 [추론/제안]**
- 현재 원안의 demo 100초 + tech 25초는 방향 자체는 타당하다. 바꿔야 할 핵심은 **첫 시연이 35초나 늦는 점**과 **촬영·복귀보다 차별적인 피팅/프라이버시에 시간이 짧은 점**이다.
- 모델별 긴 설명 대신 “local retrieval avoids uploading the whole photo library”, “tool calls ground the query in the captured clothes”처럼 구현상 선택 이유를 보인다. 실제 구현과 검증되었을 때만 말한다.
- 출력 품질을 검증하지 않았다면 “accurate”, “perfect fit” 같은 말을 하지 않는다. 영상에서 이 입력에 대한 실제 결과를 보여주는 범위로 제한한다.
- 이 글의 cached/fixture 조언은 무대 사고 예방 맥락이다. 이번 영상에서 **가짜 API 응답을 실제 추론인 것처럼 보여주는 근거로 쓰지 않는다**.

### S5. ETHGlobal 공식: demo 시간·대기 편집·추천 사례
URL: https://ethglobal.com/events/hackfs2023/info/details

**원문 규칙**
- 2–4분 영상, 배경 이야기는 20초 이하, 명확한 말속도와 잡음 억제.
- “Show your project in action” / “The video can be edited to remove any unnecessary waiting”.
- 반대로 “DO NOT speed up the video to fit under the time limit”.
- 슬라이드 최대 네 bullet, 720p 이상. 텍스트+음악만으로 설명하거나 AI voiceover를 쓰는 방식은 해당 대회에서 금지.
- Iris, Splits 등 추천 프로젝트 목록을 제공한다.

**적용 [추론/제안]**
- **대기를 잘라내는 것**과 **영상 전체를 배속해서 규격에 우겨넣는 것**을 구분할 근거가 명확하다.
- 실제 API 요청·로딩 시작·결과 도착은 보여주고, 중간 idle만 jump cut 또는 제한된 speed-up으로 줄이는 편집을 권장한다. 다만 이 출처는 Meta 규칙이 아니므로 Meta에서 배속이 허용된다고 단정할 수 없다. 가장 안전한 기본형은 **대기만 잘라내고 잘랐음을 표시**하는 것이다.
- “Live demo”라는 제목보다는 `Recorded on Android · real app run`이 정직하다. 사전 녹화는 실제 작동의 증거가 될 수 있지만 실시간 latency를 입증하지는 않는다.
- 공개 가능하면 같은 run의 무편집 녹화를 repo/제출 설명에 보조 링크로 두면 신뢰를 강화할 수 있다. **[추론/제안]이며 공식 필수 제출물은 아니다.**

### S6. YC Geoff Ralston: “A Guide to Demo Day Presentations”
URL: https://www.ycombinator.com/blog/guide-to-demo-day-pitches/

**원문 규칙**
- 청중이 기억할 핵심은 보통 3–4개뿐이다.
- “무엇을 하는지” 설명을 늦추는 것은 항상 실수. 간단하고 구체적인 설명이 jargon보다 낫다.
- 문제 소개를 너무 오래 끌지 말고 가장 강한 사실을 묻어두지 않는다.
- 한 슬라이드 한 요점. 화면을 읽으면서 다른 말을 듣게 강요하지 않는다. 복잡한 도표와 작은 글자를 피한다.
- 거짓말·과장은 치명적이다. 느리고 또렷하게 말하고 연습한다.

**적용 범위 주의**
- 이 글은 **투자자 대상 무대 피치** 지침이다. “동영상/데모를 피하라”는 부분을 hackathon **제출 데모 영상**에 옮기면 맥락 오류다.
- YC 지원자 소개 영상 지침 https://www.ycombinator.com/video 역시 1분 창업자 소개용이지 3분 제품 시연 가이드가 아니다. 따라서 founder talking head 1분을 권하는 근거로 사용하지 않는다.

**Street Fitting 적용 [추론/제안]**
- 기억할 축은 `Find it → Try it → Walk back`, 기술적으로 기억할 하나는 `Face masking before upload` 정도다. 각 모델명을 외우게 하는 구성이 아니다.
- architecture 한 장에서 모든 노드를 동시에 읽게 하지 않고, 음성 설명에 맞는 가지 한 개씩 밝힌다.

### S7. JetBrains: 실제 심사위원들의 최근 조언
URL: https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/
저자: Katherine Druckman. Jono Bacon, Avi Press, Bonnie Xu, Jan-Niklas Wortmann, Colin Lowenberg 인터뷰.

**원문 규칙**
- 심사위원이 문제에 공감하게 시작한다. 기술 도구보다 본인이 겪은 불편에서 출발한다.
- 여러 기능의 반쯤 된 소개보다 **한 가지 끝까지 되는 흐름**과 “이제 이게 가능하다”는 순간이 강하다.
- 약 90초 안에 작동하는 것을 보여줄 수 있어야 한다.
- 무엇이 되고, 안 되고, 어떻게 되는지를 직접적으로 말하라.

**적용 [추론/제안]**
- 동묘의 이름 없는 노점은 일반 쇼핑 앱보다 강한 개인적 맥락이다. 시장 전체를 설명하기보다 “I saw this jacket. An hour later, I couldn't find the stall.”처럼 한 상황으로 시작한다.
- 이 기사에는 “Mock the slow API call” 조언도 실려 있다. 이번 과업은 작동 증명이 핵심이므로 **그 부분은 채택하지 않는다.** 실제 녹화의 대기를 명시적으로 압축하는 것과 mocked output은 다르다.

### S8. FTC: 프라이버시/성능 주장에 대한 근거와 명료한 공개
URL: https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start

**원문 규칙**
- 앱 기능에 관한 객관적 주장은 solid proof가 필요하다.
- 주장에 필요한 제한조건은 clear and conspicuous해야 한다. 작은 글씨·모호한 링크에 숨기지 않는다.
- 수집하는 정보와 쓰임, 다른 회사와 공유하는 정보를 투명하게 설명한다.
- 실제 운영이 개인정보 보호 약속과 일치해야 한다. 정밀 위치정보 등 민감정보 수집에는 동의가 중요하다.

**Street Fitting 적용 [추론/제안]**
- 일반 해커톤 점수 규칙이 아니라 **신뢰할 수 있는 공개 주장 원칙**으로 사용한다.
- 프라이버시 8–10초 시퀀스: **입력 인물 → 얼굴/머리카락 mask가 적용된 실제 전송 이미지 → Meta API 경계 → 로컬 face recomposition 결과**.
- `On phone` / `Sent to Meta API`를 크게 표시한다. 자물쇠 아이콘이나 “privacy-first”라는 슬로건만으로는 경계를 설명하지 못한다.
- AI 생성 데모 인물이라는 라벨을 처음 등장할 때 붙인다. AI 인물 사용은 실존 인물 노출을 줄이지만 앱의 프라이버시 보장을 증명하지는 않는다.
- 얼굴을 가린다고 몸·옷·배경·위치까지 비식별화되는 것은 아니다. “Anonymous”, “No personal data uploaded”, “Zero retention” 같은 더 넓은 주장은 별도 근거 없이는 제외한다.

### S9. Meta / Cerebral Valley 공개 페이지: 확인 범위
URL: https://cerebralvalley.ai/e/meta-ai-developer-hackathon

직접 확인: Indie developer track은 creativity, technical ambition, whether it works를 강조한다. “Build for Your World”는 본인이 아는 문제를 해결하는 테마다. 공개 본문은 모델/파트너, 일정, 테마와 참가 조건을 설명한다.

**이번 공개 페이지 텍스트에서 확인되지 않은 것**: 상세 배점 30/25/20/25, 3분 영상 규정, opening disclosure의 정확한 문구, 편집·배속 허용 범위. 이 문서에서는 이들을 독립 웹 검증 사실로 쓰지 않고 **과업 brief가 제공한 공식 요건**으로 취급했다. waiver는 검색 결과에 존재하지만 read 시 Loading만 반환되어 추가 문구를 확인하지 못했다.

**적용**: 첫 줄 공개문은 hook보다 우선한다. 다만 5초 검은 카드만 둘 필요는 없다. 한 줄을 말하고 읽을 수 있게 보여준 뒤 곧바로 동일한 동묘 장면으로 연결할 수 있다. 정확한 pre-existing / built-during 내용은 사실확인된 범위만 기입한다. 이 연구가 기존 작업의 범위를 추정하지 않는다.

## 3. 실제 녹화와 API latency 압축: 권장 제작 규약

아래는 S1/S3/S5/S6/S8에서 도출한 **[추론/제안]**이며 Meta가 명시한 편집 정책이라는 뜻은 아니다.

1. 하나의 실제 run을 화면 녹화한다. 같은 옷·같은 쿼리·같은 인물·같은 결과가 이어지는지 유지한다.
2. 쿼리/탭 입력, 처리 시작, 최종 결과는 남긴다. 반복 대기만 잘라낸다.
3. 잘린 지점에 `Wait shortened`를 표시한다. 실제 로그가 있으면 `Actual generation: 28s`처럼 **해당 run의 측정값만** 붙인다. 28초는 예시이지 현재 앱 측정값이 아니다.
4. run 전체를 빠르게 만들거나 음성을 배속하지 않는다. 영상 앞에 작은 “edited” 한 단어를 넣었다고 모든 latency 오인을 해결했다고 보지 않는다.
5. 생성 결과를 사전 제작 이미지로 대체하지 않는다. cached result를 쓰면 cached라고 표시하고 방금 입력에 대한 live inference처럼 말하지 않는다.
6. 실제 장치 화면은 크게, 모델 라벨은 작지만 읽히게. API key·개인정보·정밀 위치 노출이 불필요한 로그는 편집한다. 편집했음을 숨기기 위해 결과 자체를 재제작하지 않는다.
7. 영상에서 `live`는 실시간성과 혼동된다. 제출용은 “real app recording”으로 설명하고, latency는 실제 측정 증거가 있을 때만 주장한다.

## 4. 30초 미만 under-the-hood: 명확한 권장 형식

**24초, 한 캔버스, 3번의 포커스 이동. 별도 기술 슬라이드 덱 없음.** [추론/제안; S1/S3/S4/S6/S8]

- **첫 8초 — Find**: `Voice → Transcribe → Muse Spark tool calls → local PE-Core index`의 실제 검색 trace 일부와 선택된 옷 사진을 연결한다. 화면에는 `PHONE` / `META API` 두 영역. *클라우드가 로컬 검색을 어떻게 호출하는지*는 실제 구현의 데이터 경계와 일치시키며, 전체 사진 인덱스를 서버에 업로드한다고 오해시키지 않는다.
- **다음 8초 — Select**: 같은 사진 위 SAM 3.1의 의상 후보와 EdgeTAM의 tap refinement를 보여준다. 모델 라벨은 기능 위에 붙인다. 설명의 핵심은 “scene → candidate → exact garment”이지 모델 2개를 썼다는 숫자가 아니다.
- **마지막 8초 — Try safely**: 원본 인물/마스킹된 요청/결과 합성의 작은 이미지 세 장을 데이터 화살표에 대응시킨다. `Mask on phone → Muse Image → Restore face on phone`. 음성·의상/장면 등 다른 데이터도 전송된다면 “masked image is the only uploaded data”라고 말하지 않는다.

기술명 전체를 내레이션으로 낭독할 필요 없다. 이름은 정확히 화면에, 말은 역할과 선택 이유에 쓴다. 공개용 편집 그래픽이면 **설명용 오버레이**임을 알아볼 수 있게 하며 앱이 실제로 제공하지 않는 실시간 trace UI를 제품 기능인 것처럼 꾸미지 않는다. 실제 trace가 없다면 실제 입출력 이미지+정직한 데이터 흐름 그림까지만 보여준다. 마지막에 repo 경로/링크가 있어 더 자세한 검증으로 연결되면 충분하다.

## 5. 가이드가 인용한 좋은 프로젝트 2개: 영상 직접 확인

두 영상 모두 Devpost 창업자 가이드 S2가 **문제 설정 예시로 직접 링크한 프로젝트**다. 둘 다 높은 조회수 레퍼런스는 아니다. 이 절의 선택 이유는 조회수가 아니라 **전문가 지침과 실제 구현 시연의 연결**이다. 5초 간격 프레임과 자동 자막으로 구간을 확인했으므로 컷 경계는 약 ±2–3초, 빠른 효과·배속 유무는 샘플링만으로 확정하지 않는다.

### A. “The Homework Machine - 1st Place at PennApps S14”

- URL: https://www.youtube.com/watch?v=Xj_ApMyzXoA
- 채널: Major League Hacking
- 길이: **1:11 (71초)**
- 조회수: **7,584**, 2026-11-04 yt-dlp 메타데이터 관찰
- 업로드: 2014-02-18
- 관련성: 짧은 인터뷰+B-roll만으로 “어떤 문제를 해결하는 물건인지”와 하드웨어·비전의 어려움을 연결한다. 3분 제출물의 완전한 템플릿은 아니지만 **짧은 tech explanation을 동작 화면 위에 싣는 법**의 사례.
- 추천 연결: S2 → https://devpost.com/software/the-homework-machine → 같은 프로젝트의 MLH 영상. 프로젝트 페이지 본문은 403으로 접근되지 않았으며 제목·우승 정보는 영상 설명에서도 확인된다.

| 시간 | 실제 말/화면 관찰 |
|---|---|
| 0:00–0:07 | 두 개발자가 카메라 앞에서 이름·학교·프로젝트를 소개. MLH 로고, 하단 이름표 등장. |
| 0:07–0:17 | 어린 시절 꿈 같은 프로젝트라는 설명. “give it a math worksheet and it fills it out in your handwriting”라는 핵심 가치. 약 15초 프레임에는 로봇과 종이 worksheet. |
| 0:17–0:28 | 손글씨 stroke 분석·컴퓨터 비전 설명. 로봇 화면에서 두 개발자 인터뷰 화면으로 돌아옴. |
| 0:28–0:38 | worksheet 자체의 구조·레이아웃을 읽는 설명. 화면은 개발자 중심. 자동 자막의 라이브러리 이름은 오인식이 있어 정확한 이름으로 재인용하지 않음. |
| 0:38–0:54 | 모터·줄 길이·펜 위치 제어를 설명. 약 40–45초에는 실제 pen rig, 약 50초에는 개발자. |
| 0:54–1:05 | 첫 hardware hack, 부품 부족으로 주변 물건을 사용했다는 제작 설명. 카메라가 펜/임시 rig를 더 가깝게 보여줌. |
| 1:05–1:11 | 두 개발자 화면으로 돌아와 작동 경험을 짧게 정리하고 종료. |

**화면 구성/편집**: 개발자 medium two-shot과 실제 장치 close-up을 번갈아 배치. 하단 이름표, 좌상단 MLH 로고가 관찰된다. 전체 나레이션 자막이나 모델 태그, 화살표 callout은 샘플 프레임에서 보이지 않는다. 장치의 framing이 후반에 더 가까워진다. 컷 연결 중심으로 보이나 정확한 transition effect·speed ramp 유무는 **미확인**.

**working demo / AI / 기술 깊이**: 실제 종이·펜·모터·장치가 등장하여 물리적 구현을 보여준다. 비전/손글씨 분석을 구두로 설명하지만 현대 generative AI demo는 아니며, 화면만으로 OCR 전체 파이프라인이나 성공률이 검증되는 것은 아니다.

**빌릴 것 [추론/제안]**: 구현 설명을 별도 코드 스크롤이 아닌 **실제 산출물의 close-up** 위에서 한다. Street Fitting에서는 mask·candidate·try-on result가 이에 대응한다.
**피할 것 [추론/제안]**: 시작 자기소개 7초, 기술 토크에 비해 입력→완료 결과가 명료하지 않은 구성. 우리 영상은 한 번의 끝까지 되는 사용자 run을 더 직접적으로 보인다.

자료: `/tmp/vidref/Xj_ApMyzXoA.info.json`, `.en.vtt`, `.mp4`, `-grid.jpg`.

### B. “Vrban | Hackathon Highlights | Disrupt NY 2014”

- URL: https://www.youtube.com/watch?v=Y9fc2O7LmdQ
- 채널: TechCrunch
- 길이: **2:10 (130초)**
- 조회수: **1,994**, 2026-11-04 yt-dlp 메타데이터 관찰
- 업로드: 2014-05-07
- 관련성: 약 2분, 실제 개인 경험 문제 → 실제 도구 작동 → 구체적인 사용례 → 처음 문제로 돌아오는 마무리. **현실 세계의 장소를 다루는 도구**여서 동묘 촬영/복귀 스토리와 특히 잘 맞는다.
- 추천 연결: S2 → https://devpost.com/software/vrban → 해당 수상 프로젝트의 TechCrunch 무대 기록. 특정 편집본을 Devpost가 추천했다는 의미는 아니다.

| 시간 | 실제 말/화면 관찰 |
|---|---|
| 0:00–0:16 | 두 사회자가 해커톤 1등/$5,000 수상자를 소개. 제품 데모 시간이 아닌 행사 문맥. |
| 0:16–0:24 | 제작자가 “virtual reality urban planning and exploration tool”이라고 한 줄로 정의. 무대의 제작자, 이어 제품 웹 화면과 우하단 발표자 PiP. |
| 0:24–0:38 | 대학 신축 건물이 천문대의 하늘 시야를 가린 개인 경험. 설명 중 이미 가상 도시 화면이 등장한다. |
| 0:38–0:54 | Philadelphia 지도/평면 정보 → CityEngine → 도시 3D 모델이라는 기술 흐름 설명. 지도 창과 VR 양안 화면을 보여준다. |
| 0:54–1:15 | Oculus Rift를 착용한 협력자가 도시를 실시간으로 본다. 초록색 건물이 신규 건축 제안임을 설명. PiP가 실제 착용자로 바뀌어 물리적 사용자와 결과를 연결. |
| 1:15–1:27 | 건물이 햇빛과 시야를 가릴 수 있다는 문제를 재제기, 도시계획 협업으로 전환. |
| 1:27–1:44 | 발표자의 휴대전화로 건물을 옮기고, 청중의 다른 사용자도 참여할 수 있다고 설명. 메인 화면 속 초록 건물의 위치 변화. |
| 1:44–2:00 | 관찰자를 다른 위치/건물 위로 옮겨 시야를 비교하고 sunlight를 제어할 수 있음을 시연/설명. |
| 2:00–2:07 | “smarter cities and better decisions”, 제품 이름/URL, 감사 인사. |
| 2:07–2:10 | 사회자 반응으로 종료. |

**화면 구성/편집**: 첫 20초쯤은 무대 인물. 이후 가상 도시/지도 화면을 크게, 발표자 또는 Rift 착용자를 우하단 PiP로 유지한다. 제품 화면은 stereo VR이라 같은 장면이 양쪽에 반복되고 데스크톱 chrome이 보인다. 컷 전환으로 PiP 대상이 바뀐 것은 프레임에서 확인된다. 외부 강조 자막, AI model badge, zoom callout은 샘플 프레임에서 관찰되지 않는다. speed-ramp 여부는 미확인이다.

**working demo / AI / 기술 깊이**: 발표자의 조작과 도시 변화, 실제 headset 사용자를 함께 보여주는 강한 인과관계. 기술은 별도 appendix 없이 0:38–0:54의 **지도 입력→모델 생성→VR 출력**으로 설명된다. 현대 AI 모델 사용 사례는 아니다.

**빌릴 것 [추론/제안]**: 기능 설명마다 같은 원래 문제(햇빛·시야)를 이어가며 마지막 가치 문장이 결과와 맞물린다. Street Fitting도 같은 옷의 물리적 장소로 돌아가야 한다. 입력 장치/실제 사용자와 결과가 동시에 보여야 하는 순간에만 PiP를 쓴다.
**피할 것 [추론/제안]**: 행사 소개 16초, 긴 발표자 등장, 작은 데스크톱 chrome, 동일 화면 반복. 제출 영상에는 제거하고 폰 실제 동작을 크게 보여준다.

자료: `/tmp/vidref/Y9fc2O7LmdQ.info.json`, `.en.vtt`, `.mp4`, `-grid.jpg`.

## 6. 권장 최종 구조: 2:55 완성본, 최대 3:00 안쪽

아래 초 배분은 **[추론/제안]**이다. 근거: S1/S2의 빠른 overview와 문제 해결, S3의 기준 균형, S4의 demo 중심+짧은 기술, S5의 대기 편집, S8의 구체적인 privacy disclosure. 원안의 골격은 유지하되 도입을 줄여 차별적 결과와 신뢰 증거로 이동시킨다.

| 시각 | 길이 | 역할 / 무엇이 보여야 하는가 |
|---|---:|---|
| **0:00–0:05** | 5초 | **필수 pre-existing vs hackathon-built 한 줄 공개**. 정확한 사실만. 읽고 듣기 충분한 한 문장으로 제한. 이 요건을 hook 때문에 뒤로 미루지 않음. |
| **0:05–0:18** | 13초 | **문제+한 줄 솔루션**. 동묘의 이름 없는 노점/옷 한 벌. “I found a jacket here. An hour later, I couldn't find the stall.” → Street Fitting은 사진에서 옷을 찾아 입어 보고 돌아가게 해준다는 한 문장. |
| **0:18–0:32** | 14초 | **Capture**. 실제 사진 입력과 위치가 함께 남는 결과. 반복 촬영·등록 절차보다 한 장이 저장되는 증거. |
| **0:32–1:02** | 30초 | **Find**. 본인의 영어 voice query → 인식된 쿼리 → 실제 검색/의상 후보 → 원하는 옷 선택. 화면 위 작은 기능별 Meta 모델 라벨. |
| **1:02–1:50** | 48초 | **Try it**. 옷장/다른 노점의 companion pieces를 고르고, tap-to-segment, 실제 생성 결과를 충분히 본다. 이 안에 **8–10초 privacy pre-upload mask 증거** 포함. 최대 5개 기능은 실제 선택/결과로 입증 가능한 범위에서 표현. AI-generated demo person 라벨. 대기 압축은 표시. |
| **1:50–2:13** | 23초 | **Walk back / story payoff**. 선택한 바로 그 옷의 촬영 위치/경로 → 실제 같은 노점 또는 동일 장소 확인 장면. 지도만 띄우고 해결됐다고 하지 않음. |
| **2:13–2:37** | 24초 | **Under the hood**. 위 4절의 PHONE / META API 단일 데이터 흐름. 8초 검색, 8초 후보/선택, 8초 마스킹/생성/로컬 합성. 방금 본 결과를 재사용. |
| **2:37–2:55** | 18초 | **Impact와 마무리**. “Find the piece. Try the outfit. Walk back.”처럼 이미 입증한 가치를 요약. 솔로 제작 사실/테마와 연결 가능한 짧은 문장, 제품명과 repo를 읽을 수 있는 마감 프레임. 긴 roadmap/사업계획 없음. |
| **2:55–3:00** | 5초 여유 | 목표 러닝타임은 2:55. 제출 파일에 추가 5초 black을 의무로 넣으라는 뜻이 아니며, 제한 초과를 막는 제작 여유다. |

### 반복되는 구조적 패턴

1. **사용자를 빨리 규정 → 한 문제를 단순하게 정의 → 작동으로 해결 → 짧은 기술·영향**. 기술이 별도 장이거나 데모 안에 섞이는 차이는 있지만 긴 도입이 공통 권장은 아니다.
2. 좋은 데모는 화면이 설명을 대체한다. 더 많은 기능·모델·애니메이션보다 **같은 입력의 결과를 믿게 만드는 연결**이 중요하다.
3. **실제 동작과 엔지니어링 증거는 양자택일이 아니다.** 옷 후보, mask, 실제 tool output처럼 기술 산출물을 제품 장면에 붙이면 둘 다 충족한다.
4. 과장·모호함·판독 불가능한 화면·접근 불가 링크·형식 요건 미준수·시연 없는 설명이 반복적인 실패 요인이다.
5. Street Fitting에서 차별화할 마지막 10점은 더 화려한 영상이 아니라 **이름 없는 동묘 노점의 개인적 문제, 실제 동작, 클라우드/온디바이스 경계를 정직하게 보여주는 것**이다. 이는 효과에 대한 [추론]이며 심사 결과를 보장하는 주장이 아니다.
