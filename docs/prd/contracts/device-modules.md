# 기기 모듈 계약

상태: R0~R9 반영(R8 제출 결정은 모듈 계약과 무관). S04·S05·S06·S08·S09·S10은 이 문서의 이름과 시그니처로 구현한다. 제품 엔티티 필드는 [data-model.md](data-model.md), HTTP wire 형식은 [relay-api.md](relay-api.md), 정책 근거는 [결정 로그](../decisions.md)에 있다. 아래 세부 메서드·수치·내부 상태는 **[추론] 구현 기본값**이다. 알고리즘 정확도와 앱 종단 성능은 **미확인**이며 연구 실측을 앱 검증 완료로 간주하지 않는다. (D-R1-04, D-R7-03~04, D-R9-01~04)

## 1. 공통 경계

- 네이티브 플러그인 이름은 정확히 `ShoppingSession`, `Capture`, `PhotoIndex`, `Segmenter`, `FaceMask`, `Media`, `Voice`, `Store`다. Java로 구현하고 Capacitor 8 `registerPlugin`의 web 구현을 모두 등록한다. UI는 React만 쓰고 native Activity를 화면 대신 띄우지 않는다. (D-R7-03)
- 아래 TS에서 `Trip`, `Shop`, `Photo`, `PhotoEmbedding`, `Candidate`, `Piece`, `SelfPhoto`, `Result`, `QueueJob`, `TrailPoint`는 data-model의 DTO다. `FileRef`는 앱이 발급한 로컬 URI이며 원시 바이트/base64를 bridge 이벤트로 반복 보내지 않는다. 원본 본인 사진은 업로드 helper의 허용 타입이 아니다. (D-R0-02, D-R4-11)
- 모든 메서드는 Promise, 실패는 `{code,message,retryable}`를 갖는 reject다. `message`는 UI 문구 계약이 아니며 UI가 code로 영어 문구를 선택한다. FaceMask의 정상 검출 실패만 `ok:false`로 반환한다. 공통 오류는 `invalid_argument`, `not_found`, `io_error`, `cancelled`, `busy`이며 개별 추가 코드는 각 절에 있다. 파일·좌표·이미지·음성은 오류/로그에 넣지 않는다. (D-R6-04)
- 읽기 결과는 snapshot이고 변경 성공 이벤트는 DB commit 뒤 발행한다. 이벤트 유실 시 `getState()`/Store 재조회로 복원한다. listener.remove는 idempotent다. 모든 모델 추론·파일·DB 작업은 UI thread 밖, CameraX bind와 WebView 배치만 main thread다. (D-R2-11, D-R7-03)

```ts
type Id = string;
type FileRef = string;
type Fix = {t:number; lat:number; lng:number; accuracyM:number};
type Point = {lat:number; lng:number};
type BBox = [x:number, y:number, w:number, h:number]; // 원본 픽셀
interface Listener {remove(): Promise<void>}
interface Events<E> {
  addListener<K extends keyof E & string>(name:K, fn:(event:E[K])=>void): Promise<Listener>;
}
type Asset = {id:Id; file:FileRef; w:number; h:number};
type Permission = 'prompt'|'granted'|'denied';
```

**Web mock 공통:** S08은 실제 Android/ONNX/마이크/위치/네트워크 없이 실행 가능해야 한다. 동일 TS 인터페이스, 동일 반환 구조와 이벤트 순서를 가진 `registerWebPlugin` 상당의 Capacitor web 구현을 사용한다. seed 이미지·mask·WAV·경로는 `verification/` fixture에서 공급하고, Blob URL은 런타임에만 사용한다. Store mock은 IndexedDB+Blob, 나머지는 그 Store를 공유한다. 성공/거부/실패/오프라인/권한/시간 진행을 테스트 설정에서 주입하고 앱 화면에 dev 표시를 넣지 않는다. 운영 환경의 실패를 성공 fixture로 바꾸지 않는다. 페이지 새로고침 시 DB 상태는 유지하되 실제 FGS 지속을 웹에서 보장한다고 주장하지 않는다. (D-R1-04, D-R7-07)

## 2. ShoppingSession — S04

**목적:** 앱 버튼으로 시작한 쇼핑 1회를 Trip으로 유지하고 수동 가게 구분·위치 기록·알림·복원을 담당한다. 자동 가게 감지, 헤즈업·체류·종료 알림은 없다. (D-R0-03, D-R2-01~03, D-R3-03)

```ts
type SessionState = {
  phase:'idle'|'requesting_location'|'requesting_notification'|'starting'|'recording'|'stopping';
  trip:Trip|null; shop:Shop|null;
  locationPermission:Permission; notificationPermission:Permission;
  photos:number; elapsedMinutes:number; latestFix:Fix|null;
};
interface ShoppingSession extends Events<{
  state:SessionState;
  location:Fix;
  notice:{code:'notification_unavailable'};
  open:{url:'streetfitting://home'|'streetfitting://capture'|'streetfitting://capture?newShop=1'};
  error:{code:'location_permission_denied'|'location_disabled'|'service_unavailable'; retryable:boolean};
}> {
  getState():Promise<SessionState>;
  start():Promise<SessionState>;
  newShop():Promise<Shop>;
  stop():Promise<{trip:Trip}>;
  openSettings():Promise<void>;
}
```

### 권한·시작 상태 머신

| 현재/입력 | 동작 및 다음 상태 | 실패/이벤트 | 근거 |
| --- | --- | --- | --- |
| idle + 앱 시작 버튼 | requesting_location, coarse+fine 함께 요청 | 설정에서 거부된 경우 재프롬프트 루프 없음 | D-R2-10 |
| 위치 권한 거부 | idle로 복귀, Trip/FGS/카메라 생성 안 함 | `location_permission_denied`; UI 이유 시트 + `"Open settings"` | D-R2-10 |
| 위치 허용 | requesting_notification, API 33+ POST_NOTIFICATIONS 요청. approximate도 허용하되 accuracyM 그대로 저장 | 위치가 켜져 있지 않으면 `location_disabled` | D-R2-10~11 |
| 알림 허용/거부 | 모두 starting. 거부해도 반드시 startForeground 호출 | 시작 성공 시 거부 세션당 notice 1회→UI `"Shopping started without a notification card."` 토스트 | D-R2-11 |
| starting | visible Activity에서 location FGS 시작, 첫 fix 확보, Trip+Shop 1+첫 TrailPoint 원자 생성 후 recording | fix 15초 대기 초과 `location_unavailable`; 서비스 정리, Trip 생성 안 함 | D-R2-07, D-R2-10 |
| recording + start | 현재 상태 반환(새 Trip 생성 안 함) | idempotent | D-R2-11 |
| recording + newShop | 최신 유효 fix 확보 후 같은 trip n+1 Shop 생성, state·알림 갱신 | 위치 없으면 `location_unavailable`, 이전 가게 유지 | D-R2-07 |
| recording + stop | stopping, 진행 중 셔터 저장을 끝낸 뒤 Trip ended+endedAt와 trail 삭제를 같은 transaction으로 확정, FGS 종료, idle | 파일/DB 실패 시 종료 성공으로 표시 안 함 | D-R0-03 |

알림 채널 전체 차단도 notification_unavailable이다. 위치 권한이 기록 중 철회되면 기록을 종료하고 trail을 삭제한 뒤 `error` 이벤트로 location_permission_denied를 전달한다(새 trip을 자동 시작하지 않음). 서비스 자체 오류도 error 이벤트를 사용하고 UI는 getState로 최종 snapshot을 다시 읽는다. [추론] (D-R2-10~11)


### Android 서비스·알림·복원

