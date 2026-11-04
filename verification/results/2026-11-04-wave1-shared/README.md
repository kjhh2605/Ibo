# 웨이브 1 공유 전송·인증 실행 증거

2026-11-04, M1 Mac mini 16 GB. OMP 통합 작업자. S00 병합 이후 공유 경로 변경이며 제품 슬라이스의 완료 보고를 대신하지 않는다.

## 구현

- `relay/client.ts`: 인증·직렬화 이후 HTTP 직전의 비동기 `beforeSend`, 취소/소유권 실패 전송 차단, 강제 인증 갱신 옵션, 안전한 `Retry-After` 초·HTTP-date 해석. 자동 재시도 없음.
- `relay/auth.ts`와 `SfAuthPlugin.java`: 명시적인 강제 갱신을 Firebase ID/App Check 양쪽에 전달.
- Capacitor Filesystem 8.1.5, UIAutomator 2.3.0 의존성. Android Capacitor 파일은 `cap sync`로 생성.

## 실행한 명령과 관찰

저장소 루트에서 `source scripts/worktree-env.sh`로 호스트 환경을 로드했다. 기기 시나리오 전체는 `scripts/emulator-lock.sh`의 전역 잠금 안에서 실행했다.

| 실행 | 관찰 |
| --- | --- |
| `cd app && npx vitest run` | 4개 파일, 47개 테스트 통과. 인증/직렬화/소유권 실패·취소, HTTP-date/초/불량 Retry-After 포함 |
| `npm run lint && npm run build && npx astryx doctor --built dist` | 모두 exit 0. 기존 generated triple-slash-reference, theme-fonts 경고 유지 |
| `npx cap sync android` | Filesystem 포함 Android 플러그인 4개 동기화 |
| `app/android/gradlew -p app/android assembleDebug assembleDebugAndroidTest testDebugUnitTest --max-workers=2` | BUILD SUCCESSFUL, 417 tasks. 계측 APK 빌드는 계측 테스트 실행과 구분 |
| Vite가 로드한 실제 `createRelayClient` → 로컬 TCP HTTP 서버 | 인증→claim→HTTP 순서, 실제 요청 1회, 429의 `Retry-After: 3` → 3000 ms, 최신 query token 전달. claim 실패·claim 중 취소·인증 실패의 추가 HTTP 0회, 자동 retry 0회 |
| 실제 APK 설치 → 등록 App Check secret 복원 → Playwright-Android WebView에서 `SfAuth.getTokens(false/true)` | PAGE_SIZE 16384. 동일 익명 사용자, 강제 갱신 후 ID 토큰 `iat` 증가. 두 ID 토큰과 두 App Check 토큰 모두 Firebase Admin 서명/프로젝트 검증 통과 |
| 위 인증 실행 직후 메모리 안에서 최근 logcat과 실제 토큰 대조 | ID/App Check/debug secret 일치 0개. 토큰·raw logcat은 증거 파일에 저장하지 않음 |

실행용 HTTP/native smoke 스크립트는 외부 임시 파일로만 사용하고 제거했다. 회귀 검사는 `app/src/relay/client.test.ts`에 남겼다. 인증 토큰은 WebView→검증 프로세스의 메모리/stdin에서만 전달했으며 argv·콘솔·Git에 기록하지 않았다.

## 아직 증명하지 않은 범위

- Filesystem의 관리 경로/소유권 및 S06 Blob 저장소 연동은 후속 공통 파일 I/O와 해당 슬라이스에서 검증한다.
- 앱 화면, 카메라/GPS/저장 수명, 실제 ONNX 추론, 검색·피팅·경로 성공, S11 mock/live full E2E는 이 검증으로 합격 처리하지 않는다.
- 실제 Meta 추론 호출은 수행하지 않았다. 다운로드 feature flag는 계속 OFF다.

## 두 Mac 재개: 파일 I/O 추가 확인 (MacBook, 2026-11-04)

