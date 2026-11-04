# S04 frozen WIP checkpoint — NOT ACCEPTED

Frozen immediately on coordinator USER STOP (2026-11-04). No further implementation, installs, builds, tests, emulator work, or servers were started after that instruction.

- Worktree: `/Users/user/orca/workspaces/Meta-Hackathon/s04-app-capture`
- Branch: `kjhh2605/s04-app-capture`
- Checkpoint: `e1b30d299f97056e6bf8b6e990ea1bc249378c74`
- Remote: pushed to `origin/kjhh2605/s04-app-capture` successfully.
- Commit subject: `WIP S04 checkpoint: unverified native capture and shopping lifecycle`
- PR: none (explicit freeze instruction forbids opening one).
- Base: S00 `23baff764ed622be9dd2ed4e0673f60747937a7d`.
- No shared files changed. No secrets, model weights, image/audio fixtures, or evidence assets committed.

## Observed commands/results

Only source reads/writes and orchestration coordination occurred during implementation. **No build, lint, unit test, instrumentation test, device command, or runtime smoke was executed.** Therefore no CameraX/MIC/FGS/notification/picker/VAD/persistence behavior is claimed verified, and there are no acceptance screenshots/XML/logs.

Checkpoint commands:
- `git status --short --branch --untracked-files=all`: 9 modified + 21 new owned files, branch `kjhh2605/s04-app-capture`.
- Owned-only `git add` source-set pathspecs plus four TS modules; `git commit -m "WIP S04 checkpoint: unverified native capture and shopping lifecycle"`: succeeded, 30 files, +2029/-74.
- `git rev-parse HEAD`: `e1b30d299f97056e6bf8b6e990ea1bc249378c74`.
- `git push -u origin kjhh2605/s04-app-capture`: succeeded, new remote branch.

No worker-owned services, background jobs, servers, emulator instances, or helper agents were started. Nothing worker-owned needs shutdown. Coordinator's existing emulator was never touched. Setup was not repeated.

## Written implementation (uncompiled/unexercised)

- Shopping: permission bridge; FusedLocation current-fix bound and ongoing subscription; Service with fixed notification/channel and three immutable deep links; start/new-shop/stop repository operations; shutter leases delaying explicit stop; state/events; stale-session cleanup in getState; notification New shop consumed before open event.
- Capture: CameraX Preview/ImageCapture using COMPATIBLE PreviewView; CSS viewport placement behind transparent WebView; pause/resume; normalized JPEG EXIF rotation/front mirror; shutter trip/shop/time snapshot; nearest/fresh fix selection; commitPhoto and asynchronous PhotoIndex dispatch; temporary self/wardrobe assets.
- Debug capture factory: external-files canonical allowlist, sorted images, process index, advance after commit; separate release CameraX-only factory.
- Media: OS Photo Picker/API fallback, private normalized imports; GPS-free photo copy with pending MediaStore publishing/API24 document output; result export hard-disabled; repository-backed asset discard.
- Voice: AudioRecord MIC PCM16 mono16k, reusable 20ms frames, energy VAD, canonical WAV writer, recording terminal future, cancellation, debug real-time WAV reader and separate release MIC factory.
- Web: four WebPlugin classes share proposed S06 IndexedDB/Blob repository, injectable mock context, shopping/capture lease state, media metadata stripping, real PCM-consuming VAD/timed frames. These imports cannot work on this worktree until S06 web implementation is integrated.
- Tests written but not run: native OS acceptance harness + Shopping/Capture/Media/Voice instrumentation classes; JVM EnergyVad and WavWriter boundary tests.

## Missing integration prerequisites

