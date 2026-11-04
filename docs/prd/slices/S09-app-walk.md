# S09 app-walk
상태: 확정(R10까지) · 웨이브 1 · 선행: S00 merge 완료. route·Store·위치는 mock으로 시작한다.

## 목표
Item 또는 Result에서 대상 옷을 촬영한 위치까지 앱 안 도보 안내를 제공한다. 경로선·턴바이턴, 이탈 재탐색, 끝 구간 방향·거리, 외관을 보고 확인하는 수동 도착을 구현한다.

## 읽을 문서
이 목록만 읽는다.
- [결정 로그](../decisions.md): D-R0-03, R5, D-R6-03~04, D-R7-03, D-R9-03~04.
- [기기 모듈](../contracts/device-modules.md): §1, §10 Location/Route/Map/Walk 전부.
- [릴레이 API](../contracts/relay-api.md): §1~5, §6.7 route, §7~8.
- [데이터 모델](../contracts/data-model.md): Piece.walkTo, Result/ResultPieceSnapshot, 삭제 연쇄.
- [길 안내 UX](../ux/walk.md), [화면 구조](../ux/navigation.md): Item/Result 진입, Trip 통합.
- [제품 범위](../product/scope.md), [데이터 경계](../product/privacy.md): 위치·지도·로그·오프라인.
- [fixture 명세](../verification/fixtures.md): GPX·route fixture 규칙.

## 소유 경로
- 수정: `app/src/walk/**` 및 그 안의 단위 테스트·mock Location/Route/Map.
- 금지: S08 화면, 공용 native Geolocation/Manifest/등록 설정, relay/client, S06 저장소, OpenAPI/생성 타입, 공용 scripts·fixture·계약. 의존성/공유 설정은 S00에, 공용 fixture는 S11에 요청한다.

