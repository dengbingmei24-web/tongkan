package com.tongkan.mobile.ui;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.ColorDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class BreathBottomSheet {
    private BreathBottomSheet() {}

    public static Dialog create(
        Context context,
        BreathTheme theme,
        String code,
        String title,
        String description,
        View content
    ) {
        BreathComponents components = new BreathComponents(context, theme);
        Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout sheet = components.column(20, 10, 20);
        sheet.setBackground(BreathDrawables.sheet(context, theme));

        View handle = new View(context);
        GradientDrawable handleBackground = BreathDrawables.rounded(
            context,
            theme.darkenedLine(),
            Color.TRANSPARENT,
            2
        );
        handle.setBackground(handleBackground);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(components.dp(42), components.dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        sheet.addView(handle, handleParams);

        if (code != null && !code.trim().isEmpty()) {
            sheet.addView(components.code(code.trim()), components.margin(components.matchWrap(), 0, 18, 0, 0));
        }
        TextView titleView = components.title(title, 24);
        sheet.addView(titleView, components.margin(components.matchWrap(), 0, 7, 0, 0));
        if (description != null && !description.trim().isEmpty()) {
            sheet.addView(components.body(description.trim()), components.margin(components.matchWrap(), 0, 7, 0, 0));
        }
        if (content.getParent() instanceof ViewGroup) {
            ((ViewGroup) content.getParent()).removeView(content);
        }
        sheet.addView(content, components.margin(components.matchWrap(), 0, 18, 0, 0));
        components.applyTheme(sheet);

        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(sheet, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        dialog.setContentView(scroll);
        dialog.setOnShowListener(ignored -> configure(dialog, sheet));
        return dialog;
    }

    private static void configure(Dialog dialog, View sheet) {
        Window window = dialog.getWindow();
        if (window == null) return;
        window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        window.setDimAmount(0.54f);
        window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        WindowManager.LayoutParams params = window.getAttributes();
        params.width = WindowManager.LayoutParams.MATCH_PARENT;
        params.height = WindowManager.LayoutParams.WRAP_CONTENT;
        params.gravity = Gravity.BOTTOM;
        window.setAttributes(params);
        sheet.post(() -> {
            int maxHeight = Math.round(sheet.getResources().getDisplayMetrics().heightPixels * 0.88f);
            int targetHeight = Math.min(sheet.getMeasuredHeight(), maxHeight);
            window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, targetHeight);
        });
    }
}
