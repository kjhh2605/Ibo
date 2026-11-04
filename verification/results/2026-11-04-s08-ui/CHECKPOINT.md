# S08 실제 owner 통합 체크포인트

상태: 초기 worker 인계는 실제 person-mask 입력 부재로 전체 acceptance 미완료였다. 이후 coordinator가 실제 Android mask 산출물을 연결해 **browser full/states의 13개 route와 실제 모듈 경로의 Result 저장/삭제를 검증**했다. 아래 초기 기록과 마지막 후속 절을 구분한다. provider 응답은 명시적 합성이며 native 전체 E2E·실제 API 품질·사람 privacy 승인으로 간주하지 않는다.

## 실제 연결

- `app/src/ui/services.ts`: S06 `Store`/data worker, native Capture/ShoppingSession/Media/Segmenter, S07 `agent`, S09 `Walk`/`Map`, S10 `tryOn`의 실제 export를 정적 import한다. UI-local 서비스 타입은 owner export에서 가져온다.
- `app/src/ui/web-adapter.ts` 삭제. `VITE_SF_UI_ADAPTER`, 메모리 production Store, `window.__sfUi`의 reset/visit/setWalkMode 등 성공·화면 조작 경로를 제거했다.
- `web-fixtures.ts`: 명시적 web-mock에서 실제 IndexedDB repository API로 입력 데이터를 준비한다. Capture/Media에 원본 fixture를 주고, Segmenter에 corpus의 binary item mask를 제공하며, relay client의 승인된 mock transport에 corpus 응답을 연결한다. native inference나 결과를 가장하는 UI state를 만들지 않는다.
- `images.ts`와 Thumbnail/PhotoView: durable FileRef를 사용한다. 브라우저는 소유된 Blob URL을 생성·해제하고 native는 Capacitor URL을 사용한다.
- `App.tsx`/`screens/**`/`ui/**`: 13 route, detail key별 수명, 카메라 직렬화, 늦은 비동기 작업 취소, sheet 우선 Back, 삭제 stack 정리, 검색 결과 mask 수명, 고정 target+최대5 companions, self 등록/생성 오류, result snapshot, 보행 상태를 실제 controller에 연결했다.
- `walk/location.ts`: 브라우저에서 미구현인 Capacitor `requestPermissions`를 호출하지 않는다. native만 명시적 권한 요청을 하고 브라우저는 실제 watch/getCurrentPosition의 권한 흐름을 따른다. native permission-denial 행동 테스트를 유지했다.
- `walk/index.ts`: 명시적 web-mock 또는 relay mock에서 owner MockMap을 사용한다. 실제 WalkController/Location/RelayRoute는 유지한다.
- `agent/controller.ts`/Search: canonical `microphone_permission_denied` 사용, obsolete alias 제거. Shopping은 camera permission denial과 일반 preview 실패, transient location failure와 permission/provider-disabled를 구분한다.
- toast가 촬영 직후 End shopping을 가로막는 것을 실제 브라우저에서 관측하고, 비상호작용 toast에 pointer pass-through를 적용했다. 수정 후 즉시 End shopping 확인 sheet가 열렸다.
- prototype 변경은 승인된 Privacy의 historical storefront one-shot location 예외 문구뿐이다. 다른 prototype 파일은 수정하지 않았다.

## Historical storefront 계약

D-R11-01에 따라 `Capture.openPreview({purpose:'storefront',shopId,facing:'back'})` 뒤 `takePhoto({kind:'storefront'})`를 호출한다. 끝난 trip의 shop에도 명시적 촬영이 가능하고 현재 위치를 한 번 사용한다. Shop.spot을 대체 위치로 만들지 않으며 shopping trail을 시작하지 않는다.

실제 browser 관측: Oct31 trip에서 Add storefront photo → one-shot disclosure → Capture storefront → 원래 Trip 복귀, session은 계속 idle, Photo ID를 참조하는 describe_storefront queue 생성 → 실제 worker/relay fixture 완료 → queue 비워짐. `/v1/describe/storefront` 1회가 관측됐다.

## 실행한 공용 gate

최종 실행: Pick cleanup 오류 및 shopping service error 분기 수정 **후**, app cwd에서 아래 연쇄 명령, 전체 exit 0. 최종 Vitest 소요 736ms, 실행 출력 `artifact://122`.

```sh
npm run lint && npm run build && npx astryx doctor --built dist && npx vitest run
```

