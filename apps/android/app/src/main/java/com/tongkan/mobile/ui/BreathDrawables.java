package com.tongkan.mobile.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;

public final class BreathDrawables {
    private BreathDrawables() {}

    public static Drawable panel(Context context, BreathTheme theme, int radiusDp) {
        return rounded(context, theme.panel(), theme.line(), radiusDp);
    }

    public static Drawable input(Context context, BreathTheme theme) {
        return rounded(context, theme.field(), theme.line(), 14);
    }

    public static Drawable button(Context context, BreathTheme theme, boolean primary) {
        int normal = primary ? theme.cta() : theme.panel();
        int pressed = primary ? blend(normal, theme.accent(), 0.13f) : theme.accentSoft();
        int disabled = primary ? theme.disabled() : blend(theme.panel(), theme.background(), 0.55f);
        int border = primary ? Color.TRANSPARENT : theme.line();
        StateListDrawable content = new StateListDrawable();
        content.addState(new int[] {-android.R.attr.state_enabled}, rounded(context, disabled, border, 14));
        content.addState(new int[] {android.R.attr.state_pressed}, rounded(context, pressed, primary ? Color.TRANSPARENT : theme.accent(), 14));
        content.addState(new int[] {}, rounded(context, normal, border, 14));
        GradientDrawable mask = rounded(context, Color.WHITE, Color.TRANSPARENT, 14);
        return new RippleDrawable(ColorStateList.valueOf(theme.accentSoft()), content, mask);
    }

    public static Drawable iconButton(Context context, BreathTheme theme) {
        StateListDrawable content = new StateListDrawable();
        content.addState(new int[] {android.R.attr.state_pressed}, rounded(context, theme.accentSoft(), theme.accent(), 13));
        content.addState(new int[] {}, rounded(context, Color.TRANSPARENT, Color.TRANSPARENT, 13));
        GradientDrawable mask = rounded(context, Color.WHITE, Color.TRANSPARENT, 13);
        return new RippleDrawable(ColorStateList.valueOf(theme.accentSoft()), content, mask);
    }

    public static Drawable navBackground(Context context, BreathTheme theme, boolean selected) {
        return selected
            ? rounded(context, theme.accentSoft(), Color.TRANSPARENT, 10)
            : rounded(context, Color.TRANSPARENT, Color.TRANSPARENT, 10);
    }

    public static Drawable dangerButton(Context context, BreathTheme theme) {
        StateListDrawable content = new StateListDrawable();
        content.addState(new int[] {android.R.attr.state_pressed}, rounded(context, Color.argb(24, Color.red(theme.danger()), Color.green(theme.danger()), Color.blue(theme.danger())), theme.danger(), 14));
        content.addState(new int[] {}, rounded(context, Color.TRANSPARENT, Color.argb(92, Color.red(theme.danger()), Color.green(theme.danger()), Color.blue(theme.danger())), 14));
        return new RippleDrawable(ColorStateList.valueOf(Color.argb(32, Color.red(theme.danger()), Color.green(theme.danger()), Color.blue(theme.danger()))), content, rounded(context, Color.WHITE, Color.TRANSPARENT, 14));
    }

    public static GradientDrawable rounded(Context context, int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(context, radiusDp));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(context, 1), stroke);
        return drawable;
    }

    private static int blend(int first, int second, float amount) {
        float inverse = 1f - amount;
        return Color.rgb(
            Math.round(Color.red(first) * inverse + Color.red(second) * amount),
            Math.round(Color.green(first) * inverse + Color.green(second) * amount),
            Math.round(Color.blue(first) * inverse + Color.blue(second) * amount)
        );
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
