package com.streetfitting.app.plugins.shopping;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.service.notification.StatusBarNotification;
import androidx.core.content.ContextCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import com.getcapacitor.JSObject;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.util.concurrent.TimeUnit;
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
    @Test public void notificationActionsOpenAndNewShopExactlyOnce() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertTrue("Setup: grant location and inject a current emulator GPS fix", LocationFixes.permitted(harness.context));
            assertEquals("Setup: grant POST_NOTIFICATIONS", PackageManager.PERMISSION_GRANTED, ContextCompat.checkSelfPermission(harness.context, Manifest.permission.POST_NOTIFICATIONS));
            clean(harness); JSObject initial = start(harness);
            NativeHarness.TestCall opened = harness.listen("ShoppingSession", "open");
            NotificationManager manager = harness.context.getSystemService(NotificationManager.class);
            StatusBarNotification[] cards = manager.getActiveNotifications(); assertEquals(1, cards.length);
            Notification card = cards[0].getNotification(); assertEquals(2, card.actions.length);
            assertEquals("Take photo", card.actions[0].title.toString()); assertEquals("New shop", card.actions[1].title.toString());
            harness.device.openNotification(); assertNotNull(harness.device.wait(Until.findObject(By.textContains("photos")), 3000));
            UiObject2 expand = harness.device.findObject(By.descContains("Expand")); if (expand != null) expand.click();
            assertNotNull(harness.device.wait(Until.findObject(By.text("Take photo")), 3000)); assertNotNull(harness.device.findObject(By.text("New shop"))); harness.evidence("shopping-notification"); harness.device.pressBack();
            card.contentIntent.send(); NativeHarness.until(() -> opened.values.size() == 1, 4000); assertEquals("streetfitting://home", opened.values.get(0).optString("url"));
            card.actions[0].actionIntent.send(); NativeHarness.until(() -> opened.values.size() == 2, 4000); assertEquals("streetfitting://capture", opened.values.get(1).optString("url"));
            card.actions[1].actionIntent.send(); NativeHarness.until(() -> opened.values.size() == 3, 20000);
            assertEquals("streetfitting://capture?newShop=1", opened.values.get(2).optString("url"));
            int n = initial.getJSObject("shop").optInt("n") + 1;
            assertEquals(n, harness.invoke("ShoppingSession", "getState", new JSObject()).await().getJSObject("shop").optInt("n"));
            harness.activity.recreate();
            assertEquals(n, harness.invoke("ShoppingSession", "getState", new JSObject()).await().getJSObject("shop").optInt("n"));
            harness.invoke("ShoppingSession", "stop", new JSObject()).await();
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
