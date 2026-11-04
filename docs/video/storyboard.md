# 제출 영상 스토리보드 (v3: 지도·캐릭터 도입 + 모션그래픽 기능 소개)

상태: 사용자가 다시 정한 흐름(2026-11-04)을 장면 단위로 풀어 썼다. 구체적인 제작 방식(툴, 애니메이션 기법, 렌더 설정)은 이 문서의 범위가 아니다.
용도: 해커톤 제출용 3분 데모 영상(YouTube). Indie Developer 트랙, Build for Your World.
관계: [demo-script.md](demo-script.md)의 필수 요건(R1~R7), 문제 정의(P1~P6), 레퍼런스 원칙은 그대로 따른다. 구조안(구간 배분)은 이 문서가 대체한다.

## 한 줄 요약

> Meta Global AI Developer Hackathon 타이틀 카드로 열고, 동묘 거리 사진이 핀으로 꽂힌 지도 위에서 캐릭터가 쇼핑하며 세 가지 질문에 부딪힌다. 이어서 Street Fitting의 실제 화면이 움직이는 모션그래픽으로 그 세 질문에 하나씩 답하고, 각 장면마다 어떤 Meta 모델을 왜 썼는지 짚는다. 마지막에 처음의 지도로 돌아와 질문 세 개에 체크가 켜지며 끝난다.

## 영상 전체 흐름 (목표 2:56)

| # | 시간 | 길이 | 장면 | 이 장면이 답하는 것 |
| --- | --- | ---: | --- | --- |
| S0 | 0:00–0:06 | 6s | 타이틀 카드: 왼쪽 텍스트, 오른쪽 1/3 동묘 사진 | 무슨 대회, 무슨 주제 |
| S1 | 0:06–0:14 | 8s | 동묘 지도 위에 사진 핀이 하나씩 꽂힘, 캐릭터 등장 | 무대 소개 |
| S2 | 0:14–0:22 | 8s | 질문 ① "아까 그 재킷, 어느 가게였지?" | 문제 Q1 |
| S3 | 0:22–0:30 | 8s | 질문 ② "내 옷이랑 어울릴까?" | 문제 Q2 |
| S4 | 0:30–0:38 | 8s | 질문 ③ "A랑 B를 같이 입으면?" | 문제 Q3 |
| S5 | 0:38–0:44 | 6s | 제품 공개: 지도가 폰 화면 속으로 빨려 들어감 | 해결책 이름 |
| S6 | 0:44–0:58 | 14s | 기능 1. 쇼핑 모드: 찍으면 위치가 붙는다 | Q1의 준비 |
| S7 | 0:58–1:26 | 28s | 기능 2. Find it: 말로 찾는다 | Q1 (어떤 사진이었지) |
| S8 | 1:26–1:40 | 14s | 기능 3. Pick: 사진에서 옷만 떼어 낸다 | Q2·Q3의 준비 |
| S9 | 1:40–2:18 | 38s | 기능 4. Try on: 재킷 A + 셔츠 B + 내 바지 | Q2, Q3 (+ 내 사진 보호) |
| S10 | 2:18–2:36 | 18s | 기능 5. Walk back: 그 노점으로 다시 걸어간다 | Q1 (어디였지) |
| S11 | 2:36–2:48 | 12s | 마무리: 처음의 지도, 질문 세 개에 체크 | 효용 정리 |
| S12 | 2:48–2:56 | 8s | 엔드카드: 기존 자산 / 이번 주 작업 고지 | 실격 방지(R2) |

배분: 도입(S0~S5) 44초, 기능 소개(S6~S10) 112초(64%), 마무리·고지 20초. 남는 4초는 편집 여유다.

## 이야기의 뼈대: 옷 세 벌과 사람 한 명

영상 전체를 같은 인물, 같은 옷으로 끝까지 끌고 간다. 기능마다 다른 예시를 쓰지 않는다(레퍼런스 원칙 1).

