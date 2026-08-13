package com.tongkan.mobile.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.graphics.Typeface;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class BreathComponents {
    public static final String ROLE_SCREEN = "breathScreen";
    public static final String ROLE_PANEL = "breathPanel";
    public static final String ROLE_PRIMARY_TEXT = "breathPrimaryText";
    public static final String ROLE_MUTED_TEXT = "breathMutedText";
    public static final String ROLE_ACCENT_TEXT = "breathAccentText";
    public static final String ROLE_INPUT = "breathInput";
    public static final String ROLE_PRIMARY_BUTTON = "breathPrimaryButton";
    public static final String ROLE_SECONDARY_BUTTON = "breathSecondaryButton";
    public static final String ROLE_DANGER_BUTTON = "breathDangerButton";
    public static final String ROLE_ICON_BUTTON = "breathIconButton";
    public static final String ROLE_DIVIDER = "breathDivider";

    private final Context context;
    private final BreathTheme theme;

    public BreathComponents(Context context, BreathTheme theme) {
        this.context = context;
        this.theme = theme;
    }

    public ScrollView screen() {
        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        scroll.setTag(ROLE_SCREEN);
        return scroll;
    }

    public LinearLayout column(int paddingHorizontalDp, int paddingTopDp, int paddingBottomDp) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(paddingHorizontalDp), dp(paddingTopDp), dp(paddingHorizontalDp), dp(paddingBottomDp));
        return layout;
    }

    public LinearLayout row() {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    public LinearLayout panel(int paddingDp) {
        LinearLayout panel = column(paddingDp, paddingDp, paddingDp);
        panel.setTag(ROLE_PANEL);
        panel.setBackground(BreathDrawables.panel(context, theme, 19));
        return panel;
    }

    public TextView code(String value) {
        TextView view = text(value, 10, ROLE_MUTED_TEXT);
        view.setTypeface(Typeface.create("monospace", Typeface.BOLD));
        view.setLetterSpacing(0.12f);
        return view;
    }

    public TextView title(String value, int sizeSp) {
        TextView view = text(value, sizeSp, ROLE_PRIMARY_TEXT);
        view.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        view.setLetterSpacing(-0.035f);
        return view;
    }

    public TextView body(String value) {
        TextView view = text(value, 13, ROLE_MUTED_TEXT);
        view.setLineSpacing(0, 1.35f);
        return view;
    }

    public TextView section(String value) {
        TextView view = text(value, 15, ROLE_PRIMARY_TEXT);
        view.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        return view;
    }

    public TextView text(String value, int sizeSp, String role) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTag(role);
        if (ROLE_PRIMARY_TEXT.equals(role)) view.setTextColor(theme.ink());
        else if (ROLE_ACCENT_TEXT.equals(role)) view.setTextColor(theme.accent());
        else view.setTextColor(theme.muted());
        return view;
    }

    public EditText input(String hint, int inputType) {
        EditText view = new EditText(context);
        view.setHint(hint);
        view.setTextSize(14);
        view.setSingleLine(true);
        view.setInputType(inputType);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setTag(ROLE_INPUT);
        view.setTextColor(theme.ink());
        view.setHintTextColor(theme.faint());
        view.setBackground(BreathDrawables.input(context, theme));
        return view;
    }

    public EditText emailInput(String hint) {
        return input(hint, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    }

    public EditText textInput(String hint) {
        return input(hint, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
    }

    public EditText linkInput(String hint) {
        return input(hint, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    }

    public Button button(String label, boolean primary) {
        Button view = new Button(context);
        view.setText(label);
        view.setTextSize(14);
        view.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        view.setAllCaps(false);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setMinHeight(dp(48));
        view.setMinWidth(dp(48));
        view.setElevation(0);
        view.setStateListAnimator(null);
        view.setTag(primary ? ROLE_PRIMARY_BUTTON : ROLE_SECONDARY_BUTTON);
        styleButton(view, primary);
        return view;
    }

    public Button dangerButton(String label) {
        Button view = button(label, false);
        view.setTag(ROLE_DANGER_BUTTON);
        view.setTextColor(theme.danger());
        view.setBackground(BreathDrawables.dangerButton(context, theme));
        return view;
    }

    public ImageButton iconButton(int drawableId, String description) {
        ImageButton view = new ImageButton(context);
        view.setImageResource(drawableId);
        view.setContentDescription(description);
        view.setPadding(dp(13), dp(13), dp(13), dp(13));
        view.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        view.setMinimumHeight(dp(48));
        view.setMinimumWidth(dp(48));
        view.setElevation(0);
        view.setStateListAnimator(null);
        view.setTag(ROLE_ICON_BUTTON);
        view.setColorFilter(theme.ink(), PorterDuff.Mode.SRC_IN);
        view.setBackground(BreathDrawables.iconButton(context, theme));
        return view;
    }

    public TextView avatar(String label, boolean secondary) {
        TextView view = new TextView(context);
        view.setText(label);
        view.setTextSize(12);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setTextColor(Color.WHITE);
        view.setGravity(Gravity.CENTER);
        int fill = secondary ? Color.rgb(115, 123, 140) : Color.rgb(32, 35, 42);
        view.setBackground(BreathDrawables.rounded(context, fill, Color.argb(38, 255, 255, 255), 24));
        return view;
    }

    public View divider() {
        View view = new View(context);
        view.setTag(ROLE_DIVIDER);
        view.setBackgroundColor(theme.line());
        return view;
    }

    public void setButtonLoading(Button button, boolean loading, String idleLabel, String loadingLabel) {
        button.setEnabled(!loading);
        button.setText(loading ? loadingLabel : idleLabel);
        button.setAlpha(loading ? 0.68f : 1f);
    }

    public void applyTheme(View root) {
        applyThemeRecursive(root);
    }

    private void applyThemeRecursive(View view) {
        String role = view.getTag() instanceof String ? (String) view.getTag() : "";
        if (ROLE_SCREEN.equals(role)) view.setBackgroundColor(theme.background());
        if (ROLE_PANEL.equals(role)) view.setBackground(BreathDrawables.panel(context, theme, 19));
        if (ROLE_PRIMARY_TEXT.equals(role) && view instanceof TextView) ((TextView) view).setTextColor(theme.ink());
        if (ROLE_MUTED_TEXT.equals(role) && view instanceof TextView) ((TextView) view).setTextColor(theme.muted());
        if (ROLE_ACCENT_TEXT.equals(role) && view instanceof TextView) ((TextView) view).setTextColor(theme.accent());
        if (ROLE_INPUT.equals(role) && view instanceof EditText) {
            EditText input = (EditText) view;
            input.setTextColor(theme.ink());
            input.setHintTextColor(theme.faint());
            input.setBackground(BreathDrawables.input(context, theme));
        }
        if (ROLE_PRIMARY_BUTTON.equals(role) && view instanceof Button) styleButton((Button) view, true);
        if (ROLE_SECONDARY_BUTTON.equals(role) && view instanceof Button) styleButton((Button) view, false);
        if (ROLE_DANGER_BUTTON.equals(role) && view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(theme.danger());
            button.setBackground(BreathDrawables.dangerButton(context, theme));
        }
        if (ROLE_ICON_BUTTON.equals(role) && view instanceof ImageButton) {
            ImageButton button = (ImageButton) view;
            button.setColorFilter(theme.ink(), PorterDuff.Mode.SRC_IN);
            button.setBackground(BreathDrawables.iconButton(context, theme));
        }
        if (ROLE_DIVIDER.equals(role)) view.setBackgroundColor(theme.line());
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index += 1) applyThemeRecursive(group.getChildAt(index));
        }
    }

    private void styleButton(Button button, boolean primary) {
        int enabled = primary ? theme.ctaInk() : theme.ink();
        int disabled = primary ? Color.argb(150, Color.red(theme.ctaInk()), Color.green(theme.ctaInk()), Color.blue(theme.ctaInk())) : theme.faint();
        button.setTextColor(new ColorStateList(
            new int[][] {new int[] {-android.R.attr.state_enabled}, new int[] {}},
            new int[] {disabled, enabled}
        ));
        button.setBackground(BreathDrawables.button(context, theme, primary));
        button.setCompoundDrawableTintList(ColorStateList.valueOf(enabled));
    }

    public int dp(int value) {
        return theme.dp(value);
    }

    public LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    public LinearLayout.LayoutParams matchHeight(int heightDp) {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(heightDp));
    }

    public LinearLayout.LayoutParams weight(float weight) {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, weight);
    }

    public LinearLayout.LayoutParams margin(LinearLayout.LayoutParams params, int left, int top, int right, int bottom) {
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }
}
