package com.tongkan.mobile.account;

import com.tongkan.mobile.BuildConfig;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public final class AccountClient {
    public interface ResultCallback<T> {
        void onSuccess(T result);
        void onFailure(Failure failure);
    }

    public static final class Failure extends Exception {
        public final String code;
        public final int status;
        public final boolean networkFailure;
        public final long currentRevision;

        Failure(String code, String message, int status, boolean networkFailure) {
            this(code, message, status, networkFailure, -1);
        }

        Failure(String code, String message, int status, boolean networkFailure, long currentRevision) {
            super(message);
            this.code = code;
            this.status = status;
            this.networkFailure = networkFailure;
            this.currentRevision = currentRevision;
        }

        public boolean isAuthenticationFailure() {
            return status == 401 || "AUTH_REQUIRED".equals(code) || "SESSION_INVALID".equals(code);
        }
    }

    private interface ResponseParser<T> {
        T parse(String body) throws Exception;
    }

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final Set<String> VERSIONED_ERROR_CODES = new HashSet<>(Arrays.asList(
        "UNAUTHORIZED", "AUTH_REQUIRED", "INVALID_REQUEST", "INVALID_JSON", "JSON_REQUIRED", "ARCHIVE_FORBIDDEN",
        "NOT_FOUND", "PAIR_REQUIRED", "LIBRARY_VERSION_CONFLICT", "CATEGORY_NAME_CONFLICT", "LIBRARY_LIMIT_REACHED",
        "LIBRARY_ITEM_NOT_FOUND", "PLAN_NOT_FOUND", "PLAN_ALREADY_EXISTS", "CALENDAR_VERSION_CONFLICT"
    ));
    private static final Set<String> REVISION_CONFLICT_CODES = new HashSet<>(Arrays.asList(
        "LIBRARY_VERSION_CONFLICT", "CALENDAR_VERSION_CONFLICT"
    ));
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build();
    private final Set<Call> calls = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final String baseUrl;
    private final String testAccessToken;

    public AccountClient(String configuredBaseUrl, String testAccessToken) {
        baseUrl = normalizeBaseUrl(configuredBaseUrl);
        this.testAccessToken = testAccessToken == null ? "" : testAccessToken.trim();
    }

    public boolean isConfigured() {
        return !baseUrl.isEmpty();
    }

    public void sendCode(String email, ResultCallback<AccountModels.SendCodeResult> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("email", email);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成验证码请求。", 0, false));
            return;
        }
        execute(post("/api/auth/send-code", body, null), value -> AccountModels.SendCodeResult.fromJson(new JSONObject(value)), callback);
    }

    public void verifyCode(String email, String code, String deviceName, ResultCallback<AccountModels.Session> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("email", email);
            body.put("code", code);
            body.put("deviceName", deviceName);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成登录请求。", 0, false));
            return;
        }
        execute(post("/api/auth/verify-code", body, null), value -> AccountModels.Session.fromJson(new JSONObject(value)), callback);
    }

    public void refresh(String token, ResultCallback<AccountModels.Session> callback) {
        if (!requireConfigured(callback)) return;
        execute(post("/api/auth/refresh", new JSONObject(), token), value -> AccountModels.Session.fromJson(new JSONObject(value)), callback);
    }

    public void me(String token, ResultCallback<AccountModels.User> callback) {
        if (!requireConfigured(callback)) return;
        Request request = requestBuilder("/api/me", token).get().build();
        execute(request, value -> AccountModels.User.fromJson(new JSONObject(value).getJSONObject("user")), callback);
    }

    public void updateProfile(String token, String nickname, ResultCallback<AccountModels.User> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("nickname", nickname);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成资料更新请求。", 0, false));
            return;
        }
        Request request = requestBuilder("/api/me", token)
            .patch(RequestBody.create(body.toString(), JSON))
            .build();
        execute(request, value -> AccountModels.User.fromJson(new JSONObject(value).getJSONObject("user")), callback);
    }

    public void logout(String token, ResultCallback<Void> callback) {
        if (!requireConfigured(callback)) return;
        execute(post("/api/auth/logout", new JSONObject(), token), value -> null, callback);
    }

    public void createPairInvite(String token, ResultCallback<AccountModels.PairInvite> callback) {
        if (!requireConfigured(callback)) return;
        execute(post("/api/pair/invites", new JSONObject(), token), value -> AccountModels.PairInvite.fromJson(new JSONObject(value)), callback);
    }

    public void acceptPairInvite(String token, String code, ResultCallback<AccountModels.Pair> callback) {
        if (!requireConfigured(callback)) return;
        String encodedCode = (code == null ? "" : code.trim()).replaceAll("[^A-Za-z0-9-]", "");
        execute(
            post("/api/pair/invites/" + encodedCode + "/accept", new JSONObject(), token),
            value -> AccountModels.Pair.fromJson(new JSONObject(value).getJSONObject("pair")),
            callback
        );
    }

    public void getPair(String token, ResultCallback<AccountModels.PairState> callback) {
        if (!requireConfigured(callback)) return;
        Request request = requestBuilder("/api/pair", token).get().build();
        execute(request, value -> AccountModels.PairState.fromJson(new JSONObject(value)), callback);
    }

    public void unbindPair(String token, String pairId, String retention, ResultCallback<AccountModels.PairMutationResult> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = retentionBody(pairId, retention, true, callback);
        if (body == null) return;
        execute(
            post("/api/pair/unbind", body, token),
            value -> AccountModels.PairMutationResult.fromJson(new JSONObject(value)),
            callback
        );
    }

    public void decidePairArchive(String token, String pairId, String retention, ResultCallback<AccountModels.PairMutationResult> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = retentionBody(pairId, retention, false, callback);
        if (body == null) return;
        execute(
            post("/api/pair/archives/" + pairId + "/retention", body, token),
            value -> AccountModels.PairMutationResult.fromJson(new JSONObject(value)),
            callback
        );
    }

    private JSONObject retentionBody(
        String pairId,
        String retention,
        boolean includePairId,
        ResultCallback<AccountModels.PairMutationResult> callback
    ) {
        String normalizedPairId = pairId == null ? "" : pairId.trim();
        if (!normalizedPairId.matches("[a-f0-9]{32}")) {
            callback.onFailure(new Failure("INVALID_REQUEST", "当前好友关系无效，请刷新后重试。", 0, false));
            return null;
        }
        if (!"keep".equals(retention) && !"delete".equals(retention)) {
            callback.onFailure(new Failure("PAIR_RETENTION_INVALID", "请选择保留或删除旧空间。", 0, false));
            return null;
        }
        JSONObject body = new JSONObject();
        try {
            if (includePairId) body.put("pairId", normalizedPairId);
            body.put("retention", retention);
            return body;
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成旧空间处理请求。", 0, false));
            return null;
        }
    }

    public void registerDevice(String sessionToken, String pushToken, String provider, String deviceName, String appVersion, ResultCallback<AccountModels.DeviceRegistration> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("provider", provider);
            body.put("token", pushToken);
            body.put("deviceName", deviceName);
            body.put("appVersion", appVersion);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成设备注册请求。", 0, false));
            return;
        }
        execute(post("/api/devices/register", body, sessionToken), value -> AccountModels.DeviceRegistration.fromJson(new JSONObject(value)), callback);
    }

    public void unregisterDevice(String accountToken, String pushToken, String provider, ResultCallback<Void> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("provider", provider);
            body.put("token", pushToken);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成设备注销请求。", 0, false));
            return;
        }
        execute(post("/api/devices/unregister", body, accountToken), value -> null, callback);
    }

    public void sendWatchInvite(String token, String url, String title, long expiresAt, ResultCallback<AccountModels.WatchInviteResult> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("url", url);
            body.put("title", title);
            body.put("expiresAt", expiresAt);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成邀请通知请求。", 0, false));
            return;
        }
        execute(post("/api/pair/watch-invites", body, token), value -> AccountModels.WatchInviteResult.fromJson(new JSONObject(value)), callback);
    }

    public void publishActiveRoom(String token, String url, long expiresAt, ResultCallback<Void> callback) {
        if (!requireConfigured(callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("url", url);
            body.put("expiresAt", expiresAt);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成好友房间发布请求。", 0, false));
            return;
        }
        execute(post("/api/pair/active-room", body, token), value -> null, callback);
    }

    public void getActiveRoom(String token, ResultCallback<AccountModels.ActiveRoom> callback) {
        if (!requireConfigured(callback)) return;
        Request request = requestBuilder("/api/pair/active-room", token).get().build();
        execute(request, value -> AccountModels.ActiveRoom.fromResponse(new JSONObject(value)), callback);
    }

    public void clearActiveRoom(String token, ResultCallback<Void> callback) {
        if (!requireConfigured(callback)) return;
        Request request = requestBuilder("/api/pair/active-room", token).delete().build();
        execute(request, value -> null, callback);
    }

    public void getCalendarMonth(String token, String month, ResultCallback<AccountModels.CalendarSnapshot> callback) {
        if (!requireConfigured(callback) || !requireCalendarMonth(month, callback)) return;
        execute(requestBuilder("/api/calendar?month=" + encode(month), token).get().build(), AccountClient::parseCalendarSnapshot, callback);
    }

    public void getCalendarDate(String token, String date, ResultCallback<AccountModels.CalendarSnapshot> callback) {
        if (!requireConfigured(callback) || !requireCalendarDate(date, callback)) return;
        execute(requestBuilder("/api/calendar?date=" + encode(date), token).get().build(), AccountClient::parseCalendarSnapshot, callback);
    }

    public void getTodayCalendar(String token, String date, ResultCallback<AccountModels.CalendarSnapshot> callback) {
        if (!requireConfigured(callback) || !requireCalendarDate(date, callback)) return;
        execute(requestBuilder("/api/calendar/today?date=" + encode(date), token).get().build(), AccountClient::parseCalendarSnapshot, callback);
    }

    public void getArchiveCalendar(String token, String pairId, String month, ResultCallback<AccountModels.CalendarSnapshot> callback) {
        if (!requireConfigured(callback)
            || !requireId(pairId, "旧空间无效。", callback)
            || !requireCalendarMonth(month, callback)) return;
        String path = "/api/pair/archives/" + pairId + "/calendar?month=" + encode(month);
        execute(requestBuilder(path, token).get().build(), AccountClient::parseCalendarSnapshot, callback);
    }

    public void createCalendarPlan(
        String token,
        String libraryItemId,
        String date,
        String startTime,
        String note,
        long expectedRevision,
        ResultCallback<AccountModels.CalendarSnapshot> callback
    ) {
        if (!requireConfigured(callback)) return;
        try {
            execute(post("/api/calendar/plans", createCalendarPlanBody(libraryItemId, date, startTime, note, expectedRevision), token),
                AccountClient::parseCalendarSnapshot, callback);
        } catch (IllegalArgumentException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", error.getMessage(), 0, false));
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成日历计划请求。", 0, false));
        }
    }

    public void updateCalendarPlanDetails(
        String token,
        String planId,
        String date,
        String startTime,
        String note,
        long expectedRevision,
        ResultCallback<AccountModels.CalendarSnapshot> callback
    ) {
        if (!requireConfigured(callback) || !requireId(planId, "日历计划无效。", callback)) return;
        try {
            execute(patch("/api/calendar/plans/" + planId,
                updateCalendarPlanDetailsBody(date, startTime, note, expectedRevision), token),
                AccountClient::parseCalendarSnapshot, callback);
        } catch (IllegalArgumentException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", error.getMessage(), 0, false));
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成日历计划更新请求。", 0, false));
        }
    }

    public void setCalendarPlanStatus(
        String token,
        String planId,
        String status,
        long expectedRevision,
        ResultCallback<AccountModels.CalendarSnapshot> callback
    ) {
        if (!requireConfigured(callback) || !requireId(planId, "日历计划无效。", callback)) return;
        try {
            execute(patch("/api/calendar/plans/" + planId, calendarPlanStatusBody(status, expectedRevision), token),
                AccountClient::parseCalendarSnapshot, callback);
        } catch (IllegalArgumentException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", error.getMessage(), 0, false));
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成日历计划状态请求。", 0, false));
        }
    }

    public void deleteCalendarPlan(
        String token,
        String planId,
        long expectedRevision,
        ResultCallback<AccountModels.CalendarSnapshot> callback
    ) {
        if (!requireConfigured(callback)
            || !requireId(planId, "日历计划无效。", callback)
            || !requireCalendarRevision(expectedRevision, callback)) return;
        Request request = requestBuilder("/api/calendar/plans/" + planId + "?expectedRevision=" + expectedRevision, token).delete().build();
        execute(request, AccountClient::parseCalendarSnapshot, callback);
    }
    public void getLibrary(
        String token,
        String query,
        String status,
        String categoryId,
        ResultCallback<AccountModels.LibrarySnapshot> callback
    ) {
        if (!requireConfigured(callback)) return;
        String normalizedStatus = status == null || status.isEmpty() ? "all" : status;
        if (!"all".equals(normalizedStatus) && !"unwatched".equals(normalizedStatus) && !"watched".equals(normalizedStatus)) {
            callback.onFailure(new Failure("INVALID_REQUEST", "片库筛选状态无效。", 0, false));
            return;
        }
        if (categoryId != null && !categoryId.matches("[a-f0-9]{32}")) {
            callback.onFailure(new Failure("INVALID_REQUEST", "片库分类无效。", 0, false));
            return;
        }
        StringBuilder path = new StringBuilder("/api/library?status=").append(encode(normalizedStatus));
        if (query != null && !query.trim().isEmpty()) path.append("&query=").append(encode(query.trim()));
        if (categoryId != null) path.append("&categoryId=").append(categoryId);
        execute(requestBuilder(path.toString(), token).get().build(), AccountClient::parseLibrarySnapshot, callback);
    }

    public void getArchiveLibrary(String token, String pairId, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(pairId, "旧空间无效。", callback)) return;
        execute(requestBuilder("/api/pair/archives/" + pairId + "/library", token).get().build(), AccountClient::parseLibrarySnapshot, callback);
    }

    public void addLibraryItems(
        String token,
        List<String> inputs,
        String categoryId,
        long expectedRevision,
        ResultCallback<AccountModels.BatchAddResult> callback
    ) {
        if (!requireConfigured(callback)) return;
        if (inputs == null || inputs.isEmpty() || inputs.size() > 20 || expectedRevision < 0) {
            callback.onFailure(new Failure("INVALID_REQUEST", "一次请输入 1–20 条 B站链接。", 0, false));
            return;
        }
        if (categoryId != null && !categoryId.matches("[a-f0-9]{32}")) {
            callback.onFailure(new Failure("INVALID_REQUEST", "片库分类无效。", 0, false));
            return;
        }
        JSONObject body = new JSONObject();
        try {
            JSONArray values = new JSONArray();
            for (String input : inputs) {
                String normalized = input == null ? "" : input.trim();
                if (normalized.isEmpty() || normalized.length() > 2000) {
                    callback.onFailure(new Failure("INVALID_REQUEST", "链接不能为空且不能超过 2000 字符。", 0, false));
                    return;
                }
                values.put(normalized);
            }
            body.put("inputs", values);
            body.put("categoryId", categoryId == null ? JSONObject.NULL : categoryId);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成批量添加请求。", 0, false));
            return;
        }
        execute(post("/api/library/items/batch", body, token), value -> AccountModels.BatchAddResult.fromJson(new JSONObject(value)), callback);
    }

    public void createLibraryCategory(String token, String name, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        mutateWithName(token, "/api/library/categories", "POST", name, expectedRevision, callback);
    }

    public void renameLibraryCategory(String token, String categoryId, String name, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(categoryId, "片库分类无效。", callback)) return;
        mutateWithName(token, "/api/library/categories/" + categoryId, "PATCH", name, expectedRevision, callback);
    }

    public void deleteLibraryCategory(String token, String categoryId, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(categoryId, "片库分类无效。", callback) || !requireRevision(expectedRevision, callback)) return;
        Request request = requestBuilder("/api/library/categories/" + categoryId + "?expectedRevision=" + expectedRevision, token).delete().build();
        execute(request, AccountClient::parseLibrarySnapshot, callback);
    }

    public void reorderLibraryCategories(String token, List<String> orderedIds, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        reorder(token, "/api/library/categories/reorder", "orderedCategoryIds", orderedIds, expectedRevision, callback);
    }

    public void updateLibraryItem(
        String token,
        String itemId,
        String categoryId,
        String watchStatus,
        boolean refreshMetadata,
        long expectedRevision,
        ResultCallback<AccountModels.LibrarySnapshot> callback
    ) {
        if (!requireConfigured(callback) || !requireId(itemId, "片库条目无效。", callback) || !requireRevision(expectedRevision, callback)) return;
        if (categoryId != null && !categoryId.matches("[a-f0-9]{32}")) {
            callback.onFailure(new Failure("INVALID_REQUEST", "片库分类无效。", 0, false));
            return;
        }
        if (watchStatus != null && !"unwatched".equals(watchStatus) && !"watched".equals(watchStatus)) {
            callback.onFailure(new Failure("INVALID_REQUEST", "观看状态无效。", 0, false));
            return;
        }
        JSONObject body = new JSONObject();
        try {
            if (categoryId != null) body.put("categoryId", categoryId);
            if (watchStatus != null) body.put("watchStatus", watchStatus);
            if (refreshMetadata) body.put("refreshMetadata", true);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成片库更新请求。", 0, false));
            return;
        }
        execute(patch("/api/library/items/" + itemId, body, token), AccountClient::parseLibrarySnapshot, callback);
    }

    public void renameLibraryItem(String token, String itemId, String title, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(itemId, "片库条目无效。", callback) || !requireRevision(expectedRevision, callback)) return;
        String normalizedTitle = title == null ? "" : title.trim();
        if (normalizedTitle.isEmpty() || normalizedTitle.codePointCount(0, normalizedTitle.length()) > 160) {
            callback.onFailure(new Failure("INVALID_REQUEST", "视频名称需为 1 到 160 个字符。", 0, false));
            return;
        }
        JSONObject body = new JSONObject();
        try {
            body.put("title", normalizedTitle);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成视频重命名请求。", 0, false));
            return;
        }
        execute(patch("/api/library/items/" + itemId, body, token), AccountClient::parseLibrarySnapshot, callback);
    }

    public void clearLibraryItemCategory(String token, String itemId, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(itemId, "片库条目无效。", callback) || !requireRevision(expectedRevision, callback)) return;
        JSONObject body = new JSONObject();
        try {
            body.put("categoryId", JSONObject.NULL);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成片库更新请求。", 0, false));
            return;
        }
        execute(patch("/api/library/items/" + itemId, body, token), AccountClient::parseLibrarySnapshot, callback);
    }

    public void deleteLibraryItem(String token, String itemId, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        if (!requireConfigured(callback) || !requireId(itemId, "片库条目无效。", callback) || !requireRevision(expectedRevision, callback)) return;
        Request request = requestBuilder("/api/library/items/" + itemId + "?expectedRevision=" + expectedRevision, token).delete().build();
        execute(request, AccountClient::parseLibrarySnapshot, callback);
    }

    public void reorderLibraryItems(String token, List<String> orderedIds, long expectedRevision, ResultCallback<AccountModels.LibrarySnapshot> callback) {
        reorder(token, "/api/library/items/reorder", "orderedItemIds", orderedIds, expectedRevision, callback);
    }

    public void close() {
        for (Call call : calls) call.cancel();
        calls.clear();
    }

    private <T> boolean requireConfigured(ResultCallback<T> callback) {
        if (isConfigured()) return true;
        callback.onFailure(new Failure("SERVICE_NOT_CONFIGURED", "账号服务尚未配置，请先使用匿名房间。", 0, false));
        return false;
    }

    private Request post(String path, JSONObject body, String token) {
        return requestBuilder(path, token).post(RequestBody.create(body.toString(), JSON)).build();
    }

    private Request patch(String path, JSONObject body, String token) {
        return requestBuilder(path, token).patch(RequestBody.create(body.toString(), JSON)).build();
    }

    private Request.Builder requestBuilder(String path, String token) {
        Request.Builder builder = new Request.Builder()
            .url(baseUrl + path)
            .header("Accept", "application/json")
            .header("User-Agent", "Tongkan-Android/" + BuildConfig.VERSION_NAME);
        if (token != null && !token.isEmpty()) builder.header("Authorization", "Bearer " + token);
        if (!testAccessToken.isEmpty()) builder.header("X-Tongkan-Test-Key", testAccessToken);
        return builder;
    }

    private <T> void execute(Request request, ResponseParser<T> parser, ResultCallback<T> callback) {
        Call call = httpClient.newCall(request);
        calls.add(call);
        call.enqueue(new Callback() {
            @Override
            public void onFailure(Call failedCall, IOException error) {
                calls.remove(failedCall);
                if (failedCall.isCanceled()) return;
                callback.onFailure(new Failure("NETWORK_ERROR", networkMessage(error), 0, true));
            }

            @Override
            public void onResponse(Call completedCall, Response response) {
                calls.remove(completedCall);
                try (response) {
                    String responseBody = response.body() == null ? "" : response.body().string();
                    if (!response.isSuccessful()) {
                        callback.onFailure(parseFailure(response.code(), responseBody));
                        return;
                    }
                    callback.onSuccess(parser.parse(responseBody));
                } catch (Exception error) {
                    callback.onFailure(new Failure("INVALID_RESPONSE", "账号服务返回了无法识别的数据。", 0, false));
                }
            }
        });
    }

    static String normalizeBaseUrl(String value) {
        String trimmed = value == null ? "" : value.trim();
        while (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        if (trimmed.isEmpty()) return "";
        try {
            URI uri = URI.create(trimmed);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) return "";
            String path = uri.getPath() == null ? "" : uri.getPath();
            while (path.endsWith("/") && path.length() > 1) path = path.substring(0, path.length() - 1);
            if (path.contains("..") || path.contains("//")) return "";
            return "https://" + uri.getAuthority() + ("/".equals(path) ? "" : path);
        } catch (IllegalArgumentException error) {
            return "";
        }
    }

    static Failure parseFailure(int status, String body) {
        try {
            JSONObject json = new JSONObject(body);
            if (!(json.opt("error") instanceof String) || !(json.opt("message") instanceof String)) {
                return new Failure("INVALID_RESPONSE", "账号服务返回了无法识别的错误。", status, false);
            }
            String code = json.getString("error");
            String message = json.getString("message").trim();
            if (code.isEmpty() || message.isEmpty()) return new Failure("INVALID_RESPONSE", "账号服务返回了无法识别的错误。", status, false);
            long revision = -1;
            if (REVISION_CONFLICT_CODES.contains(code)) {
                if (!json.has("currentRevision") || json.getLong("currentRevision") < 0) {
                    String label = "CALENDAR_VERSION_CONFLICT".equals(code) ? "日历" : "片库";
                    return new Failure("INVALID_RESPONSE", label + "版本冲突响应无效，请刷新重试。", status, false);
                }
                revision = json.getLong("currentRevision");
            } else if (VERSIONED_ERROR_CODES.contains(code) && json.has("currentRevision")) {
                return new Failure("INVALID_RESPONSE", "账号服务返回了无法识别的错误。", status, false);
            }
            return new Failure(code, message, status, false, revision);
        } catch (JSONException error) {
            return new Failure("HTTP_" + status, "账号服务请求失败（" + status + "）。", status, false);
        }
    }

    static AccountModels.LibrarySnapshot parseLibrarySnapshot(String body) throws Exception {
        return AccountModels.LibrarySnapshot.fromJson(new JSONObject(body));
    }

    static AccountModels.CalendarSnapshot parseCalendarSnapshot(String body) throws Exception {
        return AccountModels.CalendarSnapshot.fromJson(new JSONObject(body));
    }

    static JSONObject createCalendarPlanBody(
        String libraryItemId,
        String date,
        String startTime,
        String note,
        long expectedRevision
    ) throws JSONException {
        if (libraryItemId == null || !libraryItemId.matches("[a-f0-9]{32}")) {
            throw new IllegalArgumentException("请选择共同片库中的视频。");
        }
        JSONObject body = calendarDetailsBody(date, startTime, note, expectedRevision);
        body.put("libraryItemId", libraryItemId);
        return body;
    }

    static JSONObject updateCalendarPlanDetailsBody(
        String date,
        String startTime,
        String note,
        long expectedRevision
    ) throws JSONException {
        return calendarDetailsBody(date, startTime, note, expectedRevision);
    }

    static JSONObject calendarPlanStatusBody(String status, long expectedRevision) throws JSONException {
        requireCalendarRevisionValue(expectedRevision);
        if (!"planned".equals(status) && !"completed".equals(status)) {
            throw new IllegalArgumentException("日历计划状态无效。");
        }
        return new JSONObject().put("status", status).put("expectedRevision", expectedRevision);
    }

    private static JSONObject calendarDetailsBody(
        String date,
        String startTime,
        String note,
        long expectedRevision
    ) throws JSONException {
        requireCalendarRevisionValue(expectedRevision);
        String normalizedDate = date == null ? "" : date.trim();
        if (!AccountModels.isCalendarDate(normalizedDate)) {
            throw new IllegalArgumentException("日期需要使用有效的 YYYY-MM-DD 格式。");
        }
        String normalizedTime = normalizeOptionalStartTime(startTime);
        String normalizedNote = normalizeOptionalNote(note);
        return new JSONObject()
            .put("date", normalizedDate)
            .put("startTime", normalizedTime == null ? JSONObject.NULL : normalizedTime)
            .put("note", normalizedNote == null ? JSONObject.NULL : normalizedNote)
            .put("expectedRevision", expectedRevision);
    }

    static String normalizeOptionalStartTime(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) return null;
        if (!AccountModels.isStartTime(normalized)) {
            throw new IllegalArgumentException("开始时间需要使用 24 小时 HH:mm 格式。");
        }
        return normalized;
    }

    static String normalizeOptionalNote(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.codePointCount(0, normalized.length()) > 200) {
            throw new IllegalArgumentException("备注最多 200 个字符。");
        }
        return normalized;
    }

    private static void requireCalendarRevisionValue(long revision) {
        if (revision < 0) throw new IllegalArgumentException("日历版本无效，请刷新后重试。");
    }

    private static <T> boolean requireCalendarMonth(String month, ResultCallback<T> callback) {
        if (AccountModels.isCalendarMonth(month)) return true;
        callback.onFailure(new Failure("INVALID_REQUEST", "月份需要使用有效的 YYYY-MM 格式。", 0, false));
        return false;
    }

    private static <T> boolean requireCalendarDate(String date, ResultCallback<T> callback) {
        if (AccountModels.isCalendarDate(date)) return true;
        callback.onFailure(new Failure("INVALID_REQUEST", "日期需要使用有效的 YYYY-MM-DD 格式。", 0, false));
        return false;
    }

    private static <T> boolean requireCalendarRevision(long revision, ResultCallback<T> callback) {
        if (revision >= 0) return true;
        callback.onFailure(new Failure("INVALID_REQUEST", "日历版本无效，请刷新后重试。", 0, false));
        return false;
    }
    private void mutateWithName(
        String token,
        String path,
        String method,
        String name,
        long expectedRevision,
        ResultCallback<AccountModels.LibrarySnapshot> callback
    ) {
        if (!requireConfigured(callback) || !requireRevision(expectedRevision, callback)) return;
        String normalized = name == null ? "" : name.trim();
        if (normalized.isEmpty() || normalized.codePointCount(0, normalized.length()) > 24) {
            callback.onFailure(new Failure("INVALID_REQUEST", "分类名称需要为 1–24 个字符。", 0, false));
            return;
        }
        JSONObject body = new JSONObject();
        try {
            body.put("name", normalized);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成分类请求。", 0, false));
            return;
        }
        Request request = "PATCH".equals(method) ? patch(path, body, token) : post(path, body, token);
        execute(request, AccountClient::parseLibrarySnapshot, callback);
    }

    private void reorder(
        String token,
        String path,
        String field,
        List<String> orderedIds,
        long expectedRevision,
        ResultCallback<AccountModels.LibrarySnapshot> callback
    ) {
        if (!requireConfigured(callback) || !requireRevision(expectedRevision, callback)) return;
        if (orderedIds == null || new HashSet<>(orderedIds).size() != orderedIds.size()) {
            callback.onFailure(new Failure("INVALID_REQUEST", "排序列表无效。", 0, false));
            return;
        }
        JSONArray values = new JSONArray();
        for (String id : orderedIds) {
            if (id == null || !id.matches("[a-f0-9]{32}")) {
                callback.onFailure(new Failure("INVALID_REQUEST", "排序列表包含无效条目。", 0, false));
                return;
            }
            values.put(id);
        }
        JSONObject body = new JSONObject();
        try {
            body.put(field, values);
            body.put("expectedRevision", expectedRevision);
        } catch (JSONException error) {
            callback.onFailure(new Failure("INVALID_REQUEST", "无法生成排序请求。", 0, false));
            return;
        }
        execute(post(path, body, token), AccountClient::parseLibrarySnapshot, callback);
    }

    private static <T> boolean requireId(String id, String message, ResultCallback<T> callback) {
        if (id != null && id.matches("[a-f0-9]{32}")) return true;
        callback.onFailure(new Failure("INVALID_REQUEST", message, 0, false));
        return false;
    }

    private static <T> boolean requireRevision(long revision, ResultCallback<T> callback) {
        if (revision >= 0) return true;
        callback.onFailure(new Failure("INVALID_REQUEST", "片库版本无效，请刷新后重试。", 0, false));
        return false;
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException error) {
            throw new IllegalStateException("UTF-8 is unavailable", error);
        }
    }

    private static String networkMessage(IOException error) {
        String name = error.getClass().getSimpleName();
        if (name.contains("UnknownHost")) return "无法解析账号服务器，请检查网络。";
        if (name.contains("SocketTimeout")) return "连接账号服务器超时，请稍后重试。";
        if (name.contains("SSL")) return "账号服务器安全连接失败。";
        return "无法连接账号服务器，请检查网络后重试。";
    }
}