| 요소 | 설정 | 처음 등장 | 다시 등장 |
| --- | --- | --- | --- |
| 주인공 | 동묘에서 구제 쇼핑을 하는 사람. 도입부는 일러스트 캐릭터, 피팅 장면은 Codex로 생성한 데모 인물(D-R7-06) | S1 | S9 (피팅 인물), S11 |
| 재킷 A (대상) | 바닥에 옷을 펼쳐 놓은 노점(핀 ②)의 브라운 코듀로이 재킷. 하나뿐인 옷 | S2 | S6, S7, S8, S9, S10 |
| 셔츠 B (다른 가게) | 핀 ⑤ 노점 행거의 체크 셔츠 | S4 | S9 |
| 내 바지 (내 옷장) | 집에 있는 흑청 와이드 데님 | S3 | S9 |

[제안] 실제 옷 종류·색은 데모 fixture(Codex 생성 사진)에 맞춰 바꾼다. 중요한 것은 세 벌이 처음 질문에서 소개되고, 피팅 결과 한 장에 모두 모이는 것이다.

## 공통 화면 규칙

- **화면비:** 16:9. 폰 화면은 작게 가운데 두지 않는다. 폰을 화면 한쪽(약 40%)에 크게 두고, 반대쪽에 설명 그래픽(모델 칩, 데이터 흐름)을 둔다.
- **색:** 앱 테마(Hanok Indigo)의 한옥 바탕색과 인디고 강조색을 영상 그래픽에도 쓴다. 도입부 지도와 캐릭터도 같은 팔레트로 맞춰 앱 화면과 이어지게 한다.
- **모델 칩:** 기능 장면에서 모델이 일하는 순간, 해당 화면 요소 옆에 작은 칩이 붙는다. 칩은 두 종류로 색을 나눈다.
  - `ON DEVICE` 칩: EdgeTAM, PE-Core (이미지 쪽), 얼굴·머리 마스킹, 얼굴 재합성
  - `META API` 칩: Muse Voice Transcribe, Muse Spark 1.3, SAM 3.1, Muse Image, PE-Core (텍스트 쪽)
- **"왜" 한 줄:** 칩이 붙을 때 그 아래에 이 모델이 필요한 이유를 한 줄로 띄운다(예: "No product photos at a flea market → we cut them out of yours."). 내레이션과 같은 내용을 짧게.
- **앱 화면의 출처 표시:** 기능 장면의 앱 화면이 처음 나올 때 한 번 "Real app · Android emulator · live Meta APIs"를 작게 띄운다. 대기 시간을 줄인 곳에는 "Wait shortened · actual Ns"를 그 실행의 측정값으로 띄운다.
- **내레이션:** 본인 영어 음성 + 영어 자막. 짧은 현재형 문장, 사용자("you") 시점. 전체 약 330단어 이내.
- **소리:** 도입부는 시장 앰비언스(사람 소리, 비닐 소리)를 약하게. 기능 소개부터 가벼운 배경음. 음성 질의 장면에서는 배경음을 거의 끈다. 효과음은 핀이 꽂힐 때, 체크가 켜질 때, 피팅 결과가 뜰 때만.

### 모션그래픽과 실제 동작 증거 [제안]

사용자가 정한 방식대로 기능 소개는 모션그래픽으로 만든다. 다만 배포가 없어서 영상 속 동작이 Demo 점수(25%)의 유일한 근거이므로(D-R8-01), 모션그래픽의 재료를 아래처럼 잡는 것을 제안한다.

- 폰 프레임 안의 화면은 **에뮬레이터에서 실제 API로 돌린 녹화·캡처**를 쓴다. 손가락 탭 표시, 확대, 화면 전환 애니메이션, 칩·화살표는 그 위에 얹는다.
- 검색 결과 사진, SAM 후보 박스, 마스킹된 본인 사진, 피팅 결과 이미지는 **같은 실행에서 나온 실제 산출물**을 쓴다. 손으로 그린 가짜 결과를 앱 화면처럼 보이게 하지 않는다.
- 도입부(S1~S4)의 지도·캐릭터·말풍선은 순수 일러스트다. 이 구간에는 앱 화면이 나오지 않으므로 출처 표시가 필요 없다.

