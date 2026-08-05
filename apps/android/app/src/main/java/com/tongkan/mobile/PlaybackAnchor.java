package com.tongkan.mobile;

import org.json.JSONException;
import org.json.JSONObject;

public final class PlaybackAnchor {
    public final BilibiliMedia media;
    public final boolean paused;
    public final double positionSeconds;
    public final double playbackRate;
    public final long anchoredAtServerMs;
    public final long sequence;
    public final String actorId;

    public PlaybackAnchor(
        BilibiliMedia media,
        boolean paused,
        double positionSeconds,
        double playbackRate,
        long anchoredAtServerMs,
        long sequence,
        String actorId
    ) {
        this.media = media;
        this.paused = paused;
        this.positionSeconds = Math.max(0, positionSeconds);
        this.playbackRate = playbackRate;
        this.anchoredAtServerMs = anchoredAtServerMs;
        this.sequence = sequence;
        this.actorId = actorId;
    }

    public static PlaybackAnchor fromJson(JSONObject json) throws JSONException {
        JSONObject mediaJson = json.optJSONObject("media");
        BilibiliMedia media = mediaJson == null ? null : BilibiliMedia.fromJson(mediaJson);
        return new PlaybackAnchor(
            media,
            json.getBoolean("paused"),
            json.getDouble("positionSeconds"),
            json.optDouble("playbackRate", 1),
            json.getLong("anchoredAtServerMs"),
            json.getLong("sequence"),
            json.isNull("actorId") ? null : json.optString("actorId", null)
        );
    }

    public double positionAt(long serverNowMs) {
        if (paused) return Math.max(0, positionSeconds);
        double elapsedSeconds = Math.max(0, serverNowMs - anchoredAtServerMs) / 1000.0;
        return Math.max(0, positionSeconds + elapsedSeconds * playbackRate);
    }

    public JSONObject toJson() throws JSONException {
        return new JSONObject()
            .put("media", media == null ? JSONObject.NULL : media.toJson())
            .put("paused", paused)
            .put("positionSeconds", positionSeconds)
            .put("playbackRate", playbackRate)
            .put("anchoredAtServerMs", anchoredAtServerMs)
            .put("sequence", sequence)
            .put("actorId", actorId == null ? JSONObject.NULL : actorId);
    }
}