- Java `Service`, `FusedLocationProviderClient`, `foregroundServiceType="location"`, `android:stopWithTask="false"`, `exported=false`. 서비스가 DB/위치 subscription의 owner이고 Activity/WebView를 지워도 종료하지 않는다. 시작 후 OS 기한 안에 ongoing 알림과 `startForeground(..., FOREGROUND_SERVICE_TYPE_LOCATION)`를 호출한다. Manifest: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`. `ACCESS_BACKGROUND_LOCATION`·카메라 FGS·부팅 자동 시작은 추가하지 않는다. (D-R2-11, D-R7-03)
- [추론] 위치 기본값은 high accuracy, interval=10,000ms, minInterval=5,000ms, maxUpdateDelay=10,000ms. research §10의 5~10초 후보 중 배터리 우선 기본값이다. 위치·가게·촬영에 사용할 cached fix는 age≤15초, accuracyM≤100m만 허용하고 부족하면 `getCurrentLocation`으로 최대 15초 갱신한다. 설정 수치는 배터리/실내 GPS PoC로 조정 가능하며 실패 시 0,0이나 가게 위치를 대입하지 않는다. (D-R2-07, D-R2-10; research §10)
- 채널 ID `shopping_session`, 이름 `"Shopping mode"`, IMPORTANCE_LOW, 무음·진동 없음, onlyAlertOnce, ongoing. notification ID는 1개 고정. 상태 줄 `"Shop N · N photos · N min"`: N shop=현재 trip 번호, photos=현재 가게의 모든 item/storefront Photo 수, min=floor((now-trip.startedAt)/60000). 최초 recording·newShop·사진 추가/삭제·분 변경·Activity 복원 때 갱신한다. 현재 가게가 없는 starting 순간만 `"Starting shopping mode…"`로 표시한다. 썸네일/End 버튼/별도 유도 알림 없음. (D-R2-01~02)
- 본문은 `streetfitting://home`, `"Take photo"`는 `streetfitting://capture`, `"New shop"`은 `streetfitting://capture?newShop=1` Activity PendingIntent. `FLAG_IMMUTABLE|FLAG_UPDATE_CURRENT`, 액션별 서로 다른 requestCode. deep link intent-filter는 scheme=streetfitting, host=home/capture, BROWSABLE+DEFAULT. 시작은 딥링크로 하지 않고 recording이 없으면 홈으로 보낸다. 새 Intent 수신 1회에만 newShop을 실행하고 URI 소비 상태를 saved state로 저장하여 회전/React remount 때 중복 생성하지 않는다. UI 버튼도 같은 newShop 경로를 사용한다. (D-R2-01, D-R0-03)
- 최근 목록에서 앱 제거: onTaskRemoved에서 stop하지 않음. Trip/Shop/trail은 DB, 타이머 기준은 startedAt이므로 앱 재실행 getState로 recording을 복원한다. `START_STICKY` 재시작은 recording Trip 존재+권한 유지 시에만 재연결하며 마지막 기록 이후 시간을 가짜 trail로 채우지 않는다. OS의 강제 종료/사용자 force-stop/재부팅은 최근 목록 제거와 다른 사건이며 Android가 지속을 보장하지 않는다. 이런 중단 뒤 앱 재실행 시 FGS가 없으면 기존 trip을 종료·trail 삭제하고 새 시작을 요구한다. (D-R2-11)
- 종료 후 Trip/Shop/Photo/Embedding/외관 묘사·메모/저장한 옷/결과는 유지한다. 원본 trail만 삭제하며 사진 위치와 Shop.spot 및 Piece.walkTo를 지우지 않는다. (D-R0-03, D-R3-11)

**Mock:** 동일 상태 머신·권한 주입·가상 시각·fixture fix, IndexedDB 상태 복원, `open` 이벤트 수동 주입. 실제 OS 카드 대신 카드 payload를 테스트에서 관찰한다. **오류:** 위 코드 + `not_recording`, `service_unavailable`. **검증:** 위치 거부에 행 0개, 알림 거부에 recording+notice 1회, 카드 3 딥링크, New shop 중복 소비 방지, task swipe→위치 증가→재진입 recording, stop→trail 0개/Photo 유지, force-stop과 swipe 구별. (D-R1-04, D-R2-01~11)

## 3. Capture — S04

**목적:** CameraX 정지 사진 촬영 및 debug fixture 입력. 쇼핑 사진은 촬영 즉시 저장·색인 요청하며 본인/옷장 촬영은 로컬 임시 Asset을 반환한다. (D-R2-05~06, D-R4-02, D-R7-10)

```ts
interface Capture extends Events<{
  captured:{asset:Asset; photo:Photo|null};
  preview:{ready:boolean};
}> {
  openPreview(o:{facing:'back'|'front'} & (
    {purpose:'shopping'|'wardrobe'|'self'; shopId?:never} |
    {purpose:'storefront'; shopId:Id}
  )):Promise<void>;
  setPreviewRect(o:{x:number; y:number; width:number; height:number}):Promise<void>; // CSS viewport px
  takePhoto(o:{kind:'item'|'storefront'}):Promise<{asset:Asset; photo:Photo|null}>;
  closePreview():Promise<void>;
}
```

- Java CameraX Preview+ImageCapture, LifecycleCameraController 또는 ProcessCameraProvider. PreviewView를 WebView **뒤**에 놓고 `COMPATIBLE` 모드(TextureView), WebView 배경 투명, React 카메라 viewport만 투명하게 둔다. 나머지 UI 패널은 불투명. rect는 JS CSS px→density 변환, system inset 포함 좌표계를 Activity WebView content origin으로 통일한다. 화면 이탈/일시정지에서 bind 해제, 재개에서 재bind. 촬영 결과는 EXIF 회전/전면 mirror를 정방향 픽셀로 정규화한다. (D-R7-03)
- Manifest `CAMERA`, `<uses-feature android:name="android.hardware.camera.any" android:required="false"/>`. shopping은 recording을 요구하고 self/wardrobe는 shopping을 요구하지 않는다. 사진 목적은 openPreview 시 고정, takePhoto.kind는 shopping에서만 사용하며 그 외에는 item만 허용한다. (D-R2-09, D-R4-02)
- 셔터 시각 takenAt을 먼저 잡고 당시 trip/shop을 고정한다. age≤15초의 trail 점 중 |t-takenAt| 최소(동점은 앞선 점)를 선택한다. 없으면 촬영 순간 요청한 최신 fix를 최대 15초 받아 연결한다. accuracy≤100m 조건은 Session과 같다. 위치 실패면 촬영 임시 파일을 지우고 `location_unavailable`, 사진 레코드 생성 안 함. GPS EXIF를 읽어 위치로 믿지 않으며 DB location이 원장이다. (D-R5-01, D-R7-10)
- 앱 전용 파일을 확정하고 Photo(indexState=pending)를 commit한 **즉시** `PhotoIndex.index({photoId})`를 dispatch한다. 인덱싱 완료를 기다려 셔터 UI를 막지 않는다. 인덱싱 오류는 Photo.indexState=failed이며 사진 저장 성공을 취소하지 않는다. storefront면 같은 트랜잭션에서 Shop.storefrontPhotoId 변경/description=null/state=pending 및 QueueJob(kind=describe_storefront,refId=Photo.id)를 삽입한다. 묘사는 카메라 카드로 표시하지 않는다. (D-R2-04, D-R6-03)
- Trip의 외관 추가/재촬영은 `purpose:'storefront', shopId`로 대상 가게를 명시한다. 다른 purpose의 shopId와 이 preview의 kind=item은 거부한다. 대상 Shop/Trip을 셔터 시 고정하며 recording 여부와 무관하게 저장 직전 존재·소속을 재확인한다. 명시적인 셔터 동작에서만 foreground 위치 권한·현재 fix 1회를 얻고 기존 age≤15초/accuracy≤100m/15초 timeout을 적용한다. 과거 trail/Shop.spot 재사용은 금지하며 위치 거부·실패 시 임시 파일을 삭제하고 Photo를 만들지 않는다. Session·현재 shop·FGS·TrailPoint는 변경하지 않는다. Photo+storefrontPhotoId+description pending+QueueJob은 원자 commit하고 삭제와 경합하면 저장하지 않는다. 이전 외관 원본은 기존 사진 삭제 규칙 외에 자동 삭제하지 않는다. (D-R11-01)
- Fixture: debug-only intent extra **`sf_capture_source`** 값 `fixture`/`camera`, 선택 폴더 extra **`sf_capture_fixture_dir`**, 기본 `getFilesDir()/capture-fixtures/`(현재 emulator: `/data/user/0/com.streetfitting.app/files/capture-fixtures/`). allowlist는 canonical 앱 내부 files 하위 경로만이며 외부 저장소 경로/alias fallback은 없다. adb로 고유 `/data/local/tmp/` staging에 push한 뒤 `run-as com.streetfitting.app`으로 내부 폴더에 복사하고 staging 사본을 정리한다. shell 소유 외부 폴더의 접근 실패를 저장소 권한 확대로 우회하지 않는다. JPG/JPEG/PNG를 파일명 UTF-8 오름차순으로 열거하고 셔터 성공마다 0→1→…→마지막→0 순환한다. 소스/폴더 변경 시 index=0; lifecycle 재생성은 index 유지, 새 프로세스는 0부터. fixture의 EXIF/GPS/촬영 시각은 무시하고 실제 셔터 시각+주입 GPS를 쓴다. 손상·빈 폴더는 명시 오류, 실제 카메라로 조용히 fallback하지 않는다. (D-R7-10; 두 Mac 재개 중 실제 shell/app UID 접근 실패를 근거로 내부 경로 합의)
- debug `src/debug/java/.../FixtureCaptureSource.java` 및 debug factory/intent reader에만 fixture 구현을 둔다. release source set의 동명 factory는 CameraX만 반환하며 extra를 읽는 코드·fixture 파일을 APK에 포함하지 않는다. fixture source에서는 CAMERA 권한 요청/하드웨어 preview 없이 같은 viewport에 선택 이미지를 보여 준다. 화면에 fixture/dev badge는 없다. (D-R7-07, D-R7-10)

