# S10 app-tryon
상태: 확정(R9까지) · 웨이브 1 · 선행: S00 merge 완료. FaceMask·Store·relay mock으로 독립 구현한다.

## 목표
가게 대상 한 벌과 함께 입을 옷 최대 다섯 벌로 안전한 피팅 생성 파이프라인을 완성한다. 마스킹된 본인 사진만 전송하고 기기 재합성 또는 얼굴 없는 결과를 불변 스냅샷과 함께 저장한다.

## 읽을 문서
이 목록만 읽는다.
- [결정 로그](../decisions.md): R4, D-R3-11, D-R6-03, D-R7-01, R9.
- [data-model](../contracts/data-model.md): Candidate/Piece/SelfPhoto/Result, §4~6.
- [device-modules](../contracts/device-modules.md): §1, §5 Segmenter, §6 FaceMask 전부, §7 Media, §9 Store.
- [relay-api](../contracts/relay-api.md): §1~5, §6.5~6.6, §7~8.
- [tryon UX](../ux/tryon.md): F-09~14 / [navigation](../ux/navigation.md): outfit 왕복·Result·Walk.
- [scope](../product/scope.md), [privacy](../product/privacy.md): 본인 사진·이름 붙이기·스냅샷·내려받기.
- [fixture 명세](../verification/fixtures.md): 마스킹/재합성/오류 fixture.

## 소유 경로
- 수정: `app/src/tryon/**`와 그 안의 테스트·adapter. JS 오케스트레이션·draft·생성 상태·요청 serializer·export gate를 맡는다.
- 금지: S05 FaceMask/Segmenter native·TS 실제 구현, S06 Store/queue, S04 Media, S08 화면, relay/client, 공유 DTO/설정·계약. 필요한 계약 변경은 S00/통합 담당에게 요청한다.

