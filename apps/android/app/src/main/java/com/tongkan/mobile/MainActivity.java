package com.tongkan.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.net.http.SslError;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.SeekBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.view.WindowManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Locale;
import java.lang.Thread;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity implements RoomClient.Listener, PlayerJavascriptBridge.Listener {
    private static final String PREFS = "tongkan_android";
    private static final String PUBLIC_ORIGIN = "https://tongkan-personal.pages.dev";

    private final ExecutorService background = Executors.newSingleThreadExecutor();
    private SharedPreferences preferences;
    private EditText nicknameInput;
    private EditText inviteInput;
    private EditText videoInput;
    private TextView roomText;
    private TextView connectionText;
    private TextView timeText;
    private TextView playerHint;
    private Button createButton;
    private Button joinButton;
    private ImageButton shareButton;
    private Button loadVideoButton;
    private Button playPauseButton;
    private SeekBar seekBar;
    private WebView webView;
    private RoomClient roomClient;
    private PlaybackAnchor latestAnchor;
    private BilibiliMedia loadedMedia;
    private String playerBridgeScript;
    private String currentRoomId;
    private String currentKey;
    private String currentRole;
    private String currentInviteKey;
    private boolean authenticated;
    private boolean playerReady;
    private boolean userSeeking;
    private double durationSeconds;
    private double currentPositionSeconds;
    private boolean playerPaused = true;
    private boolean playerEnded;
    private boolean playerBuffering;
    private volatile boolean loadingVideo;
    private int readyState;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private FrameLayout rootContainer;
    private FrameLayout htmlFullscreenContainer;
    private LinearLayout rootLayout;
    private LinearLayout entrySection;
    private ScrollView entryScroll;
    private LinearLayout videoSection;
    private LinearLayout preparationPanel;
    private FrameLayout playerContainer;
    private TextView entryConnectionText;
    private TextView videoConnectionText;
    private Button continueButton;
    private ImageButton entryThemeButton;
    private Button cancelPreparationButton;
    private ImageButton moreButton;
    private Button danmakuButton;
    private Button speedButton;
    private Button orientationButton;
    private Button fullscreenButton;
    private View videoHeader;
    private View videoFooter;
    private View htmlFullscreenView;
    private WebChromeClient.CustomViewCallback htmlFullscreenCallback;
    private BilibiliMedia roomMedia;
    private BilibiliMedia pendingMediaToBroadcast;
    private boolean preparingLocalVideo;
    private boolean awaitingMediaConfirmation;
    private boolean pendingAutoShare;
    private boolean darkMode;
    private boolean danmakuVisible;
    private boolean appFullscreen;
    private double selectedPlaybackRate = 1.0;
    private long loadingGeneration;
    private int systemInsetTop;
    private int systemInsetBottom;
    private FrameLayout immersiveControls;
    private View immersiveTapLayer;
    private ImageButton immersivePlayButton;
    private ImageButton immersiveCenterPlayButton;
    private Button immersiveDanmakuButton;
    private Button immersiveSpeedButton;
    private SeekBar immersiveSeekBar;
    private TextView immersiveTimeText;
    private boolean immersiveControlsVisible;
    private final Runnable hideImmersiveControls = () -> setImmersiveControlsVisible(false, false);

    private static final String[][] DAILY_QUOTES = {
        {"生活就像一盒巧克力，你永远不知道下一颗是什么味道。", "《阿甘正传》"},
        {"希望是美好的，也许是人间至善。", "《肖申克的救赎》"},
        {"愿原力与你同在。", "《星球大战》"},
        {"我们一路奋战，不是为了改变世界，而是不让世界改变我们。", "《熔炉》"},
        {"有些鸟儿是关不住的，它们的羽毛太鲜亮。", "《肖申克的救赎》"},
        {"重要的不是你去哪里，而是和谁一起。", "《飞屋环游记》"},
        {"明天又是新的一天。", "《乱世佳人》"},
        {"人生不能像做菜，把所有材料都准备好了才下锅。", "《饮食男女》"},
        {"当你决定出发，最困难的部分已经结束。", "《白日梦想家》"},
        {"死亡不是生命的终点，遗忘才是。", "《寻梦环游记》"},
        {"如果再也不能见到你，祝你早安、午安、晚安。", "《楚门的世界》"},
        {"不管前方的路有多苦，只要方向正确，就比站在原地更接近幸福。", "《千与千寻》"}
    };
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(null);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        darkMode = preferences.getBoolean("darkMode", false);
        danmakuVisible = preferences.getBoolean("danmakuVisible", true);
        playerBridgeScript = readAsset("bilibili-player-bridge.js");
        buildInterface();
        configureWebView();

        nicknameInput.setText(preferences.getString("nickname", "我"));
        showEntryScreen();
        String deepLink = getIntent().getDataString();
        if (deepLink != null && InviteInfo.parse(deepLink) != null) {
            inviteInput.setText(deepLink);
            joinInvite(deepLink);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.remove("android:views");
    }

    @Override
    protected void onNewIntent(Intent intent) {

        setIntent(intent);
        String deepLink = intent.getDataString();
        if (deepLink != null) {
            inviteInput.setText(deepLink);
            joinInvite(deepLink);
        }
    }

    @Override
    protected void onDestroy() {
        if (roomClient != null) roomClient.close();
        background.shutdownNow();
        mainHandler.removeCallbacksAndMessages(null);
        hideHtmlFullscreen();
        if (webView != null) {
            webView.removeJavascriptInterface("TongkanAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    private void buildInterface() {
        rootContainer = new FrameLayout(this);
        rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootContainer.addView(rootLayout, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        entryScroll = new ScrollView(this);
        entryScroll.setFillViewport(true);
        entryScroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        entrySection = new LinearLayout(this);
        entrySection.setOrientation(LinearLayout.VERTICAL);
        entrySection.setPadding(dp(20), dp(20), dp(20), dp(24));
        entrySection.setTag("screen");
        entryScroll.addView(entrySection, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        rootLayout.addView(entryScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        htmlFullscreenContainer = new FrameLayout(this);
        htmlFullscreenContainer.setBackgroundColor(Color.BLACK);
        htmlFullscreenContainer.setVisibility(View.GONE);
        rootContainer.addView(htmlFullscreenContainer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout entryHeader = horizontal();
        TextView title = text("同看", 24, Color.BLACK);
        title.setTag("primaryText");
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        entryHeader.addView(title, weight(1));
        entryThemeButton = iconButton(R.drawable.ic_theme_moon, "切换深色主题");
        entryThemeButton.setOnClickListener(view -> toggleTheme());
        entryHeader.addView(entryThemeButton, new LinearLayout.LayoutParams(dp(48), dp(48)));
        entrySection.addView(entryHeader, matchWrap());

        String[] dailyQuote = dailyQuote();
        TextView quoteLabel = text("今日台词", 12, Color.DKGRAY);
        quoteLabel.setTag("secondaryText");
        entrySection.addView(quoteLabel, margin(matchWrap(), 0, 28, 0, 0));
        TextView quoteText = text(dailyQuote[0], 27, Color.BLACK);
        quoteText.setTag("primaryText");
        quoteText.setTypeface(Typeface.SERIF, Typeface.BOLD);
        quoteText.setLineSpacing(dp(3), 1.08f);
        entrySection.addView(quoteText, margin(matchWrap(), 0, 8, 0, 0));
        TextView quoteSource = text(dailyQuote[1], 13, Color.DKGRAY);
        quoteSource.setTag("secondaryText");
        entrySection.addView(quoteSource, margin(matchWrap(), 0, 8, 0, 0));

        TextView createTitle = text("创建一个房间", 18, Color.BLACK);
        createTitle.setTag("primaryText");
        createTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        entrySection.addView(createTitle, margin(matchWrap(), 0, 28, 0, 0));
        entrySection.addView(label("你的昵称"), margin(matchWrap(), 0, 12, 0, 0));
        nicknameInput = edit("你的昵称");
        nicknameInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
        entrySection.addView(nicknameInput, margin(matchHeight(52), 0, 7, 0, 0));
        createButton = button("创建房间", true);
        createButton.setOnClickListener(view -> createRoom());
        entrySection.addView(createButton, margin(matchHeight(52), 0, 8, 0, 0));

        entrySection.addView(divider("或者"), margin(matchHeight(34), 0, 18, 0, 0));
        TextView joinTitle = text("加入朋友的房间", 18, Color.BLACK);
        joinTitle.setTag("primaryText");
        joinTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        entrySection.addView(joinTitle, margin(matchWrap(), 0, 6, 0, 0));
        entrySection.addView(label("邀请链接"), margin(matchWrap(), 0, 12, 0, 0));
        LinearLayout inviteRow = horizontal();
        inviteInput = edit("粘贴朋友发来的邀请链接");
        inviteRow.addView(inviteInput, weight(1));
        Button pasteButton = button("粘贴", false);
        pasteButton.setOnClickListener(view -> pasteInviteFromClipboard());
        inviteRow.addView(pasteButton, margin(new LinearLayout.LayoutParams(dp(72), ViewGroup.LayoutParams.MATCH_PARENT), 8, 0, 0, 0));
        entrySection.addView(inviteRow, matchHeight(52));
        joinButton = button("加入房间", false);
        joinButton.setOnClickListener(view -> joinInvite(inviteInput.getText().toString()));
        entrySection.addView(joinButton, margin(matchHeight(52), 0, 8, 0, 0));
        continueButton = textButton("继续上次房间  ›");
        continueButton.setOnClickListener(view -> restoreLastRoom());
        entrySection.addView(continueButton, margin(matchHeight(52), 0, 14, 0, 0));

        entryConnectionText = text("创建房间，或粘贴邀请链接加入", 13, Color.DKGRAY);
        entryConnectionText.setTag("secondaryText");
        entryConnectionText.setGravity(Gravity.CENTER_HORIZONTAL);
        entrySection.addView(entryConnectionText, margin(matchWrap(), 0, 14, 0, 0));
        TextView privacyNote = text("临时私人房间 · 最多两个人", 11, Color.DKGRAY);
        privacyNote.setTag("secondaryText");
        privacyNote.setGravity(Gravity.CENTER_HORIZONTAL);
        entrySection.addView(privacyNote, margin(matchWrap(), 0, 10, 0, 0));

        videoSection = new LinearLayout(this);
        videoSection.setOrientation(LinearLayout.VERTICAL);
        videoSection.setPadding(dp(16), dp(12), dp(16), dp(12));
        videoSection.setTag("screen");
        videoSection.setVisibility(View.GONE);
        rootLayout.addView(videoSection, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout header = horizontal();
        videoHeader = header;
        ImageButton backButton = iconButton(R.drawable.ic_arrow_back, "返回");
        backButton.setOnClickListener(view -> onBackPressed());
        header.addView(backButton, new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout roomColumn = new LinearLayout(this);
        roomColumn.setOrientation(LinearLayout.VERTICAL);
        roomColumn.setPadding(dp(10), 0, 0, 0);
        roomText = text("正在进入房间", 16, Color.BLACK);
        roomText.setTag("primaryText");
        roomText.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        roomColumn.addView(roomText, matchWrap());
        videoConnectionText = text("正在连接…", 12, Color.DKGRAY);
        videoConnectionText.setTag("secondaryText");
        roomColumn.addView(videoConnectionText, margin(matchWrap(), 0, 2, 0, 0));
        header.addView(roomColumn, weight(1));
        shareButton = iconButton(R.drawable.ic_share, "分享房间");
        shareButton.setEnabled(false);
        shareButton.setOnClickListener(view -> shareInvite());
        header.addView(shareButton, new LinearLayout.LayoutParams(dp(48), dp(48)));
        moreButton = iconButton(R.drawable.ic_more, "更多操作");
        moreButton.setOnClickListener(this::showVideoMenu);
        header.addView(moreButton, margin(new LinearLayout.LayoutParams(dp(48), dp(48)), 8, 0, 0, 0));
        videoSection.addView(header, matchWrap());

        preparationPanel = card();
        videoSection.addView(preparationPanel, margin(matchWrap(), 0, 12, 0, 0));
        TextView preparationTitle = text("准备视频", 18, Color.BLACK);
        preparationTitle.setTag("primaryText");
        preparationTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        preparationPanel.addView(preparationTitle, matchWrap());
        TextView preparationDescription = text("粘贴链接后先在本机验证，成功后再让两边一起切换。", 13, Color.DKGRAY);
        preparationDescription.setTag("secondaryText");
        preparationPanel.addView(preparationDescription, margin(matchWrap(), 0, 4, 0, 0));
        preparationPanel.addView(label("B站视频链接"), margin(matchWrap(), 0, 16, 0, 0));
        videoInput = edit("BV、av 或 b23.tv 链接");
        preparationPanel.addView(videoInput, margin(matchHeight(52), 0, 8, 0, 0));
        loadVideoButton = button("准备视频", true);
        loadVideoButton.setOnClickListener(view -> loadVideoFromInput());
        preparationPanel.addView(loadVideoButton, margin(matchHeight(52), 0, 12, 0, 0));
        cancelPreparationButton = button("取消准备", false);
        cancelPreparationButton.setVisibility(View.GONE);
        cancelPreparationButton.setOnClickListener(view -> cancelVideoPreparation("已取消准备"));
        preparationPanel.addView(cancelPreparationButton, margin(matchHeight(48), 0, 8, 0, 0));

        playerContainer = new FrameLayout(this);
        playerContainer.setBackgroundColor(Color.BLACK);
        playerContainer.setVisibility(View.GONE);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        playerContainer.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        buildImmersiveControls();
        LinearLayout.LayoutParams playerLayout = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220));
        playerLayout.gravity = Gravity.CENTER_HORIZONTAL;
        videoSection.addView(playerContainer, margin(playerLayout, 0, 12, 0, 0));

        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.VERTICAL);
        videoFooter = footer;
        playerHint = text("房间还没有视频", 12, Color.DKGRAY);
        playerHint.setTag("secondaryText");
        playerHint.setGravity(Gravity.CENTER_HORIZONTAL);
        footer.addView(playerHint, matchWrap());

        LinearLayout timeRow = horizontal();
        timeText = text("00:00 / 00:00", 13, Color.BLACK);
        timeText.setTag("primaryText");
        timeText.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        timeRow.addView(timeText, weight(1));
        footer.addView(timeRow, margin(matchHeight(28), 0, 8, 0, 0));

        seekBar = new SeekBar(this);
        configureSeekBar(seekBar);
        footer.addView(seekBar, matchHeight(36));

        playPauseButton = button("播放", true);
        setButtonIcon(playPauseButton, R.drawable.ic_play);
        playPauseButton.setEnabled(false);
        playPauseButton.setOnClickListener(view -> togglePlayback());
        footer.addView(playPauseButton, margin(matchHeight(52), 0, 8, 0, 0));

        LinearLayout tools = horizontal();
        danmakuButton = button("弹幕 开", false);
        setButtonIcon(danmakuButton, R.drawable.ic_danmaku);
        danmakuButton.setOnClickListener(view -> toggleDanmaku());
        tools.addView(danmakuButton, weight(1));
        speedButton = button("1.0×", false);
        setButtonIcon(speedButton, R.drawable.ic_speed);
        speedButton.setOnClickListener(view -> showSpeedDialog());
        tools.addView(speedButton, margin(weight(1), 8, 0, 0, 0));
        orientationButton = button("横屏", false);
        setButtonIcon(orientationButton, R.drawable.ic_rotate);
        orientationButton.setOnClickListener(view -> toggleOrientation());
        tools.addView(orientationButton, margin(weight(1), 8, 0, 0, 0));
        fullscreenButton = button("全屏", false);
        setButtonIcon(fullscreenButton, R.drawable.ic_fullscreen);
        fullscreenButton.setOnClickListener(view -> toggleAppFullscreen());
        tools.addView(fullscreenButton, margin(weight(1), 8, 0, 0, 0));
        footer.addView(tools, margin(matchHeight(64), 0, 10, 0, 0));
        videoSection.addView(footer, matchWrap());

        applyTheme();
        setContentView(rootContainer);
        rootContainer.setOnApplyWindowInsetsListener((view, insets) -> {
            systemInsetTop = insets.getSystemWindowInsetTop();
            systemInsetBottom = insets.getSystemWindowInsetBottom();
            applySafeAreaInsets();
            return insets;
        });
        rootContainer.requestApplyInsets();
    }

    private String[] dailyQuote() {
        int index = Math.floorMod((int) (LocalDate.now().toEpochDay() % DAILY_QUOTES.length), DAILY_QUOTES.length);
        return DAILY_QUOTES[index];
    }

    private void pasteInviteFromClipboard() {
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard == null || !clipboard.hasPrimaryClip() || clipboard.getPrimaryClip() == null || clipboard.getPrimaryClip().getItemCount() == 0) {
            Toast.makeText(this, "剪贴板里没有邀请链接", Toast.LENGTH_SHORT).show();
            return;
        }
        CharSequence value = clipboard.getPrimaryClip().getItemAt(0).coerceToText(this);
        inviteInput.setText(value == null ? "" : value.toString().trim());
        inviteInput.setSelection(inviteInput.length());
    }

    private LinearLayout divider(String label) {
        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        View left = new View(this);
        left.setTag("divider");
        row.addView(left, new LinearLayout.LayoutParams(0, dp(1), 1));
        TextView text = text(label, 12, Color.DKGRAY);
        text.setTag("secondaryText");
        text.setGravity(Gravity.CENTER);
        row.addView(text, new LinearLayout.LayoutParams(dp(54), ViewGroup.LayoutParams.MATCH_PARENT));
        View right = new View(this);
        right.setTag("divider");
        row.addView(right, new LinearLayout.LayoutParams(0, dp(1), 1));
        return row;
    }

    private Button textButton(String label) {
        Button view = button(label, false);
        view.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        view.setPadding(0, 0, 0, 0);
        view.setTag("textButton");
        return view;
    }

    private ImageButton iconButton(int drawableId, String description) {
        ImageButton view = new ImageButton(this);
        view.setImageResource(drawableId);
        view.setContentDescription(description);
        view.setPadding(dp(13), dp(13), dp(13), dp(13));
        view.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        view.setElevation(0);
        view.setStateListAnimator(null);
        view.setTag("iconButton");
        view.setBackground(iconButtonBackground());
        return view;
    }

    private StateListDrawable iconButtonBackground() {
        int normal = darkMode ? Color.rgb(23, 24, 25) : Color.WHITE;
        int pressed = darkMode ? Color.rgb(48, 50, 54) : Color.rgb(229, 229, 224);
        int border = darkMode ? Color.rgb(48, 50, 54) : Color.rgb(217, 217, 210);
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[] {android.R.attr.state_pressed}, rounded(pressed, border, 12));
        states.addState(new int[] {}, rounded(normal, border, 12));
        return states;
    }

    private void setButtonIcon(Button button, int drawableId) {
        android.graphics.drawable.Drawable drawable = getDrawable(drawableId).mutate();
        drawable.setBounds(0, 0, dp(18), dp(18));
        button.setCompoundDrawables(drawable, null, null, null);
        button.setCompoundDrawablePadding(dp(6));
    }

    private void tintButtonDrawables(Button button, int color) {
        for (android.graphics.drawable.Drawable drawable : button.getCompoundDrawables()) {
            if (drawable != null) drawable.setColorFilter(color, android.graphics.PorterDuff.Mode.SRC_IN);
        }
    }

    private void showVideoMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add("换视频");
        menu.getMenu().add(darkMode ? "切换浅色" : "切换深色");
        menu.getMenu().add("离开房间");
        menu.setOnMenuItemClickListener(item -> {
            String title = item.getTitle().toString();
            if ("换视频".equals(title)) {
                showPreparationPanel();
            } else if (title.startsWith("切换")) {
                toggleTheme();
            } else if ("离开房间".equals(title)) {
                confirmLeaveRoom();
            }
            return true;
        });
        menu.show();
    }

    private void buildImmersiveControls() {
        immersiveTapLayer = new View(this);
        immersiveTapLayer.setBackgroundColor(Color.TRANSPARENT);
        immersiveTapLayer.setVisibility(View.GONE);
        immersiveTapLayer.setOnClickListener(view -> setImmersiveControlsVisible(!immersiveControlsVisible, true));
        playerContainer.addView(immersiveTapLayer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        immersiveControls = new FrameLayout(this);
        immersiveControls.setVisibility(View.GONE);
        playerContainer.addView(immersiveControls, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ImageButton exitButton = iconButton(R.drawable.ic_arrow_back, "退出全屏");
        exitButton.setTag("immersiveIconButton");
        exitButton.setOnClickListener(view -> exitImmersiveViewing());
        FrameLayout.LayoutParams exitParams = new FrameLayout.LayoutParams(dp(48), dp(48), Gravity.TOP | Gravity.START);
        exitParams.setMargins(dp(16), dp(14), 0, 0);
        immersiveControls.addView(exitButton, exitParams);

        immersiveCenterPlayButton = iconButton(R.drawable.ic_play, "播放或暂停");
        immersiveCenterPlayButton.setTag("immersivePrimaryIcon");
        immersiveCenterPlayButton.setOnClickListener(view -> togglePlayback());
        FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(dp(62), dp(62), Gravity.CENTER);
        immersiveControls.addView(immersiveCenterPlayButton, centerParams);

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(dp(18), dp(12), dp(18), dp(12));
        bottom.setBackground(rounded(Color.argb(205, 0, 0, 0), Color.TRANSPARENT, 0));
        FrameLayout.LayoutParams bottomParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        immersiveControls.addView(bottom, bottomParams);

        LinearLayout immersiveTimeRow = horizontal();
        immersiveTimeText = text("00:00 / 00:00", 12, Color.WHITE);
        immersiveTimeText.setTextColor(Color.WHITE);
        immersiveTimeRow.addView(immersiveTimeText, weight(1));
        bottom.addView(immersiveTimeRow, matchHeight(24));

        immersiveSeekBar = new SeekBar(this);
        configureSeekBar(immersiveSeekBar);
        bottom.addView(immersiveSeekBar, matchHeight(34));

        LinearLayout actions = horizontal();
        actions.setGravity(Gravity.CENTER_VERTICAL);
        immersivePlayButton = iconButton(R.drawable.ic_play, "播放或暂停");
        immersivePlayButton.setTag("immersiveIconButton");
        immersivePlayButton.setOnClickListener(view -> togglePlayback());
        actions.addView(immersivePlayButton, new LinearLayout.LayoutParams(dp(48), dp(48)));
        immersiveDanmakuButton = button("弹幕 开", false);
        immersiveDanmakuButton.setTag("immersiveButton");
        immersiveDanmakuButton.setOnClickListener(view -> toggleDanmaku());
        actions.addView(immersiveDanmakuButton, margin(new LinearLayout.LayoutParams(dp(92), dp(48)), 10, 0, 0, 0));
        immersiveSpeedButton = button("1.0×", false);
        immersiveSpeedButton.setTag("immersiveButton");
        immersiveSpeedButton.setOnClickListener(view -> showSpeedDialog());
        actions.addView(immersiveSpeedButton, margin(new LinearLayout.LayoutParams(dp(78), dp(48)), 8, 0, 0, 0));
        View spacer = new View(this);
        actions.addView(spacer, weight(1));
        ImageButton exitFullscreen = iconButton(R.drawable.ic_exit_fullscreen, "退出全屏");
        exitFullscreen.setTag("immersiveIconButton");
        exitFullscreen.setOnClickListener(view -> exitImmersiveViewing());
        actions.addView(exitFullscreen, new LinearLayout.LayoutParams(dp(48), dp(48)));
        bottom.addView(actions, matchHeight(48));
    }

    private void configureSeekBar(SeekBar bar) {
        bar.setMax(1);
        bar.setEnabled(false);
        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar changed, int progress, boolean fromUser) {
                if (!fromUser) return;
                String value = formatTime(progress / 1000.0) + " / " + formatTime(durationSeconds);
                if (changed == seekBar && timeText != null) timeText.setText(value);
                if (changed == immersiveSeekBar && immersiveTimeText != null) immersiveTimeText.setText(value);
            }
            @Override public void onStartTrackingTouch(SeekBar changed) {
                userSeeking = true;
                setImmersiveControlsVisible(true, false);
            }
            @Override public void onStopTrackingTouch(SeekBar changed) {
                userSeeking = false;
                double target = changed.getProgress() / 1000.0;
                evaluatePlayer("window.__tongkanSeekTo && window.__tongkanSeekTo(" + target + ");");
                scheduleImmersiveControlsHide();
            }
        });
    }

    private void togglePlayback() {
        setImmersiveControlsVisible(true, false);
        evaluatePlayer("window.__tongkanTogglePlayback && window.__tongkanTogglePlayback();");
    }

    private void exitImmersiveViewing() {
        if (getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE) {
            toggleOrientation();
        } else if (appFullscreen) {
            toggleAppFullscreen();
        }
    }

    private void setImmersiveControlsVisible(boolean visible, boolean scheduleHide) {
        mainHandler.removeCallbacks(hideImmersiveControls);
        immersiveControlsVisible = visible && appFullscreen;
        if (immersiveControls != null) immersiveControls.setVisibility(immersiveControlsVisible ? View.VISIBLE : View.GONE);
        if (scheduleHide && immersiveControlsVisible) scheduleImmersiveControlsHide();
    }

    private void scheduleImmersiveControlsHide() {
        mainHandler.removeCallbacks(hideImmersiveControls);
        if (appFullscreen && !playerPaused && !playerEnded && !playerBuffering && !userSeeking && !loadingVideo) {
            mainHandler.postDelayed(hideImmersiveControls, 3000);
        }
    }

    private void updatePlaybackButtons(boolean paused, boolean ended) {
        boolean showPlay = paused || ended;
        int icon = showPlay ? R.drawable.ic_play : R.drawable.ic_pause;
        playPauseButton.setText(showPlay ? "播放" : "暂停");
        setButtonIcon(playPauseButton, icon);
        if (immersivePlayButton != null) {
            immersivePlayButton.setImageResource(icon);
            immersivePlayButton.setContentDescription(showPlay ? "播放" : "暂停");
        }
        if (immersiveCenterPlayButton != null) {
            immersiveCenterPlayButton.setImageResource(icon);
            immersiveCenterPlayButton.setContentDescription(showPlay ? "播放" : "暂停");
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new PlayerJavascriptBridge(this), "TongkanAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (htmlFullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                htmlFullscreenView = view;
                htmlFullscreenCallback = callback;
                htmlFullscreenContainer.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                htmlFullscreenContainer.setVisibility(View.VISIBLE);
                rootLayout.setVisibility(View.GONE);
                applyImmersiveMode(true);
            }

            @Override
            public void onHideCustomView() {
                hideHtmlFullscreen();
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request != null && !request.isForMainFrame()) return;
                loadingVideo = false;
                preparingLocalVideo = false;
                awaitingMediaConfirmation = false;
                setPreparationControlsEnabled(true);
                playerHint.setText("播放器加载失败，请重新准备视频");
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!isTrustedPlayerUrl(url)) return;
                playerReady = false;
                playerHint.setText(preparingLocalVideo ? "正在准备视频…" : "正在更换视频…");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!isTrustedPlayerUrl(url)) return;
                playerHint.setText("正在确认播放器…");
                view.evaluateJavascript(playerBridgeScript, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !isTrustedPlayerUrl(url) && !"about:blank".equals(url);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                loadingVideo = false;
                playerHint.setText("B站播放器证书校验失败");
            }
        });
    }

    private void createRoom() {
        String nickname = normalizedNickname();
        createButton.setEnabled(false);
        createButton.setText("正在创建…");
        setConnectionStatus("正在创建房间…");
        background.execute(() -> {
            try {
                RoomClient.CreateRoomResult result = RoomClient.createRoom();
                runOnUiThread(() -> {
                    createButton.setEnabled(true);
                    createButton.setText("创建房间");
                    pendingAutoShare = true;
                    connectIdentity(result.roomId, result.hostKey, "host", result.inviteKey, nickname);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    createButton.setEnabled(true);
                    createButton.setText("创建房间");
                    showError("创建房间失败，请检查网络后重试");
                });
            }
        });
    }

    private void joinInvite(String value) {
        InviteInfo invite = InviteInfo.parse(value);
        if (invite == null) {
            showError("邀请链接无效，请完整粘贴包含 #join= 的链接");
            return;
        }
        joinButton.setEnabled(false);
        joinButton.setText("正在加入…");
        connectIdentity(invite.roomId, invite.key, invite.role, null, normalizedNickname());
    }

    private void connectIdentity(String roomId, String key, String role, String inviteKey, String nickname) {
        if (roomClient != null) roomClient.close();
        currentRoomId = roomId;
        currentKey = key;
        currentRole = role;
        currentInviteKey = inviteKey;
        authenticated = false;
        showVideoScreen();
        roomText.setText("房间 " + roomId.substring(0, 8) + " · " + ("host".equals(role) ? "房主" : "朋友"));
        setConnectionStatus("正在连接房间…");
        shareButton.setEnabled(inviteKey != null && !inviteKey.isEmpty());
        preferences.edit()
            .putString("nickname", nickname)
            .putString("roomId", roomId)
            .putString("key", key)
            .putString("role", role)
            .putString("inviteKey", inviteKey == null ? "" : inviteKey)
            .apply();
        roomClient = new RoomClient(roomId, key, nickname, this);
        roomClient.connect();
    }

    private void restoreLastRoom() {
        String roomId = preferences.getString("roomId", null);
        String key = preferences.getString("key", null);
        String role = preferences.getString("role", null);
        if (roomId == null || key == null || role == null) return;
        String inviteKey = preferences.getString("inviteKey", "");
        connectIdentity(roomId, key, role, inviteKey.isEmpty() ? null : inviteKey, normalizedNickname());
    }

    private void shareInvite() {
        if (currentRoomId == null || currentInviteKey == null) return;
        String url = PUBLIC_ORIGIN + "/room/" + currentRoomId + "#join=" + currentInviteKey;
        Intent share = new Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "加入我的同看房间")
            .putExtra(Intent.EXTRA_TEXT, "打开同看 App，一起看 B站视频：\n" + url);
        startActivity(Intent.createChooser(share, "分享房间邀请"));
    }

    private void loadVideoFromInput() {
        if (!authenticated || roomClient == null) {
            showError("请先连接房间，再准备视频");
            return;
        }
        if (loadingVideo) {
            showError("视频正在准备中，请稍候");
            return;
        }
        loadingVideo = true;
        preparingLocalVideo = true;
        awaitingMediaConfirmation = false;
        pendingMediaToBroadcast = null;
        loadingGeneration += 1;
        long generation = loadingGeneration;
        startLoadingTimeout(generation);
        setPreparationControlsEnabled(false);
        playerHint.setText("正在准备视频…");
        String input = videoInput.getText().toString();
        background.execute(() -> {
            BilibiliMedia media = BilibiliMedia.parse(input);
            if (media != null && media.unresolved) media = resolveShortLink(media.canonicalUrl);
            BilibiliMedia resolved = media;
            runOnUiThread(() -> {
                if (generation != loadingGeneration) return;
                if (resolved == null || resolved.embedUrl() == null) {
                    failVideoPreparation("没有识别到可播放的 B站视频，请检查链接");
                    return;
                }
                pendingMediaToBroadcast = resolved;
                playerContainer.setVisibility(View.VISIBLE);
                preparationPanel.setVisibility(View.GONE);
                loadMedia(resolved);
            });
        });
    }

    private BilibiliMedia resolveShortLink(String shortUrl) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(shortUrl).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36");
            connection.getResponseCode();
            return BilibiliMedia.parse(connection.getURL().toString());
        } catch (IOException ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void applySnapshot(JSONObject snapshot) {
        try {
            JSONObject playbackJson = snapshot.optJSONObject("playback");
            if (playbackJson != null) {
                PlaybackAnchor anchor = PlaybackAnchor.fromJson(playbackJson);
                applyAnchor(anchor, "房间");
            }
            JSONObject members = snapshot.optJSONObject("members");
            if (members != null) {
                boolean hostOnline = members.optJSONObject("host") != null && members.optJSONObject("host").optBoolean("connected");
                boolean guestOnline = members.optJSONObject("guest") != null && members.optJSONObject("guest").optBoolean("connected");
                int onlineCount = (hostOnline ? 1 : 0) + (guestOnline ? 1 : 0);
                setConnectionStatus(onlineCount >= 2 ? "双方在线 · 2 人" : "已连接 · 1 人在线，等待对方加入");
            }
        } catch (Exception error) {
            showError("房间状态格式异常: " + error.getMessage());
        }
    }

    private void applyAnchor(PlaybackAnchor anchor, String actorNickname) {
        BilibiliMedia previousRoomMedia = roomMedia;
        latestAnchor = anchor;
        roomMedia = anchor.media;
        if (anchor.media == null) {
            playerHint.setText("房间还没有视频");
            showPreparationPanel();
            return;
        }

        if (preparingLocalVideo && pendingMediaToBroadcast != null && previousRoomMedia != null
            && anchor.media.sameIdentity(previousRoomMedia)
            && !anchor.media.sameIdentity(pendingMediaToBroadcast)) {
            return;
        }

        videoInput.setText(anchor.media.canonicalUrl);
        playerContainer.setVisibility(View.VISIBLE);
        preparationPanel.setVisibility(View.GONE);
        updatePlayerAspectRatio();

        if (pendingMediaToBroadcast != null && anchor.media.sameIdentity(pendingMediaToBroadcast)) {
            preparingLocalVideo = false;
            awaitingMediaConfirmation = false;
            pendingMediaToBroadcast = null;
            loadingVideo = false;
            setPreparationControlsEnabled(true);
        }

        if (loadedMedia == null || !loadedMedia.sameIdentity(anchor.media)) {
            loadingVideo = true;
            preparingLocalVideo = false;
            awaitingMediaConfirmation = false;
            pendingMediaToBroadcast = null;
            playerHint.setText("对方正在更换视频…");
            loadMedia(anchor.media);
            return;
        }
        if (playerReady) applyLatestAnchorToPlayer();
        updateSpeedButton(anchor.playbackRate);
        playerHint.setText((anchor.paused ? "已暂停" : "正在播放") + " · 操作来自 " + actorNickname);
        setPlaybackControlsEnabled(playerReady && !awaitingMediaConfirmation);
    }

    private void loadMedia(BilibiliMedia media) {
        String embedUrl = media.embedUrl();
        if (embedUrl == null) {
            failVideoPreparation("这个 B站链接还没有解析成功");
            return;
        }
        loadedMedia = media;
        playerReady = false;
        playerPaused = true;
        playerEnded = false;
        playerBuffering = false;
        currentPositionSeconds = 0;
        durationSeconds = 0;
        updatePlaybackButtons(true, false);
        seekBar.setProgress(0);
        immersiveSeekBar.setProgress(0);
        timeText.setText("00:00 / 00:00");
        immersiveTimeText.setText("00:00 / 00:00");
        setPlaybackControlsEnabled(false);
        if (appFullscreen) setImmersiveControlsVisible(true, false);
        playerContainer.setVisibility(View.VISIBLE);
        updatePlayerAspectRatio();
        playerHint.setText(preparingLocalVideo ? "正在准备视频…" : "正在载入房间视频…");
        webView.loadUrl(embedUrl);
    }

    private void applyLatestAnchorToPlayer() {
        if (latestAnchor == null || roomClient == null || !playerReady || loadedMedia == null || latestAnchor.media == null || !loadedMedia.sameIdentity(latestAnchor.media)) return;
        try {
            String script = "window.__tongkanApplyAnchor && window.__tongkanApplyAnchor("
                + latestAnchor.toJson().toString() + "," + roomClient.serverNow() + ");";
            evaluatePlayer(script);
        } catch (JSONException error) {
            showError("无法向播放器应用房间状态");
        }
    }

    private void evaluatePlayer(String script) {
        if (playerReady) webView.evaluateJavascript(script, null);
    }

    @Override
    public void onConnectionState(String state) {
        runOnUiThread(() -> setConnectionStatus(state));
    }

    @Override
    public void onAuthenticated(String ownMemberId, JSONObject snapshot) {
        runOnUiThread(() -> {
            authenticated = true;
            joinButton.setEnabled(true);
            joinButton.setText("加入房间");
            showVideoScreen();
            applySnapshot(snapshot);
            if (pendingAutoShare) {
                pendingAutoShare = false;
                mainHandler.postDelayed(this::shareInvite, 350);
            }
        });
    }

    @Override
    public void onSnapshot(JSONObject snapshot) {
        runOnUiThread(() -> applySnapshot(snapshot));
    }

    @Override
    public void onAnchor(PlaybackAnchor anchor, String actorNickname) {
        runOnUiThread(() -> applyAnchor(anchor, actorNickname));
    }

    @Override
    public void onError(String message) {
        runOnUiThread(() -> showError(message));
    }

    @Override
    public void onPlayerReady() {
        runOnUiThread(() -> {
            playerReady = true;
            playerBuffering = false;
            webView.evaluateJavascript("window.__tongkanSetDanmakuVisible && window.__tongkanSetDanmakuVisible(" + danmakuVisible + ");", null);
            updatePlaybackButtons(playerPaused, playerEnded);
            if (!preparingLocalVideo && !awaitingMediaConfirmation) {
                loadingVideo = false;
                setPlaybackControlsEnabled(true);
                applyLatestAnchorToPlayer();
            }
            playerHint.setText(preparingLocalVideo ? "正在确认视频可播放…" : "播放器已就绪");
            if (appFullscreen) setImmersiveControlsVisible(true, !playerPaused && !playerEnded);
        });
    }

    @Override
    public void onLocalCommand(String kind, double positionSeconds, double playbackRate) {
        runOnUiThread(() -> {
            if (!authenticated || roomClient == null || loadedMedia == null || awaitingMediaConfirmation) return;
            if ("rate".equals(kind)) updateSpeedButton(playbackRate);
            Double position = ("play".equals(kind) || "pause".equals(kind) || "seek".equals(kind)) ? positionSeconds : null;
            Double rate = "rate".equals(kind) ? playbackRate : null;
            roomClient.sendCommand(kind, position, rate, null);
        });
    }

    @Override
    public void onPlayerState(double positionSeconds, double duration, boolean paused, boolean ended, int state) {
        runOnUiThread(() -> {
            boolean playbackStateChanged = playerPaused != paused || playerEnded != ended;
            currentPositionSeconds = Math.max(0, positionSeconds);
            durationSeconds = Math.max(0, duration);
            playerPaused = paused;
            playerEnded = ended;
            readyState = state;

            if (preparingLocalVideo && pendingMediaToBroadcast != null && playerReady && state >= 1 && durationSeconds > 0) {
                preparingLocalVideo = false;
                loadingVideo = false;
                awaitingMediaConfirmation = true;
                loadingGeneration += 1;
                cancelPreparationButton.setVisibility(View.GONE);
                playerHint.setText("准备完成，即将同步切换");
                BilibiliMedia preparedMedia = pendingMediaToBroadcast;
                mainHandler.postDelayed(() -> {
                    if (!awaitingMediaConfirmation || pendingMediaToBroadcast == null || !pendingMediaToBroadcast.sameIdentity(preparedMedia)) return;
                    playerHint.setText("正在更换视频…");
                    roomClient.sendCommand("media-change", 0.0, null, preparedMedia);
                }, 400);
            }

            updatePlaybackButtons(paused, ended);
            boolean hasDuration = durationSeconds > 0 && Double.isFinite(durationSeconds);
            boolean seekEnabled = hasDuration && authenticated && !awaitingMediaConfirmation;
            int maxProgress = hasDuration ? Math.max(1, (int) Math.round(durationSeconds * 1000)) : 1;
            int currentProgress = (int) Math.min(maxProgress, Math.round(currentPositionSeconds * 1000));
            String formattedTime = formatTime(currentPositionSeconds) + " / " + formatTime(durationSeconds);
            seekBar.setEnabled(seekEnabled);
            seekBar.setMax(maxProgress);
            immersiveSeekBar.setEnabled(seekEnabled);
            immersiveSeekBar.setMax(maxProgress);
            if (!userSeeking) {
                seekBar.setProgress(currentProgress);
                immersiveSeekBar.setProgress(currentProgress);
                timeText.setText(formattedTime);
                immersiveTimeText.setText(formattedTime);
            }
            setPlaybackControlsEnabled(playerReady && authenticated && !awaitingMediaConfirmation);
            if (hasDuration && !preparingLocalVideo && !awaitingMediaConfirmation) {
                playerHint.setText(ended ? "播放结束，可重播或更换视频" : (paused ? "已暂停" : "双方同步中"));
            }
            if (appFullscreen) {
                if (paused || ended || playerBuffering || loadingVideo) {
                    setImmersiveControlsVisible(true, false);
                } else if (playbackStateChanged) {
                    setImmersiveControlsVisible(true, true);
                }
            }
        });
    }

    @Override
    public void onBuffering(boolean buffering, double positionSeconds, boolean paused, int state) {
        runOnUiThread(() -> {
            playerBuffering = buffering;
            playerPaused = paused;
            playerHint.setText(buffering ? "正在缓冲，房间会暂时等待" : "缓冲结束，等待房间继续");
            if (appFullscreen) {
                setImmersiveControlsVisible(true, !buffering && !paused && !playerEnded);
            }
            if (roomClient == null || loadedMedia == null || latestAnchor == null) return;
            roomClient.sendReport(latestAnchor.sequence, positionSeconds, paused, state, buffering, loadedMedia);
        });
    }

    private void applySafeAreaInsets() {
        if (rootLayout == null) return;
        if (appFullscreen || htmlFullscreenView != null) {
            rootLayout.setPadding(0, 0, 0, 0);
            return;
        }
        rootLayout.setPadding(0, systemInsetTop + dp(16), 0, systemInsetBottom + dp(8));
    }

    private void updatePlayerAspectRatio() {
        if (playerContainer == null || playerContainer.getVisibility() != View.VISIBLE || appFullscreen) return;
        int availableWidth = Math.max(dp(240), rootContainer.getWidth() - dp(32));
        int targetHeight = Math.round(availableWidth * 9f / 16f);
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playerContainer.getLayoutParams();
        params.width = availableWidth;
        params.height = targetHeight;
        params.weight = 0;
        params.gravity = Gravity.CENTER_HORIZONTAL;
        params.setMargins(0, dp(12), 0, 0);
        playerContainer.setLayoutParams(params);
    }

    private void updateFullscreenPlayerLayout() {
        if (playerContainer == null) return;
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playerContainer.getLayoutParams();
        if (appFullscreen) {
            params.width = ViewGroup.LayoutParams.MATCH_PARENT;
            params.height = 0;
            params.weight = 1;
            params.gravity = Gravity.CENTER;
            params.setMargins(0, 0, 0, 0);
        } else {
            params.weight = 0;
        }
        playerContainer.setLayoutParams(params);
        if (!appFullscreen) rootContainer.post(this::updatePlayerAspectRatio);
    }

    private void showEntryScreen() {
        appFullscreen = false;
        setImmersiveControlsVisible(false, false);
        if (immersiveTapLayer != null) immersiveTapLayer.setVisibility(View.GONE);
        applyImmersiveMode(false);
        entryScroll.setVisibility(View.VISIBLE);
        videoSection.setVisibility(View.GONE);
        boolean hasLastRoom = preferences.getString("roomId", null) != null
            && preferences.getString("key", null) != null
            && preferences.getString("role", null) != null;
        continueButton.setVisibility(hasLastRoom ? View.VISIBLE : View.GONE);
        applyTheme();
    }

    private void showVideoScreen() {
        entryScroll.setVisibility(View.GONE);
        videoSection.setVisibility(View.VISIBLE);
        if (roomMedia == null && loadedMedia == null) showPreparationPanel();
        updatePlayerAspectRatio();
        applyTheme();
    }

    private void showPreparationPanel() {
        if (appFullscreen) toggleAppFullscreen();
        entryScroll.setVisibility(View.GONE);
        videoSection.setVisibility(View.VISIBLE);
        preparationPanel.setVisibility(View.VISIBLE);
        playerContainer.setVisibility(roomMedia == null && loadedMedia == null ? View.GONE : View.VISIBLE);
        videoFooter.setVisibility(playerContainer.getVisibility() == View.VISIBLE ? View.VISIBLE : View.GONE);
        videoInput.requestFocus();
    }

    private void setConnectionStatus(String value) {
        if (entryConnectionText != null) entryConnectionText.setText(value);
        if (videoConnectionText != null) videoConnectionText.setText(value);
    }

    private void setPreparationControlsEnabled(boolean enabled) {
        loadVideoButton.setEnabled(enabled);
        videoInput.setEnabled(enabled);
        if (enabled) {
            loadVideoButton.setText("准备视频");
            cancelPreparationButton.setVisibility(View.GONE);
        } else {
            loadVideoButton.setText("正在准备…");
        }
    }

    private void setPlaybackControlsEnabled(boolean enabled) {
        playPauseButton.setEnabled(enabled);
        danmakuButton.setEnabled(playerReady);
        speedButton.setEnabled(enabled);
        orientationButton.setEnabled(playerContainer.getVisibility() == View.VISIBLE);
        fullscreenButton.setEnabled(playerContainer.getVisibility() == View.VISIBLE);
        if (immersivePlayButton != null) immersivePlayButton.setEnabled(enabled);
        if (immersiveCenterPlayButton != null) immersiveCenterPlayButton.setEnabled(enabled);
        if (immersiveDanmakuButton != null) immersiveDanmakuButton.setEnabled(playerReady);
        if (immersiveSpeedButton != null) immersiveSpeedButton.setEnabled(enabled);
    }

    private void cancelVideoPreparation(String message) {
        loadingGeneration += 1;
        loadingVideo = false;
        preparingLocalVideo = false;
        awaitingMediaConfirmation = false;
        pendingMediaToBroadcast = null;
        setPreparationControlsEnabled(true);
        playerHint.setText(message);
        showPreparationPanel();
        if (roomMedia != null && (loadedMedia == null || !loadedMedia.sameIdentity(roomMedia))) {
            loadingVideo = true;
            loadMedia(roomMedia);
        }
    }

    private void failVideoPreparation(String message) {
        cancelVideoPreparation(message);
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void toggleDanmaku() {
        danmakuVisible = !danmakuVisible;
        preferences.edit().putBoolean("danmakuVisible", danmakuVisible).apply();
        String label = danmakuVisible ? "弹幕 开" : "弹幕 关";
        danmakuButton.setText(label);
        if (immersiveDanmakuButton != null) immersiveDanmakuButton.setText(label);
        if (playerReady) {
            evaluatePlayer("window.__tongkanSetDanmakuVisible && window.__tongkanSetDanmakuVisible(" + danmakuVisible + ");");
        }
        setImmersiveControlsVisible(true, true);
    }

    private void showSpeedDialog() {
        if (!playerReady || awaitingMediaConfirmation) return;
        String[] labels = {"0.5×", "0.75×", "1.0×", "1.25×", "1.5×", "2.0×"};
        double[] rates = {0.5, 0.75, 1.0, 1.25, 1.5, 2.0};
        new AlertDialog.Builder(this)
            .setTitle("选择播放速度")
            .setItems(labels, (dialog, index) -> {
                double rate = rates[index];
                updateSpeedButton(rate);
                evaluatePlayer("window.__tongkanSetPlaybackRate && window.__tongkanSetPlaybackRate(" + rate + ");");
            })
            .setNegativeButton("取消", null)
            .show();
    }

    private void updateSpeedButton(double rate) {
        selectedPlaybackRate = rate;
        String label = String.format(Locale.CHINA, rate == Math.rint(rate) ? "%.1f×" : "%.2f×", rate).replace(".00", ".0");
        speedButton.setText(label);
        if (immersiveSpeedButton != null) immersiveSpeedButton.setText(label);
        setImmersiveControlsVisible(true, true);
    }

    private void toggleOrientation() {
        boolean landscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        if (landscape) {
            if (appFullscreen) toggleAppFullscreen();
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
            mainHandler.postDelayed(() -> {
                if (!appFullscreen) toggleAppFullscreen();
            }, 250);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean landscape = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE;
        orientationButton.setText(landscape ? "竖屏" : "横屏");
        setButtonIcon(orientationButton, R.drawable.ic_rotate);
        rootContainer.post(() -> {
            if (appFullscreen) updateFullscreenPlayerLayout();
            else updatePlayerAspectRatio();
            applySafeAreaInsets();
        });
    }

    private void toggleAppFullscreen() {
        appFullscreen = !appFullscreen;
        mainHandler.removeCallbacks(hideImmersiveControls);
        videoHeader.setVisibility(appFullscreen ? View.GONE : View.VISIBLE);
        videoFooter.setVisibility(appFullscreen ? View.GONE : (playerContainer.getVisibility() == View.VISIBLE ? View.VISIBLE : View.GONE));
        preparationPanel.setVisibility(appFullscreen ? View.GONE : (roomMedia == null && loadedMedia == null ? View.VISIBLE : View.GONE));
        videoSection.setPadding(appFullscreen ? 0 : dp(16), appFullscreen ? 0 : dp(12), appFullscreen ? 0 : dp(16), appFullscreen ? 0 : dp(12));
        fullscreenButton.setText(appFullscreen ? "退出全屏" : "全屏");
        setButtonIcon(fullscreenButton, appFullscreen ? R.drawable.ic_exit_fullscreen : R.drawable.ic_fullscreen);
        if (immersiveTapLayer != null) immersiveTapLayer.setVisibility(appFullscreen ? View.VISIBLE : View.GONE);
        updateFullscreenPlayerLayout();
        applyImmersiveMode(appFullscreen);
        applySafeAreaInsets();
        setImmersiveControlsVisible(appFullscreen, appFullscreen);
    }

    private void applyImmersiveMode(boolean enabled) {
        if (enabled) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
            if (!darkMode) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
        applySafeAreaInsets();
    }

    private void hideHtmlFullscreen() {
        if (htmlFullscreenView == null || htmlFullscreenContainer == null) return;
        htmlFullscreenContainer.removeView(htmlFullscreenView);
        htmlFullscreenView = null;
        htmlFullscreenContainer.setVisibility(View.GONE);
        if (rootLayout != null) rootLayout.setVisibility(View.VISIBLE);
        if (htmlFullscreenCallback != null) htmlFullscreenCallback.onCustomViewHidden();
        htmlFullscreenCallback = null;
        applyImmersiveMode(appFullscreen);
    }

    @Override
    public void onBackPressed() {
        if (htmlFullscreenView != null) {
            hideHtmlFullscreen();
            return;
        }
        if (appFullscreen) {
            exitImmersiveViewing();
            return;
        }
        if (videoSection.getVisibility() == View.VISIBLE) {
            confirmLeaveRoom();
            return;
        }
        super.onBackPressed();
    }

    private void confirmLeaveRoom() {
        new AlertDialog.Builder(this)
            .setTitle("离开房间？")
            .setMessage("离开后，本机将返回入口；房间无人连接 10 分钟后自动失效。")
            .setNegativeButton("取消", null)
            .setPositiveButton("离开", (dialog, which) -> leaveRoom())
            .show();
    }

    private void leaveRoom() {
        if (roomClient != null) roomClient.close();
        roomClient = null;
        authenticated = false;
        currentRoomId = null;
        currentKey = null;
        currentRole = null;
        currentInviteKey = null;
        latestAnchor = null;
        roomMedia = null;
        loadedMedia = null;
        playerReady = false;
        preferences.edit().remove("roomId").remove("key").remove("role").remove("inviteKey").apply();
        webView.loadUrl("about:blank");
        showEntryScreen();
        setConnectionStatus("已离开房间");
    }

    private void toggleTheme() {
        darkMode = !darkMode;
        preferences.edit().putBoolean("darkMode", darkMode).apply();
        applyTheme();
    }

    private void applyTheme() {
        int background = darkMode ? Color.rgb(11, 12, 13) : Color.rgb(243, 243, 240);
        int surface = darkMode ? Color.rgb(23, 24, 25) : Color.WHITE;
        int primaryText = darkMode ? Color.rgb(244, 244, 242) : Color.rgb(23, 24, 23);
        int secondaryText = darkMode ? Color.rgb(165, 166, 170) : Color.rgb(112, 114, 109);
        int border = darkMode ? Color.rgb(48, 50, 54) : Color.rgb(217, 217, 210);
        rootContainer.setBackgroundColor(background);
        rootLayout.setBackgroundColor(background);
        applyThemeRecursive(rootContainer, background, surface, primaryText, secondaryText, border);
        entryThemeButton.setImageResource(darkMode ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
        entryThemeButton.setContentDescription(darkMode ? "切换浅色主题" : "切换深色主题");
        String danmakuLabel = danmakuVisible ? "弹幕 开" : "弹幕 关";
        danmakuButton.setText(danmakuLabel);
        if (immersiveDanmakuButton != null) immersiveDanmakuButton.setText(danmakuLabel);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        applyImmersiveMode(appFullscreen || htmlFullscreenView != null);
    }

    private void applyThemeRecursive(View view, int background, int surface, int primaryText, int secondaryText, int border) {
        Object tag = view.getTag();
        String role = tag instanceof String ? (String) tag : "";
        if ("screen".equals(role)) view.setBackgroundColor(background);
        if ("card".equals(role)) view.setBackground(rounded(surface, border, 16));
        if ("divider".equals(role)) view.setBackgroundColor(border);
        if ("input".equals(role) && view instanceof EditText) {
            EditText input = (EditText) view;
            input.setTextColor(primaryText);
            input.setHintTextColor(secondaryText);
            input.setBackground(rounded(surface, border, 12));
        }
        if ("primaryText".equals(role) && view instanceof TextView) ((TextView) view).setTextColor(primaryText);
        if ("secondaryText".equals(role) && view instanceof TextView) ((TextView) view).setTextColor(secondaryText);
        if ("primaryButton".equals(role) && view instanceof Button) {
            Button button = (Button) view;
            int color = darkMode ? Color.rgb(21, 21, 21) : Color.WHITE;
            button.setTextColor(color);
            button.setBackground(buttonBackground(true));
            tintButtonDrawables(button, color);
        }
        if ("secondaryButton".equals(role) && view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(primaryText);
            button.setBackground(buttonBackground(false));
            tintButtonDrawables(button, primaryText);
        }
        if ("textButton".equals(role) && view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(primaryText);
            button.setBackground(textButtonBackground(border));
        }
        if ("iconButton".equals(role) && view instanceof ImageButton) {
            ImageButton button = (ImageButton) view;
            button.setColorFilter(primaryText, android.graphics.PorterDuff.Mode.SRC_IN);
            button.setBackground(iconButtonBackground());
        }
        if ("immersiveIconButton".equals(role) && view instanceof ImageButton) {
            ImageButton button = (ImageButton) view;
            button.setColorFilter(Color.WHITE, android.graphics.PorterDuff.Mode.SRC_IN);
            button.setBackground(rounded(Color.argb(120, 20, 21, 23), Color.argb(90, 255, 255, 255), 12));
        }
        if ("immersivePrimaryIcon".equals(role) && view instanceof ImageButton) {
            ImageButton button = (ImageButton) view;
            button.setColorFilter(Color.BLACK, android.graphics.PorterDuff.Mode.SRC_IN);
            button.setBackground(rounded(Color.argb(242, 255, 255, 255), Color.TRANSPARENT, 31));
        }
        if ("immersiveButton".equals(role) && view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(Color.WHITE);
            button.setBackground(rounded(Color.argb(110, 20, 21, 23), Color.argb(90, 255, 255, 255), 10));
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index += 1) {
                applyThemeRecursive(group.getChildAt(index), background, surface, primaryText, secondaryText, border);
            }
        }
    }

    private StateListDrawable textButtonBackground(int border) {
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[] {android.R.attr.state_pressed}, rounded(darkMode ? Color.rgb(35, 36, 38) : Color.rgb(232, 232, 227), Color.TRANSPARENT, 0));
        states.addState(new int[] {}, rounded(Color.TRANSPARENT, Color.TRANSPARENT, 0));
        return states;
    }

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(16), dp(16), dp(16), dp(16));
        layout.setTag("card");
        return layout;
    }

    private TextView label(String value) {
        TextView view = text(value, 13, Color.DKGRAY);
        view.setTag("secondaryText");
        return view;
    }

    private String normalizedNickname() {
        String value = nicknameInput == null ? "我" : nicknameInput.getText().toString().trim();
        if (value.isEmpty()) value = "我";
        return value.length() > 24 ? value.substring(0, 24) : value;
    }

    private boolean isTrustedPlayerUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost();
            String path = uri.getPath();
            if ("player.bilibili.com".equalsIgnoreCase(host)) {
                return "/player.html".equals(path);
            }
            return "www.bilibili.com".equalsIgnoreCase(host)
                && path != null
                && path.startsWith("/blackboard/webplayer/");
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private String readAsset(String name) {
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(getAssets().open(name), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line).append('\n');
        } catch (IOException error) {
            return "";
        }
        return result.toString();
    }

    private void startLoadingTimeout(long generation) {
        mainHandler.postDelayed(() -> {
            if (loadingVideo && preparingLocalVideo && generation == loadingGeneration) {
                playerHint.setText("视频加载得有点慢，请再等一下");
                cancelPreparationButton.setVisibility(View.VISIBLE);
            }
        }, 8000);
        mainHandler.postDelayed(() -> {
            if (loadingVideo && preparingLocalVideo && generation == loadingGeneration) {
                failVideoPreparation("视频准备超时，请重新加载或更换链接");
            }
        }, 20000);
    }

    private void showError(String message) {
        setConnectionStatus(message);
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private static String formatTime(double seconds) {
        int total = (int) Math.max(0, Math.floor(Double.isFinite(seconds) ? seconds : 0));
        int hours = total / 3600;
        int minutes = (total % 3600) / 60;
        int remaining = total % 60;
        return hours > 0
            ? String.format(Locale.CHINA, "%d:%02d:%02d", hours, minutes, remaining)
            : String.format(Locale.CHINA, "%02d:%02d", minutes, remaining);
    }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private EditText edit(String hint) {
        EditText view = new EditText(this);
        view.setHint(hint);
        view.setTextSize(14);
        view.setSingleLine(true);
        view.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setTag("input");
        return view;
    }

    private Button button(String label, boolean primary) {
        Button view = new Button(this);
        view.setText(label);
        view.setTextSize(14);
        view.setAllCaps(false);
        view.setPadding(dp(12), 0, dp(12), 0);
        view.setMinHeight(0);
        view.setMinWidth(0);
        view.setElevation(0);
        view.setStateListAnimator(null);
        view.setTag(primary ? "primaryButton" : "secondaryButton");
        view.setBackground(buttonBackground(primary));
        return view;
    }

    private StateListDrawable buttonBackground(boolean primary) {
        int normal = primary
            ? (darkMode ? Color.rgb(241, 241, 239) : Color.rgb(32, 33, 31))
            : (darkMode ? Color.rgb(23, 24, 25) : Color.WHITE);
        int pressed = primary
            ? (darkMode ? Color.rgb(216, 217, 220) : Color.rgb(56, 58, 54))
            : (darkMode ? Color.rgb(48, 50, 54) : Color.rgb(229, 229, 224));
        int border = primary ? Color.TRANSPARENT : (darkMode ? Color.rgb(48, 50, 54) : Color.rgb(217, 217, 210));
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[] {android.R.attr.state_pressed}, rounded(pressed, border, 12));
        states.addState(new int[] {}, rounded(normal, border, 12));
        return states;
    }

    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private GradientDrawable rounded(int fill, int stroke) {
        return rounded(fill, stroke, 12);
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchHeight(int heightDp) {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(heightDp));
    }

    private LinearLayout.LayoutParams weight(float value) {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, value);
    }

    private LinearLayout.LayoutParams margin(LinearLayout.LayoutParams params, int left, int top, int right, int bottom) {
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
