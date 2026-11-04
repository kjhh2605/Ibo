# 데이터 모델 계약

상태: R0~R9 결정 반영(R8 제출 결정은 저장 계약과 무관). S06의 구현 계약이며 프로토타입 타입을 DB 스키마로 사용하지 않는다. 제품 결정은 [결정 로그](../decisions.md), 플러그인 입출력은 [device-modules.md](device-modules.md)를 따른다. 이 문서의 저장 형식·수치 제한·삭제 시 참조 처리 세부는 별도 표시가 없으면 **[추론] 구현 기본값**이며 사용자 인터뷰에서 합의한 성능·품질 수치가 아니다. (D-R0-01, D-R7-04, D-R9-01~04)

## 1. 공통 타입과 저장 원칙

| 타입/규칙 | 계약 | 근거 |
| --- | --- | --- |
| `Id` | 비어 있지 않은 불투명 문자열, 최대 128자. 일반 레코드는 UUID, Piece는 아래 중복 규칙의 결정적 ID. 표시 이름과 ID를 혼용하지 않는다 | D-R3-03, D-R7-04 |
| `Time` | UTC Unix epoch 밀리초인 안전한 정수, 0 이상. 영어 표시 날짜·시간은 UI에서 변환 | D-R3-03 |
| 좌표 | WGS84, `lat` 유한수 -90~90, `lng` 유한수 -180~180, `accuracyM` 유한수 0 이상. 구조체 자체와 구성 필드 모두 필수 | D-R2-07, D-R5-01 |
| `File` | 앱이 발급한 앱 전용 파일 URI. 임의 외부 경로·HTTP URL은 거부. JS 표시는 Capacitor 변환 URL을 쓰되 DB에는 원래 URI 저장 | D-R2-05, D-R0-02 |
| `Mask` | 정방향 원본 이미지와 같은 w×h의 8-bit grayscale PNG 파일 URI, 바깥=0/안=255. Candidate는 캐시, SelfPhoto.headMask는 영구 파일 | D-R7-01, D-R3-02 |
| `BBox` | `[x,y,w,h]`, 정방향 원본 사진의 픽셀 단위 정수. x/y≥0, w/h≥1, x+w≤Photo.w, y+h≤Photo.h. 프로토타입의 퍼센트 xywh와 다름 | D-R3-02, D-R7-04 |
| null | 아래 표의 `예`만 SQL NULL/TS `null` 허용. 읽기 DTO는 nullable 필드를 생략하지 않고 null 반환. 골격의 `?`는 이 의미 | D-R7-04 |
| DB | Java SQLiteOpenHelper, `street-fitting.db`, `PRAGMA foreign_keys=ON`, 단일 직렬 writer. 구조체는 열로 평탄화하고 DTO에서 원래 이름으로 복원. vector는 little-endian float32 BLOB | D-R7-03, D-R7-04 |
| 개인정보 | Android Auto Backup/기기 이전에서 DB·미디어·캐시 제외(`allowBackup=false`와 dataExtractionRules). 원본 본인 사진·headMask·임베딩·trail은 업로드 API 입력으로 노출하지 않음 | D-R0-02, D-R6-04 |

## 2. 엔티티와 필드

각 표는 **필드 / 타입·키 / null / 제약 / 근거** 순서다. 아래 11개가 제품 엔티티 전부이며 Shopping, outfit, 권한 상태는 엔티티가 아닌 파생/화면 상태다. (D-R3-03, D-R4-07, D-R7-04)

### Trip

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | 쇼핑 모드 시작 1회당 1개 | D-R3-03 |
| startedAt | Time | 아니오 | 시작 트랜잭션 시각 | D-R3-03 |
| endedAt | Time | 예 | recording이면 null, ended이면 startedAt 이상 | D-R0-03 |
| status | string | 아니오 | `recording` 또는 `ended`; recording은 DB 전체 최대 1개(부분 unique index) | D-R2-11 |

### TrailPoint

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| tripId | Id FK Trip, 복합 PK | 아니오 | recording인 trip만 삽입, ON DELETE CASCADE | D-R0-03 |
| t | Time, 복합 PK | 아니오 | tripId+t 유일; 동일 밀리초 중복 fix는 최신 값으로 대체 | D-R2-11 |
| lat / lng | number | 아니오 | 공통 좌표 범위 | D-R0-03 |
| accuracyM | number | 아니오 | 공통 좌표 범위 | D-R0-03 |

