package com.tongkan.mobile.account;

import android.content.Context;

public final class NoopPushTokenProvider implements PushTokenProvider {
    @Override public String providerId() { return "none"; }
    @Override public void refreshToken(Context context, Callback callback) { callback.onUnavailable(); }
}