# M1 native 재개 체크포인트 — 2026-11-04

**S04/S05/S06 native 구현·부분 통합 증거이며 전체 제품/S11 합격 기록이 아니다. main/PR 병합은 하지 않는다.**

## 소유권과 실행 환경

- 브랜치: `kjhh2605/m1-native-resume`. MacBook의 명시 승인 SHA만 가져온다. 공유 TS/UI/relay 변경은 MacBook 소유다.
- M1 Mac mini, `Medium_Phone` API 37 ARM64, 실제 `PAGE_SIZE=16384`, ORT 1.22.0. 기기 조작은 전역 `scripts/emulator-lock.sh` 안에서 직렬 실행했다.
- 아래 최신 native/UI 증거의 설치 APK SHA: `943f7f3e5d3ce6ce0eb102145612ac09806c57ce9468252d651a7811bf81795a`. 이 APK의 web 부분은 MacBook `07d4f76`까지다. 이후 가져온 `a3eb960`의 web 변경을 아직 설치한 것으로 보고하지 않는다.
- 모델 원본·export·기준 벡터/마스크는 변경하지 않았다. 모델 3개 SHA, ZIP 16 KB 정렬, ELF 10개 LOAD 정렬은 `apk-layout.json`에 있다. x86_64는 패키징 검사만 했고 실행 검증은 ARM64다.

## 구현 변경

- **S04:** 위치/알림 권한과 FGS 복원·종료 경계, CameraX 비동기 lifecycle, private fixture 순환·독립 복사·source 전환, Media 임시 파일 및 Photo Picker 흐름, Voice fixture/VAD·권한·종료 경계를 정리했다. 실제 시스템 picker의 선택 후 Done 버튼을 누락했던 테스트만 수정했으며 제품 callback 우회나 timeout 확대는 없다.
- **공유 승인 변경:** CameraX 4개 의존성을 1.5.1→1.5.2로 올려 API 37 동적 범위 bind NPE를 해결했다. `MainActivity.onNewIntent`는 현재 Intent를 먼저 갱신한다. ABI는 `arm64-v8a`, `x86_64`만 패키징한다. Manifest/공유 DTO를 임의로 바꾸지 않았다.
- **S06:** canonical file URI와 파일 소유권, 임시 자산 이관·중복 discard, 삭제/garbage 수거 경계, schema v2 마이그레이션과 충돌 rollback을 구현했다. 결과/본인 사진/후보의 독립 파일과 원자 repository 연산은 실제 SQLite 검사로 확인했다.
- **S05:** production 이미지 decode의 ICC 채널 보존으로 원본 JPEG 연구 호환성을 회복했다. Android 실제 decode를 우회하던 검증 helper도 수정했다. 모델/추론·취소/삭제·자산 생명주기와 fail-closed masking을 연결했다. GT 부재는 skip이 아닌 hard failure다. 실제 모델 출력은 사람이 승인한 head GT로 취급하지 않는다.

## 실제 실행 증거

