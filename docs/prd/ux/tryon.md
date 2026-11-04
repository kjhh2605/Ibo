# 옷장과 가상 피팅

상태: 인터뷰 R9까지 반영, 화면 배치는 프로토타입 세션에서 확정

근거: [decisions.md](../decisions.md) D-R3-11, D-R4-01~11, D-R7-08. 계약: [data-model](../contracts/data-model.md), [device-modules](../contracts/device-modules.md), [relay-api](../contracts/relay-api.md). 데이터 전송은 [privacy](../product/privacy.md), 후보 선택은 [F-08](search.md#f-08-옷-후보-선택), 길 안내는 [F-15](walk.md)를 따른다.
R9 추가 근거: D-R9-01(자동 수치 판정), D-R9-02(바로 자른 옷 이름), D-R9-03(결과 스냅샷), D-R9-04(Trip 통합).

## F-09 저장한 옷과 옷 상세

- **우선순위:** P0. 검색·피팅·길 안내 연결점(D-R4-09).
- **화면:** 홈 "Saved", "Item"(D-R1-03).
- **동작:** 저장한 가게 옷을 열어 "Try it on"으로 대상 지정 또는 "Walk back"으로 안내. 옷장 옷은 피팅 대상으로 시작할 수 없고 함께 입을 옷으로만 사용한다(D-R4-09).

### 기능 규칙과 상태(확정)

- 검색에서 고른 가게 옷은 `Piece.origin='shop'`이며 SAM 개념(검색 문구)을 이름으로 쓴다. 검색 없이 trip 사진에서 바로 자른 가게 옷은 옷장처럼 `/v1/describe/piece`로 조각 이미지를 보내 Spark가 이름·종류를 붙인다. 대기 중에는 "Picked item"으로 보이고, 오프라인이면 `label_piece` 대기열에 넣는다. 사용자가 수정할 수 있다. 옷장은 `origin='wardrobe'`이며 기존 Spark 이름 흐름을 유지한다(D-R4-06, D-R6-03, D-R9-02).
- 가게 옷은 대상 1벌로 피팅을 시작한다. 옷장 상세에서 단독 피팅 시작 동작은 제거한다(D-R4-09).
- "Original photo"는 유지하되 원본이 있을 때만 연다. trip/사진 삭제 후 연결을 없앤다. trip 삭제로 저장한 조각과 `Piece.walkTo`를 지우지 않으므로 피팅·길 안내는 남는다(D-R3-11, D-R7-08).
- 저장한 옷·옷장 옷 각각 삭제를 제공한다. 삭제된 항목을 다시 상세로 열거나 새 피팅 입력으로 선택할 수 없다. 기존 결과 참조 처리의 세부는 [data-model](../contracts/data-model.md)을 따른다(D-R3-11).
- 같은 후보를 다시 저장해 조각을 중복 생성하지 않는다. 안정적 후보 ID와 insert-if-absent 방식은 [data-model](../contracts/data-model.md)의 [추론] 계약을 따른다(D-R1-03, D-R4-08).
- 저장 목록이 비면 새로 찾는 진입점을 유지한다. 오프라인에도 상세·원본 탐색·이름 수정·삭제·저장은 가능하고 피팅·길 안내는 연결 안내 후 재시도한다(D-R3-06, D-R6-03).

### 화면 배치·문구

- 홈의 잘라낸 타일·개수·"Find another", Item의 큰 옷 이미지·가게 카드·"Original photo"·"Walk back"·"Try it on"은 유효한 상태에서 유지한다. 옷장 상세 부제 "In your wardrobe"도 유지한다(D-R1-03, D-R7-08).
- 이름/종류 수정·삭제·옷장 상세의 변경된 액션·원본 삭제 후 가게 카드·빈 상태·오프라인 배치는 **프로토타입 세션에서 확정**한다. 원본이 없는 카드에 작동하지 않는 링크를 남기지 않는다(D-R3-11, D-R4-06, D-R4-09).
- **프로토타입 초안:** "Rename" → "Rename piece"·"Save name", "Delete" → "Delete this piece?"를 제공한다. 이름 대기는 "Spark is naming this piece…", 오프라인은 "Waiting for connection to name this piece."다. 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R3-11, D-R4-06, D-R6-03, D-R9-02).