| Gate | 관측 결과 |
|---|---|
| lint | 오류0, 경고24. React refs/effect/dependency/export 경고와 generated triple-slash-reference 포함 |
| build | 성공, 2404 modules, `dist/` 생성. large-chunk 경고 |
| Astryx doctor | 성공. 기존 theme-fonts 경고 |
| 전체 Vitest | 18 files / 227 tests 통과 |

초기 owner 통합 직후에도 lint/build/doctor와 screens/ui 2 files /15 tests가 통과했다. 이후 최종 전체 suite 결과가 위 표다. 문구·단순 forwarding/default assertion은 삭제했으며 행동·경계 테스트는 유지했다.

## 실제 browser 실행

1. `browser` tool로 실제 Vite 앱을 412×892 viewport에서 열고, native-web/IndexedDB/owner controller를 통해 클릭했다. 화면·오류·observer 상태를 관측했으며 UI state나 navigation을 강제로 설정하지 않았다. 권한 오류 검증만 공개된 native-web fixture context에 입력했다.
2. 다음 CLI는 Playwright Chromium에서 실제 버튼/키보드를 사용한다. 앱 서비스 응답을 교체하거나 Store를 직접 조작하는 browser hook이 없다.

```sh
node --experimental-strip-types src/ui/verify-web.ts --scenario full --mode mock
node --experimental-strip-types src/ui/verify-web.ts --scenario states --mode mock
```

**초기 두 명령은 exit 1**이었다. 당시 person fixture가 없어 안전한 self 등록에 실패했고 Result를 seed하지 않았다. 이후 coordinator 수정·실행으로 `full/matrix.json`, `states/matrix.json` 및 PNG는 최신 통과 관측으로 갱신됐다. 변경 전 기록은 Git 이력에 보존한다.

### 초기 worker가 관측한 화면·상태

| Route | 실제 관측 |
|---|---|
| home | 초기 빈 화면, 과거/current trip, saved piece, recording 복원, 새로고침 영속성, offline banner, location permission/일시적 location 실패 |
| capture | 실제 native-web 이미지 preview, storefront/item shutter, end shopping, canonical camera permission 오류·retry, 종료 후 preview 정리 |
| trips | 모든 trip 목록, outfit 선택 왕복, 삭제 복귀 |
| trip | shop별 photo/description/note, historical storefront 추가, describe queue 완료, trip 삭제, 직접 Walk 진입 없음 |
| ask | 실제 4-turn agent loop/1 SAM 요청, 단계/완료, VoiceWeb VAD→1 transcribe→즉시 검색, microphone denial 시 relay 호출0 |
| pick | 실제 binary mask 윤곽, 첫3/Show all4, offline 펼침에서 추가 inference 없음, save, source photo 삭제, keyboard center prompt의 명시적3-mask fixture |
| item | durable cutout, 원본 연결, try-on/walk 진입, offline rename/delete. 원본 photo·trip 삭제 후 cutout/walkTo 보존을 새로고침 뒤 확인 |
| outfit | target 유지, companion 선택 취소 복귀, trip direct cutout 자동 저장·추가, 실제 self 등록 실패 시 Generate 차단 |
| result | 실제 생성 성공을 통한 route 진입 **미확인**; seed/fake 결과 없음 |
| results | 빈 history, offline 상태. 실제 생성 결과 삭제는 **미확인** |
| walk | route→direction→nearby(두 위치 sample·5초 경계)→사용자 수동 arrived, 실제 location 오류·Try again, offline/reconnect |
| wardrobe | 빈 화면, 실제 Media import→Pick 및 취소. wardrobe cutout 성공은 person/tap fixture 확보 후 추가 검증 필요 |
| privacy | 실제 영어 disclosure 렌더링·offline 상태. 새 문구 인간 승인은 미확인 |

추가 직접 browser 증거: source Photo 삭제 후 검색 참조가 정리되고 저장한 Piece는 남았다. 다시 Home→Item 및 reload 후에도 원본 연결 없이 cutout·사진 위치가 남았다. 이어 해당 Trip을 삭제해도 saved-piece 목적지는 유지됐다. Offline Rename/Delete 후 reconnect+reload에서 삭제가 유지됐다.