1. **S06 native and web repository not merged here.** Current S00 NativeRepository still lacks used methods; current branch cannot compile until integration. Confirmed S06 additions: getSession()->{trip,shop,photos:Photo[],latestFix}, nearestFix({tripId,takenAt}), getPhoto({id}), appendTrail({tripId,fix}), registerAsset({asset,purpose})->Asset (NEW owned file), getAsset({id}), discardAsset({assetId}), setSessionStopper(Runnable). Six domain methods remain fixed. S06 copies/transfers input files; caller must use returned reference. Stopper runs synchronously under repository monitor and must never wait on another repository thread.
2. Web import `getWebRepository` from `app/src/data/web/repository.ts`; confirmed instance methods `readBlob(file)`, `writeBlob(blob,purpose,ownerId?)`, `discardTemp({file})`, `getAsset({id})`, `discardAsset({assetId})`, matching domain/session helpers. Test constructor/reset API still awaited. Web helper terminal: `term_32d67137-655e-4364-8442-2298408c6f70`; S06 owner: `term_3af2325d-8bf4-443d-ac64-ee23d3557909`.
3. **S05 dispatch not merged here.** Confirmed public static `PhotoIndexPlugin.dispatch(Context,String photoId)`, nonblocking/single-flight and persists index failure. Owner `term_517a7399-f3da-4266-8c3e-92879343558e`.
4. Coordinator accepted shared Gradle `androidTestImplementation 'androidx.test.uiautomator:uiautomator:2.3.0'`, but commit not received/integrated. NativeHarness imports it.
5. S11 fixture boundary corpus not integrated. Requested capture EXIF GPS/date/orientation and corrupt/empty; voice `tone-silence`, `silence`, `limit-15s`, `corrupt`, `empty` subdirectories. Shared deterministic tone is sufficient for VAD-only acceptance, not transcription or MIC hardware proof. Last observed S11 has `voice/{normal,silence,limit-15s,over-15s}` and capture boundary work in progress. Owner `term_22157d9e-4c67-4995-9771-ee6769ecb585`.

## Known unfinished/risky work — fix before any acceptance claim

These are code-review findings/inferences, not observed test failures:

- Entire source set remains uncompiled; resolve concrete integration/type/API errors after S06/S05/shared dependency integration.
- **MediaContractTest.photo currently passes the shared EXIF fixture itself to commitPhoto. S06 transfers/deletes non-store staging files. Copy the fixture into cache first or this test may consume the fixture.** Do not run it unchanged.
- Web Voice allows a new start while previous async Blob finalization is pending because terminal is set early; add settled/finalization fencing. Cancellation during no_speech completion can still emit an error after cancel; guard all terminal notifications. Keep completed exactly once.
- Web ShoppingSession does not yet observe location/permission changes after start. Add faithful injected-clock/context update behavior and permission-revoke stop/delete semantics without separate storage.
- Native repository deletion stopper currently stops FGS/location but does not clear phase/trip/shop state. Address without acquiring service monitor under repository monitor or waiting on repository thread.
- Native start only cleans stale DB recording through getState; direct start after force-stop could restore stale trip. Ensure explicit start without live service ends stale session and creates a fresh one; preserve START_STICKY persisted resume semantics.
- Native service stop/start race and already-posted notification refresh can reintroduce stale notification/session state. Review pending starts/stops, startup future lifetime, duplicate onStartCommand, shutdown callbacks, revoked permission handling and stop failure recovery.
- Capture preview async open/close lifecycle needs generation fencing; shutter/close/pause and debug committed() view update races need exercising. CameraX front orientation/mirror must be observed.
- Native capture nearest-fix/current-location failure cleanup and no-photo/no-index behavior need dedicated negative instrumentation. Existing fixture-cycle test does not yet prove image order/wrap; strengthen pixel/hash expectations rather than only IDs.
- Shopping stop-preserves-photos test currently compares a potentially empty photo set; populate a real captured Photo first. Capture storefront test additionally asserts photo remains after stop, but session acceptance needs the named direct invariant.
- Native tests use assumed system picker IDs and notification expansion selectors; exercise actual API37 OS surface and adjust from observation. No fake app OS UI should be introduced.
- Media export provider-file test currently proves only hard-disabled call plus unchanged local file, not a persisted Result graph; strengthen real repository fixture coverage.
- NativeHarness ActivityScenario CREATED-state invocation and task-swipe handling may need lifecycle-specific adjustment after actual execution.
- Missing all four TS test files (`shoppingSession.test.ts`, `capture.test.ts`, `media.test.ts`, `voice.test.ts`). Must test actual shared S06 web storage with deterministic fixtures, not separate production mock repository.
- Missing release source-set fixture exclusion acceptance tests and release APK exclusion observation.
- No docs/changelog update yet; ownership means request coordinator for required shared docs changes after real smoke.
- No acceptance logs/privacy scan, APK install, runtime behavior, or evidence artifacts.

