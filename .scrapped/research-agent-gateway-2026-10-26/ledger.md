# 에이전트 행위 투명성 원장: "비트코인처럼 투명하게"를 실제 메커니즘으로

작성 2026-10-26 · 범위: 변조 불가 기록, 신원·위임, 남용 억제, 규제, 라이브러리
표기: [확인]=직접 열어 확인 · [스니펫]=검색 결과로만 확인 · [미확인]=확인 실패(로컬 리서치 인용 포함) · [추론]/[제안]=사실이 아닌 판단

---

## 0. 결론 먼저

1. 원안이 원하는 성질(사후 변조 불가, 누구나 검증, 역추적, 남용 억제)은 비트코인 전체가 아니라 부품인 해시 체인·머클 트리·서명·작업증명에서 나온다. 이 부품을 개인정보와 함께 쓰는 검증된 구조가 **투명성 로그**다(CT RFC 9162, Sigstore Rekor v2, IETF SCITT RFC 9943). [추론]
2. Meta도 WhatsApp·Messenger 공개키를 블록체인이 아닌 append-only·제3자 감사형 디렉터리(AKD)로 운영하고, 외부 감사는 Cloudflare가 맡는다. 심사에서 가장 강한 선례다. [확인]
3. 개인정보는 어떤 체인에도 올리지 않는다. 개인정보위 블록체인 가이드라인(2026-07-09)과 EDPB 02/2025 v2.0(2026-07-07)의 결론이 같다. 식별정보는 체인 밖, 체인에는 솔트 해시만 두고, 파기는 원문과 솔트를 지워서 한다. [확인]
4. 공개 체인은 로그 루트의 타임스탬프 앵커로만 쓴다. 2026-10-26 기준 이더리움 L1 송금 약 $0.003, Base $0.00001 미만이라 쟁점은 비용이 아니라 개인정보·삭제권·지연이다. [확인]
5. "에이전트가 요청했다"는 RFC 9421 서명(Web Bot Auth)으로, "누가 맡겼나"는 OAuth `act` 클레임·AP2 mandate·VC로 증명한다. Web Bot Auth WG 헌장은 에이전트 간 인터페이스, 최종 사용자 인증, 봇 평판 추적을 **범위 밖**에 둔다. 원안이 들어갈 빈칸이다. [확인]
6. 남용 억제는 서명된 신원, 익명 쿼터, 희소 자원용 추첨·예치금, 로그 기반 평판의 조합으로 한다. 작업증명 단독으로는 스팸을 못 막는다는 분석이 2004년에 나왔다. [스니펫]
7. 선행 시도가 있다. SCITT 기반 "AI-Agent Action Receipts"(개인 초안, 2026-08)와 "Agent Delegation Receipts"(-15, 2026-10-21)다. 영수증 포맷은 해자가 아니다. 차별점은 **마스킹 게이트웨이, 양방향 영수증, 정보주체 열람, 남용 억제**의 결합과 레퍼런스 구현이다. [추론]

---

## 1. 메커니즘별 요약과 링크

### 1-A. 변조 불가 기록과 투명성

