package com.tongkan.mobile.ui;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class RoomChatOverlay {
    public interface VisibilityListener { void onVisibilityChanged(boolean visible); }

    private final Activity activity;
    private final FrameLayout parent;
    private final FrameLayout overlayRoot;
    private final RoomChatView chatView;
    private final TextView incomingBubble;
    private final Runnable hideBubble;
    private VisibilityListener visibilityListener;

    public RoomChatOverlay(Activity activity, FrameLayout parent) {
        this.activity = activity;
        this.parent = parent;
        overlayRoot = new FrameLayout(activity);
        overlayRoot.setVisibility(View.GONE);
        View scrim = new View(activity);
        scrim.setBackgroundColor(0x22000000);
        scrim.setOnClickListener(view -> hide());
        overlayRoot.addView(scrim, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        chatView = new RoomChatView(activity, true);
        FrameLayout.LayoutParams chatParams = new FrameLayout.LayoutParams(dp(340), dp(220), Gravity.END | Gravity.CENTER_VERTICAL);
        chatParams.setMargins(dp(16), dp(16), dp(16), dp(16));
        overlayRoot.addView(chatView, chatParams);
        parent.addView(overlayRoot, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        incomingBubble = new TextView(activity);
        incomingBubble.setTextColor(Color.WHITE);
        incomingBubble.setTextSize(13);
        incomingBubble.setMaxLines(2);
        incomingBubble.setPadding(dp(12), dp(9), dp(12), dp(9));
        incomingBubble.setBackground(rounded(0xE61A1D23, 0xFF4B515C, 12));
        incomingBubble.setVisibility(View.GONE);
        incomingBubble.setOnClickListener(view -> show());
        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(dp(280), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END);
        bubbleParams.setMargins(dp(16), dp(24), dp(18), 0);
        parent.addView(incomingBubble, bubbleParams);
        hideBubble = () -> incomingBubble.animate().alpha(0f).setDuration(180)
            .withEndAction(() -> incomingBubble.setVisibility(View.GONE)).start();
    }

    public RoomChatView getChatView() { return chatView; }
    public void setVisibilityListener(VisibilityListener listener) { visibilityListener = listener; }
    public boolean isShowing() { return overlayRoot.getVisibility() == View.VISIBLE; }

    public void show() {
        parent.removeCallbacks(hideBubble);
        incomingBubble.setVisibility(View.GONE);
        parent.post(() -> {
            FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) chatView.getLayoutParams();
            int width = parent.getWidth() > 0 ? parent.getWidth() : activity.getResources().getDisplayMetrics().widthPixels;
            int height = parent.getHeight() > 0 ? parent.getHeight() : activity.getResources().getDisplayMetrics().heightPixels;
            params.width = Math.min(dp(340), Math.round(width * 0.38f));
            params.height = Math.min(dp(220), Math.round(height * 0.5f));
            chatView.setLayoutParams(params);
            overlayRoot.setVisibility(View.VISIBLE);
            chatView.focusComposer();
            if (visibilityListener != null) visibilityListener.onVisibilityChanged(true);
        });
    }

    public void hide() {
        if (!isShowing()) return;
        overlayRoot.setVisibility(View.GONE);
        chatView.clearFocus();
        InputMethodManager keyboard = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null) keyboard.hideSoftInputFromWindow(chatView.getWindowToken(), 0);
        if (visibilityListener != null) visibilityListener.onVisibilityChanged(false);
    }

    public void showIncomingBubble(String nickname, String text) {
        if (isShowing()) return;
        parent.removeCallbacks(hideBubble);
        incomingBubble.setText(trimUnicode(nickname, "对方") + "：" + trimUnicode(text, ""));
        incomingBubble.setAlpha(0f);
        incomingBubble.setVisibility(View.VISIBLE);
        incomingBubble.animate().alpha(1f).setDuration(160).start();
        parent.postDelayed(hideBubble, 3000);
    }

    public void clearMessages() {
        parent.removeCallbacks(hideBubble);
        incomingBubble.setVisibility(View.GONE);
        hide();
        chatView.clearMessages();
    }

    public void setDarkMode(boolean darkMode) { chatView.setDarkMode(darkMode); }

    private static String trimUnicode(String value, String fallback) {
        if (value == null || value.isEmpty()) return fallback;
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
        String normalized = value.substring(start, end);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private GradientDrawable rounded(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
}