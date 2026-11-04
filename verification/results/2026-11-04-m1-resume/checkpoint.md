# M1 native 재개 체크포인트 — 2026-11-04

**S04/S05/S06 native 구현·부분 통합 증거이며 전체 제품/S11 합격 기록이 아니다. main/PR 병합은 하지 않는다. 사용자 최신 지시에 따라 사람 입력을 기다리는 검증과 그 의존 gate는 이번 범위에서 제외했으며, 합격으로 바꾸지 않는다.**

## 소유권과 실행 환경

- 브랜치: `kjhh2605/m1-native-resume`. MacBook의 명시 승인 SHA만 가져온다. 공유 TS/UI/relay 변경은 MacBook 소유다.
- M1 Mac mini, `Medium_Phone` API 37 ARM64, 실제 `PAGE_SIZE=16384`, ORT 1.22.0. 기기 조작은 전역 `scripts/emulator-lock.sh` 안에서 직렬 실행했다.
- 최신 설치 debug APK SHA: `c18813965a9d3078c753e89df8511d9a588f2520daaa7e564bfbb3177d699cef`. MacBook `035f2fd`의 camera viewport 변경을 포함한다. 이전 APK에 묶인 인증/모델/source 전환 증거는 해당 report의 SHA를 그대로 따른다.
- 모델 원본·export·기준 벡터/마스크는 변경하지 않았다. 최신 debug/release의 모델 SHA, ZIP 16 KB 정렬, ELF LOAD 정렬은 `apk-layout-latest.json`에 있다. x86_64는 패키징 검사만 했고 실행 검증은 ARM64다.

## 구현 변경

- **S04:** 위치/알림 권한과 FGS 복원·종료 경계, CameraX 비동기 lifecycle, private fixture 순환·독립 복사·source 전환, Media 임시 파일 및 Photo Picker 흐름, Voice fixture/VAD·권한·종료 경계를 정리했다. 유한한 음수 preview x/y는 스크롤된 viewport의 정상 원점으로 허용하고 음수 width/height는 계속 거부한다. 알림으로 Intent가 바뀐 Activity는 실제 lifecycle registry로 관측한다. 제품 callback 우회나 timeout 확대는 없다.
- **공유 승인 변경:** CameraX 4개 의존성을 1.5.1→1.5.2로 올려 API 37 동적 범위 bind NPE를 해결했다. `MainActivity.onNewIntent`는 현재 Intent를 먼저 갱신한다. ABI는 `arm64-v8a`, `x86_64`만 패키징한다. Manifest/공유 DTO를 임의로 바꾸지 않았다.
- **S06:** canonical file URI와 파일 소유권, 임시 자산 이관·중복 discard, 삭제/garbage 수거 경계, schema v2 마이그레이션과 충돌 rollback을 구현했다. 결과/본인 사진/후보의 독립 파일과 원자 repository 연산은 실제 SQLite 검사로 확인했다.
- **S05:** production 이미지 decode의 ICC 채널 보존으로 원본 JPEG 연구 호환성을 회복했다. Android 실제 decode를 우회하던 검증 helper도 수정했다. 모델/추론·취소/삭제·자산 생명주기와 fail-closed masking을 연결했다. GT 부재는 skip이 아닌 hard failure다. 실제 모델 출력은 사람이 승인한 head GT로 취급하지 않는다.

## 실제 실행 증거