### 실제 구현

- `Piece`와 앱 전용 `cutoutFile`을 사용한다. `walkTo`는 저장 시 사진 좌표를 복사하므로 `Shop.spot`이나 첫 번째 동반 옷으로 목적지를 다시 계산하지 않는다(D-R3-11, D-R5-01, D-R5-03).
- 실제 앱에서 category가 `unknown`이고 naming 작업이 없다는 이유만으로 실패를 표시하지 않는다. 검색 concept나 사용자가 정한 이름을 보존하고 "Category not set. You can edit this piece or ask Spark to name the cut-out."와 "Ask Spark to name this piece"를 제공한다. 이는 이름 생성 실패 판정이 아니라 선택적 보완 안내다.

### 프로토타입

- 가게 옷에는 "Walk back"과 "Try it on", 옷장 옷에는 피팅 시작 없이 이름 수정/삭제가 있다. 이름 대기·오프라인 대기와 원본 삭제 후 저장 스냅샷 가게 카드를 보여 준다. "Original photo"는 사진이 남아 있을 때만 제공한다. 모두 메모리 상태다(D-R3-11, D-R4-06, D-R4-09, D-R9-02).

## F-10 옷장

- **우선순위:** P0(D-R4-06, D-R4-08).
- **화면:** "Wardrobe", "Add a piece" 시트, "Add to wardrobe"(D-R1-03).
- **동작:** 촬영/갤러리 선택 → 탭 분리 → 조각 저장 → Spark 이름·종류 붙이기. 옷장 원본은 전송하지 않는다(D-R4-06).

### 기능 규칙과 상태(확정)

- 옷장 입력은 촬영·갤러리 모두 허용하며 EdgeTAM 탭의 세 마스크 중 사용자가 조각을 고른다. 선택 없거나 분리 실패면 저장을 완료하지 않고 다시 고르게 한다 [추론](D-R4-06; research §7.1).
- 조각 이미지만 `/v1/describe/piece`로 보내 `label`, `category`를 얻고 사용자가 수정할 수 있다. 오프라인은 조각 저장을 막지 않고 `QueueJob.kind='label_piece'`로 대기한다. 실패·대기와 완료를 구분한다(D-R4-06, D-R6-03).
- 옷장 옷은 함께 입을 옷으로만 선택한다. 보유 옷 유사도 매칭은 제외한다(D-R4-09; research §9).
- 옷장 옷 삭제를 제공한다. 빈 옷장에서도 추가할 수 있고, 오프라인에도 등록·로컬 탐색·삭제가 가능하다(D-R3-11, D-R6-03).

### 화면 배치·문구

- "N pieces you own", 2열 타일, "Mix these with what you saved to see them together. Only the cut-out piece is ever sent, never the whole photo.", "Add a piece", "Lay it flat or hang it up. You'll tap it to cut it out.", "Take a photo", "Choose from gallery", "Added to your wardrobe"는 유지한다(D-R1-03, D-R4-06).
- 이름 처리 중/실패·편집·삭제·빈 목록 배치 및 문구는 **프로토타입 세션에서 확정**한다(D-R3-11, D-R4-06, D-R6-03).

### 실제 구현

- `Capture`/`Media` → `Segmenter` → `Piece` 저장과 `QueueJob` → Spark 이름 붙이기다. 이름 요청에서도 원본 사진이 아니라 `cutoutFile`만 전송한다(D-R4-06, D-R6-03, D-R7-03).

### 프로토타입

- 초기 청바지·플랫슈즈, 촬영/갤러리의 샘플 입력을 사용한다. 조각 저장·이름 대기·오프라인 대기열·삭제·빈 목록을 제공하지만 Spark 대신 타이머로 이름을 붙이며 실제 원본 파일을 가져오지 않는다(D-R4-06, D-R6-03, D-R3-11).

## F-11 피팅할 옷 조합 선택

