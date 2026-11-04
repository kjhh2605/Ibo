package com.streetfitting.app.auth;

import android.content.Context;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.FirebaseApp;
import com.google.firebase.appcheck.AppCheckProvider;
import com.google.firebase.appcheck.AppCheckToken;
import com.google.firebase.appcheck.FirebaseAppCheck;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** Debug-only provider: exchanges a private debug secret without logging it. */
final class AppCheckSetup {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private AppCheckSetup() {}

    static void install() {
        SilentDebugProvider provider = new SilentDebugProvider(FirebaseApp.getInstance());
        FirebaseAppCheck.getInstance().installAppCheckProviderFactory(app -> provider);
    }

    private static final class SilentDebugProvider implements AppCheckProvider {
        private final FirebaseApp app;
        private final String secret;
        SilentDebugProvider(FirebaseApp app) {
            this.app = app;
            android.content.SharedPreferences prefs = app.getApplicationContext()
                .getSharedPreferences("sf_app_check_debug", Context.MODE_PRIVATE);
            String existing = prefs.getString("secret", null);
            secret = existing == null ? UUID.randomUUID().toString() : existing;
            if (existing == null && !prefs.edit().putString("secret", secret).commit()) {
                throw new IllegalStateException("Could not persist App Check debug secret");
            }
        }
        @Override public Task<AppCheckToken> getToken() {
            return Tasks.call(EXECUTOR, () -> {
                String project = app.getOptions().getProjectId();
                String appId = app.getOptions().getApplicationId();
                String apiKey = app.getOptions().getApiKey();
                String endpoint = "https://firebaseappcheck.googleapis.com/v1/projects/"
                    + URLEncoder.encode(project, "UTF-8") + "/apps/"
                    + URLEncoder.encode(appId, "UTF-8") + ":exchangeDebugToken?key="
                    + URLEncoder.encode(apiKey, "UTF-8");
                HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
                try {
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(15000);
                    connection.setRequestMethod("POST");
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    byte[] request = new JSONObject().put("debugToken", secret).toString().getBytes(StandardCharsets.UTF_8);
                    try (java.io.OutputStream out = connection.getOutputStream()) { out.write(request); }
                    if (connection.getResponseCode() != 200) throw new IllegalStateException("App Check exchange failed");
                    String response;
                    try (java.io.InputStream in = connection.getInputStream();
                         java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
                        byte[] buffer = new byte[4096]; int count;
                        while ((count = in.read(buffer)) != -1) bytes.write(buffer, 0, count);
                        response = bytes.toString("UTF-8");
                    }
                    JSONObject json = new JSONObject(response);
                    String token = json.getString("token");
                    String ttl = json.getString("ttl");
                    long expires = System.currentTimeMillis() + (long) (Double.parseDouble(ttl.replace("s", "")) * 1000);
                    return new AppCheckToken() {
                        @Override public String getToken() { return token; }
                        @Override public long getExpireTimeMillis() { return expires; }
                    };
                } finally { connection.disconnect(); }
            });
        }
    }
}
