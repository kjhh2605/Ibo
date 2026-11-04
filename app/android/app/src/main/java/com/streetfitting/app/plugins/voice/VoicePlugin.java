package com.streetfitting.app.plugins.voice;

import android.Manifest;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

@CapacitorPlugin(name = "Voice", permissions = {
    @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})
})
public class VoicePlugin extends Plugin {
    private VoiceRecorder recorder;
    private boolean starting;
    @Override public void load() {
        recorder = new VoiceRecorder(new File(getContext().getCacheDir(), "voice"), (name, value) -> notifyListeners(name, value));
    }
    @PluginMethod public synchronized void start(PluginCall call) {
        if (starting || recorder.active()) { reject(call, "busy"); return; }
        starting = true;
        if (!VoiceSourceFactory.fixture(getActivity()) && getPermissionState("microphone") != PermissionState.GRANTED) {
            if (getPermissionState("microphone") == PermissionState.DENIED) { starting = false; reject(call, "microphone_permission_denied"); }
            else requestPermissionForAlias("microphone", call, "microphoneResult");
            return;
        }
        begin(call);
    }
    @PermissionCallback private synchronized void microphoneResult(PluginCall call) {
        if (!starting) { reject(call, "cancelled"); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            starting = false; reject(call, "microphone_permission_denied"); return;
        }
        begin(call);
    }
    private void begin(PluginCall call) {
        try { recorder.start(VoiceSourceFactory.open(getActivity())); call.resolve(); }
        catch (Exception error) { reject(call, error instanceof VoiceFailure ? ((VoiceFailure)error).code : "audio_unavailable"); }
        finally { starting = false; }
    }
    @PluginMethod public void stop(PluginCall call) {
        recorder.stop().whenComplete((result, error) -> {
            if (error == null) call.resolve(result);
            else reject(call, error instanceof VoiceFailure ? ((VoiceFailure)error).code : "io_error");
        });
    }
    @PluginMethod public synchronized void cancel(PluginCall call) {
        starting = false;
        recorder.cancel().whenComplete((result, error) -> call.resolve());
    }
    // Permission dialogs pause the Activity; they must not cancel their own start.
    @Override protected synchronized void handleOnPause() { if (recorder != null && recorder.active()) recorder.cancel(); }
    @Override protected synchronized void handleOnStop() { starting = false; if (recorder != null && recorder.active()) recorder.cancel(); }
    @Override protected synchronized void handleOnDestroy() { starting = false; if (recorder != null && recorder.active()) recorder.cancel(); }
    private void reject(PluginCall call, String code) {
        JSObject details = new JSObject(); details.put("retryable", !"microphone_permission_denied".equals(code));
        call.reject(code, code, details);
    }
}