## 구현 항목
1. 계약의 Location/Route/Map/Walk API를 구현한다. `Walk.start({source:'item',pieceId})`는 shop Piece.walkTo, `{source:'result',resultId}`는 targetSnapshot.walkTo만 사용한다. 해당 세션 목적지는 불변이다. target 삭제 뒤 Result 진입도 성공하고 Trip/Shop/Pick 직접 진입은 없다. [device §10](../contracts/device-modules.md#10-js-location--route--map--walk--s09), [data-model Result](../contracts/data-model.md#result); D-R5-01~03, D-R9-03~04.
2. MapLibre GL JS+OpenFreeMap liberty, attribution, 현재 fix·목적지·GeoJSON 경로를 표시한다. 지도 라벨 name:en 우선, 핀 drag/API 없음. mock Map은 동일 API의 SVG다. UI 지도 컨테이너는 S08에 제공한다. [device 지도 계약](../contracts/device-modules.md#지도위치경로-계약); D-R5-02, D-R7-03.
3. Capacitor Geolocation은 Walk foreground에서만 watch하고 이탈/pause 시 해제한다. 별도 trail·백그라운드 안내를 만들지 않는다. route 요청은 origin/destination만, 좌표는 `[lng,lat]` geometry와 `{lat,lng}` 요청을 구별한다. 최신 generation 하나만 적용하고 stale 응답은 무시한다. [relay §6.7](../contracts/relay-api.md#67-post-v1route), [device §10](../contracts/device-modules.md#10-js-location--route--map--walk--s09); D-R0-03, D-R5-04, D-R6-04.
4. route 진행 투영·step 전환 15m/진행 경계·5m hysteresis, 정확도≤30m의 이탈>30m가 10초/3fix 지속하면 재탐색, ≤20m 복귀 reset, 10초 cooldown을 구현한다. 미확인 성능 SLA로 바꾸지 않고 계약의 [추론] 기본값으로 테스트한다. [device 이탈 표](../contracts/device-modules.md#이탈끝-구간도착-추론-기본값); D-R5-04.
5. 목적지≤50m 또는 route_unavailable/끝 미연결 구간에서 direction으로 전환한다. 진북 bearing·haversine 거리, >65m 복귀 hysteresis를 사용한다. ≤20m/정확도≤30m가 5초/2fix이면 nearby, **사용자 confirmArrival만 arrived**다. 외관 없으면 주변 확인을 허용하고 가짜 주소를 만들지 않는다. [device 이탈 표](../contracts/device-modules.md#이탈끝-구간도착-추론-기본값), [walk F-15](../ux/walk.md#f-15-매장까지-도보-길-안내); D-R0-03, D-R5-04.
6. offline·권한 거부·위치 없음·타일 실패·경로 없음은 구별한다. offline은 retry와 호출/큐 0회, NoRoute는 방향 모드, 목적지 없음은 시작 실패다. 거리와 관계없이 외부 지도 앱으로 넘기지 않는다. 로그에는 좌표·경로·OSRM URL이 없다. [privacy](../product/privacy.md#불변식테스트-대상), [relay §3](../contracts/relay-api.md#3-무저장로그모델-준비); D-R5-05, D-R6-03~04.

## mock 경계와 의존
route 응답과 위치 GPX는 S11 fixture를 사용하고, 단위 단계에는 자기 테스트에 동일 규칙의 최소 합성 fixture를 둔다. mock도 실제 거리·시각·상태 전환 코드를 실행하며 버튼으로 상태를 강제 성공시키지 않는다. S03 route·S06 Store·S08 화면 연결과 실제 MapLibre/AVD GPS는 S11 통합에서 확인한다. AVD GPS는 S00 `gpx-replay.sh`의 `adb emu geo fix <lng> <lat>`로 넣는다(D-R10-01).

## 합격 기준
명령은 구현 후 실행 요구다. 테스트 그룹은 실제 테스트가 선택되게 `gpx`, `privacy`를 포함한다.

| 명령(저장소 루트) | 합격 조건 |
| --- | --- |
| `(cd app && npx vitest run src/walk)` | 모든 API·좌표 순서·목적지 고정·request generation·화면 종료 구독 해제 테스트 통과 |
| `(cd app && npx vitest run src/walk -t 'gpx')` | 정상 step 순서, 9초/10초 이탈 경계, 3fix·정확도 조건, 복귀 reset·cooldown·중복 요청 방지, 50/65m 전환, 20m/5초 nearby와 수동 도착 검증 |
| `(cd app && npx vitest run src/walk -t 'privacy')` | Shop.spot/동반 위치 사용 0회, Result target 삭제 후 snapshot 안내, trail 생성 0, Meta 좌표 전송 0, 로그 좌표 0, offline 요청/큐 0, 외부앱 intent 0 |
| `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario walk` | 통합 단계 S11 명령. GPX→adb→Geolocation→실제 지도/턴/이탈/끝 구간/수동 도착 연결과 attribution·고정 핀 확인. S09 단위 완료를 이 미래 스크립트에 종속시키지 않음 |

GPX trace는 `verification/fixtures/gpx/walk*.gpx`, 대응 기대 상태/경로는 fixture 명세를 따른다. 기준 기기(M1 Mac mini 16 GB)의 AVD `Medium_Phone` 한 대를 lock으로 독점한다. 실제 MapLibre 검증은 `-gpu host` 에뮬레이터에서 하고, WebView WebGL을 얻지 못하면 지도 렌더링 검증을 미확인으로 보고한다(D-R10-03).

## 완료 보고 형식
- 바꾼 파일.
- 실행한 명령과 결과: 각 상태 전환 경계·목적지 검증을 포함.
- 미확인·위험: 실제 타일·OSRM·GPS·현장 도착은 mock 증거와 구분.
- 계약 변경 요청: 공유 Geolocation 설정/타입 등, 없으면 "없음".

## 미확인·위험
OSRM 도보 endpoint와 공용 서비스 가용성, 실내/인접 점포 GPS 정확도는 미확인이다. GPX 합격은 현장 가게 식별 성공을 보증하지 않는다. 방위 센서·음성·백그라운드 안내를 추가하지 않는다.