- **우선순위:** P0(D-R4-01).
- **화면:** "Try on". 가게에서 저장한 대상 옷 상세 또는 대상이 아직 존재하는 결과의 "Change pieces"에서 진입한다. 대상이 삭제된 결과에서는 이 액션이 비활성이다(D-R4-09, D-R9-03).
- **동작:** 대상 1벌 고정 → 함께 입을 옷 0~5벌 선택 → 유효한 본인 사진 1장으로 F-12 생성. 별도 전송 확인 route는 없다(D-R4-01, D-R4-03, D-R4-07).

### 기능 규칙과 상태(확정)

| 상태 | 가능한 동작·제한 | 근거 |
| --- | --- | --- |
| 대상 있음 | 가게 저장 옷 1벌을 고정. 조합에서 제거해 대상 0벌로 생성하거나 옷장 옷으로 대체할 수 없음 | D-R4-01, D-R4-09 |
| 함께 입을 옷 0~4벌 | 옷장·저장한 옷·trip 사진 직접 자르기로 추가 가능 | D-R4-07, D-R4-08 |
| 함께 입을 옷 5벌 | 추가 선택 차단, 기존 동반 옷 제거는 가능. 대상 포함 합계 6벌 | D-R4-07 |
| trip 사진 직접 자르기 | Trips → Trip의 가게별 사진 → Pick 탭 분리. Visit 없음. 완료 조각은 저장한 옷에 자동 추가하고 현재 조합으로 반환. Spark 이름/종류 대기 중 "Picked item", 동반 한도 유지 | D-R3-03, D-R4-08, D-R9-02, D-R9-04 |
| 본인 사진 없음 | 촬영/갤러리 선택 가능, 생성 불가 | D-R4-02, D-R4-11 |
| 본인 사진 등록/교체 중 | 자동 마스킹 성공한 한 장만 사용. 새 사진은 이전 사진을 대체. 실패하면 다시 촬영 안내, 마스킹 없는 사진으로 생성 불가 | D-R4-02, D-R4-11, D-R7-01 |
| 준비 완료 | 대상 1 + 동반 0~5 + 마스킹 성공 본인 1로 생성 | D-R4-07 |
| 오프라인 | 조합 선택·trip 탐색·로컬 분리·저장은 가능. 생성은 연결 안내와 재시도 | D-R6-03 |

### 화면 배치·문구

- "Your photo", "Change", "Take a photo", "Choose from gallery", "Saved from shops", "Your wardrobe"는 유지한다. 촬영 자세 안내도 유지하되 고정 촬영 날짜는 실제 `SelfPhoto.updatedAt`을 사용한다(D-R1-03, D-R4-02).
- 대상 고정과 동반 5벌 구분, trip 사진 고르기 경로, 개수 표시·상한 안내, 본인 사진 빈 상태·마스킹 실패, 생성 진입 버튼은 **프로토타입 세션에서 확정**한다. 기존 9벌 카운터/초과 토스트는 쓰지 않는다(D-R4-01, D-R4-07, D-R4-08, D-R4-11).
- **프로토타입 초안:** "Target · 1 shop piece", "Wear with it · N of 5", "From a trip photo", 상한 "Up to 5 companion pieces. Remove one to add another."를 표시한다. "Change" 시트의 촬영/갤러리 선택 뒤 "Removing face and hair on this phone…" → 준비 또는 "We couldn’t safely remove your face and hair…"·"Retake"로 이어진다. 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R4-02, D-R4-07~08, D-R4-11).

### 실제 구현

- `targetPieceId`, `companionPieceIds[]`, 단일 `SelfPhoto`를 사용한다. 사용자 입력 없이 `FaceMask`가 중심점 사람 마스크 → 윤곽 목 위치 → 머리 영역을 계산한다. 정확도는 미확인이다(D-R7-01).
- 원본 파일을 다루는 기기 단계와 네트워크 요청에 실을 마스킹 파일을 분리한다. 새 사진의 마스킹 실패가 원본 업로드로 이어지는 우회 경로는 금지한다(D-R4-11).
- 임시 합성 데모 보정이 번들에 있을 때 Try on 하단에 "This demo bundles provisional face-restoration calibration for one synthetic self photo, used only in debug or verification builds. It has not been human-reviewed. Other photos remain faceless."를 표시한다. 현재 번들의 적용 범위 안내이며 과거 Result마다 해당 검토를 받았다는 표시가 아니다. source hash와 build gate는 native/web 구현이 판정한다(D-R12-01).
- 마스킹 합격은 모든 본인 fixture에서 사람이 표시한 머리 영역과 전송본을 비교해 얼굴·머리 픽셀이 0인 조건이다. 사람 없는 사진은 반드시 실패해야 한다. 사용자가 영역을 조정하는 기능이 아니라 검증용 정답 영역과 비교하는 자동 판정이다(D-R9-01).