---

## 장면별 스토리보드

각 장면은 **화면**(무엇이 보이는가) → **움직임**(어떻게 변하는가) → **화면 텍스트** → **내레이션** → **소리** 순서로 적었다. 화면 텍스트와 내레이션은 영상에 실제로 들어갈 영어 문구 초안이다.

### S0. 타이틀 카드 (0:00–0:06)

**화면**
- 16:9 화면을 2:1로 나눈다.
- 왼쪽 2/3: 한옥 바탕색 위에 텍스트가 세로로 쌓인다.
  - 맨 위 작게: "Meta Global AI Developer Hackathon · Indie Developer · Build for Your World"
  - 가운데 크게: 제품명 "Street Fitting"
  - 그 아래: 태그라인 "Find it. Try it on. Walk back."
  - 맨 아래 작게: 만든 사람 이름
- 오른쪽 1/3: 동묘 거리 사진 한 장을 세로로 꽉 채운다. 바닥에 옷을 펼쳐 놓은 노점과 행거, 지나가는 사람들이 보이는 사진. 왼쪽 텍스트와 만나는 경계는 직선으로 자른다.

**움직임**
- 사진이 아주 천천히 확대된다(켄 번즈).
- 텍스트는 위에서부터 0.3초 간격으로 떠오른다.
- 5초째에 사진이 오른쪽에서 왼쪽으로 넓어지며 화면 전체를 덮고, 동시에 위에서 내려다보는 지도 시점으로 바뀌면서 S1으로 넘어간다.

**내레이션:** 없음. 시장 앰비언스만 깔린다.

**소리:** 시장 소음이 서서히 들어온다.

> 이 장면은 썸네일과 대표 이미지로 그대로 쓴다.

### S1. 동묘 지도와 사진 핀 (0:06–0:14)

**화면**
- 동묘 일대 골목을 단순하게 그린 일러스트 지도. 위에서 약간 비스듬히 내려다보는 시점.
- 골목을 따라 핀 6~8개가 꽂혀 있고, 핀마다 실제 동묘 거리 사진이 폴라로이드 카드처럼 붙어 있다(노점 바닥 옷 더미, 행거, 신발 좌판, 모자 가게 등).
- 지도 아래쪽 골목 입구에 일러스트 캐릭터(주인공)가 에코백을 메고 서 있다.

**움직임**
- 핀이 "툭, 툭" 하나씩 떨어져 꽂히고, 꽂힐 때마다 사진 카드가 펼쳐진다.
- 캐릭터가 골목을 따라 걷기 시작한다. 지나가는 핀의 사진이 살짝 커졌다 줄어든다(구경하는 느낌).
- 카메라가 캐릭터를 따라 천천히 이동한다.

**화면 텍스트:** 좌상단 작게 "Dongmyo flea market, Seoul"

**내레이션**
> "Dongmyo, Seoul. Hundreds of street stalls, no signs, no addresses, and every piece is one of a kind."

**소리:** 핀 꽂히는 짧은 효과음, 걷는 발소리.

### S2. 질문 ① "아까 그 재킷, 어디였지?" (0:14–0:22)

**화면**
- 캐릭터가 핀 ② 노점(바닥에 옷을 펼쳐 놓은 곳)에 멈춘다. 사진 카드가 크게 열리고 그 안의 **재킷 A**가 하이라이트된다.
- 캐릭터가 폰으로 사진을 찍는 동작. 셔터 플래시.

**움직임**
- 카메라가 빠르게 지도를 훑으며 시간이 흐른다(시계 아이콘 "+1 hour"). 캐릭터는 이미 몇 개 핀을 더 지나 핀 ⑥ 근처에 있다.
- 캐릭터 머리 위에 말풍선이 뜬다. 말풍선 안에 재킷 A의 흐릿한 실루엣.
- 지나온 핀들의 사진 카드가 모두 비슷하게 흐려지고 뒤섞인다. 핀 ②가 어디였는지 알 수 없게 된다.
- 캐릭터 폰 화면을 클로즈업: 갤러리에 비슷한 옷 사진이 수십 장 스크롤된다.

