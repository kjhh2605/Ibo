# 쇼핑 기록과 촬영

상태: 인터뷰 R9까지 반영, 화면 배치는 프로토타입 세션에서 확정

근거: [decisions.md](../decisions.md) D-R2-01~11, D-R3-03, D-R3-10, D-R3-11, D-R6-03, D-R7-10, D-R9-04. R2 촬영 흐름을 유지하되 이후 trip·삭제·외관 대기열·fixture와 Trip의 가게 정보 통합을 반영한다. 데이터와 네이티브 동작은 [data-model](../contracts/data-model.md), [device-modules](../contracts/device-modules.md)을 따른다.

## F-01 쇼핑 모드

- **우선순위:** P0
- **근거:** D-R2-01, D-R2-02, D-R2-10, D-R2-11
- **화면:** 홈 상단 카드, Android 시스템 권한 대화상자, 위치 거부 설명 시트, 종료 확인 시트, 알림 창
- **목적:** 쇼핑하는 동안 위치를 기록해 사진과 가게 위치를 연결한다.

### 기능 규칙과 상태(확정)

- 앱에서 쇼핑 모드를 켤 때마다 `Trip {id, startedAt, status: 'recording'}` 하나가 생긴다. `Shop.n`은 trip 안에서 센다. 종료 시 `endedAt`과 `status: 'ended'`를 기록하고 그 trip의 `TrailPoint`를 모두 지운다. 가게·사진은 남는다(D-R0-03, D-R3-03).
- 오프라인에도 시작·기록·촬영·종료가 가능하다. 새 trip이 비어 있어도 과거 기록을 지우거나 오늘 데이터로 합치지 않는다(D-R3-03, D-R6-03).

### 화면 배치·문구

아래 R2 문구 중 오늘 단위 카운트는 현재 trip 단위로 바뀐다. 그 카운트와 최근 trip 진입 배치·새 영어 문구는 **프로토타입 세션에서 확정**한다(D-R3-03). 그 밖의 권한·알림·종료 흐름은 유지한다(D-R2-01, D-R2-10, D-R2-11).

| 상태 | 화면 | 동작 |
| --- | --- | --- |
| 꺼짐 | "Shopping mode", "Snap anything you like. We remember which shop it was in, so you can find it and walk back later.", "Start shopping" | 세션 첫 시도는 위치 권한을 묻는다 |
| 기록 중 | "Recording", "N min", "Shop N", 사진 수/위치 상태, "Take photo" / "End". trip 단위 상태 문구는 프로토타입 세션에서 확정 | 카메라 또는 종료 확인 시트를 연다(D-R3-03) |
| 종료 확인 | "End shopping mode?", "N shops, N photos. Your step-by-step location trail is deleted now. Each shop’s spot and its photos stay on this phone.", "Keep going" / "End" | "End"는 기록을 멈추고 "Trail deleted · shop spots kept" 토스트를 띄운다 |

### 권한 흐름

1. "Start shopping"을 처음 누르면 중앙의 시스템 카드가 뜨고 뒤가 어두워진다. 앱 바텀 시트가 아니다.
2. 위치 제목은 "Allow Street Fitting to access this device's location?"다. 세로 선택지는 "While using the app", "Only this time", "Don't allow"다.
3. 위치를 허용하면 알림 제목 "Allow Street Fitting to send you notifications?"와 "Allow" / "Don't allow"를 보여 준다.
4. 위치를 거부하면 앱 시트 "Shopping mode needs your location"을 띄운다. 본문은 "It's how each shop gets pinned so you can walk back to it. Shopping mode can't start without it."이고, 버튼은 "Not now" / "Open settings"다. 쇼핑은 시작하지 않는다.
5. 다음 시작 시 위치를 다시 묻는다. 한 번 허용한 위치는 세션이 끝날 때까지 다시 묻지 않는다. 알림 선택도 세션 store에 남는다.

| 위치 | 알림 | 쇼핑 모드 / 알림 카드 / 토스트 |
| --- | --- | --- |
| 거부 | 묻지 않음 | 시작하지 않음. 위치 설명 시트만 표시 |
| 허용 | 허용 | 시작함. 알림 카드 표시. "Shopping mode on · recording your location" |
| 허용 | 거부 | 시작함. 알림 카드 없음. "Shopping mode on · no notification card" |

