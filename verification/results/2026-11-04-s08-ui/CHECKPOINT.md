# S08 중단 시점 WIP 체크포인트

상태: **미완료·미검증**. 사용자의 두 Mac 인계를 위한 중단 지시를 수신한 뒤 app/src 수정을 중지했다. 이 문서는 acceptance 증거가 아니며 새 UI 배치·문구의 프로토타입 세션 승인도 받지 않았다.

## 보존한 경로

수정: `app/src/App.tsx`.

신규:
- `app/src/screens/Shopping.tsx`
- `app/src/screens/Search.tsx`
- `app/src/screens/Fitting.tsx`
- `app/src/screens/Fitting.test.ts`
- `app/src/screens/Walk.tsx`
- `app/src/screens/Privacy.tsx`
- `app/src/ui/navigation.ts`
- `app/src/ui/navigation.test.ts`
- `app/src/ui/services.ts`
- `app/src/ui/state.tsx`
- `app/src/ui/components.tsx`
- `app/src/ui/Shell.tsx`
- `app/src/ui/web-fixtures.ts`
- `app/src/ui/web-adapter.ts`
- `app/src/ui/browser-scenarios.ts`
- `app/src/ui/verify-web.ts`
- 이 체크포인트 문서.

## 작성한 동작 — 실행 확인 전

- 단일 stack: home/capture/trips/trip/ask/pick/item/outfit/result/results/walk/wardrobe/privacy. send/visit route와 하단 tab 없음. Back/Escape/Android back, 삭제 후 stack 정리, shopping notification deep link, offline banner, toast와 sheet.
- Shopping: 시작/종료·권한 실패 안내·native preview rect/close·새 가게·외관·메모·최신 사진·다중 trip 탐색·삭제. 원본 trail 종료 삭제 설명. Camera preview lifecycle 직렬화와 늦게 끝난 self/media 요청의 화면 이동 방지.
- Search/Pick: S07 상태 구독·voice/단계/결과/Show all·실제 fixture binary mask contour·원본 aspect의 pointer/keyboard 선택·3 대안·mask 완료 전 저장 차단·원본 export/delete·shop/wardrobe/outfit 저장.
- Fitting: target 고정·0–5 companions·self 등록·명시적 Generate·취소·immutable result snapshot·결과 history/delete·Change pieces eligibility·flag가 꺼진 result export 차단.
- Walk: S09 Walk/Map API 연결, map lifecycle, route/direction/nearby/arrived/offline/error UI, nearby에서만 수동 도착 확인, target snapshot 목적지. Privacy에는 실제 전송 목적과 기기 전용 데이터 경계 설명.
- Astryx shell template를 출발점으로 컴포넌트/토큰을 사용했다. 실제 화면·스타일·접근성·반응형 검증은 아직 없다.
- navigation/Fitting의 행동 테스트를 작성했으나 실행하지 않았다.

## 독립 web adapter / 아직 실제 owner 통합 아님

`services.ts`는 실제 owner 경로 `agent/index.ts`, `tryon/index.ts`, `walk/index.ts`, `data/index.ts`를 로드하도록 작성했다. 현재 worktree에는 이 peer 구현이 합쳐지지 않았고 native 경로는 fail closed다. 임시 UI 타입 경계는 owner 실제 export로 교체·검증해야 한다.

`web-adapter.ts`는 **web + VITE_SF_UI_ADAPTER=1**에만 허용된 메모리 contract adapter다. Android에서 사용하지 않는다. S11 실제 Codex fixture를 HTTP로 읽으며 prototype 데이터/timer를 사용하지 않는다. 이는 provider/native/영속 저장 성공 증거가 아니다. 통합 시 제거해야 한다.