### Shop

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | 독립 ID, `n`과 다름 | D-R2-07 |
| tripId | Id FK Trip | 아니오 | ON DELETE CASCADE | D-R3-11 |
| n | integer | 아니오 | trip 안에서 1부터 증가, UNIQUE(tripId,n); 삭제 번호 재사용 안 함 | D-R2-07 |
| startedAt | Time | 아니오 | trip.startedAt 이상 | D-R2-07 |
| spot | `{lat,lng,accuracyM}` | 아니오 | New shop 당시 위치; 길 안내 목적지로 대체 사용 금지 | D-R2-07, D-R5-01 |
| storefrontPhotoId | Id FK Photo | 예 | 같은 shop의 kind=storefront 사진, ON DELETE SET NULL | D-R2-04 |
| description | string | 예 | 영어 1~300자; done일 때 필수, 그 외 null | D-R2-04 |
| descriptionState | string | 아니오 | `none` / `pending` / `done` / `failed`. 초기 none | D-R2-04, D-R6-03 |
| note | string | 예 | trim 후 1~280자, 빈 입력=null. 방문 요약에 포함 | D-R2-08, D-R3-04 |

`spot_lat/spot_lng/spot_accuracyM`으로 저장한다. 새 외관 사진 선택 시 이전 description을 지우고 pending으로 바꾼다. 묘사 응답의 refId가 현재 storefrontPhotoId와 같을 때만 반영한다. (D-R2-04, D-R6-03)

### Photo

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | 촬영별 새 ID | D-R2-05 |
| tripId | Id FK Trip | 아니오 | ON DELETE CASCADE | D-R3-11 |
| shopId | Id FK Shop | 아니오 | 같은 trip의 shop, ON DELETE CASCADE | D-R2-03 |
| kind | string | 아니오 | `item` / `storefront` | D-R2-04 |
| takenAt | Time | 아니오 | 셔터 시각, fixture 파일의 EXIF 날짜를 쓰지 않음 | D-R7-10 |
| location | `{lat,lng,accuracyM}` | 아니오 | 촬영 시각에 연결한 위치를 복사. trail 삭제 후에도 유지 | D-R0-03, D-R5-01 |
| file | File | 아니오 | 정방향으로 정규화한 JPEG/PNG, 앱 전용 영구 파일 | D-R2-05 |
| w / h | integer | 아니오 | 1 이상; 정규화 파일의 실제 픽셀 수 | D-R2-05 |
| indexState | string | 아니오 | `pending` / `done` / `failed`; 초기 pending | D-R1-01 |

갤러리에서 선택한 옷장·본인 원본은 Photo 테이블에 넣지 않는다. `Photo`는 위치를 갖는 쇼핑 기록만 의미한다. 사진 검색 기본 집합은 kind=item이며 외관 사진도 한 번 색인하되 가게 설명 용도와 구별한다. (D-R2-09, D-R4-02, D-R3-03)

### PhotoEmbedding

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| photoId | Id PK/FK Photo | 아니오 | ON DELETE CASCADE; 사진당 성공 레코드 1개 | D-R1-01 |
| model | literal | 아니오 | `pe-core-t16-image` | D-R1-01 |
| dim | integer | 아니오 | 정확히 512 | D-R1-01 |
| vector | float32[512] | 아니오 | 유한수, L2 정규화(허용 오차 1e-4), BLOB 정확히 2,048바이트 | D-R1-01 |

embedding 삽입과 Photo.indexState=done을 한 트랜잭션으로 처리한다. failed/pending이면 embedding 없음. 검색 범위 안 pending은 최대 30초 완료를 기다리고, failed 또는 시간 초과는 index_unavailable로 반환한다. 사진을 조용히 제외하거나 가짜 벡터로 채우지 않는다. UI 수동 탐색은 항상 허용한다. (D-R3-06, D-R6-03)

