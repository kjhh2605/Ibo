package com.streetfitting.app.plugins.capture;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Capture")
public class CapturePlugin extends Plugin {
    @PluginMethod
    public void openPreview(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void setPreviewRect(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void takePhoto(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void closePreview(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
