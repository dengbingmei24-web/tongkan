package com.tongkan.mobile;

import okhttp3.Request;
import okhttp3.WebSocket;
import okio.ByteString;
import org.json.JSONObject;
import org.junit.Test;

import java.lang.reflect.Field;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.UUID;

import javax.net.ssl.SSLHandshakeException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class RoomClientNetworkTest {
    @Test
    public void explainsCommonMobileNetworkFailures() {
        assertTrue(RoomClient.networkErrorMessage(new UnknownHostException()).startsWith("无法解析"));
        assertTrue(RoomClient.networkErrorMessage(new ConnectException()).startsWith("无法连接"));
        assertTrue(RoomClient.networkErrorMessage(new SocketTimeoutException()).startsWith("连接房间服务器超时"));
        assertTrue(RoomClient.networkErrorMessage(new SSLHandshakeException("certificate")).startsWith("安全连接失败"));
    }

    @Test
    public void keepsUnexpectedExceptionTypeForDiagnosis() {
        assertEquals("网络异常：IllegalStateException · boom", RoomClient.networkErrorMessage(new IllegalStateException("boom")));
    }

    @Test
    public void sendsChatJsonAndReturnsGeneratedMessageId() throws Exception {
        RecordingListener listener = new RecordingListener();
        RecordingWebSocket socket = new RecordingWebSocket();
        RoomClient client = connectedClient(listener, socket);
        try {
            String messageId = client.sendChat("  一起看吧 🎬  ");

            UUID.fromString(messageId);
            JSONObject sent = new JSONObject(socket.lastText);
            assertEquals("chat.message", sent.getString("type"));
            assertEquals(messageId, sent.getString("messageId"));
            assertEquals("一起看吧 🎬", sent.getString("text"));
            assertTrue(sent.getLong("clientSentAtMs") > 0);
        } finally {
            client.close();
        }
    }

    @Test
    public void rejectsEmptyAndOverlongChatWithoutBreakingUnicode() throws Exception {
        RecordingListener listener = new RecordingListener();
        RecordingWebSocket socket = new RecordingWebSocket();
        RoomClient client = connectedClient(listener, socket);
        try {
            assertNull(client.sendChat(" \n\t　"));
            assertEquals("消息不能为空", listener.lastError);

            String exactly120Emoji = "😀".repeat(120);
            String acceptedId = client.sendChat(exactly120Emoji);
            assertTrue(acceptedId != null && !acceptedId.isEmpty());
            assertEquals(exactly120Emoji, new JSONObject(socket.lastText).getString("text"));

            socket.lastText = null;
            assertNull(client.sendChat("😀".repeat(121)));
            assertEquals("消息不能超过 120 个字符", listener.lastError);
            assertNull(socket.lastText);
        } finally {
            client.close();
        }
    }

    @Test
    public void reportsWhenChatCannotBeSentBeforeAuthentication() {
        RecordingListener listener = new RecordingListener();
        RoomClient client = new RoomClient("room", "key", "nickname", listener);
        try {
            assertNull(client.sendChat("在吗"));
            assertEquals("房间尚未连接，暂时无法发送消息", listener.lastError);
        } finally {
            client.close();
        }
    }

    @Test
    public void authenticationEnablesChatEvenWhenOnlyOneMemberIsOnline() throws Exception {
        RecordingListener listener = new RecordingListener();
        RecordingWebSocket socket = new RecordingWebSocket();
        RoomClient client = new RoomClient("room", "key", "nickname", listener);
        setField(client, "socket", socket);
        try {
            client.handleMessage(new JSONObject()
                .put("type", "auth.ok")
                .put("member", new JSONObject().put("id", "member-1"))
                .put("snapshot", new JSONObject().put("serverNowMs", System.currentTimeMillis()))
                .toString());

            String messageId = client.sendChat("只有我也能发送");
            assertTrue(messageId != null && !messageId.isEmpty());
            assertEquals("chat.message", new JSONObject(socket.lastText).getString("type"));
        } finally {
            client.close();
        }
    }
    @Test
    public void dispatchesIncomingChatEvent() throws Exception {
        RecordingListener listener = new RecordingListener();
        RoomClient client = new RoomClient("room", "key", "nickname", listener);
        try {
            client.handleMessage(new JSONObject()
                .put("type", "chat.message")
                .put("messageId", "message-42")
                .put("memberId", "member-2")
                .put("nickname", "小明")
                .put("text", "看到这里了吗？")
                .put("serverSentAtMs", 1_700_000_000_500L)
                .toString());

            assertEquals("message-42", listener.messageId);
            assertEquals("member-2", listener.memberId);
            assertEquals("小明", listener.nickname);
            assertEquals("看到这里了吗？", listener.text);
            assertEquals(1_700_000_000_500L, listener.serverSentAtMs);
        } finally {
            client.close();
        }
    }

    private static RoomClient connectedClient(RecordingListener listener, WebSocket socket) throws Exception {
        RoomClient client = new RoomClient("room", "key", "nickname", listener);
        setField(client, "socket", socket);
        setField(client, "authenticated", true);
        return client;
    }

    private static void setField(RoomClient client, String name, Object value) throws Exception {
        Field field = RoomClient.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(client, value);
    }

    private static final class RecordingListener implements RoomClient.Listener {
        String lastError;
        String messageId;
        String memberId;
        String nickname;
        String text;
        long serverSentAtMs;

        @Override public void onConnectionState(String state) {}
        @Override public void onAuthenticated(String ownMemberId, JSONObject snapshot) {}
        @Override public void onSnapshot(JSONObject snapshot) {}
        @Override public void onAnchor(PlaybackAnchor anchor, String actorNickname) {}

        @Override
        public void onChatMessage(String messageId, String memberId, String nickname, String text, long serverSentAtMs) {
            this.messageId = messageId;
            this.memberId = memberId;
            this.nickname = nickname;
            this.text = text;
            this.serverSentAtMs = serverSentAtMs;
        }

        @Override public void onError(String message) { lastError = message; }
    }

    private static final class RecordingWebSocket implements WebSocket {
        String lastText;

        @Override public Request request() { return new Request.Builder().url("https://example.com").build(); }
        @Override public long queueSize() { return 0; }
        @Override public boolean send(String text) { lastText = text; return true; }
        @Override public boolean send(ByteString bytes) { return false; }
        @Override public boolean close(int code, String reason) { return true; }
        @Override public void cancel() {}
    }
}
