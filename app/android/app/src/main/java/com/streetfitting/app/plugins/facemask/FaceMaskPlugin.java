package com.streetfitting.app.plugins.facemask;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FaceMask")
public class FaceMaskPlugin extends Plugin {
    @PluginMethod
    public void register(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void compose(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void evaluateFixture(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
