# S10 피팅 오케스트레이션

`index.ts`의 `tryOn`은 화면 밖의 단일 메모리 controller다. `createTryOnController(dependencies?)`로 독립 인스턴스와 명시적 contract fixture를 만들 수 있다. 제품 기본 인스턴스는 실제 Store/FaceMask/Media, 공용 byte I/O, relay client를 사용하며 native 오류에서 mock으로 전환하지 않는다.

## S08 연결 계약

- `getSnapshot()` / `subscribe(listener)`: React `useSyncExternalStore`에 연결한다. snapshot은 참조가 안정적이며 draft와 companion 배열은 동결된다.
- 마네킹(D-R13-02): draft는 `{outfit:{outer?,top?,bottom?}}`, 슬롯마다 shop/wardrobe 조각 1개, 최소 1슬롯. `wornSlots(outfit)`은 슬롯 순서(outer, top, bottom) 목록이다.
- `wear(pieceId)`: 종류(`slotOf`)가 슬롯인 조각을 그 슬롯에 넣고 다른 슬롯은 유지한다. 미분류/`other`는 `category_required`. 자유 문자열 레거시 종류는 `updatePiece`로 정규화한다.
- `setSlot(slot, pieceId)` / `clearSlot(slot)`: 사용자가 고른 슬롯에 넣는다. 종류가 다르면 `updatePiece(category=slot)`로 다시 분류하고, 다른 슬롯에 있던 같은 조각은 빠진다.
- `addTripCandidate(candidate, slot, signal?)`: `saveCandidate(origin=shop,labelMode=describe,category=slot)` 완료 후 그 슬롯에 넣는다. Spark 이름 붙이기는 label만 바꾼다. Trips/Pick 왕복에서 인스턴스를 재생성하지 않는다.
- `registerSelf(asset)`: FaceMask 성공만 등록 상태로 노출. 실패한 교체는 이전 정상 self를 유지하지만 다음 성공까지 생성을 막는다. 마스킹본 미리보기는 없다.
- `generate()`: 검증 → snapshot → masked-only 요청 → provider bytes 저장 → compose → Result 저장. 실패/취소는 `null`, 중복/동시 편집은 `busy` 오류다.
- `cancel()`: 요청 abort와 늦은 응답 무시. `cancelling` 동안 native 연산·임시 파일 정리를 기다리며 다음 생성/편집은 계속 차단한다. 저장 중이나 저장 후 정리 중 취소도 해당 결과만 삭제한 뒤 `cancelled`가 된다. `complete` 또한 정리 종료 후에만 노출한다.
- `canChangePieces(result)` / `restoreResult(result)`: 결과의 옷 중 살아 있고 슬롯 종류인 것을 현재 종류 슬롯에 복원(하나도 없으면 불가). Result 저장 필드 `target*`=첫 슬롯 옷, `companion*`=나머지(저장 형식 호환). 표시/Walk는 스냅샷만 사용한다.
- `exportResult(resultId)`: flag와 S11 exporter provenance 승인이 모두 있어야 Media 호출. 현재 flag OFF, 승인 null이며 다운로드 불가가 정상이다.
- `refresh()`는 자기 사진 상태를 새로 읽는다. `dispose()`는 화면 왕복마다 호출하지 않고 controller 수명 종료에만 호출한다.

상태: `draft`, `phase` (`idle/preparing/sending/compositing/saving/cancelling/complete/failed/cancelled`), `selfState` (`empty/ready/registering/failed`), `selfPhoto`, `result`, 안전한 `error`. 본인 원본·headMask는 로컬 타입에만 있고 `serializeTryOn` 입력은 `maskedFile` 하나다. HTTP는 `{selfPhoto, pieces:[{pieceRef: garment_N, image, label, category: outer|top|bottom}]}`이며 origin·local 파일 경로·좌표·shop 정보는 없다. 릴레이는 옷을 안쪽부터(bottom → top → outer) 정렬하고 빈 슬롯 규칙(D-R13-03)을 프롬프트에 넣는다. label은 프롬프트에 넣지 않는다.

## 보존과 실패 경계

- 제출 직전 조합을 재검증하고 Store.prepareResult의 독립 파일 snapshot을 사용한다. 이후 원본 삭제/이름 변경은 해당 요청/결과를 바꾸지 않는다.
- self의 updatedAt과 파일 참조를 요청 시작 때 값으로 고정한다. FaceMask는 그 버전만 사용하며 없으면 `self_photo_changed`다.
- provider PNG/JPEG 바이트는 재인코딩하지 않는다. 실제 헤더 치수와 wire 치수/크기 한도를 확인하고 cache에 저장한다. compose가 provider·self 원본·headMask·maskedFile 경로를 결과로 재사용하거나 quality 상태가 모순이면 저장하지 않는다. 거부한 self 파일은 임시 파일로 회수하지 않는다.
- 품질 수치가 유한하고 thresholdVersion이 있는 native `composited/passed`만 얼굴 포함 저장. `not_calibrated`, 임계값 미달 등은 native가 안전한 faceless 파일을 제공했을 때만 저장한다. `unsafe_output`은 표시/저장 모두 금지다.
- S06 saveResult는 cache 원본과 독립인 managed 결과 파일을 소유해야 한다. 연산 종료 후 모든 cache 임시 파일을 회수한다. 정리 실패는 안전한 I/O 오류로 노출한다.
- offline queue/자동 retry는 없다. 실패한 직접 cutout 저장은 draft에 추가하지 않으며 취소 후 성공한 저장도 draft에 추가하지 않는다.

