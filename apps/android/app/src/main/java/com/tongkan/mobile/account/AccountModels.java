package com.tongkan.mobile.account;

import org.json.JSONException;
import org.json.JSONObject;

public final class AccountModels {
    private AccountModels() {}

    public static final class User {
        public final String id;
        public final String email;
        public final String nickname;
        public final String avatarId;

        public User(String id, String email, String nickname, String avatarId) {
            this.id = id;
            this.email = email;
            this.nickname = nickname;
            this.avatarId = avatarId;
        }

        public static User fromJson(JSONObject json) throws JSONException {
            return new User(
                json.getString("id"),
                json.getString("email"),
                json.getString("nickname"),
                json.getString("avatarId")
            );
        }
    }

    public static final class Session {
        public final String token;
        public final long expiresAt;
        public final User user;

        public Session(String token, long expiresAt, User user) {
            this.token = token;
            this.expiresAt = expiresAt;
            this.user = user;
        }

        public static Session fromJson(JSONObject json) throws JSONException {
            String token = json.getString("token");
            long expiresAt = json.getLong("expiresAt");
            if (!token.matches("[a-f0-9]{64}") || expiresAt <= 0) throw new JSONException("Invalid session response");
            return new Session(token, expiresAt, User.fromJson(json.getJSONObject("user")));
        }
    }

    public static final class SendCodeResult {
        public final int retryAfterSeconds;
        public final int expiresInSeconds;
        public final String debugCode;

        public SendCodeResult(int retryAfterSeconds, int expiresInSeconds, String debugCode) {
            this.retryAfterSeconds = retryAfterSeconds;
            this.expiresInSeconds = expiresInSeconds;
            this.debugCode = debugCode;
        }

        public static SendCodeResult fromJson(JSONObject json) {
            return new SendCodeResult(
                json.optInt("retryAfterSeconds", 60),
                json.optInt("expiresInSeconds", 300),
                json.optString("debugCode", "")
            );
        }
    }

    public static final class PairInvite {
        public final String code;
        public final long expiresAt;

        public PairInvite(String code, long expiresAt) {
            this.code = code;
            this.expiresAt = expiresAt;
        }

        public static PairInvite fromJson(JSONObject json) throws JSONException {
            String code = json.getString("code");
            long expiresAt = json.getLong("expiresAt");
            if (!code.matches("[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}") || expiresAt <= 0) {
                throw new JSONException("Invalid pair invite response");
            }
            return new PairInvite(code, expiresAt);
        }
    }

    public static final class DeviceRegistration {
        public final String deviceId;
        public final String provider;
        public final long lastSeenAt;

        public DeviceRegistration(String deviceId, String provider, long lastSeenAt) {
            this.deviceId = deviceId;
            this.provider = provider;
            this.lastSeenAt = lastSeenAt;
        }

        public static DeviceRegistration fromJson(JSONObject json) throws JSONException {
            String deviceId = json.getString("deviceId");
            String provider = json.getString("provider");
            long lastSeenAt = json.getLong("lastSeenAt");
            if (deviceId.length() != 32 || provider.isEmpty() || lastSeenAt <= 0) throw new JSONException("Invalid device registration response");
            return new DeviceRegistration(deviceId, provider, lastSeenAt);
        }
    }

    public static final class WatchInviteResult {
        public final int attempted;
        public final int delivered;
        public final boolean fallbackRequired;

        public WatchInviteResult(int attempted, int delivered, boolean fallbackRequired) {
            this.attempted = attempted;
            this.delivered = delivered;
            this.fallbackRequired = fallbackRequired;
        }

        public static WatchInviteResult fromJson(JSONObject json) {
            return new WatchInviteResult(json.optInt("attempted"), json.optInt("delivered"), json.optBoolean("fallbackRequired", true));
        }
    }
    public static final class Pair {
        public final String pairId;
        public final long boundAt;
        public final User partner;

        public Pair(String pairId, long boundAt, User partner) {
            this.pairId = pairId;
            this.boundAt = boundAt;
            this.partner = partner;
        }

        public static Pair fromJson(JSONObject json) throws JSONException {
            String pairId = json.getString("pairId");
            long boundAt = json.getLong("boundAt");
            if (!pairId.matches("[a-f0-9]{32}") || boundAt <= 0) throw new JSONException("Invalid pair response");
            return new Pair(pairId, boundAt, User.fromJson(json.getJSONObject("partner")));
        }
    }
}
