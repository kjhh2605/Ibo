package com.streetfitting.app.plugins.media;

import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.exifinterface.media.ExifInterface;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import com.getcapacitor.JSObject;
import com.streetfitting.app.plugins.shopping.NativeHarness;
import com.streetfitting.app.plugins.shopping.ShoppingService;
import com.streetfitting.app.plugins.store.NativeRepository;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class MediaContractTest {
    private File source(NativeHarness harness) {
        File[] files = new File(harness.context.getFilesDir(), "capture-cases/exif").listFiles(file -> file.isFile() && file.getName().endsWith(".jpg"));
        assertNotNull("S11 EXIF fixture directory missing", files); assertTrue("S11 EXIF JPEG missing", files.length > 0); Arrays.sort(files); return files[0];
    }
    private JSObject photo(NativeHarness harness) throws Exception {
        NativeRepository repository = RepositoryProvider.get(harness.context);
        if (ShoppingService.active() != null) harness.invoke("ShoppingSession", "stop", new JSObject()).await();
        NativeHarness.until(() -> ShoppingService.active() == null, 5000);
        JSObject session = harness.invoke("ShoppingSession", "start", new JSObject()).await();
        File source = source(harness);
        byte[] sourceHash = digest(source);
        File staging = File.createTempFile("media-contract-", ".jpg", harness.context.getCacheDir());
        try {
            try (InputStream input = new FileInputStream(source); OutputStream output = new FileOutputStream(staging)) {
                byte[] bytes = new byte[32768]; int count;
                while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            }
            android.graphics.BitmapFactory.Options dimensions = new android.graphics.BitmapFactory.Options();
            dimensions.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeFile(staging.getPath(), dimensions);
            JSObject photo = repository.commitPhoto(new JSObject().put("photo", new JSObject().put("id", UUID.randomUUID().toString()).put("file", staging.toURI().toString()).put("tripId", session.getJSObject("trip").optString("id"))
                .put("shopId", session.getJSObject("shop").optString("id")).put("kind", "item").put("takenAt", System.currentTimeMillis()).put("location", new JSObject().put("lat", 37.5).put("lng", 127.0).put("accuracyM", 10))
                .put("w", dimensions.outWidth).put("h", dimensions.outHeight).put("indexState", "pending")));
            assertArrayEquals("Committing a photo must preserve the shared fixture", sourceHash, digest(source));
            return photo;
        } finally {
            staging.delete();
            harness.invoke("ShoppingSession", "stop", new JSObject()).await();
        }
    }
    private byte[] digest(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] bytes = new byte[32768];
        try (InputStream input = new FileInputStream(file)) { int size; while ((size = input.read(bytes)) >= 0) digest.update(bytes, 0, size); }
        return digest.digest();
    }
    private int galleryCount(NativeHarness harness) {
        try (android.database.Cursor cursor = harness.context.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, new String[]{MediaStore.Images.Media._ID}, null, null, null)) { assertNotNull(cursor); return cursor.getCount(); }
    }
    @Test public void exportPhotoRemovesExifGpsKeepsOriginalLocation() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            JSObject photo = photo(harness); File original = ImageFiles.local(photo.optString("file")); byte[] hash = digest(original);
            assertNotNull("EXIF boundary fixture must contain GPS", new ExifInterface(original).getLatLong());
            String uri = harness.invoke("Media", "exportPhoto", new JSObject().put("photoId", photo.optString("id"))).await().optString("uri");
            try (InputStream input = harness.context.getContentResolver().openInputStream(Uri.parse(uri))) {
                assertNotNull(input); ExifInterface exif = new ExifInterface(input); assertNull(exif.getLatLong()); assertNull(exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE)); assertNull(exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE));
            }
            assertArrayEquals(hash, digest(original));
            assertEquals(photo.getJSObject("location").toString(), RepositoryProvider.get(harness.context).getPhoto(new JSObject().put("id", photo.optString("id"))).getJSObject("location").toString());
            harness.context.getContentResolver().delete(Uri.parse(uri), null, null);
            RepositoryProvider.get(harness.context).deleteTrip(new JSObject().put("id", photo.optString("tripId")));
        }
    }
    @Test public void resultDownloadOffCreatesNoGalleryFile() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            int before = galleryCount(harness);
            assertEquals("result_download_disabled", harness.invoke("Media", "exportResult", new JSObject().put("resultId", UUID.randomUUID().toString())).failure());
            assertEquals(before, galleryCount(harness));
        }
    }
    @Test public void pickerUsesSystemUiSupportsCancellationAndRejectsShopping() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            assertEquals("invalid_argument", harness.invoke("Media", "pick", new JSObject().put("purpose", "shopping")).failure());
            NativeHarness.TestCall call = harness.invoke("Media", "pick", new JSObject().put("purpose", "wardrobe"));
            UiObject2 grid = harness.device.wait(Until.findObject(By.desc("Media grid")), 5000);
            harness.evidence("system-photo-picker");
            assertNotNull("System picker media grid must be visible", grid);
            assertNotEquals(harness.context.getPackageName(), grid.getApplicationPackage());
            harness.device.pressBack(); assertEquals("cancelled", call.failure());
        }
    }
    @Test public void pickerCopiesWardrobeAndSelfIntoPrivateFiles() throws Exception {
        try (NativeHarness harness = new NativeHarness()) {
            ContentValues values = new ContentValues(); values.put(MediaStore.Images.Media.DISPLAY_NAME, "S04-Picker-Input.jpg"); values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            Uri uri = harness.context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values); assertNotNull(uri);
            try {
                try (InputStream input = new FileInputStream(source(harness)); OutputStream output = harness.context.getContentResolver().openOutputStream(uri)) { byte[] bytes = new byte[32768]; int count; while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count); }
                for (String purpose : new String[]{"wardrobe", "self"}) {
                    NativeHarness.TestCall call = harness.invoke("Media", "pick", new JSObject().put("purpose", purpose));
                    UiObject2 grid = harness.device.wait(Until.findObject(By.desc("Media grid")), 5000);
                    assertNotNull("System picker media grid must be visible", grid);
                    UiObject2 image = grid.wait(Until.findObject(By.descStartsWith("Photo taken on ")), 5000);
                    harness.evidence("system-photo-picker-" + purpose);
                    assertNotNull("System picker photo not found", image); image.click();
                    UiObject2 done = harness.device.wait(Until.findObject(By.text("Done")), 5000);
                    assertNotNull("System picker selection must be confirmed", done); done.click();
                    JSObject asset;
                    try { asset = call.await().getJSObject("asset"); }
                    catch (java.util.concurrent.TimeoutException timeout) {
                        try { harness.evidence("system-photo-picker-" + purpose + "-timeout"); }
                        catch (Exception evidenceError) { timeout.addSuppressed(evidenceError); }
                        throw timeout;
                    }
                    File file = ImageFiles.local(asset.optString("file"));
                    assertTrue(file.getCanonicalPath().startsWith(harness.context.getFilesDir().getCanonicalPath() + File.separator)); assertNull(new ExifInterface(file).getLatLong());
                    harness.invoke("Media", "discard", new JSObject().put("assetId", asset.optString("id"))).await(); assertFalse(file.exists());
                }
            } finally { harness.context.getContentResolver().delete(uri, null, null); }
        }
    }
}
