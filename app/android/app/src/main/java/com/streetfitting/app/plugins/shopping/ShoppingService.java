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
import java.util.concurrent.RejectedExecutionException;

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
    private volatile boolean terminated;
    private boolean startRequested;
    private CompletableFuture<JSObject> initialFix;
    private boolean execute(Runnable task) {
        try { work.execute(task); return true; }
        catch (RejectedExecutionException ignored) { return false; }
    }
    private final LocationCallback updates = new LocationCallback() {
        @Override public void onLocationResult(LocationResult result) {
            execute(() -> {
                for (android.location.Location location : result.getLocations()) {
                    JSObject fix = LocationFixes.from(location);
                    synchronized (ShoppingService.this) {
                        if (terminated || !"recording".equals(phase) || !LocationFixes.eligible(fix, System.currentTimeMillis())) continue;
                        try {
                            repository.appendTrail(new JSObject().put("tripId", trip.optString("id")).put("fix", fix));
                            if (terminated) return;
                            latestFix = fix;
                            ShoppingSessionPlugin.emit("location", fix);
                            publish();
                        } catch (RuntimeException error) { stopRecording(); }
                    }
                }
            });
        }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (running != ShoppingService.this || terminated) return;
            if (!LocationFixes.permitted(ShoppingService.this)) {
                stopRecording().whenComplete((value, error) -> ShoppingSessionPlugin.emit("error", new JSObject().put("code", "location_permission_denied").put("retryable", false)));
                return;
            }
            execute(() -> {
                synchronized (ShoppingService.this) {
                    if (terminated || !"recording".equals(phase)) return;
                    JSObject saved = repository.getSession();
                    if (terminated) return;
                    shop = saved.getJSObject("shop");
                    photos = currentShopPhotos(saved);
                    publish();
                }
            });
            main.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate() {
        super.onCreate(); running = this;
        repository = RepositoryProvider.get(this);
        repository.setSessionStopper(this::repositoryStopping);
        locations = LocationServices.getFusedLocationProviderClient(this);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Shopping mode", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); channel.enableVibration(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!LocationFixes.permitted(this)) { failStart("location_permission_denied"); return START_NOT_STICKY; }
        synchronized (this) {
            if (terminated || "stopping".equals(phase)) return START_NOT_STICKY;
            if ("recording".equals(phase)) { completeStartup(); return START_STICKY; }
            if (startRequested) return START_STICKY;
            startRequested = true;
        }
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION_ID, notification());
        } catch (RuntimeException error) { failStart("service_unavailable"); return START_NOT_STICKY; }
        execute(() -> {
            synchronized (this) {
                if (terminated || !"starting".equals(phase)) return;
                try {
                    JSObject saved = repository.getSession();
                    JSObject savedTrip = saved.getJSObject("trip");
                    if (intent == null) {
                        if (savedTrip == null) { failStart("service_unavailable"); return; }
                        trip = savedTrip; shop = saved.getJSObject("shop");
                        photos = currentShopPhotos(saved);
                        latestFix = saved.getJSObject("latestFix");
                        beginRecording();
                        return;
                    }
                    // Only a system sticky restart may resume a persisted recording.
                    if (savedTrip != null) repository.stopSession(new JSObject().put("tripId", savedTrip.optString("id")).put("endedAt", System.currentTimeMillis()));
                    initialFix = LocationFixes.current(this);
                    initialFix.whenComplete((fix, error) -> execute(() -> {
                        synchronized (this) {
                            if (terminated || !"starting".equals(phase)) return;
                            if (error != null) { failStart(error.getMessage()); return; }
                            try {
                                JSObject session = repository.startSession(new JSObject().put("fix", fix));
                                trip = session.getJSObject("trip"); shop = session.getJSObject("shop"); latestFix = fix; photos = 0;
                                beginRecording();
                            } catch (RuntimeException failure) { failStart("service_unavailable"); }
                        }
                    }));
                } catch (RuntimeException error) { failStart("service_unavailable"); }
            }
        });
        return START_STICKY;
    }
    private void beginRecording() {
        if (terminated || !"starting".equals(phase)) return;
        main.post(() -> {
            synchronized (this) {
                if (terminated || !"starting".equals(phase)) return;
                try {
                    LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000).setMinUpdateIntervalMillis(5000).setMaxUpdateDelayMillis(10000).build();
                    locations.requestLocationUpdates(request, updates, Looper.getMainLooper()).addOnCompleteListener(task -> {
                        synchronized (this) {
                            if (terminated || !"starting".equals(phase)) { locations.removeLocationUpdates(updates); return; }
                            if (!task.isSuccessful()) { failStart(LocationFixes.permitted(this) ? "service_unavailable" : "location_permission_denied"); return; }
                            phase = "recording"; publish(); completeStartup();
                            if (!notificationAvailable() && !noticeSent) { noticeSent = true; ShoppingSessionPlugin.emit("notice", new JSObject().put("code", "notification_unavailable")); }
                            main.removeCallbacks(tick); main.post(tick);
                        }
                    });
                } catch (SecurityException error) { failStart("location_permission_denied"); }
            }
        });
    }
    public synchronized JSObject state() {
        return new JSObject().put("phase", phase).put("trip", trip == null ? JSONObject.NULL : trip).put("shop", shop == null ? JSONObject.NULL : shop)
            .put("locationPermission", LocationFixes.permitted(this) ? "granted" : "denied").put("notificationPermission", notificationAvailable() ? "granted" : "denied")
            .put("photos", photos).put("elapsedMinutes", trip == null ? 0 : Math.max(0, (System.currentTimeMillis() - trip.optLong("startedAt")) / 60000))
            .put("latestFix", latestFix == null ? JSONObject.NULL : latestFix);
    }
    private int currentShopPhotos(JSObject saved) {
        org.json.JSONArray items = saved.optJSONArray("photos");
        JSObject currentShop = saved.getJSObject("shop");
        if (items == null || currentShop == null) return 0;
        int count = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject photo = items.optJSONObject(i);
            if (photo != null && currentShop.optString("id").equals(photo.optString("shopId"))) count++;
        }
        return count;
    }
    public synchronized CompletableFuture<JSObject> newShop() {
        CompletableFuture<JSObject> result = new CompletableFuture<>();
        if (terminated || !"recording".equals(phase)) { result.completeExceptionally(new IllegalStateException("not_recording")); return result; }
        String tripId = trip.optString("id");
        LocationFixes.current(this).whenComplete((fix, error) -> {
            if (!execute(() -> {
                synchronized (this) {
                    if (error != null) { result.completeExceptionally(error); return; }
                    if (terminated || !"recording".equals(phase) || !tripId.equals(trip.optString("id"))) { result.completeExceptionally(new IllegalStateException("not_recording")); return; }
                    try { shop = repository.newShop(new JSObject().put("tripId", tripId).put("fix", fix)); latestFix = fix; photos = 0; publish(); result.complete(shop); }
                    catch (RuntimeException failure) { result.completeExceptionally(failure); }
                }
            })) result.completeExceptionally(new IllegalStateException("not_recording"));
        });
        return result;
    }
    public synchronized JSObject beginShutter(long takenAt) {
        if (terminated || !"recording".equals(phase)) throw new IllegalStateException("not_recording");
        shutters++;
        return new JSObject().put("tripId", trip.optString("id")).put("shopId", shop.optString("id")).put("takenAt", takenAt);
    }
    public synchronized void endShutter(boolean committed) {
        if (shutters <= 0) throw new IllegalStateException("unbalanced_shutter");
        shutters--;
        if (committed && !terminated) execute(() -> {
            synchronized (this) {
                if (terminated) return;
                try { photos = currentShopPhotos(repository.getSession()); publish(); }
                catch (RuntimeException failure) { stopRecording(); }
            }
        });
        if (!terminated) publish();
        if (shutters == 0 && stopping != null) execute(this::finishStop);
    }
    public synchronized CompletableFuture<JSObject> stopRecording() {
        if (stopping != null) return stopping;
        stopping = new CompletableFuture<>(); phase = "stopping"; publish();
        if (initialFix != null) initialFix.cancel(false);
        if (shutters == 0) execute(this::finishStop);
        return stopping;
    }
    private synchronized void finishStop() {
        if (terminated || stopping == null || stopping.isDone() || shutters != 0) return;
        try {
            JSObject ended = trip == null ? null : repository.stopSession(new JSObject().put("tripId", trip.optString("id")).put("endedAt", System.currentTimeMillis()));
            phase = "idle"; trip = null; shop = null; latestFix = null; photos = 0;
            terminated = true; stopService(); publish(); stopping.complete(ended);
            synchronized (ShoppingService.class) { if (startup != null && !startup.isDone()) startup.completeExceptionally(new IllegalStateException("cancelled")); }
        } catch (RuntimeException error) { CompletableFuture<JSObject> failed = stopping; stopping = null; phase = "recording"; publish(); failed.completeExceptionally(error); }
    }
    private void repositoryStopping() {
        // Called with the repository lock held: never acquire the service lock here.
        terminated = true;
        main.post(this::stopService);
        execute(() -> {
            synchronized (this) {
                phase = "idle"; trip = null; shop = null; latestFix = null; photos = 0;
                publish();
                if (stopping != null) stopping.completeExceptionally(new IllegalStateException("not_recording"));
            }
        });
    }
    private void stopService() {
        locations.removeLocationUpdates(updates); main.removeCallbacks(tick);
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    private synchronized void failStart(String code) {
        if (terminated) return;
        terminated = true; phase = "stopping";
        execute(() -> {
            try {
                if (trip != null) repository.stopSession(new JSObject().put("tripId", trip.optString("id")).put("endedAt", System.currentTimeMillis()));
                synchronized (this) { phase = "idle"; trip = null; shop = null; latestFix = null; photos = 0; publish(); }
            } finally {
                synchronized (ShoppingService.class) { if (startup != null) startup.completeExceptionally(new IllegalStateException(code)); }
                ShoppingSessionPlugin.emit("error", new JSObject().put("code", code).put("retryable", !"location_permission_denied".equals(code)));
                main.post(this::stopService);
            }
        });
    }
    private void completeStartup() { synchronized (ShoppingService.class) { if (startup != null) startup.complete(state()); } }
    private void publish() {
        ShoppingSessionPlugin.emit("state", state());
        if (!terminated && "recording".equals(phase)) main.post(() -> { synchronized (this) { if (running == this && !terminated && "recording".equals(phase)) getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification()); } });
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
        String text = shop == null ? "Starting shopping mode…" : "Shop " + shop.optInt("n") + " · " + photos + " photos · " + minutes + " min";
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_camera).setContentTitle("Shopping mode").setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(link("streetfitting://home", 4100))
            .addAction(android.R.drawable.ic_menu_camera, "Take photo", link("streetfitting://capture", 4101))
            .addAction(android.R.drawable.ic_menu_add, "New shop", link("streetfitting://capture?newShop=1", 4102)).build();
    }
    @Override public void onDestroy() {
        terminated = true;
        if (initialFix != null) initialFix.cancel(false);
        synchronized (ShoppingService.class) { if (startup != null && !startup.isDone()) startup.completeExceptionally(new IllegalStateException("service_unavailable")); }
        locations.removeLocationUpdates(updates); main.removeCallbacks(tick);
        repository.setSessionStopper(null); if (running == this) running = null;
        work.shutdown(); super.onDestroy();
    }
}
