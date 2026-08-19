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

public final class HomeScreen {
    public interface Listener {
        void onToggleTheme();
        void onCreateRoom();
        void onJoinRoom();
        void onPasteInvite();
        void onRestoreRoom();
        void onAccountAction();
        void onJoinActiveRoom();
    }

    private final BreathTheme theme;
    private final BreathComponents components;
    private final ScrollView root;
    private final EditText nicknameInput;
    private final EditText inviteInput;
    private final Button createButton;
    private final Button joinButton;
    private final Button continueButton;
    private final ImageButton themeButton;
    private final TextView connectionText;
    private final TextView modeText;
    private final TextView accountText;
    private final Button accountButton;
    private final LinearLayout activeRoomPanel;
    private final TextView activeRoomTitle;
    private final TextView activeRoomBody;
    private final Button activeRoomButton;
    private final LinearLayout joinPanel;

    public HomeScreen(Context context, BreathTheme theme, String quote, String quoteSource, Listener listener) {
        this.theme = theme;
        this.components = new BreathComponents(context, theme);
        root = components.screen();
        LinearLayout content = components.column(21, 22, 26);
        root.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout header = components.row();
        LinearLayout headerCopy = components.column(0, 0, 0);
        headerCopy.addView(components.code("01 / NOW"), components.matchWrap());
        headerCopy.addView(components.title("一起看", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        headerCopy.addView(components.body("连接状态、房间操作与今天想看都在这里。"), components.margin(components.matchWrap(), 0, 8, 0, 0));
        header.addView(headerCopy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        themeButton = components.iconButton(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon, theme.isDark() ? "切换浅色主题" : "切换深色主题");
        themeButton.setOnClickListener(view -> listener.onToggleTheme());
        header.addView(themeButton, new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
        content.addView(header, components.matchWrap());

        LinearLayout presence = components.panel(16);
        LinearLayout people = components.row();
        TextView ownAvatar = components.avatar("我", false);
        people.addView(ownAvatar, new LinearLayout.LayoutParams(components.dp(40), components.dp(40)));
        View link = components.divider();
        LinearLayout.LayoutParams linkParams = new LinearLayout.LayoutParams(0, components.dp(1), 1f);
        linkParams.setMargins(components.dp(12), 0, components.dp(12), 0);
        people.addView(link, linkParams);
        TextView peerAvatar = components.avatar("友", true);
        people.addView(peerAvatar, new LinearLayout.LayoutParams(components.dp(40), components.dp(40)));
        presence.addView(people, components.matchWrap());
        LinearLayout presenceCopy = components.row();
        modeText = components.text("● 匿名模式", 11, BreathComponents.ROLE_ACCENT_TEXT);
        presenceCopy.addView(modeText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView limit = components.text("最多 2 人", 11, BreathComponents.ROLE_MUTED_TEXT);
        limit.setGravity(Gravity.END);
        presenceCopy.addView(limit, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        presence.addView(presenceCopy, components.margin(components.matchWrap(), 0, 12, 0, 0));
        accountText = components.text("房间功能无需登录即可使用", 11, BreathComponents.ROLE_MUTED_TEXT);
        presence.addView(accountText, components.margin(components.matchWrap(), 0, 7, 0, 0));
        accountButton = components.button("登录账号", false);
        accountButton.setOnClickListener(view -> listener.onAccountAction());
        presence.addView(accountButton, components.margin(components.matchHeight(46), 0, 12, 0, 0));
        content.addView(presence, components.margin(components.matchWrap(), 0, 22, 0, 0));

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
        roomTop.addView(components.code("ROOM / READY"), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView signal = components.text("● LOCAL FIRST", 10, BreathComponents.ROLE_ACCENT_TEXT);
        signal.setTypeface(Typeface.create("monospace", Typeface.BOLD));
        roomTop.addView(signal, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        roomCard.addView(roomTop, components.matchWrap());
        TextView quoteText = components.title(quote, 24);
        quoteText.setLineSpacing(0, 1.08f);
        roomCard.addView(quoteText, components.margin(components.matchWrap(), 0, 22, 0, 0));
        TextView sourceText = components.text(quoteSource, 11, BreathComponents.ROLE_MUTED_TEXT);
        roomCard.addView(sourceText, components.margin(components.matchWrap(), 0, 6, 0, 0));
        TextView nicknameLabel = components.code("你的昵称");
        roomCard.addView(nicknameLabel, components.margin(components.matchWrap(), 0, 20, 0, 8));
        nicknameInput = components.textInput("你的昵称");
        roomCard.addView(nicknameInput, components.matchHeight(52));
        LinearLayout actions = components.row();
        createButton = components.button("创建房间", true);
        createButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_play, 0, 0, 0);
        createButton.setCompoundDrawablePadding(components.dp(8));
        createButton.setOnClickListener(view -> listener.onCreateRoom());
        actions.addView(createButton, new LinearLayout.LayoutParams(0, components.dp(52), 1.25f));
        Button openJoinButton = components.button("加入房间", false);
        openJoinButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_link, 0, 0, 0);
        openJoinButton.setCompoundDrawablePadding(components.dp(8));
        openJoinButton.setOnClickListener(view -> showJoinPanel());
        LinearLayout.LayoutParams joinActionParams = new LinearLayout.LayoutParams(0, components.dp(52), 0.9f);
        joinActionParams.setMargins(components.dp(9), 0, 0, 0);
        actions.addView(openJoinButton, joinActionParams);
        roomCard.addView(actions, components.margin(components.matchWrap(), 0, 18, 0, 0));
        content.addView(roomCard, components.margin(components.matchWrap(), 0, 12, 0, 0));

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

        LinearLayout metrics = components.row();
        addMetric(metrics, context, "0", "云端记录");
        addMetric(metrics, context, "2", "房间上限");
        addMetric(metrics, context, "0 秒", "等待播放");
        content.addView(metrics, components.margin(components.matchWrap(), 0, 20, 0, 0));
        applyTheme();
    }

    private void addMetric(LinearLayout row, Context context, String value, String label) {
        LinearLayout item = components.column(10, 13, 13);
        item.addView(components.title(value, 18), components.matchWrap());
        item.addView(components.text(label, 10, BreathComponents.ROLE_MUTED_TEXT), components.margin(components.matchWrap(), 0, 5, 0, 0));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        row.addView(item, params);
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
        modeText.setText("● 已登录");
        accountText.setText(nickname + " · " + email);
        accountButton.setText("管理账号与好友");
        nicknameInput.setText(nickname);
    }

    public void setAnonymousState() {
        setAnonymousState(false, null);
    }

    public void setAnonymousState(boolean hasSavedAccount, String nickname) {
        modeText.setText("● 匿名模式");
        accountText.setText(hasSavedAccount ? "账号仍安全保留，可随时返回" : "房间功能无需登录即可使用");
        accountButton.setText(hasSavedAccount ? "返回 " + nickname + " 的账号" : "登录账号");
        setActiveRoom(null, false);
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

    public void applyTheme() {
        components.applyTheme(root);
        themeButton.setImageResource(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
        themeButton.setContentDescription(theme.isDark() ? "切换浅色主题" : "切换深色主题");
        nicknameInput.setCompoundDrawableTintList(ColorStateList.valueOf(theme.muted()));
        inviteInput.setCompoundDrawableTintList(ColorStateList.valueOf(theme.muted()));
    }
}
