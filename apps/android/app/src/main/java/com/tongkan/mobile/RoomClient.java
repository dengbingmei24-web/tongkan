package com.tongkan.mobile;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class RoomClient {
    public interface Listener {
        void onConnectionState(String state);
        void onAuthenticated(String ownMemberId, JSONObject snapshot);
        void onSnapshot(JSONObject snapshot);
        void onAnchor(PlaybackAnchor anchor, String actorNickname);
        default void onChatMessage(String messageId, String memberId, String nickname, String text, long serverSentAtMs) {}
        default void onHistoryBound(long expiresAt) {}
        default void onHistoryDisabled(String code, String message) {}
        void onError(String message);
    }

    public static final class CreateRoomResult {
        public final String roomId;
        public final String hostKey;
        public final String inviteKey;

        public CreateRoomResult(String roomId, String hostKey, String inviteKey) {
            this.roomId = roomId;
            this.hostKey = hostKey;
            this.inviteKey = inviteKey;
        }
    }

    static final class PlaybackReportState {
        final long sequence;
        final double position;
        final boolean paused;
        final int readyState;
        final boolean buffering;
        final BilibiliMedia media;
        final boolean ended;
        final Double durationSeconds;

        PlaybackReportState(long sequence, double position, boolean paused, int readyState, boolean buffering, BilibiliMedia media, boolean ended, Double durationSeconds) {
            this.sequence = Math.max(0, sequence);
            this.position = Math.max(0, position);
            this.paused = paused;
            this.readyState = Math.max(0, Math.min(4, readyState));
            this.buffering = buffering;
            this.media = media;
            this.ended = ended;
            this.durationSeconds = durationSeconds == null || !Double.isFinite(durationSeconds) || durationSeconds <= 0 ? null : durationSeconds;
        }

        static boolean shouldSendImmediately(PlaybackReportState previous, PlaybackReportState next) {
            if (previous == null) return true;
            if (previous.sequence != next.sequence || previous.paused != next.paused || previous.readyState != next.readyState
                || previous.buffering != next.buffering || previous.ended != next.ended) return true;
            if (previous.media == null || next.media == null) return previous.media != next.media;
            if (!previous.media.sameIdentity(next.media)) return true;
            return (previous.durationSeconds == null) != (next.durationSeconds == null);
        }
    }

    private static final String HTTP_ORIGIN = "https://tongkan-personal.pages.dev";
    private static final String WS_ORIGIN = "wss://tongkan-personal.pages.dev";
    private static final int MAX_CHAT_CODE_POINTS = 120;
    static final long PLAYBACK_REPORT_INTERVAL_MS = 5_000L;

    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build();

    private final String roomId;
    private final String key;
    private final String nickname;
    private final Listener listener;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile WebSocket socket;
    private volatile boolean authenticated;
    private volatile boolean shouldReconnect;
    private volatile int reconnectAttempt;
    private volatile long serverOffsetMs;
    private volatile String lastNetworkError = "";
    private ScheduledFuture<?> reconnectFuture;
    private ScheduledFuture<?> pingFuture;
    private ScheduledFuture<?> playbackReportFuture;
    private volatile String historyGrant;
    private PlaybackReportState playbackReportState;
    private volatile boolean playbackReportsActive = true;

    public RoomClient(String roomId, String key, String nickname, Listener listener) {
        this.roomId = roomId;
        this.key = key;
        this.nickname = nickname;
        this.listener = listener;
    }

    public synchronized void connect() {
        shouldReconnect = true;
        if (socket != null || (reconnectFuture != null && !reconnectFuture.isDone())) return;
        openSocket();
    }

    public synchronized void close() {
        shouldReconnect = false;
        authenticated = false;
        cancelFuture(reconnectFuture);
        cancelFuture(pingFuture);
        cancelFuture(playbackReportFuture);
        playbackReportFuture = null;
        playbackReportState = null;
        historyGrant = null;
        WebSocket current = socket;
        socket = null;
        if (current != null) current.close(1000, "client closed");
        scheduler.shutdownNow();
    }

    public long serverNow() {
        return System.currentTimeMillis() + serverOffsetMs;
    }

    public void sendCommand(String kind, Double positionSeconds, Double playbackRate, BilibiliMedia media) {
        try {
            send(RoomProtocol.playbackCommand(
                UUID.randomUUID().toString(),
                kind, positionSeconds, playbackRate, media,
                System.currentTimeMillis()
            ));
        } catch (JSONException error) {
            listener.onError("无法生成同步指令");
        }
    }

    public void sendReport(
        long sequence,
        double position,
        boolean paused,
        int readyState,
        boolean buffering,
        BilibiliMedia media,
        boolean ended,
        Double durationSeconds
    ) {
        PlaybackReportState next = new PlaybackReportState(
            sequence, position, paused, readyState, buffering, media, ended, durationSeconds);
        boolean immediate;
        synchronized (this) {
            immediate = PlaybackReportState.shouldSendImmediately(playbackReportState, next);
            playbackReportState = next;
            if (playbackReportsActive && authenticated) startPlaybackReports();
        }
        if (immediate && playbackReportsActive && authenticated) sendPlaybackReport(next);
    }

    public void sendReport(long sequence, double position, boolean paused, int readyState, boolean buffering, BilibiliMedia media) {
        sendReport(sequence, position, paused, readyState, buffering, media, false, null);
    }

    public synchronized void bindHistory(String grant) {
        historyGrant = grant;
        if (authenticated) sendHistoryBind();
    }

    public synchronized void clearHistoryBinding() {
        boolean wasBound = historyGrant != null;
        historyGrant = null;
        if (wasBound && authenticated && playbackReportState != null) sendPlaybackReport(playbackReportState);
    }

    public synchronized void setPlaybackReportsActive(boolean active) {
        if (playbackReportsActive == active) return;
        playbackReportsActive = active;
        if (!active) {
            PlaybackReportState current = playbackReportState;
            if (authenticated && current != null) sendPlaybackReport(current);
            cancelFuture(playbackReportFuture);
            playbackReportFuture = null;
            return;
        }
        if (authenticated && playbackReportState != null) {
            sendPlaybackReport(playbackReportState);
            startPlaybackReports();
        }
    }

    public synchronized void clearPlaybackReport() {
        playbackReportState = null;
        cancelFuture(playbackReportFuture);
        playbackReportFuture = null;
    }

    private void sendPlaybackReport(PlaybackReportState state) {
        try {
            send(playbackReportMessage(state, historyGrant != null, System.currentTimeMillis()));
        } catch (JSONException error) {
            listener.onError("无法上报播放器状态");
        }
    }

    static JSONObject playbackReportMessage(PlaybackReportState state, boolean historyEnabled, long sentAtClientMs) throws JSONException {
        if (!historyEnabled) {
            return RoomProtocol.playbackReport(
                state.sequence, state.position, state.paused, state.readyState, state.buffering, state.media, sentAtClientMs);
        }
        return RoomProtocol.playbackReport(
            state.sequence, state.position, state.paused, state.readyState, state.buffering, state.media,
            state.ended, state.durationSeconds, sentAtClientMs);
    }

    private synchronized void startPlaybackReports() {
        if (!playbackReportsActive || !authenticated || playbackReportState == null || scheduler.isShutdown()) return;
        if (playbackReportFuture != null && !playbackReportFuture.isDone()) return;
        playbackReportFuture = scheduler.scheduleWithFixedDelay(() -> {
            PlaybackReportState current;
            synchronized (RoomClient.this) {
                if (!playbackReportsActive || !authenticated) return;
                current = playbackReportState;
            }
            if (current != null) sendPlaybackReport(current);
        }, PLAYBACK_REPORT_INTERVAL_MS, PLAYBACK_REPORT_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    private void sendHistoryBind() {
        String current = historyGrant;
        if (current == null) return;
        try {
            send(RoomProtocol.historyBind(current));
        } catch (JSONException error) {
            historyGrant = null;
            listener.onHistoryDisabled("INVALID_HISTORY_GRANT", "共同历史授权无效，房间仍可继续使用。");
        }
    }

    public String sendChat(String rawText) {
        String text = trimUnicode(rawText);
        if (text.isEmpty()) {
            listener.onError("消息不能为空");
            return null;
        }
        if (text.codePointCount(0, text.length()) > MAX_CHAT_CODE_POINTS) {
            listener.onError("消息不能超过 120 个字符");
            return null;
        }
        WebSocket current = socket;
        if (!authenticated || current == null) {
            listener.onError("房间尚未连接，暂时无法发送消息");
            return null;
        }
        String messageId = UUID.randomUUID().toString();
        try {
            if (!current.send(RoomProtocol.chatMessage(messageId, text).toString())) {
                listener.onError("消息发送失败，请稍后重试");
                return null;
            }
            return messageId;
        } catch (JSONException error) {
            listener.onError("无法生成消息");
            return null;
        }
    }

    private synchronized void openSocket() {
        if (!shouldReconnect || scheduler.isShutdown()) return;
        authenticated = false;
        listener.onConnectionState(reconnectAttempt == 0 ? "正在连接" : "正在重连");

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .pingInterval(15, TimeUnit.SECONDS)
                .build();

        Request request = new Request.Builder()
                .url(WS_ORIGIN + "/rooms/" + roomId)
                .addHeader("Origin", HTTP_ORIGIN)
                .addHeader("User-Agent", "Tongkan-Android/1.0.0-alpha.9.1")
                .build();

        final RoomClient self = this;
        socket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                if (self.socket != ws) return;
                try {
                    ws.send(RoomProtocol.authMessage(key, nickname).toString());
                } catch (JSONException error) {
                    listener.onError("无法发送房间身份");
                }
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                if (self.socket != ws) return;
                handleMessage(text);
            }

            @Override
            public void onClosing(WebSocket ws, int code, String reason) {
                ws.close(code, reason);
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                synchronized (self) {
                    if (self.socket != ws) return;
                    self.socket = null;
                    self.authenticated = false;
                    cancelFuture(pingFuture);
                    pingFuture = null;
                    cancelFuture(playbackReportFuture);
                    playbackReportFuture = null;
                    if (!shouldReconnect) {
                        listener.onConnectionState("已断开");
                        return;
                    }
                    if (code == 4001 || code == 4002) {
                        shouldReconnect = false;
                        listener.onConnectionState("连接失败");
                        listener.onError("房间链接无效或房间已满");
                        return;
                    }
                    scheduleReconnect();
                }
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                synchronized (self) {
                    if (self.socket != ws) return;
                    self.socket = null;
                    self.authenticated = false;
                    cancelFuture(playbackReportFuture);
                    playbackReportFuture = null;
                    lastNetworkError = networkErrorMessage(t);
                    listener.onConnectionState("连接中断，正在重连…");
                    scheduleReconnect();
                }
            }
        });
    }

    void handleMessage(String raw) {
        try {
            JSONObject event = new JSONObject(raw);
            String type = event.optString("type");
            long receivedAt = System.currentTimeMillis();
            if ("pong".equals(type)) {
                long sentAt = event.getLong("clientSentAtMs");
                long midpoint = sentAt + (receivedAt - sentAt) / 2;
                serverOffsetMs = event.getLong("serverSentAtMs") - midpoint;
                return;
            }
            if ("auth.ok".equals(type)) {
                JSONObject snapshot = event.getJSONObject("snapshot");
                updateServerOffset(snapshot, receivedAt);
                reconnectAttempt = 0;
                authenticated = true;
                listener.onConnectionState("已连接");
                startPing();
                sendHistoryBind();
                startPlaybackReports();
                listener.onAuthenticated(event.getJSONObject("member").getString("id"), snapshot);
                return;
            }
            if ("room.snapshot".equals(type)) {
                JSONObject snapshot = event.getJSONObject("snapshot");
                updateServerOffset(snapshot, receivedAt);
                listener.onSnapshot(snapshot);
                return;
            }
            if ("playback.anchor".equals(type)) {
                listener.onAnchor(PlaybackAnchor.fromJson(event.getJSONObject("anchor")), event.optString("actorNickname", "对方"));
                return;
            }
            if ("chat.message".equals(type)) {
                listener.onChatMessage(
                    event.getString("messageId"),
                    event.getString("memberId"),
                    event.optString("nickname", "对方"),
                    event.getString("text"),
                    event.optLong("serverSentAtMs", receivedAt)
                );
                return;
            }
            if ("history.bound".equals(type)) {
                long expiresAt = event.getLong("expiresAt");
                if (expiresAt <= 0) throw new JSONException("Invalid history bound response");
                listener.onHistoryBound(expiresAt);
                return;
            }
            if ("member.updated".equals(type)) {
                JSONObject member = event.getJSONObject("member");
                listener.onConnectionState(member.optBoolean("connected") ? "对方已加入" : "对方已离线");
                return;
            }
            if ("error".equals(type)) {
                String code = event.optString("code");
                String message = event.optString("message", "房间服务返回错误");
                if ("INVALID_HISTORY_GRANT".equals(code) || "HISTORY_GRANT_EXPIRED".equals(code) || "HISTORY_BIND_CONFLICT".equals(code)) {
                    clearHistoryBinding();
                    listener.onHistoryDisabled(code, message);
                    return;
                }
                listener.onError(message);
            }
        } catch (JSONException error) {
            listener.onError("收到无法识别的房间消息");
        }
    }

    private void updateServerOffset(JSONObject snapshot, long receivedAt) {
        if (snapshot.has("serverNowMs")) serverOffsetMs = snapshot.optLong("serverNowMs", receivedAt) - receivedAt;
    }

    private synchronized void startPing() {
        cancelFuture(pingFuture);
        pingFuture = scheduler.scheduleWithFixedDelay(() -> {
            try {
                send(RoomProtocol.pingMessage(System.currentTimeMillis()));
            } catch (JSONException ignored) {}
        }, 5, 5, TimeUnit.SECONDS);
    }

    private synchronized void scheduleReconnect() {
        if (!shouldReconnect || scheduler.isShutdown()) return;
        listener.onConnectionState("正在重连");
        long delay = RoomProtocol.reconnectDelayMs(reconnectAttempt);
        reconnectAttempt += 1;
        cancelFuture(reconnectFuture);
        reconnectFuture = scheduler.schedule(this::openSocket, delay, TimeUnit.MILLISECONDS);
    }

    private void send(JSONObject message) {
        WebSocket current = socket;
        if (current != null) current.send(message.toString());
    }

    private static void cancelFuture(ScheduledFuture<?> future) {
        if (future != null) future.cancel(false);
    }

    public static CreateRoomResult createRoom() throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(HTTP_ORIGIN + "/api/rooms").openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(0);
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String body = readFully(stream);
        connection.disconnect();
        if (status < 200 || status >= 300) throw new IOException("HTTP " + status + ": " + body);
        JSONObject json = new JSONObject(body);
        return new CreateRoomResult(json.getString("roomId"), json.getString("hostKey"), json.getString("inviteKey"));
    }

    private static String readFully(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private static String trimUnicode(String value) {
        if (value == null || value.isEmpty()) return "";
        int start = 0;
        int end = value.length();
        while (start < end) {
            int codePoint = value.codePointAt(start);
            if (!Character.isWhitespace(codePoint) && !Character.isSpaceChar(codePoint)) break;
            start += Character.charCount(codePoint);
        }
        while (end > start) {
            int codePoint = value.codePointBefore(end);
            if (!Character.isWhitespace(codePoint) && !Character.isSpaceChar(codePoint)) break;
            end -= Character.charCount(codePoint);
        }
        return value.substring(start, end);
    }

    static String networkErrorMessage(Throwable error) {
        String msg = error.getMessage() != null ? error.getMessage() : "";
        if (error instanceof java.net.UnknownHostException) return "无法解析域名";
        if (error instanceof java.net.ConnectException) return "无法连接到服务器";
        if (error instanceof java.net.SocketTimeoutException) return "连接房间服务器超时";
        if (error instanceof javax.net.ssl.SSLHandshakeException) return "安全连接失败：" + (msg.length() > 40 ? msg.substring(0, 40) : msg);
        return "网络异常：" + error.getClass().getSimpleName() + " · " + (msg.length() > 60 ? msg.substring(0, 60) : msg);
    }

}
