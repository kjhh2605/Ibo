package com.streetfitting.app.auth;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.auth.FirebaseAuth;

@CapacitorPlugin(name = "SfAuth")
public class SfAuthPlugin extends Plugin {
    @Override public void load() { AppCheckSetup.install(); }

    @PluginMethod public void getTokens(PluginCall call) {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() == null) {
            auth.signInAnonymously().addOnSuccessListener(result -> obtainTokens(call, auth))
                .addOnFailureListener(error -> call.reject("Authentication failed", "auth_unavailable"));
        } else {
            obtainTokens(call, auth);
        }
    }

    private void obtainTokens(PluginCall call, FirebaseAuth auth) {
        if (auth.getCurrentUser() == null) {
            call.reject("Authentication failed", "auth_unavailable");
            return;
        }
        boolean forceRefresh = Boolean.TRUE.equals(call.getBoolean("forceRefresh", false));
        auth.getCurrentUser().getIdToken(forceRefresh).addOnSuccessListener(id -> {
            if (id.getToken() == null) {
                call.reject("Authentication failed", "auth_unavailable");
                return;
            }
            FirebaseAppCheck.getInstance().getAppCheckToken(forceRefresh).addOnSuccessListener(check -> {
                JSObject tokens = new JSObject();
                tokens.put("idToken", id.getToken());
                tokens.put("appCheckToken", check.getToken());
                call.resolve(tokens);
            }).addOnFailureListener(error -> call.reject("App Check unavailable", "app_check_unavailable"));
        }).addOnFailureListener(error -> call.reject("Authentication failed", "auth_unavailable"));
    }
}
