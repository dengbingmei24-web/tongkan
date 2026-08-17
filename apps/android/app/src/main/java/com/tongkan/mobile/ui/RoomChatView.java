package com.tongkan.mobile.ui;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;

public final class RoomChatView extends LinearLayout {
    public interface OnSendListener { boolean onSend(String text); }
    public interface OnComposerFocusListener { void onComposerFocusChanged(boolean focused); }

    private final LinearLayout messageList;
    private final ScrollView messageScroll;
    private final EditText input;
    private final Button sendButton;
    private final LinearLayout composer;
    private final Deque<String> messageIds = new ArrayDeque<>();
    private final Set<String> messageIdSet = new HashSet<>();
    private OnSendListener onSendListener;
    private OnComposerFocusListener onComposerFocusListener;
    private boolean darkMode;

    public RoomChatView(Context context, boolean compactLandscape) {
        super(context);
        setOrientation(VERTICAL);
        setPadding(dp(10), dp(10), dp(10), dp(10));

        messageList = new LinearLayout(context);
        messageList.setOrientation(VERTICAL);
        messageScroll = new ScrollView(context);
        messageScroll.setFillViewport(false);
        messageScroll.addView(messageList, new ScrollView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        addView(messageScroll, new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f));

        composer = new LinearLayout(context);
        composer.setOrientation(HORIZONTAL);
        composer.setGravity(Gravity.CENTER_VERTICAL);
        LayoutParams composerParams = new LayoutParams(LayoutParams.MATCH_PARENT, dp(50));
        composerParams.topMargin = dp(8);
        composer.setElevation(dp(4));
        addView(composer, composerParams);

        input = new EditText(context);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setFocusable(true);
        input.setFocusableInTouchMode(true);
        input.setSelectAllOnFocus(false);
        input.setCursorVisible(true);
        input.setGravity(Gravity.CENTER_VERTICAL);
        input.setTextSize(14);
        input.setHint("说点什么…");
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(120)});
        input.setImeOptions(EditorInfo.IME_ACTION_SEND | EditorInfo.IME_FLAG_NO_EXTRACT_UI | EditorInfo.IME_FLAG_NO_FULLSCREEN);
        input.setPadding(dp(12), 0, dp(12), 0);
        composer.addView(input, new LayoutParams(0, LayoutParams.MATCH_PARENT, 1f));

        sendButton = new Button(context);
        sendButton.setText("发送");
        sendButton.setTextSize(13);
        sendButton.setAllCaps(false);
        sendButton.setMinWidth(0);
        sendButton.setMinimumWidth(0);
        LayoutParams sendParams = new LayoutParams(dp(66), LayoutParams.MATCH_PARENT);
        sendParams.leftMargin = dp(8);
        composer.addView(sendButton, sendParams);

        sendButton.setOnClickListener(view -> submit());
        input.setOnEditorActionListener((view, actionId, event) -> {
            boolean sendAction = isSendAction(
                actionId,
                event == null ? KeyEvent.KEYCODE_UNKNOWN : event.getKeyCode(),
                event == null ? KeyEvent.ACTION_UP : event.getAction(),
                event != null && event.isShiftPressed()
            );
            if (!sendAction) return false;
            submit();
            return true;
        });
        input.setOnFocusChangeListener((view, focused) -> {
            if (focused) {
                input.setCursorVisible(true);
                input.setSelection(input.length());
                requestApplyInsets();
            }
            if (onComposerFocusListener != null) onComposerFocusListener.onComposerFocusChanged(focused);
        });
        setDarkMode(false);
    }

    public void setOnSendListener(OnSendListener listener) { onSendListener = listener; }
    public void setOnComposerFocusListener(OnComposerFocusListener listener) { onComposerFocusListener = listener; }

    public void setSendEnabled(boolean enabled) {
        input.setEnabled(enabled);
        sendButton.setEnabled(enabled);
        input.setHint(enabled ? "说点什么…" : "正在重连…");
        sendButton.setAlpha(enabled ? 1f : 0.45f);
    }

    public boolean addMessage(String messageId, String nickname, String text, boolean own) {
        String normalizedId = messageId == null ? "" : messageId.trim();
        if (!normalizedId.isEmpty() && messageIdSet.contains(normalizedId)) return false;
        if (!normalizedId.isEmpty()) {
            messageIds.addLast(normalizedId);
            messageIdSet.add(normalizedId);
        }
        while (messageList.getChildCount() >= 20) messageList.removeViewAt(0);
        while (messageIds.size() > 20) messageIdSet.remove(messageIds.removeFirst());

        LinearLayout row = new LinearLayout(getContext());
        row.setGravity(own ? Gravity.END : Gravity.START);
        TextView bubble = new TextView(getContext());
        bubble.setText(safe(nickname, own ? "我" : "对方") + "\n" + safe(text, ""));
        bubble.setTextSize(13);
        bubble.setLineSpacing(0, 1.1f);
        bubble.setPadding(dp(10), dp(7), dp(10), dp(7));
        bubble.setTag(own ? "own" : "peer");
        bubble.setMaxWidth(dp(280));
        row.addView(bubble, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT));
        LayoutParams rowParams = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        rowParams.bottomMargin = dp(6);
        messageList.addView(row, rowParams);
        styleBubble(bubble, own);
        messageScroll.post(() -> messageScroll.fullScroll(FOCUS_DOWN));
        return true;
    }

    public void clearMessages() {
        messageList.removeAllViews();
        messageIds.clear();
        messageIdSet.clear();
        input.setText("");
    }

    public void focusComposer() {
        input.requestFocus();
        input.setSelection(input.length());
        input.post(() -> {
            InputMethodManager keyboard = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            if (keyboard != null) keyboard.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
        });
    }

    public View detachComposerForOverlay() {
        if (composer.getParent() instanceof ViewGroup) {
            ((ViewGroup) composer.getParent()).removeView(composer);
        }
        messageScroll.setClipToPadding(false);
        messageScroll.setPadding(0, 0, 0, dp(58));
        composer.setElevation(dp(8));
        return composer;
    }

    public void dismissComposer() {
        input.clearFocus();
        InputMethodManager keyboard = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null) keyboard.hideSoftInputFromWindow(input.getWindowToken(), 0);
    }

    public void setDarkMode(boolean dark) {
        darkMode = dark;
        setBackground(rounded(dark ? 0xE614171D : 0xF7FFFFFF, dark ? 0xFF343941 : 0xFFD8DCE3, 14));
        input.setTextColor(dark ? Color.WHITE : 0xFF111318);
        input.setHintTextColor(dark ? 0xFF858C98 : 0xFF777E8B);
        input.setBackground(rounded(dark ? 0xFF20242C : 0xFFF4F5F7, dark ? 0xFF3A404A : 0xFFD8DCE3, 12));
        sendButton.setTextColor(dark ? 0xFF111318 : Color.WHITE);
        sendButton.setTypeface(Typeface.DEFAULT_BOLD);
        sendButton.setBackground(rounded(dark ? 0xFFF5F7FA : 0xFF101218, dark ? 0xFFF5F7FA : 0xFF101218, 12));
        for (int index = 0; index < messageList.getChildCount(); index += 1) {
            LinearLayout row = (LinearLayout) messageList.getChildAt(index);
            if (row.getChildCount() > 0 && row.getChildAt(0) instanceof TextView) {
                TextView bubble = (TextView) row.getChildAt(0);
                styleBubble(bubble, "own".equals(bubble.getTag()));
            }
        }
    }

    static boolean isSendAction(int actionId, int keyCode, int keyAction, boolean shiftPressed) {
        return actionId == EditorInfo.IME_ACTION_SEND
            || (keyCode == KeyEvent.KEYCODE_ENTER
                && keyAction == KeyEvent.ACTION_DOWN
                && !shiftPressed);
    }

    private void submit() {
        String text = trimUnicode(input.getText().toString());
        if (text.isEmpty() || onSendListener == null || !sendButton.isEnabled()) return;
        if (onSendListener.onSend(text)) {
            input.getText().clear();
            input.setSelection(0);
        }
    }

    private void styleBubble(TextView bubble, boolean own) {
        int background = own ? (darkMode ? 0xFFEEF1FF : 0xFFE9EDFF) : (darkMode ? 0xFF252A32 : 0xFFF0F2F5);
        bubble.setTextColor(darkMode && !own ? Color.WHITE : 0xFF111318);
        bubble.setBackground(rounded(background, background, 12));
    }

    private GradientDrawable rounded(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static String safe(String value, String fallback) {
        String normalized = trimUnicode(value);
        return normalized.isEmpty() ? fallback : normalized;
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

}
