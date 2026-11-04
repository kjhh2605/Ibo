# Street Fitting app

React/Astryx UI와 실제 S06 Store, S07 검색 agent, S09 Walk, S10 TryOn controller를 연결한다. Android는 Capacitor native plugin을 사용한다. 일반 브라우저에서 native 기능을 성공한 것처럼 대체하지 않으며, 브라우저 검증에는 명시적 `web-mock` runtime이 필요하다.

## 개발·검증

```sh
# 이 디렉터리에서 실행
npm run lint
npm run build
npx astryx doctor --built dist
npx vitest run

# 실제 UI/owner controller + IndexedDB Store + 명시적 native-web fixtures
node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock
node --experimental-strip-types src/ui/verify-web.ts --scenario states --mode mock

# 같은 runtime을 수동 브라우저 검증용으로 유지; 출력된 WEB_MOCK_URL 사용
node --experimental-strip-types src/ui/verify-web.ts --scenario serve --mode mock
```

runner는 저장소의 `verification/fixtures`를 HTTP로 제공하고 임시 Vite 서버를 시작한다. `SF_UI_FIXTURE_ROOT`로 fixture root를 변경할 수 있다. 자동 시나리오는 설치된 Playwright Chromium을 사용하고 종료 시 브라우저·서버를 정리한다. `serve`는 Ctrl-C로 종료한다.

runner 설정:
- `VITE_SF_RUNTIME=web-mock`
- `VITE_SF_RELAY_MODE=mock`
- `VITE_SF_VERIFICATION=1`
- `VITE_SF_WEB_FIXTURES=<local HTTP fixture root>`

`web-fixtures.ts`는 실제 WebRepository API로 과거 trip/photo/embedding을 넣고, 실제 Capture/Media/Segmenter/Voice web plugin에 입력 fixture를 제공한다. 앱에서 저장한 piece·photo·result는 IndexedDB에 남는다. 삭제한 과거 trip은 새로고침 시 재생성하지 않는다. 메모리 Store adapter, 화면 강제 이동, 가짜 생성 성공 hook은 없다.

## 관측 경계

`window.__sfVerification.inspect()`는 읽기 전용이다. 명시적 verification flag와 다음 조건을 함께 만족해야 설치된다.
- 브라우저: `web-mock` + Vite DEV.
- Android: native `Store.getRuntimeInfo()`가 실제 debug build임을 확인. release/검증 실패는 닫힌다.

반환값은 route/stack, 저장된 ID, 실제 agent/fitting/walk snapshot, 공용 경계에서 관측한 transport counters다. counter scope는 `relay-attempts/shared-file-reads/media-export-attempts`이며, 원본 사진의 **로컬 읽기**와 원본 업로드를 동일시하면 안 된다. 이미지·오디오 bytes와 인증 token은 노출하지 않는다.

## 현재 증거와 한계

상세 명령 결과·화면 상태는 [S08 체크포인트](../verification/results/2026-11-04-s08-ui/CHECKPOINT.md), 자동 클릭 결과는 같은 디렉터리의 `full/matrix.json`, `states/matrix.json`을 참고한다.

- lint/build/doctor 및 전체 227개 테스트 통과를 관측했다. lint 경고와 기존 theme-fonts 경고는 남아 있다.
- 실제 browser UI에서 12개 route와 검색·음성·저장·재시작·삭제·직접 companion 선택·보행 상태 전이를 관측했다.
- **full/states acceptance는 실패**다. 현재 corpus에는 self/provider의 실제 person 3-mask 입력이 없어 FaceMask 등록이 실패하고 Generate가 차단된다. Result route, 생성 결과 삭제·snapshot UI의 전체 클릭 검증은 아직 미확인이다. 실패를 seed result나 성공 stub으로 우회하지 않는다.
- 이미지/아이템 mask와 음성 tone fixture는 명시적 mock 입력이다. 사람 음성 인식 품질, head-mask 안전성, 실제 모델/API 성공 또는 M1 Android 성공의 증거가 아니다.
- 새 배치·문구의 인간 프로토타입 세션 승인은 미확인이다.
