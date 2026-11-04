package com.streetfitting.app.plugins.voice;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Voice")
public class VoicePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void stop(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void cancel(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
