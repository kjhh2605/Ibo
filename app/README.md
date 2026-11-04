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

runner는 저장소의 `verification/fixtures`와 실제 Android mask 증거를 HTTP로 제공하고 임시 Vite 서버를 시작한다. `SF_UI_FIXTURE_ROOT`로 fixture root를, `SF_UI_NATIVE_MASK_ROOT`로 `person-mask-export-after.json`과 `person-masks/`가 있는 증거 디렉터리(기본 `verification/results/2026-11-04-m1-resume`)를 바꿀 수 있다. source/mask hash·해상도·binary 픽셀을 검사하며 모델 점수나 mask를 만들어 보충하지 않는다. 자동 시나리오는 설치된 Playwright Chromium을 사용하고 종료 시 브라우저·서버를 정리한다. `serve`는 Ctrl-C로 종료한다.

runner 설정:
- `VITE_SF_RUNTIME=web-mock`
- `VITE_SF_RELAY_MODE=mock`
- `VITE_SF_VERIFICATION=1`
- `VITE_SF_WEB_FIXTURES=<local HTTP fixture root>`
- `VITE_SF_WEB_NATIVE_MASKS=1` — 위 실제 Android 산출물을 명시적 web-mock 입력으로 연결

`web-fixtures.ts`는 실제 WebRepository API로 과거 trip/photo/embedding을 넣고, 실제 Capture/Media/Segmenter/Voice web plugin에 입력 fixture를 제공한다. 앱에서 저장한 piece·photo·result는 IndexedDB에 남는다. 삭제한 과거 trip은 새로고침 시 재생성하지 않는다. 메모리 Store adapter, 화면 강제 이동, 가짜 생성 성공 hook은 없다.

## 관측 경계

`window.__sfVerification.inspect()`는 읽기 전용이다. 명시적 verification flag와 다음 조건을 함께 만족해야 설치된다.
- 브라우저: `web-mock` + Vite DEV.
- Android: native `Store.getRuntimeInfo()`가 실제 debug build임을 확인. release/검증 실패는 닫힌다.

반환값은 route/stack, 저장된 ID, 실제 agent/fitting/walk snapshot, 공용 경계에서 관측한 transport counters다. counter scope는 `relay-attempts/shared-file-reads/media-export-attempts`이며, 원본 사진의 **로컬 읽기**와 원본 업로드를 동일시하면 안 된다. 이미지·오디오 bytes와 인증 token은 노출하지 않는다.

## 현재 증거와 한계

상세 명령 결과·화면 상태는 [S08 체크포인트](../verification/results/2026-11-04-s08-ui/CHECKPOINT.md), 자동 클릭 결과는 같은 디렉터리의 `full/matrix.json`, `states/matrix.json`을 참고한다.

- lint/build/doctor 및 전체 228개 테스트 통과를 관측했다. lint 경고와 기존 theme-fonts·bundle 크기 경고는 남아 있다.
- 실제 browser UI에서 13개 route를 열었고 `full` 49개 관측, `states` 88개 관측이 통과했다. 실제 FaceMask 등록·재합성 안전 분기·Store Result 저장/삭제, 새로고침 후 결과 보존을 확인했다.
- provider 응답은 명시적 합성 이미지다. 검증된 Android person masks를 사용했지만 실제 Muse 생성 품질이나 사람 GT 기반 privacy 승인이 아니다. 검출 불가 원본 provider fixture는 unsafe-provider 음성(陰性) 사례로 보존하고, 정상 합성 사례도 미보정 재합성 threshold 때문에 실제 얼굴 없는 결과가 된다. 성공 Result를 seed하거나 서비스 결과를 덮어쓰지 않는다.
- 실제 Android wardrobe tap masks도 연결해 취소 후 재수입·cutout 저장·오프라인 naming 대기와 재연결·새로고침 후 보존·삭제를 확인했다. naming 응답과 아이템 draft mask·음성 tone은 명시적 mock이며 사람 음성 인식·실제 API 품질·M1 전체 E2E 증거가 아니다.
- 새 배치·문구의 인간 프로토타입 세션 승인은 미확인이다.