실제 앱의 오류 분기는 다음과 같다. 이는 S08 구현 문구 기록이며 새 배치·문구의 인간 화면 세션 승인을 뜻하지 않는다.

| native code | 실제 화면·재시도 |
| --- | --- |
| `location_permission_denied`, `location_disabled` | 위 "Shopping mode needs your location" 시트. "Not now" / "Open settings"; trip을 만들지 않음 |
| `location_unavailable` | "Your location is unavailable". "A current location fix is needed before shopping can start. Move somewhere with a clearer signal, then try again. No trip has been started."와 "OK". 닫고 "Start shopping"으로 다시 시도; 일시적 fix 부재를 권한 거부로 바꾸거나 설정 변경을 요구하지 않음 |

실제 앱의 종료 확인은 "End shopping mode?", "Your photos and saved locations stay on this device. The raw location trail will be deleted.", "End shopping" / "Cancel"이다. 성공한 `ShoppingSession.stop()` 뒤 Home으로 돌아가며 실패를 종료 성공으로 처리하지 않는다. 위 R2 표는 프로토타입 문구 기록이다.

### 기록 중 알림

- **화면:** 상태 표시줄을 누르거나 아래로 끌면 위에서 내려오는 알림 창이 열린다. 상단에는 시각과 날짜가 있다.
- 쇼핑 중이고 알림이 허용됐을 때만 카드 하나가 있다. 작은 앱 아이콘, "Street Fitting", "Recording", 제목 "Shopping mode · Shop N", 본문 "N photos · N min", 액션 "Take photo" / "New shop"이다. 숫자는 현재 쇼핑 상태와 같다.
- 카드 본문은 창을 닫고 홈으로 돌아간다. "Take photo"는 창을 닫고 카메라로 간다. 이미 카메라가 맨 위라면 같은 화면에 머문다.
- "New shop"은 창을 닫고 카메라를 열면서 F-03과 똑같이 새 가게를 시작하고 배너를 보여 준다.
- 쇼핑이 꺼졌거나 알림을 거부했으면 "No notifications"다. 뒤 배경을 누르거나 위로 밀면 닫힌다. `Esc`는 화면 이동보다 알림 창 닫기를 먼저 수행한다.
- 이 카드 외에 다른 알림, 헤즈업, 체류 알림, 종료 요약, 리마인드는 없다.

- **실제 구현**
  - 앱 화면의 버튼으로만 쇼핑 모드를 시작한다. 위치는 포그라운드 서비스(`FOREGROUND_SERVICE_LOCATION`)와 FusedLocation으로 기록한다.
  - 이 카드는 포그라운드 서비스 알림이고, 액션은 `PendingIntent` 딥링크로 앱 route를 연다 [추론]. 알림 권한 거부 시 알림 창 카드는 없지만 서비스 기록은 계속한다.
  - "Open settings"는 앱 설정으로 연결한다. 앱을 최근 목록에서 지워도 서비스는 기록을 계속한다. 다시 열면 기록 중 상태, 현재 가게와 사진 수를 복원한다(D-R2-11).
  - 종료 시 원본 위치 기록을 지우고 각 가게의 좌표와 사진은 남긴다.
- **프로토타입**
  - 권한과 알림 창은 OS가 아니라 앱 트리의 시뮬레이션이다. kit 상태 표시줄 위에 투명 핫스팟을 둔다. 호스트 안내는 "Tap the status bar to pull down notifications"다.
  - "Open settings"는 시트를 닫고 "Prototype: settings not connected" 토스트만 띄운다.
  - 위치를 실제로 기록하지 않는다. 가짜 시계는 화면과 무관하게 4초마다 1분씩 증가한다.
  - 초기에는 쇼핑이 꺼져 있고 "Sun, Nov 1"(가게 3곳), "Sat, Oct 24"(외관 없는 가게 1곳) trip이 있다. "Start shopping"마다 새 trip과 Shop 1이 생성된다 [추론: 시작 시 첫 가게 자동 생성]. Reset은 세션을 초기화하며 새로고침/종료 후 복원은 없다(D-R3-03).

## F-02 옷 사진 촬영

