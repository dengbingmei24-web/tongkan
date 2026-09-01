package com.tongkan.mobile;

import org.json.JSONException;
import org.json.JSONObject;

final class RoomProtocol {
    private static final long[] RECONNECT_DELAYS_MS = {2000, 5000, 10000, 20000, 30000, 30000};

    private RoomProtocol() {}

    static JSONObject authMessage(String key, String nickname) throws JSONException {
        JSONObject capabilities = new JSONObject()
            .put("platform", "android")
            .put("canControlBilibili", true)
            .put("canShareScreen", false)
            .put("canShareSystemAudio", false)
            .put("canUseMicrophone", false);
        return new JSONObject()
            .put("type", "auth")
            .put("key", key)
            .put("nickname", nickname)
            .put("capabilities", capabilities);
    }

    static JSONObject playbackCommand(
        String commandId,
        String kind,
        Double positionSeconds,
        Double playbackRate,
        BilibiliMedia media,
        long clientSentAtMs
    ) throws JSONException {
        JSONObject message = new JSONObject()
            .put("type", "playback.command")
            .put("commandId", commandId)
            .put("kind", kind)
            .put("clientSentAtMs", clientSentAtMs);
        if (positionSeconds != null) message.put("positionSeconds", Math.max(0, positionSeconds));
        if (playbackRate != null) message.put("playbackRate", playbackRate);
        if (media != null) message.put("media", media.toJson());
        return message;
    }

    static JSONObject playbackReport(
        long sequenceApplied,
        double positionSeconds,
        boolean paused,
        int readyState,
        boolean buffering,
        BilibiliMedia media,
        long sentAtClientMs
    ) throws JSONException {
        JSONObject report = new JSONObject()
            .put("sequenceApplied", Math.max(0, sequenceApplied))
            .put("positionSeconds", Math.max(0, positionSeconds))
            .put("paused", paused)
            .put("readyState", Math.max(0, Math.min(4, readyState)))
            .put("buffering", buffering)
            .put("media", media == null ? JSONObject.NULL : media.toJson())
            .put("sentAtClientMs", sentAtClientMs);
        return new JSONObject().put("type", "playback.report").put("report", report);
    }

    static JSONObject playbackReport(
        long sequenceApplied,
        double positionSeconds,
        boolean paused,
        int readyState,
        boolean buffering,
        BilibiliMedia media,
        boolean ended,
        Double durationSeconds,
        long sentAtClientMs
    ) throws JSONException {
        JSONObject report = new JSONObject()
            .put("sequenceApplied", Math.max(0, sequenceApplied))
            .put("positionSeconds", Math.max(0, positionSeconds))
            .put("paused", paused)
            .put("readyState", Math.max(0, Math.min(4, readyState)))
            .put("buffering", buffering)
            .put("media", media == null ? JSONObject.NULL : media.toJson())
            .put("ended", ended)
            .put("durationSeconds", durationSeconds == null || !Double.isFinite(durationSeconds) || durationSeconds <= 0
                ? JSONObject.NULL
                : durationSeconds)
            .put("sentAtClientMs", sentAtClientMs);
        return new JSONObject().put("type", "playback.report").put("report", report);
    }

    static JSONObject historyBind(String grant) throws JSONException {
        if (grant == null || grant.length() < 20 || grant.length() > 4096) throw new JSONException("Invalid history grant");
        return new JSONObject().put("type", "history.bind").put("grant", grant);
    }

    static JSONObject chatMessage(String messageId, String text) throws JSONException {
        return new JSONObject()
            .put("type", "chat.message")
            .put("messageId", messageId)
            .put("text", text)
            .put("clientSentAtMs", System.currentTimeMillis());
    }

    static JSONObject pingMessage(long clientSentAtMs) throws JSONException {
        return new JSONObject().put("type", "ping").put("clientSentAtMs", clientSentAtMs);
    }

    static long reconnectDelayMs(int attempt) {
        int index = Math.min(Math.max(0, attempt), RECONNECT_DELAYS_MS.length - 1);
        return RECONNECT_DELAYS_MS[index];
    }
}
