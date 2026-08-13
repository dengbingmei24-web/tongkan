package com.tongkan.mobile.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.PorterDuff;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.tongkan.mobile.R;

import java.util.LinkedHashMap;
import java.util.Map;

public final class MainNavigationView {
    public interface Listener {
        void onTabSelected(String page);
    }

    private final Context context;
    private final BreathTheme theme;
    private final BreathComponents components;
    private final Listener listener;
    private final LinearLayout root;
    private final FrameLayout contentHost;
    private final LinearLayout navRow;
    private final Map<String, Button> buttons = new LinkedHashMap<>();
    private String currentPage = "home";

    public MainNavigationView(Context context, BreathTheme theme, Listener listener) {
        this.context = context;
        this.theme = theme;
        this.listener = listener;
        this.components = new BreathComponents(context, theme);
        root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setTag(BreathComponents.ROLE_SCREEN);

        contentHost = new FrameLayout(context);
        root.addView(contentHost, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        root.addView(components.divider(), new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, components.dp(1)));

        navRow = new LinearLayout(context);
        navRow.setOrientation(LinearLayout.HORIZONTAL);
        navRow.setGravity(Gravity.CENTER);
        navRow.setPadding(components.dp(10), components.dp(4), components.dp(10), components.dp(4));
        root.addView(navRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, components.dp(72)));
        addTab("home", "首页", R.drawable.ic_home);
        addTab("library", "片库", R.drawable.ic_library);
        addTab("calendar", "日历", R.drawable.ic_calendar);
        addTab("pair", "我们", R.drawable.ic_people);
        applyTheme();
    }

    private void addTab(String id, String label, int icon) {
        Button button = new Button(context);
        button.setText(label);
        button.setTextSize(10);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setCompoundDrawablesWithIntrinsicBounds(0, icon, 0, 0);
        button.setCompoundDrawablePadding(components.dp(2));
        button.setPadding(0, components.dp(4), 0, components.dp(4));
        button.setMinHeight(components.dp(56));
        button.setMinWidth(components.dp(48));
        button.setElevation(0);
        button.setStateListAnimator(null);
        button.setOnClickListener(view -> {
            select(id);
            listener.onTabSelected(id);
        });
        buttons.put(id, button);
        navRow.addView(button, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));
    }

    public View getView() {
        return root;
    }

    public void showContent(View content) {
        if (content.getParent() instanceof ViewGroup) ((ViewGroup) content.getParent()).removeView(content);
        contentHost.removeAllViews();
        contentHost.addView(content, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    public void select(String page) {
        currentPage = page;
        applyTheme();
    }

    public String getCurrentPage() {
        return currentPage;
    }

    public View placeholder(String code, String title, String description) {
        ScrollView scroll = components.screen();
        LinearLayout content = components.column(21, 22, 28);
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        content.addView(components.code(code), components.matchWrap());
        content.addView(components.title(title, 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        content.addView(components.body(description), components.margin(components.matchWrap(), 0, 8, 0, 0));
        LinearLayout panel = components.panel(18);
        TextView state = components.text("P0 / UI SHELL READY", 10, BreathComponents.ROLE_ACCENT_TEXT);
        state.setTypeface(Typeface.create("monospace", Typeface.BOLD));
        panel.addView(state, components.matchWrap());
        panel.addView(components.title("界面骨架已经接入", 21), components.margin(components.matchWrap(), 0, 18, 0, 0));
        panel.addView(components.body("真实数据将在对应 Alpha 10 阶段接入。当前版本先验证主题、导航、安全区和播放器兼容。"), components.margin(components.matchWrap(), 0, 8, 0, 0));
        content.addView(panel, components.margin(components.matchWrap(), 0, 30, 0, 0));
        components.applyTheme(scroll);
        return scroll;
    }

    public void applyTheme() {
        root.setBackgroundColor(theme.background());
        navRow.setBackgroundColor(theme.background());
        for (Map.Entry<String, Button> entry : buttons.entrySet()) {
            boolean selected = entry.getKey().equals(currentPage);
            Button button = entry.getValue();
            int color = selected ? theme.ink() : theme.muted();
            button.setTextColor(color);
            button.setCompoundDrawableTintList(ColorStateList.valueOf(color));
            button.setBackground(BreathDrawables.navBackground(context, theme, selected));
            button.setContentDescription(entry.getValue().getText() + (selected ? "，当前页面" : ""));
        }
        components.applyTheme(contentHost);
    }
}