- **우선순위:** P0
- **근거:** D-R2-05, D-R2-07, D-R2-09
- **화면:** 어두운 전체 화면 Camera
- **화면 배치·문구:** 상단 뒤로 가기와 기록 칩 "Shop N · N new", 위치 정확도(예: "±12 m", 실제 값 사용). 하단 마지막 사진 썸네일, 셔터, "New shop". fixture 여부 표시는 넣지 않는다(D-R2-07, D-R7-10).
- **동작**
  - 일반 셔터는 하얀 플래시를 보이고 썸네일을 갱신한다. 현재 가게의 새 사진 수와 전체 사진 수가 1 늘어난다. 새 가게 배너가 있으면 닫힌다.
  - 사진마다 촬영 시각과 위치를 연결한다. 앱 전용 저장소에만 저장하고 갤러리에는 자동으로 넣지 않는다. 사진별 내려받기는 F-08이다.
- **기능 규칙과 상태(확정):** 사진은 현재 `tripId`, `shopId`에 연결한다. 사진이 없는 상태에서도 셔터를 사용할 수 있다. 오프라인에도 촬영·로컬 저장은 가능하다. 카메라/저장 실패는 새 Photo 성공으로 처리하지 않는다 [추론](D-R3-03, D-R6-03).
- **실제 구현:** CameraX로 촬영하고 촬영 시각의 위치를 연결한다. 에뮬레이터 debug 빌드는 adb로 넣은 폴더의 이미지를 셔터마다 순서대로 반환하는 fixture 캡처 소스를 둔다. adb intent extra로 켜며 화면에 표시하지 않고 release 빌드에는 포함하지 않는다. fixture 설정과 파일 오류는 [device-modules](../contracts/device-modules.md)을 따른다(D-R7-10).
- **프로토타입:** 샘플 사진을 순환하며 셔터마다 메모리 store에 실제 Photo 항목을 추가한다. Trip 사진 그리드에서 새 사진을 열어 선택할 수 있다. 실제 카메라·파일 저장은 아니며 칩과 썸네일로 피드백한다(D-R3-03, D-R7-10).

### 실제 앱의 카메라 오류

- `camera_permission_denied`: "Camera access is off. Allow access in device settings, then try again."
- 그 밖의 preview 실패(`preview_not_open`, `fixture_empty`, `fixture_invalid` 포함): "The camera preview could not start. Try again or return to your saved photos." 권한 거부로 오인해 설정 변경을 요구하지 않는다.
- 공통 액션은 "Try again". preview 준비 전/실패 중 셔터는 비활성이다. 실패한 촬영·파일 저장을 Photo 성공으로 세지 않고, 화면을 나가면 preview를 닫는다.
- 문구는 실제 구현 기록이며 인간 화면 세션 승인은 미확인이다.
- 실제 Camera는 화면 높이 안에서 preview 영역과 하단 촬영 controls를 나눈다. 새 가게 배너는 preview 위에 있고, 작은 화면/오프라인 배너에서 본문이 길어져도 셔터는 하단에 남는다. "End shopping"은 상태 행, 마지막 사진·셔터·"New shop"은 하단에 둔다. native preview 좌표와 WebView가 어긋나지 않도록 Camera 진입에는 본문 이동 애니메이션을 적용하지 않는다.

## F-03 가게 방문 구분과 외관 사진