## 구현 항목
1. 메모리 draft `{targetPieceId,companionPieceIds}`를 관리한다. 존재하는 origin=shop 대상 정확히 1, 동반 origin=shop/wardrobe 0~5, 중복·대상 재선택 금지, 제출 직전 재검증이다. 옷장 단독 대상이나 6번째 동반을 몰래 치환하지 않는다. [data-model §5](../contracts/data-model.md#5-저장피팅-불변식), [relay §6.6](../contracts/relay-api.md#66-post-v1tryon); D-R4-01, D-R4-07~09.
2. 동반 추가는 저장 옷·옷장·trip 사진 직접 탭 분리를 지원한다. 직접 자른 조각은 `saveCandidate({origin:'shop',labelMode:'describe',...})` 완료 후 saved 목록과 draft에 넣는다. 저장 실패/취소는 추가하지 않는다. 대기 이름 "Picked item"·category "unknown", S06 label_piece queue로 cutout만 Spark에 보내며 검색 concept 흐름은 labelMode=concept다. UI 왕복 상태는 S08과 계약으로 연결한다. [data-model §5~6](../contracts/data-model.md#5-저장피팅-불변식), [tryon F-11](../ux/tryon.md#f-11-피팅할-옷-조합-선택); D-R4-08, D-R9-02.
3. 본인 사진은 촬영/갤러리 하나, `FaceMask.register` 성공 후에만 사용한다. 실패면 재촬영 상태·요청 0회, 이전 정상 SelfPhoto는 유지한다. 원본·headMask가 serializer에 들어가지 않도록 허용 입력을 maskedFile로 제한한다. 마스킹본 미리보기/전송 확인 화면은 없다. [device §6](../contracts/device-modules.md#6-facemask--s05-피팅-js-오케스트레이션-s10), [privacy 본인 사진](../product/privacy.md#본인-사진); D-R4-02~03, D-R4-11, D-R7-01.
4. 생성 순서는 입력 검증/마스킹 성공 확인 → `prepareResult`로 옷/가게/파일 snapshot 고정 → `/v1/tryon`에 masked self+target+companions → provider 원본 보관 → `FaceMask.compose` 자동 판정 → `saveResult({draftId,file,faceless,providerFile})`다. 등록 사진 버전 updatedAt을 유지하고 다른 사진 얼굴로 바꾸지 않는다. D-R9-01의 목·어깨 색 차이/어긋남 임계값을 통과한 결과에만 재합성을 허용하고 미달은 자동 faceless다. unsafe_output이면 결과 저장/노출을 막는다. [device §6](../contracts/device-modules.md), [data-model Result](../contracts/data-model.md#result); D-R4-04, D-R9-01~03.
5. HTTP 입력은 self 1+옷 1~6=2~7장, `headMasked:true`, 불투명 pieceRef·label/category/origin과 이미지뿐이다. 좌표·원본 파일 경로·headMask·snapshot 가게 정보는 보내지 않는다. providerFile은 받은 바이트 그대로, compose file은 별도다. 중복 생성 차단, 취소/실패에서 draft 회수·늦은 응답 무시, offline 생성 큐/자동 재요청 없음이다. [relay §6.6](../contracts/relay-api.md#66-post-v1tryon), [data-model §4~6](../contracts/data-model.md#4-생명주기삭제-연쇄); D-R4-07, D-R4-10~11, D-R6-03~04.
6. Result는 snapshot을 표시/안내의 원장으로 제공한다. 원래 대상 삭제 후에도 결과와 targetSnapshot.walkTo를 유지, "Change pieces"는 비활성화한다. 대상이 남을 때 조합 변경은 존재하는 companion만 복원하고 다시 제출 시 한도를 검증한다. [data-model Result](../contracts/data-model.md#result), [navigation](../ux/navigation.md#화면-스택과-진입-규칙); D-R9-03~04.
7. `resultDownload=false`를 기본으로 유지한다. UI뿐 아니라 export adapter도 flag와 S11 provenance 승인 설정을 검사해 Media 호출을 막는다. true인 승인 설정도 GPS 제거와 워터마크·provenance 보존을 함께 만족해야 한다. 일반 Photo 다운로드와 혼동하지 않는다. [device §7](../contracts/device-modules.md#7-media--s04-내보내기-정책-s10), [data-model §5](../contracts/data-model.md#5-저장피팅-불변식); D-R2-11, D-R4-10.

## mock 경계와 의존
FaceMask mock은 실제로 머리가 제거된 합성 fixture를 반환한다. raw 파일을 maskedFile로 이름만 바꾸지 않는다. `ok:false` 각 사유·합성 통과/수치 미달 faceless·unsafe_output·사진 버전 변경·정책 거절을 주입한다. Store mock도 독립 snapshot 파일 복사를 구현한다. S05는 알고리즘/자동 지표, S06은 저장/큐 worker, S03은 remote 요청을 담당한다. 이들은 S11 통합에서 실제 연결하고 단위 단계 Meta 호출은 없다.

## 합격 기준
아래는 구현 후 실행 요구이며 문서 작성 중 실행하지 않았다. 테스트 그룹을 실제로 만들어 선택 0개가 되지 않게 한다.

| 명령(저장소 루트) | 합격 조건 |
| --- | --- |
| `(cd app && npx vitest run src/tryon)` | 조합/파이프라인/실패/취소/중복 제출/버전 경합 전체 통과 |
| `(cd app && npx vitest run src/tryon -t 'composition')` | target 0/2/wardrobe·동반6·중복 차단, 동반0/5 성공, 직접 자르기 저장 후 추가 및 오프라인 이름 queue·Picked item 상태 |
| `(cd app && npx vitest run src/tryon -t 'privacy')` | 원본 self/headMask sentinel이 어떤 HTTP body/URI에도 없음. 실패/취소/파일 누락에서 tryon 0회, 실제 전송 decoded bytes는 masked fixture만. 옷장/trip 원본 대신 cutout 사용, 결과 재업로드 0회 |
| `(cd app && npx vitest run src/tryon -t 'snapshot')` | 요청 중/완료 후 target·companion·trip 삭제/이름 변경에도 snapshot 고정, 대상 삭제 뒤 보기·안내 유지/Change pieces 비활성, 실패 draft 회수 |
| `(cd app && npx vitest run src/tryon -t 'quality')` | compose 자동 합격이면 faceless=false, 수치 미달이면 true, unsafe_output이면 saveResult 0회. 실제 임계값 품질을 mock 통과로 주장하지 않음 |
| `(cd app && npx vitest run src/tryon -t 'download')` | 기본 OFF에서 Media 호출/갤러리 파일 0, 미승인 exporter 차단, providerFile hash 불변 |
| `scripts/emulator-lock.sh scripts/e2e/run.sh --mode mock --scenario tryon` | 통합 단계 S11: 실제 native 마스킹→mock relay→compose→SQLite snapshot 연결. 단위 완료의 선행 요구는 아님 |

D-R9-01의 전체 fixture 머리 픽셀 0/사람 없는 사진 실패 및 실제 재합성 임계값 검증은 S05/S11 소유다. S10은 그 결과를 우회하지 않는 orchestration을 검증한다.

## 완료 보고 형식
- 바꾼 파일.
- 실행한 명령/테스트 수/결과: composition, privacy, snapshot, quality, download 각각.
- 미확인·위험: 실제 Muse Image·마스킹 정확도·provenance 미승인 여부.
- 계약 변경 요청: 필요한 shared API/flag/exporter 변경, 없으면 "없음".

## 미확인·위험
재합성 수치 임계값은 PoC에서 정하며 미확인인 동안 `compositionThresholds=null`과 `decision=not_calibrated`로 faceless를 선택한다. 결과별 수치 미달을 자동 faceless로 처리해도 안전한 출력 머리 영역을 찾지 못하면 성공으로 저장할 수 없다. 결과 내려받기는 검증되지 않았으면 계속 OFF이며 이 상태는 허용된 제품 결정이다.
