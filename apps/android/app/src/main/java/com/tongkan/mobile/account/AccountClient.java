package com.tongkan.mobile.account;

import com.tongkan.mobile.BuildConfig;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.URI;
import java.util.Collections;
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

        Failure(String code, String message, int status, boolean networkFailure) {
            super(message);
            this.code = code;
            this.status = status;
            this.networkFailure = networkFailure;
        }

        public boolean isAuthenticationFailure() {
            return status == 401 || "AUTH_REQUIRED".equals(code) || "SESSION_INVALID".equals(code);
        }
    }

    private interface ResponseParser<T> {
        T parse(String body) throws Exception;
    }

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
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

    public void getPair(String token, ResultCallback<AccountModels.Pair> callback) {
        if (!requireConfigured(callback)) return;
        Request request = requestBuilder("/api/pair", token).get().build();
        execute(request, value -> {
            JSONObject pair = new JSONObject(value).optJSONObject("pair");
            return pair == null ? null : AccountModels.Pair.fromJson(pair);
        }, callback);
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

    private static Failure parseFailure(int status, String body) {
        try {
            JSONObject json = new JSONObject(body);
            String code = json.optString("error", "HTTP_" + status);
            String message = json.optString("message", "账号服务请求失败，请稍后重试。");
            return new Failure(code, message, status, false);
        } catch (JSONException error) {
            return new Failure("HTTP_" + status, "账号服务请求失败（" + status + "）。", status, false);
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
