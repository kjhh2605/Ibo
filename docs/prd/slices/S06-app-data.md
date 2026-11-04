# S06 app-data
상태: 확정(R9까지) · 웨이브 1 · 선행: S00 merge 완료. native Store 등록·공유 DTO·테스트 설정이 준비되어야 한다.

## 목표
쇼핑 기록·옷·본인 사진·결과를 기기에 안전하게 보관한다. 삭제 연쇄, 중복 저장 방지, 결과 스냅샷과 오프라인 이름/외관 대기열을 하나의 Store 계약으로 제공한다.

## 읽을 문서
이 목록만 읽는다. 다른 슬라이스의 구현을 추측해 복제하지 않는다.
- [결정 로그](../decisions.md): R0~R9, 특히 D-R3-11, D-R6-03, D-R9-02~03.
- [데이터 모델](../contracts/data-model.md): 전부, 특히 §2 Result, §4~7.
- [기기 모듈](../contracts/device-modules.md): §1, §9 Store, §11 통합 이벤트; §2~6의 내부 repository 호출 경계.
- [릴레이 API](../contracts/relay-api.md): §1~5, §6.4~6.5, §7~8. 생성된 wire 타입을 사용한다.
- [제품 범위](../product/scope.md): 전제·오프라인 / [데이터 경계](../product/privacy.md): 보관·삭제·불변식.
- [옷장·피팅 UX](../ux/tryon.md): F-09~14의 저장·삭제 상태. 배치 구현은 S08이다.

## 소유 경로
- 수정: `app/src/data/**`, `app/src/native/store.ts` 실제 구현, `app/android/.../plugins/store/`의 네이티브 SQLite Store. `...`는 S00이 만든 실제 Java package/source-set 경로이며 새 package 관례를 만들지 않는다.
- 대기열 저장·재시도 정책·foreground 단일 worker·`describe_storefront`/`label_piece` relay handler는 전부 `app/src/data/**`에 둔다. 테스트는 이 경로와 Store plugin의 대응 test source-set package에 둔다.
- 금지: 다른 plugin, 화면, 에이전트/피팅/지도 모듈, Manifest/MainActivity, package/Gradle 공통 설정, relay client, OpenAPI/생성 타입 및 PRD 계약. 필요한 공유 API 변경은 S00/통합 담당에게 요청한다.

