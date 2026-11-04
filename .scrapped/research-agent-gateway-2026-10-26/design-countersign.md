# 설계 D3: Countersign (커머스·커뮤니티 각도)

2026-10-26. 담당: 주문·리뷰·Q&A·드롭. 표기: [확인] 원문, [확인·2차] 2차 보도, [미확인], [코퍼스] 로컬 코퍼스만, [추론]. 인용은 (파일명 §절)·[URL].

## 1. 이름과 피치

- **Countersign**: 쇼핑 에이전트의 주문·리뷰·문의에 플랫폼이 맞서명하는 마켓플레이스용 Poppy 호환 게이트웨이(서명 네 겹: 에이전트·플랫폼 영수증·사람 패스키·증인).
- EN: "Countersign is a Poppy-compatible gateway that lets marketplaces welcome shopping agents through a faster lane, answers them with aggregates instead of other shoppers' data, and countersigns every order and review into a witnessed log, so 'agent-written, buyer-approved, verified purchase' becomes a badge anyone can check."
- KR: "Countersign은 쇼핑 에이전트를 막는 대신 빠른 차선으로 받아들이고, 다른 구매자 정보는 집계로만 내주며, 에이전트의 주문·리뷰를 증인이 지켜보는 로그에 맞서명해 'AI 작성·구매자 승인·실구매' 배지를 누구나 검증하게 하는 마켓플레이스용 Poppy 호환 게이트웨이다."

## 2. 시나리오와 등장인물

무대는 **오롯마켓**(가상, 실존 업체와 무관)이다. 리뷰마다 작성자의 키·몸무게·평소 사이즈와 사진이 붙는 의류 오픈마켓으로, Q&A와 토요일 한정판 드롭이 있고, 기존 API 앞에 Countersign을 세워 운영한다.

| 역할 | 누구 | 걸린 것 |
|---|---|---|
| 요청자 A | 서지윤(가상)의 에이전트(우리 Spark 참조 에이전트 또는 서드파티 Poppy Demo Agent) | "163/52인데 트렌치코트 사이즈 골라 주문하고, 오면 사진 넣어 리뷰 써 줘. 드롭도 응모해." |
| 제3자 B | 리뷰어 '민트초코' | 165cm·54kg·평소 M, 사진 속 아이 얼굴, 택배 송장 |
| 제3자 C | Q&A 작성자 | "아이가 아토피인데 안감 괜찮나요?" |
| 제3자 D | 판매자 '작은옷방' | 정확한 재고·판매량, 상담원 실명 |
| 제3자 E·F | 배송기사, 행인 | A의 초안 속 기사 번호, A의 사진 속 행인 얼굴·번호판 |

남용자는 M1 프로필 수집기, M2 드롭 스나이퍼 40계정, M3 리뷰 팜, M4 미서명 computer-use 스크래퍼다. 운영자는 오롯마켓(게이트웨이·로그), 독립 증인 2곳은 데모에서 다른 키·호스트로 띄운 가상 기관이다.

흐름: ① 사이즈 질문엔 남의 체형 원값 대신 "같은 체형 40~44명 중 60%가 S" ② 주문은 A의 패스키 승인과 영수증 ③ 리뷰는 타인 얼굴·번호판·송장·기사 번호를 가린 최종본을 A가 승인해야 배지와 게시 ④ 드롭은 3분 창 추첨 ⑤ B는 "내 리뷰가 닿은 요청" 리포트. 원안 문장의 커머스판 기본값(D2)은 "다른 구매자 체형은 드릴 수 없지만 비슷한 체형 대부분이 S를 골랐습니다"이고, "'민트초코'(165cm대)는 M이 컸답니다"는 B가 opt-in했을 때(D4)만 나간다.

## 3. 문제의 증거