### Candidate (화면 캐시)

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id 캐시 키 | 아니오 | 동일 photo+source+이진 mask에 대해 안정적 ID; 같은 응답 재표시로 새 ID 생성 안 함 | D-R3-02, D-R3-11 |
| photoId | Id | 아니오 | 쇼핑 Photo.id 또는 옷장 import의 임시 asset ID. 후자는 DB FK가 아님 | D-R4-08 |
| source | string | 아니오 | `sam` / `edgetam` | D-R3-02 |
| label | string | 아니오 | 영어 1~120자; 검색 concept가 있으면 사용, 검색 없는 직접 탭/옷장 초기값은 `"Picked item"` | D-R4-06, D-R9-02 |
| score | number | 아니오 | 유한수 0~1, 모델 예상 품질 점수. 사용자 확률로 표현 안 함 | D-R3-02 |
| mask | Mask | 아니오 | 원본 해상도 PNG; 릴레이 PNG(base64)는 수신 시 파일로 저장하고 필요하면 nearest-neighbor로 원본 크기에 복원 | D-R3-02 |
| bbox | BBox | 아니오 | mask의 tight box, 원본 픽셀 xywh. 릴레이 전송 이미지 좌표를 원본 해상도로 환산 | D-R3-02 |

점수 내림차순, 동점은 id 오름차순. 상위 3개와 `"Show all"`만 있고 PE 점수나 카테고리로 후보를 제거하지 않는다. 화면 이탈 시 mask 캐시 제거하되 진행 중 Piece 저장은 완료 후 제거한다. (D-R3-02)

### Piece

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | 중복 저장 규칙의 결정적 ID | D-R3-11, D-R4-08 |
| origin | string | 아니오 | `shop` / `wardrobe`, 생성 후 불변 | D-R4-08, D-R4-09 |
| label | string | 아니오 | 영어 1~120자, 사용자 수정 가능 | D-R4-06 |
| category | string | 아니오 | 자유 영어 명사구 1~64자. 미분류 초기값 `"unknown"`; enum/PE 분류기 없음 | D-R4-06 |
| cutoutFile | File | 아니오 | bbox 크기의 투명 RGBA PNG, 실제 mask를 적용한 독립 파일 | D-R3-11 |
| createdAt | Time | 아니오 | 첫 저장 시각, 중복 저장으로 변경 안 함 | D-R4-08 |
| photoId | Id FK Photo | 예 | shop 생성 시 필수, 원본 삭제 후 null, ON DELETE SET NULL | D-R3-11 |
| shopId | Id FK Shop | 예 | shop 생성 시 필수, trip 삭제 후 null, ON DELETE SET NULL | D-R3-11 |
| tripId | Id FK Trip | 예 | shop 생성 시 필수, trip 삭제 후 null, ON DELETE SET NULL | D-R3-11 |
| walkTo | `{lat,lng}` | 예 | shop이면 필수이며 Photo.location 복사; wardrobe면 null. 사진/trip 삭제로 변경 안 함 | D-R3-11, D-R5-01 |

wardrobe의 photoId/shopId/tripId는 모두 null. shop의 참조가 남아 있을 때 같은 trip/shop 관계여야 한다. trip 사진을 피팅 화면에서 바로 잘라 저장하면 origin=shop으로 생성하고 saved 목록에 즉시 포함한다. (D-R4-08)

### SelfPhoto (singleton)

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| file | File | 아니오 | 얼굴 포함 정방향 원본, 전송 금지 | D-R0-02 |
| headMask | Mask | 아니오 | FaceMask 성공 산출물, 머리카락 여유 영역 포함 | D-R7-01 |
| maskedFile | File | 아니오 | 머리 제거+EXIF 제거 완료본, 유일하게 전송 허용 | D-R4-03, D-R4-11 |
| updatedAt | Time | 아니오 | 성공 등록/교체 시각 | D-R4-02 |

SQL 내부 singleton key는 `CHECK(key=1)`이며 제품 DTO에 id를 추가하지 않는다. 새 사진 마스킹 성공 후 세 파일을 함께 교체한다. 실패하면 기존 정상 SelfPhoto를 유지하고 새 임시 원본을 지운다. 진행 중 피팅은 이전 버전을 잡고 있어도 업로드는 이미 만든 maskedFile만 허용하며 원본은 로컬 재합성 종료까지 참조 카운트로 유지한다. (D-R4-02, D-R4-11)