**화면 텍스트:** 말풍선 "Where was that jacket?"

**내레이션**
> "You see a jacket you love. An hour later, which stall was it? And which of your forty photos?"

**소리:** 말풍선 뜰 때 가벼운 "띵".

### S3. 질문 ② "내 옷이랑 어울릴까?" (0:22–0:30)

**화면**
- 캐릭터가 재킷 A 사진을 보며 고민한다.
- 캐릭터 옆에 두 번째 말풍선. 그 안에 집 옷장 일러스트가 열리고, **내 바지**(흑청 와이드 데님)가 걸려 있다. 옷장은 지도 바깥 멀리 "Home"이라고 표시된 작은 집 아이콘과 점선으로 연결되어 있다.

**움직임**
- 재킷 A 실루엣과 내 바지 실루엣이 말풍선 안에서 서로 가까이 붙으려다가 물음표와 함께 튕겨 나간다.

**화면 텍스트:** 말풍선 "Will it go with what I already own?"

**내레이션**
> "Will it work with the jeans you already have at home? You can't try that on here."

### S4. 질문 ③ "A랑 B를 같이 입으면?" (0:30–0:38)

**화면**
- 캐릭터가 핀 ⑤ 노점에서 **셔츠 B**를 집어 든다.
- 지도 위에서 핀 ②(재킷 A)와 핀 ⑤(셔츠 B) 사이에 점선이 이어지고, 두 노점 사이 거리 표시가 뜬다.
- 화면 가운데 세 번째 말풍선. A와 B를 겹쳐 보려는 그림.

**움직임**
- 세 개의 말풍선(Q1, Q2, Q3)이 캐릭터 위에 차례로 쌓여 떠 있는 상태로 정리된다. 각 말풍선 앞에 빈 체크박스가 붙는다. (S11에서 이 체크박스에 체크가 켜진다.)
- 캐릭터가 어깨를 으쓱한다.

**화면 텍스트:** 말풍선 "Jacket A + shirt B, together?"

**내레이션**
> "And the shirt two stalls down: would it look good with that jacket? Each piece is one of a kind. Walk away, and it might be gone."

**소리:** 체크박스 세 개가 정렬될 때 짧은 효과음 세 번.

### S5. 제품 공개 (0:38–0:44)

**화면**
- 캐릭터의 폰이 화면 가운데로 크게 다가온다. 지도 전체가 폰 화면 안으로 빨려 들어가듯 줄어든다.
- 폰 화면이 Street Fitting 앱 홈 화면으로 바뀐다.
- 폰 옆에 제품명과 태그라인.

**움직임**
- 지도 → 폰 화면 전환은 줌 아웃 한 번. 폰이 화면 왼쪽으로 자리를 잡고, 오른쪽에 텍스트가 나타난다. 이후 기능 장면은 모두 이 배치(왼쪽 폰, 오른쪽 설명)로 이어진다.

**화면 텍스트:** "Street Fitting" / "Find it. Try it on. Walk back."

**내레이션**
> "Street Fitting answers all three, with Meta's models."

**소리:** 배경음 전환. 시장 앰비언스가 빠지고 가벼운 비트가 들어온다.

---

### S6. 기능 1: 쇼핑 모드, 찍으면 위치가 붙는다 (0:44–0:58)

**화면 (왼쪽 폰)**
1. 홈에서 쇼핑 모드를 켠다. 화면 상단이 기록 중 상태로 바뀐다.
2. 카메라로 노점 외관을 찍고, 이어서 재킷 A를 찍는다.
3. 찍은 사진 카드가 trip에 쌓이고, 각 카드에 위치 핀 아이콘이 붙는다.

