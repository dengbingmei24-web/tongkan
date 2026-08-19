package com.tongkan.mobile.ui;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.tongkan.mobile.account.AccountModels;

import java.util.List;

public final class RoomLibraryPickerDialog {
    public interface Listener {
        void onSelect(AccountModels.LibraryItem item);
        void onManualLink();
    }

    private RoomLibraryPickerDialog() {}

    public static Dialog show(
        Context context,
        BreathTheme theme,
        AccountModels.LibrarySnapshot snapshot,
        boolean landscape,
        Listener listener
    ) {
        BreathComponents components = new BreathComponents(context, theme);
        Dialog dialog = new Dialog(context);
        LinearLayout root = components.column(landscape ? 18 : 20, 18, 20);
        root.setTag(BreathComponents.ROLE_PANEL);
        root.setBackground(BreathDrawables.panel(context, theme, landscape ? 0 : 24));

        LinearLayout header = components.row();
        LinearLayout titles = new LinearLayout(context);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.addView(components.title("从共同片库换视频", landscape ? 22 : 24), components.matchWrap());
        titles.addView(components.body("按分类浏览，选中后从 0 秒暂停切换。"), components.margin(components.matchWrap(), 0, 4, 0, 0));
        header.addView(titles, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button close = components.button("关闭", false);
        close.setOnClickListener(view -> dialog.dismiss());
        header.addView(close, new LinearLayout.LayoutParams(components.dp(76), components.dp(44)));
        root.addView(header, components.matchWrap());

        EditText search = components.input("搜索标题、UP 主或 BV 号", InputType.TYPE_CLASS_TEXT);
        root.addView(search, components.margin(components.matchHeight(50), 0, 16, 0, 0));

        LinearLayout list = new LinearLayout(context);
        list.setOrientation(LinearLayout.VERTICAL);
        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.addView(list, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        Button manual = components.button("粘贴新链接", false);
        manual.setOnClickListener(view -> {
            dialog.dismiss();
            listener.onManualLink();
        });
        root.addView(manual, components.margin(components.matchHeight(48), 0, 12, 0, 0));

        Runnable render = () -> renderItems(context, theme, components, snapshot, search.getText().toString(), list, dialog, listener);
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence value, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence value, int start, int before, int count) { render.run(); }
            @Override public void afterTextChanged(Editable value) {}
        });
        render.run();
        components.applyTheme(root);
        dialog.setContentView(root);
        dialog.show();
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.dimAmount = landscape ? 0.18f : 0.28f;
            attributes.gravity = landscape ? Gravity.END : Gravity.BOTTOM;
            window.setAttributes(attributes);
            int screenWidth = context.getResources().getDisplayMetrics().widthPixels;
            int screenHeight = context.getResources().getDisplayMetrics().heightPixels;
            int width = landscape ? Math.min(components.dp(430), Math.round(screenWidth * 0.58f)) : ViewGroup.LayoutParams.MATCH_PARENT;
            int height = landscape ? ViewGroup.LayoutParams.MATCH_PARENT : Math.min(components.dp(650), Math.round(screenHeight * 0.76f));
            window.setLayout(width, height);
        }
        return dialog;
    }

    private static void renderItems(
        Context context,
        BreathTheme theme,
        BreathComponents components,
        AccountModels.LibrarySnapshot snapshot,
        String query,
        LinearLayout target,
        Dialog dialog,
        Listener listener
    ) {
        target.removeAllViews();
        List<AccountModels.LibraryItem> visible = LibraryScreen.State.filteredItems(snapshot, query, "all", null);
        if (visible.isEmpty()) {
            target.addView(components.body("没有符合搜索的视频。"), components.margin(components.matchWrap(), 0, 10, 0, 0));
            return;
        }
        for (LibraryScreen.State.ItemGroup group : LibraryScreen.State.groupedItems(snapshot, visible)) {
            target.addView(components.section(group.label + " · " + group.items.size()), components.margin(components.matchWrap(), 0, 14, 0, 7));
            for (AccountModels.LibraryItem item : group.items) {
                LinearLayout row = components.row();
                row.setPadding(components.dp(10), components.dp(9), components.dp(10), components.dp(9));
                row.setTag(BreathComponents.ROLE_PANEL);
                row.setBackground(BreathDrawables.panel(context, theme, 16));
                ImageView cover = new ImageView(context);
                LibraryCoverLoader.load(cover, item.coverUrl, theme);
                row.addView(cover, new LinearLayout.LayoutParams(components.dp(104), components.dp(59)));
                LinearLayout details = new LinearLayout(context);
                details.setOrientation(LinearLayout.VERTICAL);
                TextView title = components.section(item.title);
                title.setMaxLines(2);
                details.addView(title, components.matchWrap());
                String metadata = item.ownerName == null ? item.bvid : item.ownerName + " · " + item.bvid;
                details.addView(components.body(metadata), components.margin(components.matchWrap(), 0, 4, 0, 0));
                row.addView(details, components.margin(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f), 11, 0, 0, 0));
                row.setClickable(true);
                row.setFocusable(true);
                row.setContentDescription("切换到 " + item.title);
                row.setOnClickListener(view -> {
                    dialog.dismiss();
                    listener.onSelect(item);
                });
                target.addView(row, components.margin(components.matchWrap(), 0, 0, 0, 8));
            }
        }
    }
}