### Result

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | prepareResult의 draftId로 발급하고 성공 확정 시 그대로 사용; 같은 draft 재저장은 같은 Result 반환 | D-R4-05, D-R9-03 |
| targetPieceId | Id 논리 참조 | 아니오 | 요청 시작 시 존재하는 origin=shop Piece. 삭제와 결과는 독립이므로 SQL FK로 묶지 않음; 이후에는 이력/Change pieces 활성 판단에만 사용 | D-R4-09, D-R9-03 |
| companionPieceIds | Id[] | 아니오 | 순서 유지, 0~5개, 중복 및 target ID 금지. DB JSON 배열, 요청 시작 시 모두 존재 | D-R4-07, D-R9-03 |
| targetSnapshot | ResultPieceSnapshot | 아니오 | 대상 옷의 불변 복사본, pieceId=targetPieceId, origin=shop, walkTo 필수 | D-R9-03 |
| companionSnapshots | ResultPieceSnapshot[] | 아니오 | companionPieceIds와 같은 길이·순서·pieceId. 0~5개, 각각 독립 복사본 | D-R9-03 |
| file | File | 아니오 | 로컬 재합성 또는 얼굴 제거 결과 파일, providerFile과 별도 | D-R4-04 |
| faceless | boolean | 아니오 | 얼굴 재합성을 쓰지 않은 최종 표시본이면 true | D-R4-04 |
| providerFile | File | 아니오 | Muse Image 원본 바이트와 메타데이터를 변경 없이 보관 | D-R4-10 |
| createdAt | Time | 아니오 | 생성 성공 시각 | D-R4-05 |

Result는 렌더링과 길 안내에 원본 Piece 조회를 요구하지 않는다. 대상 삭제 후에도 targetSnapshot.walkTo로 안내하고 결과 이미지를 표시한다. 원본 targetPieceId가 없으면 `"Change pieces"`만 비활성화한다. 함께 입은 옷의 위치로 안내하지 않는다. Item과 Result에서만 길 안내를 시작하며 Trip/Shop.spot에서 시작하는 경로는 없다. (D-R9-03~04, D-R5-03)

#### ResultPieceSnapshot — Result에 포함되는 값 객체

별도 제품 엔티티나 원본 FK가 아니다. 아래 구조를 Result의 JSON 열에 저장하되 파일은 Result가 독점 소유한다. 파일 복사본은 원본 Piece/Photo의 symlink·동일 URI가 아니며 원본 삭제와 독립적이다. (D-R9-03)

| 필드 | 타입 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| pieceId | Id | 아니오 | 복사 당시 Piece.id, 이후 참조 유효성 요구 없음 | D-R9-03 |
| origin | string | 아니오 | `shop` / `wardrobe` | D-R9-03 |
| label / category | string | 아니오 | Piece와 같은 1~120 / 1~64자 제한, 복사 당시 값 고정 | D-R9-03 |
| cutoutFile | File | 아니오 | Result 소유 RGBA PNG 복사본 | D-R9-03 |
| walkTo | `{lat,lng}` | 예 | shop이면 Piece.walkTo 복사, wardrobe면 null. 대상에서는 항상 필수 | D-R9-03~04 |
| shop | `{n,startedAt,storefrontFile,description,note}` | 예 | 복사 당시 연결 Shop이 있으면 아래 표시 정보 복사. wardrobe 또는 이미 trip이 삭제된 Piece면 null. 위치를 Shop.spot로 보완하지 않음 | D-R9-03~04 |
| shop.n / shop.startedAt | integer / Time | 아니오 | n≥1, 표시명은 `"Shop N"`. 날짜/시각 표시용 방문 시각 | D-R9-03 |
| shop.storefrontFile | File | 예 | 외관 사진이 있으면 Result 소유 파일로 복사, 없으면 null | D-R9-03 |
| shop.description / shop.note | string | 예 | Shop과 같은 1~300 / 1~280자 제한, 복사 당시 값 또는 null | D-R9-03 |

피팅 요청 시작 전에 `Store.prepareResult`가 ID 유효성을 확인하고 대상·동반 옷과 가게 표시 정보를 일관된 snapshot으로 고정하며 cutout/외관 파일 복사를 완료한다. 요청 진행 중 원본 삭제·이름 변경이 발생해도 이 snapshot을 쓴다. 성공 시 `saveResult`가 초안 파일을 Result 디렉터리로 승격하고 JSON과 결과 파일 참조를 원자 저장한다. 취소/실패/프로세스 종료로 결과가 없는 초안 파일은 회수한다. snapshot에 원본 사진·Shop.spot·본인 사진을 추가하지 않는다. (D-R9-03, D-R3-11)

