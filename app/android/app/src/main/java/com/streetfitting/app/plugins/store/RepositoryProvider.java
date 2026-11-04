package com.streetfitting.app.plugins.store;

import android.content.Context;

/** S06 must replace this fail-closed extension point with its single-writer repository. */
public final class RepositoryProvider {
    private RepositoryProvider() {}
    public static NativeRepository get(Context context) {
        throw new UnsupportedOperationException("Native repository is not implemented");
    }
}
