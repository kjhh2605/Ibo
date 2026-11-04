# S08 app-ui
상태: 확정(R9까지) · 웨이브 1 · 선행: S00 merge 완료. 기능 상태는 즉시 구현하고 새 배치·문구의 최종 승인은 프로토타입 세션 결과가 선행한다.

## 목표
프로토타입의 유효한 흐름·문구·인터랙션을 React 앱으로 이식하고 Astryx 컴포넌트와 토큰으로 시각 표현을 근사한다. R9까지의 변경을 적용해 모든 화면을 실제 계약 상태와 연결하며 성공 타이머·가짜 OS UI를 제품 동작으로 옮기지 않는다.

## 읽을 문서
이 목록만 읽는다.
- [app/AGENTS.md](../../../app/AGENTS.md): Astryx 규칙 전부. 새 화면은 template에서 시작한다.
- [결정 로그](../decisions.md): R0~R9, 특히 D-R1-03, D-R7-07~09, D-R9-02~04.
- [navigation](../ux/navigation.md), [capture](../ux/capture.md), [search](../ux/search.md), [tryon](../ux/tryon.md), [walk](../ux/walk.md): 기능/상태 및 각 "프로토타입 미반영" 표 전부.
- [scope](../product/scope.md), [privacy](../product/privacy.md): 기능 범위·데이터 설명·오프라인.
- [device-modules](../contracts/device-modules.md): §1~10의 TS API·이벤트·web mock / [agent-tools](../contracts/agent-tools.md): §4~7 / [data-model](../contracts/data-model.md): 엔티티·삭제·스냅샷 / [relay-api](../contracts/relay-api.md): §5 오류·§8 생성 타입.
- 읽기 전용 시각/흐름 참고: [prototype App](../../../prototype/src/App.tsx), [screens](../../../prototype/src/screens/), [state](../../../prototype/src/state.tsx). 프로토타입 데이터·타이머·CSS는 구현 계약이 아니다.

## 소유 경로
- 수정: `app/src/screens/**`, `app/src/App.tsx`, `app/src/ui/**`. UI 테스트·web 클릭 검증 harness도 이 경로 안에 둔다.
- 금지: `prototype/**`, native/data/agent/walk/tryon 구현, relay, 공용 생성 타입, package/lock/Gradle/Manifest/main.tsx 등 S00 공유 파일, 계약 문서. CSS import·의존성·theme 등록 등 공유 변경은 S00 담당에게 요청한다.

