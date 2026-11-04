package com.streetfitting.app.plugins.capture;

import android.Manifest;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.streetfitting.app.plugins.media.ImageFiles;
import com.streetfitting.app.plugins.shopping.LocationFixes;
import com.streetfitting.app.plugins.shopping.ShoppingService;
import com.streetfitting.app.plugins.store.NativeRepository;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import com.streetfitting.app.plugins.photoindex.PhotoIndexPlugin;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "Capture", permissions = {@Permission(alias = "camera", strings = {Manifest.permission.CAMERA})})
public class CapturePlugin extends Plugin {
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private CaptureSource source;
    private String purpose;
    private boolean front;
    private boolean ready;
    private boolean capturing;
    private boolean paused;
    private final float[] rect = new float[4];
    @PluginMethod public void openPreview(PluginCall call) {
        String requested = call.getString("purpose"); String facing = call.getString("facing");
        if (!("shopping".equals(requested) || "wardrobe".equals(requested) || "self".equals(requested)) || !("front".equals(facing) || "back".equals(facing))) { reject(call, "invalid_argument"); return; }
        if ("shopping".equals(requested) && (ShoppingService.active() == null || !"recording".equals(ShoppingService.active().state().optString("phase")))) { reject(call, "not_recording"); return; }
        purpose = requested; front = "front".equals(facing);
        if (!CaptureSourceFactory.fixture(getActivity()) && getPermissionState("camera") != PermissionState.GRANTED) {
            if (getPermissionState("camera") == PermissionState.DENIED) { reject(call, "permission_denied"); return; }
            requestPermissionForAlias("camera", call, "cameraResult"); return;
        }
        open(call);
    }
    @PermissionCallback private void cameraResult(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) { reject(call, "permission_denied"); return; }
        open(call);
    }
    private void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (capturing) { reject(call, "busy"); return; }
            detach();
            try {
                source = CaptureSourceFactory.create(getActivity(), front);
                ViewGroup parent = (ViewGroup)getBridge().getWebView().getParent();
                parent.addView(source.view(), parent.indexOfChild(getBridge().getWebView()), new ViewGroup.LayoutParams(1, 1));
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT); applyRect();
                source.start().whenComplete((value, error) -> {
                    if (error != null) { detach(); reject(call, error.getMessage()); }
                    else { ready = true; notifyListeners("preview", new JSObject().put("ready", true)); call.resolve(); }
                });
            } catch (RuntimeException error) { detach(); reject(call, "fixture_unavailable"); }
        });
    }
    @PluginMethod public void setPreviewRect(PluginCall call) {
        String[] names = {"x", "y", "width", "height"};
        for (int i = 0; i < 4; i++) {
            Double value = call.getDouble(names[i]);
            if (value == null || !Double.isFinite(value) || value < 0) { reject(call, "invalid_argument"); return; }
            rect[i] = value.floatValue();
        }
        getActivity().runOnUiThread(() -> { applyRect(); call.resolve(); });
    }
    private void applyRect() {
        if (source == null) return;
        float scale = getContext().getResources().getDisplayMetrics().density;
        View view = source.view();
        ViewGroup.LayoutParams params = view.getLayoutParams(); params.width = Math.max(1, Math.round(rect[2] * scale)); params.height = Math.max(1, Math.round(rect[3] * scale)); view.setLayoutParams(params);
        view.setX(getBridge().getWebView().getX() + rect[0] * scale); view.setY(getBridge().getWebView().getY() + rect[1] * scale);
        view.setVisibility(rect[2] > 0 && rect[3] > 0 ? View.VISIBLE : View.INVISIBLE);
    }
    @PluginMethod public void takePhoto(PluginCall call) {
        String kind = call.getString("kind");
        if (!("item".equals(kind) || "storefront".equals(kind)) || (!"shopping".equals(purpose) && !"item".equals(kind))) { reject(call, "invalid_argument"); return; }
        getActivity().runOnUiThread(() -> {
            if (!ready || source == null || paused) { reject(call, "preview_not_ready"); return; }
            if (capturing) { reject(call, "busy"); return; }
            ShoppingService session = "shopping".equals(purpose) ? ShoppingService.active() : null;
            JSObject snapshot;
            try { snapshot = "shopping".equals(purpose) ? session == null ? null : session.beginShutter(System.currentTimeMillis()) : null; }
            catch (RuntimeException error) { reject(call, "not_recording"); return; }
            if ("shopping".equals(purpose) && snapshot == null) { reject(call, "not_recording"); return; }
            capturing = true;
            CaptureSource current = source;
            String capturePurpose = purpose;
            boolean mirror = front && !CaptureSourceFactory.fixture(getActivity());
            File raw = new File(getContext().getCacheDir(), UUID.randomUUID() + ".capture");
            current.capture(raw).whenComplete((file, error) -> work.execute(() -> {
                JSObject asset = null; boolean committed = false;
                try {
                    if (error != null) throw new IllegalStateException(error.getMessage());
                    asset = ImageFiles.normalize(getContext(), file, "captures", mirror);
                    NativeRepository repository = RepositoryProvider.get(getContext());
                    JSObject photo = null;
                    if (snapshot != null) {
                        JSObject fix = repository.nearestFix(new JSObject().put("tripId", snapshot.optString("tripId")).put("takenAt", snapshot.optLong("takenAt")));
                        if (!LocationFixes.eligible(fix, snapshot.optLong("takenAt"))) fix = LocationFixes.current(getContext()).get();
                        if (!LocationFixes.eligible(fix, snapshot.optLong("takenAt"))) throw new IllegalStateException("location_disabled");
                        photo = new JSObject().put("id", asset.optString("id")).put("tripId", snapshot.optString("tripId")).put("shopId", snapshot.optString("shopId")).put("kind", kind)
                            .put("takenAt", snapshot.optLong("takenAt")).put("location", LocationFixes.point(fix)).put("file", asset.optString("file")).put("w", asset.optInt("w")).put("h", asset.optInt("h")).put("indexState", "pending");
                        photo = repository.commitPhoto(new JSObject().put("photo", photo));
                        ImageFiles.local(asset.optString("file")).delete();
                        asset.put("file", photo.optString("file"));
                    } else {
                        JSObject registered = repository.registerAsset(new JSObject().put("asset", asset).put("purpose", capturePurpose));
                        ImageFiles.local(asset.optString("file")).delete();
                        asset = registered;
                    }
                    committed = true;
                    JSObject result = new JSObject().put("asset", asset).put("photo", photo == null ? JSONObject.NULL : photo);
                    getActivity().runOnUiThread(() -> {
                        try { current.committed(); }
                        catch (RuntimeException failure) { ready = false; notifyListeners("preview", new JSObject().put("ready", false)); }
                        notifyListeners("captured", result); call.resolve(result);
                    });
                    if (photo != null) PhotoIndexPlugin.dispatch(getContext(), photo.optString("id"));
                } catch (Exception failure) {
                    if (asset != null && !committed) try { ImageFiles.local(asset.optString("file")).delete(); } catch (Exception ignored) { }
                    reject(call, failure.getMessage() != null && failure.getMessage().equals("location_disabled") ? "location_disabled" : "capture_failed");
                } finally {
                    raw.delete(); if (session != null && snapshot != null) session.endShutter(committed);
                    getActivity().runOnUiThread(() -> capturing = false);
                }
            }));
        });
    }
    @PluginMethod public void closePreview(PluginCall call) { getActivity().runOnUiThread(() -> { detach(); purpose = null; call.resolve(); }); }
    private void detach() {
        ready = false;
        if (source != null) { source.stop(); ViewGroup parent = (ViewGroup)source.view().getParent(); if (parent != null) parent.removeView(source.view()); source = null; }
        notifyListeners("preview", new JSObject().put("ready", false));
    }
    @Override protected void handleOnPause() { paused = true; ready = false; if (source != null) source.stop(); notifyListeners("preview", new JSObject().put("ready", false)); }
    @Override protected void handleOnResume() {
        paused = false;
        if (source != null) source.start().whenComplete((value, error) -> { ready = error == null; notifyListeners("preview", new JSObject().put("ready", ready)); });
    }
    @Override protected void handleOnDestroy() { detach(); work.shutdown(); }
    private void reject(PluginCall call, String code) { call.reject(code, code, new JSObject().put("retryable", !"permission_denied".equals(code))); }
}
