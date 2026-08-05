package com.tongkan.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
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
import android.net.http.SslError;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
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
    private Button shareButton;
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
    private int readyState;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        playerBridgeScript = readAsset("bilibili-player-bridge.js");
        buildInterface();
        configureWebView();

        nicknameInput.setText(preferences.getString("nickname", "我"));
        String deepLink = getIntent().getDataString();
        if (deepLink != null && InviteInfo.parse(deepLink) != null) {
            inviteInput.setText(deepLink);
            joinInvite(deepLink);
        } else {
            restoreLastRoom();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
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
        if (webView != null) {
            webView.removeJavascriptInterface("TongkanAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    private void buildInterface() {
        getWindow().setStatusBarColor(Color.rgb(17, 18, 23));
        getWindow().setNavigationBarColor(Color.rgb(17, 18, 23));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(16), dp(16), dp(12));
        root.setBackgroundColor(Color.rgb(17, 18, 23));

        TextView title = text("同看 · Android 1.0", 24, Color.WHITE);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        root.addView(title, matchWrap());
        TextView subtitle = text("两部手机加入同一房间，共同控制 B站视频", 13, Color.rgb(170, 174, 186));
        root.addView(subtitle, margin(matchWrap(), 0, 3, 0, 12));

        nicknameInput = edit("你的昵称");
        nicknameInput.setSingleLine(true);
        root.addView(nicknameInput, matchHeight(46));

        LinearLayout createRow = horizontal();
        createButton = button("创建房间", true);
        createButton.setOnClickListener(view -> createRoom());
        createRow.addView(createButton, weight(1));
        shareButton = button("分享邀请", false);
        shareButton.setEnabled(false);
        shareButton.setOnClickListener(view -> shareInvite());
        createRow.addView(shareButton, margin(weight(1), 8, 0, 0, 0));
        root.addView(createRow, margin(matchHeight(46), 0, 8, 0, 0));

        inviteInput = edit("粘贴朋友发来的房间邀请链接");
        inviteInput.setSingleLine(true);
        root.addView(inviteInput, margin(matchHeight(46), 0, 8, 0, 0));
        joinButton = button("加入房间", false);
        joinButton.setOnClickListener(view -> joinInvite(inviteInput.getText().toString()));
        root.addView(joinButton, margin(matchHeight(44), 0, 6, 0, 0));

        roomText = text("尚未进入房间", 13, Color.rgb(207, 210, 218));
        connectionText = text("请先创建或加入房间", 12, Color.rgb(244, 183, 64));
        root.addView(roomText, margin(matchWrap(), 0, 9, 0, 0));
        root.addView(connectionText, matchWrap());

        LinearLayout divider = new LinearLayout(this);
        divider.setBackgroundColor(Color.rgb(49, 51, 61));
        root.addView(divider, margin(matchHeight(1), 0, 12, 0, 12));

        videoInput = edit("粘贴 B站视频链接（BV 或 av）");
        videoInput.setSingleLine(true);
        root.addView(videoInput, matchHeight(46));
        loadVideoButton = button("载入并同步视频", true);
        loadVideoButton.setOnClickListener(view -> loadVideoFromInput());
        root.addView(loadVideoButton, margin(matchHeight(44), 0, 8, 0, 0));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        root.addView(webView, margin(matchHeight(220), 0, 10, 0, 0));

        playerHint = text("等待载入 B站视频", 12, Color.rgb(170, 174, 186));
        playerHint.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(playerHint, matchWrap());

        LinearLayout playbackRow = horizontal();
        playPauseButton = button("播放", true);
        playPauseButton.setEnabled(false);
        playPauseButton.setOnClickListener(view -> evaluatePlayer("window.__tongkanTogglePlayback && window.__tongkanTogglePlayback();"));
        playbackRow.addView(playPauseButton, new LinearLayout.LayoutParams(dp(88), dp(44)));
        timeText = text("00:00 / 00:00", 13, Color.WHITE);
        timeText.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
        playbackRow.addView(timeText, margin(weight(1), 12, 0, 0, 0));
        root.addView(playbackRow, margin(matchHeight(44), 0, 8, 0, 0));

        seekBar = new SeekBar(this);
        seekBar.setMax(1);
        seekBar.setEnabled(false);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                if (fromUser) timeText.setText(formatTime(progress / 1000.0) + " / " + formatTime(durationSeconds));
            }
            @Override public void onStartTrackingTouch(SeekBar bar) { userSeeking = true; }
            @Override public void onStopTrackingTouch(SeekBar bar) {
                userSeeking = false;
                double target = bar.getProgress() / 1000.0;
                evaluatePlayer("window.__tongkanSeekTo && window.__tongkanSeekTo(" + target + ");");
            }
        });
        root.addView(seekBar, matchHeight(40));

        setContentView(root);
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
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new PlayerJavascriptBridge(this), "TongkanAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                playerReady = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isTrustedPlayerUrl(url)) view.evaluateJavascript(playerBridgeScript, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isTrustedPlayerUrl(request.getUrl().toString());
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                playerHint.setText("B站播放器证书校验失败");
            }
        });
    }

    private void createRoom() {
        String nickname = normalizedNickname();
        createButton.setEnabled(false);
        connectionText.setText("正在创建房间…");
        background.execute(() -> {
            try {
                RoomClient.CreateRoomResult result = RoomClient.createRoom();
                runOnUiThread(() -> {
                    createButton.setEnabled(true);
                    connectIdentity(result.roomId, result.hostKey, "host", result.inviteKey, nickname);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    createButton.setEnabled(true);
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
        connectIdentity(invite.roomId, invite.key, invite.role, null, normalizedNickname());
    }

    private void connectIdentity(String roomId, String key, String role, String inviteKey, String nickname) {
        if (roomClient != null) roomClient.close();
        currentRoomId = roomId;
        currentKey = key;
        currentRole = role;
        currentInviteKey = inviteKey;
        authenticated = false;
        roomText.setText("房间 " + roomId.substring(0, 8) + " · " + ("host".equals(role) ? "房主" : "朋友"));
        connectionText.setText("正在连接房间…");
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
            showError("请先连接房间，再载入视频");
            return;
        }
        String input = videoInput.getText().toString();
        loadVideoButton.setEnabled(false);
        playerHint.setText("正在识别 B站链接…");
        background.execute(() -> {
            BilibiliMedia media = BilibiliMedia.parse(input);
            if (media != null && media.unresolved) media = resolveShortLink(media.canonicalUrl);
            BilibiliMedia resolved = media;
            runOnUiThread(() -> {
                loadVideoButton.setEnabled(true);
                if (resolved == null || resolved.embedUrl() == null) {
                    showError("没有识别到可播放的 B站视频，请粘贴完整链接");
                    playerHint.setText("等待有效的 B站视频链接");
                    return;
                }
                playerHint.setText("已提交视频，等待房间确认…");
                roomClient.sendCommand("media-change", 0.0, null, resolved);
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
            PlaybackAnchor anchor = PlaybackAnchor.fromJson(snapshot.getJSONObject("playback"));
            applyAnchor(anchor, "房间");
            JSONObject members = snapshot.optJSONObject("members");
            if (members != null) {
                boolean hostOnline = members.optJSONObject("host") != null && members.optJSONObject("host").optBoolean("connected");
                boolean guestOnline = members.optJSONObject("guest") != null && members.optJSONObject("guest").optBoolean("connected");
                connectionText.setText(hostOnline && guestOnline ? "双方在线 · 可共同控制" : "已连接 · 等待另一部手机加入");
            }
        } catch (JSONException error) {
            showError("房间状态格式异常");
        }
    }

    private void applyAnchor(PlaybackAnchor anchor, String actorNickname) {
        latestAnchor = anchor;
        if (anchor.media == null) {
            playerHint.setText("房间还没有载入视频");
            return;
        }
        videoInput.setText(anchor.media.canonicalUrl);
        if (loadedMedia == null || !loadedMedia.sameIdentity(anchor.media)) {
            loadMedia(anchor.media);
            return;
        }
        if (playerReady) applyLatestAnchorToPlayer();
        playerHint.setText((anchor.paused ? "已暂停" : "正在播放") + " · 操作来自 " + actorNickname);
    }

    private void loadMedia(BilibiliMedia media) {
        String embedUrl = media.embedUrl();
        if (embedUrl == null) {
            showError("这个 B站短链接还没有解析成功");
            return;
        }
        loadedMedia = media;
        playerReady = false;
        durationSeconds = 0;
        seekBar.setEnabled(false);
        playPauseButton.setEnabled(false);
        playerHint.setText("正在载入 " + media.bvid + "…");
        webView.loadUrl(embedUrl, java.util.Collections.singletonMap("Referer", "https://www.bilibili.com/"));
    }

    private void applyLatestAnchorToPlayer() {
        if (latestAnchor == null || roomClient == null || !playerReady) return;
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
        runOnUiThread(() -> connectionText.setText(state));
    }

    @Override
    public void onAuthenticated(String ownMemberId, JSONObject snapshot) {
        runOnUiThread(() -> {
            authenticated = true;
            applySnapshot(snapshot);
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
            playPauseButton.setEnabled(true);
            playerHint.setText("B站播放器已就绪，正在同步房间状态…");
            applyLatestAnchorToPlayer();
        });
    }

    @Override
    public void onLocalCommand(String kind, double positionSeconds, double playbackRate) {
        runOnUiThread(() -> {
            if (!authenticated || roomClient == null || loadedMedia == null) return;
            Double position = ("play".equals(kind) || "pause".equals(kind) || "seek".equals(kind)) ? positionSeconds : null;
            Double rate = "rate".equals(kind) ? playbackRate : null;
            roomClient.sendCommand(kind, position, rate, null);
        });
    }

    @Override
    public void onPlayerState(double positionSeconds, double duration, boolean paused, boolean ended, int state) {
        runOnUiThread(() -> {
            currentPositionSeconds = Math.max(0, positionSeconds);
            durationSeconds = Math.max(0, duration);
            playerPaused = paused;
            readyState = state;
            playPauseButton.setText(paused || ended ? "播放" : "暂停");
            boolean hasDuration = durationSeconds > 0 && Double.isFinite(durationSeconds);
            seekBar.setEnabled(hasDuration && authenticated);
            seekBar.setMax(hasDuration ? Math.max(1, (int) Math.round(durationSeconds * 1000)) : 1);
            if (!userSeeking) seekBar.setProgress((int) Math.min(seekBar.getMax(), Math.round(currentPositionSeconds * 1000)));
            if (!userSeeking) timeText.setText(formatTime(currentPositionSeconds) + " / " + formatTime(durationSeconds));
            if (hasDuration) playerHint.setText(ended ? "播放结束" : (paused ? "已暂停" : "双方同步中"));
        });
    }

    @Override
    public void onBuffering(boolean buffering, double positionSeconds, boolean paused, int state) {
        runOnUiThread(() -> {
            if (roomClient == null || loadedMedia == null || latestAnchor == null) return;
            roomClient.sendReport(latestAnchor.sequence, positionSeconds, paused, state, buffering, loadedMedia);
            playerHint.setText(buffering ? "正在缓冲，房间会暂时等待" : "缓冲结束，等待房间继续");
        });
    }

    private String normalizedNickname() {
        String value = nicknameInput == null ? "我" : nicknameInput.getText().toString().trim();
        if (value.isEmpty()) value = "我";
        return value.length() > 24 ? value.substring(0, 24) : value;
    }

    private boolean isTrustedPlayerUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "player.bilibili.com".equalsIgnoreCase(uri.getHost())
                && "/player.html".equals(uri.getPath());
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

    private void showError(String message) {
        connectionText.setText(message);
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
        view.setHintTextColor(Color.rgb(130, 134, 147));
        view.setTextColor(Color.WHITE);
        view.setTextSize(14);
        view.setSingleLine(true);
        view.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        view.setPadding(dp(12), 0, dp(12), 0);
        view.setBackground(rounded(Color.rgb(30, 32, 39), Color.rgb(65, 68, 79)));
        return view;
    }

    private Button button(String label, boolean primary) {
        Button view = new Button(this);
        view.setText(label);
        view.setTextSize(14);
        view.setAllCaps(false);
        view.setTextColor(primary ? Color.rgb(22, 22, 22) : Color.WHITE);
        view.setBackground(rounded(primary ? Color.rgb(244, 183, 64) : Color.rgb(42, 44, 53), primary ? Color.TRANSPARENT : Color.rgb(72, 75, 87)));
        return view;
    }

    private GradientDrawable rounded(int fill, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(10));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
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
