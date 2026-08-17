package com.tongkan.mobile;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.view.WindowManager;

import com.tongkan.mobile.account.AccountClient;
import com.tongkan.mobile.account.AccountModels;
import com.tongkan.mobile.account.FcmPushTokenProvider;
import com.tongkan.mobile.account.PushTokenProvider;
import com.tongkan.mobile.account.SessionStore;
import com.tongkan.mobile.ui.AuthScreen;
import com.tongkan.mobile.ui.BreathTheme;
import com.tongkan.mobile.ui.HomeScreen;
import com.tongkan.mobile.ui.MainNavigationView;
import com.tongkan.mobile.ui.ImmersiveMediaGestureController;
import com.tongkan.mobile.ui.PortraitComposerPositioner;
import com.tongkan.mobile.ui.RoomChatOverlay;
import com.tongkan.mobile.ui.RoomChatView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.lang.Thread;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity implements RoomClient.Listener, PlayerJavascriptBridge.Listener {
    private static final String PREFS = "tongkan_android";
    private static final String PUBLIC_ORIGIN = "https://tongkan-personal.pages.dev";

    private final ExecutorService background = Executors.newSingleThreadExecutor();
    private SharedPreferences preferences;
    private AccountClient accountClient;
    private SessionStore sessionStore;
    private AccountModels.Session accountSession;
    private AccountModels.Pair currentPair;
    private AccountModels.PairState currentPairState = AccountModels.PairState.empty();
    private AccountModels.PairInvite currentPairInvite;
    private String pairMessage = "";
    private boolean pairLoading;
    private boolean pairLoaded;
    private String registeredPushToken;
    private final PushTokenProvider pushTokenProvider = new FcmPushTokenProvider();
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 7201;
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
    private static final long BUFFERING_DEBOUNCE_MS = 2000;
    private static final long IMMERSIVE_CONTROLS_HIDE_DELAY_MS = 2800;
    private Runnable pendingBufferingReport;
    private boolean roomBufferingActive;
    private double latestBufferingPositionSeconds;
    private boolean latestBufferingPaused;
    private int latestBufferingReadyState;
    private volatile boolean loadingVideo;
    private int readyState;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private FrameLayout rootContainer;
    private FrameLayout htmlFullscreenContainer;
    private LinearLayout rootLayout;
    private FrameLayout entryHost;
    private AuthScreen authScreen;
    private HomeScreen homeScreen;
    private MainNavigationView mainNavigationView;
    private BreathTheme breathTheme;
    private LinearLayout videoSection;
    private LinearLayout preparationPanel;
    private FrameLayout playerContainer;
    private TextView entryConnectionText;
    private TextView videoConnectionText;
    private Button continueButton;
    private ImageButton entryThemeButton;
    private Button cancelPreparationButton;
    private Button changeVideoButton;
    private Button videoThemeButton;
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
    private boolean pendingPairWatchInvite;
    private boolean darkMode;
    private boolean danmakuVisible;
    private boolean appFullscreen;
    private double selectedPlaybackRate = 1.0;
    private long loadingGeneration;
    private boolean orientationWasPlaying;
    private long ignoreOrientationPauseUntilMs;
    private int systemInsetTop;
    private int systemInsetBottom;
    private int portraitComposerBottomMargin;
    private FrameLayout portraitComposerLayer;
    private ViewTreeObserver.OnGlobalLayoutListener keyboardLayoutListener;
    private FrameLayout immersiveControls;
    private View immersiveTapLayer;
    private ImageButton immersivePlayButton;
    private ImageButton immersiveCenterPlayButton;
    private Button immersiveDanmakuButton;
    private Button immersiveSpeedButton;
    private SeekBar immersiveSeekBar;
    private TextView immersiveTimeText;
    private ImageButton immersiveChatButton;
    private View immersiveChatUnreadDot;
    private LinearLayout immersiveAdjustmentHud;
    private ImageView immersiveAdjustmentIcon;
    private SeekBar immersiveAdjustmentProgress;
    private TextView immersiveAdjustmentText;
    private RoomChatView portraitChatView;
    private RoomChatOverlay immersiveChatOverlay;
    private ImmersiveMediaGestureController immersiveGestureController;
    private String ownMemberId;
    private String currentRoomNickname = "我";
    private boolean immersiveControlsVisible;
    private final Runnable hideImmersiveControls = () -> setImmersiveControlsVisible(false, false);
    private final Runnable hideImmersiveAdjustmentHud = () -> {
        if (immersiveAdjustmentHud == null) return;
        immersiveAdjustmentHud.animate().alpha(0f).setDuration(180)
            .withEndAction(() -> immersiveAdjustmentHud.setVisibility(View.GONE)).start();
    };

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
        accountClient = new AccountClient(BuildConfig.ACCOUNT_API_BASE_URL, BuildConfig.ACCOUNT_TEST_ACCESS_TOKEN);
        sessionStore = new SessionStore(this);
        accountSession = sessionStore.load();
        breathTheme = new BreathTheme(this, preferences);
        darkMode = breathTheme.isDark();
        danmakuVisible = preferences.getBoolean("danmakuVisible", true);
        playerBridgeScript = readAsset("bilibili-player-bridge.js");
        buildInterface();
        configureWebView();
        requestNotificationPermissionIfNeeded();

        nicknameInput.setText(preferences.getString("nickname", "我"));
        String deepLink = incomingInviteUrl(getIntent());
        if (deepLink != null && InviteInfo.parse(deepLink) != null) {
            showEntryScreen();
            homeScreen.showJoinPanel();
            inviteInput.setText(deepLink);
            joinInvite(deepLink);
        } else {
            restoreAccountSession();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (accountSession == null) return;
        registerDeviceTokenIfAvailable();
        if (mainNavigationView != null
            && entryHost != null
            && entryHost.getVisibility() == View.VISIBLE
            && "pair".equals(mainNavigationView.getCurrentPage())
            && !pairLoading) {
            mainHandler.post(() -> refreshPairState(false));
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && FcmPushTokenProvider.isConfigured()
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != getPackageManager().PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST_CODE);
        }
    }

    private static String incomingInviteUrl(Intent intent) {
        String data = intent == null ? null : intent.getDataString();
        if (data != null && InviteInfo.parse(data) != null) return data;
        if (intent != null && intent.hasExtra("url")) {
            String extra = intent.getStringExtra("url");
            if (extra != null && InviteInfo.parse(extra) != null) return extra;
        }
        return null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.remove("android:views");
    }

    @Override
    protected void onNewIntent(Intent intent) {

        setIntent(intent);
        String deepLink = incomingInviteUrl(intent);
        if (deepLink != null) {
            showEntryScreen();
            homeScreen.showJoinPanel();
            inviteInput.setText(deepLink);
            joinInvite(deepLink);
        }
    }

    @Override
    protected void onDestroy() {
        if (rootContainer != null && keyboardLayoutListener != null) {
            rootContainer.getViewTreeObserver().removeOnGlobalLayoutListener(keyboardLayoutListener);
        }
        if (roomClient != null) roomClient.close();
        if (accountClient != null) accountClient.close();
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

        entryHost = new FrameLayout(this);
        rootLayout.addView(entryHost, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        htmlFullscreenContainer = new FrameLayout(this);
        htmlFullscreenContainer.setBackgroundColor(Color.BLACK);
        htmlFullscreenContainer.setVisibility(View.GONE);
        rootContainer.addView(htmlFullscreenContainer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        String[] quote = dailyQuote();
        authScreen = new AuthScreen(this, breathTheme, new AuthScreen.Listener() {
            @Override
            public void onToggleTheme() {
                toggleTheme();
            }

            @Override
            public void onRequestCode(String email) {
                requestAccountCode(email);
            }

            @Override
            public void onVerifyCode(String email, String code) {
                verifyAccountCode(email, code);
            }

            @Override
            public void onUseAnonymousRoom() {
                showEntryScreen();
            }
        });
        homeScreen = new HomeScreen(this, breathTheme, quote[0], quote[1], new HomeScreen.Listener() {
            @Override
            public void onToggleTheme() {
                toggleTheme();
            }

            @Override
            public void onCreateRoom() {
                createRoom();
            }

            @Override
            public void onJoinRoom() {
                joinInvite(inviteInput.getText().toString());
            }

            @Override
            public void onPasteInvite() {
                pasteInviteFromClipboard();
            }

            @Override
            public void onRestoreRoom() {
                restoreLastRoom();
            }
        });
        mainNavigationView = new MainNavigationView(this, breathTheme, this::showMainTabFromNavigation);
        nicknameInput = homeScreen.getNicknameInput();
        inviteInput = homeScreen.getInviteInput();
        createButton = homeScreen.getCreateButton();
        joinButton = homeScreen.getJoinButton();
        continueButton = homeScreen.getContinueButton();
        entryThemeButton = homeScreen.getThemeButton();
        entryConnectionText = homeScreen.getConnectionText();
        entryHost.addView(authScreen.getView(), new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

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

        LinearLayout primaryControls = horizontal();
        playPauseButton = button("播放", true);
        setButtonIcon(playPauseButton, R.drawable.ic_play);
        playPauseButton.setEnabled(false);
        playPauseButton.setOnClickListener(view -> togglePlayback());
        primaryControls.addView(playPauseButton, weight(1));
        danmakuButton = button("弹幕 开", false);
        setButtonIcon(danmakuButton, R.drawable.ic_danmaku);
        danmakuButton.setOnClickListener(view -> toggleDanmaku());
        primaryControls.addView(danmakuButton, margin(weight(1), 6, 0, 0, 0));
        speedButton = button("1.0×", false);
        setButtonIcon(speedButton, R.drawable.ic_speed);
        speedButton.setOnClickListener(view -> showSpeedDialog());
        primaryControls.addView(speedButton, margin(weight(1), 6, 0, 0, 0));
        orientationButton = button("横屏", false);
        setButtonIcon(orientationButton, R.drawable.ic_rotate);
        orientationButton.setOnClickListener(view -> toggleOrientation());
        primaryControls.addView(orientationButton, margin(weight(1), 6, 0, 0, 0));
        fullscreenButton = button("全屏", false);
        setButtonIcon(fullscreenButton, R.drawable.ic_fullscreen);
        fullscreenButton.setOnClickListener(view -> toggleAppFullscreen());
        primaryControls.addView(fullscreenButton, margin(weight(1), 6, 0, 0, 0));
        footer.addView(primaryControls, margin(matchHeight(62), 0, 6, 0, 0));

        LinearLayout quickActions = horizontal();
        changeVideoButton = button("换视频", false);
        setButtonIcon(changeVideoButton, R.drawable.ic_video);
        changeVideoButton.setOnClickListener(view -> showPreparationPanel());
        quickActions.addView(changeVideoButton, weight(1));
        videoThemeButton = button(darkMode ? "浅色" : "深色", false);
        setButtonIcon(videoThemeButton, darkMode ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
        videoThemeButton.setOnClickListener(view -> toggleTheme());
        quickActions.addView(videoThemeButton, margin(weight(1), 8, 0, 0, 0));
        footer.addView(quickActions, margin(matchHeight(50), 0, 8, 0, 0));
        portraitChatView = new RoomChatView(this, false);
        portraitChatView.setOnSendListener(this::sendChatMessage);
        portraitChatView.setOnComposerFocusListener(this::onPortraitComposerFocusChanged);
        portraitChatView.setSendEnabled(false);
        LinearLayout.LayoutParams portraitChatParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        footer.addView(portraitChatView, margin(portraitChatParams, 0, 10, 0, 0));
        videoSection.addView(footer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        portraitComposerLayer = new FrameLayout(this);
        portraitComposerLayer.setClipChildren(false);
        portraitComposerLayer.setClipToPadding(false);
        portraitComposerLayer.setVisibility(View.GONE);
        View portraitComposer = portraitChatView.detachComposerForOverlay();
        portraitComposerLayer.addView(portraitComposer, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(50),
            Gravity.CENTER_VERTICAL
        ));
        FrameLayout.LayoutParams composerLayerParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(66),
            Gravity.BOTTOM
        );
        composerLayerParams.leftMargin = dp(26);
        composerLayerParams.rightMargin = dp(26);
        rootContainer.addView(portraitComposerLayer, composerLayerParams);

        applyTheme();
        setContentView(rootContainer);
        rootContainer.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets systemBars = insets.getInsets(WindowInsets.Type.systemBars());
                systemInsetTop = systemBars.top;
                systemInsetBottom = systemBars.bottom;
            } else {
                systemInsetTop = insets.getSystemWindowInsetTop();
                systemInsetBottom = insets.getSystemWindowInsetBottom();
            }
            applySafeAreaInsets();
            view.post(this::updatePortraitComposerPosition);
            return insets;
        });
        keyboardLayoutListener = this::updatePortraitComposerPosition;
        rootContainer.getViewTreeObserver().addOnGlobalLayoutListener(keyboardLayoutListener);
        rootContainer.requestApplyInsets();
        rootContainer.post(this::updatePortraitComposerPosition);
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
        int normal = breathTheme.panel();
        int pressed = breathTheme.accentSoft();
        int border = breathTheme.line();
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[] {android.R.attr.state_pressed}, rounded(pressed, border, 12));
        states.addState(new int[] {}, rounded(normal, border, 12));
        return states;
    }

    private void setButtonIcon(Button button, int drawableId) {
        android.graphics.drawable.Drawable drawable = getDrawable(drawableId).mutate();
        drawable.setBounds(0, 0, dp(18), dp(18));
        button.setTextSize(11);
        button.setPadding(dp(2), dp(5), dp(2), dp(4));
        button.setGravity(Gravity.CENTER);
        button.setCompoundDrawables(null, drawable, null, null);
        button.setCompoundDrawablePadding(dp(3));
    }

    private void tintButtonDrawables(Button button, int color) {
        for (android.graphics.drawable.Drawable drawable : button.getCompoundDrawables()) {
            if (drawable != null) drawable.setColorFilter(color, android.graphics.PorterDuff.Mode.SRC_IN);
        }
    }

    private void buildImmersiveControls() {
        immersiveTapLayer = new View(this);
        immersiveTapLayer.setBackgroundColor(Color.TRANSPARENT);
        immersiveTapLayer.setVisibility(View.GONE);
        immersiveGestureController = new ImmersiveMediaGestureController(this, new ImmersiveMediaGestureController.Callback() {
            @Override
            public void onTap() {
                if (appFullscreen) setImmersiveControlsVisible(!immersiveControlsVisible, true);
            }

            @Override
            public void onAdjustment(ImmersiveMediaGestureController.ControlType type, int percent, boolean finished) {
                showImmersiveAdjustment(type, percent, finished);
            }
        });
        immersiveTapLayer.setOnTouchListener((view, event) -> {
            if (appFullscreen) return immersiveGestureController.onTouch(view, event);
            if (event.getActionMasked() == android.view.MotionEvent.ACTION_UP && playerReady && authenticated && !awaitingMediaConfirmation) {
                togglePlayback();
            }
            return true;
        });
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
        bottom.setBackgroundColor(Color.TRANSPARENT);
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
        FrameLayout immersiveChatButtonHost = new FrameLayout(this);
        immersiveChatButton = iconButton(R.drawable.ic_chat, "消息");
        immersiveChatButton.setTag("immersiveIconButton");
        immersiveChatButton.setOnClickListener(view -> {
            setImmersiveChatUnread(false);
            setImmersiveControlsVisible(true, false);
            if (immersiveChatOverlay != null) immersiveChatOverlay.show();
        });
        immersiveChatButtonHost.addView(immersiveChatButton, new FrameLayout.LayoutParams(dp(48), dp(48)));
        immersiveChatUnreadDot = new View(this);
        GradientDrawable unreadBackground = new GradientDrawable();
        unreadBackground.setShape(GradientDrawable.OVAL);
        unreadBackground.setColor(0xFFFF3B30);
        unreadBackground.setStroke(dp(2), Color.WHITE);
        immersiveChatUnreadDot.setBackground(unreadBackground);
        immersiveChatUnreadDot.setVisibility(View.GONE);
        FrameLayout.LayoutParams unreadParams = new FrameLayout.LayoutParams(dp(12), dp(12), Gravity.TOP | Gravity.END);
        unreadParams.setMargins(0, dp(2), dp(1), 0);
        immersiveChatButtonHost.addView(immersiveChatUnreadDot, unreadParams);
        actions.addView(immersiveChatButtonHost, margin(new LinearLayout.LayoutParams(dp(48), dp(48)), 8, 0, 0, 0));
        View spacer = new View(this);
        actions.addView(spacer, weight(1));
        ImageButton exitFullscreen = iconButton(R.drawable.ic_exit_fullscreen, "退出全屏");
        exitFullscreen.setTag("immersiveIconButton");
        exitFullscreen.setOnClickListener(view -> exitImmersiveViewing());
        actions.addView(exitFullscreen, new LinearLayout.LayoutParams(dp(48), dp(48)));
        bottom.addView(actions, matchHeight(48));

        immersiveAdjustmentHud = new LinearLayout(this);
        immersiveAdjustmentHud.setOrientation(LinearLayout.VERTICAL);
        immersiveAdjustmentHud.setGravity(Gravity.CENTER);
        immersiveAdjustmentHud.setPadding(dp(18), dp(14), dp(18), dp(12));
        immersiveAdjustmentHud.setBackground(rounded(Color.argb(205, 18, 20, 25), Color.argb(80, 255, 255, 255), 16));
        immersiveAdjustmentHud.setVisibility(View.GONE);
        immersiveAdjustmentIcon = new ImageView(this);
        immersiveAdjustmentHud.addView(immersiveAdjustmentIcon, new LinearLayout.LayoutParams(dp(30), dp(30)));
        immersiveAdjustmentText = text("50%", 15, Color.WHITE);
        immersiveAdjustmentText.setTextColor(Color.WHITE);
        immersiveAdjustmentText.setGravity(Gravity.CENTER);
        immersiveAdjustmentHud.addView(immersiveAdjustmentText, margin(matchHeight(28), 0, 4, 0, 0));
        immersiveAdjustmentProgress = new SeekBar(this);
        immersiveAdjustmentProgress.setMax(100);
        immersiveAdjustmentProgress.setEnabled(false);
        immersiveAdjustmentProgress.setAlpha(1f);
        immersiveAdjustmentHud.addView(immersiveAdjustmentProgress, new LinearLayout.LayoutParams(dp(138), dp(32)));
        FrameLayout.LayoutParams hudParams = new FrameLayout.LayoutParams(dp(180), dp(128), Gravity.CENTER);
        playerContainer.addView(immersiveAdjustmentHud, hudParams);

        immersiveChatOverlay = new RoomChatOverlay(this, playerContainer);
        immersiveChatOverlay.setVisibilityListener(visible -> {
            if (visible) {
                setImmersiveChatUnread(false);
                mainHandler.removeCallbacks(hideImmersiveControls);
                setImmersiveControlsVisible(true, false);
            } else {
                scheduleImmersiveControlsHide();
            }
        });
        immersiveChatOverlay.getChatView().setOnSendListener(this::sendChatMessage);
        immersiveChatOverlay.getChatView().setSendEnabled(false);
    }

    private void showImmersiveAdjustment(ImmersiveMediaGestureController.ControlType type, int percent, boolean finished) {
        if (immersiveAdjustmentHud == null) return;
        mainHandler.removeCallbacks(hideImmersiveAdjustmentHud);
        immersiveAdjustmentIcon.setImageResource(type == ImmersiveMediaGestureController.ControlType.BRIGHTNESS
            ? R.drawable.ic_brightness : R.drawable.ic_volume);
        immersiveAdjustmentText.setText((type == ImmersiveMediaGestureController.ControlType.BRIGHTNESS ? "亮度 " : "音量 ") + percent + "%");
        immersiveAdjustmentProgress.setProgress(percent);
        immersiveAdjustmentHud.setAlpha(1f);
        immersiveAdjustmentHud.setVisibility(View.VISIBLE);
        if (finished) mainHandler.postDelayed(hideImmersiveAdjustmentHud, 1000);
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
        if (!visible && immersiveChatOverlay != null && immersiveChatOverlay.isShowing()) return;
        immersiveControlsVisible = visible && appFullscreen;
        if (immersiveControls != null) immersiveControls.setVisibility(immersiveControlsVisible ? View.VISIBLE : View.GONE);
        if (scheduleHide && immersiveControlsVisible) scheduleImmersiveControlsHide();
    }

    private void scheduleImmersiveControlsHide() {
        mainHandler.removeCallbacks(hideImmersiveControls);
        boolean chatOpen = immersiveChatOverlay != null && immersiveChatOverlay.isShowing();
        if (appFullscreen && !chatOpen && !playerPaused && !playerEnded && !playerBuffering && !userSeeking && !loadingVideo) {
            mainHandler.postDelayed(hideImmersiveControls, IMMERSIVE_CONTROLS_HIDE_DELAY_MS);
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
            immersiveCenterPlayButton.setVisibility(showPlay ? View.VISIBLE : View.GONE);
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
                syncPortraitComposerVisibility();
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
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if ("about:blank".equals(url)) return false;
                if (request.hasGesture() && playerContainer != null && playerContainer.getVisibility() == View.VISIBLE) {
                    playerHint.setText("已阻止网页跳转，继续在同看中播放");
                    return true;
                }
                return !isTrustedPlayerUrl(url);
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
        createRoom(false);
    }

    private void createRoom(boolean inviteBoundFriend) {
        String nickname = normalizedNickname();
        createButton.setEnabled(false);
        createButton.setText("正在创建…");
        setConnectionStatus("正在创建房间…");
        background.execute(() -> {
            try {
                RoomClient.CreateRoomResult result = RoomClient.createRoom();
                runOnUiThread(() -> {
                    createButton.setEnabled(false);
                    createButton.setText("正在连接…");
                    setConnectionStatus("房间已创建，正在建立连接…");
                    pendingPairWatchInvite = inviteBoundFriend;
                    pendingAutoShare = !inviteBoundFriend;
                    connectIdentity(result.roomId, result.hostKey, "host", result.inviteKey, nickname);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    createButton.setEnabled(true);
                    createButton.setText("创建房间");
                    pendingPairWatchInvite = false;
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
        currentRoomNickname = nickname;
        ownMemberId = null;
        authenticated = false;
        clearChatMessages();
        setChatEnabled(false);
        setPreparationControlsEnabled(false);
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
            setConnectionStatus("正在连接房间，连接完成后再准备视频");
            playerHint.setText("正在连接房间…");
            return;
        }
        if (loadingVideo) {
            playerHint.setText("视频正在准备中，请稍候");
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
                syncVideoFooterVisibility();
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
        syncVideoFooterVisibility();
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
        double hardSyncDrift = 0;
        if (playerReady && roomClient != null && loadedMedia != null && loadedMedia.sameIdentity(anchor.media)) {
            hardSyncDrift = anchor.positionAt(roomClient.serverNow()) - currentPositionSeconds;
        }
        if (playerReady) applyLatestAnchorToPlayer();
        updateSpeedButton(anchor.playbackRate);
        if (Math.abs(hardSyncDrift) > 1.5) {
            playerHint.setText(String.format(Locale.CHINA, "已重新同步 · 偏差 %.1f 秒", Math.abs(hardSyncDrift)));
        } else {
            playerHint.setText((anchor.paused ? "已暂停" : "正在播放") + " · 操作来自 " + actorNickname);
        }
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
        loadingVideo = true;
        loadingGeneration += 1;
        long generation = loadingGeneration;
        startLoadingTimeout(generation);
        playerPaused = true;
        playerEnded = false;
        resetBufferingEpisode();
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
        syncPlayerInteractionLayerVisibility();
        syncVideoFooterVisibility();
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
        runOnUiThread(() -> {
            setConnectionStatus(state);
            boolean connectionUnavailable = state.contains("正在连接") || state.contains("正在重连") || state.contains("连接中断")
                || "已断开".equals(state) || "连接失败".equals(state);
            if (connectionUnavailable) {
                authenticated = false;
                setPreparationControlsEnabled(false);
                setPlaybackControlsEnabled(false);
            }
            if ("已断开".equals(state) || "连接失败".equals(state)) {
                createButton.setEnabled(true);
                createButton.setText("创建房间");
                joinButton.setEnabled(true);
                joinButton.setText("加入房间");
            }
            setChatEnabled(authenticated);
        });
    }

    @Override
    public void onAuthenticated(String ownMemberId, JSONObject snapshot) {
        runOnUiThread(() -> {
            MainActivity.this.ownMemberId = ownMemberId;
            authenticated = true;
            setChatEnabled(true);
            setPreparationControlsEnabled(!loadingVideo);
            createButton.setEnabled(true);
            createButton.setText("创建房间");
            joinButton.setEnabled(true);
            joinButton.setText("加入房间");
            showVideoScreen();
            applySnapshot(snapshot);
            if (pendingPairWatchInvite) {
                pendingPairWatchInvite = false;
                mainHandler.postDelayed(this::sendPairWatchInvite, 350);
            } else if (pendingAutoShare) {
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
    public void onChatMessage(String messageId, String memberId, String nickname, String text, long serverSentAtMs) {
        runOnUiThread(() -> {
            boolean own = ownMemberId != null && ownMemberId.equals(memberId);
            String displayNickname = chatDisplayNickname(own, nickname);
            boolean portraitAdded = portraitChatView != null && portraitChatView.addMessage(messageId, displayNickname, text, own);
            boolean overlayAdded = immersiveChatOverlay != null
                && immersiveChatOverlay.getChatView().addMessage(messageId, displayNickname, text, own);
            if (!own && appFullscreen && (portraitAdded || overlayAdded) && immersiveChatOverlay != null && !immersiveChatOverlay.isShowing()) {
                setImmersiveChatUnread(true);
                immersiveChatOverlay.showIncomingBubble(displayNickname, text);
            }
        });
    }

    private boolean sendChatMessage(String text) {
        if (roomClient == null || !authenticated) {
            showError("房间正在重连，暂时无法发送消息");
            return false;
        }
        String messageId = roomClient.sendChat(text);
        if (messageId == null) return false;
        if (portraitChatView != null) portraitChatView.addMessage(messageId, currentRoomNickname, text, true);
        if (immersiveChatOverlay != null) immersiveChatOverlay.getChatView().addMessage(messageId, currentRoomNickname, text, true);
        return true;
    }

    private void setChatEnabled(boolean enabled) {
        if (portraitChatView != null) portraitChatView.setSendEnabled(enabled);
        if (immersiveChatOverlay != null) immersiveChatOverlay.getChatView().setSendEnabled(enabled);
        if (immersiveChatButton != null) immersiveChatButton.setEnabled(enabled);
    }

    private void clearChatMessages() {
        setImmersiveChatUnread(false);
        if (portraitChatView != null) portraitChatView.clearMessages();
        if (immersiveChatOverlay != null) immersiveChatOverlay.clearMessages();
    }

    private String chatDisplayNickname(boolean own, String nickname) {
        if (own) return currentRoomNickname == null || currentRoomNickname.trim().isEmpty() ? "我" : currentRoomNickname.trim();
        String normalized = nickname == null ? "" : nickname.trim();
        if (normalized.isEmpty() || "我".equals(normalized)) {
            if (currentPair != null && currentPair.partner != null && currentPair.partner.nickname != null
                && !currentPair.partner.nickname.trim().isEmpty()) {
                return currentPair.partner.nickname.trim();
            }
            return "对方";
        }
        return normalized;
    }

    private void setImmersiveChatUnread(boolean unread) {
        if (immersiveChatUnreadDot != null) immersiveChatUnreadDot.setVisibility(unread ? View.VISIBLE : View.GONE);
        if (immersiveChatButton != null) immersiveChatButton.setContentDescription(unread ? "消息，有未读消息" : "消息");
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
            if ("pause".equals(kind) && System.currentTimeMillis() < ignoreOrientationPauseUntilMs) return;
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
            latestBufferingPositionSeconds = positionSeconds;
            latestBufferingPaused = paused;
            latestBufferingReadyState = state;
            if (appFullscreen) {
                setImmersiveControlsVisible(true, !buffering && !paused && !playerEnded);
            }
            if (buffering) {
                if (pendingBufferingReport != null || roomBufferingActive) return;
                pendingBufferingReport = () -> {
                    pendingBufferingReport = null;
                    if (!playerBuffering || roomBufferingActive || roomClient == null || loadedMedia == null || latestAnchor == null) return;
                    roomBufferingActive = true;
                    playerHint.setText("正在缓冲，房间会暂时等待");
                    roomClient.sendReport(latestAnchor.sequence, latestBufferingPositionSeconds, latestBufferingPaused, latestBufferingReadyState, true, loadedMedia);
                };
                mainHandler.postDelayed(pendingBufferingReport, BUFFERING_DEBOUNCE_MS);
                return;
            }

            boolean wasRoomBufferingActive = roomBufferingActive;
            cancelPendingBufferingReport();
            roomBufferingActive = false;
            if (wasRoomBufferingActive && roomClient != null && loadedMedia != null && latestAnchor != null) {
                playerHint.setText("缓冲结束，等待房间继续");
                roomClient.sendReport(latestAnchor.sequence, latestBufferingPositionSeconds, latestBufferingPaused, latestBufferingReadyState, false, loadedMedia);
            }
        });
    }

    private void cancelPendingBufferingReport() {
        if (pendingBufferingReport == null) return;
        mainHandler.removeCallbacks(pendingBufferingReport);
        pendingBufferingReport = null;
    }

    private void resetBufferingEpisode() {
        cancelPendingBufferingReport();
        roomBufferingActive = false;
    }

    private void applySafeAreaInsets() {
        if (rootLayout == null) return;
        if (appFullscreen || htmlFullscreenView != null) {
            rootLayout.setPadding(0, 0, 0, 0);
            return;
        }
        rootLayout.setPadding(0, systemInsetTop, 0, systemInsetBottom);
    }

    private void updatePortraitComposerPosition() {
        if (rootContainer == null || portraitComposerLayer == null) return;
        syncPortraitComposerVisibility();
        if (portraitComposerLayer.getVisibility() != View.VISIBLE || rootContainer.getHeight() <= 0) {
            setPortraitComposerBottomMargin(systemInsetBottom);
            return;
        }

        int[] rootLocation = new int[2];
        rootContainer.getLocationOnScreen(rootLocation);
        int rootBottomOnScreen = rootLocation[1] + rootContainer.getHeight();

        int imeTopOnScreen = Integer.MAX_VALUE;
        WindowInsets rootInsets = rootContainer.getRootWindowInsets();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && rootInsets != null
            && rootInsets.isVisible(WindowInsets.Type.ime())) {
            int imeBottom = rootInsets.getInsets(WindowInsets.Type.ime()).bottom;
            Rect windowBounds = getWindowManager().getCurrentWindowMetrics().getBounds();
            if (imeBottom >= dp(80)) imeTopOnScreen = windowBounds.bottom - imeBottom;
        }

        Rect visibleFrame = new Rect();
        rootContainer.getWindowVisibleDisplayFrame(visibleFrame);
        int bottomMargin = PortraitComposerPositioner.bottomMargin(
            rootBottomOnScreen,
            visibleFrame.bottom,
            imeTopOnScreen,
            systemInsetBottom,
            dp(80),
            dp(6)
        );
        setPortraitComposerBottomMargin(bottomMargin);
    }

    private void onPortraitComposerFocusChanged(boolean focused) {
        if (rootContainer == null || appFullscreen) return;
        rootContainer.requestApplyInsets();
        rootContainer.post(this::updatePortraitComposerPosition);
        rootContainer.postDelayed(this::updatePortraitComposerPosition, focused ? 80 : 180);
        rootContainer.postDelayed(this::updatePortraitComposerPosition, focused ? 220 : 360);
    }

    private void syncPortraitComposerVisibility() {
        if (portraitComposerLayer == null || portraitChatView == null) return;
        boolean portrait = getResources().getConfiguration().orientation != Configuration.ORIENTATION_LANDSCAPE;
        boolean shouldShow = portrait
            && !appFullscreen
            && htmlFullscreenView == null
            && videoSection != null
            && videoSection.getVisibility() == View.VISIBLE
            && videoFooter != null
            && videoFooter.getVisibility() == View.VISIBLE
            && portraitChatView.getVisibility() == View.VISIBLE;
        if (!shouldShow && portraitComposerLayer.getVisibility() == View.VISIBLE) {
            portraitChatView.dismissComposer();
        }
        portraitComposerLayer.setVisibility(shouldShow ? View.VISIBLE : View.GONE);
        if (shouldShow) portraitComposerLayer.bringToFront();
    }

    private void setPortraitComposerBottomMargin(int bottomMarginPx) {
        if (portraitComposerLayer == null) return;
        int normalizedMargin = Math.max(0, bottomMarginPx);
        if (portraitComposerBottomMargin == normalizedMargin) return;
        portraitComposerBottomMargin = normalizedMargin;
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) portraitComposerLayer.getLayoutParams();
        params.bottomMargin = normalizedMargin;
        portraitComposerLayer.setLayoutParams(params);
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

    private void restoreAccountSession() {
        if (accountSession == null) {
            showAuthScreen();
            if (!accountClient.isConfigured()) authScreen.showMessage("账号服务尚未部署，请先使用匿名房间");
            return;
        }
        if (!accountClient.isConfigured()) {
            showEntryScreen();
            Toast.makeText(this, "账号服务尚未配置，已进入本地房间模式", Toast.LENGTH_SHORT).show();
            return;
        }
        if (accountSession.expiresAt <= System.currentTimeMillis()) {
            clearAccountSession();
            showAuthScreen();
            authScreen.showMessage("登录状态已过期，请重新获取验证码");
            return;
        }
        showEntryScreen();
        registerDeviceTokenIfAvailable();
        long refreshWindowMs = 7L * 24L * 60L * 60L * 1000L;
        if (accountSession.expiresAt - System.currentTimeMillis() <= refreshWindowMs) {
            accountClient.refresh(accountSession.token, new AccountClient.ResultCallback<AccountModels.Session>() {
                @Override public void onSuccess(AccountModels.Session session) {
                    runOnUiThread(() -> finishAccountRestore(session));
                }
                @Override public void onFailure(AccountClient.Failure failure) {
                    runOnUiThread(() -> handleAccountRestoreFailure(failure));
                }
            });
        } else {
            AccountModels.Session cached = accountSession;
            accountClient.me(cached.token, new AccountClient.ResultCallback<AccountModels.User>() {
                @Override public void onSuccess(AccountModels.User user) {
                    runOnUiThread(() -> finishAccountRestore(new AccountModels.Session(cached.token, cached.expiresAt, user)));
                }
                @Override public void onFailure(AccountClient.Failure failure) {
                    runOnUiThread(() -> handleAccountRestoreFailure(failure));
                }
            });
        }
    }

    private void requestAccountCode(String email) {
        authScreen.setRequestLoading(true);
        accountClient.sendCode(email, new AccountClient.ResultCallback<AccountModels.SendCodeResult>() {
            @Override public void onSuccess(AccountModels.SendCodeResult result) {
                runOnUiThread(() -> {
                    authScreen.setRequestLoading(false);
                    String message = "验证码已发送，" + Math.max(1, result.expiresInSeconds / 60) + " 分钟内有效";
                    if (!result.debugCode.isEmpty()) message += " · 测试码 " + result.debugCode;
                    authScreen.showCodeStep(message);
                });
            }
            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> {
                    authScreen.setRequestLoading(false);
                    authScreen.showMessage(failure.getMessage());
                });
            }
        });
    }

    private void verifyAccountCode(String email, String code) {
        authScreen.setVerifyLoading(true);
        String deviceName = android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL;
        accountClient.verifyCode(email, code, deviceName.trim(), new AccountClient.ResultCallback<AccountModels.Session>() {
            @Override public void onSuccess(AccountModels.Session session) {
                runOnUiThread(() -> {
                    authScreen.setVerifyLoading(false);
                    if (!saveAccountSession(session)) {
                        authScreen.showMessage("无法安全保存登录状态，请检查系统安全设置");
                        accountClient.logout(session.token, new AccountClient.ResultCallback<Void>() {
                            @Override public void onSuccess(Void ignored) {}
                            @Override public void onFailure(AccountClient.Failure failure) {}
                        });
                        return;
                    }
                    Toast.makeText(MainActivity.this, "登录成功", Toast.LENGTH_SHORT).show();
                    registerDeviceTokenIfAvailable();
                    showEntryScreen();
                });
            }
            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> {
                    authScreen.setVerifyLoading(false);
                    authScreen.showMessage(failure.getMessage());
                });
            }
        });
    }

    private void registerDeviceTokenIfAvailable() {
        if (accountSession == null || !accountClient.isConfigured()) return;
        pushTokenProvider.refreshToken(this, new PushTokenProvider.Callback() {
            @Override public void onToken(String token) {
                if (token == null || token.trim().isEmpty() || accountSession == null) return;
                String normalized = token.trim();
                String previous = registeredPushToken;
                registeredPushToken = normalized;
                if (previous != null && !previous.equals(normalized)) {
                    accountClient.unregisterDevice(accountSession.token, previous, pushTokenProvider.providerId(), new AccountClient.ResultCallback<Void>() {
                        @Override public void onSuccess(Void ignored) {}
                        @Override public void onFailure(AccountClient.Failure failure) {}
                    });
                }
                String deviceName = android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL;
                accountClient.registerDevice(accountSession.token, normalized, pushTokenProvider.providerId(), deviceName.trim(), BuildConfig.VERSION_NAME,
                    new AccountClient.ResultCallback<AccountModels.DeviceRegistration>() {
                        @Override public void onSuccess(AccountModels.DeviceRegistration result) {}
                        @Override public void onFailure(AccountClient.Failure failure) {
                            if (failure.isAuthenticationFailure()) runOnUiThread(() -> handleAccountRestoreFailure(failure));
                        }
                    });
            }
            @Override public void onUnavailable() {}
        });
    }
    private void finishAccountRestore(AccountModels.Session session) {
        if (!saveAccountSession(session)) {
            clearAccountSession();
            showAuthScreen();
            authScreen.showMessage("无法恢复安全登录状态，请重新登录");
            return;
        }
        registerDeviceTokenIfAvailable();
        showEntryScreen();
    }

    private void handleAccountRestoreFailure(AccountClient.Failure failure) {
        if (failure.isAuthenticationFailure()) {
            clearAccountSession();
            showAuthScreen();
            authScreen.showMessage("登录状态已失效，请重新获取验证码");
            return;
        }
        showEntryScreen();
        Toast.makeText(this, failure.getMessage() + "，房间功能仍可使用", Toast.LENGTH_LONG).show();
    }

    private boolean saveAccountSession(AccountModels.Session session) {
        try {
            boolean accountChanged = accountSession == null || !accountSession.user.id.equals(session.user.id);
            sessionStore.save(session);
            accountSession = session;
            if (accountChanged) resetPairState();
            preferences.edit().putString("nickname", session.user.nickname).apply();
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    private void clearAccountSession() {
        accountSession = null;
        registeredPushToken = null;
        resetPairState();
        sessionStore.clear();
        homeScreen.setAnonymousState();
    }

    private void resetPairState() {
        currentPair = null;
        currentPairState = AccountModels.PairState.empty();
        currentPairInvite = null;
        pairMessage = "";
        pairLoading = false;
        pairLoaded = false;
    }

    private View pairPage() {
        return mainNavigationView.pairPage(
            accountSession.user.nickname,
            accountSession.user.email,
            accountSession.user.id,
            currentPairState,
            currentPairInvite,
            pairMessage,
            pairLoading,
            new MainNavigationView.PairActions() {
                @Override public void onCreateInvite() { createPairInvite(); }
                @Override public void onCopyInvite() { copyPairInvite(); }
                @Override public void onAcceptInvite(String code) { acceptPairInvite(code); }
                @Override public void onRefresh() { refreshPairState(true); }
                @Override public void onInviteWatch() { inviteBoundFriendToWatch(); }
                @Override public void onEditProfile() { showEditProfileDialog(); }
                @Override public void onRequestUnbind() { showUnbindRetentionChoice(); }
                @Override public void onChooseArchiveRetention(AccountModels.PairArchive archive) { showArchiveRetentionChoice(archive); }
                @Override public void onLogout() { confirmAccountLogout(); }
            }
        );
    }

    private void showEditProfileDialog() {
        if (accountSession == null || pairLoading) return;
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(accountSession.user.nickname);
        input.setSelection(input.length());
        input.setHint("1–24 个字符");
        int padding = dp(18);
        FrameLayout holder = new FrameLayout(this);
        holder.setPadding(padding, dp(4), padding, 0);
        holder.addView(input, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        new AlertDialog.Builder(this)
            .setTitle("编辑昵称")
            .setMessage("昵称会显示在双人空间和之后进入的房间消息中。")
            .setView(holder)
            .setNegativeButton("取消", null)
            .setPositiveButton("保存", (dialog, which) -> updateAccountNickname(input.getText().toString()))
            .show();
    }

    private void updateAccountNickname(String value) {
        AccountModels.Session session = accountSession;
        if (session == null || pairLoading) return;
        String nickname = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        int codePoints = nickname.codePointCount(0, nickname.length());
        if (codePoints < 1 || codePoints > 24) {
            Toast.makeText(this, "昵称需要为 1–24 个字符", Toast.LENGTH_SHORT).show();
            return;
        }
        pairLoading = true;
        pairMessage = "正在保存个人资料…";
        showMainTab("pair");
        accountClient.updateProfile(session.token, nickname, new AccountClient.ResultCallback<AccountModels.User>() {
            @Override public void onSuccess(AccountModels.User user) {
                runOnUiThread(() -> {
                    pairLoading = false;
                    AccountModels.Session updated = new AccountModels.Session(session.token, session.expiresAt, user);
                    if (!saveAccountSession(updated)) {
                        pairMessage = "昵称已更新，但本机保存失败，请重新登录。";
                        showMainTab("pair");
                        return;
                    }
                    currentRoomNickname = user.nickname;
                    pairMessage = authenticated
                        ? "昵称已更新；对方将在你下次进入房间时看到新昵称。"
                        : "昵称已更新。";
                    showMainTab("pair");
                });
            }

            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> {
                    pairLoading = false;
                    pairMessage = failure.getMessage();
                    if (failure.isAuthenticationFailure()) handleAccountRestoreFailure(failure);
                    else showMainTab("pair");
                });
            }
        });
    }

    private void createPairInvite() {
        if (accountSession == null || pairLoading) return;
        pairLoading = true;
        pairMessage = "正在生成一次性邀请码…";
        showMainTab("pair");
        accountClient.createPairInvite(accountSession.token, new AccountClient.ResultCallback<AccountModels.PairInvite>() {
            @Override public void onSuccess(AccountModels.PairInvite invite) {
                runOnUiThread(() -> {
                    currentPairInvite = invite;
                    pairLoading = false;
                    pairLoaded = true;
                    pairMessage = "邀请码已生成，24 小时内有效。";
                    showMainTab("pair");
                });
            }

            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> handlePairFailure(failure));
            }
        });
    }

    private void copyPairInvite() {
        if (currentPairInvite == null) return;
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard == null) return;
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("同看好友邀请码", currentPairInvite.code));
        Toast.makeText(this, "邀请码已复制", Toast.LENGTH_SHORT).show();
    }

    private void acceptPairInvite(String code) {
        if (accountSession == null || pairLoading) return;
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            pairMessage = "请输入好友发来的邀请码。";
            showMainTab("pair");
            return;
        }
        pairLoading = true;
        pairMessage = "正在建立双人连接…";
        showMainTab("pair");
        accountClient.acceptPairInvite(accountSession.token, normalized, new AccountClient.ResultCallback<AccountModels.Pair>() {
            @Override public void onSuccess(AccountModels.Pair pair) {
                runOnUiThread(() -> {
                    currentPair = pair;
                    currentPairState = new AccountModels.PairState(pair, currentPairState.pendingArchives, currentPairState.archives);
                    currentPairInvite = null;
                    pairLoading = false;
                    pairLoaded = true;
                    pairMessage = "绑定成功，现在可以一键邀请一起看。";
                    showMainTab("pair");
                });
            }

            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> handlePairFailure(failure));
            }
        });
    }

    private void refreshPairState(boolean userInitiated) {
        refreshPairState(userInitiated, null);
    }

    private void refreshPairState(boolean userInitiated, String successMessage) {
        if (accountSession == null || pairLoading) return;
        pairLoading = true;
        if (successMessage != null) {
            pairMessage = "正在同步好友和旧空间状态…";
        } else if (userInitiated) {
            pairMessage = "正在刷新绑定状态…";
        }
        showMainTab("pair");
        accountClient.getPair(accountSession.token, new AccountClient.ResultCallback<AccountModels.PairState>() {
            @Override public void onSuccess(AccountModels.PairState pairState) {
                runOnUiThread(() -> {
                    currentPairState = pairState;
                    currentPair = pairState.pair;
                    if (currentPair != null) currentPairInvite = null;
                    pairLoading = false;
                    pairLoaded = true;
                    pairMessage = successMessage != null
                        ? successMessage
                        : (userInitiated ? (currentPair == null ? "好友和旧空间状态已更新。" : "绑定状态已更新。") : "");
                    showMainTab("pair");
                });
            }

            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> handlePairFailure(failure));
            }
        });
    }

    private void showUnbindRetentionChoice() {
        AccountModels.Pair pair = currentPair;
        if (accountSession == null || pair == null || pairLoading) return;
        new AlertDialog.Builder(this)
            .setTitle("解除好友绑定？")
            .setMessage("解除后会立即释放唯一好友名额，也不会退出账号或影响匿名房间。下一步需要选择是否保留与 " + pair.partner.nickname + " 的旧空间。")
            .setNegativeButton("取消", null)
            .setPositiveButton("继续选择", (dialog, which) -> showRetentionChoice(pair.pairId, pair.partner.nickname, true))
            .show();
    }

    private void showArchiveRetentionChoice(AccountModels.PairArchive archive) {
        if (accountSession == null || archive == null || pairLoading) return;
        showRetentionChoice(archive.pairId, archive.partner.nickname, false);
    }

    private void showRetentionChoice(String pairId, String partnerNickname, boolean unbind) {
        String[] labels = {"保留只读旧空间", "删除我的旧空间访问权"};
        String message = unbind
            ? "请选择解除绑定后如何处理与 " + partnerNickname + " 的旧空间。选择确认后不能修改。"
            : "请选择如何处理与 " + partnerNickname + " 的旧空间。选择确认后不能修改。";
        new AlertDialog.Builder(this)
            .setTitle("选择旧空间处理方式")
            .setMessage(message)
            .setItems(labels, (dialog, index) -> confirmRetentionChoice(pairId, partnerNickname, unbind, index == 0 ? "keep" : "delete"))
            .setNegativeButton("取消", null)
            .show();
    }

    private void confirmRetentionChoice(String pairId, String partnerNickname, boolean unbind, String retention) {
        boolean keep = "keep".equals(retention);
        String title = keep ? "确认保留旧空间？" : "确认删除访问权？";
        String effect = keep
            ? "你之后仍可查看与 " + partnerNickname + " 的只读旧空间。"
            : "你将无法再查看与 " + partnerNickname + " 的旧空间；只有双方都选择删除时，底层数据才会物理清理。";
        String prefix = unbind ? "好友绑定会立即解除。" : "这个选择确认后不能修改。";
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(prefix + effect)
            .setNegativeButton("返回", null)
            .setPositiveButton(keep ? "确认保留" : "确认删除", (dialog, which) -> submitPairRetention(pairId, retention, unbind))
            .show();
    }

    private void submitPairRetention(String pairId, String retention, boolean unbind) {
        AccountModels.Session session = accountSession;
        if (session == null || pairLoading) return;
        pairLoading = true;
        pairMessage = unbind ? "正在解除好友绑定…" : "正在保存旧空间选择…";
        showMainTab("pair");
        AccountClient.ResultCallback<AccountModels.PairMutationResult> callback = new AccountClient.ResultCallback<AccountModels.PairMutationResult>() {
            @Override public void onSuccess(AccountModels.PairMutationResult result) {
                runOnUiThread(() -> {
                    applyConfirmedPairMutation(pairId, unbind, result);
                    pairLoading = false;
                    pairLoaded = true;
                    String message;
                    if (result.pairDeleted) {
                        message = "双方都已选择删除，旧空间已经清理。";
                    } else if ("keep".equals(retention)) {
                        message = unbind ? "好友绑定已解除，旧空间已保留为只读。" : "旧空间已保留为只读。";
                    } else {
                        message = unbind ? "好友绑定已解除，你的旧空间访问权已删除。" : "你的旧空间访问权已删除。";
                    }
                    refreshPairState(false, message);
                });
            }

            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> handlePairMutationFailure(failure));
            }
        };
        if (unbind) {
            accountClient.unbindPair(session.token, pairId, retention, callback);
        } else {
            accountClient.decidePairArchive(session.token, pairId, retention, callback);
        }
    }

    private void applyConfirmedPairMutation(
        String pairId,
        boolean unbind,
        AccountModels.PairMutationResult result
    ) {
        AccountModels.PairState state = currentPairState == null
            ? AccountModels.PairState.empty()
            : currentPairState;
        List<AccountModels.PairArchive> pendingArchives = archivesWithoutPair(state.pendingArchives, pairId);
        List<AccountModels.PairArchive> archives = archivesWithoutPair(state.archives, pairId);
        if (result.archive != null) archives.add(result.archive);

        AccountModels.Pair activePair = unbind ? null : currentPair;
        currentPair = activePair;
        currentPairState = new AccountModels.PairState(activePair, pendingArchives, archives);
        if (unbind) currentPairInvite = null;
    }

    private static List<AccountModels.PairArchive> archivesWithoutPair(
        List<AccountModels.PairArchive> source,
        String pairId
    ) {
        List<AccountModels.PairArchive> result = new ArrayList<>();
        for (AccountModels.PairArchive archive : source) {
            if (!archive.pairId.equals(pairId)) result.add(archive);
        }
        return result;
    }

    private void handlePairMutationFailure(AccountClient.Failure failure) {
        pairLoading = false;
        if (failure.isAuthenticationFailure()) {
            handleAccountRestoreFailure(failure);
            return;
        }
        if (failure.networkFailure || failure.status == 404 || failure.status == 409) {
            pairLoaded = false;
            pairMessage = "操作结果可能已经变化，正在重新读取服务器状态…";
            showMainTab("pair");
            refreshPairState(false, "已刷新服务器状态，请确认当前好友和旧空间结果。");
            return;
        }
        handlePairFailure(failure);
    }

    private void handlePairFailure(AccountClient.Failure failure) {
        pairLoading = false;
        if (failure.isAuthenticationFailure()) {
            handleAccountRestoreFailure(failure);
            return;
        }
        pairMessage = failure.getMessage();
        showMainTab("pair");
    }

    private void inviteBoundFriendToWatch() {
        if (currentPair == null) {
            pairMessage = "请先完成好友绑定。";
            showMainTab("pair");
            return;
        }
        createRoom(true);
    }

    private void sendPairWatchInvite() {
        AccountModels.Session session = accountSession;
        if (session == null || currentRoomId == null || currentInviteKey == null) {
            shareInvite();
            return;
        }
        String url = PUBLIC_ORIGIN + "/room/" + currentRoomId + "#join=" + currentInviteKey;
        long expiresAt = System.currentTimeMillis() + 10L * 60L * 1000L;
        accountClient.sendWatchInvite(session.token, url, "一起看 B站视频", expiresAt,
            new AccountClient.ResultCallback<AccountModels.WatchInviteResult>() {
                @Override public void onSuccess(AccountModels.WatchInviteResult result) {
                    runOnUiThread(() -> {
                        if (result.fallbackRequired || result.delivered <= 0) {
                            Toast.makeText(MainActivity.this, "好友暂时收不到通知，已打开系统分享", Toast.LENGTH_LONG).show();
                            shareInvite();
                            return;
                        }
                        Toast.makeText(MainActivity.this, "已向好友发送一起看邀请", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override public void onFailure(AccountClient.Failure failure) {
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "推送未送达，已打开系统分享", Toast.LENGTH_LONG).show();
                        if (failure.isAuthenticationFailure()) handleAccountRestoreFailure(failure);
                        shareInvite();
                    });
                }
            });
    }

    private void applyAccountStateToHome() {
        if (accountSession == null) {
            homeScreen.setAnonymousState();
            return;
        }
        homeScreen.setAccountState(accountSession.user.nickname, accountSession.user.email);
        nicknameInput.setText(accountSession.user.nickname);
    }

    private void confirmAccountLogout() {
        new AlertDialog.Builder(this)
            .setTitle("退出同看账号？")
            .setMessage("退出后本机将清除登录状态，匿名房间仍然可以继续使用。")
            .setNegativeButton("取消", null)
            .setPositiveButton("退出", (dialog, which) -> logoutAccount())
            .show();
    }

    private void logoutAccount() {
        AccountModels.Session session = accountSession;
        String pushToken = registeredPushToken != null ? registeredPushToken : FcmPushTokenProvider.cachedToken(this);
        if (session != null && pushToken != null && !pushToken.isEmpty() && accountClient.isConfigured()) {
            accountClient.unregisterDevice(session.token, pushToken, pushTokenProvider.providerId(), new AccountClient.ResultCallback<Void>() {
                @Override public void onSuccess(Void ignored) {}
                @Override public void onFailure(AccountClient.Failure failure) {}
            });
        }
        clearAccountSession();
        authScreen.resetCodeStep();
        authScreen.showMessage("已退出账号");
        showAuthScreen();
        if (session == null || !accountClient.isConfigured()) return;
        accountClient.logout(session.token, new AccountClient.ResultCallback<Void>() {
            @Override public void onSuccess(Void ignored) {}
            @Override public void onFailure(AccountClient.Failure failure) {
                runOnUiThread(() -> Toast.makeText(
                    MainActivity.this,
                    "本机已退出；服务器会话将在过期后自动失效",
                    Toast.LENGTH_LONG
                ).show());
            }
        });
    }

    private void showAuthScreen() {
        appFullscreen = false;
        setImmersiveControlsVisible(false, false);
        if (immersiveTapLayer != null) immersiveTapLayer.setVisibility(View.GONE);
        applyImmersiveMode(false);
        videoSection.setVisibility(View.GONE);
        entryHost.setVisibility(View.VISIBLE);
        if (authScreen.getView().getParent() instanceof ViewGroup) {
            ((ViewGroup) authScreen.getView().getParent()).removeView(authScreen.getView());
        }
        entryHost.removeAllViews();
        entryHost.addView(authScreen.getView(), new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        applyTheme();
    }

    private void showEntryScreen() {
        appFullscreen = false;
        setPortraitComposerBottomMargin(0);
        setImmersiveControlsVisible(false, false);
        if (immersiveTapLayer != null) immersiveTapLayer.setVisibility(View.GONE);
        applyImmersiveMode(false);
        videoSection.setVisibility(View.GONE);
        entryHost.setVisibility(View.VISIBLE);
        if (mainNavigationView.getView().getParent() instanceof ViewGroup) {
            ((ViewGroup) mainNavigationView.getView().getParent()).removeView(mainNavigationView.getView());
        }
        entryHost.removeAllViews();
        entryHost.addView(mainNavigationView.getView(), new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        boolean hasLastRoom = preferences.getString("roomId", null) != null
            && preferences.getString("key", null) != null
            && preferences.getString("role", null) != null;
        continueButton.setVisibility(hasLastRoom ? View.VISIBLE : View.GONE);
        applyAccountStateToHome();
        showMainTab("home");
        applyTheme();
    }

    private void showMainTab(String page) {
        showMainTab(page, false);
    }

    private void showMainTabFromNavigation(String page) {
        showMainTab(page, true);
    }

    private void showMainTab(String page, boolean refreshPairOnEntry) {
        String target = page;
        View content;
        switch (page) {
            case "library":
                content = mainNavigationView.placeholder("02 / LIBRARY", "共同片库", "分类、排序和共享视频将在 Alpha 10 的片库阶段接入。");
                break;
            case "calendar":
                content = mainNavigationView.placeholder("03 / CALENDAR", "观看日历", "日期计划、当天片单和观看安排将在日历阶段接入。");
                break;
            case "pair":
                if (accountSession == null) {
                    content = mainNavigationView.placeholder("04 / US", "我们的空间", "登录后可进入唯一好友绑定、共同历史和观看统计。匿名房间仍然可以继续使用。");
                } else {
                    content = pairPage();
                }
                break;
            case "home":
            default:
                target = "home";
                content = homeScreen.getView();
                boolean hasLastRoom = preferences.getString("roomId", null) != null
                    && preferences.getString("key", null) != null
                    && preferences.getString("role", null) != null;
                continueButton.setVisibility(hasLastRoom ? View.VISIBLE : View.GONE);
                break;
        }
        mainNavigationView.select(target);
        mainNavigationView.showContent(content);
        mainNavigationView.applyTheme();
        if (refreshPairOnEntry && "pair".equals(target) && accountSession != null && !pairLoading) {
            mainHandler.post(() -> refreshPairState(false));
        }
    }

    private void showVideoScreen() {
        entryHost.setVisibility(View.GONE);
        videoSection.setVisibility(View.VISIBLE);
        if (roomMedia == null && loadedMedia == null) showPreparationPanel();
        syncPlayerInteractionLayerVisibility();
        syncVideoFooterVisibility();
        updatePlayerAspectRatio();
        applyTheme();
        rootContainer.post(this::updatePortraitComposerPosition);
    }

    private void showPreparationPanel() {
        if (appFullscreen) toggleAppFullscreen();
        entryHost.setVisibility(View.GONE);
        videoSection.setVisibility(View.VISIBLE);
        preparationPanel.setVisibility(View.VISIBLE);
        playerContainer.setVisibility(roomMedia == null && loadedMedia == null ? View.GONE : View.VISIBLE);
        syncPlayerInteractionLayerVisibility();
        syncVideoFooterVisibility();
        videoInput.requestFocus();
    }

    private void syncVideoFooterVisibility() {
        if (videoFooter == null || playerContainer == null || videoSection == null) return;
        boolean shouldShow = !appFullscreen
            && videoSection.getVisibility() == View.VISIBLE
            && playerContainer.getVisibility() == View.VISIBLE;
        videoFooter.setVisibility(shouldShow ? View.VISIBLE : View.GONE);
        syncPortraitComposerVisibility();
        if (shouldShow && rootContainer != null) rootContainer.post(this::updatePortraitComposerPosition);
    }

    private void syncPlayerInteractionLayerVisibility() {
        if (immersiveTapLayer == null || playerContainer == null || videoSection == null) return;
        boolean shouldIntercept = videoSection.getVisibility() == View.VISIBLE
            && playerContainer.getVisibility() == View.VISIBLE;
        immersiveTapLayer.setVisibility(shouldIntercept ? View.VISIBLE : View.GONE);
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
        capturePlaybackBeforeOrientationChange();
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
        setPortraitComposerBottomMargin(0);
        orientationButton.setText(landscape ? "竖屏" : "横屏");
        setButtonIcon(orientationButton, R.drawable.ic_rotate);
        rootContainer.post(() -> {
            if (appFullscreen) updateFullscreenPlayerLayout();
            else updatePlayerAspectRatio();
            applySafeAreaInsets();
            updatePortraitComposerPosition();
            restorePlaybackAfterOrientationChange();
        });
    }

    private void capturePlaybackBeforeOrientationChange() {
        orientationWasPlaying = playerReady && !playerPaused && !playerEnded && !playerBuffering;
        ignoreOrientationPauseUntilMs = orientationWasPlaying
            ? System.currentTimeMillis() + 1200
            : 0;
    }

    private void restorePlaybackAfterOrientationChange() {
        if (!orientationWasPlaying) return;
        mainHandler.postDelayed(() -> {
            if (orientationWasPlaying && playerReady && !playerEnded) {
                evaluatePlayer("window.__tongkanSetPlaying && window.__tongkanSetPlaying(true);");
            }
            orientationWasPlaying = false;
            ignoreOrientationPauseUntilMs = 0;
        }, 450);
    }

    private void toggleAppFullscreen() {
        appFullscreen = !appFullscreen;
        setPortraitComposerBottomMargin(0);
        mainHandler.removeCallbacks(hideImmersiveControls);
        mainHandler.removeCallbacks(hideImmersiveAdjustmentHud);
        if (appFullscreen) {
            immersiveGestureController.beginSession();
            if (!preferences.getBoolean("immersiveGestureHintShown", false)) {
                preferences.edit().putBoolean("immersiveGestureHintShown", true).apply();
                Toast.makeText(this, "左侧上下滑动调亮度 · 右侧上下滑动调音量", Toast.LENGTH_LONG).show();
            }
        } else {
            immersiveGestureController.restoreBrightness();
            if (immersiveChatOverlay != null) immersiveChatOverlay.hide();
            if (immersiveAdjustmentHud != null) immersiveAdjustmentHud.setVisibility(View.GONE);
        }
        videoHeader.setVisibility(appFullscreen ? View.GONE : View.VISIBLE);
        syncVideoFooterVisibility();
        preparationPanel.setVisibility(appFullscreen ? View.GONE : (roomMedia == null && loadedMedia == null ? View.VISIBLE : View.GONE));
        videoSection.setPadding(appFullscreen ? 0 : dp(16), appFullscreen ? 0 : dp(12), appFullscreen ? 0 : dp(16), appFullscreen ? 0 : dp(12));
        fullscreenButton.setText(appFullscreen ? "退出全屏" : "全屏");
        setButtonIcon(fullscreenButton, appFullscreen ? R.drawable.ic_exit_fullscreen : R.drawable.ic_fullscreen);
        syncPlayerInteractionLayerVisibility();
        updateFullscreenPlayerLayout();
        applyImmersiveMode(appFullscreen);
        applySafeAreaInsets();
        setImmersiveControlsVisible(appFullscreen, appFullscreen);
    }

    private void applyImmersiveMode(boolean enabled) {
        getWindow().setSoftInputMode(enabled
            ? WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
            : WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
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
        syncPortraitComposerVisibility();
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
        if (appFullscreen && immersiveChatOverlay != null && immersiveChatOverlay.isShowing()) {
            immersiveChatOverlay.hide();
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
        if (entryHost.getVisibility() == View.VISIBLE && mainNavigationView.getView().getParent() == entryHost) {
            if (!"home".equals(mainNavigationView.getCurrentPage())) {
                showMainTab("home");
            } else if (accountSession == null) {
                showAuthScreen();
            } else {
                super.onBackPressed();
            }
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
        ownMemberId = null;
        setChatEnabled(false);
        clearChatMessages();
        currentRoomId = null;
        currentKey = null;
        currentRole = null;
        currentInviteKey = null;
        latestAnchor = null;
        resetBufferingEpisode();
        roomMedia = null;
        loadedMedia = null;
        playerReady = false;
        preferences.edit().remove("roomId").remove("key").remove("role").remove("inviteKey").apply();
        webView.loadUrl("about:blank");
        showEntryScreen();
        setConnectionStatus("已离开房间");
    }

    private void toggleTheme() {
        breathTheme.toggle();
        darkMode = breathTheme.isDark();
        applyTheme();
    }

    private void applyTheme() {
        darkMode = breathTheme.isDark();
        int background = breathTheme.background();
        int surface = breathTheme.panel();
        int primaryText = breathTheme.ink();
        int secondaryText = breathTheme.muted();
        int border = breathTheme.line();
        rootContainer.setBackgroundColor(background);
        rootLayout.setBackgroundColor(background);
        applyThemeRecursive(rootContainer, background, surface, primaryText, secondaryText, border);
        authScreen.applyTheme();
        homeScreen.applyTheme();
        mainNavigationView.applyTheme();
        if (portraitChatView != null) portraitChatView.setDarkMode(darkMode);
        if (immersiveChatOverlay != null) immersiveChatOverlay.setDarkMode(true);
        if (videoThemeButton != null) {
            videoThemeButton.setText(darkMode ? "浅色" : "深色");
            setButtonIcon(videoThemeButton, darkMode ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
            tintButtonDrawables(videoThemeButton, primaryText);
        }
        String danmakuLabel = danmakuVisible ? "弹幕 开" : "弹幕 关";
        danmakuButton.setText(danmakuLabel);
        if (immersiveDanmakuButton != null) immersiveDanmakuButton.setText(danmakuLabel);
        breathTheme.applySystemBars(this, appFullscreen || htmlFullscreenView != null);
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
        states.addState(new int[] {android.R.attr.state_pressed}, rounded(breathTheme.accentSoft(), Color.TRANSPARENT, 0));
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
            if (!loadingVideo || generation != loadingGeneration) return;
            if (preparingLocalVideo) {
                playerHint.setText("视频加载得有点慢，请再等一下");
                cancelPreparationButton.setVisibility(View.VISIBLE);
            } else {
                playerHint.setText("B站播放器加载较慢，请稍候");
            }
        }, 8000);
        mainHandler.postDelayed(() -> {
            if (!loadingVideo || generation != loadingGeneration) return;
            if (preparingLocalVideo) {
                failVideoPreparation("视频准备超时，请重新加载或更换链接");
            } else {
                playerHint.setText("播放器响应较慢，可点击换视频重试");
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
        int normal = primary ? breathTheme.cta() : breathTheme.panel();
        int pressed = primary ? breathTheme.accent() : breathTheme.accentSoft();
        int border = primary ? Color.TRANSPARENT : breathTheme.line();
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