**화면 (오른쪽 그래픽)**
- 작은 지도 위에 방금 찍은 사진이 핀으로 꽂힌다. **S1의 지도와 같은 디자인**이라서, 도입부의 일러스트 핀이 실제 앱 데이터로 바뀌는 느낌을 준다.
- 사진 카드 아래로 숫자 벡터가 흘러 들어가는 짧은 애니메이션 → `ON DEVICE · PE-Core` 칩.
- 노점 외관 사진 옆에 짧은 묘사 문장이 타이핑된다(예: "Clothes spread on a blue tarp") → `META API · Muse Spark 1.3` 칩.

**"왜" 한 줄**
- PE-Core: "Every photo is indexed on your phone, so you can search it by meaning later."
- Spark: "Stalls have no names, so Spark describes what each one looks like."

**화면 텍스트:** 첫 등장 표시 "Real app · Android emulator · live Meta APIs"

**내레이션**
> "Turn on shopping mode and just snap. Every photo keeps the spot where you took it. PE-Core indexes each photo on the phone, and Muse Spark writes a short description of every stall."

### S7. 기능 2: Find it, 말로 찾는다 (0:58–1:26)

**화면 (왼쪽 폰)**
1. Find it에서 마이크를 누른다. 음성 파형이 움직인다.
2. 영어 전사문이 말풍선으로 뜬다.
3. 검색 단계가 한 줄씩 진행된다(사진 검색, 가게 묘사 확인, 옷 후보 찾기).
4. 결과 사진 카드가 뜨고, 사진 위에 옷 후보 박스가 점수 순으로 3개 표시된다.

**화면 (오른쪽 그래픽)**: 단계가 진행될 때마다 칩이 위에서 아래로 연결된다. 한 줄 데이터 흐름처럼 보이게.
1. 음성 파형 → 글자 → `META API · Muse Voice Transcribe`
2. 글자 → 작은 로봇 아이콘이 도구를 고르는 모습 → `META API · Muse Spark 1.3 (tool calling)`
   - 도구 아이콘 두 개가 번갈아 불이 들어온다: "search photos", "read stall notes"
3. "search photos" 도구 → 질의 문장이 벡터로 바뀌고(`META API · PE-Core text`) 폰 안의 사진 벡터들과 맞춰진다(`ON DEVICE · PE-Core image`)
4. 고른 사진 → 옷마다 테두리가 그려짐 → `META API · SAM 3.1`
5. 하단 작게: "≤ 4 Spark calls · ≤ 3 photos to SAM per query"

**"왜" 한 줄**
- "You don't remember the stall's name. You remember what it looked like. Spark turns that memory into a search plan."
- "SAM finds every garment in the photo, so you pick the one you meant."

**편집 메모**
- 음성 질의 → 전사문 → 결과 카드가 뜨기까지 한 번은 **원속도**로 보여 준다. 그 뒤 반복 대기만 줄이고 "Wait shortened · actual Ns"를 띄운다.
- 음성 질의 중에는 배경음을 끈다.

**음성 질의 (화면 속 본인 목소리)**
> "Find the brown corduroy jacket from the stall with clothes on a blue tarp."

**내레이션**
> "Just ask. Muse Voice Transcribe turns your voice into text. Muse Spark plans the search with tool calls: it matches your words against your photos and the stall descriptions, and SAM 3.1 outlines every garment in the best photos. Top three first, best match on top."

**소리:** 결과 카드가 뜰 때 효과음 1회.

### S8. 기능 3: Pick, 사진에서 옷만 떼어 낸다 (1:26–1:40)

**화면 (왼쪽 폰)**
1. 후보 박스 중 재킷 A를 누른다. 재킷만 남고 배경이 사라지는 컷아웃이 된다.
2. (대안 흐름 짧게) 후보에 없는 옷은 사진에서 직접 탭한다. 탭한 지점에서 영역 후보 3개가 겹쳐 보이고, 하나를 고른다.
3. 저장하면 재킷 A가 "Saved" 목록에 들어간다. 카드에 작은 위치 핀이 같이 붙는다.

