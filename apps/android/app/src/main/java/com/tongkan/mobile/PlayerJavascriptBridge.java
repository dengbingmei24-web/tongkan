package com.tongkan.mobile;

import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

public final class PlayerJavascriptBridge {
    public interface Listener {
        void onPlayerReady();
        void onLocalCommand(String kind, double positionSeconds, double playbackRate);
        void onPlayerState(double positionSeconds, double durationSeconds, boolean paused, boolean ended, int readyState);
        void onBuffering(boolean buffering, double positionSeconds, boolean paused, int readyState);
    }

    private final Listener listener;

    public PlayerJavascriptBridge(Listener listener) {
        this.listener = listener;
    }

    @JavascriptInterface
    public void onPlayerReady() {
        listener.onPlayerReady();
    }

    @JavascriptInterface
    public void onLocalCommand(String json) {
        try {
            JSONObject value = new JSONObject(json);
            listener.onLocalCommand(
                value.getString("kind"),
                value.optDouble("positionSeconds", 0),
                value.optDouble("playbackRate", 1)
            );
        } catch (JSONException ignored) {
            // Ignore malformed data from the trusted player page.
        }
    }

    @JavascriptInterface
    public void onPlayerState(String json) {
        try {
            JSONObject value = new JSONObject(json);
            listener.onPlayerState(
                value.optDouble("positionSeconds", 0),
                value.optDouble("durationSeconds", 0),
                value.optBoolean("paused", true),
                value.optBoolean("ended", false),
                value.optInt("readyState", 0)
            );
        } catch (JSONException ignored) {
            // Ignore malformed data from the trusted player page.
        }
    }

    @JavascriptInterface
    public void onBuffering(String json) {
        try {
            JSONObject value = new JSONObject(json);
            listener.onBuffering(
                value.optBoolean("buffering", false),
                value.optDouble("positionSeconds", 0),
                value.optBoolean("paused", true),
                value.optInt("readyState", 0)
            );
        } catch (JSONException ignored) {
            // Ignore malformed data from the trusted player page.
        }
    }
}
