package com.tongkan.mobile.account;

import android.content.Context;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.tongkan.mobile.BuildConfig;

public final class FcmPushTokenProvider implements PushTokenProvider {
    private static final String PREFS = "tongkan_push";
    private static final String TOKEN = "fcm_token";

    @Override public String providerId() { return "fcm"; }

    public static boolean isConfigured() {
        return !BuildConfig.FCM_API_KEY.isEmpty()
            && !BuildConfig.FCM_APPLICATION_ID.isEmpty()
            && !BuildConfig.FCM_PROJECT_ID.isEmpty()
            && !BuildConfig.FCM_SENDER_ID.isEmpty();
    }

    @Override public void refreshToken(Context context, Callback callback) {
        if (!isConfigured() || !initialize(context)) {
            callback.onUnavailable();
            return;
        }
        try {
            FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(token -> {
                    persistToken(context, token);
                    callback.onToken(token);
                })
                .addOnFailureListener(error -> {
                    String cached = cachedToken(context);
                    if (cached.isEmpty()) callback.onUnavailable();
                    else callback.onToken(cached);
                });
        } catch (RuntimeException error) {
            String cached = cachedToken(context);
            if (cached.isEmpty()) callback.onUnavailable();
            else callback.onToken(cached);
        }
    }

    public static boolean initialize(Context context) {
        if (!isConfigured()) return false;
        try {
            if (!FirebaseApp.getApps(context).isEmpty()) return true;
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApiKey(BuildConfig.FCM_API_KEY)
                .setApplicationId(BuildConfig.FCM_APPLICATION_ID)
                .setProjectId(BuildConfig.FCM_PROJECT_ID)
                .setGcmSenderId(BuildConfig.FCM_SENDER_ID)
                .build();
            return FirebaseApp.initializeApp(context, options) != null;
        } catch (IllegalStateException error) {
            return !FirebaseApp.getApps(context).isEmpty();
        } catch (RuntimeException error) {
            return false;
        }
    }

    public static void persistToken(Context context, String token) {
        if (token == null || token.trim().isEmpty()) return;
        context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(TOKEN, token.trim()).apply();
    }

    public static String cachedToken(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(TOKEN, "");
    }
}