### 프로토타입

- 대상 가게 옷 1벌 고정 + 동반 최대 5벌이며 "From a trip photo" → All trips → Trip → Pick → "Add to outfit"으로 돌아온다. 본인 사진 "Change" 시트와 검사 중/준비/실패 상태가 있다. 전화 프레임 밖 호스트 "Masking fails"는 실패 재현용이며 제품 UI가 아니다. 실제 사진/마스킹 대신 샘플과 타이머를 쓴다(D-R4-01~02, D-R4-07~09, D-R4-11).

## F-12 피팅 생성

- **우선순위:** P0(D-R4-03).
- **화면:** 별도 전송 확인 화면은 없다. 현재 프로토타입은 Try on 내부에 생성 진행을 표시하며 최종 배치는 **프로토타입 세션에서 확정**한다(D-R4-03).
- **동작:** F-11에서 생성 시작 → 마스킹본/옷 전송 → 생성 → 기기 얼굴 재합성 또는 얼굴 없는 결과 → F-13(D-R4-03, D-R4-04).

### 기능 규칙과 상태(확정)

- 마스킹 성공한 본인 사진만 전송하며, 사용자에게 전송본을 보여 주거나 확인을 받는 단계를 넣지 않는다(D-R4-03, D-R4-11).
- 요청은 본인 1장 + 대상 1장 + 동반 0~5장, 최대 7장이다. 진행 중 같은 생성 액션의 중복 제출은 막는다 [추론] (D-R4-07).
- 생성 결과마다 목·어깨 경계의 색 차이와 어긋남을 자동 수치로 판정한다. 두 지표가 실측 임계값 안이고 구도가 안전할 때만 원본 얼굴을 기기에서 붙인다. 하나라도 기준을 벗어나면 그 결과를 자동으로 얼굴 없는 결과로 만들고 `faceless=true`로 저장한다. 일반 사진용 정식 합격은 미확인이다. 합성 self 한 장의 임시 보정은 정확한 저장 원본 hash·debug 환경으로 한정하며 사람 승인으로 표시하지 않는다(D-R4-04, D-R9-01, D-R12-01).
- 마스킹 실패는 재촬영 안내, 원격 생성 실패·정책 거절·시간 초과는 실패 상태다. 결과 파일 없이 성공 기록을 만들지 않는다 [추론]. 오프라인은 연결 안내 후 재시도이며 자동 생성 대기열은 없다(D-R4-11, D-R6-03; research §6.3).

### 화면 배치·문구

- 진행 중임과 완료/실패 구분은 제공한다. 기존 전송 확인 화면·전송본 미리보기·확인 버튼은 제거한다. 진행 단계의 위치와 최종 문구, 실패 후 재시도 배치는 모두 **프로토타입 세션에서 확정**한다(D-R4-03, D-R6-03).
- **프로토타입 초안:** "Generate" 후 "Sending without your face…" → "Generating the look…" → "Putting your face back…"를 인라인 표시한다. 오프라인 안내 중 Generate는 비활성이다. 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R4-03, D-R6-03).

### 실제 구현

- `/v1/tryon` → Muse Image → `Result.providerFile` 보관 → 기기 재합성/얼굴 없는 `Result.file`을 만든다. 재합성 파일을 서버에 다시 보내지 않는다. `Result.faceless`로 결과 종류를 보관한다(D-R4-04, D-R4-10).
- 취소 직후에는 `cancelling` / "Cancelling and cleaning up on this phone…" 상태를 유지한다. native 합성·임시 파일 정리와 필요 시 방금 저장한 결과의 rollback이 끝나기 전 Generate·조합 편집을 다시 허용하지 않는다. 원본 self/headMask/maskedFile을 결과 파일로 재사용할 수 없다.

### 프로토타입