### QueueJob

| 필드 | 타입·키 | null | 제약 | 근거 |
| --- | --- | --- | --- | --- |
| id | Id PK | 아니오 | 작업별 새 ID | D-R6-03 |
| kind | string | 아니오 | `describe_storefront` / `label_piece` | D-R6-03 |
| refId | Id 논리 참조 | 아니오 | describe_storefront는 Photo.id, label_piece는 옷장 또는 검색 없이 바로 자른 shop Piece.id; UNIQUE(kind,refId) | D-R2-04, D-R9-02 |
| attempts | integer | 아니오 | 0 이상, 실제 HTTP 시도 때만 증가 | D-R6-03 |
| nextAt | Time | 아니오 | 다음 시도 가능한 시각; 최초 즉시 실행 시각 | D-R6-03 |

## 3. 저장 위치와 기기 밖 경계

| 데이터 | 저장 위치 | 기기 밖으로 나가는 것 | 근거 |
| --- | --- | --- | --- |
| Trip / Shop | SQLite | 불투명 참조, 방문 순서·시간·외관 설명·메모는 Spark 방문 요약. spot 좌표는 요약에 없음 | D-R3-04, D-R6-04 |
| TrailPoint | SQLite, recording 동안만 | 없음. 로그에도 없음 | D-R0-03, D-R6-04 |
| Photo | SQLite 메타데이터 + `files/photos/<id>.*` | 선택 사진 최대 3장은 SAM, 외관은 Spark. 전송 복사본 EXIF 제거, location 열은 이미지 요청에 넣지 않음 | D-R3-01, D-R2-04 |
| PhotoEmbedding | SQLite BLOB | 없음. 앱이 계산한 참조/점수만 도구 결과로 보냄 | D-R1-02 |
| Candidate | 메모리 DTO + `cache/candidates/` PNG | 없음. SAM 후보는 수신 데이터이며 Spark에는 후보 수·최고 점수만 반환 | D-R1-02, D-R3-02 |
| Piece | SQLite + `files/pieces/<id>.png` | 선택 cutout은 Muse Image, wardrobe 및 검색 없이 바로 자른 shop cutout은 Spark 이름 붙이기. walkTo는 길 안내 때만 릴레이→OSRM | D-R4-06~09, D-R9-02, D-R5-01 |
| 옷장 import 원본 | `cache/imports/` | 없음. 잘라낸 Piece 저장 후 제거 | D-R2-09, D-R4-06 |
| SelfPhoto | singleton SQLite + `files/self/` | maskedFile만 Muse Image. file/headMask는 네트워크 경로 없음 | D-R4-02~04, D-R4-11 |
| Result | SQLite + `files/results/<id>/`: 결과 file/providerFile, `snapshots/target/cutout.png`, `snapshots/companions/<index>/cutout.png`, 각 snapshot의 `storefront.*` 선택 복사본 | 이미지 자동 재전송 없음. targetSnapshot.walkTo는 길 안내 때 릴레이→OSRM. resultDownload 승인 전 갤러리 내보내기 없음 | D-R4-10, D-R9-03~04 |
| QueueJob | SQLite | 실행 시 해당 외관/옷 cutout만; job 자체는 전송 안 함 | D-R6-03 |
| Voice WAV / 경로 | `cache/voice/` / 메모리 | WAV→전사, 현재 위치+목적지→route, 지도 영역→OpenFreeMap. 전사 종료/실패/취소 시 WAV 삭제 | D-R3-07, D-R5-04, D-R6-04 |

DB와 앱 전용 파일을 갤러리에 자동 등록하지 않는다. Photo의 명시적 다운로드는 EXIF GPS 없는 별도 복사본이다. 사용자가 이미 내려받은 갤러리 파일은 앱 내 삭제 연쇄의 대상이 아니다. (D-R2-05, D-R2-11)

## 4. 생명주기·삭제 연쇄

