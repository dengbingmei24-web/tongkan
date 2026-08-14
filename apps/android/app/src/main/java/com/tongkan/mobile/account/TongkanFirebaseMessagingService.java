package com.tongkan.mobile.account;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.tongkan.mobile.BuildConfig;
import com.tongkan.mobile.MainActivity;
import com.tongkan.mobile.R;

public final class TongkanFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "tongkan_watch_invites";
    private static final int NOTIFICATION_ID = 4101;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override public void onNewToken(String token) {
        String previousToken = FcmPushTokenProvider.cachedToken(this);
        FcmPushTokenProvider.persistToken(this, token);
        registerRefreshedToken(previousToken, token);
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        String url = message.getData().get("url");
        if (!isValidRoomUrl(url) || isExpired(message.getData().get("expiresAt"))) return;
        String title = message.getData().containsKey("title") ? message.getData().get("title") : "好友邀请你一起看";
        String body = message.getData().containsKey("body") ? message.getData().get("body") : "点击进入同看房间";
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, url.hashCode(), intent, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(Notification.CATEGORY_SOCIAL)
            .setPriority(Notification.PRIORITY_HIGH);
        if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, builder.build());
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "一起看邀请", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("好友发起一起看邀请时通知");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private void registerRefreshedToken(String previousToken, String token) {
        if (token == null || token.trim().isEmpty() || BuildConfig.ACCOUNT_API_BASE_URL.isEmpty()) return;
        AccountModels.Session session = new SessionStore(this).load();
        if (session == null) return;
        AccountClient client = new AccountClient(BuildConfig.ACCOUNT_API_BASE_URL, BuildConfig.ACCOUNT_TEST_ACCESS_TOKEN);
        String normalizedToken = token.trim();
        String normalizedPrevious = previousToken == null ? "" : previousToken.trim();
        if (!normalizedPrevious.isEmpty() && !normalizedPrevious.equals(normalizedToken)) {
            client.unregisterDevice(session.token, normalizedPrevious, "fcm", new AccountClient.ResultCallback<Void>() {
                @Override public void onSuccess(Void ignored) {
                    registerCurrentToken(client, session, normalizedToken);
                }

                @Override public void onFailure(AccountClient.Failure failure) {
                    registerCurrentToken(client, session, normalizedToken);
                }
            });
            return;
        }
        registerCurrentToken(client, session, normalizedToken);
    }

    private void registerCurrentToken(AccountClient client, AccountModels.Session session, String token) {
        String deviceName = Build.MANUFACTURER + " " + Build.MODEL;
        client.registerDevice(session.token, token, "fcm", deviceName.trim(), BuildConfig.VERSION_NAME,
            new AccountClient.ResultCallback<AccountModels.DeviceRegistration>() {
                @Override public void onSuccess(AccountModels.DeviceRegistration ignored) {
                    client.close();
                }

                @Override public void onFailure(AccountClient.Failure failure) {
                    client.close();
                }
            });
    }

    private static boolean isValidRoomUrl(String value) {
        if (value == null || value.length() > 1024) return false;
        Uri uri = Uri.parse(value);
        return "https".equals(uri.getScheme())
            && "tongkan-personal.pages.dev".equals(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().matches("/room/[A-Za-z0-9_-]+")
            && uri.getFragment() != null
            && uri.getFragment().matches("join=[A-Za-z0-9_-]+");
    }

    private static boolean isExpired(String value) {
        if (value == null) return true;
        try {
            return Long.parseLong(value) <= System.currentTimeMillis();
        } catch (NumberFormatException error) {
            return true;
        }
    }
}