**화면 (오른쪽 그래픽)**
- 손가락 탭 → 동심원 → 마스크 3개가 겹쳐 나타남 → `ON DEVICE · EdgeTAM`
- 저장된 컷아웃 카드에서 위치 핀이 분리되어 "walk back to here"라는 꼬리표가 달린다(S10 복선).

**"왜" 한 줄**
- "Flea markets have no product photos. Your photo becomes the product photo."
- "EdgeTAM runs on the phone, so a tap gives you a cutout instantly."

**내레이션**
> "Tap the jacket and save it. A flea market has no product photos, so your own photo becomes one. For anything SAM missed, EdgeTAM cuts it out right on the phone with a single tap. The piece remembers where it was found."

### S9. 기능 4: Try on, 재킷 A + 셔츠 B + 내 바지 (1:40–2:18)

이 영상에서 가장 긴 장면이다. Q2와 Q3에 한 번에 답하고, 내 사진을 어떻게 지키는지 보여 준다. 네 개의 비트로 나눈다.

**비트 1. 조합 고르기 (1:40–1:52, 12s)**
- 왼쪽 폰: 대상 칸에 재킷 A가 고정되어 있다. 함께 입을 옷 칸에 셔츠 B(다른 노점에서 저장한 옷)를 넣고, 옷장에서 내 바지를 넣는다. 슬롯은 최대 5칸.
- 오른쪽 그래픽: 지도 위 핀 ②(재킷 A), 핀 ⑤(셔츠 B), 집 아이콘(내 바지)에서 옷 세 벌이 날아와 하나의 조합 카드로 모인다. S2~S4 말풍선 속 옷이 그대로 날아오는 연출로 질문과 연결한다.
- 옷장 바지 카드에 이름표가 붙는 순간 → `META API · Muse Spark 1.3` 칩, "Labels your wardrobe cutouts".

**비트 2. 내 사진 보호 (1:52–2:02, 10s)**
- 왼쪽 폰: 본인 사진(데모 인물). 화면 모서리에 "AI-generated demo person" 표시.
- 오른쪽 그래픽: 세 장을 나란히 보여 준다.
  1. 원본 본인 사진 — 자물쇠 아이콘, "Stays on phone"
  2. 얼굴·머리가 지워진 사진 — `ON DEVICE · head masking (EdgeTAM)` 칩, 이 사진만 화살표를 따라 폰 경계를 넘어 `META API` 영역으로 이동
  3. (비트 4에서 채워질 빈 칸)
- 폰 경계선(PHONE | META API)을 세로 점선으로 분명히 그린다.

**비트 3. 생성 (2:02–2:08, 6s)**
- 오른쪽 그래픽: META API 영역에 마스킹된 본인 사진 1장 + 재킷 A + 셔츠 B + 내 바지가 모여 하나로 합쳐진다 → `META API · Muse Image` 칩.
- 왼쪽 폰: 생성 진행 상태. "Wait shortened · actual Ns".

**비트 4. 결과와 얼굴 복원 (2:08–2:18, 10s)**
- 결과 이미지가 폰 경계를 넘어 돌아온다. 얼굴 없는 상태로 도착한 뒤, 폰 안에서 원래 얼굴이 다시 합성되는 순간을 보여 준다 → `ON DEVICE · face restore` 칩.
- 왼쪽 폰 화면 가득 피팅 결과: 재킷 A + 셔츠 B + 내 바지를 입은 데모 인물. 결과가 뜰 때 효과음.
- 화면 하단 작게: "If the face can't be restored cleanly, you get a faceless result instead."

**"왜" 한 줄**
- Muse Image: "One shop piece plus up to five companions: your wardrobe or other stalls."
- 마스킹: "Only a face-and-hair-removed photo of you leaves the phone."

**내레이션**
> "Now the real question. Put the jacket on, add the shirt from the other stall and the jeans from your own wardrobe. Before anything is sent, your face and hair are masked on the phone. Only that masked photo and the garment cutouts go to Muse Image. When the result comes back, your face is restored on the device. Jacket, shirt, your jeans, on you."

