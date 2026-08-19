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

    public static final class ActiveRoom {
        public final String roomId;
        public final String url;
        public final long expiresAt;
        public final long createdAt;
        public final User host;

        public ActiveRoom(String roomId, String url, long expiresAt, long createdAt, User host) {
            this.roomId = roomId;
            this.url = url;
            this.expiresAt = expiresAt;
            this.createdAt = createdAt;
            this.host = host;
        }

        public static ActiveRoom fromJson(JSONObject json) throws JSONException {
            String roomId = requiredId(json, "roomId");
            String url = requiredHttpsUrl(json, "url");
            long expiresAt = positiveLong(json, "expiresAt");
            long createdAt = positiveLong(json, "createdAt");
            if (expiresAt <= createdAt || !url.matches("https://tongkan-personal\\.pages\\.dev/room/" + roomId + "#join=[a-f0-9]{32}")) {
                throw new JSONException("Invalid active room response");
            }
            return new ActiveRoom(roomId, url, expiresAt, createdAt, User.fromJson(json.getJSONObject("host")));
        }

        public static ActiveRoom fromResponse(JSONObject json) throws JSONException {
            if (!json.has("room")) throw new JSONException("Missing active room response");
            Object value = json.get("room");
            if (value == JSONObject.NULL) return null;
            if (!(value instanceof JSONObject)) throw new JSONException("Invalid active room response");
            return fromJson((JSONObject) value);
        }
    }

    public static final class PublicActor {
        public final String id;
        public final String nickname;

        public PublicActor(String id, String nickname) {
            this.id = id;
            this.nickname = nickname;
        }

        public static PublicActor fromJson(JSONObject json) throws JSONException {
            String id = requiredText(json, "id", 128);
            String nickname = requiredText(json, "nickname", 24);
            return new PublicActor(id, nickname);
        }
    }

    public static final class LibraryCategory {
        public final String id;
        public final String name;
        public final int position;
        public final long createdAt;
        public final long updatedAt;

        public LibraryCategory(String id, String name, int position, long createdAt, long updatedAt) {
            this.id = id;
            this.name = name;
            this.position = position;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }

        public static LibraryCategory fromJson(JSONObject json) throws JSONException {
            String id = requiredId(json, "id");
            String name = requiredText(json, "name", 24);
            int position = nonNegativeInt(json, "position");
            long createdAt = positiveLong(json, "createdAt");
            long updatedAt = positiveLong(json, "updatedAt");
            if (updatedAt < createdAt) throw new JSONException("Invalid library category timestamps");
            return new LibraryCategory(id, name, position, createdAt, updatedAt);
        }
    }

    public static final class LibraryItem {
        public final String id;
        public final String bvid;
        public final int page;
        public final Long cid;
        public final String canonicalUrl;
        public final String title;
        public final String coverUrl;
        public final String ownerName;
        public final Integer durationSeconds;
        public final String metadataStatus;
        public final String categoryId;
        public final String watchStatus;
        public final int position;
        public final PublicActor addedBy;
        public final PublicActor updatedBy;
        public final long createdAt;
        public final long updatedAt;

        public LibraryItem(
            String id,
            String bvid,
            int page,
            Long cid,
            String canonicalUrl,
            String title,
            String coverUrl,
            String ownerName,
            Integer durationSeconds,
            String metadataStatus,
            String categoryId,
            String watchStatus,
            int position,
            PublicActor addedBy,
            PublicActor updatedBy,
            long createdAt,
            long updatedAt
        ) {
            this.id = id;
            this.bvid = bvid;
            this.page = page;
            this.cid = cid;
            this.canonicalUrl = canonicalUrl;
            this.title = title;
            this.coverUrl = coverUrl;
            this.ownerName = ownerName;
            this.durationSeconds = durationSeconds;
            this.metadataStatus = metadataStatus;
            this.categoryId = categoryId;
            this.watchStatus = watchStatus;
            this.position = position;
            this.addedBy = addedBy;
            this.updatedBy = updatedBy;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }

        public static LibraryItem fromJson(JSONObject json) throws JSONException {
            String id = requiredId(json, "id");
            String bvid = requiredText(json, "bvid", 32);
            if (!bvid.matches("(?:BV[0-9A-Za-z]{10}|av[1-9][0-9]*)")) throw new JSONException("Invalid library media identity");
            int page = positiveInt(json, "page");
            Long cid = nullablePositiveLong(json, "cid");
            String canonicalUrl = requiredHttpsUrl(json, "canonicalUrl");
            String title = requiredText(json, "title", 300);
            String coverUrl = nullableHttpsUrl(json, "coverUrl");
            String ownerName = nullableText(json, "ownerName", 100);
            Integer durationSeconds = nullableNonNegativeInt(json, "durationSeconds");
            String metadataStatus = requiredEnum(json, "metadataStatus", "ready", "partial");
            String categoryId = nullableId(json, "categoryId");
            String watchStatus = requiredEnum(json, "watchStatus", "unwatched", "watched");
            int position = nonNegativeInt(json, "position");
            PublicActor addedBy = PublicActor.fromJson(json.getJSONObject("addedBy"));
            PublicActor updatedBy = PublicActor.fromJson(json.getJSONObject("updatedBy"));
            long createdAt = positiveLong(json, "createdAt");
            long updatedAt = positiveLong(json, "updatedAt");
            if (updatedAt < createdAt) throw new JSONException("Invalid library item timestamps");
            return new LibraryItem(id, bvid, page, cid, canonicalUrl, title, coverUrl, ownerName,
                durationSeconds, metadataStatus, categoryId, watchStatus, position, addedBy, updatedBy, createdAt, updatedAt);
        }
    }

    public static final class LibrarySnapshot {
        public final String pairId;
        public final long revision;
        public final boolean readOnly;
        public final List<LibraryCategory> categories;
        public final List<LibraryItem> items;

        public LibrarySnapshot(String pairId, long revision, boolean readOnly, List<LibraryCategory> categories, List<LibraryItem> items) {
            this.pairId = pairId;
            this.revision = revision;
            this.readOnly = readOnly;
            this.categories = Collections.unmodifiableList(new ArrayList<>(categories));
            this.items = Collections.unmodifiableList(new ArrayList<>(items));
        }

        public static LibrarySnapshot fromJson(JSONObject json) throws JSONException {
            String pairId = requiredId(json, "pairId");
            long revision = nonNegativeLong(json, "revision");
            if (!(json.opt("readOnly") instanceof Boolean)) throw new JSONException("Invalid library read-only state");
            JSONArray categoryJson = json.getJSONArray("categories");
            JSONArray itemJson = json.getJSONArray("items");
            List<LibraryCategory> categories = new ArrayList<>(categoryJson.length());
            List<LibraryItem> items = new ArrayList<>(itemJson.length());
            Set<String> categoryIds = new HashSet<>();
            Set<String> itemIds = new HashSet<>();
            Set<Integer> categoryPositions = new HashSet<>();
            Set<Integer> itemPositions = new HashSet<>();
            for (int index = 0; index < categoryJson.length(); index += 1) {
                LibraryCategory category = LibraryCategory.fromJson(categoryJson.getJSONObject(index));
                if (!categoryIds.add(category.id) || !categoryPositions.add(category.position)) {
                    throw new JSONException("Duplicate library category response");
                }
                categories.add(category);
            }
            for (int index = 0; index < itemJson.length(); index += 1) {
                LibraryItem item = LibraryItem.fromJson(itemJson.getJSONObject(index));
                if (!itemIds.add(item.id) || !itemPositions.add(item.position)) {
                    throw new JSONException("Duplicate library item response");
                }
                if (item.categoryId != null && !categoryIds.contains(item.categoryId)) {
                    throw new JSONException("Unknown library item category");
                }
                items.add(item);
            }
            categories.sort(Comparator.comparingInt(value -> value.position));
            items.sort(Comparator.comparingInt(value -> value.position));
            return new LibrarySnapshot(pairId, revision, json.getBoolean("readOnly"), categories, items);
        }
    }

    public static final class BatchItemResult {
        public final String input;
        public final String status;
        public final LibraryItem item;
        public final String error;

        public BatchItemResult(String input, String status, LibraryItem item, String error) {
            this.input = input;
            this.status = status;
            this.item = item;
            this.error = error;
        }

        public static BatchItemResult fromJson(JSONObject json) throws JSONException {
            String input = requiredText(json, "input", 2000);
            String status = requiredEnum(json, "status", "added", "duplicate", "rejected");
            LibraryItem item = null;
            if (json.has("item") && json.get("item") != JSONObject.NULL) item = LibraryItem.fromJson(json.getJSONObject("item"));
            String error = nullableEnum(json, "error", "INVALID_BILIBILI_URL", "B23_RESOLUTION_FAILED", "CATEGORY_NOT_FOUND", "LIBRARY_LIMIT_REACHED");
            if ("rejected".equals(status) && error == null) throw new JSONException("Rejected batch result requires an error");
            if (!"rejected".equals(status) && error != null) throw new JSONException("Successful batch result cannot contain an error");
            if ("added".equals(status) && item == null) throw new JSONException("Added batch result requires an item");
            return new BatchItemResult(input, status, item, error);
        }
    }

    public static final class BatchAddResult {
        public final List<BatchItemResult> results;
        public final LibrarySnapshot library;

        public BatchAddResult(List<BatchItemResult> results, LibrarySnapshot library) {
            this.results = Collections.unmodifiableList(new ArrayList<>(results));
            this.library = library;
        }

        public static BatchAddResult fromJson(JSONObject json) throws JSONException {
            JSONArray resultJson = json.getJSONArray("results");
            List<BatchItemResult> results = new ArrayList<>(resultJson.length());
            for (int index = 0; index < resultJson.length(); index += 1) {
                results.add(BatchItemResult.fromJson(resultJson.getJSONObject(index)));
            }
            return new BatchAddResult(results, LibrarySnapshot.fromJson(json.getJSONObject("library")));
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

    private static String requiredId(JSONObject json, String name) throws JSONException {
        String value = requiredText(json, name, 32);
        if (!value.matches("[a-f0-9]{32}")) throw new JSONException("Invalid " + name);
        return value;
    }

    private static String nullableId(JSONObject json, String name) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return requiredId(json, name);
    }

    private static String requiredText(JSONObject json, String name, int maxLength) throws JSONException {
        if (!(json.opt(name) instanceof String)) throw new JSONException("Invalid " + name);
        String value = json.getString(name).trim();
        if (value.isEmpty() || value.codePointCount(0, value.length()) > maxLength) throw new JSONException("Invalid " + name);
        return value;
    }

    private static String nullableText(JSONObject json, String name, int maxLength) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return requiredText(json, name, maxLength);
    }

    private static String requiredEnum(JSONObject json, String name, String... allowed) throws JSONException {
        String value = requiredText(json, name, 64);
        for (String option : allowed) if (option.equals(value)) return value;
        throw new JSONException("Invalid " + name);
    }

    private static String nullableEnum(JSONObject json, String name, String... allowed) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return requiredEnum(json, name, allowed);
    }

    private static int positiveInt(JSONObject json, String name) throws JSONException {
        int value = json.getInt(name);
        if (value <= 0) throw new JSONException("Invalid " + name);
        return value;
    }

    private static int nonNegativeInt(JSONObject json, String name) throws JSONException {
        int value = json.getInt(name);
        if (value < 0) throw new JSONException("Invalid " + name);
        return value;
    }

    private static long positiveLong(JSONObject json, String name) throws JSONException {
        long value = json.getLong(name);
        if (value <= 0) throw new JSONException("Invalid " + name);
        return value;
    }

    private static long nonNegativeLong(JSONObject json, String name) throws JSONException {
        long value = json.getLong(name);
        if (value < 0) throw new JSONException("Invalid " + name);
        return value;
    }

    private static Long nullablePositiveLong(JSONObject json, String name) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return positiveLong(json, name);
    }

    private static Integer nullableNonNegativeInt(JSONObject json, String name) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return nonNegativeInt(json, name);
    }

    private static String requiredHttpsUrl(JSONObject json, String name) throws JSONException {
        String value = requiredText(json, name, 2048);
        if (!value.matches("https://[^\\s]+")) throw new JSONException("Invalid " + name);
        return value;
    }

    private static String nullableHttpsUrl(JSONObject json, String name) throws JSONException {
        if (!json.has(name) || json.get(name) == JSONObject.NULL) return null;
        return requiredHttpsUrl(json, name);
    }
}