## 구현 항목
1. Astryx template의 frame/gap/padding을 보존하며 기존 화면은 해당 section 안에서 수정한다. `npx astryx build "Street Fitting mobile shopping app"`, template/컴포넌트 props 조회 후 구현한다. raw div/span, raw hex/px, 자체 스타일 체계·Tailwind/StyleX 도입을 금지한다. reset/core CSS는 S00 공유 entry를 사용한다. [navigation 공통](../ux/navigation.md#f-17-공통-동작), [AGENTS](../../../app/AGENTS.md); D-R1-03.
2. route 목록은 `home`, `capture`, `trips`, `trip`, `ask`, `pick`(shop/wardrobe), `item`, `outfit`, `result`, `results`, `walk`, `wardrobe`, `privacy`다. **`send`와 `visit`는 없다.** 홈 스택·뒤로/시트 우선 닫기·토스트 2.6초·알림 3종 딥링크와 중복 카메라 방지를 구현한다. [navigation 화면 표](../ux/navigation.md#화면-스택과-진입-규칙); D-R3-10, D-R4-03, D-R9-04.
3. Home 최근 trip/All trips, Trip의 가게별 외관·묘사·메모 편집·사진을 구현한다. 별도 가게 화면 없이 사진은 Pick으로 간다. 촬영/권한/알림은 실제 모듈의 상태를 표시하고 OS 권한 카드·알림 오버레이를 가짜로 만들지 않는다. 외관 묘사 완료 카메라 카드는 없다. [capture F-01~05](../ux/capture.md); D-R2-01~11, D-R3-03, D-R9-04.
4. Find it만 마이크를 제공하고 음성 전사 즉시 검색·진행 단계·접기/펼치기·미발견의 다시 묻기/직접 탐색을 연결한다. Pick은 실제 mask 윤곽·점수순 첫3/Show all, 탭 세 후보를 제공하며 네트워크 없는 펼침과 선택을 지킨다. [search F-06~08](../ux/search.md), [agent §5](../contracts/agent-tools.md#5-ui-이벤트와-상태-머신); D-R3-02, D-R3-06~09, D-R7-09.
5. Item/옷장/피팅/기록은 이름 수정·삭제·원본 연결·본인 사진 교체·대상 shop 1+동반≤5를 표시한다. outfit→trips→trip→pick 완료는 자동 저장 후 원래 조합으로 복귀하고 취소도 조합을 보존한다. "Picked item"과 이름 대기를 표시한다. [tryon F-09~12](../ux/tryon.md), [navigation](../ux/navigation.md#화면-스택과-진입-규칙); D-R4-01~09, D-R9-02.
6. Result는 snapshot 이름/이미지/가게/목적지로 렌더링한다. 원래 target 삭제 후에도 보기·안내는 유지하고 "Change pieces"만 비활성화한다. Look/Original·다시 생성·전송 확인을 만들지 않는다. resultDownload=false이면 내보내기 진입도 차단한다. [data-model Result](../contracts/data-model.md#result), [tryon F-13~14](../ux/tryon.md#f-13-피팅-결과); D-R4-04~05, D-R4-10, D-R9-03.
7. Walk 진입은 Item/Result만 가능하다. 지도·턴바이턴·끝 구간·수동 도착·offline/error를 S09 상태로 렌더링하며 Demo/Walk a step/Go off route UI는 없다. Privacy는 실제 목적별 데이터 경계를 영어로 설명하며 raw self·쇼핑 사진·허용 cutout 전송을 혼동하지 않는다. [walk](../ux/walk.md), [privacy](../product/privacy.md); D-R5-01~05, D-R6-04, D-R7-07~08, D-R9-04.

### 프로토타입 미반영 처리 규칙
각 UX와 scope/privacy의 표에 있는 모든 행을 아래 분류로 추적한다. 세션 전에는 **기능 상태/라우팅/데이터 계약을 먼저 구현**하고 임시 영어 문구는 기존 유효 문구 또는 계약 기본 문구를 사용한다. 제품 화면에 임시/dev/mock 표시를 넣지 않는다. 세션 후 배치·문구를 승인 결과로 교체하고 클릭 검증을 갱신한다. 세션 미실시 상태를 시각 확정이라고 보고하지 않는다(D-R1-03, D-R7-07).

| 변경 묶음 | 세션 전에 구현할 기능 상태 | 세션 결과를 기다릴 배치·문구 |
| --- | --- | --- |
| 모든 trip·Visit 제거 | trips/Trip 가게 통합, 사진 Pick, 최근 trip, 삭제 참조 정리 | 날짜 목록·가게 영역 배치, 삭제 확인·복귀 표현 |
| 검색·음성·후보 | Find it 전용 마이크, 자동 검색, 단계 이력/접힘, 첫3/Show all, 미발견 탐색 | 단계/오류/빈 음성 문구와 후보 펼침 배치 |
| 피팅·직접 자르기 | 대상1/동반5, 왕복 선택 보존, 자동 저장·Picked item, 이름 수정/대기 | 고정 대상/동반 구분, 이름 진행·상한·복귀 표시 |
| 마스킹·생성 | 실패 차단·재촬영, send 제거, 생성/재합성/faceless 상태 | 진행 위치·실패 안내·얼굴 없는 결과 표현 |
| 결과/삭제/내려받기 | 비교 제거, snapshot, 삭제 뒤 Change pieces 비활성, export flag | 삭제된 옷 표시·다운로드 OFF/ON 표현 |
| 지도 | Item/Result 진입, route/direction/nearby/arrived/offline/error | 끝 구간·외관 없는 도착 카드·실패 배치 |
| Privacy·오프라인 | 정확한 경계·허용 큐, 로컬 탐색 유지, 네트워크 재시도 | 영어 설명·빈 상태/실패/오프라인 공통 표현 |

## mock 경계와 의존
모든 native·relay를 계약 web mock으로 연결한다. S00의 공용 인터페이스를 사용하고 UI 내부 성공 타이머를 두지 않는다. S04~S10이 merge되기 전에는 인터페이스 호환 UI 전용 adapter를 `app/src/ui/**`에 둘 수 있으나 실제 통합 시 중복 모듈을 제거하고 각 owner 구현을 연결한다. Map web mock은 SVG이고 실제 MapLibre 검증은 S09/S11이다. 프로토타입 세션 전후의 변경은 동작 계약을 바꾸지 않는다.

## 합격 기준
아래 명령은 구현 후 요구다. web 검증 CLI는 이 슬라이스가 `app/src/ui/verify-web.ts`로 제공한다 [추론·검증 인터페이스]. 앱 dev 서버·브라우저를 시작/정리하고 실제 클릭 결과를 검사하며 exit 1은 실패, 대상 route 0개도 실패다. 필요한 공용 runner 의존성은 S00에 요청한다.

| 명령(저장소 루트) | 합격 조건 |
| --- | --- |
| `npm --prefix app run lint` | 오류 0, Astryx 규칙 위반 없음 |
| `npm --prefix app run build` | 성공, 실제 app 번들 생성 |
| `(cd app && npx astryx doctor --built dist)` | doctor 성공. 실패를 무시하고 전달하지 않음 |
| `(cd app && npx vitest run src/screens src/ui)` | route/뒤로/시트/딥링크/삭제/스냅샷/flag/개수/마이크 위치 테스트 통과 |
| `(cd app && node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock)` | 쇼핑→종료→질문→Pick→Item→피팅 왕복→Result→Walk·수동 도착→기록/삭제, Wardrobe·Privacy를 실제 클릭. send/visit 미존재, Trip 직접 Walk 불가 |
| `(cd app && node --experimental-strip-types src/ui/verify-web.ts --scenario states --mode mock)` | 모든 route에서 빈 상태·오프라인·실패 상태 점검. 해당 없음은 근거 기록(예: Privacy는 정적 로컬 내용). raw self 전송/자동 생성/다운로드 0회, dev/mock/Demo UI 0개 |

검증 증거에 화면별 상태 행렬과 프로토타입 세션 승인 여부를 포함한다. 에뮬레이터 추가 확인은 반드시 `scripts/emulator-lock.sh` 안에서 수행하며 동시 AVD를 만들지 않는다. mock 통과를 native 완성으로 보고하지 않는다.

## 완료 보고 형식
- 바꾼 파일·route 목록.
- 실행한 lint/build/doctor/테스트/클릭 명령과 결과, 화면별 상태 행렬.
- 미확인·위험: 프로토타입 세션에서 승인/미승인 항목, 실제 모듈 미연결 항목.
- 계약 변경 요청: 공유 entry·DTO·runner 의존성 등, 없으면 "없음".

## 미확인·위험
배치·새 문구는 프로토타입 세션 전까지 미확인이다. 이 대기는 기능 상태 구현을 미루는 이유가 아니며, 세션 전 산출물은 기능 합격과 시각 승인 미완료를 분리해 보고한다. dev 배지를 숨긴다고 mock을 실제 API 성공으로 주장해서는 안 된다.