| 범위 | 관측 결과 | 증거 |
|---|---|---|
| 최신 빌드/단위 | lint/build/doctor/cap sync, debug·instrumentation·release 빌드 통과. Debug/Release 단위 각각 12개, 실패/skip 0 | `viewport-build.json`, `latest-unit-results.json` |
| ShoppingSession | 실제 SystemUI 알림 본문/Take photo/New shop, 실제 recreation에서 중복 New shop 방지 등 6개 통과 | `viewport-native-contracts.json`의 해당 class |
| Capture / Media / Voice | 각각 6 / 4 / 7개 통과. 음수 preview 원점·음수 크기 거부와 실제 CameraX 촬영 포함 | `viewport-capture-contracts.json`, `viewport-native-contracts.json`; Voice는 합성 amplitude VAD이며 live 전사 성공이 아님 |
| 실제 Store | 14개 통과, 별도 프로세스 save 및 restart-delete 각각 통과 | `viewport-native-contracts.json` |
| 최신 실제 CameraX UI | 411×866에서 6개 camera 상태의 셔터가 스크롤 없이 완전히 보임. 실 preview, 배너 위치, thumbnail/New shop, item·shopping storefront·offline historical storefront 3장 저장, 프로세스 재시작 후 유지 | `viewport-ui/viewport-ui.json`, `viewport-ui/*.png`; standalone capture는 새 Trip/trail 없이 기존 Shop 링크 갱신, offline queue attempt 0 |
| 같은 Activity의 source 전환 | 동일 PID/기존 Activity에 Intent 5회 전달. A0→A1→B0→A0→실제 CameraX→A0. fixture 원본 4개 유지 | `native-intent-source.json`, `native-intent-camera.png` |
| 독립 파일 영속성 | 자체 fixture 폴더 삭제 후 실제 프로세스 재시작. 사진 6개와 Trip 유지, 실제 파일을 다시 decode해 픽셀·크기 확인 | `native-intent-source.json`; 단색 이미지는 source 판별용 합성 입력이며 모델 품질 증거가 아님 |
| native 인증 | 실제 `SfAuth.getTokens(forceRefresh=true)` 후 Firebase Admin이 ID/App Check 토큰을 각각 검증. 익명/프로젝트/앱 일치 | `native-auth-current.json`; 값·원시 로그 미보존, PID 로그의 토큰/debug secret 일치 0 |
| PE 이미지 연구 호환성 | 원본 JPEG 22/22, canonical PNG 22/22가 기존 수치 허용 오차 통과 | `photo-index-original-jpeg-after.json`, `photo-index-research-after.json` |
| EdgeTAM 연구 호환성 | rack/shop 마스크 6개 모두 IoU=1, mismatchPixels=0 | `segmenter-research-after.json` |
| 실제 relay PE | 검사 6개, skip 0. CPU 원본 22장/7문구와 실제 Android 벡터의 hit@3 모두 7/7 | `relay-real-pe-after.json`, `relay-real-pe-after.xml` |
| 실제 모델 출력 | 14입력×3마스크, PNG/binary 84파일의 SHA·크기 확인 | `actual-mask-provenance.json`, `person-mask-export-after.json`; head GT 아님 |
| 추론 측정 | 새 instrumentation 프로세스의 cold load 및 warmup 후 실제 encoder/decoder/PE 추론 | `ml-timing-after.json`; 전체 UI latency 합격을 대신하지 않음 |
| 실제 권한 변형 | 최신 설치 APK에서 위치 거부/Settings, 알림 거부 상태의 실제 FGS와 notice, recording 중 위치 revoke 및 재진입 정리, camera/microphone 거부 등 5개 통과. 기존 레코드와 원래 권한 grant/user flag·Capacitor 권한 이력 복원 | `permissions-final/permissions.json`, `permissions-final/*.png`; 직전 APK 기록은 `permissions/`에 보존 |
| release fixture 제외 | release DEX의 extra reader/fixture class 6개 marker 모두 0, fixture asset 경로 0. Debug positive control에서는 6개 모두 존재 | `release-exclusion.json`; release APK 설치·공개 배포를 의미하지 않음 |
| 중단한 background FGS | 사용자 요청으로 1시간 테스트 중단. 마지막 관측 595,965 ms, 17개 sample이며 **1시간 합격 아님**. 테스트 소유 세션은 정상 stop으로 ended/idle 처리, Trail 71→0, FGS 종료 확인 | `foreground-hour-final/fgs-progress.json`, `foreground-hour-final/foreground-hour.json`; 실제 설치 APK hash도 c1881396… 일치 |