## 실제 native 피팅 실행 경계 (2026-11-05)

- self 가져오기/촬영은 반드시 `FaceMask.register`를 거친다. Store에 DTO만 넣으면 native compose가 요구하는 버전별 private sidecar가 없어 `self_photo_changed`로 차단된다. 기존 사용자 self를 데모 편의를 위해 교체하지 않는다.
- 통합 담당의 실제 Android 실행 증거 `verification/results/2026-11-05-android-live/tryon-silhouette.json`: Muse HTTP 200 → 변경 없는 native compose → `faceless:true` Result 저장 → 결과 화면 표시까지 성공했다. 대상 1벌/동반 0벌이며, 전송 경계 계측의 rawSelfReads/headMaskReads/resultExports는 모두 0이다. 이는 human GT/privacy 승인·얼굴 재합성 품질 합격이 아니다.
- 앞선 직사각형 머리 마스크 유지 출력은 실제 EdgeTAM의 중심 연결 영역에서 머리가 제외되어 안전하게 `unsafe_output`으로 차단됐다. 릴레이 프롬프트만 원본 신원 복원이 아닌 가상의 머리 윤곽을 생성하도록 수정했고, native는 동일한 윤곽 검사와 상단 crop으로 최종 표시본에서 이를 제거한다. threshold·geometry·안전 실패 fallback은 변경하지 않았다.
- 기존 실제 Android detection 기록 `verification/results/2026-11-04-m1-resume/face-mask-privacy-after.json`에서 synthetic `calibration-hat`, `heldout-hat`, `long-hair` 등록이 가능했다. `verification/fixtures/images/self/positive/calibration-hat.png`는 실제 모델 경로를 재현할 후보이며, 새 기기/새 provider 결과의 통과를 보장하지 않는다.
- native `HeadGeometry.DEFAULT`의 composition thresholds는 계속 null이다. 실제 Muse가 반환한 이미지의 중앙 person/head/neck 감지가 성공하면 안전하게 머리 아래를 자른 `faceless:true` 결과만 저장할 수 있다. 감지가 불충분하면 `unsafe_output`이며 provider 원본을 대신 표시/저장하지 않는다.
- 사람 head GT·threshold 최종 승인은 여전히 없다. 위 registration 가능 기록과 faceless 실행은 privacy/품질 승인이나 얼굴 재합성 합격이 아니다. 다운로드는 계속 OFF다.
- category가 `unknown`이고 QueueJob이 없다는 사실은 Spark 실패 증거가 아니다. 검색 concept/사용자 이름을 유지하고 선택적으로 Spark naming을 요청할 수 있게 안내한다.
- 이번 변경의 회귀 소스는 native compose 대기 취소, 저장 후 정리 중 취소, rollback I/O 실패 후 lock 해제, uncalibrated faceless 저장 및 self 파일 재사용 거부를 포함한다. 이 변경 단계에서는 검사를 실행하지 않았다. 통합 담당 실행 명령: `cd app && npx vitest run src/tryon src/screens/Fitting.test.ts`.


## 이전 slice 실행 증거 (아래 S00 상태는 당시 기록)

검증 파일: `evidence/native-boundary.json`, `evidence/webview-contract.json`, `evidence/acceptance.json`.

- `npx vitest run src/tryon`: 최초 31개 중 3개 fixture Buffer/Uint8Array 비교 실패를 수정한 뒤 **31 passed**. fixture 파일은 이후 브라우저 타입 환경에서도 컴파일되도록 동일한 합성 PNG base64로 고정했다.
- 마지막 그룹별 명령 `npx vitest run src/tryon -t <group>`: composition **10 passed**, privacy **11 passed**, snapshot **4 passed**, quality **6 passed**, download **2 passed**, 모두 종료 0. composition 필터는 quality의 composition 이름 2개도 선택하므로 그룹 합계가 전체 31개와 같지 않다.
- `source scripts/worktree-env.sh && bash scripts/emulator-lock.sh node /tmp/s10-runtime-smoke.cjs`: 실제 기존 Android WebView에서 controller → native Store.get/getSelfPhoto 실행. 현재 S00 plugin의 `unimplemented`를 관찰했고 업로드 0, 빈 조합 차단, 다운로드 차단을 확인했다.
- 같은 lock 안의 `/tmp/s10-fixture-runtime.cjs`: 실제 Android WebView에서 **명시적 합성 Store/FaceMask/provider fixture**로 준비→전송→합성→저장 전체 실행. 이미지 7장, fixture 머리 픽셀 0, 원본과 전송 바이트 다름, 요청 중 이름 변경에도 snapshot 유지, faceless 결과, provider SHA-256 동일, 결과/원본 파일 분리, 임시 파일 회수 확인.
- 첫 WebView dynamic import는 Capacitor 로컬 origin route에서 실패했다. Vite가 변환한 실제 모듈을 data-module로 로드하는 일회성 runner로 변경해 위 두 smoke를 완료했다. 앱 배포 코드에는 이 runner나 우회 경로가 없다.

실제 native 성공 파이프라인/SQLite/Meta Muse Image/머리 제거 품질/재합성 임계값은 이 fixture 통과로 주장하지 않는다. S05/S06 merge와 S11 `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario tryon`이 통합 선행 조건이다. provenance 승인은 미확인이며 다운로드는 계속 OFF다.