Chromium의 geolocation override 변경은 새 fix 전 `POSITION_UNAVAILABLE(code2)`를 발생시켰다. runner는 이를 숨기지 않고 실제 Try again UI로 복구한다. 보행 mode를 강제로 설정하지 않는다.

### 최종 cleanup·location 실패/복구 smoke

최종 gate 뒤 `--scenario serve --mode mock`이 만든 별도 origin에서 browser tool로 실행했다. Store/service를 성공 mock으로 바꾸지 않았다. 실패 입력은 IndexedDB의 `files` 삭제에만 실제 예외를 발생시키는 임시 fault와 native-web의 권한/start 실패·실제 error event였다. fault는 재시도 전에 복원했고 임시 browser tab·Vite/fixture server는 종료했다.

- Trip Photo → Enter 중심 tap으로 실제 임시 mask3개 생성 → `files` 삭제 실패 → "Cancel area selection": cleanup 오류와 "Try again", 저장 버튼 disabled, 파일3개 보존을 IndexedDB 읽기로 확인했다.
- fault 제거 → 실제 "Try again": 임시 mask0개와 오류 제거를 확인했다. 부분 실패 파일은 소유 set에서 잃지 않고 실제 cleanup 재시도 대상으로 남긴다.
- Wardrobe → 실제 Media import → 파일 삭제 실패 → "Cancel": 원본 discard 실패가 "Some temporary photo data could not be removed from this device."로 표시됐다. Piece나 Result를 성공 생성하지 않았다.
- 위치 권한 거부는 "Open settings"를 표시했다. `location_unavailable`은 별도 신호 재시도 시트, 설정 버튼 없음, session idle이었다. `service_unavailable` event는 설정 변경을 요구하지 않는 별도 service 오류로 표시됐다.
- 실패 입력 제거 → Start shopping 성공(recording) → 실제 End shopping 확인 → idle, camera preview DOM0을 관측했다.
- raw 관측 값: [`cleanup-location.json`](cleanup-location.json). 시각 증거: [`cleanup-failure.png`](cleanup-failure.png), [`cleanup-recovered.png`](cleanup-recovered.png), [`media-cleanup-failure.png`](media-cleanup-failure.png), [`location-permission.png`](location-permission.png), [`location-transient.png`](location-transient.png), [`location-service.png`](location-service.png).

최신 full/states screenshot 목록은 각 `matrix.json`에 기록한다. 각 15장에 `10b-wardrobe-saved.png`, `13-outfit.png`, `14-result.png`가 포함된다. 이전 실패 이미지는 현재 증거에서 제거했으며 Git 이력에 남아 있다.

## 초기 인계에서 요청한 실제 입력·검증 조건

인계 당시 빠진 것은 owner export가 아니라 아래 실제 mask 값이었다. self/provider person 산출물은 이후 M1에서 확보했으며 마지막 후속 절에 기록한다. 확인된 입력 크기·bytes SHA256:

| 입력(모두 `verification/fixtures/` 아래) | 크기 | SHA256 | 필요한 출력 |
| --- | --- | --- | --- |
| `images/self/positive/calibration-hat.png` | 508×764 | `8cae4180d99e2673231e06eae94375468ec7373906cec7b5a6bfce4592b5b2a4` | 실제 full-person mask3개와 score |
| `relay/normal/assets/synthetic-mock-output.png` | 508×764 | `9895c86dd714697ba5e342a8aec7f9a792a840be4534d1c52f3243c163fb9a16` | 실제 provider full-person mask3개와 score |
| `images/wardrobe/jeans-original.png` | 310×310 | `5e46e00a8e228126c27c9d0e94b8b3688776b247058b92522569679f8b51d682` | 명시적 tap 좌표별 실제 item mask3개와 score |

공유 API의 정확한 값 모양은 `WebMask = {pixels: Uint8Array | number[]; score: number}`, `SegmenterFixture = {person: WebMask[]; taps: Array<{x:number; y:number; masks:WebMask[]}>}`다. PNG manifest를 전달한다면 각 입력의 위 식별자·크기, mask 파일 경로, 실제 score, tap 정규화 좌표가 필요하다. mask는 입력과 같은 크기의 binary0/255이며 person에는 full-person mask를 넣는다. head-draft를 person으로 오용하거나 점수·모양을 지어내지 않는다.