**(1) 해시 체인 감사 로그.** 레코드마다 직전 해시를 넣는다. 구현은 쉽지만 포함을 보이려면 체인 전체가 필요하고, 사람마다 다른 체인을 보여주는 split view와 꼬리 절단을 막지 못한다. 에이전트 영수증 초안도 인증된 체크포인트 없이는 꼬리 절단을 못 잡는다고 적었다([확인] https://www.ietf.org/archive/id/draft-noa-scitt-ai-agent-receipt-01.html, 2026-08-15).

**(2) 머클 트리 투명성 로그(CT).** RFC 6962(2013-06, Experimental)를 RFC 9162(CT 2.0, 2021-12, Experimental)가 대체했다([확인] https://www.rfc-editor.org/rfc/rfc9162.html).
- 포함 증명은 루트 계산에 필요한 최소 노드 목록이다(100만 건이어도 해시 20개, 640바이트 [추론: log2 계산]). 일관성 증명은 과거 트리가 현재 트리의 접두사, 즉 append-only임을 보인다. 체크포인트(STH)는 크기·루트·시각에 대한 로그 서명이고, Monitor는 새 항목을 전부 검사한다.
- 운영 교훈: Chrome은 서로 다른 로그 운영자 2곳 이상의 SCT를 요구한다. 단일 운영자를 믿지 않는 원칙의 정책화다([확인] https://googlechrome.github.io/CertificateTransparency/ct_policy.html, 2026-10-26 열람).

**(3) 타일 로그와 증인.** C2SP tlog-tiles는 로그를 256해시 단위 정적 타일로 서빙(CDN 캐시)하고 증명은 클라이언트가 계산하며, 체크포인트는 signed-note 형식이다([확인] https://c2sp.org/tlog-tiles). tlog-witness의 증인은 일관성 증명이 맞을 때만 공동서명해 split view를 막는다([확인] https://c2sp.org/tlog-witness).
- Tessera(Go): tlog-tiles 전용이며 POSIX·GCP·AWS 백엔드와 C2SP 증인 정책을 지원한다. README는 "production ready"라고 밝힌다. v1.0.4는 2026-07-16 릴리스다([확인] https://github.com/transparency-dev/tessera).
- Sigstore Rekor v2 GA(2025-10-10): Trillian에서 Tessera로 옮기고 항목 타입을 둘로 줄였으며 검색 인덱스를 뺐다. 업로드 때 포함 증명을 돌려주고, 배치 통합으로 몇 초 걸린다. 증인 통합은 예정이다([확인] https://blog.sigstore.dev/rekor-v2-ga/).

**(4) IETF SCITT.** 2026-06에 RFC 9943(아키텍처, Proposed Standard)과 RFC 9942(COSE Receipts)가 나왔다. Issuer가 서명한 Signed Statement를 Transparency Service에 등록하면 오프라인 검증 가능한 Receipt를 받고, Auditor는 모든 진술의 정합성을 검사한다. RFC 9943의 "Transparency does not prevent dishonest or compromised Issuers, but it holds them accountable"이 원안의 한 줄 요약이다([확인] https://datatracker.ietf.org/doc/draft-ietf-scitt-architecture/ · https://datatracker.ietf.org/doc/rfc9942/). RFC 9942는 RFC 9162식 포함·일관성 증명의 CBOR 인코딩을 정의하므로 CT형 로그를 표준 COSE 영수증으로 낼 수 있다.
- 에이전트용 선행 초안(IETF 미채택 개인 초안): draft-noa-scitt-ai-agent-receipt-01(2026-08-15)은 행위·주체 클래스·판정·정책을 해시 체인 COSE_Sign1로 남기고, 원문 프롬프트·인자를 금지하며 인자 해시에 테넌트 키 HMAC을 허용한다(위 URL [확인]). draft-nelson-agent-delegation-receipts-15(2026-10-21)는 사람이 허락한 범위·기한·지시 해시에 서명한 위임 영수증으로, 다단 위임의 범위 축소와 연쇄 폐기를 다룬다([확인] https://datatracker.ietf.org/doc/draft-nelson-agent-delegation-receipts/).

**(5) Meta의 선례.** WhatsApp은 공개키를 append-only AKD(오픈소스, Rust)로 관리하며, 누구나 감사 증명을 검증하면서도 "preserving the privacy of all users"를 지킨다고 설명한다([확인] https://engineering.fb.com/2023/04/13/security/whatsapp-key-transparency/, 2023-04-13). Messenger도 AKD를 쓰고 Cloudflare 감사자가 추가 검증과 공개 대시보드를 맡는다([확인] https://engineering.fb.com/2025/11/20/security/key-transparency-comes-to-messenger/, 2025-11-20). → [추론] "Meta가 수십억 명 규모로 쓰는 투명성 로그 패턴을 에이전트 행위로 넓혔다"는 서사가 블록체인 서사보다 강하다.

**(6) 공개 블록체인 앵커링.**
- OpenTimestamps는 해시를 머클 트리로 묶어 루트만 비트코인 트랜잭션 1건에 넣는다. 캘린더가 약 1초 만에 미완성 증명을 주고 나중에 비트코인 경로로 업그레이드하며, 캘린더 자체는 신뢰 대상이 아니다("at worst they can deny service, not produce false proofs")([확인] https://petertodd.org/2016/opentimestamps-announcement, 2016-09-15). 공개 캘린더는 무료다([확인] https://opentimestamps.org/). 확정은 "a few hours", 검증엔 로컬 Bitcoin Core(프루닝 가능)가 필요하다([확인] https://github.com/opentimestamps/opentimestamps-client).
- 이더리움 L1: 2026-10-26 10:08 UTC 기준 0.054 gwei, ETH $2,330, 단순 송금 약 $0.003이다([확인] https://etherscan.io/gastracker). Base: 0.005 gwei, 송금 $0.00001 미만(10:15 UTC)([확인] https://basescan.org/gastracker).
- 지연: Base는 프리컨펌 약 200ms, L2 블록 약 2초, L1 배치 약 2분, L1 최종성 약 20분이다([스니펫] https://docs.base.org/base-chain/network-information/transaction-finality). 이더리움 최종성은 2 에포크(약 12.8분)다([스니펫] https://www.migalabs.io/eth-academy/en/consensus/finality).
- 전체 기록 온체인 vs 루트 앵커링: calldata 비영 바이트는 16 gas([확인] https://eips.ethereum.org/EIPS/eip-2028)라 위 가스 가격이면 1KB도 L1에서 1센트 미만이다. 결정 요인은 비용이 아니라 삭제 불가·개인정보법, 공개 메타데이터만으로 가능한 행동 추적, 처리량·지연이다. 루트 앵커링은 항목 수와 무관하게 주기당 1건이고, 내용은 숨긴 채 존재·순서·시점만 공개한다. [추론]

**(7) 프라이버시와의 충돌.**
- EDPB Guidelines 02/2025(v1.1 2025-04-08, v2.0 2026-07-07 채택): 원칙과 충돌하면 블록체인에 개인정보를 저장하지 말 것, "unsalted or unkeyed hashes should generally not be considered sufficient", 실제 삭제가 흔히 불가하므로 삭제 요청 시 온체인 데이터로 직접 식별할 수 없게 하고 간접 식별을 돕는 오프체인 데이터를 지울 것, 허가형 선호([확인·2차 매체] https://ppc.land/edpb-forces-blockchain-firms-to-avoid-storing-personal-data-on-chain/, 2026-07-12 · 의견수렴 페이지 [확인] https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-022025-processing-personal-data_en).
- 개인정보위 「블록체인 서비스 개인정보 보호 가이드라인」(2026-07-09): 식별정보 온체인 기록 금지, 연계 오프체인 정보 암호화·접근통제, 전자서명 난수 재사용 금지, 퍼블릭 체인은 참여자 범위·역할 사전 공개. 파기는 오프체인 개인정보와 "온체인 정보 생성에 활용한 솔트값 등 추가정보"를 삭제해서 한다([확인] https://www.fnnews.com/news/202607091726066232, 연합뉴스 전재).
- 개인정보 보호법 시행령 제16조: 기술적 특성으로 영구 삭제가 현저히 곤란하면 익명처리해 복원할 수 없게 조치한다(2022 개정)([스니펫] https://wikidocs.net/230548 · https://www.newsis.com/view/NISX20220711_0001939142, 2022-07-11).
- 설계 함의 [추론]: 로그 항목은 키 있는 커밋먼트(HMAC이나 항목별 솔트 해시)로 만들고, 솔트는 재사용 없이 오프체인에 둔다. 파기 요청엔 원문과 솔트를 지운다(crypto-shredding). 필드별 선택 공개는 SD-JWT(RFC 9901, 2025-11)의 "값마다 솔트 다이제스트, 공개할 것만 원문·솔트 제시" 패턴을 쓴다([스니펫] https://www.rfc-editor.org/rfc/rfc9901.html).

### 1-B. 신원과 위임

- **RFC 9421 HTTP Message Signatures**(2024-02, Standards Track): Signature-Input·Signature 헤더로 @method·@authority·@path·content-digest 등에 서명하고 created·expires·nonce·keyid·alg·tag 파라미터를 쓴다. alg `ed25519`가 정의돼 있고 재전송 방지엔 nonce·created를 권한다([확인] https://www.rfc-editor.org/rfc/rfc9421.html).
- **Web Bot Auth**: WG 문서 draft-ietf-webbotauth-httpsig-protocol-00(2026-09-01, Cloudflare·Google 저자). `Signature-Agent` 헤더로 키 디렉터리 URL을 알리고, `tag="web-bot-auth"`, keyid는 JWK thumbprint, expires는 24시간 이하를 권장한다. 프라이버시 절은 익명을 원하면 쓰지 말고 키는 개인이 아닌 역할·시스템을 대표하라고 한다([확인] https://datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol-00). 헌장은 API·에이전트 간 인터페이스 인증, 최종 사용자 인증, 봇 의도 어휘, 특정 봇 추적·평판을 범위 밖에 둔다([확인] https://datatracker.ietf.org/wg/webbotauth/about/). Cloudflare는 Ed25519를 지원하고 nonce는 아직 검증하지 않으며 expires를 1분 정도로 권한다([확인] https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/, 2026-10-08 갱신). Visa TAP도 RFC 9421 기반이다([확인] https://developer.visa.com/capabilities/trusted-agent-protocol/overview).
- **익명 봇 인증**: draft-rescorla-anonymous-webbotauth-01(2026-07-19, 개인 초안). Anchor가 심사한 봇이 영지식 증명으로 익명 자격증명을 받아 "인증된 누군가"임만 보이고, 자격증명마다 사용 한도가 붙는다. 신원 기반 남용 통제와는 양립할 수 없다고 스스로 밝힌다([확인] https://datatracker.ietf.org/doc/html/draft-rescorla-anonymous-webbotauth).
- **사용자에서 에이전트로의 위임**
  - OAuth: Token Exchange(RFC 8693, 2020)의 `act`·`may_act` 클레임으로 "주체 sub, 행위자 act.sub"를 남긴다([확인] https://www.rfc-editor.org/info/rfc8693). RAR(RFC 9396, 2023)의 `authorization_details`로 세밀한 권한을([확인] https://www.rfc-editor.org/info/rfc9396), DPoP(RFC 9449, 2023)로 토큰-키 결합을 한다([확인] https://www.rfc-editor.org/info/rfc9449). 에이전트 전용 OAuth 초안은 아직 개인 초안이다([스니펫] https://datatracker.ietf.org/doc/html/draft-oauth-ai-agents-on-behalf-of-user-02).
  - AP2: v0.2에서 mandate가 Checkout·Payment Mandate(각각 Open/Closed 단계)로 바뀌었고 "non-repudiable, cryptographic audit trail"을 내세운다. 표준화는 FIDO Alliance로 넘어갔다([확인] https://ap2-protocol.org/ · 이관 2026-04 [스니펫] https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/). Intent/Cart는 v0.1 용어다.
  - W3C VC Data Model 2.0: 2025-05-15 Recommendation, SD-JWT·BBS로 선택 공개([확인] https://www.w3.org/TR/vc-data-model-2.0/).
  - Poppy: OAuth 위임, 에이전트 키에 묶인 단기 세션 토큰, 5단계 접근 등급, 사람/AI 상호 고지가 있다. 감사·영수증·레이트리밋·Web Bot Auth 언급은 없다([확인] https://personalagentprotocol.org/, v0.3, 2026-10-26 열람). → [추론] 원장 계층은 Poppy 확장으로 포지셔닝할 수 있다.
- **비트코인의 '주소=키' 모델과 비교**: 백서는 공개키를 익명으로 두고 거래마다 새 키쌍을 쓰라고 권하면서도, 키 소유자가 드러나면 다른 거래까지 연결된다고 인정한다(10절)([확인] https://bitcoin.org/bitcoin.pdf). [추론] 원안에서는 둘을 나눈다. 에이전트 운영자 키는 공개·장기(조직 책임, Web Bot Auth), 사용자는 서비스별 쌍별 가명·단기 키다. 모든 행위를 공개 가명 하나에 묶으면 체인 분석식 역추적이 재현된다.

### 1-C. 무차별 사용 억제

- **작업증명의 원래 목적**: Dwork·Naor(1992, "Pricing via processing or combatting junk mail")와 Back의 Hashcash(1997 제안, 2002 논문)는 이메일·익명 리메일러 같은 "un-metered internet resources"의 남용을 조절하려고 나왔다([확인] http://www.hashcash.org/papers/hashcash.pdf). 비트코인은 "Adam Back's Hashcash"와 비슷한 PoW를 분산 타임스탬프 서버에 썼다(4절, [확인] bitcoin.pdf). AI 크롤러 차단 도구 Anubis(GitHub 스타 2.3만)는 Hashcash에서 영감을 받은 SHA-256 PoW를 쓰며 스스로 "good enough placeholder"라 부른다([확인] https://github.com/TecharoHQ/anubis docs/design/why-proof-of-work.mdx).
- **PoW의 한계**: Laurie·Clayton(WEIS 2004)은 스팸을 막을 만한 난이도라면 정상 발신자 상당수도 막힌다고 결론 냈다([스니펫] https://www.cl.cam.ac.uk/~rnc1/proofwork2.pdf). Camp 등(2006)은 평판과 결합하면 PoW가 작동할 수 있다고 봤다([스니펫] https://archive.nyu.edu/bitstream/2451/28461/2/Camp_06-18.pdf). 데이터센터 에이전트엔 싸고 모바일 사용자엔 비싼 비대칭도 있다. [추론]
- **Privacy Pass**: RFC 9576(아키텍처)·9577(HTTP 인증)·9578(발급), 2024-06. 역할은 Attester·Issuer·Origin·Client이고, Origin은 두 사용이 같은 클라이언트인지 알 수 없으며, 용도로 rate limiting·anti-fraud가 명시돼 있다([확인] https://www.rfc-editor.org/rfc/rfc9576.html · https://datatracker.ietf.org/wg/privacypass/documents/).
- **ARC/ACT**: Cloudflare(2025-10-30)는 Web Bot Auth가 플랫폼만 식별하므로 익명 자격증명으로 사용자 단위 레이트리밋을 하자고 제안했다. ARC는 정해진 횟수만큼 병렬 제시가 되지만 단독 폐기가 안 되고, ACT는 상태형 크레딧이라 의심 행동에 크레딧을 깎을 수 있지만 병렬 제시가 안 된다. 프로덕션 배포는 없다([확인] https://blog.cloudflare.com/private-rate-limiting/). ARC 프로토콜 초안은 "Dead WG Document"(2026-09-03)이고([확인] https://datatracker.ietf.org/doc/draft-ietf-privacypass-arc-protocol/), ACT는 개인 초안 -01(2026-02)이다([스니펫] https://datatracker.ietf.org/doc/draft-schlesinger-privacypass-act/).
- **x402**: 402 응답 → 스테이블코인 결제 → 재요청, 프로토콜 수수료 0. 사이트 표기 최근 30일 7,541만 건·$24.24M(2026-08-25 갱신)([확인] https://www.x402.org/). 유기적 매출 비즈니스 91곳·지갑 수익 중앙값 $0.01이라는 리포트도 있다([미확인: 로컬 리서치] https://x402stats.io/reports/2026-10).
- **예치금·평판·추첨**: Hertie School 등(AIES 2026)은 agentic flooding 84건을 모아, 수수료 같은 마찰이 취약계층을 걸러낸다고 경고하고 디지털 신원 기반 청구자별 레이트리밋을 권했다([스니펫] https://arxiv.org/pdf/2608.16603). 20분 홀드 반복으로 사람 구매자를 막은 사례(The Verge 2026-10-22)와 "agent passport"·3분 창 추첨 제안(NYMag 2026-10-08, 원문 열람 실패)은 [미확인: 로컬 리서치].

| 수단 | 막는 것 | 약점 | 원안 적합도 [추론] |
|---|---|---|---|
| PoW(Hashcash·Anubis) | 익명 대량 요청 | 클라우드 에이전트엔 저렴하고 사람에게 부담 | 낮음(미서명 트래픽 폴백) |
| 서명 신원(RFC 9421) | 위장, 운영자 단위 남용 | 사용자 구분 불가, 추적 우려 | 필수 |
| 위임 증명(OAuth act·VC·AP2) | "누구 대신인가" 불명 | 초안 난립 | 필수 |
| 익명 쿼터(Privacy Pass·ACT) | 추적 없는 사용자 단위 제한 | 표준 미확정 | 스트레치 |
| x402 소액결제 | 무료 자원 남획 | 실수요 작음, 지갑 필요 | 유료 API에만 |
| 예치금·슬래싱 | 홀드·예약 독점 | 결제 레일, 분쟁 처리 | 희소 자원에만 |
| 추첨·대기열 | 속도 경쟁 | 대기 UX | 희소 자원에 높음 |
| 로그 기반 평판 | 반복 위반 | 신규 진입 불리 | 높음(원장과 직결) |

### 1-D. 투명성 고지 규제

- **한국 AI 기본법**(2026-01-22 시행) 제31조: ① 고영향·생성형 AI 기반임을 이용자에게 사전 고지 ② 생성물 표시 ③ 실제와 구분 어려운 결과물은 명확히 인식 가능하게 고지·표시. 방법은 시행령 제23조([확인] https://shinkim.com/kor/media/newsletter/3142, 2026-02-26). 과태료 3천만원 이하, 1년 이상 계도기간([스니펫] https://www.shinkim.com/kor/media/newsletter/pdf/3114).
- **EU AI Act 50조**: 자연인과 직접 상호작용하는 AI는 AI임을 알리고, 합성 콘텐츠는 기계 판독 표시. 2026-08-02 적용([확인] https://artificialintelligenceact.eu/article/50/). Digital Omnibus로 워터마킹 하위 의무만 2026-12-02까지 유예, 고지 의무는 예정대로([확인] https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/, 2026-07-29).
- **캘리포니아 BOT Act**(SB 1001, B&P §17941): 거래·선거에 영향을 주려고 봇의 정체를 속일 의도로 소통하면 위법, 명확한 고지 시 면책([확인] https://california.public.law/codes/ca_bus_and_prof_code_section_17941). 2019-07-01 시행([스니펫] https://perkinscoie.com/insights/blog/i-am-robot-californias-new-law-requires-disclosure-use-bots).
- **FTC 리뷰 규칙**(16 CFR 465, 2024-08-14 의결, 2024-10-21 시행): "AI-generated fake reviews"처럼 존재하지 않는 사람 명의 리뷰 금지, 고의 위반 시 민사벌금([확인] https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials · 시행일 [스니펫] https://www.govinfo.gov/content/pkg/FR-2024-08-22/html/2024-18519.htm).
- **Amazon**: Perplexity 건 공식 입장에서 "third-party applications that offer to make purchases on behalf of customers … should operate openly"라고 밝혔다([확인] https://www.aboutamazon.com/news/company-news/amazon-perplexity-comet-statement, 페이지 날짜 미표기·연계 서한 2025-10-31). Muse 차단(2026-09-20, GeekWire 인용) 때도 같은 문장과 함께 사전 통지 없음, 브라우징 중 자기 미식별, 자격증명 저장 의혹을 이유로 들었다([확인·2차] https://ppc.land/amazon-blocks-metas-muse-ai-agent-from-shopping-on-its-site/, 2026-10-08). 로컬 리서치가 출처로 든 TechCrunch 기사에는 이 문장이 없다([확인] https://techcrunch.com/2026/09/21/metas-ai-agent-has-been-blocked-from-using-amazon-com/).
- **규제 대응 가치** [추론]: 위 법들은 주로 "AI가 사람에게 말할 때"를 겨냥해 에이전트의 API 호출은 직접 대상이 아닐 수 있다. 그래도 영수증은 (a) 사람 직원에게 넘길 때 고지했다는 근거, (b) 리뷰 같은 공개 작성물의 "실구매자 위임 + AI 작성" 증빙(FTC가 금지하는 것은 가짜 경험이고 AI 보조 자체는 아니라는 해석은 추론), (c) Amazon이 지적한 자기 식별·사전 통지 결여의 해소 수단이 된다.

### 1-E. 구현 라이브러리 (npm·PyPI·GitHub API, 2026-10-26 조회 [확인])

| 용도 | TypeScript | Python |
|---|---|---|
| Ed25519 | @noble/ed25519 3.2.0 · @noble/curves 2.4.0 (2026-08-27) | cryptography 50.0.2 (2026-09-30) · PyNaCl 1.6.2 (2026-01-01) |
| RFC 9421 | web-bot-auth 0.2.0 · http-message-sig 0.3.0 (Cloudflare, 2026-08-31, 레포 푸시 10-26) · http-message-signatures 1.0.6 (2026-06-04) | http-message-signatures 3.0.0 (pyauth, 2026-10-26) |
| COSE | @auth0/cose 1.0.2 (2024-04) · @transmute/cose 0.3.0 (2024-10) · cose-js 0.9.0 (2023-09): 모두 정체 | pycose 1.1.0 (2023-12) · cwt 3.3.0 (2026-07-16) |
| 머클 로그 | 성숙한 RFC 9162 구현 없음(transmute rfc9162, 2024-09, 스타 0) · @sigstore/verify 4.1.2 (2026-08-04) | pymerkle 7.0.0 (2026-10-18, 포함·일관성 증명, GPL-3.0, "security audit 필요") · sigstore 4.5.1 (2026-10-20) |
| 로그 서버 | (Go) Tessera v1.0.4 · transparency-dev/witness · Sunlight · (Rust) facebook/akd v0.13.0 | microsoft/scitt-ccf-ledger + pyscitt 0.15.0 (2026-09-22) |
| OpenTimestamps | opentimestamps 0.4.9 (npm 2021-01, 레포 2023-03 이후 정체) | opentimestamps-client 0.7.2 (2024-12-31) · opentimestamps 0.4.5 (레포 푸시 2026-10-25) |
| Privacy Pass | @cloudflare/privacypass-ts 0.9.0 (2026-06-05, 레포 10-21) | RFC 9578 주류 구현 못 찾음. PyPI `privacypass`는 구 프로토콜용 CAPTCHA 우회 모듈이다. 대안은 Rust raphaelrobert/privacypass, Go cloudflare/pat-go |
| JWS/위임 토큰 | jose 6.2.13 (2026-10-20) | PyJWT 2.15.1 (2026-09-28) · joserfc 1.7.7 (2026-10-19) |

[추론] 권장: 게이트웨이·서명·영수증은 TS. 로그는 (a) 자체 RFC 9162 구현(수백 줄)을 pymerkle로 교차검증하거나 (b) Go 인원이 있으면 Tessera POSIX + witness. OTS는 Python 크론.

---

## 2. [제안] 권장 설계: 에이전트 게이트웨이 + 투명성 로그

**원칙.** ① 원장에는 사실의 지문만, 내용은 체인 밖(PIPC·EDPB). ② LLM은 프라이버시 경계가 아니다. 결정적 정책 엔진이 먼저 가리고 LLM은 가려진 구조체로 문장만 만든다(근거: 에이전트 채널 누출 벤치마크 CalBench·AgentLeak [미확인: 로컬 리서치]). ③ 투명성은 책임을 물을 뿐 남용을 막지 못하므로(RFC 9943) 쿼터·추첨과 짝을 짓는다.

**흐름(일정 조율 예).**
① B의 에이전트가 RFC 9421로 서명한 요청과 위임 토큰을 게이트웨이에 보낸다(`act`=에이전트, `sub`=B의 서비스별 가명, `authorization_details`=C의 free/busy 읽기).
② 게이트웨이가 서명·위임을 검증하고, 정책 엔진이 C의 일정을 free/busy와 사유 범주("개인 일정")로 추상화한다. Muse Spark는 이 구조체만 보고 "그날 15시는 개인 일정이 있어 어렵습니다"라고 쓴다. 상세 없이 바쁜 시간만 주고받는 추상화는 RFC 5545 VFREEBUSY(2009)에 이미 있으므로([확인] https://www.rfc-editor.org/rfc/rfc5545.txt 3.6.4) 마스킹만으로는 새롭지 않다.
③ 공개 필드만 담은 항목을 로그에 append한다.
④ 에이전트는 응답과 게이트웨이 서명 영수증(포함 증명)을, 기업은 에이전트 서명 요청 원본을 보관해 양쪽 모두 부인하지 못한다.
⑤ 체크포인트를 주기 서명하고 증인 2곳이 공동서명하며, 매시 OTS로 앵커한다.
⑥ C(정보주체)는 "내 데이터에 닿은 에이전트 요청"을 오프체인 인덱스와 포함 증명으로 열람한다.

| 필드 | 공개 로그 | 비공개(기업) |
|---|---|---|
| 순번, 시각(분 단위 버킷) | O | |
| 에이전트 운영자 키 thumbprint | O(조직 책임은 공개) | |
| 사용자·정보주체 식별자 | 키드 커밋먼트만 | 원문(솔트 삭제로 파기) |
| 행위 범주, 정책 판정(ALLOW/MASK/DENY/RATE_LIMIT/LOTTERY), 정책 버전 해시 | O | 세부, 정책 원문 |
| 요청·응답·위임 다이제스트(항목별 솔트) | O | 원문과 솔트(선택 공개) |
| 에이전트 서명 원본 | | O(분쟁 증거) |

[추론 주의] 공개 필드 조합만으로도 메타데이터가 샌다. 시각은 버킷으로, 범주는 거칠게 잡고, 소규모 서비스는 "증인·감사자에게만 공개" 모드를 둔다.

**운영 주체.** 해커톤: 기업 게이트웨이가 로그를 운영하고, 팀원이 다른 키·호스트로 증인 2개를 띄운다. 앵커는 OTS, Base Sepolia는 선택. 실제: CT 모델. 기업별 로그에 독립 증인 컨소시엄(에이전트 플랫폼, 보안업체, 소비자단체, 규제기관)이 공동서명하고, 에이전트는 서로 다른 증인 2곳 이상이 서명한 체크포인트의 영수증만 인정한다(Chrome CT의 운영자 다양성 요구 차용). 공개 블록체인 단독 원장은 비권장이다(쓰는 주체가 하나라 합의가 불필요하고 법적 위험만 커짐).

**영수증 수령자.** 에이전트·사용자는 "무엇을 했고 무엇을 거절당했나", 기업은 서명된 요청과 위임 증명, 정보주체는 자기 관련 항목 열람권, 감사자는 체크포인트·일관성 증명(법적 절차 시 솔트로 개봉)을 받는다.

**감사자가 검증할 수 있는 것**: append-only 여부, 분기 없음(증인), 시점(OTS), 특정 영수증 포함, 운영자별 집계(요청량·거절률·홀드 전환율), 개봉 항목의 정책 적용 재현. **없는 것**: 에이전트가 사용자 의도를 정확히 대변했는지, LLM 응답의 의미상 누출(사후 재현으로 점검만), 게이트웨이를 우회한 화면 조작 트래픽(미서명 하위 등급으로 처리).

**남용 억제 조합.** 등급 0(미서명)은 공개 정보만, IP 제한과 PoW 폴백. 등급 1(운영자 서명)은 운영자 쿼터와 로그 기반 평판. 등급 2(서명+위임)는 가명 단위 쿼터(ACT 크레딧은 스트레치). 희소 자원(예약·홀드·한정판)은 3분 창 추첨, 위임당 홀드 상한, 예치금을 걸고, 홀드가 반복해서 구매로 이어지지 않으면 평판을 깎거나 예치금을 몰수한다. 판정이 모두 로그에 남아 이의 제기가 가능하다.

**"블록체인"이라는 말 쓰는 법.**
- 권장: "비트코인과 같은 암호 부품(해시 체인, 머클 트리, 서명)으로 만든 CT·IETF SCITT 방식의 공개 검증 원장입니다. 체크포인트는 OpenTimestamps로 비트코인에 고정하고, 개인정보는 어떤 체인에도 올리지 않습니다." 영어 한 줄: "Blockchain-grade auditability, without putting anyone's data on a blockchain."
- 피할 말: "블록체인에 에이전트 로그를 올린다", 증인이 하나뿐인데 "탈중앙화", 토큰·코인.
- "왜 블록체인을 안 쓰나?" → 쓰는 주체가 하나라 합의가 필요 없고, 2026-07 한국·EU 가이드라인이 온체인 개인정보를 막으며, 영수증은 몇 초 안에 나와야 한다(비트코인 확정은 몇 시간). "기업이 로그를 고치면?" → 일관성 증명·증인·비트코인 앵커 때문에 드러난다.

**Meta AI 접점(원장 부분)** [제안·성능 미검증]: Muse Spark 1.3은 요청의 툴 콜 구조화, 마스킹된 응답 생성, 영수증의 활동 요약을 맡는다. Muse Glimmer(오픈웨이트)는 기업 내부에서 원문 민감도를 분류해 원문이 외부 API로 나가지 않게 한다.

---

## 3. 10일 구현 난이도와 데모 가능성 [추론]

| 구성요소 | 난이도 | 인일 | 데모 가치 |
|---|---|---|---|
| RFC 9421 서명·검증(web-bot-auth) | 낮음 | 0.5–1 | 중 |
| 위임 토큰(JWT act + authorization_details, jose) | 낮음–중 | 1 | 중 |
| 게이트웨이 + 정책 엔진(free/busy, 리뷰 범위) | 중 | 2–3 | 높음 |
| 머클 로그 + 체크포인트 서명 | 중 | 1.5–2 | 높음 |
| 증인 2개 | 중 | 0.5–1 | 높음(조작 탐지) |
| OTS 앵커 | 낮음(검증엔 Bitcoin 노드 필요) | 0.5 | 중 |
| 대시보드 3종(사용자·정보주체·감사자), 브라우저 내 증명 검증 | 중 | 2 | 높음 |
| 쿼터 + 추첨 + 평판 | 낮음–중 | 1 | 높음(flood 시연) |
| 익명 쿼터(Privacy Pass·ACT) | 높음 | 2+ | 중 → 스트레치 |
| 스마트컨트랙트 예치금·슬래싱 | 높음 | 2+ | 낮음 → 제외 권장 |

스트레치를 뺀 핵심은 약 9–11.5인일로, 2–3인이면 10일 안에 현실적이다.

**데모 장면(3분).** ① B의 에이전트가 C와 회의를 잡자 "개인 일정"으로 마스킹된 답과 영수증이 온다. ② 감사자 화면에서 포함 증명을 검증한다. 운영자가 DB 항목 하나를 고치면 다음 체크포인트에서 증인이 공동서명을 거부한다. ③ 악성 에이전트의 한정판 500건 홀드가 추첨·상한·평판에 걸리고, 거절도 영수증으로 남는다. ④ C가 자기 데이터에 닿은 요청을 열람한다. ⑤ 비트코인 앵커를 확인한다(OTS 확정이 몇 시간 걸려 첫날 앵커분으로 시연).

**원장 관점에서 팀이 합의할 것.**
1. 위협 모델 우선순위: 악성 에이전트, 반복 질의로 일정을 복원하려는 에이전트, 부정직한 기업, 탈취된 게이트웨이.
2. 공개 필드 목록과 시간 버킷 크기.
3. 로그 구현(TS 자체 또는 Go Tessera)과 C2SP 체크포인트 호환 여부.
4. 증인 수와 데모 운영 주체, 앵커 방식(OTS만/Base Sepolia 병행/없음).
5. 위임 형식(OAuth act JWT, VC, AP2 스타일).
6. 남용 억제 범위(추첨·상한·평판까지, ACT는 스트레치).
7. 파기 정책(솔트 보관 기간, 삭제 요청 흐름).
8. Poppy·Web Bot Auth 확장으로 낼지, 독자 스펙으로 낼지.

**리스크.** 최대 리스크는 범위 과다다(10일 상한은 원장·게이트웨이·쿼터). "해자" 주장도 조심한다. 영수증 포맷은 개인 초안 2건이 있고 공개 프로토콜 자체는 해자가 아니며, 해자는 채택·증인 네트워크·업종별 정책 템플릿에서 나온다.

---

## 4. 비트코인과의 연결(정확성 우선)

비트코인 백서는 신뢰할 제3자 없이 이중지불을 막으려고 "모든 거래를 공개적으로 알리고(publicly announced)" 그 순서를 참여자가 합의하게 했다. 이를 위해 블록 해시를 이어 붙이는 타임스탬프 서버(3절)를 두고, 그 서버를 탈중앙화하려고 Hashcash와 비슷한 작업증명(4절)을 썼으며, 블록 속 거래를 요약하는 데 머클 트리(7·8절)를 썼다. 개인정보는 신원 대신 공개키만 드러내고 거래마다 새 키를 쓰는 방식으로 지키려 했지만, 백서 스스로 키 소유자가 드러나면 거래가 연결된다고 인정한다(10절). 원안이 원하는 "나중에 역추적할 수 있는 투명성"은 이 가운데 해시 체인, 머클 트리, 서명에서 나온다. 작업증명과 합의는 기록하는 쪽이 여럿이고 서로를 믿지 못할 때 필요한 장치다. 에이전트 게이트웨이처럼 기록 주체가 분명한 곳에서는 같은 부품을 인증서 투명성 방식(머클 로그, 서명된 체크포인트, 독립 증인)으로 쓰는 것이 정확한 번역이다. 필요하면 체크포인트 해시만 OpenTimestamps로 비트코인에 고정해 "운영자도 과거를 고칠 수 없다"는 성질을 더한다. 작업증명은 원래 스팸 억제용이었고(Dwork·Naor 1992, Hashcash 1997) 지금도 AI 크롤러 차단(Anubis)에 쓰이지만 단독으로는 약하다(Laurie·Clayton 2004). 그래서 원안에서는 신원·쿼터·평판에 곁들이는 보조 수단으로 둔다.
