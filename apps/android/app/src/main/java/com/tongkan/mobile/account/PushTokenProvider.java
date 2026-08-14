package com.tongkan.mobile.account;

import android.content.Context;

/** Supplies a vendor push token when a concrete Android push SDK is configured. */
public interface PushTokenProvider {
    interface Callback {
        void onToken(String token);
        void onUnavailable();
    }

    String providerId();
    void refreshToken(Context context, Callback callback);
}