1. **식별되면 통로, 아니면 차단.** Amazon은 2026-09-20 Muse를 막았다("Continued access by an unauthorized AI agent violates Amazon's Conditions of Use") [https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/ 확인]. 사유는 통지 없음·자기 미식별·자격증명 저장 의혹, 요구는 "should operate openly"다(ledger.md §1-D). 같은 시기 Shopify는 Muse의 Shop Pay 결제를 위해 Meta와 제휴했다(Quartz 인용) [https://letsdatascience.com/news/amazon-blocks-meta-muse-as-shopify-enables-checkout-85276e25 확인·2차].
2. **마켓에서의 무승인 행동.** Facebook Marketplace에서 Muse가 판매자 확인 없이 $10 제안을 받고 집 주소를 구매자에게 줬다는 보도(Threads 게시물 기반, "allegedly") [https://propakistani.pk/2026/09/28/meta-ai-agent-shared-user-address-on-facebook-marketplace-sold-item-without-permission/ 확인·2차]. Poppy도 `approved_by`가 "doesn't prove that the User saw the terms or approved them"라고 적는다 [https://personalagentprotocol.org/docs/0.3/extensions/operations 확인].
3. **리뷰는 에이전트 산출물이 공개 콘텐츠가 되는 자리.** FTC 규칙(2024-08-14)은 "AI-generated fake reviews"·실경험 없는 리뷰와, 평점·부정 감정으로 숨긴 리뷰가 있는데 전부인 양 하는 표시를 금지한다 [https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials 확인]. AI 기본법 제31조·EU AI Act 제50조도 AI 생성물 표시를 요구하고(ledger.md §1-D), 공정위 추천·보증 심사지침(2024-12-01)은 경제적 이해관계를 "제목 혹은 첫 부분"에 밝히게 했다 [https://news.mtn.co.kr/news-detail/2024112813355447139 확인].
4. **남의 정보는 에이전트 경로로 샌다.** Muse의 비사용자 포함 주변인 페이지 갱신 보도(redteam.md S38), 에이전트 간 메시지 누출 68.8% 대 최종 출력 27.2%(AgentLeak, local.md §3), Muse Spark 단독 CIMemories violations@5 78.3%(privacy.md §0).
5. **물량.** 에이전트 일일 요청은 1년 새 1,700% 넘게 늘었고 판매자 최다 요청은 "charge agents, not humans"였다(redteam.md R1). Salesforce는 "the volume quickly becomes astronomical"이라 했다(local.md §1).
6. **홀드 독점과 속도 편향.** The Verge(2026-10-22)의 Muse·The RealReal 20분 홀드 반복 보도는 코퍼스 기록뿐이다(local.md §1 [미확인], 피치 전 원문 확인). Magentic Marketplace는 속도가 품질보다 10~30배 유리한 first-proposal bias를 보고했다(thesis-opinions.md §29 [코퍼스]).

## 4. 에이전트가 이 통로를 쓰는 이유

공개하면 손해 보는 구조면 에이전트는 숨는다(redteam.md R1). 원칙: **식별된 에이전트는 같은 일에 사람보다 더 내지 않고 더 좋은 서비스를 받는다. 대가는 영수증으로 남는 책임뿐이다.**

| 티어 | 조건 | 받는 것 |
|---|---|---|
| T0 | 미서명 자동화 | 사람 수준 한도, 읽기 전용, 리뷰 3쪽부터 PoW, 홀드·응모 불가, 의심 세션 리뷰는 검수 대기, 429에 poppy.json 안내 |
| T1 | Web Bot Auth 서명 | 카탈로그·D1 사실, 운영자 단위 한도 |
| T2 | T1 + Poppy OAuth 위임(DPoP) | 결과 전용 API, 주문·홀드·드롭 응모, 리뷰 배지·사진 마스킹 대행, 주문 웹훅, 영수증 |
| 파트너 | 계약·감사 동의 | D3 가명 발췌 |

배지와 영수증은 운영사의 규제 증빙(생성물 표시, FTC 실존·실경험 요건)이자 분쟁 증거다 [추론, 법적 검토 전]. PoW는 Hashcash식 폴백이라 단독으론 약하다(ledger.md §1-C).

**computer-use 끌어들이기.** `web.browser_session_endpoint`(Poppy §5)가 주는 폼(128비트 이상·60초 만료 일회용 `code` + 빈 `proof`)에 에이전트가 `nonce=code`, `htm=POST`인 DPoP proof를 넣어 POST하면 그 브라우저가 Poppy 세션에 묶인다 [https://personalagentprotocol.org/docs/0.3/spec 확인]. 자동화 신호가 잡힌 UI 세션엔 이 폼을 인터스티셜로 띄우고, 결속된 UI 행동은 `author.type=agent`로 같은 정책·영수증을 탄다.

**정직한 범위.** UI에 보이는 리뷰어 정보는 computer-use가 언제든 가져간다(경계 안 위임, redteam.md R1). 기술로 막는 것은 레인 안 누적 노출과 대량 수집의 속도·비용이고, 화면에 구간만 보일지는 플랫폼 몫이다.

## 5. 메커니즘 설계

### 5.1 목적·관계에 묶인 공개 등급

데이터 클래스는 `review.body_profile`, `review.text`, `review.photo`, `qa.question`, `seller.stock`이다. 목적은 닫힌 어휘(5.7의 `purposes`)로 받고 `market_research`는 계약 전용이다.

| 등급 | 다른 구매자 리뷰 데이터에 대해 받는 것 | 기본 대상 |
|---|---|---|
| D0 | 무응답, 사람 이관 | 미서명, 목적 미선언 |
| D1 | 상품 사실만(사이즈표, 평균 별점, 재고 밴드) | T1, 예산 소진 |
| D2 | 고정 격자 집계(k≥10): 사이즈 분포, 착용감 태그 비율 | **T2 기본** |
| D3 | D2 + PII를 지운 발췌(위임자·상품별 가명) | 파트너 |
| D4 | D3 + 리뷰어가 opt-in한 체형 구간·마스킹 사진 | 정보주체 opt-in |
| D5 | 원본 | 리뷰어 본인(의 에이전트) |

관계: `self`는 D5, `counterparty`(내 주문의 판매자)는 주문 처리 필드만, `stranger`는 D2 상한. 플랫폼이 상한을 정하고 정보주체는 낮추거나 자기 필드만 D4로 올린다. 판정은 Cedar가 한다(forbid 우선, privacy.md §2.3).

```cedar
forbid (principal, action == Action::"read_rows", resource is ReviewField)
when { resource.class == "body_profile" && !resource.owner_opt_in_d4 && resource.owner != principal.delegator };
```

### 5.2 결과만 반환하는 API

- `fit-advice`: A가 보낸 자기 체형으로 게이트웨이 안에서 셀을 찾아 추천·분포만 준다(A의 원값은 셀 ID로 바꾼 뒤 폐기).
- `review-insights`: 저장 시 로컬 Glimmer가 붙인 착용감·두께·색감 라벨의 비율.
- `qa/ask`: 판매자 답이 있으면 즉답, 다른 질문자 원문은 안 준다. 없으면 판매자에게 "에이전트 문의 23건 병합" 카드 하나, 답은 웹훅으로.
- stranger에게 리뷰를 작성자·체형과 함께 주는 엔드포인트는 없다.

```http
POST /agent/v1/fit-advice   (Host: api.orot.example, Authorization: DPoP ..., DPoP: ...)
Signature-Agent: "https://agent.jiyoon.example"
Signature-Input: sig1=("@method" "@authority" "@path" "content-digest");created=1793596800;expires=1793596860;keyid="NFcW...";alg="ed25519";tag="web-bot-auth"
Signature: sig1=:jdq0...:
Content-Digest: sha-256=:X48E...:

{"product_id":"p_trench_0412","purpose":"fit_check","self_profile":{"height_cm":163,"weight_kg":52,"usual_size":"S"}}
```

```json
{"level":"D2","cell":"h160-164.w50-54",
 "result":{"recommended":"S","distribution":{"S":"60%","M":"35%","L":"5%"},"n_band":"40-44",
           "fit_tags":{"기장_길게":"55%","어깨_작게":"30%"}},
 "withheld":[{"class":"review.body_profile.rows","reason":"policy.level","granted":"D2","required":"D5"},
             {"class":"review.photo","reason":"policy.purpose"}],
 "absent":[], "budget":{"spent":1,"left_today":59}, "receipt":"https://log.orot.example/e/184213"}
```

`withheld`(정책상 비공개)와 `absent`(정보 없음)를 나누되, 셀 인원이 k 미만이면 0명이어도 같은 `policy.k_anonymity`로 답한다. 표시를 레코드가 아닌 정책 단위로 붙여 "그런 사람이 있다"는 부채널을 막는다.

### 5.3 누적 노출 예산과 고정 투영

- **고정 투영**: 키 5cm·몸무게 5kg 격자를 상품마다 하루 한 번 계산해 캐시한다. 셀 ID로만 묻고(임의 구간은 400 `cell_only`) 같은 셀엔 하루 내내 같은 답이다(노이즈 없음, RootGuard 원리, privacy.md §1.2). 인원은 5명 밴드, 비율은 5% 반올림.
- **시간 차분 방어**: 새 리뷰가 k개 이상 쌓일 때만 갱신해 방금 쓴 사람이 1명 차이로 드러나지 않게 한다.
- **예산**: 위임자가 30일 안에 처음 본 (상품, 셀) 또는 발췌 1건이 1단위, 하루 60단위. 키는 회사별 opaque User ID + 운영자 `client_id`, 신규·무구매 계정은 4분의 1(Sybil 비용). 소진되면 D1과 `budget.exhausted`. '민트초코'를 고립시키려는 M1은 이렇게 `cell_only`, 같은 답, D1에 차례로 막힌다.
- **교차 연결 차단**: D3 가명은 (위임자, 상품, 리뷰어)마다 달라 "임부복 + 유아용품" 같은 상품 간 추론을 막는다.

### 5.4 쓰기와 남용 억제

- **주문**: Poppy operations(`revision`, 최대 1회 실행) 그대로다. 비가역 작업엔 `user_approval_required: true`와 `url`을 내려 사람이 **오롯마켓이 그린 승인 페이지**에서 패스키로 승인하고, challenge = SHA-256(operation_id‖revision‖terms‖summary)에 묶인 assertion을 confirm 때 확인한다. 이슈 #39의 "조건을 봤다는 증명" 공백을 회사 쪽에서 메운다(standards.md §1.1).
- **홀드**: 한정 SKU는 T2만, 위임자당 SKU 1개·동시 2개·TTL 10분, 사지 않은 SKU 재홀드는 24시간 쿨다운(20분 홀드 반복 차단). 운영자의 7일 홀드→구매 전환율이 30% 미만이면 상한 절반.
- **드롭**: 3분 응모 창(ledger.md §2)에 사람과 에이전트를 한 풀로, 위임자당 1응모. 증인이 공동서명한 마감 체크포인트 루트를 시드로 HMAC 정렬해 당첨을 정한다(누구나 재계산, 속도 무의미).
- **리뷰**: 배송 완료 주문 줄당 1건, 위임자당 하루 5건. Spark 파서가 초안을 닫힌 스키마(별점, 사이즈 체감, 언급된 사람 span)로 바꾸고 Presidio(KR 엔티티·전화)와 합집합으로 타인 PII를 가린다. 사진은 SAM 3.1("face", "license plate", "paper label")과 OCR+Presidio(송장 글자)로 블러하고, 자기 얼굴 마스크는 승인 페이지에서 A만 푼다. 다른 위임자의 에이전트 리뷰와 MinHash 유사도 0.8 이상이면 검수 대기, 협찬은 배지 첫머리에 "협찬"(추천·보증 지침).
- **중고거래(Could)**: 판매자 주소는 양측이 같은 조건에 패스키 승인한 뒤에만, 그 전엔 동 단위만(3절 2번). 만남 시간은 D1 설계의 후보 k개 방식을 쓴다.

### 5.5 정보주체 리포트

B의 주간 화면: "에이전트 요청 312건이 당신의 리뷰가 든 집계를 받았습니다. 체형 원값·사진 열람 0건, 파트너 발췌 3건, 거절 41건." "집계에서 빼기"와 "체형 구간 공개(D4)" 토글이 있고, 각 줄은 B가 자기 솔트로 여는 로그 항목이다. 판매자 D는 "문의 37건 → 병합 3건"을 본다.

### 5.6 영수증·투명성 로그·앵커링

모든 행위와 거절에 영수증을 낸다. MVP는 JWS, Should는 SCITT Signed Statement + RFC 9942 COSE Receipt 변환이다(ledger.md §1-A).

```json
{"iss":"https://orot.example","seq":184377,"t_bucket":"2026-11-02T14:20+09:00",
 "action":"review.publish","purpose":"review_write","decision":"ALLOW_MASKED",
 "agent_jkt":"NFcW...","delegator_commit":"salted-sha256:6f1c...",
 "provenance":{"author_type":"agent","approved_by":"user",
   "approval":{"method":"webauthn","revision":1,"assertion_sha256":"a91e..."},
   "purchase":"verified:2026-10","incentive":"none"},
 "masked":{"face":1,"license_plate":1,"label":1,"phone":1},
 "content_commit":"salted-sha256:77d2...","policy":"sha256:9c1e...",
 "inclusion":{"tree_size":184380,"proof":["c3f1..."],"cosigned_by":["w1","w2"]}}
```

- **로그**: RFC 9162 Merkle 해시, 60초마다 C2SP signed-note 체크포인트. 증인 2곳은 consistency proof가 맞을 때만 공동서명하고, 매시 루트만 OpenTimestamps로 비트코인에 앵커한다(ledger.md §1-A).
- **공개 범위**: 공개 로그엔 운영자 thumbprint, 행위·목적·판정·등급·정책 해시, 10분 단위 시각, 항목별 솔트 커밋먼트만 둔다(솔트가 항목마다 달라 위임자를 못 잇는다). 원문·솔트는 체인 밖에 두고 탈퇴 시 솔트를 지운다(crypto-shredding, ledger.md §1-A(7)).
- **억제 탐지**: 게시된 리뷰는 모두 `review.publish` 항목을 갖고, 내리거나 고치려면 사유 코드를 단 `review.takedown`/`review.edit` 항목이 필요하다. 모니터가 페이지의 리뷰 커밋먼트를 로그와 대조해 "로그엔 있고 페이지엔 없고 takedown도 없음"을 잡는다. FTC가 금지한 평점 기반 숨김을 기계로 드러낸다. 사람이 쓴 리뷰도 같은 항목을 남기므로 협조 에이전트가 0이어도 가치가 있다(콜드스타트, redteam.md R7).

### 5.7 poppy.json 확장 선언

Poppy는 외부 확장 이름을 소유 도메인으로 시작하게 한다(4절 스펙 링크). `countersign.example`은 자리표시자, 필드명은 0.3 초안 기준이다. 스코프는 `insights:read`(changes none), `orders:write`(irreversible), `reviews:write`(reversible).

```json
{"protocol_version":"0.3","organization":{"name":"오롯마켓(가상)","domain":"orot.example"},
 "web":{"browser_session_endpoint":"https://orot.example/poppy/browser-session"},
 "extensions":{
  "operations":{"version":"1","endpoint":"https://api.orot.example/poppy/operations"},
  "countersign.example/disclosure":{"version":"0",
    "purposes":["fit_check","quality_check","qa_ask","order_place","order_hold","drop_enter","review_write","price_watch"],
    "third_party":{"review.body_profile":{"default":"D2","max_external":"D4","k":10,"grid":"h5cm-w5kg-v1"},
                   "review.photo":{"default":"D2","max_external":"D4","mask":["face","license plate","paper label"]}},
    "budget":{"unit":"new_cell_or_excerpt","per_delegator_day":60}},
  "countersign.example/receipts":{"version":"0","log":"https://log.orot.example",
    "witnesses":["https://w1.example","https://w2.example"],"anchor":"opentimestamps","approval_proof":"webauthn"}}}
```

## 6. 아키텍처

```
A의 에이전트(Spark)·Poppy Demo Agent ─ RFC 9421 + OAuth/DPoP ─┐   M4 미서명 ─┐
Edge(Hono): 서명 검증·티어 T0/T1/T2·레이트리밋·PoW·브라우저 세션 결속 ◀─┴─────────┘
  ├─ [A] Parser(Spark, 외부 자유 텍스트만) → 닫힌 JSON → 결정적 검증기
  ├─ Policy(Cedar) → 등급·정책 해시 ─ Projection(격자·k·배치) ─ 오롯마켓 DB
  ├─ Ops: 주문·홀드·드롭 추첨·리뷰 operation ─ 패스키 승인 페이지
  ├─ Media Mask: SAM 3.1 + OCR + Presidio
  ├─ [C] Phraser(Spark, 허용 필드만) → Egress 검사
  └─ Receipt → Merkle Log → Checkpoint → Witness×2 → OTS(매시)
[B] Labeler: Glimmer 30B 로컬(저장 시 라벨링, 외부 요청 못 봄) · 솔트 저장소 분리
UI: 상품·배지 검증 · 정보주체 리포트 · 감사 콘솔 · 누출 미터
```

| LLM 컨텍스트 | [A] 비신뢰 입력 | [B] 타인 데이터 | [C] 외부 응답·상태 변경 | 출력 통제 |
|---|---|---|---|---|
| Parser(Spark) | O 메시지·Q&A·리뷰 초안 | X | X | 닫힌 JSON, 재검증 |
| Labeler(Glimmer) | △ 남의 리뷰(UGC) | O 비밀글 Q&A 등 | X | 라벨 enum만 |
| Phraser(Spark) | X | X(허용 집계만) | O 대화 응답 | Egress 검사, 실패 시 템플릿 |
| Cedar·Projection·Mask | 코드 | 코드 | 코드 | 결정적 |

- 라벨러가 UGC 속 주입에 오염돼도 C가 없어 피해는 집계 왜곡에 그친다. LLM은 자유 텍스트 경로에만 쓰고 fit-advice·insights·주문은 LLM 없이 처리한다. 비신뢰 초안이 공개 게시로 이어지는 리뷰 경로엔 사람의 패스키 승인을 붙인다(Rule of Two, privacy.md §2.1).
- 저장소는 SQLite, 로그는 append-only 테이블·체크포인트 파일. D1·D2 설계와 공유하는 코어는 Cedar·D0~D5·티어·원장이고, 커머스 고유는 격자 투영·Media Mask·리뷰 출처·억제 탐지·드롭 추첨이다.

## 7. Meta 도구 지도

| 도구 | 역할 | 억지가 아닌 이유 |
|---|---|---|
| Muse Spark 1.3(Standard) | 인바운드 파서, 회사 측 대화 문장, 참조 구매 에이전트, 레드팀 M1~M3, computer-use 기준선(Cookbook, meta.md §2) | 자유 텍스트 구조화와 양측 에이전트가 실제로 필요하다. 경계가 Cedar라 단독 CIMemories 78.3%가 위험이 안 됨을 같은 지표로 보인다 |
| Muse Glimmer 30B(로컬) | 저장 시 리뷰·Q&A 라벨(착용감 태그, 아동·건강 언급 플래그) | 남의 원문이 클라우드로 안 간다. Cookbook "Local agent that asks first"의 회사 쪽 판(meta.md §4) |
| SAM 3.1 | 리뷰 사진의 얼굴·번호판·라벨 마스크 | 원안의 "리뷰 작성"에 직결. 명사구당 1요청, 1천 장당 $2.50(meta.md §4). 식별은 안 한다(AUP) |
| Prompt Guard 2(선택) | 주입 점수 기록(신호로만) | 한국어 미평가(privacy.md §2.4) |
| 쓰지 않음 | Muse Image(증거 변형), `-contributor`(개인정보 금지), Wonder(비쌈) | |

- **예상 밖 능력**: Glimmer와 Spark의 라벨 일치도를 사람 정답 300건에 재서 "로컬 30B면 충분한 구간"을 보인다(meta.md §4).
- **데이터 정책**: 전부 Standard 모드. 원본 타 사용자 레코드(체형, Q&A 원문, 구매 이력)는 Spark로 보내지 않는다. 사진은 운영 시 SAM 3.1 셀프호스트가 원칙이고(privacy.md §3), 해커톤은 동의·합성 사진만 쓰므로 API를 쓴다. Muse Code도 Standard로(meta.md §2).
- **비용**(가정: Spark 입력 $1.25·캐시 $0.15·출력 $4.25 per 1M, reasoning 최소, local.md §5): 파서 3,000회×$0.0026 ≈ $8, 에이전트 턴 4,000회×$0.0085 ≈ $34, B3 750회×$0.027 ≈ $20, 리뷰 합성 ≈ $8, SAM 1,800회 ≈ $5. **약 $75**, reasoning 기본값이면 상한 약 $200으로 1인 크레딧 $150 안팎이다(meta.md §7).

## 8. 기술 스택

- **게이트웨이·로그·증인**(TypeScript, Hono): `web-bot-auth` 0.2.0·`http-message-sig` 0.3.0, `jose` 6.2.13, `@noble/curves` 2.4.0(ledger.md §1-E), `@cedar-policy/cedar-wasm`, `@simplewebauthn`. Merkle 로그는 RFC 9162 직접 구현을 `pymerkle` 7.0.0으로 교차검증(테스트 전용, GPL-3.0).
- **마스킹**(Python, FastAPI): Presidio(KR_RRN 등 + 전화 정규식), Tesseract kor, SAM 3.1(`sam-3.1`).
- **모델**: Spark는 OpenAI 호환 SDK(`https://api.meta.ai/v1`), Glimmer는 GGUF Q4_K_M 16.8GB를 llama.cpp b10353+ `--jinja`로(meta.md §2·§3).
- **기타**: `opentimestamps-client` 0.7.2, React+Vite, SQLite, pytest·`datasketch`(무표기는 최신 안정판).
- **상호운용**: Poppy Demo Agent(poppydemoagent.dev `/validator`, Apache-2.0, 0.1·0.2, allowlist면 등록 필요) [https://github.com/adewale/pda 확인], Cliffside Retail(가상 매장 + `/inspect`) [https://personalagentprotocol.org/docs/demos 확인].

```
countersign/  apps/{market,gateway,log,witness,console}  packages/{policy,projection,receipts,profile,agents}
              services/{mask,labeler,anchor}  eval/
```

## 9. 10일 MVP

| 구분 | 범위 |
|---|---|
| Must | ① 합성 데이터·UI 최소(상품 3개, 리뷰, 배지) ② Edge(RFC 9421, Poppy OAuth/DPoP, 티어, 429) ③ fit-advice·insights(Cedar, 투영, 예산, withheld) ④ 홀드 상한·쿨다운 ⑤ 리뷰 게시(마스킹, 패스키, 배지) ⑥ JWS 영수증·로그·증인 1·브라우저 검증·억제 모니터 ⑦ 참조 에이전트, M1·M4, 누출 미터, B0·B3 ⑧ Demo Agent validator 통과 |
| Should | 드롭 추첨·M2, M3·near-dup, 증인 2·분기 탐지, OTS, Q&A 병합, 정보주체 리포트, Glimmer 라벨러(없으면 정답 라벨), COSE, B1·B2 |
| Could | 중고거래 주소 게이트, Voice Transcribe, Prompt Guard 2, 익명 쿼터(ARC는 Dead WG Document), Poppy 이슈 #18·#37·#39 제안 |

컷 라인: 1인은 Must만(마스킹은 얼굴·라벨), 2인은 + 드롭·증인 2·OTS, 4인은 Should까지.

| 날짜(KST) | 목표(관문) |
|---|---|
| 10/26 | 결정 합의, 크레딧 청구, 도메인 구입, Glimmer 다운로드 |
| 10/27 | 합성 데이터 v0, poppy.json·validator, RFC 9421·DPoP, Spark·SAM 첫 호출(Poppy 버전 확정) |
| 10/28 | Cedar, 투영·예산, fit/insights(결정성 100%) |
| 10/29 | 리뷰 operation, 마스킹, 패스키, 홀드(48시간 관문: 사진 20장 육안 통과, Glimmer 지연) |
| 10/30 | 영수증·로그·증인 1·배지 검증·억제 모니터(검증 1초 미만) |
| 10/31 | M1·M4, 누출 미터, B0·B3, 안전판 영상 |
| 11/1 | 드롭·M2, 증인 2·분기 탐지 |
| 11/2 | M3, Q&A, 정보주체 리포트, OTS 시작(확정에 수 시간) |
| 11/3 | 본 평가, 그래프, Demo Agent 리허설 |
| 11/4 | 3분·1분 영상, README, 23:00 제출 |
| 11/5 11:00 | 마감(오전은 버퍼) |

역할: 1인은 Must만. 2인은 P1 프로토콜·정책(Edge, Poppy, Cedar, 투영, 홀드·드롭, 공격)과 P2 신뢰·경험(마스킹, 패스키, 원장, UI, 평가·영상). 4인은 프로토콜·상호운용 / 프라이버시 코어 / 원장·UI / 평가·데모.

## 10. 3분 데모 대본

수치는 자리표시자(측정값으로 교체).

| 시간 | 화면 | 내레이션 | 지표 |
|---|---|---|---|
| 0:00–0:15 | 미서명 computer-use(M4)가 리뷰를 넘기고 누출 미터가 오른다 | "쇼핑 에이전트는 이미 남의 키·몸무게, 아이 얼굴, 송장까지 긁어 갑니다." | 체형 1,184행, 얼굴 37, 송장 9 |
| 0:15–0:30 | Amazon 차단 문구, Shopify 제휴 헤드라인 | "막거나 떠안는 대신, 정문을 더 좋게." | |
| 0:30–1:00 | Demo Agent validator 통과, A의 에이전트가 사이즈 질문, 인스펙터에 목적·T2·D2·정책 해시 | "남이 만든 에이전트도 같은 정문으로. 답은 남의 행이 아니라 집계." | 응답 시간, 원값 0행 |
| 1:00–1:25 | M1의 셀 스윕·임의 구간·Sybil | "고립시키려 하면 같은 답만 오고 예산이 닫힙니다." | 표적 재식별률 B0 대 우리 |
| 1:25–2:00 | 리뷰 초안 → 마스킹 미리보기 → 휴대폰 패스키 → 배지 클릭 → 포함 증명·증인 2/2·비트코인 앵커 | "AI가 썼고, 실구매자가 이 문장을 승인했고, 누구나 검증합니다." | 마스킹 4건, 검증 시간 |
| 2:00–2:25 | 드롭: 40계정 스나이퍼 대 사람, 3분 창 추첨, 리뷰 팜 50건 DENY 영수증 | "빠른 봇이 아니라 공정한 추첨이 이깁니다." | 당첨률 |
| 2:25–2:50 | 운영자(우리)가 DB에서 별점 1점 리뷰 삭제 → 페이지가 빨갛게 "로그엔 있고 페이지엔 없음", 이어 '민트초코' 리포트 | "플랫폼도 몰래 못 지웁니다." | 탐지 1/1, 원문 열람 0 |
| 2:50–3:00 | 기준선 비교표 | "Blockchain-grade auditability, without putting anyone's data on a blockchain." | 누출·성공률·지연·비용 |

"내 봇 둘의 대화"로 안 보이게 하는 장치: ① 남이 운영하는 Demo Agent·validator(가능하면 우리 에이전트가 Cliffside 인스펙터에 찍히는 장면) ② 같은 공격을 B0~B3에 돌린 기준선 ③ 정답 라벨로 재는 누출 미터 ④ 사람이 누르는 패스키 ⑤ 다른 호스트의 증인과 시청자 브라우저 검증.

## 11. 정량 평가 계획

- **데이터**(전부 합성·동의): 상품 12개(의류 8, 신발 드롭 2, 유아용품 2)×리뷰 1,000건(본문은 Spark 생성), 사진 600장(동의한 팀원 사진 + 합성 송장·번호판, 박스 정답), Q&A 800건(15% 민감), 주문 2만 건, 정상 과업 500개(한·영 반반, 오라클은 같은 격자).
- **공격**: C1 직접 추출, C2 권위 사칭, C3 초안·Q&A 속 주입(저장형 포함), C4 셀 스윕, C5 구간·집합 차분, C6 Sybil 40계정, C7 상품 간 연결 추론, C8 출력 밀반입, C9 홀드 반복, C10 리뷰 팜, C11 운영자 억제(삭제·수정·분기).
- **지표**: 누출(타인 필드 노출 행, 표적 재식별 정확도, 민감 속성 추론 AUC, 의미 누출률, violations@5, ASR), 유용성(사이즈 top-1 일치율, Q&A 정답률, 성공률, p50/p95 지연, 비용, 결정성), 남용(사람/에이전트 당첨률 비, 홀드에 막힌 사람 비율, 리뷰 팜 통과율), 책임(변조 탐지율·시간, 마스크 재현율).
- **기준선**: B0 무방어 API(리뷰 행 전체), B1 정적 필드 마스킹(작성자만 지우고 Presidio 패턴. free/busy에 해당), B2 computer-use UI 스크래핑(채찍 on/off), B3 단일 LLM 프록시(리뷰 전체 + 프라이버시 프롬프트), Countersign과 ablation(예산·고정 투영·k 각각 off).
- **실행**: 구조 공격(C4~C6, C9~C11)은 스크립트로, 텍스트 공격(C1~C3, C8)만 Spark로 구성당 150회.

## 12. 해자와 사업성

**해자가 아닌 것.** 게이트웨이(Poppy 회사 측 구현, Kong+VeriKnox, agentgateway, standards.md §1.7), 영수증 포맷(SCITT 에이전트 영수증 개인 초안 2건, ledger.md §1-A(4)), 마스킹(Presidio·SAM), 공개 계산 기법(선행 Data Abstraction Firewall은 사용자 쪽, 우리는 회사 쪽, standards.md §1.8), 공개 프로필. Sierra는 레퍼런스 구현을 한 달 안에 낸다고 했다(standards.md §1.1).

**생긴다면 여기다.** ① 업종 정책 템플릿과 누출 벤치마크(격자, k, 리뷰 태그, 한국어 PII 규칙) ② 리뷰 출처 네트워크: 쇼핑객이 배지를 찾으면 에이전트도 그 플랫폼으로 모이고, 독립 증인(소비자단체·보안업체)이 붙으면 CT식 신뢰망이 된다(Cloudflare·Shopify가 번들로 내면 사라짐) ③ 규제 증빙 포맷 채택 시 전환비용 [추론] ④ Poppy 생태계의 커머스 회사 측 레퍼런스 구현 자리.

**사업성.** 첫 고객은 에이전트를 성장 채널로 원하지만 OAuth·정책·감사를 직접 만들 여력이 없는 중견 마켓·브랜드몰이다(redteam.md §1). 오픈코어 게이트웨이에 호스티드 증인·모니터, 정책 팩, 규제 리포트를 얹는다. 한국은 Muse 미출시라 "다가오는 문제"로 말하고, 카카오 Project Mosaic의 최소 공개 원칙과 방향이 같음을 쓴다(local.md §4).

## 13. 최대 약점 3개와 대응

1. **UI에 보이면 끝이다.** 리뷰마다 체형이 보이는 화면은 computer-use가 다 가져간다. 범위를 밝히고, T0 한도·PoW 효과를 B2로 재고, 화면 구간 표시를 제안하고, 당근(홀드·배지·즉답)을 확실히 더 낫게 한다.
2. **배지가 AI 리뷰를 정당화한다는 반론.** 에이전트는 경험을 지어낼 수 있다(FTC "misrepresent the experience"). 배지의 뜻은 "구매자가 이 문장을 승인했다"다. 승인 페이지에서 별점·사이즈 체감 등 세 문항을 사람에게 받아 초안과 대조하고, 쇼핑객에겐 "사람이 쓴 리뷰만" 필터를 준다.
3. **"Poppy·Shopify·Cloudflare가 곧 할 일"과 인프라 데모 리스크.** Poppy 확장·레퍼런스 구현으로 내고 업스트림에 기여하며, 데모는 쇼핑·리뷰 장면과 수치로 꾸민다. CV 글로벌 온라인 상위권은 도메인 사용자 제품이었다(meta.md §0·§6).

그 밖의 리스크(작은 얼굴·한국어 OCR, Glimmer 지연, 범위)는 9절 관문으로 다룬다.

## 14. 구현 전 합의할 결정

| # | 결정 | 선택지 | 권장 |
|---|---|---|---|
| 1 | 도메인 | 패션 오픈마켓 / 중고거래 / 둘 다 | 패션, 중고거래는 Could |
| 2 | Poppy 버전 | 0.2(데모 에이전트 호환) / 0.3 초안 | 0.2로 상호운용, 0.3 대응표 유지 |
| 3 | 확장 네임스페이스 | 팀 소유 도메인 | 10/26 구입 |
| 4 | 공개 기본값 주체 | 플랫폼 / 정보주체 | 플랫폼이 상한, 정보주체는 낮추기·D4 |
| 5 | k·격자 | k 5/10/20, 격자 폭 | k=10, 5cm·5kg |
| 6 | 예산 | 단위·크기·Sybil 배수 | 하루 60, 신규 1/4 |
| 7 | 영수증·로그 | JWS / COSE, TS / Go Tessera | JWS + TS 직접, COSE는 Should |
| 8 | 증인·앵커 | 증인 1/2, OTS / Base Sepolia 병행 | 증인 2(다른 키·호스트), OTS만 |
| 9 | 승인 증명 | `approved_by` 신뢰 / 패스키 | 비가역 주문·리뷰 게시는 패스키 |
| 10 | 사진 마스킹 | SAM API / 셀프호스트 | 해커톤은 API(동의·합성 사진만), 운영은 셀프호스트 |
| 11 | 라벨러 장비 | Glimmer 로컬 가능 여부 | 32GB 이상 Mac이면 Glimmer, 아니면 대체를 밝힘 |
| 12 | 상호운용 상대 | Demo Agent / Cliffside / Workers 데모 | validator 필수, Demo Agent의 API 호출·Cliffside 장면은 10/27 확인 |
| 13 | 테마 | Build for Your World / Push the Frontier | 직접 겪은 사례 없으면 Push the Frontier |
| 14 | 데이터 규칙 | 합성·동의만, Contributor 금지 | 그대로 합의 |
