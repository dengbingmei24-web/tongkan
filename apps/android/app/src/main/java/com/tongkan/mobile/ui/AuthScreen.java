package com.tongkan.mobile.ui;

import android.content.Context;
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

public final class AuthScreen {
    public interface Listener {
        void onToggleTheme();
        void onRequestCode(String email);
        void onVerifyCode(String email, String code);
        void onUseAnonymousRoom();
    }

    private final BreathTheme theme;
    private final BreathComponents components;
    private final ScrollView root;
    private final EditText emailInput;
    private final Button requestCodeButton;
    private final EditText codeInput;
    private final Button verifyCodeButton;
    private final Button changeEmailButton;
    private final ImageButton themeButton;
    private final TextView statusText;
    private final Listener listener;

    public AuthScreen(Context context, BreathTheme theme, Listener listener) {
        this.theme = theme;
        this.listener = listener;
        this.components = new BreathComponents(context, theme);
        root = components.screen();
        LinearLayout content = components.column(23, 28, 28);
        root.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout top = components.row();
        TextView mark = components.code("TK");
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(BreathDrawables.panel(context, theme, 17));
        top.addView(mark, new LinearLayout.LayoutParams(components.dp(50), components.dp(50)));
        View topSpace = new View(context);
        top.addView(topSpace, new LinearLayout.LayoutParams(0, 1, 1f));
        themeButton = components.iconButton(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon, theme.isDark() ? "切换浅色主题" : "切换深色主题");
        themeButton.setOnClickListener(view -> listener.onToggleTheme());
        top.addView(themeButton, new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
        content.addView(top, components.matchWrap());

        TextView kicker = components.text("PRIVATE SIGNAL / TWO PEOPLE", 10, BreathComponents.ROLE_ACCENT_TEXT);
        kicker.setTypeface(Typeface.create("monospace", Typeface.BOLD));
        kicker.setLetterSpacing(0.12f);
        content.addView(kicker, components.margin(components.matchWrap(), 0, 52, 0, 0));

        TextView title = components.title("连接彼此，\n不打扰观看。", 32);
        content.addView(title, components.margin(components.matchWrap(), 0, 14, 0, 0));
        TextView copy = components.body("登录后保存你们的片库、计划和共同观看记录。匿名房间仍然可以继续使用。");
        content.addView(copy, components.margin(components.matchWrap(), 0, 12, 0, 0));

        TextView emailLabel = components.code("邮箱");
        content.addView(emailLabel, components.margin(components.matchWrap(), 0, 28, 0, 8));
        emailInput = components.emailInput("name@example.com");
        emailInput.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_mail, 0, 0, 0);
        emailInput.setCompoundDrawablePadding(components.dp(9));
        content.addView(emailInput, components.matchHeight(52));
        TextView help = components.text("验证码仅用于同看账号登录，不用于营销。", 11, BreathComponents.ROLE_MUTED_TEXT);
        content.addView(help, components.margin(components.matchWrap(), 0, 8, 0, 0));

        requestCodeButton = components.button("获取验证码", true);
        requestCodeButton.setOnClickListener(view -> requestCode());
        content.addView(requestCodeButton, components.margin(components.matchHeight(52), 0, 12, 0, 0));

        codeInput = components.textInput("6 位验证码");
        codeInput.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        codeInput.setFilters(new android.text.InputFilter[] {new android.text.InputFilter.LengthFilter(6)});
        codeInput.setVisibility(View.GONE);
        content.addView(codeInput, components.matchHeight(52));
        verifyCodeButton = components.button("登录同看", true);
        verifyCodeButton.setVisibility(View.GONE);
        verifyCodeButton.setOnClickListener(view -> verifyCode());
        content.addView(verifyCodeButton, components.margin(components.matchHeight(52), 0, 8, 0, 0));
        changeEmailButton = components.button("更换邮箱", false);
        changeEmailButton.setVisibility(View.GONE);
        changeEmailButton.setOnClickListener(view -> {
            resetCodeStep();
            showMessage("请输入新的邮箱地址");
            emailInput.requestFocus();
        });
        content.addView(changeEmailButton, components.margin(components.matchHeight(48), 0, 8, 0, 0));

        Button anonymousButton = components.button("暂时使用匿名房间", false);
        anonymousButton.setOnClickListener(view -> listener.onUseAnonymousRoom());
        content.addView(anonymousButton, components.margin(components.matchHeight(52), 0, 10, 0, 0));

        statusText = components.text("每个账号仅绑定一位好友", 11, BreathComponents.ROLE_MUTED_TEXT);
        statusText.setGravity(Gravity.CENTER);
        content.addView(statusText, components.margin(components.matchWrap(), 0, 22, 0, 0));

        View flexibleSpace = new View(context);
        content.addView(flexibleSpace, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        TextView footer = components.code("TONGKAN ACCOUNT · ALPHA 10");
        footer.setGravity(Gravity.CENTER);
        content.addView(footer, components.margin(components.matchWrap(), 0, 24, 0, 0));
        TextView privacy = components.text("内容流始终由你的设备直接加载", 10, BreathComponents.ROLE_MUTED_TEXT);
        privacy.setGravity(Gravity.CENTER);
        content.addView(privacy, components.margin(components.matchWrap(), 0, 5, 0, 0));
        applyTheme();
    }

    private void requestCode() {
        String email = emailInput.getText().toString().trim();
        if (email.isEmpty() || !email.contains("@") || email.endsWith("@")) {
            showMessage("请输入有效邮箱地址");
            emailInput.requestFocus();
            return;
        }
        listener.onRequestCode(email);
    }

    public View getView() {
        return root;
    }

    private void verifyCode() {
        String code = codeInput.getText().toString().trim();
        if (!code.matches("\\d{6}")) {
            showMessage("请输入 6 位验证码");
            codeInput.requestFocus();
            return;
        }
        listener.onVerifyCode(emailInput.getText().toString().trim(), code);
    }

    public void showCodeStep(String message) {
        emailInput.setEnabled(false);
        requestCodeButton.setText("重新获取验证码");
        codeInput.setVisibility(View.VISIBLE);
        verifyCodeButton.setVisibility(View.VISIBLE);
        changeEmailButton.setVisibility(View.VISIBLE);
        showMessage(message);
        codeInput.requestFocus();
    }

    public void resetCodeStep() {
        emailInput.setEnabled(true);
        codeInput.setText("");
        codeInput.setVisibility(View.GONE);
        verifyCodeButton.setVisibility(View.GONE);
        changeEmailButton.setVisibility(View.GONE);
        requestCodeButton.setText("获取验证码");
    }

    public void setRequestLoading(boolean loading) {
        String idleLabel = codeInput.getVisibility() == View.VISIBLE ? "重新获取验证码" : "获取验证码";
        components.setButtonLoading(requestCodeButton, loading, idleLabel, "正在发送验证码…");
    }

    public void setVerifyLoading(boolean loading) {
        components.setButtonLoading(verifyCodeButton, loading, "登录同看", "正在验证…");
    }

    public void showMessage(String message) {
        statusText.setText(message);
    }

    public void applyTheme() {
        components.applyTheme(root);
        themeButton.setImageResource(theme.isDark() ? R.drawable.ic_theme_sun : R.drawable.ic_theme_moon);
        themeButton.setContentDescription(theme.isDark() ? "切换浅色主题" : "切换深色主题");
        emailInput.setCompoundDrawableTintList(android.content.res.ColorStateList.valueOf(theme.muted()));
        components.applyTheme(codeInput);
    }
}