Camera preview의 이전 최초 5초 드라이버 assertion은 실패했다. 실제 native open은 5802.3 ms 뒤 resolve했고, 이후 정상 preview와 셔터가 관측되었다. `native-capture-ui.json`, `native-capture-trace-after.json`에 실패와 관측을 보존한다. **5.8초를 latency 기준 통과로 보고하지 않는다.** 최신 UI smoke의 shopping 시작→preview 준비 측정에는 별도 synthetic GPS 갱신 대기가 포함되어 camera bind latency가 아니다.

최신 native aggregate의 Capture 2건 실패는 외부 실행기가 Capture 명세의 고정 GPS 대신 다른 GPX를 주입한 결과다. 기대 좌표/제품 코드를 바꾸지 않고 명세의 GPS로 실패 class만 재실행해 6개 모두 통과했다. 원 aggregate의 실패는 `viewport-native-contracts.json`에 남겼다. 최신 APK에서 통과한 Shopping 6 + Capture 6 + Media 4 + Voice 7 + Store 14 + process 1+1의 증거를 별도로 읽어야 한다.

## 사용자 지시로 중단·제외한 범위

- 사용자 최신 지시 **“1시간 백그라운드 테스트 중단하고 나머지 작업 진행해. 내 개입 필요한거 빼고 전부 진행후 마무리”**에 따라 실행을 중단했다. 1시간 검증 상태는 `cancelled_by_user`, `passed:false`, `completedFullHour:false`다. 이후 정상 native stop으로 이 테스트의 세션·raw trail·FGS를 정리했다. 재실행하거나 짧은 관측을 1시간 합격으로 대체하지 않는다.
- 초기 두 실행의 cm 수준 GPS 동일성 실패, 실제 timestamp/trail 갱신 진단, 일치하지 않은 IEEE float32 가설은 각각 `foreground-hour/`, `foreground-hour-fed/`, `gps-freshness-diagnostic.json`, `gps-quantization.json`에 보존한다. 승인 helper `c6eb36c`(M1 `aee8b8d`)는 metric 1 m target identity를 사용하되 strict timestamp·persisted trail·전체 시간 조건을 유지한다.
- **사용자 범위 제외, PASS 아님:** 사람 승인 자산/face+hair GT·독립 heldout·재배포 동의 영어 음성과 이에 의존하는 full mock/live E2E, masking/피팅 품질·calibration·provenance/워터마크·live demo gate. self 양성 6건 GT 부재로 실패한 `face-mask-privacy-after.json`은 그대로 보존한다. 보호 조건·full CLI gate를 약화하지 않고 모델 출력을 GT로 승인하지 않는다.
- 기존 human-dependent 최종 latency/memory·검색/음성/피팅/지도 full integration과 3분 영상도 이 체크포인트의 합격 항목이 아니다. 사람이 필요 없는 native/권한/설치 UI/패키징 검증과 코드·증거 게시를 완료했다. result download는 계속 OFF다.
- fixture/debug UI 관측용으로 만든 Trip/Photo ID는 각 report의 `retainedSmokeRecords`에 있다. 기존 사용자/다른 검사 데이터를 일괄 삭제하지 않는다.
- 완료 후 소유 앱을 종료하고 `Medium_Phone` emulator shutdown 및 adb disconnect를 확인했다(`runtime-cleanup.json`). 이 세션의 기기 작업과 무거운 실행은 남아 있지 않다. main/PR 병합 없이 WIP 브랜치에만 게시한다.

이전 `*-before.json`, `native-contracts*.json`, `picker-diagnostic.json`, `relay-real-pe.xml` 등의 실패는 수정 전 증거로 보존한다. 전체 batch의 실패를 일부 class 통과로 덮어쓰지 않는다.
