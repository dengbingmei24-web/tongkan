package com.tongkan.mobile;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
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

    private static final String HTTP_ORIGIN = "https://tongkan-personal.pages.dev";
    private static final String WS_ORIGIN = "wss://tongkan-personal.pages.dev";
    private final String roomId;
    private final String key;
    private final String nickname;
    private final Listener listener;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile WebSocketClient socket;
    private volatile boolean shouldReconnect;
    private volatile int reconnectAttempt;
    private volatile long serverOffsetMs;
    private ScheduledFuture<?> reconnectFuture;
    private ScheduledFuture<?> pingFuture;

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
        cancelFuture(reconnectFuture);
        cancelFuture(pingFuture);
        WebSocketClient current = socket;
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
                kind,
                positionSeconds,
                playbackRate,
                media,
                System.currentTimeMillis()
            ));
        } catch (JSONException error) {
            listener.onError("无法生成同步指令");
        }
    }

    public void sendReport(long sequence, double position, boolean paused, int readyState, boolean buffering, BilibiliMedia media) {
        try {
            send(RoomProtocol.playbackReport(
                sequence,
                position,
                paused,
                readyState,
                buffering,
                media,
                System.currentTimeMillis()
            ));
        } catch (JSONException error) {
            listener.onError("无法上报播放器状态");
        }
    }

    private synchronized void openSocket() {
        if (!shouldReconnect || scheduler.isShutdown()) return;
        listener.onConnectionState(reconnectAttempt == 0 ? "正在连接" : "正在重连");
        final WebSocketClient next = new WebSocketClient(URI.create(WS_ORIGIN + "/rooms/" + roomId)) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                if (socket != this) return;
                try {
                    send(RoomProtocol.authMessage(key, nickname).toString());
                } catch (JSONException error) {
                    listener.onError("无法发送房间身份");
                }
            }

            @Override
            public void onMessage(String raw) {
                if (socket != this) return;
                handleMessage(raw);
            }

            @Override
            public void onClose(int code, String reason, boolean remote) {
                synchronized (RoomClient.this) {
                    if (socket != this) return;
                    socket = null;
                    cancelFuture(pingFuture);
                    pingFuture = null;
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
            public void onError(Exception error) {
                if (socket == this) listener.onConnectionState("网络异常");
            }
        };
        next.setConnectionLostTimeout(12);
        socket = next;
        next.connect();
    }

    private void handleMessage(String raw) {
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
                listener.onConnectionState("已连接");
                startPing();
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
            if ("member.updated".equals(type)) {
                JSONObject member = event.getJSONObject("member");
                listener.onConnectionState(member.optBoolean("connected") ? "对方已加入" : "对方已离线");
                return;
            }
            if ("error".equals(type)) listener.onError(event.optString("message", "房间服务返回错误"));
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
            } catch (JSONException ignored) {
                // Static JSON keys cannot fail.
            }
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
        WebSocketClient current = socket;
        if (current != null && current.isOpen()) current.send(message.toString());
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
        connection.setDoOutput(false);
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String body = readFully(stream);
        connection.disconnect();
        if (status < 200 || status >= 300) throw new IOException("创建房间失败：HTTP " + status);
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
}
