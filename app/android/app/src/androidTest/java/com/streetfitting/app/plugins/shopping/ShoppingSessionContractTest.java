package com.streetfitting.app.plugins.shopping;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.service.notification.StatusBarNotification;
import androidx.core.content.ContextCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.BySelector;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import com.getcapacitor.JSObject;
import com.streetfitting.app.MainActivity;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ShoppingSessionContractTest {
    private void clean(NativeHarness harness) throws Exception {
        ShoppingService service = ShoppingService.active();
        if (service != null) service.stopRecording().get(20, TimeUnit.SECONDS);
        JSObject session = RepositoryProvider.get(harness.context).getSession();
        if (session.getJSObject("trip") != null) RepositoryProvider.get(harness.context).stopSession(new JSObject().put("tripId", session.getJSObject("trip").optString("id")).put("endedAt", System.currentTimeMillis()));
        NativeHarness.until(() -> ShoppingService.active() == null, 5000);
    }
    private JSObject start(NativeHarness harness) throws Exception {
        return harness.invoke("ShoppingSession", "start", new JSObject()).await();
    }
    private MainActivity resumedActivity() {
        AtomicReference<MainActivity> current = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            for (android.app.Activity activity : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))
                if (activity instanceof MainActivity) current.set((MainActivity) activity);
        });
        return current.get();
    }
    private MainActivity awaitActivity(MainActivity previous) {
        AtomicReference<MainActivity> current = new AtomicReference<>();
        NativeHarness.until(() -> {
            MainActivity activity = resumedActivity();
            if (activity == null || activity == previous) return false;
            current.set(activity); return true;
        }, 10000);
        return current.get();
    }
    private void tapNotification(NativeHarness harness, String action) throws Exception {
        harness.device.openNotification();
        BySelector selector = (action == null ? By.textContains("photos") : By.text(action)).pkg("com.android.systemui");
        UiObject2 target = harness.device.wait(Until.findObject(selector), 3000);
        if (target == null) {
            UiObject2 expand = harness.device.findObject(By.descContains("Expand").pkg("com.android.systemui"));
            if (expand != null) expand.click();
            target = harness.device.wait(Until.findObject(selector), 3000);
        }
        assertNotNull("Notification target unavailable", target);
        harness.evidence(action == null ? "shopping-notification" : "shopping-notification-" + action.replace(' ', '-'));
        target.click();
    }
    @Test public void notificationActionsOpenAndNewShopExactlyOnce() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: grant location and inject a current emulator GPS fix", LocationFixes.permitted(harness.context));
            assertEquals("Setup: grant POST_NOTIFICATIONS", PackageManager.PERMISSION_GRANTED, ContextCompat.checkSelfPermission(harness.context, Manifest.permission.POST_NOTIFICATIONS));
            clean(harness); JSObject initial = start(harness);
            NotificationManager manager = harness.context.getSystemService(NotificationManager.class);
            StatusBarNotification[] cards = manager.getActiveNotifications(); assertEquals(1, cards.length);
            Notification card = cards[0].getNotification(); assertEquals(2, card.actions.length);
            // ActivityScenario filters by the launch Intent. Real notification
            // delivery changes it, so observe the subsequent real lifecycle directly.
            harness.activity.close();
            try {
                tapNotification(harness, null);
                awaitActivity(null);
                assertTrue(harness.device.wait(Until.hasObject(By.text("Shopping mode is on").pkg("com.streetfitting.app")), 20000));
                tapNotification(harness, "Take photo");
                awaitActivity(null);
                assertTrue(harness.device.wait(Until.hasObject(By.text("Camera").pkg("com.streetfitting.app")), 20000));
                harness.device.swipe(harness.device.getDisplayWidth()/2, harness.device.getDisplayHeight()*3/4,
                    harness.device.getDisplayWidth()/2, harness.device.getDisplayHeight()/3, 30);
                boolean shutterReady = harness.device.wait(Until.hasObject(By.text("Take photo").enabled(true).pkg("com.streetfitting.app")), 20000);
                harness.evidence("shopping-notification-capture");
                assertTrue("Preview must reopen after the notification", shutterReady);
                tapNotification(harness, "New shop");
                MainActivity previous = awaitActivity(null);
                int n = initial.getJSObject("shop").optInt("n") + 1;
                NativeHarness.until(() -> ShoppingService.active().state().getJSObject("shop").optInt("n") == n, 20000);
                assertTrue(harness.device.wait(Until.hasObject(By.text("Shop " + n + " started").pkg("com.streetfitting.app")), 20000));
                InstrumentationRegistry.getInstrumentation().runOnMainSync(previous::recreate);
                MainActivity recreated = awaitActivity(previous);
                NativeHarness.TestCall state = new NativeHarness.TestCall("ShoppingSession", "getState", new JSObject());
                InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                    ((ShoppingSessionPlugin) recreated.getBridge().getPlugin("ShoppingSession").getInstance()).getState(state));
                assertEquals(n, state.await().getJSObject("shop").optInt("n"));
            } finally {
                clean(harness);
                InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                    for (Stage stage : Stage.values())
                        for (android.app.Activity screen : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(stage))
                            if (screen instanceof MainActivity && !screen.isFinishing() && !screen.isDestroyed()) screen.finish();
                });
            }
        }
    }
    @Test public void swipeRecentsThenReopenRestoresRecording() throws Exception {
        String tripId; long prior;
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: inject GPS throughout the swipe scenario", LocationFixes.permitted(harness.context)); clean(harness); JSObject state = start(harness);
            tripId = state.getJSObject("trip").optString("id"); prior = state.getJSObject("latestFix").optLong("t");
            harness.device.pressRecentApps(); harness.device.waitForIdle();
            int width = harness.device.getDisplayWidth(); int height = harness.device.getDisplayHeight();
            harness.device.swipe(width / 2, height / 2, width / 2, height / 8, 30); harness.evidence("shopping-recent-task-swiped"); harness.device.pressHome();
            NativeHarness.until(() -> ShoppingService.active() != null && ShoppingService.active().state().getJSObject("latestFix").optLong("t") > prior, 20000);
        }
        try (NativeHarness reopened = new NativeHarness()) {
            JSObject restored = reopened.invoke("ShoppingSession", "getState", new JSObject()).await();
            assertEquals("recording", restored.optString("phase")); assertEquals(tripId, restored.getJSObject("trip").optString("id"));
            reopened.evidence("shopping-restored"); reopened.invoke("ShoppingSession", "stop", new JSObject()).await();
        }
    }
    @Test public void stopDeletesAllTrailKeepsPhotos() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: inject a current emulator GPS fix", LocationFixes.permitted(harness.context)); clean(harness); JSObject state = start(harness);
            String tripId = state.getJSObject("trip").optString("id"); String shopId = state.getJSObject("shop").optString("id");
            JSObject before = RepositoryProvider.get(harness.context).get(new JSObject().put("entity", "Shop").put("id", shopId));
            int photos = RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "Photo").put("tripId", tripId)).optJSONArray("items").length();
            JSObject stopped = harness.invoke("ShoppingSession", "stop", new JSObject()).await(); assertEquals("ended", stopped.getJSObject("trip").optString("status"));
            assertEquals(0, RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "TrailPoint").put("tripId", tripId)).optJSONArray("items").length());
            assertEquals(photos, RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "Photo").put("tripId", tripId)).optJSONArray("items").length());
            assertEquals(before.getJSObject("spot").toString(), RepositoryProvider.get(harness.context).get(new JSObject().put("entity", "Shop").put("id", shopId)).getJSObject("spot").toString());
            NativeHarness.until(() -> ShoppingService.active() == null, 5000); assertEquals(0, harness.context.getSystemService(NotificationManager.class).getActiveNotifications().length);
        }
    }
    @Test public void explicitStartEndsOrphanedRecordingInsteadOfResumingIt() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: grant location and inject current GPS", LocationFixes.permitted(harness.context));
            clean(harness);
            JSObject fix = LocationFixes.current(harness.context).get(20, TimeUnit.SECONDS);
            JSObject orphan = RepositoryProvider.get(harness.context).startSession(new JSObject().put("fix", fix));
            String oldId = orphan.getJSObject("trip").optString("id");
            JSObject current = start(harness);
            try {
                assertNotEquals(oldId, current.getJSObject("trip").optString("id"));
                assertEquals("ended", RepositoryProvider.get(harness.context).get(new JSObject().put("entity", "Trip").put("id", oldId)).optString("status"));
                assertEquals(0, RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "TrailPoint").put("tripId", oldId)).optJSONArray("items").length());
            } finally { harness.invoke("ShoppingSession", "stop", new JSObject()).await(); }
        }
    }
    @Test public void stopWaitsForShutterAndDoesNotAcceptAnother() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: grant location and inject current GPS", LocationFixes.permitted(harness.context));
            clean(harness); JSObject state = start(harness);
            ShoppingService service = ShoppingService.active();
            service.beginShutter(System.currentTimeMillis());
            java.util.concurrent.CompletableFuture<JSObject> stopped = service.stopRecording();
            try {
                assertFalse(stopped.isDone());
                assertEquals("recording", RepositoryProvider.get(harness.context).get(new JSObject().put("entity", "Trip").put("id", state.getJSObject("trip").optString("id"))).optString("status"));
                try { service.beginShutter(System.currentTimeMillis()); fail("stopping accepted shutter"); }
                catch (IllegalStateException expected) { assertEquals("not_recording", expected.getMessage()); }
            } finally { service.endShutter(false); }
            assertEquals("ended", stopped.get(20, TimeUnit.SECONDS).optString("status"));
            NativeHarness.until(() -> ShoppingService.active() == null, 5000);
        }
    }
    @Test public void deletingRecordingTripInvalidatesServiceWithoutDeadlock() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: grant location and inject current GPS", LocationFixes.permitted(harness.context));
            clean(harness); JSObject state = start(harness);
            ShoppingService service = ShoppingService.active();
            String id = state.getJSObject("trip").optString("id");
            java.util.concurrent.CompletableFuture.runAsync(() -> RepositoryProvider.get(harness.context).deleteTrip(new JSObject().put("id", id))).get(10, TimeUnit.SECONDS);
            NativeHarness.until(() -> ShoppingService.active() == null, 5000);
            assertNull(RepositoryProvider.get(harness.context).getSession().getJSObject("trip"));
            try { service.beginShutter(System.currentTimeMillis()); fail("deleted trip accepted shutter"); }
            catch (IllegalStateException expected) { assertEquals("not_recording", expected.getMessage()); }
        }
    }
}