### S10. 기능 5: Walk back, 그 노점으로 다시 간다 (2:18–2:36)

**화면 (왼쪽 폰)**
1. 피팅 결과 화면에서 길 안내를 누른다.
2. 지도에 현재 위치와 재킷 A를 찍은 지점이 표시되고, 도보 경로선이 그려진다. 남은 거리·시간이 줄어든다.
3. 목적지 근처에서 방향 화살표와 직선 거리로 바뀐다.
4. 도착 카드: 그 노점의 외관 사진과 Spark가 쓴 묘사, 메모.

**화면 (오른쪽 그래픽)**
- 폰 속 지도와 같은 위치를 S1의 일러스트 지도로 보여 준다. 캐릭터가 경로를 따라 걸어 핀 ②로 돌아간다.
- 핀 ②의 사진 카드가 다시 열리고, 그 안의 재킷 A가 반짝인다(S2의 흐려졌던 카드가 선명해지는 대비).
- 하단 작게: "Map: OpenFreeMap · Route: OSRM" (Meta 모델이 아닌 부분은 칩 색을 회색으로)

**"왜" 한 줄**
- "Street stalls aren't on any map. The photo's location is the address."

**내레이션**
> "One tap from the result, and it walks you back to the exact spot where you photographed that jacket. Street stalls aren't on any map. Your photo is the address."

**소리:** 도착할 때 효과음.

---

### S11. 마무리: 처음의 지도, 세 개의 체크 (2:36–2:48)

**화면**
- 다시 S1과 같은 동묘 지도 전경. 캐릭터가 재킷 A를 입고 서 있다.
- 캐릭터 위에 S4에서 쌓아 둔 말풍선 세 개가 다시 뜬다.

**움직임**
- 체크박스에 하나씩 체크가 켜진다. 각 체크 옆에 그것을 풀어 준 기능 이름이 작게 붙는다.
  - "Where was that jacket?" ✓ Find it · Walk back
  - "Will it go with what I own?" ✓ Try on with your wardrobe
  - "Jacket A + shirt B, together?" ✓ Mix pieces from any stall
- 지도가 줌 아웃되며 동묘 바깥, 세계 지도의 다른 벼룩시장들에도 핀이 켜진다 [추론: 다른 나라 벼룩시장에도 같은 문제가 있다고 가정].
- 마지막 2초: 제품명, 태그라인, GitHub 저장소 주소.

**내레이션**
> "Every flea market has the same problem: one-of-a-kind pieces, no signs, no fitting room. Street Fitting lets you find it, try it on, and walk back."

**소리:** 체크 세 번의 효과음, 배경음이 정점에서 끝난다.

### S12. 엔드카드: 고지 (2:48–2:56)

**화면**
- 한옥 바탕색 단색 화면에 문장 하나. 읽을 시간이 충분하도록 크게.
- 아래에 작게 소재 출처: 동묘 사진 저작자·라이선스, "AI-generated demo person".

**화면 텍스트 (초안)**
> "Built this week: the Street Fitting app, relay, and all product code. Pre-existing: the Astryx design system, the Capacitor template, a vendored stageshow UI kit (prototype only), and Meta's open EdgeTAM and PE-Core weights."

**내레이션:** 화면 문장을 그대로 읽는다. 두 범주를 한 문장 안에서 함께 말하고, "Everything was built this week"처럼 전부 새로 만든 것으로 읽히는 표현은 쓰지 않는다(R2).

---

## Meta 모델 사용 정리 (영상에 나오는 순서)

심사 기준 "Meta AI 활용 25%"에 대응한다. 모델 이름은 항상 그 모델이 일하는 장면에 붙인다(레퍼런스 원칙 3).

