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
import java.util.concurrent.CompletableFuture;
import org.json.JSONObject;

@CapacitorPlugin(name = "Capture", permissions = {
    @Permission(alias = "camera", strings = {Manifest.permission.CAMERA}),
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION})
})
public class CapturePlugin extends Plugin {
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private CaptureSource source;
    private String purpose;
    private boolean front;
    private boolean ready;
    private boolean capturing;
    private boolean paused;
    private boolean opening;
    private boolean destroyed;
    private int generation;
    private String shopId;
    private PluginCall locationCall;
    private final float[] rect = new float[4];
    @PluginMethod public void openPreview(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String requested = call.getString("purpose"); String facing = call.getString("facing");
            String requestedShop = call.getString("shopId");
            if (!("shopping".equals(requested) || "wardrobe".equals(requested) || "self".equals(requested) || "storefront".equals(requested)) || !("front".equals(facing) || "back".equals(facing)) ||
                ("storefront".equals(requested) ? requestedShop == null || requestedShop.isEmpty() : call.getData().has("shopId"))) { reject(call, "invalid_argument"); return; }
            if (capturing || opening || locationCall != null) { reject(call, "busy"); return; }
            ShoppingService service = ShoppingService.active();
            if ("shopping".equals(requested) && (service == null || !"recording".equals(service.state().optString("phase")))) { reject(call, "not_recording"); return; }
            purpose = requested; shopId = requestedShop; front = "front".equals(facing); opening = true;
            if (!CaptureSourceFactory.fixture(getActivity()) && getPermissionState("camera") != PermissionState.GRANTED) {
                if (getPermissionState("camera") == PermissionState.DENIED) { opening = false; reject(call, "camera_permission_denied"); return; }
                requestPermissionForAlias("camera", call, "cameraResult"); return;
            }
            open(call);
        });
    }
    @PermissionCallback private void cameraResult(PluginCall call) {
        if (!opening || destroyed) { reject(call, "cancelled"); return; }
        if (getPermissionState("camera") != PermissionState.GRANTED) { opening = false; reject(call, "camera_permission_denied"); return; }
        open(call);
    }
    private void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (capturing) { reject(call, "busy"); return; }
            detach();
            int attempt = generation;
            try {
                source = CaptureSourceFactory.create(getActivity(), front);
                CaptureSource current = source;
                ViewGroup parent = (ViewGroup)getBridge().getWebView().getParent();
                parent.addView(current.view(), parent.indexOfChild(getBridge().getWebView()), new ViewGroup.LayoutParams(1, 1));
                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT); applyRect();
                current.start().whenComplete((value, error) -> getActivity().runOnUiThread(() -> {
                    if (source != current || generation != attempt || destroyed) { reject(call, "cancelled"); return; }
                    opening = false;
                    if (error != null) { detach(); reject(call, error.getMessage()); }
                    else { ready = !paused; notifyListeners("preview", new JSObject().put("ready", ready)); call.resolve(); }
                }));
            } catch (RuntimeException error) {
                opening = false; detach();
                reject(call, CaptureSourceFactory.fixture(getActivity()) ?
                    ("fixture_empty".equals(error.getMessage()) ? "fixture_empty" : "fixture_invalid") : "camera_unavailable");
            }
        });
    }
    @PluginMethod public void setPreviewRect(PluginCall call) {
        String[] names = {"x", "y", "width", "height"};
        for (int i = 0; i < 4; i++) {
            Double value = call.getDouble(names[i]);
            if (value == null || !Double.isFinite(value) || (i >= 2 && value < 0)) { reject(call, "invalid_argument"); return; }
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
        getActivity().runOnUiThread(() -> {
            String kind = call.getString("kind");
            if (!("item".equals(kind) || "storefront".equals(kind)) ||
                ("storefront".equals(purpose) ? !"storefront".equals(kind) : !"shopping".equals(purpose) && !"item".equals(kind))) { reject(call, "invalid_argument"); return; }
            if (capturing || opening || locationCall != null) { reject(call, "busy"); return; }
            if (!ready || source == null || paused || destroyed) { reject(call, "preview_not_open"); return; }
            if ("storefront".equals(purpose) && !LocationFixes.permitted(getContext())) {
                if (getPermissionState("location") == PermissionState.DENIED) { reject(call, "location_permission_denied"); return; }
                locationCall = call;
                requestPermissionForAlias("location", call, "locationResult");
                return;
            }
            capture(call, kind);
        });
    }
    @PermissionCallback private void locationResult(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (locationCall != call || destroyed) { reject(call, "cancelled"); return; }
            if (!LocationFixes.permitted(getContext())) { locationCall = null; reject(call, "location_permission_denied"); return; }
            resumeShutter();
        });
    }
    private void resumeShutter() {
        if (locationCall == null || paused || !ready || !LocationFixes.permitted(getContext())) return;
        PluginCall call = locationCall; locationCall = null;
        capture(call, "storefront");
    }
    private void capture(PluginCall call, String kind) {
        long takenAt = System.currentTimeMillis();
        ShoppingService session = "shopping".equals(purpose) ? ShoppingService.active() : null;
        JSObject snapshot;
        try { snapshot = "shopping".equals(purpose) ? session == null ? null : session.beginShutter(takenAt) : null; }
        catch (RuntimeException error) { reject(call, "not_recording"); return; }
        if ("shopping".equals(purpose) && snapshot == null) { reject(call, "not_recording"); return; }
        capturing = true;
        CaptureSource current = source;
        String capturePurpose = purpose;
        String targetShop = shopId;
        boolean mirror = front && !CaptureSourceFactory.fixture(getActivity());
        File raw = new File(getContext().getCacheDir(), UUID.randomUUID() + ".capture");
        // Acquire location at shutter, concurrently with pixels, never after normalization.
        CompletableFuture<JSObject> fix = "storefront".equals(capturePurpose) ? LocationFixes.current(getContext()) : null;
        work.execute(() -> {
            JSObject target = snapshot;
            JSObject asset = null; JSObject completed = null; String failureCode = null; boolean committed = false;
            CompletableFuture<JSObject> location = fix;
            try {
                NativeRepository repository = RepositoryProvider.get(getContext());
                if ("storefront".equals(capturePurpose)) {
                    JSObject shop = repository.get(new JSObject().put("entity", "Shop").put("id", targetShop));
                    if (shop == null) throw new IllegalStateException("not_found");
                    target = new JSObject().put("tripId", shop.optString("tripId")).put("shopId", targetShop).put("takenAt", takenAt);
                } else if (target != null) {
                    JSObject nearest = repository.nearestFix(new JSObject().put("tripId", target.optString("tripId")).put("takenAt", takenAt));
                    location = LocationFixes.eligible(nearest, takenAt) ? CompletableFuture.completedFuture(nearest) : LocationFixes.current(getContext());
                }
                CompletableFuture<File> pixels = new CompletableFuture<>();
                getActivity().runOnUiThread(() -> {
                    if (destroyed || paused || source != current || !ready) { pixels.completeExceptionally(new IllegalStateException("preview_not_open")); return; }
                    try { current.capture(raw).whenComplete((file, error) -> { if (error != null) pixels.completeExceptionally(error); else pixels.complete(file); }); }
                    catch (RuntimeException error) { pixels.completeExceptionally(new IllegalStateException("camera_unavailable")); }
                });
                File file = pixels.get();
                JSObject selectedFix = location == null ? null : location.get();
                if (target != null && !LocationFixes.eligible(selectedFix, takenAt)) throw new IllegalStateException("location_unavailable");
                asset = ImageFiles.normalize(getContext(), file, "captures", mirror);
                JSObject photo = null;
                if (target != null) {
                    photo = new JSObject().put("id", asset.optString("id")).put("tripId", target.optString("tripId")).put("shopId", target.optString("shopId")).put("kind", kind)
                        .put("takenAt", takenAt).put("location", LocationFixes.point(selectedFix)).put("file", asset.optString("file")).put("w", asset.optInt("w")).put("h", asset.optInt("h")).put("indexState", "pending");
                    photo = "storefront".equals(capturePurpose) ? repository.commitStorefront(new JSObject().put("photo", photo)) : repository.commitPhoto(new JSObject().put("photo", photo));
                    ImageFiles.local(asset.optString("file")).delete();
                    asset.put("file", photo.optString("file"));
                } else {
                    JSObject registered = repository.registerAsset(new JSObject().put("asset", asset).put("purpose", capturePurpose));
                    ImageFiles.local(asset.optString("file")).delete(); asset = registered;
                }
                committed = true;
                completed = new JSObject().put("asset", asset).put("photo", photo == null ? JSONObject.NULL : photo);
                if (photo != null) PhotoIndexPlugin.dispatch(getContext(), photo.optString("id"));
            } catch (Exception failure) {
                if (asset != null && !committed) try { ImageFiles.local(asset.optString("file")).delete(); } catch (Exception ignored) { }
                Throwable cause = failure;
                while (cause.getCause() != null) cause = cause.getCause();
                String code = cause.getMessage();
                failureCode = "location_disabled".equals(code) ? "location_unavailable" :
                    "location_unavailable".equals(code) || "location_permission_denied".equals(code) || "not_found".equals(code) ||
                    "camera_unavailable".equals(code) || "preview_not_open".equals(code) || "fixture_invalid".equals(code) ? code : "io_error";
            } finally {
                if (location != null && !location.isDone()) location.cancel(false);
                raw.delete(); if (session != null && snapshot != null) session.endShutter(committed);
                JSObject result = completed; String error = failureCode;
                getActivity().runOnUiThread(() -> {
                    capturing = false;
                    if (destroyed) work.shutdown();
                    if (result != null) {
                        try { current.committed(); }
                        catch (RuntimeException failure) { if (source == current) { ready = false; notifyListeners("preview", new JSObject().put("ready", false)); } }
                        notifyListeners("captured", result); call.resolve(result);
                    } else reject(call, error);
                });
            }
        });
    }
    @PluginMethod public void closePreview(PluginCall call) { getActivity().runOnUiThread(() -> {
        opening = false;
        if (locationCall != null) { reject(locationCall, "cancelled"); locationCall = null; }
        detach(); purpose = null; shopId = null; call.resolve();
    }); }
    private void detach() {
        generation++; ready = false;
        if (source != null) { source.stop(); ViewGroup parent = (ViewGroup)source.view().getParent(); if (parent != null) parent.removeView(source.view()); source = null; }
        notifyListeners("preview", new JSObject().put("ready", false));
    }
    @Override protected void handleOnPause() { paused = true; ready = false; if (source != null) source.stop(); notifyListeners("preview", new JSObject().put("ready", false)); }
    @Override protected void handleOnResume() {
        paused = false;
        CaptureSource current = source; int attempt = generation;
        if (current != null && !opening) current.start().whenComplete((value, error) -> getActivity().runOnUiThread(() -> {
            if (source != current || generation != attempt || paused || destroyed) return;
            ready = error == null; notifyListeners("preview", new JSObject().put("ready", ready));
            if (error == null) resumeShutter();
            else if (locationCall != null) { reject(locationCall, "preview_not_open"); locationCall = null; }
        }));
    }
    @Override protected void handleOnDestroy() {
        destroyed = true; opening = false;
        if (locationCall != null) { reject(locationCall, "cancelled"); locationCall = null; }
        detach(); if (!capturing) work.shutdown();
    }
    private void reject(PluginCall call, String code) { call.reject(code, code, new JSObject().put("retryable", !"camera_permission_denied".equals(code) && !"location_permission_denied".equals(code))); }
}
