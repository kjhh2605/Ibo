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
