package com.streetfitting.app.plugins.capture;

import android.app.Activity;

final class CaptureSourceFactory {
    static boolean fixture(Activity activity) { return false; }
    static CaptureSource create(Activity activity, boolean front) { return new CameraSource(activity, front); }
}
