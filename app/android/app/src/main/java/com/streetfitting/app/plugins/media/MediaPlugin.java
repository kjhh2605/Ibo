package com.streetfitting.app.plugins.media;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "Media")
public class MediaPlugin extends Plugin {
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private boolean pickerOpen;
    private File pendingExport;
    private String pendingId;
    @PluginMethod public synchronized void pick(PluginCall call) {
        String purpose = call.getString("purpose");
        if (!"wardrobe".equals(purpose) && !"self".equals(purpose)) { reject(call, "invalid_argument"); return; }
        if (pickerOpen) { reject(call, "busy"); return; }
        pickerOpen = true;
        Intent intent = Build.VERSION.SDK_INT >= 33 ? new Intent(MediaStore.ACTION_PICK_IMAGES) : new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "picked");
    }
    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        pickerOpen = false;
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { reject(call, "cancelled"); return; }
        work.execute(() -> {
            File raw = new File(getContext().getCacheDir(), UUID.randomUUID() + ".import");
            JSObject normalized = null;
            try {
                try (InputStream input = getContext().getContentResolver().openInputStream(uri); FileOutputStream output = new FileOutputStream(raw)) {
                    copy(input, output); output.getFD().sync();
                }
                normalized = ImageFiles.normalize(getContext(), raw, "imports", false);
                JSObject asset = RepositoryProvider.get(getContext()).registerAsset(new JSObject().put("asset", normalized).put("purpose", call.getString("purpose")));
                call.resolve(new JSObject().put("asset", asset));
            } catch (Exception error) { reject(call, "import_failed"); }
            finally { raw.delete(); if (normalized != null) try { ImageFiles.local(normalized.optString("file")).delete(); } catch (Exception ignored) { } }
        });
    }
    @PluginMethod public void exportPhoto(PluginCall call) {
        String id = call.getString("photoId");
        if (id == null) { reject(call, "invalid_argument"); return; }
        work.execute(() -> {
            File copy = null;
            try {
                JSObject photo = RepositoryProvider.get(getContext()).getPhoto(new JSObject().put("id", id));
                if (photo == null) { reject(call, "not_found"); return; }
                JSObject normalized = ImageFiles.normalize(getContext(), ImageFiles.local(photo.optString("file")), "exports", false);
                copy = ImageFiles.local(normalized.optString("file"));
                ExifInterface exif = new ExifInterface(copy);
                if (exif.getLatLong() != null || exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE) != null || exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE) != null) throw new IllegalStateException("privacy_check_failed");
                if (Build.VERSION.SDK_INT >= 29) {
                    Uri uri = gallery(copy, id); exported(call, uri, id);
                } else {
                    synchronized (this) {
                        if (pendingExport != null) { reject(call, "busy"); return; }
                        pendingExport = copy; pendingId = id; copy = null;
                    }
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/jpeg").putExtra(Intent.EXTRA_TITLE, "Street-Fitting-" + id + ".jpg");
                    getActivity().runOnUiThread(() -> startActivityForResult(call, intent, "exportDestination"));
                }
            } catch (Exception error) { reject(call, "export_failed"); }
            finally { if (copy != null) copy.delete(); }
        });
    }
    private Uri gallery(File file, String id) throws Exception {
        ContentValues values = new ContentValues(); values.put(MediaStore.Images.Media.DISPLAY_NAME, "Street-Fitting-" + id + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg"); values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Street Fitting"); values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("export_failed");
        try {
            try (InputStream input = new FileInputStream(file); OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) { copy(input, output); }
            try (InputStream exported = getContext().getContentResolver().openInputStream(uri)) {
                if (exported == null || new ExifInterface(exported).getLatLong() != null) throw new IllegalStateException("privacy_check_failed");
            }
            ContentValues publish = new ContentValues(); publish.put(MediaStore.Images.Media.IS_PENDING, 0);
            if (getContext().getContentResolver().update(uri, publish, null, null) != 1) throw new IllegalStateException("export_failed");
            return uri;
        } catch (Exception error) { getContext().getContentResolver().delete(uri, null, null); throw error; }
    }
    @ActivityCallback private void exportDestination(PluginCall call, ActivityResult result) {
        File file; String id;
        synchronized (this) { file = pendingExport; id = pendingId; pendingExport = null; pendingId = null; }
        if (file == null || call == null) { if (file != null) file.delete(); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { file.delete(); reject(call, "cancelled"); return; }
        work.execute(() -> {
            try {
                try (InputStream input = new FileInputStream(file); OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) { copy(input, output); }
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) { if (input == null || new ExifInterface(input).getLatLong() != null) throw new IllegalStateException("privacy_check_failed"); }
                exported(call, uri, id);
            } catch (Exception error) { try { android.provider.DocumentsContract.deleteDocument(getContext().getContentResolver(), uri); } catch (Exception ignored) { } reject(call, "export_failed"); }
            finally { file.delete(); }
        });
    }
    @PluginMethod public void exportResult(PluginCall call) { reject(call, "result_download_disabled"); }
    @PluginMethod public void discard(PluginCall call) {
        String id = call.getString("assetId");
        if (id == null) { reject(call, "invalid_argument"); return; }
        work.execute(() -> {
            try { RepositoryProvider.get(getContext()).discardAsset(new JSObject().put("assetId", id)); call.resolve(); }
            catch (RuntimeException error) { reject(call, "discard_failed"); }
        });
    }
    private void exported(PluginCall call, Uri uri, String id) {
        notifyListeners("exported", new JSObject().put("uri", uri.toString()).put("sourceId", id)); call.resolve(new JSObject().put("uri", uri.toString()));
    }
    private static void copy(InputStream input, OutputStream output) throws Exception {
        if (input == null || output == null) throw new IllegalStateException("io_error");
        byte[] bytes = new byte[32768]; int count;
        while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
        output.flush();
    }
    private void reject(PluginCall call, String code) { call.reject(code, code, new JSObject().put("retryable", !"result_download_disabled".equals(code))); }
    @Override protected void handleOnDestroy() { if (pendingExport != null) pendingExport.delete(); work.shutdown(); }
}
