package com.streetfitting.app.plugins.store;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Store")
public class StorePlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void list(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void getSelfPhoto(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void saveCandidate(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void updateShop(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void updatePiece(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void prepareResult(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void saveResult(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void discardResultDraft(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void deleteTrip(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void deletePhoto(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void deletePiece(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void deleteResult(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void enqueue(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void nextJob(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void beginJob(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void completeJob(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void failJob(PluginCall call) { rejectUnimplemented(call); }
    @PluginMethod
    public void discardTemp(PluginCall call) { rejectUnimplemented(call); }
    private void rejectUnimplemented(PluginCall call) {
        JSObject details = new JSObject();
        details.put("retryable", false);
        call.reject("Not implemented", "unimplemented", details);
    }
}
