package com.streetfitting.app.plugins.shopping;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/** Placeholder only: S04 implements the foreground location service. */
public class ShoppingService extends Service {
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        stopSelf();
        return START_NOT_STICKY;
    }
}