| 장면 | 모델 | 위치 | 하는 일 | 왜 필요한가 (영상 속 한 줄) |
| --- | --- | --- | --- | --- |
| S6 | PE-Core (image tower) | ON DEVICE | 사진 임베딩 색인 | 나중에 뜻으로 사진을 찾기 위해 |
| S6 | Muse Spark 1.3 | META API | 노점 외관 묘사 | 이름 없는 노점을 생김새로 기억하기 위해 |
| S7 | Muse Voice Transcribe | META API | 영어 음성 질의 전사 | 걸으면서 말로 묻기 위해 |
| S7 | Muse Spark 1.3 | META API | 도구 호출로 검색 계획·실행(질의당 최대 4회) | 흐릿한 기억을 검색 단계로 바꾸기 위해 |
| S7 | PE-Core (text tower) | META API (relay) | 질의 문장 임베딩 | 기기 안 사진 색인과 맞춰 보기 위해 |
| S7 | SAM 3.1 | META API | 사진 속 옷 후보 분할(최대 3장) | 사진 한 장의 여러 옷 중 원하는 것을 고르기 위해 |
| S8 | EdgeTAM | ON DEVICE | 탭 한 번 → 마스크 3개 | 후보에 없는 옷도 바로 잘라 내기 위해 |
| S9 | Muse Spark 1.3 | META API | 옷장 컷아웃 이름표 | 내 옷을 조합에 쉽게 넣기 위해 |
| S9 | EdgeTAM 기반 머리 마스킹 | ON DEVICE | 얼굴·머리 제거 | 내 얼굴이 담긴 원본을 보내지 않기 위해 |
| S9 | Muse Image | META API | 마스킹된 본인 + 대상 1 + 동반 최대 5벌 피팅 | 상품 사진 없는 시장 옷을 내 몸에 입혀 보기 위해 |

## 표현 규칙 (개인정보·사실)

- 쓴다: "Face and hair are masked on the phone before upload; the face is restored on the device."
- 쓴다: "Only that masked photo and the garment cutouts go to Muse Image." (S9 맥락에 한정. 검색 단계에서는 쇼핑 사진·외관 묘사가 Spark·SAM으로 간다.)
- 쓰지 않는다: "Everything runs on-device", "No photos leave your phone", "Fully private", 제공자의 무보존 보장.
- 위치 좌표는 Spark에 보내지 않는다. 지도 그래픽에서 좌표가 META API 쪽으로 넘어가는 것처럼 그리지 않는다.
- 결과 내려받기 버튼은 비활성(D-R4-10)이므로 결과를 저장·공유하는 장면을 넣지 않는다.

## 확인이 필요한 것

- 동묘 거리 사진: S0과 S1에 쓸 실제 사진 여러 장의 출처와 라이선스. 직접 찍지 않은 사진은 저작자·출처·라이선스를 엔드카드와 영상 설명란에 남긴다(앱 샘플 사진이면 `prototype/public/photos/CREDITS.md`에도). 미확인.
- 고지 위치: 사용자 결정으로 엔드카드(S12)에 둔다. FAQ 문구는 영상을 고지로 **시작**하라고 하므로, S0 타이틀 카드 하단에 같은 문장을 작게 한 줄 더 넣는 방안도 있다 [제안]. [demo-script.md "고지 위치"](demo-script.md#고지-위치) 참고.
- 피팅 결과 품질: 얼굴 재합성이 실패하면 얼굴 없는 결과가 나온다(D-R9-01). 이 경우 S9 비트 4는 "얼굴 없는 결과"를 그대로 보여 주고 내레이션의 "your face is restored" 문장을 뺀다. 미확인.
- 대기 시간 실측값: "Wait shortened · actual Ns"의 N은 녹화한 실행의 측정값으로 채운다. 미확인.
- 앱 화면 문구·버튼 이름: 이 문서는 기능 단위로만 적었다. 실제 버튼 이름과 배치는 최종 앱을 따른다.
- 내레이션 길이: 위 원고는 약 330단어다. 녹음 후 장면 길이를 넘으면 문장을 줄이고, 음성을 배속하지 않는다.
