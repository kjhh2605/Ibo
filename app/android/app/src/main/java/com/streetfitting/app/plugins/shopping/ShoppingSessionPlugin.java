package com.streetfitting.app.plugins.shopping;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.lang.ref.WeakReference;
import java.util.concurrent.CompletableFuture;
import org.json.JSONObject;

@CapacitorPlugin(name = "ShoppingSession", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notification", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class ShoppingSessionPlugin extends Plugin {
    private static WeakReference<ShoppingSessionPlugin> observer = new WeakReference<>(null);
    private boolean requesting;
    private String phase = "idle";
    static void emit(String name, JSObject value) {
        ShoppingSessionPlugin plugin = observer.get();
        if (plugin != null) plugin.notifyListeners(name, value, "open".equals(name));
    }
    @Override public void load() {
        observer = new WeakReference<>(this);
        handleOnNewIntent(getActivity().getIntent());
    }
    private JSObject idle() {
        return new JSObject().put("phase", phase).put("trip", JSONObject.NULL).put("shop", JSONObject.NULL).put("photos", 0).put("elapsedMinutes", 0).put("latestFix", JSONObject.NULL)
            .put("locationPermission", LocationFixes.permitted(getContext()) ? "granted" : permission("location"))
            .put("notificationPermission", Build.VERSION.SDK_INT < 33 ? "granted" : permission("notification"));
    }
    private String permission(String alias) {
        PermissionState state = getPermissionState(alias);
        return state == PermissionState.GRANTED ? "granted" : state == PermissionState.DENIED ? "denied" : "prompt";
    }
    @PluginMethod public void getState(PluginCall call) {
        ShoppingService service = ShoppingService.running;
        if (service != null) { call.resolve(service.state()); return; }
        try {
            JSObject session = RepositoryProvider.get(getContext()).getSession();
            JSObject stale = session.getJSObject("trip");
            if (stale != null) RepositoryProvider.get(getContext()).stopSession(new JSObject().put("tripId", stale.optString("id")).put("endedAt", System.currentTimeMillis()));
            call.resolve(idle());
        } catch (RuntimeException error) { reject(call, "service_unavailable"); }
    }
    @PluginMethod public synchronized void start(PluginCall call) {
        ShoppingService service = ShoppingService.running;
        if (service != null && "recording".equals(service.state().optString("phase"))) { call.resolve(service.state()); return; }
        if (requesting) { reject(call, "busy"); return; }
        requesting = true;
        if (!LocationFixes.permitted(getContext())) {
            if (getPermissionState("location") == PermissionState.DENIED) { requesting = false; reject(call, "location_permission_denied"); return; }
            phase = "requesting_location"; emit("state", idle()); requestPermissionForAlias("location", call, "locationResult"); return;
        }
        requestNotification(call);
    }
    @PermissionCallback private void locationResult(PluginCall call) {
        if (!LocationFixes.permitted(getContext())) { requesting = false; phase = "idle"; emit("state", idle()); reject(call, "location_permission_denied"); return; }
        requestNotification(call);
    }
    private void requestNotification(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notification") == PermissionState.PROMPT) {
            phase = "requesting_notification"; emit("state", idle()); requestPermissionForAlias("notification", call, "notificationResult"); return;
        }
        begin(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) { begin(call); }
    private void begin(PluginCall call) {
        phase = "starting"; emit("state", idle());
        synchronized (ShoppingService.class) {
            if (ShoppingService.startup == null || ShoppingService.startup.isDone()) ShoppingService.startup = new CompletableFuture<>();
            ShoppingService.startup.whenComplete((state, error) -> {
                requesting = false; phase = "idle";
                if (error == null) call.resolve(state); else reject(call, error.getMessage());
            });
        }
        getActivity().runOnUiThread(() -> {
            try { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), ShoppingService.class)); }
            catch (RuntimeException error) { synchronized (ShoppingService.class) { ShoppingService.startup.completeExceptionally(new IllegalStateException("service_unavailable")); } }
        });
    }
    @PluginMethod public void newShop(PluginCall call) {
        ShoppingService service = ShoppingService.running;
        if (service == null) { reject(call, "not_recording"); return; }
        service.newShop().whenComplete((shop, error) -> { if (error == null) call.resolve(shop); else reject(call, error.getMessage()); });
    }
    @PluginMethod public void stop(PluginCall call) {
        ShoppingService service = ShoppingService.running;
        if (service == null) { reject(call, "not_recording"); return; }
        service.stopRecording().whenComplete((trip, error) -> { if (error == null) call.resolve(new JSObject().put("trip", trip)); else reject(call, "service_unavailable"); });
    }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))); call.resolve();
    }
    @Override protected void handleOnNewIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        String url = intent.getData().toString();
        if (!url.equals("streetfitting://home") && !url.equals("streetfitting://capture") && !url.equals("streetfitting://capture?newShop=1")) return;
        intent.setData(null);
        if (url.endsWith("?newShop=1")) {
            ShoppingService service = ShoppingService.running;
            if (service == null) return;
            service.newShop().whenComplete((shop, error) -> {
                if (error == null) emit("open", new JSObject().put("url", url));
                else emit("error", new JSObject().put("code", "location_disabled").put("retryable", true));
            });
        } else emit("open", new JSObject().put("url", url));
    }
    private void reject(PluginCall call, String code) { call.reject(code, code, new JSObject().put("retryable", !"location_permission_denied".equals(code))); }
    @Override protected void handleOnDestroy() { if (observer.get() == this) observer.clear(); }
}