| 동작 | DB 변화 | 파일/캐시/작업 변화 | 남는 것 | 근거 |
| --- | --- | --- | --- | --- |
| 쇼핑 종료 | Trip ended+endedAt, 해당 TrailPoint 전부 삭제 | 서비스·위치 구독·상시 카드 종료 | Trip/Shop/Photo/Embedding, 외관·메모, Piece/Result 및 묘사 대기열 | D-R0-03, D-R2-11 |
| Trip 삭제 | recording이면 먼저 같은 종료 절차; Trip/Shop/Photo/Embedding/TrailPoint 삭제; Piece의 photoId/shopId/tripId null | 해당 원본 사진/후보 파일, 외관 QueueJob 삭제 | Piece.cutoutFile+walkTo, Result 전체와 그 snapshot 파일·가게 표시 정보, 무관한 trip | D-R3-11, D-R9-03 |
| Photo 삭제 | Photo+Embedding 삭제; Piece.photoId=null; 현재 storefront면 Shop.storefrontPhotoId=null, description=null, state=none | 원본 사진·후보 mask·해당 외관 job 삭제 | Piece.cutoutFile/나머지 참조/walkTo, Shop, Result의 외관 복사본 포함 전체 snapshot | D-R3-11, D-R9-03 |
| Piece 삭제 | Piece 삭제; Result의 논리 ID와 snapshot 유지 | Piece 원본 cutout, label job, 화면 선택에서 제거 | Result 파일·snapshot·길 안내 유지; target 삭제 시 `"Change pieces"`만 비활성 | D-R3-11, D-R9-03 |
| Result 삭제 | Result 및 포함 snapshot JSON 삭제 | file/providerFile와 대상·동반 cutout/외관 snapshot 복사본 모두 삭제 | 원본 Piece/Photo/Shop, SelfPhoto, 다른 Result의 복사본 | D-R3-11, D-R9-03 |
| SelfPhoto 교체 | 성공 시 singleton 원자 교체 | 이전 3개 파일은 진행 중 로컬 재합성 종료 후 삭제 | 이미 생성한 Result | D-R4-02 |
| 후보 화면 닫기 | 영구 DB 변화 없음 | 참조 없는 Candidate/mask/import 캐시 삭제 | 이미 저장한 Piece | D-R3-02, D-R4-08 |
| 외관 교체 | 새 storefrontPhotoId, pending, description=null | 이전 외관 job 취소, 새 job 삽입. 이전 Photo는 기록에 남음 | 이전 사진은 사용자 Photo 삭제로만 제거 | D-R2-04, D-R3-11 |

[추론] DB 트랜잭션을 먼저 확정하고, 파일 삭제는 참조 없는 경로만 수행한다. 파일 생성은 임시 파일→원자 rename→DB commit 순서이며 실패 시 생성 파일을 회수한다. 크래시 후 앱 시작 시 DB에서 참조되지 않는 앱 관리 파일만 회수한다. 삭제 도중 도착한 네트워크/색인 응답은 ref 존재와 최신 storefrontPhotoId를 재확인해 삭제한 데이터를 되살리지 않는다. (D-R3-11, D-R6-03)

## 5. 저장·피팅 불변식