| 범위 | 관측 결과 | 증거 |
|---|---|---|
| native 단위/빌드 | 단위 12개 통과, debug 및 instrumentation APK 빌드 | `native-build.json` — 이전 빌드 관측이며 최신 SHA와 혼동하지 않음 |
| ShoppingSession | 실제 권한·알림·최근 목록/복원·종료 관련 6개 통과 | `native-contracts.json`의 해당 class, APK `ddb09e05…`; 같은 파일의 다른 class 실패는 보존 |
| Capture / Media / Voice | 각각 6 / 4 / 7개 통과 | `native-fixed-contracts.json`, `media-after.json`; Voice는 합성 amplitude VAD 검사이며 live 전사 성공이 아님 |
| 실제 Store | 14개 통과, 별도 프로세스 save 및 restart-delete 각각 통과 | `native-fixed-contracts.json` |
| 실제 CameraX UI | preview 가시성, 셔터 저장, End shopping 확인, force-stop/재실행, All trips 확인 | `native-capture-ui-after.json`, `native-capture-preview-converged.png`, `native-home-after-restart.png` |
| 같은 Activity의 source 전환 | 동일 PID/기존 Activity에 Intent 5회 전달. A0→A1→B0→A0→실제 CameraX→A0. fixture 원본 4개 유지 | `native-intent-source.json`, `native-intent-camera.png` |
| 독립 파일 영속성 | 자체 fixture 폴더 삭제 후 실제 프로세스 재시작. 사진 6개와 Trip 유지, 실제 파일을 다시 decode해 픽셀·크기 확인 | `native-intent-source.json`; 단색 이미지는 source 판별용 합성 입력이며 모델 품질 증거가 아님 |
| native 인증 | 실제 `SfAuth.getTokens(forceRefresh=true)` 후 Firebase Admin이 ID/App Check 토큰을 각각 검증. 익명/프로젝트/앱 일치 | `native-auth-current.json`; 값·원시 로그 미보존, PID 로그의 토큰/debug secret 일치 0 |
| PE 이미지 연구 호환성 | 원본 JPEG 22/22, canonical PNG 22/22가 기존 수치 허용 오차 통과 | `photo-index-original-jpeg-after.json`, `photo-index-research-after.json` |
| EdgeTAM 연구 호환성 | rack/shop 마스크 6개 모두 IoU=1, mismatchPixels=0 | `segmenter-research-after.json` |
| 실제 relay PE | 검사 6개, skip 0. CPU 원본 22장/7문구와 실제 Android 벡터의 hit@3 모두 7/7 | `relay-real-pe-after.json`, `relay-real-pe-after.xml` |
| 실제 모델 출력 | 14입력×3마스크, PNG/binary 84파일의 SHA·크기 확인 | `actual-mask-provenance.json`, `person-mask-export-after.json`; head GT 아님 |
| 추론 측정 | 새 instrumentation 프로세스의 cold load 및 warmup 후 실제 encoder/decoder/PE 추론 | `ml-timing-after.json`; 전체 UI latency 합격을 대신하지 않음 |

Camera preview의 최초 5초 드라이버 assertion은 실패했다. 실제 native open은 5802.3 ms 뒤 resolve했고, 이후 정상 preview와 셔터가 관측되었다. 이를 deadlock/불투명 WebView로 오인해 제품 코드를 우회하지 않았다. `native-capture-ui.json`, `native-capture-trace-after.json`에 실패와 관측을 구분해 보존한다. **5.8초를 latency 기준 통과로 보고하지 않는다.**

## 남은 필수 gate

- 최신 공유 web 변경을 포함한 빌드·설치·실제 통합 검증, release의 fixture 구현/extra reader/자료 제외 검증은 별도 실행이 필요하다.
- 1시간 background FGS·최종 latency/memory 평가와 최신 APK의 알림/권한 회귀 검증이 남아 있다. force-stop을 최근 목록 swipe 또는 1시간 지속성으로 대체하지 않는다.
- self 양성 6건의 사람 승인 face+hair GT가 없다. 실제 long-hair/boundary 등의 detection 거부도 남아 있다. `face-mask-privacy-after.json`은 실패/차단 기록이다. 보호 조건을 약화하거나 출력 마스크로 GT를 대신 승인하지 않는다.
- 합성 composition 경계 검사와 실제 self/provider 품질은 다르다. calibration 16회 실호출·독립 heldout·provenance/워터마크 검증은 미완료이며 result download는 계속 OFF다.
- 승인된 재배포 가능 영어 음성, 자산/GT 승인과 S11 mock full E2E·live full E2E·최종 지도/경로·검색/음성/피팅 통합·3분 영상은 미완료다. 준비된 키나 host 성공을 제품 합격으로 대체하지 않는다.
- fixture/debug UI 관측용으로 만든 Trip/Photo ID는 각 report의 `retainedSmokeRecords`에 있다. 기존 사용자/다른 검사 데이터를 일괄 삭제하지 않는다.

이전 `*-before.json`, `native-contracts*.json`, `picker-diagnostic.json`, `relay-real-pe.xml` 등의 실패는 수정 전 증거로 보존한다. 전체 batch의 실패를 일부 class 통과로 덮어쓰지 않는다.
