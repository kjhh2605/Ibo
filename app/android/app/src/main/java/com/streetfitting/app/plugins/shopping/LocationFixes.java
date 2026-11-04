package com.streetfitting.app.plugins.shopping;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import java.util.concurrent.CompletableFuture;

public final class LocationFixes {
    private LocationFixes() { }
    public static boolean permitted(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    public static boolean eligible(JSObject fix, long time) {
        return fix != null && Math.abs(fix.optLong("t") - time) <= 15000 && fix.optDouble("accuracyM", Double.POSITIVE_INFINITY) <= 100 && fix.optDouble("accuracyM", -1) >= 0;
    }
    public static JSObject from(Location location) {
        JSObject fix = new JSObject(); fix.put("t", location.getTime()); fix.put("lat", location.getLatitude());
        fix.put("lng", location.getLongitude()); fix.put("accuracyM", location.getAccuracy()); return fix;
    }
    public static JSObject point(JSObject fix) {
        JSObject point = new JSObject(); point.put("lat", fix.optDouble("lat")); point.put("lng", fix.optDouble("lng")); point.put("accuracyM", fix.optDouble("accuracyM")); return point;
    }
    public static CompletableFuture<JSObject> current(Context context) {
        CompletableFuture<JSObject> result = new CompletableFuture<>();
        if (!permitted(context)) { result.completeExceptionally(new IllegalStateException("location_permission_denied")); return result; }
        CancellationTokenSource cancellation = new CancellationTokenSource();
        Handler main = new Handler(Looper.getMainLooper());
        Runnable timeout = () -> { result.completeExceptionally(new IllegalStateException("location_disabled")); cancellation.cancel(); };
        main.postDelayed(timeout, 15000);
        result.whenComplete((fix, error) -> main.removeCallbacks(timeout));
        try {
            CurrentLocationRequest request = new CurrentLocationRequest.Builder().setPriority(Priority.PRIORITY_HIGH_ACCURACY).setMaxUpdateAgeMillis(15000).setDurationMillis(15000).build();
            LocationServices.getFusedLocationProviderClient(context).getCurrentLocation(request, cancellation.getToken()).addOnSuccessListener(location -> {
                JSObject fix = location == null ? null : from(location);
                if (eligible(fix, System.currentTimeMillis())) result.complete(fix);
                else result.completeExceptionally(new IllegalStateException("location_disabled"));
            }).addOnFailureListener(error -> result.completeExceptionally(new IllegalStateException(permitted(context) ? "location_disabled" : "location_permission_denied")));
        } catch (SecurityException error) { result.completeExceptionally(new IllegalStateException("location_permission_denied")); }
        return result;
    }
}
