package com.tongkan.mobile.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.tongkan.mobile.R;
import com.tongkan.mobile.account.AccountModels;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public final class HomeScreen {
    public interface Listener {
        void onToggleTheme();
        void onCreateRoom();
        void onJoinRoom();
        void onPasteInvite();
        void onRestoreRoom();
        void onAccountAction();
        void onJoinActiveRoom();
        void onOpenCalendar();
        void onPlayTodayPlan(AccountModels.CalendarPlan plan);
        void onRefreshTodayPlans();
    }

    private final BreathTheme theme;
    private final BreathComponents components;
    private final Listener listener;
    private final ScrollView root;
    private final EditText nicknameInput;
    private final EditText inviteInput;
    private final Button createButton;
    private final Button joinButton;
    private final Button continueButton;
    private final ImageButton themeButton;
    private final TextView connectionText;
    private final TextView ownAvatar;
    private final TextView peerAvatar;
    private final TextView presenceSummary;
    private final TextView modeText;
    private final TextView accountText;
    private final Button accountButton;
    private final LinearLayout activeRoomPanel;
    private final TextView activeRoomTitle;
    private final TextView activeRoomBody;
    private final Button activeRoomButton;
    private final LinearLayout todayPanel;
    private final LinearLayout todayList;
    private final TextView todayStateText;
    private final Button todayRetryButton;
    private final LinearLayout joinPanel;
    private final TextView roomCode;
    private final TextView roomStatus;
    private final TextView roomTitle;
    private final TextView roomSubtitle;
    private final TextView nicknameLabel;
    private final Button roomPrimaryButton;
    private final Button roomSecondaryButton;
    private AccountModels.Pair currentPair;
    private boolean accountMode;

    public HomeScreen(Context context, BreathTheme theme, String quote, String quoteSource, Listener listener) {
        this.theme = theme;
        this.components = new BreathComponents(context, theme);
        this.listener = listener;
        root = components.screen();
        LinearLayout content = components.column(21, 22, 26);
        root.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout header = components.row();
        LinearLayout headerCopy = components.column(0, 0, 0);
        headerCopy.addView(components.code("01 / NOW"), components.matchWrap());
        headerCopy.addView(components.title("一起看", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        headerCopy.addView(components.body("连接状态、今日计划与房间操作都在这里。"), components.margin(components.matchWrap(), 0, 8, 0, 0));
        header.addView(headerCopy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        themeButton = components.iconButton(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon, theme.isDark() ? "切换浅色主题" : "切换深色主题");
        themeButton.setOnClickListener(view -> listener.onToggleTheme());
        header.addView(themeButton, new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
        content.addView(header, components.matchWrap());

        LinearLayout presence = components.panel(16);
        LinearLayout people = components.row();
        ownAvatar = components.avatar("我", false);
        people.addView(ownAvatar, new LinearLayout.LayoutParams(components.dp(44), components.dp(44)));
        View link = components.divider();
        LinearLayout.LayoutParams linkParams = new LinearLayout.LayoutParams(0, components.dp(1), 1f);
        linkParams.setMargins(components.dp(12), 0, components.dp(12), 0);
        people.addView(link, linkParams);
        peerAvatar = components.avatar("友", true);
        people.addView(peerAvatar, new LinearLayout.LayoutParams(components.dp(44), components.dp(44)));
        presence.addView(people, components.matchWrap());
        LinearLayout presenceCopy = components.row();
        modeText = components.text("● 匿名模式", 11, BreathComponents.ROLE_ACCENT_TEXT);
        presenceCopy.addView(modeText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        presenceSummary = components.text("最多 2 人", 11, BreathComponents.ROLE_MUTED_TEXT);
        presenceSummary.setGravity(Gravity.END);
        presenceCopy.addView(presenceSummary, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        presence.addView(presenceCopy, components.margin(components.matchWrap(), 0, 13, 0, 0));
        accountText = components.text("房间功能无需登录即可使用", 11, BreathComponents.ROLE_MUTED_TEXT);
        presence.addView(accountText, components.margin(components.matchWrap(), 0, 7, 0, 0));
        accountButton = components.textButton("登录账号");
        accountButton.setOnClickListener(view -> listener.onAccountAction());
        presence.addView(accountButton, components.margin(components.matchHeight(46), 0, 10, 0, 0));
        content.addView(presence, components.margin(components.matchWrap(), 0, 18, 0, 0));

        activeRoomPanel = components.panel(18);
        activeRoomPanel.setVisibility(View.GONE);
        activeRoomPanel.addView(components.code("FRIEND / WAITING"), components.matchWrap());
        activeRoomTitle = components.title("好友正在等你一起看", 22);
        activeRoomPanel.addView(activeRoomTitle, components.margin(components.matchWrap(), 0, 12, 0, 0));
        activeRoomBody = components.body("点击即可直接进入，无需复制或发送邀请链接。");
        activeRoomPanel.addView(activeRoomBody, components.margin(components.matchWrap(), 0, 6, 0, 0));
        activeRoomButton = components.button("进入好友房间", true);
        activeRoomButton.setOnClickListener(view -> listener.onJoinActiveRoom());
        activeRoomPanel.addView(activeRoomButton, components.margin(components.matchHeight(50), 0, 15, 0, 0));
        content.addView(activeRoomPanel, components.margin(components.matchWrap(), 0, 12, 0, 0));

        LinearLayout roomCard = components.panel(18);
        LinearLayout roomTop = components.row();
        roomCode = components.code("ROOM / READY");
        roomTop.addView(roomCode, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        roomStatus = components.text("● LOCAL FIRST", 10, BreathComponents.ROLE_ACCENT_TEXT);
        roomStatus.setTypeface(Typeface.create("monospace", Typeface.BOLD));
        roomTop.addView(roomStatus, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        roomCard.addView(roomTop, components.matchWrap());
        roomTitle = components.title("先找到一起看的人。", 25);
        roomTitle.setLineSpacing(0, 1.08f);
        roomCard.addView(roomTitle, components.margin(components.matchWrap(), 0, 20, 0, 0));
        roomSubtitle = components.body("绑定唯一好友后，房间会自动出现在双方首页；现在也可以先用匿名房间。\n");
        roomCard.addView(roomSubtitle, components.margin(components.matchWrap(), 0, 8, 0, 0));
        nicknameLabel = components.code("你的昵称");
        roomCard.addView(nicknameLabel, components.margin(components.matchWrap(), 0, 18, 0, 8));
        nicknameInput = components.textInput("你的昵称");
        roomCard.addView(nicknameInput, components.matchHeight(52));
        LinearLayout actions = components.row();
        roomPrimaryButton = components.button("管理好友", true);
        createButton = roomPrimaryButton;
        roomPrimaryButton.setOnClickListener(view -> listener.onAccountAction());
        actions.addView(roomPrimaryButton, new LinearLayout.LayoutParams(0, components.dp(52), 1.25f));
        roomSecondaryButton = components.button("创建匿名房间", false);
        roomSecondaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_play, 0, 0, 0);
        roomSecondaryButton.setCompoundDrawablePadding(components.dp(8));
        roomSecondaryButton.setOnClickListener(view -> listener.onCreateRoom());
        LinearLayout.LayoutParams secondaryParams = new LinearLayout.LayoutParams(0, components.dp(52), 0.9f);
        secondaryParams.setMargins(components.dp(9), 0, 0, 0);
        actions.addView(roomSecondaryButton, secondaryParams);
        roomCard.addView(actions, components.margin(components.matchWrap(), 0, 18, 0, 0));
        content.addView(roomCard, components.margin(components.matchWrap(), 0, 12, 0, 0));

        todayPanel = components.panel(16);
        todayPanel.setVisibility(View.GONE);
        LinearLayout todayHeader = components.row();
        todayHeader.addView(components.section("今日轨道"), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button openCalendar = components.button("查看日历", false);
        openCalendar.setOnClickListener(view -> listener.onOpenCalendar());
        todayHeader.addView(openCalendar, new LinearLayout.LayoutParams(components.dp(104), components.dp(44)));
        todayPanel.addView(todayHeader, components.matchWrap());
        todayStateText = components.body("");
        todayPanel.addView(todayStateText, components.margin(components.matchWrap(), 0, 10, 0, 0));
        todayList = components.column(0, 0, 0);
        todayPanel.addView(todayList, components.margin(components.matchWrap(), 0, 8, 0, 0));
        todayRetryButton = components.button("重新加载", false);
        todayRetryButton.setVisibility(View.GONE);
        todayRetryButton.setOnClickListener(view -> listener.onRefreshTodayPlans());
        todayPanel.addView(todayRetryButton, components.margin(components.matchHeight(46), 0, 10, 0, 0));
        content.addView(todayPanel, components.margin(components.matchWrap(), 0, 12, 0, 0));

        joinPanel = components.panel(16);
        joinPanel.setVisibility(View.GONE);
        joinPanel.addView(components.section("加入朋友的房间"), components.matchWrap());
        joinPanel.addView(components.body("粘贴朋友发来的邀请链接，再确认加入。"), components.margin(components.matchWrap(), 0, 5, 0, 0));
        inviteInput = components.linkInput("https://tongkan-personal.pages.dev/room/…");
        joinPanel.addView(inviteInput, components.margin(components.matchHeight(52), 0, 16, 0, 0));
        LinearLayout joinActions = components.row();
        Button pasteButton = components.button("粘贴", false);
        pasteButton.setOnClickListener(view -> listener.onPasteInvite());
        joinActions.addView(pasteButton, new LinearLayout.LayoutParams(0, components.dp(50), 0.72f));
        joinButton = components.button("确认加入", true);
        joinButton.setOnClickListener(view -> listener.onJoinRoom());
        LinearLayout.LayoutParams confirmParams = new LinearLayout.LayoutParams(0, components.dp(50), 1.28f);
        confirmParams.setMargins(components.dp(9), 0, 0, 0);
        joinActions.addView(joinButton, confirmParams);
        joinPanel.addView(joinActions, components.matchWrap());
        content.addView(joinPanel, components.margin(components.matchWrap(), 0, 12, 0, 0));

        continueButton = components.button("继续上次房间", false);
        continueButton.setOnClickListener(view -> listener.onRestoreRoom());
        content.addView(continueButton, components.margin(components.matchHeight(50), 0, 10, 0, 0));
        connectionText = components.text("创建房间，或粘贴邀请链接加入", 12, BreathComponents.ROLE_MUTED_TEXT);
        connectionText.setGravity(Gravity.CENTER);
        content.addView(connectionText, components.margin(components.matchWrap(), 0, 16, 0, 0));
        applyTheme();
        updateRoomCard();
    }

    private void updateRoomCard() {
        boolean bound = accountMode && currentPair != null;
        boolean accountUnbound = accountMode && currentPair == null;
        roomCode.setText(bound ? "ROOM / READY" : accountUnbound ? "PAIR / EMPTY" : "ROOM / READY");
        roomStatus.setText(bound ? "● LIVE LINK" : accountUnbound ? "NO LINK" : "● LOCAL FIRST");
        roomTitle.setText(bound ? "今晚，看一部好电影。" : accountUnbound ? "先找到一起看的人。" : "现在就开一场临时同看。");
        roomSubtitle.setText(bound
            ? "房间创建后自动发布到双人空间，视频停在 0 秒等待双方播放。"
            : accountUnbound
                ? "生成一次性邀请码绑定唯一好友；绑定后，房间和日历会自动出现在双方首页。"
                : "无需登录即可创建房间，复制邀请链接发给朋友，最多两个人一起看。\n");
        nicknameLabel.setVisibility(accountMode ? View.GONE : View.VISIBLE);
        nicknameInput.setVisibility(accountMode ? View.GONE : View.VISIBLE);
        if (bound) {
            roomPrimaryButton.setText("创建房间");
            roomPrimaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_play, 0, 0, 0);
            roomPrimaryButton.setOnClickListener(view -> listener.onCreateRoom());
            roomSecondaryButton.setText("加入房间");
            roomSecondaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_link, 0, 0, 0);
            roomSecondaryButton.setOnClickListener(view -> showJoinPanel());
        } else if (accountUnbound) {
            roomPrimaryButton.setText("管理账号与好友");
            roomPrimaryButton.setCompoundDrawablesWithIntrinsicBounds(0, 0, 0, 0);
            roomPrimaryButton.setOnClickListener(view -> listener.onAccountAction());
            roomSecondaryButton.setText("匿名房间");
            roomSecondaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_play, 0, 0, 0);
            roomSecondaryButton.setOnClickListener(view -> listener.onCreateRoom());
        } else {
            roomPrimaryButton.setText("创建房间");
            roomPrimaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_play, 0, 0, 0);
            roomPrimaryButton.setOnClickListener(view -> listener.onCreateRoom());
            roomSecondaryButton.setText("加入房间");
            roomSecondaryButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_link, 0, 0, 0);
            roomSecondaryButton.setOnClickListener(view -> showJoinPanel());
        }
        roomPrimaryButton.setCompoundDrawablePadding(components.dp(8));
        roomSecondaryButton.setCompoundDrawablePadding(components.dp(8));
        components.applyTheme(root);
    }

    public View getView() {
        return root;
    }

    public EditText getNicknameInput() {
        return nicknameInput;
    }

    public EditText getInviteInput() {
        return inviteInput;
    }

    public Button getCreateButton() {
        return createButton;
    }

    public Button getJoinButton() {
        return joinButton;
    }

    public Button getContinueButton() {
        return continueButton;
    }

    public ImageButton getThemeButton() {
        return themeButton;
    }

    public TextView getConnectionText() {
        return connectionText;
    }

    public void setAccountState(String nickname, String email) {
        accountMode = true;
        ownAvatar.setText(initial(nickname));
        modeText.setText("● 已登录");
        accountText.setText(nickname + " · " + email);
        accountButton.setText("管理账号与好友");
        nicknameInput.setText(nickname);
        updateRoomCard();
    }

    public void setPairState(AccountModels.Pair pair) {
        currentPair = pair;
        if (pair == null) {
            peerAvatar.setText("友");
            presenceSummary.setText("尚未绑定好友");
            updateRoomCard();
            return;
        }
        peerAvatar.setText(initial(pair.partner.nickname));
        presenceSummary.setText("与 " + pair.partner.nickname + " 已连接");
        modeText.setText("● 双人空间");
        updateRoomCard();
    }

    private static String initial(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? "同" : normalized.substring(0, 1).toUpperCase(Locale.ROOT);
    }

    public void setAnonymousState() {
        setAnonymousState(false, null);
    }

    public void setAnonymousState(boolean hasSavedAccount, String nickname) {
        accountMode = false;
        currentPair = null;
        ownAvatar.setText("我");
        peerAvatar.setText("友");
        presenceSummary.setText("最多 2 人");
        modeText.setText("● 匿名模式");
        accountText.setText(hasSavedAccount ? "账号仍安全保留，可随时返回" : "房间功能无需登录即可使用");
        accountButton.setText(hasSavedAccount ? "返回 " + nickname + " 的账号" : "登录账号");
        setActiveRoom(null, false);
        clearTodayState();
        updateRoomCard();
    }

    public void setTodayState(
        AccountModels.CalendarSnapshot snapshot,
        String date,
        boolean loading,
        String errorMessage
    ) {
        todayList.removeAllViews();
        todayRetryButton.setVisibility(View.GONE);
        List<AccountModels.CalendarPlan> plans = State.plannedForDate(snapshot, date);
        if (loading && plans.isEmpty()) {
            todayStateText.setText("正在同步今天的共同计划…");
            todayPanel.setVisibility(View.VISIBLE);
            components.applyTheme(todayPanel);
            return;
        }
        if (errorMessage != null && !errorMessage.trim().isEmpty() && plans.isEmpty()) {
            todayStateText.setText(errorMessage.trim());
            todayRetryButton.setVisibility(View.VISIBLE);
            todayPanel.setVisibility(View.VISIBLE);
            components.applyTheme(todayPanel);
            return;
        }
        if (plans.isEmpty()) {
            todayStateText.setText("");
            todayPanel.setVisibility(View.GONE);
            return;
        }
        todayStateText.setText(String.format(Locale.ROOT, "%s · %d 项待看", date, plans.size()));
        for (AccountModels.CalendarPlan plan : plans) {
            LinearLayout row = components.row();
            LinearLayout copy = components.column(0, 0, 0);
            copy.addView(components.section(State.timeLabel(plan.startTime) + " · " + plan.media.title), components.matchWrap());
            copy.addView(components.body(plan.note == null ? "还没有备注" : plan.note), components.margin(components.matchWrap(), 0, 4, 0, 0));
            row.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            Button play = components.button("开始", true);
            play.setOnClickListener(view -> listener.onPlayTodayPlan(plan));
            row.addView(play, components.margin(new LinearLayout.LayoutParams(components.dp(82), components.dp(46)), 10, 0, 0, 0));
            todayList.addView(row, components.margin(components.matchWrap(), 0, 10, 0, 0));
        }
        todayPanel.setVisibility(View.VISIBLE);
        components.applyTheme(todayPanel);
    }

    public void clearTodayState() {
        todayList.removeAllViews();
        todayStateText.setText("");
        todayRetryButton.setVisibility(View.GONE);
        todayPanel.setVisibility(View.GONE);
    }
    public void setActiveRoom(AccountModels.ActiveRoom room, boolean joining) {

        if (room == null) {
            activeRoomPanel.setVisibility(View.GONE);
            activeRoomButton.setEnabled(false);
            return;
        }
        long remainingMinutes = Math.max(1, (room.expiresAt - System.currentTimeMillis() + 59_999L) / 60_000L);
        activeRoomTitle.setText(room.host.nickname + " 正在等你一起看");
        activeRoomBody.setText("点击直接进入房间，无需复制链接 · 约 " + remainingMinutes + " 分钟内有效");
        activeRoomButton.setText(joining ? "正在加入…" : "进入 " + room.host.nickname + " 的房间");
        activeRoomButton.setEnabled(!joining);
        activeRoomPanel.setVisibility(View.VISIBLE);
        components.applyTheme(activeRoomPanel);
    }

    public void showJoinPanel() {
        joinPanel.setVisibility(View.VISIBLE);
        inviteInput.requestFocus();
    }

    public static final class State {
        private State() {}

        public static List<AccountModels.CalendarPlan> plannedForDate(AccountModels.CalendarSnapshot snapshot, String date) {
            if (snapshot == null || !AccountModels.isCalendarDate(date)) return Collections.emptyList();
            List<AccountModels.CalendarPlan> plans = new ArrayList<>(snapshot.plansForDate(date, true));
            plans.sort(AccountModels.CalendarPlan.DISPLAY_ORDER);
            return plans;
        }

        public static String timeLabel(String startTime) {
            return startTime == null || startTime.trim().isEmpty() ? "当天" : startTime;
        }
    }
    public void applyTheme() {
        components.applyTheme(root);
        themeButton.setImageResource(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
        themeButton.setContentDescription(theme.isDark() ? "切换浅色主题" : "切换深色主题");
        nicknameInput.setCompoundDrawableTintList(ColorStateList.valueOf(theme.muted()));
        inviteInput.setCompoundDrawableTintList(ColorStateList.valueOf(theme.muted()));
    }
}