- "Before sending"과 `send` route는 제거됐다. Try on의 인라인 타이머 진행 후 결과로 이동한다. 호스트 "Offline"으로 생성 차단, "Face check fails"로 얼굴 없는 결과를 재현한다. 두 스위치는 제품 UI가 아니며 실제 전송·Muse 생성·재합성·수치 판정을 하지 않는다(D-R4-03~04, D-R6-03, D-R9-01).

## F-13 피팅 결과

- **우선순위:** P0(D-R4-05).
- **화면:** "Your look"(D-R1-03).
- **동작:** 결과 열기·옷 상세·조합 변경·대상 옷으로 길 안내·결과 삭제. 내려받기는 플래그 허용 시만 제공한다(D-R3-11, D-R4-05, D-R4-10, D-R5-03).

### 기능 규칙과 상태(확정)

- `Result.file`을 표시한다. 얼굴 재합성이 기준에 못 미치면 얼굴 없는 결과를 표시한다. 결과에서 Look/Original 비교나 같은 조합을 다시 생성하는 기능은 제공하지 않는다(D-R4-04, D-R4-05).
- 기존 "Change pieces"는 대상 Piece가 존재할 때 조합 수정 경로로 유지하며, 별도 다시 생성 액션으로 사용하지 않는다. 대상 Piece가 삭제되면 비활성화하고 새 조합 화면을 열지 않는다. 새 생성은 F-11의 입력·한도를 다시 충족해야 한다(D-R4-05, D-R4-07, D-R9-03).
- 길 안내는 결과 생성 시 복사한 대상 옷의 촬영 위치 스냅샷으로 간다. 동반 옷 순서·출처로 목적지를 결정하지 않으며, 원래 대상 Piece 또는 trip을 삭제해도 결과 보기와 길 안내는 유지한다(D-R5-01, D-R5-03, D-R9-03).
- 결과 내려받기 플래그는 기본 OFF다. 워터마크·메타데이터 보존을 통합에서 확인한 뒤 켠다. 켠 경우도 EXIF GPS를 제거하며 provenance 보존이 깨지면 허용하지 않는다(D-R2-11, D-R4-10).
- 결과 삭제를 제공하며 삭제 후 기록 목록에서 빠진다. 오프라인에도 로컬 결과 열기·삭제는 가능하고 길 안내/새 생성은 연결을 요구한다(D-R3-11, D-R6-03).
- 결과 생성 시 옷 이름·잘라낸 이미지·길 안내 위치를 Result 안에 독립 복사본으로 저장한다. 대상 Piece 삭제는 이 복사본과 `Result.file`/`providerFile`을 지우지 않는다. 삭제된 원래 옷의 상세 연결은 사용할 수 없지만 스냅샷으로 결과·옷 목록·길 안내를 계속 보여 준다. 대상이 없으면 "Change pieces"는 비활성이다(D-R9-03; [data-model](../contracts/data-model.md)).

### 화면 배치·문구

- "Your look", "N pieces · Just now"(실제 생성 시각), "Wearing", 옷별 썸네일·이름·출처는 결과 스냅샷으로 유지한다. "Walk to Shop N"은 대상 삭제 후에도 유지하고, "Change pieces"는 대상이 남을 때만 활성화한다. 삭제된 옷 이름·이미지를 빈 자리로 바꾸지 않는다(D-R1-03, D-R5-03, D-R9-03).
- 비교 전환과 앱 안에서만 본다는 기존 안내는 제거한다. 얼굴 없는 상태·삭제·플래그 OFF/ON의 내려받기·참조 삭제 상태 배치 및 문구는 **프로토타입 세션에서 확정**한다(D-R3-11, D-R4-04, D-R4-05, D-R4-10).
- **프로토타입 초안:** 얼굴 없는 결과는 "Your face couldn’t be put back cleanly, so this look is shown without it.", 대상 삭제는 "The target piece was deleted. Your look and walk-back location are still saved."로 안내한다. "Delete" 확인과 함께 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R3-11, D-R4-04, D-R9-03).

### 실제 구현

