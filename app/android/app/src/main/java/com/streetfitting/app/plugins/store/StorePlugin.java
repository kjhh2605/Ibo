package com.streetfitting.app.plugins.store;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.pm.ApplicationInfo;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "Store")
public class StorePlugin extends Plugin {
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private SqliteRepository repository;
    private final SqliteRepository.ChangeListener listener = change -> notifyListeners("changed", change);
    @Override public void load() {
        repository = RepositoryProvider.get(getContext());
        repository.addChangeListener(listener);
    }
    @Override protected void handleOnDestroy() {
        if (repository != null) repository.removeChangeListener(listener);
        writer.shutdown();
    }
    private interface Operation { JSObject run(); }
    private void execute(PluginCall call, Operation operation, boolean nullable) {
        writer.execute(() -> {
            try {
                JSObject result = operation.run();
                if (nullable) {
                    JSObject envelope = new JSObject();
                    envelope.put("value", result == null ? JSONObject.NULL : result);
                    call.resolve(envelope);
                } else call.resolve(result);
            } catch (Exception error) {
                String code = error instanceof IllegalArgumentException ? error.getMessage() : "io_error";
                if (code == null || !code.matches("[a-z_]{1,64}")) code = "io_error";
                JSObject details = new JSObject();
                details.put("retryable", code.equals("io_error"));
                call.reject("The device operation could not be completed.", code, details);
            }
        });
    }
    /** Native build gate for the read-only development observer; exposes no stored data. */
    @PluginMethod public void getRuntimeInfo(PluginCall call) {
        JSObject info = new JSObject();
        info.put("debug", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        call.resolve(info);
    }
    /** Private adb/WebView tooling only; release builds reject before repository access. */
    @PluginMethod public void debugDemoFixture(PluginCall call) {
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("Demo fixture import is unavailable.", "unsupported");
            return;
        }
        execute(call, () -> repository.debugDemoFixture(call.getData()), false);
    }
    @PluginMethod public void get(PluginCall call) { execute(call, () -> repository.get(call.getData()), true); }
    @PluginMethod public void list(PluginCall call) { execute(call, () -> repository.list(call.getData()), false); }
    @PluginMethod public void getSelfPhoto(PluginCall call) { execute(call, () -> repository.getSelfPhoto(), true); }
    @PluginMethod public void saveCandidate(PluginCall call) { execute(call, () -> repository.saveCandidate(call.getData()), false); }
    @PluginMethod public void updateShop(PluginCall call) { execute(call, () -> repository.updateShop(call.getData()), false); }
    @PluginMethod public void updatePiece(PluginCall call) { execute(call, () -> repository.updatePiece(call.getData()), false); }
    @PluginMethod public void prepareResult(PluginCall call) { execute(call, () -> repository.prepareResult(call.getData()), false); }
    @PluginMethod public void saveResult(PluginCall call) { execute(call, () -> repository.saveResult(call.getData()), false); }
    @PluginMethod public void discardResultDraft(PluginCall call) { execute(call, () -> repository.discardResultDraft(call.getData()), false); }
    @PluginMethod public void deleteTrip(PluginCall call) { execute(call, () -> repository.deleteTrip(call.getData()), false); }
    @PluginMethod public void deletePhoto(PluginCall call) { execute(call, () -> repository.deletePhoto(call.getData()), false); }
    @PluginMethod public void deletePiece(PluginCall call) { execute(call, () -> repository.deletePiece(call.getData()), false); }
    @PluginMethod public void deleteResult(PluginCall call) { execute(call, () -> repository.deleteResult(call.getData()), false); }
    @PluginMethod public void enqueue(PluginCall call) { execute(call, () -> repository.enqueue(call.getData()), false); }
    @PluginMethod public void nextJob(PluginCall call) { execute(call, () -> repository.nextJob(call.getData()), true); }
    @PluginMethod public void beginJob(PluginCall call) { execute(call, () -> repository.beginJob(call.getData()), false); }
    @PluginMethod public void completeJob(PluginCall call) { execute(call, () -> repository.completeJob(call.getData()), false); }
    @PluginMethod public void failJob(PluginCall call) { execute(call, () -> repository.failJob(call.getData()), false); }
    @PluginMethod public void discardTemp(PluginCall call) { execute(call, () -> repository.discardTemp(call.getData()), false); }
    /** File bookkeeping only: no entity insertion or public Store DTO extension. */
    @PluginMethod public void registerTemp(PluginCall call) { execute(call, () -> repository.adoptCandidate(call.getData()), false); }
}
