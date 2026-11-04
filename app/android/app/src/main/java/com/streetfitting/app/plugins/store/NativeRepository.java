package com.streetfitting.app.plugins.store;

import com.getcapacitor.JSObject;

/** Device-only repository. All mutations are serialized atomic domain transactions. */
public interface NativeRepository {
    JSObject startSession(JSObject input);
    JSObject newShop(JSObject input);
    JSObject stopSession(JSObject input);
    JSObject commitPhoto(JSObject input);
    JSObject commitEmbedding(JSObject input);
    JSObject replaceSelfPhoto(JSObject input);
    JSObject get(JSObject input);
    JSObject list(JSObject input);
    JSObject getSelfPhoto();
    JSObject appendTrail(JSObject input);
    JSObject markIndexFailed(JSObject input);
    JSObject registerAsset(JSObject input);
    JSObject getAsset(JSObject input);
    JSObject discardAsset(JSObject input);
    JSObject adoptCandidate(JSObject input);
    JSObject retainSelf(JSObject input);
    JSObject releaseSelf(JSObject input);
    JSObject getSession();
    JSObject nearestFix(JSObject input);
    JSObject getPhoto(JSObject input);
    void setSessionStopper(Runnable stopper);
    JSObject saveCandidate(JSObject input);
    JSObject updateShop(JSObject input);
    JSObject updatePiece(JSObject input);
    JSObject prepareResult(JSObject input);
    JSObject saveResult(JSObject input);
    JSObject discardResultDraft(JSObject input);
    JSObject deleteTrip(JSObject input);
    JSObject deletePhoto(JSObject input);
    JSObject deletePiece(JSObject input);
    JSObject deleteResult(JSObject input);
    JSObject enqueue(JSObject input);
    JSObject nextJob(JSObject input);
    JSObject beginJob(JSObject input);
    JSObject completeJob(JSObject input);
    JSObject failJob(JSObject input);
    JSObject discardTemp(JSObject input);
}
