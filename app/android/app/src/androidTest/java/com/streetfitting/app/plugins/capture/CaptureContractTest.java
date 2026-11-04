package com.streetfitting.app.plugins.capture;

import android.content.Intent;
import android.graphics.BitmapFactory;
import android.os.SystemClock;
import androidx.exifinterface.media.ExifInterface;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.streetfitting.app.plugins.media.ImageFiles;
import com.streetfitting.app.plugins.shopping.NativeHarness;
import com.streetfitting.app.plugins.shopping.ShoppingService;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.io.File;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CaptureContractTest {
    private NativeHarness fixture(String directory) {
        return new NativeHarness(new Intent().putExtra("sf_capture_source", "fixture").putExtra("sf_capture_fixture_dir", "/sdcard/Android/data/com.streetfitting.app/files/" + directory));
    }
    private void preview(NativeHarness harness, String purpose) throws Exception {
        harness.invoke("Capture", "setPreviewRect", new JSObject().put("x", 20).put("y", 80).put("width", 240).put("height", 320)).await();
        harness.invoke("Capture", "openPreview", new JSObject().put("purpose", purpose).put("facing", "back")).await();
    }
    private JSObject shopping(NativeHarness harness) throws Exception {
        if (ShoppingService.active() != null) ShoppingService.active().stopRecording().get(20, TimeUnit.SECONDS);
        NativeHarness.until(() -> ShoppingService.active() == null, 5000);
        NativeHarness.TestCall call = harness.invoke("ShoppingSession", "start", new JSObject()); harness.dismissPermission(true); return call.await();
    }
    @Test public void fixtureCaptureUsesShutterFixAndAtomicStorefrontQueue() throws Exception {
        try (NativeHarness harness = fixture("capture-fixtures")) {
            JSObject state = shopping(harness); preview(harness, "shopping");
            long before = System.currentTimeMillis(); JSObject result = harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "storefront")).await(); long after = System.currentTimeMillis();
            JSObject photo = result.getJSObject("photo"); assertNotNull(photo); assertEquals(state.getJSObject("trip").optString("id"), photo.optString("tripId"));
            assertTrue(photo.optLong("takenAt") >= before && photo.optLong("takenAt") <= after);
            assertEquals(37.5, photo.getJSObject("location").optDouble("lat"), 0.001); assertEquals(127.0, photo.getJSObject("location").optDouble("lng"), 0.001);
            File file = ImageFiles.local(photo.optString("file")); assertTrue(file.getCanonicalPath().startsWith(harness.context.getFilesDir().getCanonicalPath() + File.separator));
            assertNull(new ExifInterface(file).getLatLong());
            JSObject shop = RepositoryProvider.get(harness.context).get(new JSObject().put("entity", "Shop").put("id", photo.optString("shopId")));
            assertEquals(photo.optString("id"), shop.optString("storefrontPhotoId")); assertEquals("pending", shop.optString("descriptionState"));
            org.json.JSONArray jobs = RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "QueueJob")).optJSONArray("items");
            int matching = 0; for (int i = 0; i < jobs.length(); i++) if ("describe_storefront".equals(jobs.getJSONObject(i).optString("kind")) && photo.optString("id").equals(jobs.getJSONObject(i).optString("refId"))) matching++;
            assertEquals(1, matching); harness.evidence("capture-fixture-preview");
            harness.invoke("ShoppingSession", "stop", new JSObject()).await();
            assertEquals(0, RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "TrailPoint").put("tripId", photo.optString("tripId"))).optJSONArray("items").length());
            assertNotNull(RepositoryProvider.get(harness.context).getPhoto(new JSObject().put("id", photo.optString("id"))));
            harness.invoke("Capture", "closePreview", new JSObject()).await();
        }
    }
    @Test public void selfCaptureDoesNotCreateShoppingPhotoAndFixtureCycles() throws Exception {
        try (NativeHarness harness = fixture("capture-cases/exif")) {
            int before = RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "Photo")).optJSONArray("items").length();
            preview(harness, "self");
            JSObject first = harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "item")).await();
            assertTrue(first.isNull("photo")); File file = ImageFiles.local(first.getJSObject("asset").optString("file"));
            ExifInterface exif = new ExifInterface(file); assertNull(exif.getLatLong()); assertEquals(0, exif.getRotationDegrees());
            BitmapFactory.Options size = new BitmapFactory.Options(); size.inJustDecodeBounds = true; BitmapFactory.decodeFile(file.getPath(), size);
            assertEquals(first.getJSObject("asset").optInt("w"), size.outWidth); assertEquals(first.getJSObject("asset").optInt("h"), size.outHeight);
            harness.invoke("Capture", "closePreview", new JSObject()).await(); preview(harness, "self");
            JSObject second = harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "item")).await();
            assertNotEquals(first.getJSObject("asset").optString("id"), second.getJSObject("asset").optString("id"));
            assertEquals(before, RepositoryProvider.get(harness.context).list(new JSObject().put("entity", "Photo")).optJSONArray("items").length());
            assertEquals("invalid_argument", harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "storefront")).failure());
            harness.invoke("Media", "discard", new JSObject().put("assetId", first.getJSObject("asset").optString("id"))).await();
            harness.invoke("Media", "discard", new JSObject().put("assetId", second.getJSObject("asset").optString("id"))).await();
        }
    }
    @Test public void corruptFixtureNeverFallsBackToCamera() throws Exception {
        try (NativeHarness harness = fixture("capture-cases/corrupt")) {
            assertEquals("invalid_fixture", harness.invoke("Capture", "openPreview", new JSObject().put("purpose", "self").put("facing", "back")).failure());
        }
        try (NativeHarness harness = fixture("capture-cases/empty")) {
            assertEquals("fixture_unavailable", harness.invoke("Capture", "openPreview", new JSObject().put("purpose", "self").put("facing", "back")).failure());
        }
    }
    @Test public void cameraPermissionDenialDoesNotUseFixture() throws Exception {
        try (NativeHarness harness = new NativeHarness(new Intent().putExtra("sf_capture_source", "camera"))) {
            org.junit.Assume.assumeTrue(androidx.core.content.ContextCompat.checkSelfPermission(harness.context, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED);
            NativeHarness.TestCall call = harness.invoke("Capture", "openPreview", new JSObject().put("purpose", "self").put("facing", "back")); harness.dismissPermission(false);
            assertEquals("permission_denied", call.failure()); assertEquals("preview_not_ready", harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "item")).failure()); harness.evidence("camera-permission-denied");
        }
    }
    @Test public void cameraXPreviewAndShutterWithGrantedPermission() throws Exception {
        try (NativeHarness harness = new NativeHarness(new Intent().putExtra("sf_capture_source", "camera"))) {
            org.junit.Assume.assumeTrue(androidx.core.content.ContextCompat.checkSelfPermission(harness.context, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED);
            preview(harness, "self"); SystemClock.sleep(1000); harness.evidence("camerax-preview");
            JSObject result = harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "item")).await();
            File file = ImageFiles.local(result.getJSObject("asset").optString("file")); assertNotNull(BitmapFactory.decodeFile(file.getPath()));
            harness.activity.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
            assertEquals("preview_not_ready", harness.invoke("Capture", "takePhoto", new JSObject().put("kind", "item")).failure());
            harness.activity.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED); SystemClock.sleep(500);
            harness.invoke("Media", "discard", new JSObject().put("assetId", result.getJSObject("asset").optString("id"))).await();
        }
    }
}