- **같은 후보 두 번 저장 금지:** [추론] Candidate.id=`SHA-256(photoId + source + 정방향 이진 mask 픽셀)`의 안정적 문자열, Piece.id=`piece:<Candidate.id>`. label/score/bbox 표시 변화는 동일 후보 ID에 영향 없음. `saveCandidate`는 insert-if-absent 후 기존 Piece를 반환하여 파일·라벨 작업을 중복 생성하지 않는다. 후보 ID 생성 시 본인 사진 입력은 금지한다. 같은 옷을 다른 사진에서 잘랐거나 다른 mask를 골랐으면 다른 후보이며 의미 기반 중복 검출은 없다. (D-R4-08, D-R3-11)
- 피팅 draft는 `{targetPieceId, companionPieceIds}`인 메모리 상태이며 별도 영구 엔티티가 아니다. target은 존재하는 origin=shop 1개, companions는 origin=shop/wardrobe 0~5개, 중복/target 재선택 금지다. 제출 시 다시 존재를 확인한다. 전송은 SelfPhoto.maskedFile 1장 + 옷 1~6장 = 2~7장이다. (D-R4-07~09)
- trip 사진에서 즉석으로 자르면 Piece 저장이 완료된 뒤 companion에 넣는다. 저장 취소/실패는 companion에 추가하지 않는다. 최대 5개가 찼으면 추가 전에 알리고 임의 기존 항목을 교체하지 않는다. (D-R4-08)
- 검색 concept가 있는 shop label은 concept를 쓴다. 검색 없이 바로 자른 shop 및 wardrobe는 `"Picked item"`/`"unknown"`으로 먼저 저장하고 둘 다 label_piece로 `/v1/describe/piece`에 cutout을 보낸다. source=edgetam이어도 검색 concept가 있는 흐름이면 자동 이름 붙이기를 추가하지 않는다. 이름 붙이기 여부는 표시 문자열 비교가 아니라 saveCandidate의 `labelMode`로 전달한다. 사용자가 label/category를 고치면 해당 대기 작업을 취소해 늦은 응답이 수정을 덮지 않도록 한다. (D-R4-06, D-R6-03, D-R9-02)
- **기능 플래그 `resultDownload: boolean = false`**. 앱 빌드/런타임 개발 설정이며 DB 제품 엔티티가 아니다. S11에서 원본 워터마크·provenance 메타데이터 보존 검증을 승인한 설정에만 true를 허용한다. false면 UI와 Media 호출 양쪽에서 결과 내보내기를 차단한다. 일반 Photo 다운로드에는 이 플래그를 적용하지 않는다. (D-R4-10, D-R2-11)

## 6. 오프라인 대기열

저장·재시도·foreground worker 루프 및 describe_storefront/label_piece HTTP handler는 모두 S06 소유다. 네이티브 Store와 `app/src/native/store.ts`, `app/src/data/**`를 같은 슬라이스가 구현하며 S07 에이전트 루프에 큐 worker를 두지 않는다. (D-R6-03, D-R7-04)

1. 외관 Photo 저장과 해당 QueueJob 삽입, wardrobe 또는 검색 없이 바로 자른 shop Piece 저장과 label_piece 삽입은 각각 같은 DB 트랜잭션이다. 연결이 없어도 저장은 성공이고 이름 대기 중에는 `"Picked item"`이다. (D-R2-04, D-R6-03, D-R9-02)
2. [추론] 앱 foreground+온라인에서 단일 worker가 nextAt≤now인 작업을 시각/id 순으로 한 번에 1개 실행한다. 시작·재연결·새 job 삽입·다음 nextAt 도달 때 깨운다. 네트워크 미연결은 attempts를 올리지 않는다. 서비스가 살아 있어도 별도 백그라운드 업로드를 보장하지 않으며 앱을 다시 열면 재개한다. (D-R6-03)
3. [추론] HTTP 시도 직전에 attempts를 증가시키고 잠정 nextAt을 `now + min(300000, 5000 * 2^min(attempts-1,6))` ms로 DB에 확정한다. retryable 오류/timeout/연결 단절이면 이 시각에 재시도한다. 횟수 상한은 없고 최대 간격 5분이며 reconnect가 이미 미래인 nextAt을 앞당기지는 않는다. auth는 인증 갱신 후 동일 정책, Retry-After가 더 늦으면 그 시각을 따른다. (D-R6-03)
4. 성공 시 참조가 아직 유효한 경우에만 label/category 또는 description+done을 반영하고 job을 삭제한다. 삭제·교체된 ref면 결과를 폐기하고 job 삭제. 비재시도 오류이면 job을 삭제하고 외관은 failed, label_piece 대상 Piece는 현재 label/category를 유지한다. 외관 재시도/이름 재요청은 새 job(attempts=0)을 만드는 명시 동작이다. 진행 중 동일 ref job의 중복 dispatch를 금지한다. (D-R2-04, D-R4-06, D-R6-03, D-R9-02)
5. 검색·피팅·음성·길 안내는 이 대기열에 넣지 않는다. 오프라인을 알리고 사용자에게 다시 시도하게 한다. 자동 재생성/재과금은 없다. (D-R6-03)

## 7. 스키마와 구현 경계

[추론] 초기 `PRAGMA user_version=1`; 버전 상승마다 순차·트랜잭션 마이그레이션을 적용하고 실패 시 기존 데이터를 보존하며 destructive reset을 금지한다. Candidate 캐시는 마이그레이션 대상이 아니다. (D-R3-11, D-R7-04)