- **우선순위:** P0
- **근거:** D-R2-03, D-R2-04, D-R2-07, D-R2-08
- **화면:** Camera의 새 가게 배너, 외관 모드, 메모 시트
- **기능 규칙과 상태(확정):** 새 가게는 현재 trip에 속한다. 외관·메모를 건너뛰어도 가게와 옷 사진 저장은 가능하고, 오프라인에서도 로컬 추가가 가능하다(D-R2-07, D-R3-03, D-R6-03).
- **화면 배치·문구:** 아래 R2 배너·외관·메모 동작을 유지한다. trip 맥락 표시에 새 문구가 필요하면 **프로토타입 세션에서 확정**한다(D-R3-03).
- **동작**
  1. "New shop"을 누르면 즉시 번호가 1 늘고 칩은 "Shop N · 0 new"다. 좌표 저장 입력/좌표 값은 표시하지 않는다. 기존 "In a new shop?" 시트는 없다.
  2. 칩 아래 배너는 "Shop N started", "This spot is saved.", 작은 액션 "Storefront photo" / "Add note", 닫기 ×다. ×나 일반 옷 셔터를 누르면 사라지고, "New shop"을 다시 누르면 다음 가게의 배너로 교체된다.
  3. "Storefront photo"는 칩 "Shop N · storefront", 안내 "Fit the whole shop front in the frame"과 "Cancel", 노란 셔터를 보여 준다. "New shop"은 비활성이다. "Cancel"은 일반 모드로 돌아온다.
  4. 외관을 찍으면 일반 모드로 돌아가고 "Storefront saved" 토스트가 뜬다. 가게 번호는 늘지 않는다. 배너는 남고 묘사는 뒤에서 처리한다.
  5. "Add note"는 시트 "Note for Shop N", 본문 "Anything that helps you find it again."을 연다. 한 줄 입력의 placeholder는 "e.g. cash only, army jackets at the back"다. "Cancel" / "Save"가 있고, 빈 입력은 저장할 수 없다.
  6. 저장하면 "Note saved" 토스트가 뜬다. 기존 메모가 있으면 채운 채로 연다. Trip의 가게별 메모에서도 같은 시트를 쓴다(D-R9-04).
- **실제 구현:** "New shop" 시점의 현재 좌표를 가게의 `spot`으로 저장한다. 외관 사진과 메모는 선택 사항이다. 가게 번호, 시작 시각, 좌표는 외관 촬영 여부와 무관하게 보존한다.
- **프로토타입:** 가게를 세션 store에 추가하고 샘플 좌표를 쓴다. 실제 GPS/카메라는 연결하지 않는다.

### 기존 가게 외관 추가·재촬영(D-R11-01)

- Trip의 "Add storefront photo" / "Retake storefront"에서 해당 `shopId`의 Camera를 연다. 쇼핑이 종료된 과거 trip도 허용한다. 별도 Visit route는 만들지 않는다.
- 안내는 "Fit the whole shop front in the frame. Taking this photo uses your current location once; it does not start a shopping trail."이고 "Capture storefront" / "Cancel"을 제공한다. 성공하면 "Storefront saved" 후 원래 Trip으로 복귀한다.
- shutter 시점의 현재 위치를 한 번 취득한다. 위치 권한/현재 fix가 없으면 촬영 저장을 실패시키며 `Shop.spot`이나 과거 위치로 대체하지 않는다. trip·shopping trail·FGS를 새로 시작하지 않고 기존 `Shop.spot`도 바꾸지 않는다.
- 실제 호출은 `Capture.openPreview({purpose:'storefront',shopId,facing:'back'})` → `takePhoto({kind:'storefront'})`다. 새 외관 Photo ID를 `describe_storefront` queue의 `refId`로 사용한다. 실패 상태의 "Retry description"도 같은 Photo ID로 재시도한다.
- 기존 외관의 "Delete storefront photo" 확인은 "The storefront and its description will be removed. Saved look snapshots stay."다. 삭제는 기존 Result의 독립 snapshot을 변경하지 않는다.
- D-R11-01의 위치 계약은 확정이며 새 영어 문구·배치의 인간 화면 세션 승인은 미확인이다.

## F-04 외관 사진 자동 묘사