`web-fixtures.ts`의 실제 asset loader가 반환한 source Asset에 대해 `context.setFixture('Segmenter.asset:'+asset.id, fixture)`로 등록한다. Media/Capture가 새 ID를 발급할 때 공유 `copyAssetFixtures`가 전달한다. provider는 `context.setFixture('Segmenter.provider:9895c86dd714697ba5e342a8aec7f9a792a840be4534d1c52f3243c163fb9a16', fixture)`로 등록하면 공유 `files.ts`의 writeTemp가 bytes를 해시해 새 FileRef에 연결한다. 없는 mask는 model_missing/안전 실패 그대로다.
- M1 owner에게 실제 EdgeTAM 산출물을 요청했다. 현재 web corpus에는 person3 masks가 없어 self→generate→result→snapshot deletion 흐름을 증명하지 못했다. provider의 person 검출이 실제로 실패하면 그 사실을 보존해야 한다.
- wardrobe `jeans-original.png`에 대한 실제/명시적3 tap masks도 필요하다. 임의 성공 mask를 만들지 않았다.
- `audio/tone-silence.wav`는 VAD/배선용 tone fixture이며 사람 영어 음성·실제 transcription 품질 증거가 아니다.
- native emulator/실제 모델/API·head-mask 안전성·결과 provenance/watermark 검증과 인간 prototype 세션 승인은 이 브라우저 작업에서 주장하지 않는다.

## 재실행

공유 person/tap fixture를 확보한 뒤 `web-fixtures.ts`에 **실제 입력**을 등록하고 full/states를 다시 실행한다. local 수동 검증은 `--scenario serve --mode mock`이 출력한 URL을 사용한다. 기존 실제 owner/Store/controller를 바꾸거나 실패를 무시해서는 안 된다. 새 코드 변경 후 app gate도 다시 통과해야 한다.

## 동결 handoff

Coordinator는 실제 native mask가 아직 없으며 M1이 preprocessing/privacy 실패와 private fixture 경로를 조사 중임을 확인했다. 따라서 이 dispatch의 **전체 UI acceptance outcome은 failed**다. 코드·도달 가능한 경로 및 공용 gate 성공을 철회하는 뜻은 아니며, 12개 화면을 13개 성공으로 보고하지 않는다. 이후 실제 입력 연결과 Result/wardrobe 성공 검증은 coordinator가 소유한다.

이 worker가 변경한 source/test/document 경로:

```text
app/src/App.tsx
app/src/screens/Shopping.tsx
app/src/screens/Search.tsx
app/src/screens/Fitting.tsx
app/src/screens/Fitting.test.ts
app/src/screens/Privacy.tsx
app/src/ui/services.ts
app/src/ui/images.ts
app/src/ui/components.tsx
app/src/ui/navigation.ts
app/src/ui/navigation.test.ts
app/src/ui/state.tsx
app/src/ui/Shell.tsx
app/src/ui/web-fixtures.ts
app/src/ui/browser-scenarios.ts
app/src/ui/verify-web.ts
app/src/ui/web-adapter.ts (삭제)
app/src/agent/controller.ts
app/src/agent/controller.test.ts
app/src/walk/index.ts
app/src/walk/mock.ts
app/src/walk/location.ts
app/src/walk/adapters.test.ts
prototype/src/screens/Privacy.tsx
docs/prd/ux/capture.md
docs/prd/ux/search.md
docs/prd/ux/tryon.md
docs/prd/ux/navigation.md
docs/prd/ux/walk.md
app/README.md
verification/results/2026-11-04-s08-ui/CHECKPOINT.md
```

추가 실행 산출물은 위 full/states matrix·PNG·server.log 및 최종 cleanup/location JSON·PNG다. 코드/문구 연결을 같은 UX 문서에 기록했으며 승인되지 않은 product decision·인간 승인·모델 성공을 추가하지 않았다. 모든 owned source/docs/evidence는 coordinator publish를 위해 동결하며, worker는 commit/merge/reset/cherry-pick을 하지 않았다.

## Coordinator 후속: 중복 제목 제거

인계된 실제 Pick screenshot에서 공통 Shell의 H1과 본문 Section의 같은 제목이 연속으로 표시되는 것을 확인했다. Search/Pick/Result/Results/Wardrobe의 중복 본문 제목만 제거하고 Shell 제목과 목적이 다른 하위 제목은 유지했다. 실제 Chromium 클릭으로 Ask/Wardrobe/Results/Pick을 열어 해당 제목이 각각 1개임을 확인했다. [Pick 시각 증거](single-title-pick.webp). Result 성공 화면은 기존 native mask 선행 조건 때문에 여전히 미확인이다.