**Mock:** 위 fixture 순환을 web Blob으로 재현하고 shopping 저장/인덱싱/큐도 같은 mock Store를 호출. **오류:** `camera_permission_denied`, `camera_unavailable`, `preview_not_open`, `not_recording`, `location_unavailable`, `fixture_empty`, `fixture_invalid`. **검증:** 투명 WebView 클릭과 preview 크기·회전, index 한 번 호출, storefront 큐 원자성, source 순환/손상, release에서 extra 무시, 위치 없는 Photo가 생기지 않음. (D-R1-04, D-R7-10)

## 4. PhotoIndex — S05

```ts
interface PhotoIndex extends Events<{indexed:{photoId:Id; state:'done'|'failed'}}> {
  index(o:{photoId:Id}):Promise<PhotoEmbedding>;
  search(o:{phraseVector:number[]; photoIds?:Id[]; k:number}):Promise<Array<{photoId:Id; score:number}>>;
}
```

**목적/구현:** PE-Core-T16 이미지 타워로 사진당 한 번 색인. Java ONNX Runtime Android CPU, `pe_image.onnx` 입력 `image` float32 `[1,3,384,384]`, RGB 정방향 사진을 bilinear로 정사각 resize(센터 crop 없음), `(pixel/255-0.5)/0.5`. 출력 `embedding` float32 `[1,512]`, L2 정규화 후 SQLite BLOB로 저장. `index`는 Photo ID별 single-flight이며 done이면 기존 벡터 반환, failed는 명시 재시도 가능. 앱 시작 시 pending만 재개. search는 512 유한수 L2 벡터와 내적=코사인, k 정수 1~3, 미지정 photoIds는 모든 item 사진. 정렬은 score 내림차순, 동점은 takenAt 내림차순, 다시 동점이면 photoId 오름차순이며 이 순서로 정렬한 뒤 k개를 자른다([agent-tools](agent-tools.md) find_photos 규칙 5와 같은 순서. 호출자는 다시 정렬하지 않는다). 검색 범위의 pending은 최대 30초 완료를 기다리고 failed 또는 시간 초과는 index_unavailable로 반환하며 조용히 제외하지 않는다. 사용자의 수동 사진 탐색은 유지한다. PE는 의류 후보를 지우는 필터가 아니다. (D-R1-01, D-R3-01~03; research §7.1·8.1)

**권한:** 추가 없음, DB/앱 전용 파일만. **Mock:** fixture photoId→고정 정규화 벡터, 실제 JS 내적/정렬로 검색; timer 성공 흉내만으로 검색 결과를 고정하지 않는다. **오류:** `model_missing`, `model_invalid`, `inference_failed`, `invalid_vector`, `index_unavailable`. **검증:** 사진당 성공 인덱싱 1회, 같은 사진 동시 요청 single-flight, 512/유한수/L2, pending 대기와 failed 오류, 삭제 중 응답 미부활, Mac PoC 벡터와 오차 비교, 네트워크 호출 0. (D-R1-04, D-R3-11)

## 5. Segmenter — S05

```ts
type SegMask = {mask:FileRef; bbox:BBox; score:number};
interface Segmenter extends Events<{prepared:{handle:string; assetId:Id}}> {
  prepare(o:{asset:Asset}):Promise<{handle:string; w:number; h:number}>;
  tap(o:{handle:string; x:number; y:number}):Promise<{masks:SegMask[]}>; // x/y: 원본 기준 0..1
  person(o:{handle:string}):Promise<{masks:SegMask[]}>; // 중심점 (0.5,0.5)
  release(o:{handle:string}):Promise<void>;
}
```

**목적:** 탭의 범위 후보 3개 및 FaceMask용 중심점 사람 후보. 자동 전체 옷 검출/분류가 아니다. `prepare`가 인코더를 먼저 실행해 native handle로 feature를 유지하고, 다음 탭은 디코더만 실행한다. 한 번에 활성 handle 1개, 새 prepare는 이전 handle을 release한다. person은 의미론적 사람 검출기가 아니라 중심 탭 결과이며 FaceMask가 윤곽 조건을 검증해야 한다. (D-R7-01, D-R3-02)

### ONNX 입출력 — PoC export와 일치