- **우선순위:** P0
- **근거:** D-R2-04, D-R2-07, D-R6-03
- **화면:** Home 가게 목록과 Trip의 가게별 외관 설명 영역. Camera에는 묘사 카드가 없고 별도 Visit 화면도 없다(D-R2-04, D-R9-04).
- **동작:** 외관 저장 후 온라인이면 뒤에서 묘사하고 결과를 기기에 저장한다. 오프라인이면 대기열에 넣었다가 연결되면 처리한다. 카메라를 나가도 작업 상태는 유지한다(D-R2-04, D-R6-03).
- **기능 규칙과 상태(확정):** `Shop.descriptionState`는 `none`(외관 없음), `pending`(대기/처리 중), `done`(완료), `failed`(실패)를 구분한다. 미완료 묘사가 사진 촬영·로컬 탐색을 막지 않는다. 외관/가게/trip을 삭제하면 관련 대기 작업이 삭제된 사진을 전송하지 않게 정리한다 [추론](D-R3-11, D-R6-03).
- **화면 배치·문구:** 실제 온라인 처리 중 기존 스피너와 "Describing the storefront…"를 유지한다. 오프라인 대기·실패를 계속 처리 중으로 표시하지 않는다. 대기/실패/재시도 배치·문구는 **프로토타입 세션에서 확정**한다(D-R6-03).
- **프로토타입 초안:** 오프라인 "Will describe when you’re back online", 실패 "Couldn’t describe the storefront". 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R6-03).
- **실제 구현:** `QueueJob.kind='describe_storefront'`와 `/v1/describe/storefront`를 사용해 외관 사진을 릴레이 → Muse Spark 1.3 Standard로 보내고 결과를 `Shop.description`에 보관한다. QueueJob 세부는 [data-model](../contracts/data-model.md)을 따른다(D-R2-04, D-R6-03).
- **프로토타입:** `none`/`pending`/`done`/`failed` 상태를 구분한다. 외관은 샘플을 사용하며 묘사는 타이머로 완료한다. 제품 UI가 아닌 호스트 "Offline"으로 대기열을 재현하고 온라인 복귀 시 처리한다. 실제 Spark 호출은 없다(D-R6-03).

## F-05 Trip 화면에 가게 정보 통합

- **우선순위:** P0(D-R9-04).
- **근거:** D-R2-04, D-R2-07, D-R2-08, D-R3-03, D-R3-10, D-R3-11, D-R9-04.
- **화면:** 홈의 최근 trip, "All trips" 날짜별 목록, 선택한 "Trip". 별도 Shop/Visit 화면은 없고 Trip 한 화면에서 가게별 정보를 읽고 수정한다(D-R3-03, D-R3-10, D-R9-04).
- **동작:** Trip의 가게마다 외관 사진·묘사·메모와 수정·사진 목록을 보여 준다. 사진을 누르면 바로 F-08 Pick으로 간다. 홈 가게 행은 해당 Trip의 가게 위치로 이동하고, "All trips"의 trip 행은 Trip을 연다. Trip·가게 영역에는 길 안내 진입이 없다(D-R3-10, D-R9-04).

### 기능 규칙과 상태(확정)

