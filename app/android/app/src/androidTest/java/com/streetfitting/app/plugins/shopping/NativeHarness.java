package com.streetfitting.app.plugins.shopping;

import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.streetfitting.app.MainActivity;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public final class NativeHarness implements AutoCloseable {
    public final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    public final UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    public final ActivityScenario<MainActivity> activity;
    public NativeHarness() { this(null); }
    public NativeHarness(Intent extras) {
        // Denial/revoke scenarios run externally: revocation can kill instrumentation.
        grant(android.Manifest.permission.ACCESS_COARSE_LOCATION);
        grant(android.Manifest.permission.ACCESS_FINE_LOCATION);
        grant(android.Manifest.permission.CAMERA);
        grant(android.Manifest.permission.RECORD_AUDIO);
        if (android.os.Build.VERSION.SDK_INT >= 33) grant(android.Manifest.permission.POST_NOTIFICATIONS);
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (extras != null) intent.putExtras(extras);
        activity = ActivityScenario.launch(intent);
    }
    public static String fixturePath(String relative) {
        File root = InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir();
        try { return new File(root, relative).getCanonicalPath(); }
        catch (java.io.IOException error) { throw new AssertionError("fixture_path_setup_failed", error); }
    }
    private void grant(String permission) {
        if (androidx.core.content.ContextCompat.checkSelfPermission(context, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        try { device.executeShellCommand("pm grant " + context.getPackageName() + " " + permission); }
        catch (java.io.IOException error) { throw new AssertionError("permission_setup_failed: " + permission, error); }
        if (androidx.core.content.ContextCompat.checkSelfPermission(context, permission) != android.content.pm.PackageManager.PERMISSION_GRANTED)
            throw new AssertionError("permission_setup_failed: " + permission);
    }
    public TestCall invoke(String plugin, String method, JSObject data) {
        TestCall call = new TestCall(plugin, method, data);
        activity.onActivity(screen -> {
            try { screen.getBridge().getPlugin(plugin).getInstance().getClass().getMethod(method, PluginCall.class).invoke(screen.getBridge().getPlugin(plugin).getInstance(), call); }
            catch (Exception error) { call.result.completeExceptionally(error); }
        });
        return call;
    }
    public TestCall listen(String plugin, String name) { return invoke(plugin, "addListener", new JSObject().put("eventName", name)); }
    public void evidence(String name) throws Exception {
        File directory = new File(context.getFilesDir(), "s04-evidence");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new AssertionError("evidence_directory_failed");
        if (!device.takeScreenshot(new File(directory, name + ".png"))) throw new AssertionError("evidence_screenshot_failed");
        device.dumpWindowHierarchy(new File(directory, name + ".xml"));
    }
    public static void until(java.util.function.BooleanSupplier condition, long timeout) {
        long end = SystemClock.elapsedRealtime() + timeout;
        while (!condition.getAsBoolean()) {
            if (SystemClock.elapsedRealtime() >= end) throw new AssertionError("condition_timeout");
            SystemClock.sleep(50);
        }
    }
    public void close() { activity.close(); }
    public static final class TestCall extends PluginCall {
        public final CompletableFuture<JSObject> result = new CompletableFuture<>();
        public final CopyOnWriteArrayList<JSObject> values = new CopyOnWriteArrayList<>();
        public volatile String error;
        TestCall(String plugin, String method, JSObject data) { super(null, plugin, UUID.randomUUID().toString(), method, data); }
        @Override public void resolve(JSObject value) { values.add(value); result.complete(value); }
        @Override public void resolve() { resolve(new JSObject()); }
        @Override public void reject(String message, String code, Exception exception, JSObject data) { error = code; result.completeExceptionally(new IllegalStateException(code)); }
        public JSObject await() throws Exception { return result.get(25, TimeUnit.SECONDS); }
        public String failure() throws Exception {
            try { await(); throw new AssertionError("expected_failure"); }
            catch (java.util.concurrent.ExecutionException expected) { return error; }
        }
    }
}
