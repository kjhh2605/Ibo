package com.streetfitting.app.plugins.media;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Media")
public class MediaPlugin extends Plugin {
    @PluginMethod
    public void pick(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void exportPhoto(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void exportResult(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void discard(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