- `app/src/native/files.ts`에 `readBytes`/`writeTemp`를 추가했다. native는 Filesystem의 앱 files/cache URI만 사용하며 candidate-mask는 기존 Store의 private `registerTemp({file,ownerId})`로 등록한다. provider 바이트는 재인코딩하지 않는다. web은 명시 `VITE_SF_RUNTIME=web-mock`에서만 S06 IndexedDB/Blob 저장소를 재사용한다.
- `VITE_SF_RUNTIME=web-mock npm run dev -- --host 127.0.0.1 --port 5191`로 실제 Vite를 실행하고 Chromium에서 해당 모듈을 로드했다. 실제 IndexedDB에 저장한 provider 바이트 왕복 동일성, discard 후 읽기 실패, owner 없는 candidate 거부, 삭제된 owner 거부를 확인했다.
- 실제 2×2 PNG를 저장한 Photo의 mask owner로 등록한 뒤 mask 바이트 동일성, Photo 삭제의 mask 삭제 연쇄, 삭제 후 늦게 호출된 discard의 안전성을 확인했다. 임시 Photo/Trip 및 브라우저 탭은 정리했다.
- 이 추가 확인은 MacBook web 저장소 범위다. native URI 검사·실기기 파일 소유권·M1 기기 검증을 대신하지 않는다.

## 두 Mac 재개: 공유 runtime 연결 (MacBook, 2026-11-04)

