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
import com.tongkan.mobile.account.AccountModels;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class MainNavigationView {
    public interface Listener {
        void onTabSelected(String page);
    }

    public interface PairActions {
        void onCreateInvite();
        void onCopyInvite();
        void onAcceptInvite(String code);
        void onRefresh();
        void onInviteWatch();
        void onRequestUnbind();
        void onChooseArchiveRetention(AccountModels.PairArchive archive);
        void onLogout();
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

    public View accountPage(String nickname, String email, View.OnClickListener logoutListener) {
        ScrollView scroll = components.screen();
        LinearLayout content = components.column(21, 22, 28);
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        content.addView(components.code("04 / US"), components.matchWrap());
        content.addView(components.title("我们的空间", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        content.addView(components.body("账号已经连接。唯一好友、共同历史和观看统计将在后续阶段接入。"), components.margin(components.matchWrap(), 0, 8, 0, 0));
        LinearLayout panel = components.panel(18);
        panel.addView(components.code("ACCOUNT / CONNECTED"), components.matchWrap());
        panel.addView(components.title(nickname, 22), components.margin(components.matchWrap(), 0, 18, 0, 0));
        panel.addView(components.body(email), components.margin(components.matchWrap(), 0, 5, 0, 0));
        Button logout = components.button("退出账号", false);
        logout.setOnClickListener(logoutListener);
        panel.addView(logout, components.margin(components.matchHeight(50), 0, 18, 0, 0));
        content.addView(panel, components.margin(components.matchWrap(), 0, 24, 0, 0));
        return scroll;
    }

    public View pairPage(
        String nickname,
        String email,
        AccountModels.PairState pairState,
        AccountModels.PairInvite invite,
        String message,
        boolean loading,
        PairActions actions
    ) {
        AccountModels.Pair pair = pairState == null ? null : pairState.pair;
        ScrollView scroll = components.screen();
        LinearLayout content = components.column(21, 22, 28);
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        content.addView(components.code("04 / US"), components.matchWrap());
        content.addView(components.title("我们的空间", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        boolean hasArchives = pairState != null && (!pairState.pendingArchives.isEmpty() || !pairState.archives.isEmpty());
        content.addView(components.body(pair == null
            ? (hasArchives ? "当前没有绑定好友。旧空间由你独立决定保留或删除，也可以继续绑定新好友。" : "每个账号只能绑定一位好友。邀请码一次性使用，24 小时后失效。")
            : "你们已经连接。解除绑定不会退出账号，也不会影响匿名临时房间。"), components.margin(components.matchWrap(), 0, 8, 0, 0));

        LinearLayout accountPanel = components.panel(18);
        accountPanel.addView(components.code("ACCOUNT / CONNECTED"), components.matchWrap());
        accountPanel.addView(components.title(nickname, 21), components.margin(components.matchWrap(), 0, 16, 0, 0));
        accountPanel.addView(components.body(email), components.margin(components.matchWrap(), 0, 4, 0, 0));
        content.addView(accountPanel, components.margin(components.matchWrap(), 0, 24, 0, 0));

        if (pair == null) {
            LinearLayout invitePanel = components.panel(18);
            invitePanel.addView(components.code("PAIR / INVITE"), components.matchWrap());
            invitePanel.addView(components.section("邀请你的唯一好友"), components.margin(components.matchWrap(), 0, 16, 0, 0));
            if (invite != null) {
                TextView code = components.title(invite.code, 25);
                code.setTypeface(Typeface.create("monospace", Typeface.BOLD));
                invitePanel.addView(code, components.margin(components.matchWrap(), 0, 14, 0, 0));
                invitePanel.addView(components.body("把邀请码发给对方；绑定成功后此码立即失效。"), components.margin(components.matchWrap(), 0, 7, 0, 0));
                Button copy = components.button("复制邀请码", false);
                copy.setEnabled(!loading);
                copy.setOnClickListener(view -> actions.onCopyInvite());
                invitePanel.addView(copy, components.margin(components.matchHeight(50), 0, 16, 0, 0));
            }
            Button create = components.button(invite == null ? "生成邀请码" : "重新生成邀请码", true);
            create.setEnabled(!loading);
            create.setOnClickListener(view -> actions.onCreateInvite());
            invitePanel.addView(create, components.margin(components.matchHeight(50), 0, invite == null ? 16 : 10, 0, 0));
            content.addView(invitePanel, components.margin(components.matchWrap(), 0, 16, 0, 0));

            LinearLayout acceptPanel = components.panel(18);
            acceptPanel.addView(components.code("PAIR / ACCEPT"), components.matchWrap());
            acceptPanel.addView(components.section("输入好友邀请码"), components.margin(components.matchWrap(), 0, 16, 0, 0));
            android.widget.EditText codeInput = components.textInput("例如 ABCDE-23456");
            codeInput.setAllCaps(true);
            acceptPanel.addView(codeInput, components.margin(components.matchHeight(52), 0, 14, 0, 0));
            Button accept = components.button(loading ? "正在连接…" : "确认绑定", true);
            accept.setEnabled(!loading);
            accept.setOnClickListener(view -> actions.onAcceptInvite(codeInput.getText().toString()));
            acceptPanel.addView(accept, components.margin(components.matchHeight(50), 0, 12, 0, 0));
            content.addView(acceptPanel, components.margin(components.matchWrap(), 0, 16, 0, 0));
        } else {
            LinearLayout pairPanel = components.panel(18);
            pairPanel.addView(components.code("PAIR / CONNECTED"), components.matchWrap());
            LinearLayout people = components.row();
            people.addView(components.avatar(initial(nickname), false), new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
            TextView link = components.title("＋", 20);
            link.setGravity(Gravity.CENTER);
            people.addView(link, new LinearLayout.LayoutParams(components.dp(42), components.dp(48)));
            people.addView(components.avatar(initial(pair.partner.nickname), true), new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
            pairPanel.addView(people, components.margin(components.matchWrap(), 0, 17, 0, 0));
            pairPanel.addView(components.title(nickname + " × " + pair.partner.nickname, 22), components.margin(components.matchWrap(), 0, 14, 0, 0));
            pairPanel.addView(components.body(pair.partner.email), components.margin(components.matchWrap(), 0, 5, 0, 0));
            Button start = components.button("邀请一起看", true);
            start.setEnabled(!loading);
            start.setOnClickListener(view -> actions.onInviteWatch());
            pairPanel.addView(start, components.margin(components.matchHeight(50), 0, 18, 0, 0));
            Button unbind = components.button(loading ? "正在处理…" : "解除好友绑定", false);
            unbind.setEnabled(!loading);
            unbind.setOnClickListener(view -> actions.onRequestUnbind());
            pairPanel.addView(unbind, components.margin(components.matchHeight(50), 0, 10, 0, 0));
            content.addView(pairPanel, components.margin(components.matchWrap(), 0, 16, 0, 0));
        }

        if (pairState != null && !pairState.pendingArchives.isEmpty()) {
            content.addView(components.code("ARCHIVE / ACTION REQUIRED"), components.margin(components.matchWrap(), 0, 22, 0, 0));
            content.addView(components.section("待处理的旧空间"), components.margin(components.matchWrap(), 0, 10, 0, 0));
            content.addView(components.body("每个旧空间都需要由你本人选择保留只读归档或删除访问权。选择确认后不能修改。"), components.margin(components.matchWrap(), 0, 7, 0, 0));
            for (AccountModels.PairArchive archive : pairState.pendingArchives) {
                content.addView(archivePanel(archive, true, loading, actions), components.margin(components.matchWrap(), 0, 12, 0, 0));
            }
        }

        if (pairState != null && !pairState.archives.isEmpty()) {
            content.addView(components.code("ARCHIVE / READ ONLY"), components.margin(components.matchWrap(), 0, 22, 0, 0));
            content.addView(components.section("保留的旧空间"), components.margin(components.matchWrap(), 0, 10, 0, 0));
            for (AccountModels.PairArchive archive : pairState.archives) {
                content.addView(archivePanel(archive, false, loading, actions), components.margin(components.matchWrap(), 0, 12, 0, 0));
            }
        }

        if (message != null && !message.isEmpty()) {
            content.addView(components.body(message), components.margin(components.matchWrap(), 0, 8, 0, 0));
        }
        Button refresh = components.button(loading ? "正在刷新…" : "刷新绑定状态", false);
        refresh.setEnabled(!loading);
        refresh.setOnClickListener(view -> actions.onRefresh());
        content.addView(refresh, components.margin(components.matchHeight(50), 0, 18, 0, 0));
        Button logout = components.button("退出账号", false);
        logout.setEnabled(!loading);
        logout.setOnClickListener(view -> actions.onLogout());
        content.addView(logout, components.margin(components.matchHeight(50), 0, 10, 0, 0));
        components.applyTheme(scroll);
        return scroll;
    }

    private LinearLayout archivePanel(
        AccountModels.PairArchive archive,
        boolean pending,
        boolean loading,
        PairActions actions
    ) {
        LinearLayout panel = components.panel(18);
        panel.addView(components.code(pending ? "DECISION / PENDING" : "ARCHIVE / KEPT"), components.matchWrap());
        LinearLayout partner = components.row();
        partner.addView(components.avatar(initial(archive.partner.nickname), pending), new LinearLayout.LayoutParams(components.dp(44), components.dp(44)));
        LinearLayout details = components.column(0, 0, 0);
        details.addView(components.section(archive.partner.nickname), components.matchWrap());
        details.addView(components.body(archive.partner.email), components.margin(components.matchWrap(), 0, 3, 0, 0));
        LinearLayout.LayoutParams detailsParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        detailsParams.setMargins(components.dp(12), 0, 0, 0);
        partner.addView(details, detailsParams);
        panel.addView(partner, components.margin(components.matchWrap(), 0, 15, 0, 0));
        panel.addView(components.body("绑定于 " + formatDate(archive.boundAt) + " · 解绑于 " + formatDate(archive.unboundAt)), components.margin(components.matchWrap(), 0, 8, 0, 0));
        if (pending) {
            Button choose = components.button(loading ? "正在处理…" : "选择保留或删除", true);
            choose.setEnabled(!loading);
            choose.setOnClickListener(view -> actions.onChooseArchiveRetention(archive));
            panel.addView(choose, components.margin(components.matchHeight(50), 0, 15, 0, 0));
        } else {
            panel.addView(components.body("只读归档 · 不参与当前好友关系和新的双人空间"), components.margin(components.matchWrap(), 0, 8, 0, 0));
        }
        return panel;
    }

    private static String formatDate(long timestamp) {
        return new SimpleDateFormat("yyyy.MM.dd", Locale.CHINA).format(new Date(timestamp));
    }

    private static String initial(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? "同" : trimmed.substring(0, 1).toUpperCase();
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
