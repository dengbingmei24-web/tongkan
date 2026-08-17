package com.tongkan.mobile.ui;

import android.app.Activity;
import android.content.Context;
import android.media.AudioManager;
import android.provider.Settings;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;

public final class ImmersiveMediaGestureController {
    public enum ControlType { BRIGHTNESS, VOLUME }
    public enum DirectionDecision { PENDING, HORIZONTAL, VERTICAL }

    public interface Callback {
        void onTap();
        void onAdjustment(ControlType type, int percent, boolean finished);
    }

    private final Activity activity;
    private final AudioManager audioManager;
    private final Callback callback;
    private final int touchSlop;
    private float downX;
    private float downY;
    private float initialProgress;
    private ControlType controlType;
    private boolean adjusting;
    private boolean cancelled;
    private float originalWindowBrightness = Float.NaN;

    public ImmersiveMediaGestureController(Activity activity, Callback callback) {
        this.activity = activity;
        this.callback = callback;
        audioManager = (AudioManager) activity.getSystemService(Context.AUDIO_SERVICE);
        touchSlop = ViewConfiguration.get(activity).getScaledTouchSlop();
    }

    public void beginSession() {
        if (Float.isNaN(originalWindowBrightness)) {
            originalWindowBrightness = activity.getWindow().getAttributes().screenBrightness;
        }
    }

    public void restoreBrightness() {
        if (Float.isNaN(originalWindowBrightness)) return;
        WindowManager.LayoutParams attributes = activity.getWindow().getAttributes();
        attributes.screenBrightness = originalWindowBrightness;
        activity.getWindow().setAttributes(attributes);
        originalWindowBrightness = Float.NaN;
    }

    public boolean onTouch(View view, MotionEvent event) {
        int width = view.getWidth();
        int height = view.getHeight();
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                beginSession();
                downX = event.getX();
                downY = event.getY();
                controlType = isGestureRegion(downX, downY, width, height) ? controlTypeFor(downX, width) : null;
                initialProgress = controlType == ControlType.BRIGHTNESS ? currentBrightnessProgress() : currentVolumeProgress();
                adjusting = false;
                cancelled = false;
                return true;
            case MotionEvent.ACTION_MOVE:
                if (!adjusting && !cancelled && controlType != null) {
                    DirectionDecision decision = classifyDirection(event.getX() - downX, event.getY() - downY, touchSlop);
                    if (decision == DirectionDecision.HORIZONTAL) cancelled = true;
                    if (decision == DirectionDecision.VERTICAL) adjusting = true;
                }
                if (adjusting) applyAndNotify(event.getY() - downY, height, false);
                return true;
            case MotionEvent.ACTION_UP:
                if (adjusting) applyAndNotify(event.getY() - downY, height, true);
                else if (!cancelled) callback.onTap();
                reset();
                return true;
            case MotionEvent.ACTION_CANCEL:
                if (adjusting && controlType != null) {
                    int percent = clampPercentage(Math.round((controlType == ControlType.BRIGHTNESS
                        ? currentBrightnessProgress() : currentVolumeProgress()) * 100f));
                    callback.onAdjustment(controlType, percent, true);
                }
                reset();
                return true;
            default:
                return true;
        }
    }

    private void applyAndNotify(float deltaY, int height, boolean finished) {
        float progress = adjustedProgress(initialProgress, deltaY, height);
        if (controlType == ControlType.BRIGHTNESS) {
            WindowManager.LayoutParams attributes = activity.getWindow().getAttributes();
            attributes.screenBrightness = Math.max(0.01f, progress);
            activity.getWindow().setAttributes(attributes);
        } else if (audioManager != null) {
            int max = Math.max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(max * progress), 0);
        }
        callback.onAdjustment(controlType, clampPercentage(Math.round(progress * 100f)), finished);
    }

    private float currentBrightnessProgress() {
        float value = activity.getWindow().getAttributes().screenBrightness;
        if (value < 0f) {
            try {
                value = Settings.System.getInt(activity.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f;
            } catch (Settings.SettingNotFoundException ignored) {
                value = 0.5f;
            }
        }
        return clampUnit(value);
    }

    private float currentVolumeProgress() {
        if (audioManager == null) return 0f;
        int max = Math.max(1, audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        return clampUnit(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC) / (float) max);
    }

    private void reset() {
        controlType = null;
        adjusting = false;
        cancelled = false;
    }

    static boolean isGestureRegion(float x, float y, int width, int height) {
        return width > 0 && height > 0 && x >= 0f && x < width && y >= 0f && y < height * 0.75f;
    }

    static ControlType controlTypeFor(float x, int width) {
        return x < width / 2f ? ControlType.BRIGHTNESS : ControlType.VOLUME;
    }

    static DirectionDecision classifyDirection(float deltaX, float deltaY, float threshold) {
        float horizontal = Math.abs(deltaX);
        float vertical = Math.abs(deltaY);
        if (Math.max(horizontal, vertical) <= threshold || horizontal == vertical) return DirectionDecision.PENDING;
        return horizontal > vertical ? DirectionDecision.HORIZONTAL : DirectionDecision.VERTICAL;
    }

    static float adjustedProgress(float initial, float deltaY, int height) {
        if (height <= 0) return clampUnit(initial);
        return clampUnit(initial - deltaY / height);
    }

    static float clampUnit(float value) {
        if (!Float.isFinite(value)) return 0f;
        return Math.max(0f, Math.min(1f, value));
    }

    static int clampPercentage(int value) {
        return Math.max(0, Math.min(100, value));
    }
}