수정 후 `npm run lint && npm run build && npx astryx doctor --built dist && npx vitest run`은 exit 0, 18 files/227 tests 통과(835ms). 기존 lint 24개·theme-fonts·bundle 크기 경고는 동일하다. 검사용 탭과 서버는 종료했다.

## Coordinator 후속: 실제 Android masks와 Result 경로

- M1의 `d6961bf`(이 브랜치 `c9d3d8f`)는 실제 Android ORT/EdgeTAM 13개 입력 × 3개 person mask와 score를 제공한다. web loader는 source SHA256, mask SHA256, 입력 크기, full-resolution binary0/255와 유한 score를 확인한다. 실제 모델 산출물이지 사람 head GT가 아니다.
- 실제 self 등록이 ready가 된 뒤에도 최초 runner는 초기 empty 상태를 완료로 잘못 판정했다. ready와 import sheet 종료를 기다리도록 고쳤다. 실패를 성공으로 바꾸는 상태 override는 없다.
- 원 합성 provider `9895…`는 실제 세 mask 모두 head geometry를 찾지 못했다. FaceMask 안전 검사를 유지하며 unsafe-provider 입력으로 보존했다. 정상 mock 응답은 별도 `synthetic-full-person-output.png`(기존 calibration-hat `8cae…` bytes 복사)와 그 입력에서 실제 추출한 masks를 쓴다. **Muse 출력이나 실제 try-on 품질 증거가 아니다.**
- 실제 모듈의 미보정 threshold 분기가 얼굴 없는 새 파일을 만들고 Store가 Result를 저장했다. 생성 직후 삭제가 완료된 Outfit으로 돌아가는 버그를 관측해 Try-ons 복귀로 고쳤고, 관련 navigation 회귀 검사를 추가했다.
- 최초 Result 연결 후 `full` 13개 route/42개 관측, `states` 13개 route/77개 관측이 exit 0이었다. 실제 wardrobe 저장까지 확장한 최신 실행은 각각 **49개/88개 관측**, 13개 route로 exit 0이다. states의 offline 전환이 Chromium 위치 오류를 내는 경우 위치 입력을 다시 공급하고 실제 Try again으로 복구한다. 다른 오류는 허용하지 않는다.
- browser tool로도 실제 선택→저장→self 등록→Generate를 클릭했다. try-on 요청 1회, export 0회, 새로고침 후 동일 Result ID 보존, 기록에서 재개방, 삭제 후 Results 빈 목록과 원 Piece 1개 보존을 확인했다. [시각 증거](actual-mask-result.webp), [관측 JSON](actual-mask-result.json).
- Astryx Thumbnail의 label은 행동이 아니라 콘텐츠 이름이다. 중복 "Open Open…"을 없애고 실제 기록 버튼이 `Open look with <label>`로 접근되도록 caller를 고쳤다.
- M1 `e68d9b3`(이 브랜치 `c0f38fb`)의 wardrobe-jeans mask3개를 기록된 `(0.5,0.5)` prompt에 연결했다. 취소 후 재수입, 실제 cutout 저장, 오프라인 naming 대기→재연결 완료, 재시작 후 동일 Piece 보존, wardrobe 상세에 Walk back 없음, 삭제 후 빈 목록을 확인했다. [직접 browser 관측](actual-mask-wardrobe.json). mock naming의 `Blue jacket`은 실제 jeans 인식 품질을 뜻하지 않는다.
- 검증 harness는 picker sheet가 입력을 가로채지 않는지 확인한 뒤 정확한 기록 좌표의 키보드 prompt를 보낸다. native-web의 정확한 fixture 좌표 비교는 느슨하게 바꾸지 않았다. offline naming 검증 중 공통 route helper가 연결을 다시 켜던 문제도 제거했다.
- 최종 `npm run lint && npm run build && npx astryx doctor --built dist && npx vitest run`: exit 0, 18 files/228 tests 통과(729ms). 기존 lint 24개·theme-fonts·bundle 경고 유지. 검사용 탭·서버 종료.
- 남은 범위: native 전체 mock/live E2E, 사람 GT 기반 privacy·품질·provenance·인간 UI 승인. 13개 route 도달을 이 별도 gate들의 합격으로 확대하지 않는다.
