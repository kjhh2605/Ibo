package com.streetfitting.app.plugins.store;

import com.getcapacitor.JSObject;

/** S06 owns the SQLite implementation; each operation is an atomic domain transaction. */
public interface NativeRepository {
    /** {fix} -> {trip, shop}. */
    JSObject startSession(JSObject input);
    /** {tripId, fix} -> Shop. */
    JSObject newShop(JSObject input);
    /** {tripId, endedAt} -> Trip. */
    JSObject stopSession(JSObject input);
    /** {photo} -> Photo. */
    JSObject commitPhoto(JSObject input);
    /** {embedding} -> PhotoEmbedding. */
    JSObject commitEmbedding(JSObject input);
    /** {selfPhoto} -> SelfPhoto. */
    JSObject replaceSelfPhoto(JSObject input);
}