- 기기에서 Result 생성 당시 옷 이름·조각 이미지·목적지의 독립 복사본과 표시 파일을 보관한다. 파일/필드 이름은 [data-model](../contracts/data-model.md)의 스냅샷 계약을 따른다. `providerFile`은 워터마크 보존 검증에 쓰고 `Media` 내보내기는 플래그와 GPS/provenance 조건을 검사한다(D-R4-10, D-R7-08, D-R9-03).
- 실제 앱의 얼굴 없는 안내는 "This look is shown without a face because face restoration did not meet the required safety or calibration checks."다. 미보정 임계값 때문에 얼굴을 붙이지 않은 경우도 포함하며, 품질 승인·검증된 재합성 실패로 과장하지 않는다.

### 프로토타입

- 결과 이미지는 실루엣에 조각을 배치한 시뮬레이션이다. Look/Original 전환은 없고 갤러리 저장은 플래그 OFF로 숨긴다. `target`/`companions`/`faceless` 스냅샷을 유지하며 "Walk to <target shop>"은 대상 삭제 후에도 작동하고 "Change pieces"만 비활성이다. 결과 삭제 확인도 제공한다. 실제 생성 파일/다운로드/영속 저장은 없다(D-R3-11, D-R4-04~05, D-R4-10, D-R5-03, D-R9-03).

## F-14 피팅 기록

- **우선순위:** 유지하는 보조 화면(D-R7-08).
- **화면:** 홈 "Try-ons" 행과 "Try-ons" 목록(D-R7-08).
- **동작:** 로컬 결과 목록 → F-13. 기록/결과에서 결과 삭제를 제공한다(D-R3-11, D-R7-08).

### 기능 규칙과 상태(확정)

- 결과를 기기에 보관하고 오프라인에도 목록과 상세를 연다. 기록이 없거나 모두 삭제되면 빈 상태가 된다. 삭제된 결과를 목록 캐시가 다시 열지 않게 한다(D-R3-11, D-R6-03, D-R7-08).

### 화면 배치·문구

- 개수·"kept on this phone", 2열 카드, "No looks yet", "Open something you saved and tap Try it on."을 유지한다. 삭제 위치·확인·완료 배치는 **프로토타입 세션에서 확정**한다(D-R1-03, D-R3-11, D-R7-08).

### 실제 구현

- `Result` 목록과 앱 전용 파일을 읽으며 삭제는 [data-model](../contracts/data-model.md)의 파일 정리를 따른다(D-R3-11, D-R7-08).

### 프로토타입

- 메모리 결과 그리드와 "No looks yet" 빈 상태가 있으며 상세에서 삭제하면 목록에 반영된다. 영속 저장은 없다(D-R3-11, D-R7-08).

## F-16 개인정보 안내

- **우선순위:** 유지하는 보조 화면(D-R7-08).
- **화면:** "Privacy", 부제 "What stays and what leaves"(D-R1-03, D-R7-08).
- **동작:** 항상 열 수 있는 데이터 경계 설명. 전송 승인 화면으로 사용하지 않는다(D-R4-03, D-R7-08).

### 기능 규칙과 상태(확정)

- 오프라인에도 읽을 수 있고 개별 데이터가 없는 상태에서도 경계를 설명한다(D-R6-03, D-R7-08).
- **기기 전용:** 본인 원본·얼굴/머리, 기록 중 trail(종료 후 삭제), 사진 임베딩, 옷장 원본, 얼굴 재합성 결과. 쇼핑 원본 전체를 "기기 밖으로 나가지 않음"으로 묶지 않는다(D-R0-02, D-R0-03, D-R3-01, D-R4-06).
- **Meta로 전송:** 질의와 메모 포함 방문 요약 → Spark; 외관 사진 → Spark; 선택한 쇼핑 사진 최대 3장 → SAM; 옷장 조각과 검색 없이 trip에서 바로 자른 가게 옷 조각 → Spark 이름/종류 및 Muse Image 피팅; 마스킹 본인 1장과 옷 최대 6장 → Muse Image; 최대 15초 음성 → Voice Transcribe(D-R3-01, D-R3-04, D-R3-05, D-R3-07, D-R4-06, D-R4-07, D-R9-02).
- **그 밖의 외부 요청:** 출발·도착 좌표는 릴레이 경유 OSRM, 지도 영역 타일은 앱에서 OpenFreeMap 직접 요청. 모든 요청이 Meta로 간다고 쓰지 않는다(D-R7-03; research §8.2).
- **보관 안내:** 릴레이 기본 메타데이터 로그와 로컬 개발 플래그의 질의/Spark 응답 예외를 구분한다. 이미지·음성·좌표 로그는 항상 금지다. Meta의 즉시 삭제를 보장하지 않는다(D-R6-04; research §6.3).
- **내려받기:** 사용자가 내보내는 사진은 GPS를 제거한다. 결과는 provenance 보존 확인 전 플래그 OFF다(D-R2-11, D-R4-10).
- **기존 가게 외관(D-R11-01):** 쇼핑 종료 뒤 외관 추가·재촬영은 shutter 시점 현재 위치를 한 번 사용하지만 trail을 만들지 않는다. 위치 실패를 과거 `Shop.spot`으로 대체하지 않는다. 보행 역시 shopping trail을 시작하지 않는다.

