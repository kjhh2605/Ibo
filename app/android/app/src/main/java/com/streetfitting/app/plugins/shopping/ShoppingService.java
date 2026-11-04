package com.streetfitting.app.plugins.shopping;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.streetfitting.app.MainActivity;
import com.streetfitting.app.plugins.store.NativeRepository;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class ShoppingService extends Service {
    public static final String CHANNEL = "shopping_session";
    public static final int NOTIFICATION_ID = 4104;
    static volatile ShoppingService running;
    static CompletableFuture<JSObject> startup;
    private final Handler main = new Handler(Looper.getMainLooper());
    public static ShoppingService active() { return running; }
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private NativeRepository repository;
    private FusedLocationProviderClient locations;
    private String phase = "starting";
    private JSObject trip;
    private JSObject shop;
    private JSObject latestFix;
    private int photos;
    private int shutters;
    private CompletableFuture<JSObject> stopping;
    private boolean noticeSent;
    private final LocationCallback updates = new LocationCallback() {
        @Override public void onLocationResult(LocationResult result) {
            work.execute(() -> {
                for (android.location.Location location : result.getLocations()) {
                    JSObject fix = LocationFixes.from(location);
                    synchronized (ShoppingService.this) {
                        if (!"recording".equals(phase) || !LocationFixes.eligible(fix, System.currentTimeMillis())) continue;
                        repository.appendTrail(new JSObject().put("tripId", trip.optString("id")).put("fix", fix));
                        latestFix = fix;
                        ShoppingSessionPlugin.emit("location", fix);
                        publish();
                    }
                }
            });
        }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (running != ShoppingService.this) return;
            if (!LocationFixes.permitted(ShoppingService.this)) {
                stopRecording().whenComplete((value, error) -> ShoppingSessionPlugin.emit("error", new JSObject().put("code", "location_permission_denied").put("retryable", false)));
                return;
            }
            synchronized (ShoppingService.this) { if ("recording".equals(phase)) publish(); }
            main.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate() {
        super.onCreate(); running = this;
        repository = RepositoryProvider.get(this);
        repository.setSessionStopper(this::repositoryStopping);
        locations = LocationServices.getFusedLocationProviderClient(this);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Shopping session", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); channel.enableVibration(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!LocationFixes.permitted(this)) { failStart("location_permission_denied"); return START_NOT_STICKY; }
        if ("recording".equals(phase)) { completeStartup(); return START_STICKY; }
        try { startForeground(NOTIFICATION_ID, notification()); }
        catch (RuntimeException error) { failStart("service_unavailable"); return START_NOT_STICKY; }
        work.execute(() -> {
            try {
                JSObject saved = repository.getSession();
                JSObject savedTrip = saved.getJSObject("trip");
                if (intent == null && savedTrip == null) { failStart("service_unavailable"); return; }
                if (savedTrip != null) {
                    synchronized (this) { trip = savedTrip; shop = saved.getJSObject("shop"); photos = saved.optJSONArray("photos") == null ? 0 : saved.optJSONArray("photos").length(); latestFix = saved.getJSObject("latestFix"); }
                    beginRecording();
                } else LocationFixes.current(this).whenComplete((fix, error) -> work.execute(() -> {
                    if (error != null) { failStart(error.getMessage()); return; }
                    try {
                        JSObject session = repository.startSession(new JSObject().put("fix", fix));
                        synchronized (this) { trip = session.getJSObject("trip"); shop = session.getJSObject("shop"); latestFix = fix; photos = 0; }
                        beginRecording();
                    } catch (RuntimeException failure) { failStart("service_unavailable"); }
                }));
            } catch (RuntimeException error) { failStart("service_unavailable"); }
        });
        return START_STICKY;
    }
    private void beginRecording() {
        synchronized (this) { phase = "recording"; }
        main.post(() -> {
            try {
                LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000).setMinUpdateIntervalMillis(5000).setMaxUpdateDelayMillis(10000).build();
                locations.requestLocationUpdates(request, updates, Looper.getMainLooper());
                synchronized (this) {
                    publish(); completeStartup();
                    if (!notificationAvailable() && !noticeSent) { noticeSent = true; ShoppingSessionPlugin.emit("notice", new JSObject().put("code", "notification_unavailable")); }
                }
                main.removeCallbacks(tick); main.post(tick);
            } catch (SecurityException error) { stopRecording(); failStart("location_permission_denied"); }
        });
    }
    public synchronized JSObject state() {
        return new JSObject().put("phase", phase).put("trip", trip == null ? JSONObject.NULL : trip).put("shop", shop == null ? JSONObject.NULL : shop)
            .put("locationPermission", LocationFixes.permitted(this) ? "granted" : "denied").put("notificationPermission", notificationAvailable() ? "granted" : "denied")
            .put("photos", photos).put("elapsedMinutes", trip == null ? 0 : Math.max(0, (System.currentTimeMillis() - trip.optLong("startedAt")) / 60000))
            .put("latestFix", latestFix == null ? JSONObject.NULL : latestFix);
    }
    public synchronized CompletableFuture<JSObject> newShop() {
        CompletableFuture<JSObject> result = new CompletableFuture<>();
        if (!"recording".equals(phase)) { result.completeExceptionally(new IllegalStateException("not_recording")); return result; }
        String tripId = trip.optString("id");
        LocationFixes.current(this).whenComplete((fix, error) -> work.execute(() -> {
            synchronized (this) {
                if (error != null) { result.completeExceptionally(error); return; }
                if (!"recording".equals(phase) || !tripId.equals(trip.optString("id"))) { result.completeExceptionally(new IllegalStateException("not_recording")); return; }
                try { shop = repository.newShop(new JSObject().put("tripId", tripId).put("fix", fix)); latestFix = fix; publish(); result.complete(shop); }
                catch (RuntimeException failure) { result.completeExceptionally(failure); }
            }
        }));
        return result;
    }
    public synchronized JSObject beginShutter(long takenAt) {
        if (!"recording".equals(phase)) throw new IllegalStateException("not_recording");
        shutters++;
        return new JSObject().put("tripId", trip.optString("id")).put("shopId", shop.optString("id")).put("takenAt", takenAt);
    }
    public synchronized void endShutter(boolean committed) {
        if (shutters <= 0) throw new IllegalStateException("unbalanced_shutter");
        shutters--; if (committed) photos++;
        publish(); if (shutters == 0 && stopping != null) work.execute(this::finishStop);
    }
    public synchronized CompletableFuture<JSObject> stopRecording() {
        if (stopping != null) return stopping;
        stopping = new CompletableFuture<>(); phase = "stopping"; publish();
        if (shutters == 0) work.execute(this::finishStop);
        return stopping;
    }
    private synchronized void finishStop() {
        if (stopping == null || stopping.isDone() || shutters != 0) return;
        try {
            JSObject ended = trip == null ? null : repository.stopSession(new JSObject().put("tripId", trip.optString("id")).put("endedAt", System.currentTimeMillis()));
            phase = "idle"; trip = null; shop = null; latestFix = null; photos = 0;
            repositoryStopping(); publish(); stopping.complete(ended);
        } catch (RuntimeException error) { stopping.completeExceptionally(error); }
    }
    private void repositoryStopping() {
        locations.removeLocationUpdates(updates); main.removeCallbacks(tick);
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    private synchronized void failStart(String code) {
        phase = "idle";
        synchronized (ShoppingService.class) { if (startup != null) startup.completeExceptionally(new IllegalStateException(code)); }
        ShoppingSessionPlugin.emit("error", new JSObject().put("code", code).put("retryable", !"location_permission_denied".equals(code)));
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    private void completeStartup() { synchronized (ShoppingService.class) { if (startup != null) startup.complete(state()); } }
    private void publish() {
        ShoppingSessionPlugin.emit("state", state());
        if ("recording".equals(phase)) main.post(() -> { if (running == this) getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification()); });
    }
    private boolean notificationAvailable() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 26 || getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    private PendingIntent link(String url, int request) {
        Intent intent = new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, request, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private synchronized Notification notification() {
        long minutes = trip == null ? 0 : Math.max(0, (System.currentTimeMillis() - trip.optLong("startedAt")) / 60000);
        String text = "Shop " + (shop == null ? 1 : shop.optInt("n")) + " · " + photos + " photos · " + minutes + " min";
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_camera).setContentTitle("Shopping mode").setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(link("streetfitting://home", 4100))
            .addAction(android.R.drawable.ic_menu_camera, "Take photo", link("streetfitting://capture", 4101))
            .addAction(android.R.drawable.ic_menu_add, "New shop", link("streetfitting://capture?newShop=1", 4102)).build();
    }
    @Override public void onDestroy() {
        locations.removeLocationUpdates(updates); main.removeCallbacks(tick);
        repository.setSessionStopper(null); if (running == this) running = null;
        work.shutdown(); super.onDestroy();
    }
}
