package com.streetfitting.app.plugins.segmenter;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Segmenter")
public class SegmenterPlugin extends Plugin {
    @PluginMethod
    public void prepare(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void tap(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void person(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void release(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