근거 파일은 원 `/tmp/edgetam-poc/`에서 보존한 `$SF_MODELS_DIR/run_edge.py`, `EdgeTAM/sam2/utils/transforms.py`, `artifacts/android_runs.json`이다(뒤 두 경로도 같은 모델 루트 기준). [안정 배치·hash](../README.md#모델-배치와-오프라인-검증)를 따른다. export는 고정 batch=1, point=1이며 멀티포인트를 임의로 전달하지 않는다. (D-R7-03; research §7.1)

| 단계 | 이름/타입 | shape/내용 |
| --- | --- | --- |
| encoder 입력 | image float32 | `[1,3,1024,1024]` RGB, 정방향 사진 bilinear resize, /255 뒤 mean `[.485,.456,.406]`, std `[.229,.224,.225]` |
| encoder 출력/decoder 입력 | embedding float32 | `[1,256,64,64]`, export에서 no_mem_embed 이미 더함 |
| 동일 | high0 float32 | `[1,32,256,256]` |
| 동일 | high1 float32 | `[1,64,128,128]` |
| decoder 입력 | coords float32 | `[1,1,2]`, `[[[x*1024,y*1024]]]` |
| decoder 입력 | labels int64 | `[1,1]`, 양성점 `[[1]]` |
| decoder 출력 | masks float32 | `[1,3,256,256]`, logits |
| decoder 출력 | scores float32 | `[1,3]`, predicted IoU |

- 화면 탭은 이미지 content rect(레터박스 제외)에서 역변환: `x=(tapX-left)/renderedWidth`, `y=(tapY-top)/renderedHeight`. 바깥 탭은 무시, edge 1은 모델 픽셀 1023으로 clamp한다. EXIF 정방향 이미지 좌표이며 screen DPR을 두 번 곱하지 않는다. (D-R3-02)
- mask logits를 원본 w×h로 bilinear resize(`align_corners=false`) 후 `>0` threshold, PNG 0/255와 tight pixel bbox를 만든다. scores 내림차순(동점 decoder index)으로 정확히 3개 반환. 빈 mask/비유한 score는 `inference_failed`이지 높은 점수만 남기는 필터가 아니다. UI 후보 ID는 data-model의 mask 기반 규칙을 쓴다. (D-R3-02)
- Java OrtEnvironment/OrtSession을 재사용하고 feature/tensor를 native 내부에 둔다. OrtValue·Bitmap·tensor는 handle release 시 닫는다. ONNX Runtime의 `.so`와 APK packaging 모두 16 KB 페이지 대응이 필요하다(§12). 추가 권한 없음. (D-R7-03)

**Mock:** prepare handle과 같은 원본 크기의 fixture mask 3개·점수 반환, fixture별 중심 person mask 별도 제공. **오류:** `model_missing`, `model_invalid`, `handle_expired`, `inference_failed`. **검증:** 레터박스/회전/가로세로 사진 좌표, 두 번째 탭 encoder 미실행, 3개 정렬, PoC PNG와 IoU 비교, release 후 handle 오류, native 메모리 회수. 연구의 encoder 약 155ms/decoder 16.6ms는 앱 SLA가 아니다. (D-R1-04; research §7.1)

## 6. FaceMask — S05 (피팅 JS 오케스트레이션 S10)

**목적:** 사용자 입력 없이 중심점 사람 마스크의 윤곽으로 머리 전체를 제거하고, 로컬 재합성 또는 얼굴 없는 결과를 만든다. 사용자 전송본 미리보기는 없다. 정확도는 미확인이고 실패를 raw 업로드로 우회하지 않는다. (D-R7-01, D-R4-03~04, D-R4-11)

```ts
type MaskFailure = 'person_not_found'|'head_not_found'|'ambiguous_person'|'unsafe_boundary';
type MaskMetrics = {
  personAccepted:boolean; headAreaRatio:number|null;
  gtHeadPixels:number|null; exposedHeadPixels:number|null;
  privacyPassed:boolean|null; // GT 없는 일반 등록에서는 null, 합격을 추정해 true로 쓰지 않음
};
type ComposeMetrics = {
  neckColorDeltaE95:number|null; shoulderColorDeltaE95:number|null;
  neckOffsetRatio95:number|null; shoulderOffsetRatio95:number|null;
  thresholdVersion:string|null; passed:boolean;
  decision:'composited'|'threshold_exceeded'|'metrics_unavailable'|'not_calibrated';
};
interface FaceMask extends Events<{stage:{stage:'segmenting'|'masking'|'compositing'}}> {
  register(o:{asset:Asset}):Promise<
    {ok:true; selfPhoto:SelfPhoto; metrics:MaskMetrics}|
    {ok:false; reason:MaskFailure; metrics:MaskMetrics}
  >;
  compose(o:{providerFile:FileRef; selfUpdatedAt:number}):Promise<
    {ok:true; file:FileRef; faceless:boolean; metrics:ComposeMetrics}|
    {ok:false; reason:'unsafe_output'|'self_photo_changed'; metrics:ComposeMetrics}
  >;
  evaluateFixture(o:{asset:Asset; expectedPerson:boolean; groundTruthHeadMask:FileRef|null}):Promise<{
    registrationOk:boolean; reason:MaskFailure|null; metrics:MaskMetrics; passed:boolean
  }>;
}
```

### 윤곽 규칙 [추론] — 품질 검증용 기본 파라미터

아래는 biometric 얼굴 검출/랜드마크/새 모델이 아니라 binary person silhouette의 행 폭 규칙이다. 중심 탭 마스크 3개를 점수 순으로 검사하고 조건을 통과하는 첫 마스크만 사용한다. 숫자는 개발 설정 `faceMaskConfig`에 모아 PoC에서 조정하되 UI 설정으로 노출하지 않는다. (D-R7-01)

```text
각 mask의 중심점을 포함하는 connected component C를 취한다.
중심점이 배경이거나 C 면적 < 전체의 10%이면 실패.
두 번째 큰 component가 C의 25% 이상이면 ambiguous_person.
C bbox=(left,top,right,bottom), H=bottom-top+1.
위쪽 머리가 프레임에 잘림(top<=1), 몸 높이 H<이미지높이*0.45이면 실패.
각 행 y에서 C의 minX/maxX를 구해 width[y]=maxX-minX+1.
width를 5행 이동 중앙값으로 평활화한다(끝은 유효 이웃만).
목 후보 구간 = [top+0.12H, top+0.38H].
후보 y는 위쪽 0.04H~0.12H 창의 최대폭(머리)보다 15% 이상 좁고,
아래쪽 0.04H~0.15H 창의 최대폭(어깨)보다 25% 이상 좁아야 한다.
각 창에 유효 행이 있어야 하며, 머리/어깨 중심 x 차이는 C폭의 20% 이하.
후보 중 width가 최소인 y를 neckY로 선택(동점은 위쪽).
후보 없음, neck 위 높이가 H의 12~38% 밖이면 head_not_found.
head = C 중 y<=neckY의 영역.
hairMarginX=max(8px, C폭*0.08), hairMarginY=max(8px,H*0.04).
head bbox를 이 여유만큼 팽창, 아래 경계는 neckY+0.02H까지 확장.
범위가 잘리거나 팽창된 head가 이미지의 40% 초과면 unsafe_boundary.
최종 headMask는 팽창 bbox 전체를 255로 채움(윤곽의 누락된 머리카락 보호).
```

옷걸이/반신·앉은 자세/여러 명/가려진 목/긴 머리/모자에서 이 규칙이 실패하거나 잘못 통과할 수 있다. 따라서 윤곽 통과만으로 실제 얼굴·머리 완전 제거를 증명하지 않는다. D-R9-01의 자동 fixture 판정에서 **모든 본인 사진의 exposedHeadPixels=0, 모든 사람 없는 사진의 registrationOk=false**가 필수이며 평균 성공률로 실패를 덮지 않는다. 하나라도 미달이면 설정을 합격 처리하지 않는다. register 실패는 `ok:false`, UI는 `"Retake your photo with your full head and body visible."`를 안내하고 새 임시 원본을 지운다. 기존 정상 SelfPhoto는 유지한다. (D-R4-11, D-R7-01, D-R9-01)

### 전송본, 설정, 재합성

- 기본 `faceMaskConfig.mode='a'`: research §6.3 (a), 원본 캔버스를 유지하고 headMask를 **불투명 단색 RGB(127,127,127)**으로 덮는다. blur/모자이크/alpha 투명은 금지. (b) `mode='b'`는 팽창 headMask의 아래 경계 위 전체를 crop하고 목 아래만 보낸다. (c) `mode='c'`는 (a)+person mask 바깥 배경을 같은 단색으로 제거한다. cropOffset, 원본 w/h, mode는 self 파일 옆 로컬 sidecar에 보관하고 네트워크에 넣지 않는다. 기본 (a)는 좌표 재합성 검증이 쉬워 택한 [추론]이며 PoC에서 변경 가능하다. (D-R4-04, D-R7-01; research §6.3)
- `register`가 방향 정규화→person→headMask→maskedFile 재인코딩→EXIF/위치/파일명 메타데이터 제거→검사 성공을 모두 마쳐야 Store의 SelfPhoto singleton을 원자 교체한다. **이 모듈과 원본 본인 사진 파일 경로에는 네트워크 호출이 없다. 전송 adapter는 SelfPhoto.maskedFile만 읽는다.** 마스킹 실패·파일 누락은 업로드 요청 0회다. (D-R0-02, D-R4-03, D-R4-11)
- 재합성의 합격 여부는 목·어깨의 **색 차이와 윤곽 어긋남 수치**만으로 자동 판정한다. `faceMaskConfig.compositionThresholds={version,maxBoundaryColorDeltaE,maxBoundaryOffsetRatio}`를 PoC로 보정하고 개발 설정으로 노출한다. 임계값은 미확인이고 초기값은 null이다. 임의의 3%/10% 고정 수치를 합격 기준으로 사용하지 않는다. null이면 decision=not_calibrated로 faceless를 선택한다. 유효한 설정 아래 네 지표가 각각 임계값 이하일 때만 원본 머리를 붙인다. 사람이 결과마다 합격을 누르는 경로는 없다. 얼굴 인식/새 얼굴 생성/비선형 warping 없이 동일 canvas 좌표의 선형 스케일과 경계 2px feather만 사용한다. (D-R9-01, D-R4-04)
- 한 지표라도 초과하거나 측정 불가이면 그 결과는 자동으로 `faceless=true`다. provider 원본을 그대로 얼굴 없는 결과라고 표시하면 안 된다(모델이 새 얼굴을 그릴 수 있음). provider에서 성공적으로 찾은 팽창 headMask의 아래까지 상단 전체를 잘라 얼굴·머리가 없는 파생 표시본을 만든다. (b)는 반환된 목 아래 이미지라도 생성된 머리가 없는지 같은 출력 윤곽 검증을 하고, 새 머리가 있으면 제거한다. 출력 머리 영역을 안전하게 결정할 수 없으면 `ok:false,unsafe_output`으로 결과 저장을 막고 원본을 사용자에게 노출하지 않는다. (D-R9-01, D-R4-04, D-R4-11)
- providerFile은 바이트 그대로 별도 보관, 최종 file만 합성/잘라내기 한다. provenance 보존 방법 미확인이므로 결과 다운로드는 `resultDownload=false`다. 원본 SelfPhoto/이전 버전은 기기 안에서만 참조하며 요청 시작 시 잡은 updatedAt 버전을 compose에 전달한다. 이미 해제된 버전이면 self_photo_changed, 다른 얼굴로 대체 금지. (D-R4-02, D-R4-10)

**권한/Manifest:** 추가 없음, ONNX·Bitmap·Canvas만. **Mock:** 실제 fixture headMask/opaque maskedFile/합성/얼굴 없는 이미지 쌍과 수치 지표를 반환한다. 임계값 동일/초과/미설정/측정 불가 및 사람 없는 fixture를 각각 제공하며 mock도 같은 판정 함수를 사용한다. raw를 maskedFile 대신 복사하지 않는다. **오류:** `model_missing`, `inference_failed`, `io_error`; 검출 실패는 위 union. (D-R1-04, D-R4-11, D-R9-01)

### 자동 지표 정의와 PoC 합격 절차

- MaskMetrics.personAccepted는 중심 사람 후보가 모든 윤곽 조건을 통과했는지, headAreaRatio는 최종 headMask 픽셀 수/(원본 w×h)인 0~1 값이다. 머리 mask를 만들지 못하면 headAreaRatio=null이다. 일반 register의 ok=true는 런타임 검출·마스킹 성공을 뜻하고 GT 기반 privacyPassed를 대체하지 않는다. fixture의 privacyPassed=false는 evaluateFixture.passed=false이며 실제 전송은 하지 않는다. (D-R9-01)
- **마스킹 지표:** GT는 정방향 원본 w×h의 사람이 표시한 얼굴+머리카락 binary mask다. `gtHeadPixels=GT의 1 개수`. masking/crop/배경제거의 최종 변환을 원본 좌표로 역추적하여, GT 중 출력에 남으면서 불투명 덮기 없이 원본 픽셀에 기여하는 위치 수를 `exposedHeadPixels`로 센다. RGB가 우연히 같은지를 비교하는 방식은 금지한다. 기본 전송본은 lossless PNG로 생성하며 resize가 필요하면 모든 interpolation footprint를 포함한 보수적 GT 확장 후 다시 검사한다. `privacyPassed=(exposedHeadPixels===0)`이고 EXIF도 별도 제거 검사한다. GT가 없는 일반 등록에서는 두 count와 privacyPassed=null이며 검증하지 않은 0을 돌려주지 않는다. (D-R9-01)
- **fixture API:** evaluateFixture는 실제 register와 동일 검출·마스킹 코어를 실행하되 SelfPhoto를 교체하지 않는 로컬 평가 메서드다. expectedPerson=true이면 유효한 GT가 필수이며 `passed=registrationOk && privacyPassed===true`; false이면 GT=null이고 `passed=!registrationOk`. expectedPerson을 알고리즘 입력으로 사용해 강제로 실패시키면 안 된다. 반환 reason은 실제 검출 결과이며 임시 파일을 종료 시 회수한다. 사람이 없는 fixture의 registrationOk=true는 반드시 suite 실패다. (D-R9-01)
- **경계 정의 [추론]:** 원본/출력 사람 윤곽을 원본 canvas로 선형 정렬한다. 목 경계는 neckY의 좌우 person 윤곽 교점 사이, 어깨 경계는 목 아래 0.04H~0.15H 구간의 좌우 person 외곽이다. 각 경계를 길이 비례 64점씩 sampling한다. 비어 있거나 가려진 구간은 측정 불가이며 해당 지표=null. 평가 전에 얼굴을 원본으로 합성하지 않는다. (D-R9-01)
- **어긋남:** 대응 neck/shoulder 윤곽 사이의 양방향 최근접점 Euclidean 거리의 95th percentile을 원본 이미지 대각선 길이로 나눈 값이 각각 neckOffsetRatio95/shoulderOffsetRatio95다. 두 지표 모두 유한수 ≥0이고 공통 maxBoundaryOffsetRatio 이하여야 한다. (D-R9-01)
- **색 차이:** 최종 접합선의 법선 방향으로 양측 3px band를 잡아 각 sampling 지점에서 원본 붙일 쪽과 provider 남길 쪽의 median sRGB를 CIELAB D65로 바꾼다. 두 색의 CIE76 ΔE를 계산하고 경계별 95th percentile이 neckColorDeltaE95/shoulderColorDeltaE95다. 두 지표 모두 유한수 ≥0이고 maxBoundaryColorDeltaE 이하여야 한다. feather 전 측정해 blur가 품질 실패를 숨기지 못하게 한다. (D-R9-01)
- **판정/반환:** `passed`는 calibrated threshold 존재+네 지표 모두 유효+네 비교 모두 `<=`일 때만 true, decision=composited. 초과는 threshold_exceeded, 측정 불가는 metrics_unavailable, 설정 없음은 not_calibrated. 성공 출력의 faceless는 !passed와 일치한다. 안전한 faceless도 못 만들면 ok:false이며 metrics는 원인을 보존한다. 반환 지표와 thresholdVersion은 기기 내 검증용이고 이미지·좌표·원본 경로를 로그로 보내지 않는다. (D-R9-01, D-R6-04)

1. 성인 동의 사진/생성 fixture의 정면 전신·긴 머리·모자·반신·목 가림·여러 사람·화면 상단 잘림과 **사람 없는 사진**을 포함한다. 성공 등록을 의도한 본인 사진 전부는 registrationOk=true이고 노출 픽셀 0이어야 한다. 거부를 의도한 부적절 사진은 별도 negative 세트로 두며 실패 건을 성공 세트에서 사후 제외해 통과율을 올리지 않는다. 모든 no-person 사진은 ok:false여야 한다. S11 suite는 위 조건을 자동 assert한다. (D-R9-01)
2. 업로드 직전 payload를 기기 내 테스트 hook에서 검사해 허용 파일이 maskedFile뿐이고 raw/headMask 경로가 요청 생성 함수에 도달하지 않음을 확인한다. raw 파일 sentinel을 넣은 실패·취소·재시도 케이스에서 네트워크 0회. 이미지 자체를 로그에 남기지 않는다. (D-R6-04, D-R4-11)
3. research §6.3의 2사진×3방식×low/high 12회, 우수 조합 3회 반복+상의만 1회=16회 PoC에서 네 경계 지표를 수집하여 임계값·version을 고정한다. 임계값 선정 근거와 고정 검증 세트를 기록하고, 고정 세트에서 같은 자동 판정을 재현한다. 수동 시각 검토는 임계값 보정 자료일 뿐 런타임/검증 합격 override가 아니다. 임계값과 측정 결과는 아직 미확인이다. 초과 결과는 그 요청만 자동 faceless가 되고 다른 결과의 합격을 취소하거나 사람에게 판정을 맡기지 않는다. (D-R1-04, D-R7-05, D-R9-01)

## 7. Media — S04 (내보내기 정책 S10)

```ts
interface Media extends Events<{exported:{uri:string; sourceId:Id}}> {
  pick(o:{purpose:'wardrobe'|'self'}):Promise<{asset:Asset}>;
  exportPhoto(o:{photoId:Id}):Promise<{uri:string}>;
  exportResult(o:{resultId:Id}):Promise<{uri:string}>;
  discard(o:{assetId:Id}):Promise<void>;
}
```

**구현/권한:** Android Photo Picker/Activity Result, 미지원 API는 ACTION_OPEN_DOCUMENT. 선택 content URI를 즉시 앱 전용 import cache로 복사·정방향 정규화하며 외부 URI를 영구 Photo로 쓰지 않는다. 선택 취소는 cancelled. 광역 READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE/ACCESS_MEDIA_LOCATION 없이 picker grant만 사용한다. API29+ MediaStore.Images에 명시 사용자 다운로드를 쓰고 API24~28은 ACTION_CREATE_DOCUMENT로 저장 위치를 고른다(광역 쓰기 권한 없음). 원본 Photo 내보내기는 재인코딩/ExifInterface로 GPS 제거 검증 후 복사한다. Result는 feature flag와 검증된 provenance 보존 exporter가 모두 있어야 하며 GPS 제거를 위해 결과 메타데이터 전체를 지우면 안 된다. (D-R2-05, D-R2-09, D-R2-11, D-R4-02, D-R4-10)

**Mock:** purpose별 고정 fixture 선택/취소, 다운로드를 Blob으로 만들어 이벤트를 확인, resultDownload 차단 동일. **오류:** `picker_unavailable`, `export_failed`, `result_download_disabled`, `provenance_unverified`. **검증:** shopping import API 없음, picker 권한 최소화, orientation/임시 파일 회수, Photo GPS 제거, Result flag false면 파일 export 0회, providerFile 불변. (D-R1-04, D-R4-10)

## 8. Voice — S04

```ts
interface Voice extends Events<{
  state:{state:'recording'|'stopped'; reason?:'silence'|'limit'|'manual'|'cancelled'};
  level:{rmsDbfs:number};
  completed:{file:FileRef; durationMs:number; sampleRate:16000; channels:1; bitsPerSample:16};
  error:{code:'no_speech'|'audio_unavailable'|'io_error'; retryable:boolean};
}> {
  start():Promise<void>;
  stop():Promise<{file:FileRef; durationMs:number; sampleRate:16000; channels:1; bitsPerSample:16}>;
  cancel():Promise<void>;
}
```

**구현:** Java AudioRecord, MIC, **모델 없는 에너지 VAD**. PCM 16-bit signed little-endian mono 16,000Hz, RIFF/WAVE PCM format=1, 44바이트 헤더, 최대 240,000 samples=15,000ms. stop에서 헤더 길이 확정. API가 이 장치에서 16kHz를 지원하지 않으면 audio_unavailable(다른 sample rate라고 거짓 표기 금지). (D-R3-05, D-R3-07)

[추론] 20ms frame RMS를 `20*log10(max(rms/32768,1e-8))` dBFS로 계산, 발화 임계값 -40dBFS. 3 frame(60ms) 연속 초과를 speech 시작으로 보고 이후 1,000ms 연속 미만이면 silence stop. 선행 무음은 5초에서 no_speech, 총 녹음 15초 hard stop. 발화 200ms 미만은 no_speech로 WAV 삭제. 테스트 노이즈 기준으로 임계값을 바꾸는 설정만 두고 또 다른 VAD 모델은 추가하지 않는다. stop/manual·silence·limit 중 먼저 발생한 1회만 complete, 이미 stop한 stop은 동일 결과 반환. cancel/화면 이탈은 파일 삭제하고 전사하지 않는다. (D-R3-07, D-R6-03)

자동 종료에서 no_speech/녹음 장치 오류가 나면 state=stopped 뒤 error 이벤트 1회만 발행하고 completed는 발행하지 않는다. 명시 stop 호출이 있으면 같은 오류로 reject한다. 호출자는 stop 반환값과 completed 이벤트를 각각 전사하지 않고 completed 한 경로에서만 전사를 시작한다. (D-R3-07)

음성 흐름 호출자가 completed WAV를 `/v1/transcribe`로 보내고 영어 전사문을 말풍선에 넣어 S07 에이전트 검색을 바로 시작한다. 수정 확인 화면 없음. offline이면 start 전에 알리고 요청을 큐에 쌓지 않으며 녹음 중 연결이 끊겨도 저장된 음성을 자동 재전송하지 않는다. 실패/성공/취소 시 호출자가 Media/Store temp cleanup으로 WAV를 회수한다. S07은 에이전트 루프만 소유하고 오프라인 큐 worker를 소유하지 않는다. (D-R3-07, D-R6-03, D-R7-04)

**Fixture 입력 [추론·기술 결정, D-R7-10 원칙 확장]:** E2E를 자동화하려고 Capture fixture와 같은 방식으로 debug 전용 음성 입력을 둔다.
- 켜는 방법: intent extra `sf_voice_source`(`fixture`/`mic`)와 폴더 extra `sf_voice_fixture_dir`. 기본 폴더는 `getFilesDir()/voice-fixtures/`다. Capture와 같은 canonical 내부 files allowlist 및 adb 임시 staging → run-as 복사 절차를 사용하며 외부 저장소 fallback은 없다.
- 동작: `start()`마다 폴더의 WAV(PCM16 mono 16 kHz)를 파일명 오름차순으로 하나씩 꺼내, AudioRecord 대신 실시간 속도로 VAD에 공급한다. 무음 종료, 15초 상한, `no_speech` 판정은 실제 마이크와 같은 코드 경로를 탄다.
- debug source set에만 둔다. release에서는 extra를 읽지 않는다. 화면에 표시하지 않는다(D-R7-07).
- 오류: `fixture_empty`, `fixture_invalid`.

**권한:** `RECORD_AUDIO`, 런타임 요청. 백그라운드 마이크 FGS 없음. **Mock:** timer+고정 WAV/에너지 프레임으로 silence/limit/no_speech 재현, 브라우저 마이크 권한 불필요. **오류:** `microphone_permission_denied`, `audio_unavailable`, `no_speech`, `not_recording`, `offline`. **검증:** WAV header/샘플 길이, 15초 넘지 않음, 발화 전/후 무음, cancel 중복 전사 없음, transcript 즉시 검색, 마이크 Find it에만 존재. (D-R1-04, D-R7-09)

## 9. Store — S06

**목적:** DB·파일 소유권·삭제 연쇄·큐·중복 저장을 한 모듈이 맡는다. UI에 raw SQL/임의 경로 쓰기를 열지 않는다. 아래 enum-like 문자열은 data-model 엔티티 이름과 일치한다. (D-R3-11, D-R6-03, D-R7-04)

```ts
type EntityMap = {
  Trip:Trip; TrailPoint:TrailPoint; Shop:Shop; Photo:Photo;
  PhotoEmbedding:PhotoEmbedding; Piece:Piece; Result:Result; QueueJob:QueueJob;
};
type Page<T> = {items:T[]; nextCursor:string|null};
interface Store extends Events<{changed:{entities:(keyof EntityMap|'SelfPhoto')[]; ids:Id[]}}> {
  get<K extends keyof EntityMap>(o:{entity:K; id:Id}):Promise<EntityMap[K]|null>;
  list<K extends keyof EntityMap>(o:{entity:K; tripId?:Id; shopId?:Id; origin?:'shop'|'wardrobe';
    limit?:number; cursor?:string}):Promise<Page<EntityMap[K]>>;
  getSelfPhoto():Promise<SelfPhoto|null>;
  saveCandidate(o:{candidate:Candidate; origin:'shop'|'wardrobe';
    labelMode:'concept'|'describe'}):Promise<Piece>;
  updateShop(o:{id:Id; note:string|null}):Promise<Shop>;
  updatePiece(o:{id:Id; label:string; category:string}):Promise<Piece>;
  prepareResult(o:{targetPieceId:Id; companionPieceIds:Id[]}):Promise<{
    draftId:Id; targetSnapshot:ResultPieceSnapshot; companionSnapshots:ResultPieceSnapshot[]
  }>;
  saveResult(o:{draftId:Id; file:FileRef; faceless:boolean; providerFile:FileRef}):Promise<Result>;
  discardResultDraft(o:{draftId:Id}):Promise<void>;
  deleteTrip(o:{id:Id}):Promise<void>;
  deletePhoto(o:{id:Id}):Promise<void>;
  deletePiece(o:{id:Id}):Promise<void>;
  deleteResult(o:{id:Id}):Promise<void>;
  enqueue(o:{kind:QueueJob['kind']; refId:Id}):Promise<QueueJob>;
  nextJob(o:{now:number}):Promise<QueueJob|null>;
  beginJob(o:{id:Id; now:number}):Promise<QueueJob>;
  completeJob(o:{id:Id; description?:string; label?:string; category?:string}):Promise<void>;
  failJob(o:{id:Id; retryable:boolean; retryAfterMs?:number; preflight?:boolean}):Promise<void>;
  discardTemp(o:{file:FileRef}):Promise<void>;
}
```

- `get`의 id는 PhotoEmbedding이면 photoId, TrailPoint이면 `${tripId}:${t}`의 마지막 colon 분리 키다. 일반 list 기본 limit=50, 1~200, cursor는 `(정렬값,id)` 불투명 인코딩. Trip/Photo/Piece/Result는 시간 내림차순+id, Shop은 tripId+n 오름차순, TrailPoint는 t, QueueJob은 nextAt+id, Embedding은 photoId. 지원하지 않는 filter 조합은 invalid_argument, 무시하지 않는다. tripId 필터는 Shop/Photo/TrailPoint/Piece, shopId는 Photo/Piece, origin은 Piece만 허용한다. (D-R3-03, D-R7-04)
- Java SQLiteOpenHelper 내부 repository가 ShoppingSession의 start/newShop/stop, Capture의 commitPhoto, PhotoIndex의 commitEmbedding, FaceMask의 replaceSelfPhoto를 제공한다. 이 쓰기는 각 public plugin 안에서만 호출하여 JS가 권한·마스킹·위치 제약을 우회해 raw insert하지 못하게 한다. 단일 writer와 data-model의 foreign key/nullable 정책을 공유한다. (D-R2-10, D-R4-11)
- 과거 외관 전용 원자 저장은 web 내부 `commitPhoto({photo,storefrontEdit:true})`, Java 내부 `commitStorefront({photo})`로 구분한다. kind=storefront와 대상 Shop/Trip 소속·존재를 확인하며 종료된 trip도 허용한다. 일반 commitPhoto는 계속 recording을 요구한다. public Store bridge에 raw commit 메서드를 노출하지 않는다. (D-R11-01)
- 큐 실행 주체는 **S06의 foreground worker**다. S06이 Store 네이티브, `app/src/native/store.ts`, DB/파일, 대기열 저장·재시도·worker 루프와 describe_storefront/label_piece HTTP handler를 모두 소유한다. Store nextJob은 조회만, beginJob은 직렬 claim+attempts/nextAt 갱신. in-process claim은 DB 재시작 시 해제하지만 잠정 nextAt은 유지하므로 즉시 중복 실행하지 않는다. completeJob은 kind별 payload만 허용한다. ref 삭제/외관 교체/사용자 label 수정과 경합하면 응답 폐기. retry 정책은 data-model §6 그대로다. S07의 에이전트 루프와 큐 수명을 결합하지 않는다. (D-R6-03, D-R7-04)
- 전송 전 이미지 준비의 영구 실패는 `failJob({id,retryable:false,preflight:true})`로 종료한다. preflight는 boolean이며 true일 때 retryable=false·retryAfterMs 없음만 허용한다. 이미 claim된 작업에는 `job_not_claimed`, claim 없는 작업에는 기존 terminal failure(외관 failed 및 작업 삭제)를 적용하되 attempts를 증가시키지 않는다. 이미 삭제된 작업은 idempotent no-op이며 일반 failJob은 계속 claim을 요구한다. [추론·두 Mac owner 합의]
- 위 preflight 영구 종료는 이미지 준비 단계의 오류에만 적용한다. Firebase ID/App Check 준비의 일시 실패는 claim/attempts 없이 5초 뒤 재시도하며 `unauthenticated`도 다음 시도에 `forceRefreshAuth:true`를 전달한다. 큐 snapshot 종료와 enqueue가 겹쳐도 wake를 잃지 않는다.
- Candidate와 SelfPhoto는 generic list/get 대상이 아니다. Candidate는 화면 캐시, SelfPhoto는 singleton getter. saveCandidate는 앱 발급 mask/원본만 허용하고 id를 다시 계산한다. `saveResult`도 앱 관리 providerFile·FaceMask 산출 file만 허용한다. discardTemp는 cache만 삭제하고 영구 파일은 거부한다. (D-R3-11, D-R4-11)
- saveCandidate의 labelMode=concept는 검색 concept가 있는 shop만 허용한다. wardrobe 또는 검색 없는 trip 직접 탭은 describe이며 label=`"Picked item"`, category=`"unknown"`과 label_piece QueueJob을 같은 transaction으로 저장한다. `/v1/describe/piece` 성공 후 두 필드를 갱신한다. origin/source/표시 문자열만으로 검색 여부를 추측하지 않는다. 중복 저장이면 기존 Piece와 사용자 수정값을 유지하고 큐를 중복 생성하지 않는다. (D-R9-02)
- ResultPieceSnapshot은 data-model에 정의된 내장 값 객체다. prepareResult는 직렬 writer에서 원본 존재·조합을 검증하고 대상/동반의 이름·종류·walkTo·가게 표시 정보와 실제 cutout/외관 파일을 `cache/result-drafts/<draftId>/`로 복사한다. 복사 도중 원본 삭제와 경합하지 않도록 참조를 pin한다. HTTP 요청은 이 고정 cutout 복사본을 사용하고 saveResult는 원본을 재조회하지 않고 draft를 Result 소유 디렉터리로 승격한다. Result.id=draftId로 저장하여 같은 draftId 재저장은 같은 Result를 반환하고 중복 결과를 만들지 않는다. 실패/취소는 discardResultDraft로 회수하고, 프로세스 재시작은 Result가 없는 미완료 draft만 회수한다. (D-R9-03)
- 원본 target 삭제 후에도 Result snapshot의 이미지·가게 표시·walkTo는 유지하고 `"Change pieces"`만 비활성화한다. deleteResult는 snapshot cutout/외관 복사본까지 지우되 원본 Piece와 다른 Result 파일은 건드리지 않는다. web mock도 Blob 복사본 수명을 분리하고 이 삭제 경합을 검증한다. (D-R9-03)
- web 저장소는 DB 이름별 Web Locks exclusive lease를 회수/GC 전에 얻고, 같은 runtime의 인스턴스만 공유한다. 다른 탭/runtime이 열려 있으면 `busy`로 차단하여 진행 중 asset/provider/draft를 지우지 않는다. 마지막 owner의 close 또는 탭 종료 뒤 다음 runtime이 미완료 파일을 회수하며 영구 Photo/Piece/Result는 유지한다. browser에서 Web Locks가 없으면 `unavailable`로 실패한다. [추론·web 저장 수명 구현]
- S11의 private `Store.getRuntimeInfo()`는 native `ApplicationInfo.FLAG_DEBUGGABLE`에서 얻은 `{debug:boolean}`만 반환한다. public Store DTO/새 plugin/raw write가 아니다. 검증 hook은 명시 `VITE_SF_VERIFICATION=1`과 native debug=true를 모두 요구하며 메서드 없음/오류/release는 비활성화한다. 브라우저는 web-mock+Vite DEV만 허용한다.

**권한:** 없음, filesDir/cacheDir/SQLite만. **Mock:** IndexedDB와 Blob 파일로 모든 메서드·제약·삭제·큐 재시도 구현, 메모리 성공 no-op 금지. **오류:** `constraint_violation`, `invalid_reference`, `storage_full`, `job_not_claimed`, `file_not_owned`. **검증:** data-model의 전체 제약·삭제표·중복 저장·pending 복구·큐 재시도, DB commit 뒤 이벤트, 사진 삭제 중 늦은 추론/HTTP 응답이 데이터 부활 못 함. (D-R1-04, D-R3-11)

## 10. JS Location / Route / Map / Walk — S09

JS 지도는 MapLibre GL JS, 위치는 Capacitor Geolocation이고 네이티브 지도/외부 지도 앱을 쓰지 않는다. Map/Route는 자체 Java 플러그인을 추가하지 않는다. 이름은 아래 JS 모듈 이름이며 8개 native plugin과 별개다. (D-R5-01~05, D-R7-03)

```ts
// Code-first FastAPI export relay/openapi.json에서 openapi-typescript로
// app/src/generated/relay-api.d.ts를 생성한다. 아래는 생성 타입의 설명용 형태.
// 좌표 순서는 GeoJSON [lng,lat]. 별도 수기 wire 타입을 구현에 만들지 않는다.
type RouteResponse = {
  geometry:{type:'LineString'; coordinates:[number,number][]};
  distanceM:number; durationS:number;
  steps:{distanceM:number; durationS:number; name:string;
    maneuver:{type:string; modifier?:string; location:[number,number]; bearingBefore:number; bearingAfter:number}}[];
  waypoints:{location:[number,number]; distanceM:number}[]; // 정확히 2개
};
interface Location extends Events<{fix:Fix; error:{code:string}}> {
  start():Promise<void>;
  current():Promise<Fix>;
  stop():Promise<void>;
}
interface Route {
  request(o:{origin:Point; destination:Point}):Promise<RouteResponse>;
  cancel():Promise<void>;
}
interface Map extends Events<{ready:{}; error:{code:'map_unavailable'}}> {
  mount(o:{element:HTMLElement}):Promise<void>;
  update(o:{fix:Fix|null; destination:Point; route:RouteResponse|null}):Promise<void>;
  unmount():Promise<void>;
}
type WalkState = {mode:'loading'|'route'|'direction'|'nearby'|'arrived'|'offline'|'error';
  destination:Point; distanceM:number|null; durationS:number|null;
  bearingDeg:number|null; stepIndex:number|null; route:RouteResponse|null};
interface Walk extends Events<{state:WalkState}> {
  start(o:{source:'item'; pieceId:Id}|{source:'result'; resultId:Id}):Promise<WalkState>;
  retry():Promise<WalkState>;
  confirmArrival():Promise<WalkState>;
  stop():Promise<void>;
}
```

### 지도·위치·경로 계약

- Map 스타일 URL `https://tiles.openfreemap.org/styles/liberty`, OpenFreeMap/OSM attribution을 항상 보존. UI 안내는 영어, 지도 라벨은 `name:en` 우선·없으면 제공 name, 지도 지명으로 가게 이름을 생성하지 않는다. 현재 fix 점·고정 목적지 핀·GeoJSON 경로를 표시한다. 목적지 핀 drag listener/API 없음. (D-R5-01~02; research §8.2)
- Location은 Geolocation.requestPermissions/getCurrentPosition/watchPosition을 감싸며 highAccuracy=true, timeout=15초, maximumAge=5초, 위치 수신 목표 간격 5초 [추론]. Walk foreground에서만 watch, 화면 이탈/app pause에서 해제. shopping FGS는 별도로 계속되며 Walk는 trail을 생성하지 않는다. Manifest는 기존 coarse/fine과 INTERNET만, background location 불필요. (D-R0-03, D-R5-04)
- 시작점은 Item 또는 Result 화면뿐이다. start({source:'item',pieceId})는 origin=shop Piece.walkTo, start({source:'result',resultId})는 Result.targetSnapshot.walkTo를 immutable destination으로 사용한다. Result 경로는 원본 targetPieceId의 존재를 요구하지 않는다. 도착 카드의 가게 정보도 Result 진입이면 snapshot.shop을 사용한다. 별도 Shop/Visit 화면과 Trip의 길 안내 액션은 없고 Shop.spot/OSRM snapped endpoint/현재 위치로 목적지를 바꾸는 fallback도 없다. (D-R9-03~04, D-R5-01~03)
- Route는 인증된 `POST /v1/route` body `{origin:{lat,lng},destination:{lat,lng}}`, 응답은 위 OpenAPI 타입. provider는 릴레이 뒤 FOSSGIS OSRM foot. 네트워크 요청 자체에 accuracy/trail/사진/가게 메모를 넣지 않는다. 앱은 요청 1개만 in-flight, 최신 목적/위치 request generation만 적용, 취소 응답 무시. 릴레이가 서비스 전체 1req/s를 보장하고 앱은 재탐색 cooldown 10초 [추론]. 먼 거리도 같은 경로로 안내한다. (D-R5-05, D-R6-04; research §8.2)
- [추론] route 상태는 polyline에 현재 위치를 투영해 진행 거리·다음 maneuver를 계산한다. step 종료점 15m 이내 또는 누적 경로 진행이 다음 step 경계 이상이면 다음 step으로 전환, 5m hysteresis로 GPS 역행에 따라 이전 step으로 되돌리지 않는다. 남은 거리=경로 미진행 길이, 시간=남은 step duration 비례값. 음성 안내·실내 안내는 없다. (D-R5-04)

### 이탈·끝 구간·도착 [추론] 기본값

| 상태 전환 | 조건/동작 | 근거 |
| --- | --- | --- |
| route→재탐색 | accuracyM≤30m fix에 한해 polyline 최소 거리>30m가 10초 지속(최소 3개 fix). 거리≤20m로 복귀 시 타이머 reset. cooldown 10초 후 현재 fix→동일 destination 요청 | D-R5-04 |
| route→direction | 원래 destination 직선 반경≤50m, 또는 route_unavailable/빈 geometry/경로 끝에서 원래 목적지까지 남은 구간이 있음 | D-R5-04 |
| direction 표시 | haversine 직선 거리와 진북 기준 bearing 0~360을 표시. 방위 센서 사용 안 함, 지도 north-up·화살표 북쪽 기준. 불확실한 device heading으로 회전하지 않음 | D-R5-04 |
| direction 유지/재시도 | 경로 없음이면 끝 구간 화살표 유지+수동 retry; 반경>65m로 벗어나고 유효 경로가 있으면 route 복귀 | D-R5-04 |
| nearby | 원래 목적지≤20m, accuracy≤30m가 5초 지속(최소 2 fix). 도착 확인 카드에 외관 사진·메모 표시. 좌표만으로 도착 확정하지 않음 | D-R0-03, D-R5-04 |
| arrived | 사용자가 외관 사진/주변을 보고 confirmArrival. 사진이 없거나 trip 삭제로 없어도 주소를 꾸미지 않고 `"Check the surroundings"`와 수동 확인 허용 | D-R0-03, D-R3-11 |
| offline | 연결이 없으면 명시 offline+retry. route_unavailable와 구별하고 새 경로 요청/큐 등록 없음. 이미 보유한 거리·지도는 참고로만 표시, 온라인 안내 성공으로 표현하지 않음 | D-R6-03 |

**Mock:** Location은 GPX/고정 fix를 가상 clock으로 공급, Route는 route/없음/offline fixture 반환, Map mock은 같은 mount/update API로 SVG 경로를 렌더링하여 S08이 WebGL·타일 네트워크 없이 개발 가능. Walk는 mock에서도 실제 거리/시간 임계값 로직을 실행한다. **오류:** `location_permission_denied`, `location_unavailable`, `route_unavailable`, `offline`, `map_unavailable`, `destination_unavailable`. **검증:** step 순서·이탈 9초/10초 경계·부정확 GPS 무시·중복 요청 억제·50/65m hysteresis·20m 수동 도착·Item의 사진 위치·원본 Piece/Trip 삭제 후 Result snapshot 길 안내·Item/Result 이외 진입 및 Shop.spot 목적지 경로 부재·핀 drag 불가·먼 거리 외부앱 미사용. (D-R1-04, D-R5-01~05, D-R9-03~04)

## 11. 슬라이스 소유권·통합 이벤트

| 담당 | 구현 책임 | 소비자/검증 경계 | 근거 |
| --- | --- | --- | --- |
| S04 app-capture | ShoppingSession, Capture, Media, Voice native+web | S08 화면, S05 색인, S06 저장/큐 | D-R7-04 |
| S05 app-ml | PhotoIndex, Segmenter, FaceMask native+web, 모델 loader, 마스킹·재합성 알고리즘/자동 판정 | S04 촬영, S07 검색, S10 피팅 JS | D-R7-04, D-R9-01 |
| S06 app-data | `app/src/data/**`, 네이티브 `plugins/store/`, `app/src/native/store.ts`, Store web mock; DB/파일/원자 삭제/대기열 저장·재시도·worker·두 handler 전체 | 전 슬라이스 공통 repository | D-R7-04, D-R6-03 |
| S09 app-walk | Location/Route/Map/Walk JS+mock | S08 지도 화면, S03 route API | D-R7-04 |
| S10 app-tryon | 피팅 JS 오케스트레이션, S05 FaceMask 호출, S06 결과 snapshot 준비/저장 호출, maskedFile 전송 보장·결과 export gate | S03 tryon API, S08 피팅 화면 | D-R7-04, D-R9-01~03 |
| S07 app-agent | 검색 에이전트 루프만; 대기열 worker/handler는 소유하지 않음 | S06 데이터, S05 색인, 릴레이 검색 엔드포인트 | D-R7-04, D-R1-02 |
| S08 app-ui | 위 인터페이스만 사용, native 분기 없는 화면 | 권한/실패/오프라인/로드 상태를 mock으로 개발 | D-R1-03~04 |
| S11 verification | fixture·실제 API 1회씩 종단, 마스킹/메타데이터 검증 | 실기기 시연 필수 아님 | D-R7-05 |

## 12. 모델 배포·Android 16 KB 선행 조건

- **선택: 빌드 때 `SF_MODELS_DIR`의 모델을 APK assets로 복사한다. 모델을 첫 실행 adb push로 넣는 경로는 두지 않는다.** Gradle project property `SF_MODELS_DIR` > 환경 변수 > 기본 `~/.cache/street-fitting/models` 순으로 해석한다. Gradle generated assets task가 `models/edgetam_encoder.onnx`, `models/edgetam_decoder.onnx`, `models/pe_image.onnx`를 포함하며 누락은 build 실패. `noCompress 'onnx'`, model manifest의 SHA-256/shape로 일치 확인한다. (D-R7-03, D-R7-11)
- EdgeTAM 합계 약 **36 MB**(18.8+15.7 MiB), PE 이미지 약 **32 MB**(30.5 MiB). PE text tower는 릴레이 전용으로 APK에 넣지 않는다. 원 `/tmp/edgetam-poc` 묶음은 사용자 위임 준비에서 `SF_MODELS_DIR`에 보존했고, 루트 ONNX 3개는 `artifacts/` 원본을 가리킨다. export 코드·전처리·hash 및 M1 검증은 [준비 기록](../README.md#모델-배치와-오프라인-검증)을 읽는다. (D-R7-11; research §7.1·8.1)
- Java loader는 assets를 앱 전용 `files/models/<hash>/`에 최초 1회 원자 복사하고 OrtSession을 파일 경로로 연다. 매 실행 model byte[]/base64 복사 금지. hash가 같으면 재복사 안 함. 여러 feature는 공유 session을 사용하고 모델 없는 경우 mock으로 자동 전환하지 않는다. (D-R7-03)
- ONNX Runtime Android AAR의 arm64 `.so`가 16 KB ELF page alignment를 제공하는 버전을 선정한다. 자체 JNI가 필요하면 NDK r28+ 또는 `-Wl,-z,max-page-size=16384`로 빌드한다. Java만 작성해도 패키징된 ORT `.so` 검증 의무가 사라지지 않는다. APK zip alignment와 ELF segment alignment를 모두 S11에서 확인하고 16 KB 에뮬레이터에서 로드·추론한다. research §7.1의 standalone runner 해결을 앱 AAR 검증으로 대체하지 않는다. (D-R7-03, D-R1-04)
- 문서 작성 당시 미실행이던 모델 복사·호스트 추론은 별도 준비 기록에 구분했다. Android 앱의 설치·모델 패키징·16 KB 실제 추론·실제 API 검증은 여전히 각 구현 및 S11 작업의 명시 gate다. (D-R7-05, D-R7-11)
