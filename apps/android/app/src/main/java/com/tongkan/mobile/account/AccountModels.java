package com.tongkan.mobile.account;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    public static final class PairArchive {
        public final String pairId;
        public final long boundAt;
        public final long unboundAt;
        public final String retention;
        public final User partner;

        public PairArchive(String pairId, long boundAt, long unboundAt, String retention, User partner) {
            this.pairId = pairId;
            this.boundAt = boundAt;
            this.unboundAt = unboundAt;
            this.retention = retention;
            this.partner = partner;
        }

        public static PairArchive fromJson(JSONObject json) throws JSONException {
            String pairId = json.getString("pairId");
            long boundAt = json.getLong("boundAt");
            long unboundAt = json.getLong("unboundAt");
            String retention = json.getString("retention");
            if (!pairId.matches("[a-f0-9]{32}") || boundAt <= 0 || unboundAt <= 0 || unboundAt < boundAt) {
                throw new JSONException("Invalid pair archive response");
            }
            if (!"pending".equals(retention) && !"keep".equals(retention)) {
                throw new JSONException("Invalid pair archive retention");
            }
            return new PairArchive(pairId, boundAt, unboundAt, retention, User.fromJson(json.getJSONObject("partner")));
        }
    }

    public static final class PairState {
        private static final Comparator<PairArchive> ARCHIVE_ORDER = (left, right) -> {
            int unboundOrder = Long.compare(right.unboundAt, left.unboundAt);
            return unboundOrder != 0 ? unboundOrder : left.pairId.compareTo(right.pairId);
        };

        public final Pair pair;
        public final List<PairArchive> pendingArchives;
        public final List<PairArchive> archives;

        public PairState(Pair pair, List<PairArchive> pendingArchives, List<PairArchive> archives) {
            this.pair = pair;
            List<PairArchive> pendingCopy = new ArrayList<>(pendingArchives);
            List<PairArchive> archiveCopy = new ArrayList<>(archives);
            pendingCopy.sort(ARCHIVE_ORDER);
            archiveCopy.sort(ARCHIVE_ORDER);
            this.pendingArchives = Collections.unmodifiableList(pendingCopy);
            this.archives = Collections.unmodifiableList(archiveCopy);
        }

        public static PairState empty() {
            return new PairState(null, Collections.emptyList(), Collections.emptyList());
        }

        public static PairState fromJson(JSONObject json) throws JSONException {
            if (!json.has("pair")) throw new JSONException("Missing pair state");
            Object pairValue = json.get("pair");
            Pair pair;
            if (pairValue == JSONObject.NULL) {
                pair = null;
            } else if (pairValue instanceof JSONObject) {
                pair = Pair.fromJson((JSONObject) pairValue);
            } else {
                throw new JSONException("Invalid active pair response");
            }

            List<PairArchive> pendingArchives = parseArchives(json, "pendingArchives", "pending");
            List<PairArchive> archives = parseArchives(json, "archives", "keep");
            Set<String> visiblePairIds = new HashSet<>();
            for (PairArchive archive : pendingArchives) {
                if (!visiblePairIds.add(archive.pairId)) throw new JSONException("Duplicate pair archive response");
            }
            for (PairArchive archive : archives) {
                if (!visiblePairIds.add(archive.pairId)) throw new JSONException("Duplicate pair archive response");
            }
            return new PairState(pair, pendingArchives, archives);
        }

        private static List<PairArchive> parseArchives(JSONObject json, String name, String expectedRetention) throws JSONException {
            if (!json.has(name)) return new ArrayList<>();
            Object value = json.get(name);
            if (!(value instanceof JSONArray)) throw new JSONException("Invalid pair archive list");
            JSONArray array = (JSONArray) value;
            List<PairArchive> result = new ArrayList<>(array.length());
            for (int index = 0; index < array.length(); index += 1) {
                PairArchive archive = PairArchive.fromJson(array.getJSONObject(index));
                if (!expectedRetention.equals(archive.retention)) throw new JSONException("Unexpected pair archive retention");
                result.add(archive);
            }
            return result;
        }
    }

    public static final class PairMutationResult {
        public final PairArchive archive;
        public final boolean pairDeleted;

        public PairMutationResult(PairArchive archive, boolean pairDeleted) {
            this.archive = archive;
            this.pairDeleted = pairDeleted;
        }

        public static PairMutationResult fromJson(JSONObject json) throws JSONException {
            if (!json.has("archive") || !(json.opt("pairDeleted") instanceof Boolean)) {
                throw new JSONException("Invalid pair mutation response");
            }
            Object archiveValue = json.get("archive");
            PairArchive archive;
            if (archiveValue == JSONObject.NULL) {
                archive = null;
            } else if (archiveValue instanceof JSONObject) {
                archive = PairArchive.fromJson((JSONObject) archiveValue);
                if (!"keep".equals(archive.retention)) throw new JSONException("Invalid visible pair archive");
            } else {
                throw new JSONException("Invalid pair mutation archive");
            }
            boolean pairDeleted = json.getBoolean("pairDeleted");
            if (pairDeleted && archive != null) throw new JSONException("Deleted pair cannot expose archive");
            return new PairMutationResult(archive, pairDeleted);
        }
    }
}