## Integration contracts already communicated

- S08 listens native `ShoppingSession.open` only for notification New shop; native consumes action once and UI must not call newShop again.
- Capture rect is viewport CSS pixels; UI owns transparent ancestor lifetime and closes preview on leaving capture.
- Storefront capture targets only current recording shop. Historical shop targeting is unsupported by frozen API; S08 agreed active-current-shop only.
- Voice completed is sole transcribe trigger; S07 awaits cancel and fences generations before next start. Completed WAV is app cache file://; S07 uses shared file read/discardTemp, not additional Voice API.
- S10 result export stays OFF without approved S11 preservation/provenance policy; native independently rejects.
- Injected web fixture keys: permissions location/notification/camera/microphone; location Fix; capture Asset[]; media.wardrobe/media.self Asset|null; voice Int16Array. Blob refs must be registered with S06 repository.

## Restart sequence

1. Read `/tmp/sf-wave1-common.md`, S04 slice and references; source `scripts/worktree-env.sh` from root (setup already done). Preserve these exact changes.
2. Integrate S06 actual native/web implementation, S05 dispatch, coordinator UiAutomator dependency, S11 fixtures. Resolve confirmed signatures and test/reset seam; do not create SQLite/IndexedDB duplicate or production fake.
3. Fix findings above and finish missing tests. Then run acceptance once after implementation, with necessary failing-path fixes afterward.
4. One emulator only. All device operations including installs/auth restore/fixture pushes/GPS/UI assertions/cleanup belong in one `scripts/emulator-lock.sh` scenario. Keep Gradle `--max-workers=2`. Android relay URL must explicitly be `http://10.0.2.2:$RELAY_PORT`; loggingBehavior stays none. Restore App Check credentials after reinstalls without printing secrets.
5. Follow exact S04 acceptance commands; inspect real notification card/actions/deep links/recent-task swipe, SQLite trail deletion, CameraX success and denial, system picker/export URI EXIF, debug real-time VAD scenarios and release exclusion. No claims of real MIC hardware from fixture tests.
6. Send observed evidence/remaining external blockers only. This checkpoint is unfinished WIP, not S04 completion.

## Exact changed/new paths (30)

Modified:
- app/android/app/src/main/java/com/streetfitting/app/plugins/capture/CapturePlugin.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/media/MediaPlugin.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/shopping/ShoppingService.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/shopping/ShoppingSessionPlugin.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/VoicePlugin.java
- app/src/native/capture.ts
- app/src/native/media.ts
- app/src/native/shoppingSession.ts
- app/src/native/voice.ts

New:
- app/android/app/src/androidTest/java/com/streetfitting/app/plugins/capture/CaptureContractTest.java
- app/android/app/src/androidTest/java/com/streetfitting/app/plugins/media/MediaContractTest.java
- app/android/app/src/androidTest/java/com/streetfitting/app/plugins/shopping/NativeHarness.java
- app/android/app/src/androidTest/java/com/streetfitting/app/plugins/shopping/ShoppingSessionContractTest.java
- app/android/app/src/androidTest/java/com/streetfitting/app/plugins/voice/VoiceContractTest.java
- app/android/app/src/debug/java/com/streetfitting/app/plugins/capture/CaptureSourceFactory.java
- app/android/app/src/debug/java/com/streetfitting/app/plugins/voice/VoiceSourceFactory.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/capture/CameraSource.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/capture/CaptureSource.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/media/ImageFiles.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/shopping/LocationFixes.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/EnergyVad.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/MicrophoneSource.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/PcmSource.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/VoiceFailure.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/VoiceRecorder.java
- app/android/app/src/main/java/com/streetfitting/app/plugins/voice/WavWriter.java
- app/android/app/src/release/java/com/streetfitting/app/plugins/capture/CaptureSourceFactory.java
- app/android/app/src/release/java/com/streetfitting/app/plugins/voice/VoiceSourceFactory.java
- app/android/app/src/test/java/com/streetfitting/app/plugins/voice/EnergyVadTest.java
- app/android/app/src/test/java/com/streetfitting/app/plugins/voice/WavWriterTest.java