S06은 위 null/범위/unique/FK 제약, 중복 저장, 종료 시 trail 삭제, trip/photo/piece/result 삭제 연쇄, 큐 복구를 검증할 수 있도록 fixture를 제공한다. 이 문서 작성 단계에서는 코드·빌드·테스트를 실행하지 않았다. (D-R1-04, D-R7-04)

## 8. 프로토타입 대응표 — 참고용, 마이그레이션 원본 아님

근거 파일: `prototype/src/data.ts`, `prototype/src/state.tsx`. 이 파일들은 샘플·타이머·메모리 상태만 포함하며 실제 DB를 생성하지 않는다. 아래 차이는 프로토타입 미반영 사항이다. (D-R1-03, D-R7-04)

| 프로토타입 | 실제 구현 | 차이·주의 | 근거 |
| --- | --- | --- | --- |
| data.ts `Box=[x,y,w,h]` 퍼센트 | Candidate.bbox 원본 픽셀 xywh + mask PNG | box는 자르기 근거가 아니고 mask가 근거 | D-R3-02 |
| Candidate `{id,label,score,box}` | Candidate 전체 | photoId/source/mask 추가, DB 영구 목록 아님 | D-R3-02 |
| Photo `src,shop,time,candidates` | file, shopId, takenAt; Candidate 별도 | 실제 tripId/kind/location/indexState 필요, 문자열 time 금지 | D-R2-05, D-R3-03 |
| Shop `n,name,time,spot.latitude/longitude` | id/tripId/n/startedAt/spot.lat,lng,accuracyM | name/time은 파생 표시, 번호는 trip마다 1부터 | D-R2-07, D-R3-03 |
| Shop `storefront`, `descriptionDueAt` | storefrontPhotoId, descriptionState, QueueJob | 타이머 묘사 없음; 실패/오프라인 상태 명시 | D-R2-04, D-R6-03 |
| Shop `photoCount,captured,distance,walk` | 사진 count와 경로 응답에서 파생 | 샘플 거리/카운트를 DB 원장으로 쓰지 않음 | D-R5-04 |
| Piece `src,w,h,box,from,shop` | cutoutFile, origin, shopId, category, walkTo | 원본 이미지 crop CSS 대신 실제 독립 cutout 파일 | D-R3-11, D-R4-06 |
| `pieceFrom`, `saved`, `wardrobe` | saveCandidate; origin으로 Piece 조회 | 안정 ID로 중복 억제, 저장은 DB commit 완료 기준 | D-R4-08 |
| state.tsx `Shopping {on,minutes,shop,photos,captured}` | Trip + 현재 Shop + 파생 count/elapsed | 권한·서비스 실제 상태는 ShoppingSession에서 복원 | D-R2-11 |
| `locationAllowed`, `notificationsAllowed` | Android 권한 API | useState를 권한 진실의 원본으로 쓰지 않음 | D-R2-10~11 |
| `outfit:string[]`, `MAX_PIECES=9` | targetPieceId + companionPieceIds(0~5) | 대상 shop 1벌, 총 6벌. 9벌 규칙 폐기 | D-R4-07~09 |
| Result `{id,pieces,at}` | Result 전체와 targetSnapshot/companionSnapshots | 결과 파일·불변 옷/가게 복사본·faceless·providerFile 영구 저장. 원본 옷 삭제와 독립 | D-R4-04, D-R4-10, D-R9-03 |
| Route `walk:{shop:number}`, `trip`, `visit:{shop:number}` | 길 안내 route는 Piece ID 또는 Result ID, 탐색 route는 Trip ID | Shop/Visit 화면 없음. 길 안내는 Item/Result에서만, Piece.walkTo 또는 targetSnapshot.walkTo 사용, Shop.spot 금지 | D-R9-03~04 |
| Route `send`, 제목 `"Before sending"` | 로컬 마스킹 성공 후 요청 진행 상태 | 전송 확인 화면 폐기. raw SelfPhoto를 route에 담지 않음 | D-R4-03 |
| SHOPS/PHOTOS/CAMERA_ROLL, answer() | fixture 또는 실제 촬영·모델·relay | production fallback으로 샘플 데이터를 섞지 않음 | D-R1-04, D-R7-10 |