- ES2023 baseline을 유지하며 기존 deferred helper를 공통 위치로 옮겼다. Node 기반 검사 타입과 native Store nullable envelope 검사를 복구했다.
- 설명 큐의 전송 전 영구 이미지 오류를 실제 브라우저에서 재현했다: 수정 전 image 1회/HTTP 0회 뒤 약 5초 재시도·attempts 0·pending 유지. 수정 후 같은 경로에서 job 0·외관 failed·HTTP 0회·재시도 0회였다. 인증 실패는 별도로 pending/attempts 0을 유지하고 강제 갱신 후 보내며, 마지막 빈 snapshot과 enqueue의 경합도 회귀 검사한다.
- `MediaWeb.pick` 성공 후 `file_not_owned`가 발생하던 경로를 실제 브라우저에서 재현하고 촬영/가져오기 소유권 승격 뒤 임시 정리를 막았다. 종료된 trip의 외관 촬영에서 현재 위치 저장, active session/trail 불변, kind=item·위치 거부·삭제된 대상 차단을 검사했다.
- 실제 Chromium에서 native/web camera fixture surface를 렌더하고 screenshot으로 확인했다. 16×16 합성 검사용 PNG가 지정 viewport에 보이며 close 후 DOM surface 0개였다. 이는 카메라 하드웨어/실제 ML/제품 화면 합격 증거가 아니다.
- 명시 browser fixture bootstrap은 `installWebMockTransport`로 기존 relay singleton에도 적용되며 Android에서는 금지한다. `VITE_SF_RELAY_MODE=mock` + `VITE_SF_FIXTURE=normal`의 실제 요청 선택과 uninstall 뒤 `unauthenticated`를 확인했다. native mock relay는 실제 Firebase 인증을 유지한다. live 빌드의 fixture 선택은 거부한다.
- provider 파일의 실제 SHA256에 연결된 명시 `Segmenter.provider:<sha256>` fixture를 새 fileRef로 전달한다. 브라우저에서 바이트 동일성과 실제 web Segmenter.prepare/person의 세 mask 소비를 확인했다. 합성 fixture만 사용했으며 모델 추론·사람 GT 승인으로 간주하지 않는다.
- 실행: `npx vitest run src/data/queue.test.ts src/native/photoIndex.test.ts src/relay` → 4개 파일 58개 통과. `npx vitest run src/native/capture.test.ts` → 3개 통과. 이후 `tsc -b`에서 발견한 작성 중 UI bootstrap의 updateShopNote 오호출은 UI owner에게 전달했고 수정 보고를 받았다. 최종 app build/M1 검증은 별도 기록한다.
- 후속 동결 checkpoint: `npm run lint && npm run build && npx astryx doctor --built dist` 모두 exit 0. lint 25개 경고, theme-fonts 및 bundle 크기 경고는 남는다. `npx vitest run`은 218개 통과/1개 실패: 기존 `faceMask.test.ts`가 nonbinary RGB 입력의 오류를 undefined로 기대한다. 이 checkpoint는 M1 cap sync/컴파일 선행본이며 전체 제품 합격이 아니다.
- UI owner가 확인한 남은 web smoke 차단점: `/v1/search/turn` fixture 경로와 queryToken 연결, 구형 browser scenario 교체, 실제 person-mask fixture. 최종 검색/피팅 성공을 주장하지 않는다.
- M1 coordinator 보고: 고정 core commit의 pytest 72개 및 `tests/core/http_smoke.py` 실제 TCP 22개 응답 합격. 모두 no-store, mock-provider 7회, 외부 요청·파일 쓰기 0회, 로그 sentinel 없음. S02/S03 live 모델 검증은 별도다.
- 잘못된 nonbinary RGB undefined 기대와 고정 geometry 좌표 테스트를 제거했다. decoder의 color/intermediate-gray/transparent foreground 거부 경계를 추가했으며 production mask 검증을 완화하지 않았다. observer·mask·client·plugin의 집중 검사 59개와 `tsc -b`가 통과했다.
- 실제 Vite/Chromium/IndexedDB에서 검증 observer를 실행했다. masked derivative 읽기 후 raw/head/export 수치는 0, 의도적으로 원본·headMask 읽기와 비활성 export 호출을 각각 실행한 뒤 1/1/1, 실제 mock transport route 호출은 1이었다. 반환 snapshot을 변경해도 내부 count는 바뀌지 않았다. 이는 named JS 경계 계측 검증이며 Android/실제 privacy 합격이 아니다.
- 서로 다른 Chromium 탭의 같은 DB에서 두 번째 탭 초기화가 첫 탭 provider 임시 파일을 지워 `file_not_owned`가 되는 문제를 재현했다. exclusive lifetime lease 후 두 번째 탭은 busy, 첫 탭의 바이트는 유지됐다. 첫 owner close 뒤 다음 runtime의 GC는 임시 파일만 지우고 실제 2×2 PNG Photo 95 bytes를 보존했다.
- 저장소 회귀 검사 3개는 cutout encode 실패 후 source/mask pin 회수, 동시 저장의 Piece/job 중복 방지와 trip 삭제 뒤 cutout/walkTo 보존, 모든 현재 owner 종료 전 다른 runtime GC 차단을 통과했다. 큐/촬영/색인 21개와 `tsc -b`도 통과했다. 임시 DB·페이지·서버는 정리했다.
- S04 web/native 오류를 문서 코드로 통일했다(camera_permission_denied, preview_not_open, fixture_empty/fixture_invalid, microphone_permission_denied, location_unavailable). 사용되지 않는 bootstrap web stub·stub 전용 검사를 삭제하고 기존 plugin 경계 검사를 실제 CaptureWeb에 연결했다. 해당 경계/촬영 10개와 `tsc -b`가 통과했다.
- M1에서 shell UID 소유 외부 fixture 디렉터리에 app UID가 접근하지 못하는 실제 실패를 보고받아 두 coordinator가 내부 files 경로 cutover를 합의했다. `scripts/push-fixtures.sh`는 고유 shell staging → 읽기 권한 부여 → run-as 내부 복사 → staging 정리로 변경했다. MacBook에서 실제 CLI를 fake adb와 실행해 capture/voice exit 0, push 실패 exit 27와 정리, non-debug 거부 exit 29와 무변경, 잘못된 종류 exit 64와 adb 미호출을 확인했다. 실제 Android 파일 소유권·CameraX/음성 성공은 M1의 별도 검증 대상이다.
