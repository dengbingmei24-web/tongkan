package com.tongkan.mobile;

import android.app.Application;

import com.tongkan.mobile.account.FcmPushTokenProvider;

public final class TongkanApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        FcmPushTokenProvider.initialize(this);
    }
}