## 구현 항목
1. Java SQLiteOpenHelper의 단일 writer·FK·unique·nullable·범위 제약, 파일 소유권과 transaction을 구현한다. `Store.get/list/getSelfPhoto`와 commit 후 `changed` 이벤트를 제공하고 generic raw insert를 열지 않는다. ShoppingSession/Capture/PhotoIndex/FaceMask는 계약의 내부 repository만 사용한다. [data-model §1~2·§7](../contracts/data-model.md#1-공통-타입과-저장-원칙), [device §9](../contracts/device-modules.md#9-store--s06); D-R2-05, D-R7-03~04.
2. 종료 시 trail만 삭제, recording trip 삭제 시 먼저 종료, trip/photo/piece/result별 DB·파일·캐시·큐 연쇄를 정확히 구현한다. 늦은 색인/HTTP 응답은 삭제 데이터를 부활시키지 않는다. 갤러리에 이미 내보낸 파일은 삭제하지 않는다. [data-model §4](../contracts/data-model.md#4-생명주기삭제-연쇄); D-R0-03, D-R3-11.
3. 후보 ID를 정방향 이진 mask 기준으로 안정 생성하고 `saveCandidate`를 insert-if-absent로 만든다. 같은 후보 동시 저장도 Piece·cutout·job 하나만 생성한다. `labelMode:'concept'|'describe'`를 구분한다. concept 있는 shop은 개념 이름, wardrobe/직접 자른 shop은 "Picked item"/"unknown"과 label job을 원자 저장한다. 사용자 수정은 대기 작업을 취소한다. [data-model §5](../contracts/data-model.md#5-저장피팅-불변식), [device §9](../contracts/device-modules.md#9-store--s06); D-R4-06, D-R4-08, D-R9-02.
4. `prepareResult`에서 대상/동반·가게 표시 정보를 일관된 스냅샷으로 고정하고 cutout/외관을 독립 복사한다. `saveResult({draftId,...})`는 성공 파일과 스냅샷을 원자 저장, `discardResultDraft`는 실패·취소 초안을 회수한다. 원본 Piece 삭제/이름 변경/trip 삭제 후에도 결과 파일·이름·목적지가 유지된다. Result 삭제는 자기 복사본만 지운다. [data-model Result](../contracts/data-model.md#result), [device §9](../contracts/device-modules.md#9-store--s06); D-R9-03.
5. SelfPhoto 성공 교체만 singleton에 반영한다. 실패 시 이전 사진 유지, 이전 원본은 진행 중 로컬 재합성 참조 종료 후 회수한다. Store 자체가 원본·headMask·embedding·trail을 네트워크 입력으로 제공하지 않는다. [data-model SelfPhoto](../contracts/data-model.md#selfphoto-singleton); D-R4-02, D-R4-11.
6. foreground+온라인에서 worker 하나가 `nextJob→beginJob→handler→completeJob/failJob`을 순차 실행한다. 실제 HTTP 직전 attempts 증가, 5초 exponential backoff·최대 5분, Retry-After 우선, reconnect로 미래 nextAt을 앞당기지 않는다. offline은 attempts 불변, 재시도 불가 오류는 job 제거/실패 상태, 명시 재요청은 새 job이다. 검색·음성·피팅·경로는 큐에 넣지 않는다. handler는 외관 또는 cutout의 EXIF 제거 파생본만 전송한다. [data-model §6](../contracts/data-model.md#6-오프라인-대기열), [relay §6.4~6.5](../contracts/relay-api.md#6-엔드포인트별-계약); D-R6-03, D-R9-02.
7. 단위 테스트는 메모리 DB/파일/clock adapter, 브라우저 mock은 계약의 IndexedDB+Blob을 사용한다. 둘 다 실제 제약·삭제·큐·파일 사본을 구현하며 no-op 성공으로 대체하지 않는다. Android 재시작 영속성은 SQLite로 별도 확인한다. [device §1·§9](../contracts/device-modules.md#1-공통-경계); D-R1-04.

## mock 경계와 의존
S00의 DTO·native 등록·relay client를 사용한다. S04/S05의 쓰기 호출은 fixture로 공급하고 해당 모듈 구현은 하지 않는다. relay는 strict request/response mock이며 Meta 실호출은 금지한다. S11 공용 fixture가 아직 없으면 자기 테스트 안의 합성 데이터로 같은 계약을 검증하고 통합 때 공용 fixture를 연결한다. S06은 S07을 기다리지 않고 큐 worker까지 완료한다.

## 합격 기준
다음은 구현 후 실행할 명령 계약이며 이 문서 작성 중 실행한 결과가 아니다. 명령은 저장소 루트 기준이다.

| 명령 | 합격 조건 |
| --- | --- |
| `(cd app && npx vitest run src/data src/native/store.test.ts)` | 테스트 0개가 아닌 전체 통과. 삭제표의 모든 행, 중복 동시 저장, FK/범위, rollback·재시작 복구·파일 회수·commit 후 이벤트를 검증 |
| `(cd app && npx vitest run src/data -t 'queue')` | fake clock으로 5초→10초→최대 300초/Retry-After, offline attempts 0, 단일 dispatch, ref 삭제·외관 교체·사용자 이름 수정 후 늦은 응답 폐기; direct-cut-shop 라벨 완료까지 검증 |
| `(cd app && npx vitest run src/data -t 'snapshot')` | 준비 후 target/companion/trip 삭제 및 이름 변경에도 독립 snapshot 바이트·목적지 유지, draft 회수, Result 삭제가 다른 Result와 원본에 영향 없음 |
| `(cd app && npx vitest run src/data -t 'privacy')` | 종료 trail 0건, 삭제된 원본·job 접근 불가, 원본 self/headMask/embedding/trail HTTP 0회, describe 요청은 허용 외관/cutout뿐 |
| `scripts/emulator-lock.sh bash -lc 'cd app/android && ./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=com.streetfitting.app.plugins.store'` | S00 실제 package와 다르면 그 이름으로 치환해 기록. SQLite 재시작·FK·삭제·파일 사본 테스트 통과. AVD `Medium_Phone` 한 대만 사용 |

테스트 이름에 `queue`, `snapshot`, `privacy` 그룹을 두어 위 선택 실행이 실제 테스트를 실행하도록 한다. 에뮬레이터 선행 조건은 사용자 모델 준비(`SF_MODELS_DIR`), Java 21, Android API 37/16 KB다. web 통과를 native SQLite 통과로 보고하지 않는다.

## 완료 보고 형식
- 바꾼 파일: 소유 경로별 목록.
- 실행한 명령과 결과: test 수·통과/실패, native/메모리/IndexedDB 구분.
- 미확인·위험: 실제 relay 연결/파일 복구/플랫폼 제약, 실행하지 않은 항목.
- 계약 변경 요청: 필요한 공유 DTO/repository/설정 변경과 영향받는 슬라이스. 없으면 "없음".

## 미확인·위험
- 모델 복사·커밋·Orca setup 훅은 사용자가 수행하는 선행 조건이다(D-R7-11). 임의 실행하지 않는다.
- 메모리 테스트는 Android SQLite 크래시 내구성을 증명하지 않는다. 단위 단계와 통합 단계 증거를 구분한다.
- 결과 파일의 독립 복사는 필수다. 같은 URI/하드링크 취급으로 원본 삭제에 종속시키지 않는다(D-R9-03).