### 화면 배치·문구

- 화면 제목과 부제는 유지한다. 데이터별 경계와 보관 예외를 설명하는 목록이 프로토타입에 반영됐으며 최종 영어 목록·배치는 **프로토타입 세션에서 확정**한다(D-R3-01, D-R3-04, D-R4-06, D-R6-04, D-R7-08).
- 실제 앱의 "Your location trail" 설명은 "Recorded only while shopping. The raw trail is deleted when you end the trip and is never uploaded. Saved photo locations remain for walking back. Retaking a saved shop’s storefront uses your current location once when you take the photo, even outside shopping mode; it does not start a trail. Walking guidance does not create a shopping trail."이다. prototype의 대응 문구는 "Recorded only while shopping, deleted when the trip ends. Retaking a saved shop’s storefront uses your current location once, even outside shopping mode, without starting a trail."이다. D-R11-01 예외를 반영한 구현 문구이며 인간 화면 세션 승인 여부는 미확인이다.

### 실제 구현

- [privacy](../product/privacy.md)의 경계 표와 불변식이 원본이다. 화면에서 편의상 전송 대상을 누락하거나 로컬 개발 예외를 새로운 전송 동의로 취급하지 않는다(D-R6-04, D-R7-08).

### 프로토타입

- 데이터별 기기 보관/릴레이 경유 Meta 전송, OSRM·OpenFreeMap, 릴레이 이미지·음성·좌표 무보관과 메타데이터 로그/개발 플래그 예외, 갤러리 GPS 제거를 정적 목록으로 안내한다. 실제 전송/저장 경계를 검증하는 구현은 아니다(D-R3-04, D-R4-06, D-R6-04, D-R7-08, D-R9-02).

## 프로토타입 미반영

대상+동반 5·사진 교체/실패·인라인 생성·얼굴 없는 결과·비교 제거·내려받기 숨김·이름/삭제·trip 왕복·오프라인/Privacy·결과 스냅샷은 화면과 상태에 반영됐다(D-R3-11, D-R4-01~11, D-R5-03, D-R6-03~04, D-R7-08, D-R9-02~04). 아래는 실제 구현의 차이만 남긴다.

| 결정 ID | 남은 실제 구현 | 현재 프로토타입 |
| --- | --- | --- |
| D-R4-02, D-R4-11, D-R7-01, D-R9-01 | 실제 사진 입력·자동 마스킹, fixture 머리 픽셀 0/사람 없음 실패 판정 | 샘플과 검사 타이머, 호스트 Masking fails |
| D-R4-03~04, D-R9-01 | Muse Image 호출·기기 재합성·목/어깨 수치 판정 | 인라인 타이머와 호스트 Face check fails |
| D-R4-06, D-R6-03, D-R9-02 | Spark 이름/종류·실제 연결·영속 대기열 | 이름 대기와 Offline 스위치·타이머 |
| D-R3-11, D-R9-03 | 파일·스냅샷 영속 저장과 실제 삭제 연쇄 | 메모리 저장/삭제/독립 결과 스냅샷 |
| D-R4-10 | 워터마크·메타데이터 보존 확인 및 허용 시 파일 내보내기 | 결과 내려받기는 플래그 OFF |