- 가게는 별도 route가 아니라 Trip 안의 영역이다. 외관과 메모는 카메라 배너뿐 아니라 Trip의 해당 영역에서도 추가·수정한다. 메모는 F-03 시트를 재사용한다(D-R2-07, D-R2-08, D-R9-04).
- 과거 가게 외관 촬영은 대상 가게를 유지한 채 카메라를 연다. 쇼핑 모드를 새로 켜지 않으며 셔터 때만 현재 위치를 1회 취득한다. 위치 권한 거부·취득 실패는 저장 실패로 안내하고 재촬영을 허용한다. 현재 쇼핑 가게·연속 위치 기록은 바꾸지 않는다(D-R11-01).
- 모든 trip·가게·사진은 오프라인 탐색 가능하다. trip/가게/사진이 없으면 빈 상태를 보여 주고 샘플로 채우지 않는다. 외관 없음·묘사 대기/실패는 F-04 상태를 그대로 사용한다(D-R3-03, D-R6-03, D-R9-04).
- 사진 선택은 `Trips → Trip → Pick`이며 Visit을 거치지 않는다. 피팅에서 시작한 탐색도 동일하고, 선택 완료 후 자동 저장/조합 복귀는 F-11을 따른다(D-R4-08, D-R9-04).
- 길 안내는 Item과 Result에서만 시작한다. Trip의 가게에서 사진/옷을 먼저 선택해 길 안내하는 별도 경로는 만들지 않는다(D-R9-04).
- trip 삭제와 사진 단위 삭제를 제공한다. 사진 삭제는 [F-08](search.md#f-08-옷-후보-선택)과 연결한다. trip 삭제는 관련 `Shop`, `Photo`, `PhotoEmbedding`, `TrailPoint`를 지우되 저장한 Piece의 조각과 `walkTo`는 남기고 원본 참조만 끊는다(D-R3-11).

### 화면 배치·문구

- 홈은 최근 trip 하나와 "All trips"를 유지한다. 가게별 외관·시각·설명/상태·사진 수·사진 목록을 Trip에 통합한다. 홈 가게 선택 시 Trip 해당 위치로 스크롤하는 상세 배치는 **프로토타입 세션에서 확정**한다(D-R3-10, D-R9-04).
- "Note", 메모가 있을 때의 "Edit", 없을 때의 "Add note", "Photos", 외관 없는 경우 "No storefront photo"는 유지한다. 큰 외관과 묘사·메모 편집·사진을 Trip 안에서 어떻게 배치할지는 **프로토타입 세션에서 확정**한다(D-R1-03, D-R9-04).
- 기록 중 "Your location trail is recorded while shopping mode is on."은 유지한다. 종료 후 원본 trail 삭제와 가게·사진 위치 보존 설명, 빈 상태·삭제 확인·완료 후 복귀의 새 문구는 **프로토타입 세션에서 확정**한다(D-R0-03, D-R3-03, D-R3-11).
- **프로토타입 초안:** "All trips"는 날짜별로 시간 범위·가게/사진 수와 "Recording" 배지를 표시하며 빈 상태는 "No trips yet…"다. Trip의 "Delete trip" → "Delete this trip?" 확인 → "Trip deleted · saved pieces kept" 토스트를 제공한다. 배치·문구는 **프로토타입 화면 세션에서 확정**한다(D-R3-03, D-R3-10, D-R3-11).

### 실제 구현

- Trip ID와 필요하면 가게 ID를 전달해 해당 가게 영역으로 이동한다 [추론]. `Shop` 데이터 엔티티는 유지하지만 `visit` UI route는 만들지 않는다. 로컬 DB·파일 삭제와 활성 trip 삭제 처리는 [data-model](../contracts/data-model.md), [device-modules](../contracts/device-modules.md)을 따른다(D-R3-11, D-R9-04).

### 프로토타입

- All trips → Trip → Pick이며 Visit route는 없다. Trip의 가게별 외관/없는 상태·묘사 상태·NoteSheet 메모 수정·사진 그리드와 trip 삭제가 메모리 store에 연결됐다. 삭제 후 저장 조각과 목적지는 남고 원본 링크는 사라진다. Trip에는 길 안내 버튼이 없다(D-R3-11, D-R9-04).

## 프로토타입과의 차이

- 실제 권한, 알림, 위치 서비스, CameraX, 전용 저장소, 묘사 API, 갤러리 파일 저장은 연결하지 않고 화면과 상태만 시뮬레이션한다. 최근 앱 목록 제거 후 복원도 실제 구현 항목이다.
- 자동 가게 구분과 쇼핑 사진 가져오기는 제외됐다(D-R2-03, D-R2-09).
- DAT Mock 글래스 캡처는 제외됐다(D-R2-06).

## 프로토타입 미반영

시작마다 trip 생성·다중 trip 탐색·사진 추가/삭제·외관 대기 상태·Trip 통합은 화면과 메모리 상태에 반영됐다(D-R3-03, D-R3-10~11, D-R6-03, D-R9-04). 아래는 실제 구현의 차이만 남긴다.

| 결정 ID | 남은 실제 구현 | 현재 프로토타입 |
| --- | --- | --- |
| D-R2-01, D-R2-05, D-R2-10~11 | 실제 권한·FGS 알림·GPS·카메라·파일 저장·종료 후 복원 | OS UI와 위치를 시뮬레이션 |
| D-R3-03, D-R3-11 | trip/Photo 영속 저장과 실제 파일·임베딩 삭제 | 메모리 항목 추가/삭제 |
| D-R2-04, D-R6-03 | Spark 외관 묘사·영속 오프라인 작업·실제 통신 실패 처리 | 상태와 대기열은 있으나 샘플·타이머 처리 |
| D-R7-10 | CameraX debug 전용 adb fixture 셔터 | 샘플 순환으로 Photo 항목 추가 |

가게 메모의 Spark 방문 요약 포함은 R3에서 확정됐으며 검색 문서의 [F-06](search.md#f-06-에이전트-사진-검색)에서 다룬다(D-R3-04). 이 문서에 미정으로 남기지 않는다.