- 실제 fixture root 기본값: sibling `s11-verification/verification/fixtures`.
- `window.__sfUi`: reset, setFailure, setOffline, setMaskFailure, setWalkMode, emitDeepLink, visit, inspect.
- seed는 검토 전 fixture self/result/draft도 넣지만 generate counter는 증가시키지 않는다. result는 provider generation 결과가 아니다.
- **미완료**: adapter `segmenter.person()`은 명시적으로 reject한다.
- **미완료**: adapter capture의 shutter 시점 trip/shop snapshot 및 stop 대기 순서.
- **미확인**: preview canvas 초기 viewport 덮음/aspect, candidate-ID의 최종 Search 구현과 호환.
- **제약**: 메모리 상태이며 새로고침 영속성 없음.

## 발견한 계약 blocker

`docs/prd/ux/capture.md` F-05는 Trip의 모든 가게에서 외관 추가·수정을 요구한다. 고정 `Capture.takePhoto({kind})`는 현재 recording shop만 대상으로 하며 `Store.updateShop`은 note만 받는다. S04가 historical target/import route 없음과 current-shop-only를 확인했다. 따라서 historical Shop에 외관을 제대로 붙일 public API가 없다.

coordinator에 명시적 historical storefront target API 확장을 제안했으나 승인/DTO 변경 전 stop 지시를 받았다. **UI·native·Store DTO를 확장하지 않았다. 현재 Trip 외관 추가/retake 진입은 미완료**다. 해결 정책과 S04/S06 계약 합의 후 구현해야 한다.

## 실제 실행한 것 / 실행하지 않은 것

실행 확인:
- Astryx build/template/component-info 가이드 조회.
- `npx astryx template shell-top-nav src/ui/Shell.tsx`로 shell scaffold 생성 후 owned UI로 작성.
- `aside guide repl`, Aside skill inventory 조회. 실제 browser는 열지 않았다.
- 중단 시 `git status --short`: `M app/src/App.tsx`, `?? app/src/screens/`, `?? app/src/ui/`.

**실행하지 않음**: lint, TypeScript/Vite build, Astryx doctor, Vitest, full/states browser scenario, Android sync/build/install/device 확인. 따라서 compile/runtime/test 결과는 **미확인**, 화면 screenshot/state matrix evidence는 **없음**이다. 성공했다는 표현을 사용하지 않는다.

시작한 dev server, fixture server, emulator, model/API job, 장기 shell process: **없음**. 세 local coding subagent는 모두 중지/완료했고 실행 중 child process가 없음을 보고했다. 기존 coordinator emulator는 건드리지 않았다.

## 재개 순서

1. 공통 handoff와 새 coordinator 지시를 읽고 setup 중복 실행 없이 root `scripts/worktree-env.sh` 환경을 사용한다.
2. historical storefront 계약 결정을 S04/S06/coordinator와 해결한다. 실제 S06/S07/S09/S10 export를 통합하고 UI-local temporary boundary/adapter 제거 시점을 구분한다.
3. 미완료 adapter 항목과 Aside harness를 마무리한다. `browser-scenarios.ts`는 한 번도 실행되지 않은 초안이며 locator, Aside API, 120초 제한, screenshot stdout 전달, route/empty/error/offline assertion을 검증해야 한다. backend/permission/voice/queue/masking state coverage도 보강 필요하다.
4. `npm --prefix app run lint`, `npm --prefix app run build`, app cwd의 `npx astryx doctor --built dist`, `npx vitest run src/screens src/ui`를 실행하고 관측한 실패를 수정한다.
5. app cwd에서 `node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock` 및 `--scenario states --mode mock`을 실제 Aside browser로 실행한다. runner가 임시 Vite/fixture server를 띄우므로 재개 후에만 실행한다. 실제 click/state/screenshot evidence를 보존한다.
6. 독립 web 증거와 실제 owner/native 통합 증거를 구분한다. 새 배치·문구에 대한 인간 프로토타입 세션 승인을 별도로 받는다. 이 체크포인트를 완료된 PR/제품으로 취급하지 않는다.
