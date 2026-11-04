package com.streetfitting.app.plugins.store;

import android.content.Context;

/** One repository and writer monitor shared by every native plugin. */
public final class RepositoryProvider {
    private static SqliteRepository instance;
    private RepositoryProvider() {}
    public static synchronized SqliteRepository get(Context context) {
        if (instance == null) instance = new SqliteRepository(context.getApplicationContext());
        return instance;
    }
}
