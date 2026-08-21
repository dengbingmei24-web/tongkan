package com.tongkan.mobile.ui;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;

public final class BreathTheme {
    private static final String DARK_MODE_KEY = "darkMode";

    private final Context context;
    private final SharedPreferences preferences;
    private boolean dark;

    public BreathTheme(Context context, SharedPreferences preferences) {
        this.context = context;
        this.preferences = preferences;
        this.dark = preferences.getBoolean(DARK_MODE_KEY, false);
    }

    public boolean isDark() {
        return dark;
    }

    public void toggle() {
        dark = !dark;
        preferences.edit().putBoolean(DARK_MODE_KEY, dark).apply();
    }

    public int background() {
        return dark ? Color.rgb(5, 7, 10) : Color.rgb(247, 248, 250);
    }

    public int ink() {
        return dark ? Color.rgb(245, 247, 250) : Color.rgb(11, 13, 18);
    }

    public int muted() {
        return dark ? Color.rgb(133, 140, 152) : Color.rgb(119, 126, 139);
    }

    public int faint() {
        return dark ? Color.rgb(95, 102, 114) : Color.rgb(165, 170, 180);
    }

    public int line() {
        return dark ? Color.argb(28, 255, 255, 255) : Color.argb(24, 12, 17, 25);
    }

    public int panel() {
        return dark ? Color.rgb(15, 18, 24) : Color.WHITE;
    }

    public int field() {
        return dark ? Color.rgb(17, 20, 27) : Color.rgb(241, 243, 247);
    }

    public int cta() {
        return dark ? Color.rgb(244, 246, 249) : Color.rgb(16, 18, 24);
    }

    public int ctaInk() {
        return dark ? Color.rgb(9, 11, 15) : Color.WHITE;
    }

    public int accent() {
        return dark ? Color.rgb(145, 167, 255) : Color.rgb(99, 127, 255);
    }

    public int accentSoft() {
        return dark ? Color.argb(34, 145, 167, 255) : Color.argb(31, 99, 127, 255);
    }

    public int danger() {
        return dark ? Color.rgb(255, 114, 122) : Color.rgb(216, 73, 82);
    }

    public int success() {
        return dark ? Color.rgb(103, 206, 151) : Color.rgb(61, 155, 106);
    }

    public int darkenedLine() {
        return dark ? Color.argb(82, 255, 255, 255) : Color.argb(58, 12, 17, 25);
    }

    public int disabled() {
        return dark ? Color.rgb(70, 75, 84) : Color.rgb(205, 209, 216);
    }

    public int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public void applySystemBars(Activity activity, boolean immersive) {
        activity.getWindow().setStatusBarColor(immersive ? Color.BLACK : background());
        activity.getWindow().setNavigationBarColor(immersive ? Color.BLACK : background());
        if (immersive) return;
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        if (!dark) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        activity.getWindow().getDecorView().setSystemUiVisibility(flags);
    }
}
