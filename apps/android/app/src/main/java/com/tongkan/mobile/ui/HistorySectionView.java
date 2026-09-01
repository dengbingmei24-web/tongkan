package com.tongkan.mobile.ui;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.tongkan.mobile.account.AccountModels;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class HistorySectionView {
    public interface Actions {
        void onRefresh();
        void onLoadMore();
        void onCloseArchive();
        void onPlay(AccountModels.HistoryItem item);
    }

    private final Context context;
    private final BreathTheme theme;
    private final BreathComponents components;

    public HistorySectionView(Context context, BreathTheme theme) {
        this.context = context;
        this.theme = theme;
        this.components = new BreathComponents(context, theme);
    }

    public View render(
        AccountModels.HistoryPage page,
        AccountModels.MonthlySummary summary,
        boolean loading,
        boolean error,
        String message,
        boolean archive,
        String archivePartner,
        Actions actions
    ) {
        LinearLayout section = components.column(0, 0, 0);
        section.addView(components.code(archive ? "HISTORY / READ ONLY" : "HISTORY / TOGETHER"), components.matchWrap());
        section.addView(components.section(archive ? "与 " + safePartner(archivePartner) + " 的旧历史" : "一起看过"),
            components.margin(components.matchWrap(), 0, 8, 0, 0));
        section.addView(components.body(archive
            ? "保留的旧空间只读展示，不会参与当前好友关系。"
            : "共同播放满 60 秒后才会出现在这里；完成状态暂不推断。"),
            components.margin(components.matchWrap(), 0, 7, 0, 0));

        if (archive) {
            Button back = components.button("返回当前空间", false);
            back.setOnClickListener(view -> actions.onCloseArchive());
            section.addView(back, components.margin(components.matchHeight(48), 0, 12, 0, 0));
        }

        if (summary != null) section.addView(summaryPanel(summary), components.margin(components.matchWrap(), 0, 12, 0, 0));

        if (loading && page == null) {
            section.addView(statusPanel("正在读取共同历史…", null), components.margin(components.matchWrap(), 0, 12, 0, 0));
        } else if (error && page == null) {
            section.addView(statusPanel(message == null || message.isEmpty() ? "共同历史暂时无法读取，房间功能不受影响。" : message,
                retryButton(actions)), components.margin(components.matchWrap(), 0, 12, 0, 0));
        } else if (page == null || page.items.isEmpty()) {
            section.addView(statusPanel("还没有满 60 秒的共同观看记录。", loading ? null : retryButton(actions)),
                components.margin(components.matchWrap(), 0, 12, 0, 0));
        } else {
            for (AccountModels.HistoryItem item : page.items) {
                section.addView(itemPanel(item, actions), components.margin(components.matchWrap(), 0, 10, 0, 0));
            }
            if (page.nextCursor != null) {
                Button more = components.button(loading ? "正在加载…" : "加载更多", false);
                more.setEnabled(!loading);
                more.setOnClickListener(view -> actions.onLoadMore());
                section.addView(more, components.margin(components.matchHeight(48), 0, 10, 0, 0));
            }
            if (error && message != null && !message.isEmpty()) {
                section.addView(components.body(message), components.margin(components.matchWrap(), 0, 8, 0, 0));
            }
        }
        components.applyTheme(section);
        return section;
    }

    private LinearLayout summaryPanel(AccountModels.MonthlySummary summary) {
        LinearLayout panel = components.panel(16);
        panel.addView(components.code(summary.month + " / MONTH"), components.matchWrap());
        panel.addView(components.title(State.durationLabel(summary.totalWatchedSeconds), 24), components.margin(components.matchWrap(), 0, 14, 0, 0));
        String detail = summary.sessionCount + " 次共同观看 · " + summary.distinctVideoCount + " 个视频";
        if (summary.lastWatchedDate != null) detail += " · 最近 " + State.dateLabel(summary.lastWatchedDate);
        panel.addView(components.body(detail), components.margin(components.matchWrap(), 0, 5, 0, 0));
        return panel;
    }

    private LinearLayout itemPanel(AccountModels.HistoryItem item, Actions actions) {
        LinearLayout panel = components.panel(14);
        LinearLayout row = components.row();
        ImageView cover = new ImageView(context);
        LibraryCoverLoader.load(cover, item.media.coverUrl, theme);
        row.addView(cover, new LinearLayout.LayoutParams(components.dp(112), components.dp(63)));
        LinearLayout text = components.column(0, 0, 0);
        TextView title = components.section(item.media.title);
        title.setMaxLines(2);
        text.addView(title, components.matchWrap());
        text.addView(components.body(item.media.bvid + (item.media.page > 1 ? " · P" + item.media.page : "")),
            components.margin(components.matchWrap(), 0, 4, 0, 0));
        text.addView(components.body(State.dateTimeLabel(item.endedAt) + " · 共同 " + State.durationLabel(item.watchedSeconds)),
            components.margin(components.matchWrap(), 0, 3, 0, 0));
        row.addView(text, components.margin(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f), 12, 0, 0, 0));
        panel.addView(row, components.matchWrap());
        Button play = components.button("在房间中播放", false);
        play.setGravity(Gravity.CENTER);
        play.setOnClickListener(view -> actions.onPlay(item));
        panel.addView(play, components.margin(components.matchHeight(44), 0, 10, 0, 0));
        return panel;
    }

    private LinearLayout statusPanel(String text, View action) {
        LinearLayout panel = components.panel(16);
        panel.addView(components.body(text), components.matchWrap());
        if (action != null) panel.addView(action, components.margin(components.matchHeight(46), 0, 10, 0, 0));
        return panel;
    }

    private Button retryButton(Actions actions) {
        Button retry = components.button("重新读取历史", false);
        retry.setOnClickListener(view -> actions.onRefresh());
        return retry;
    }

    private static String safePartner(String value) {
        return value == null || value.trim().isEmpty() ? "旧好友" : value.trim();
    }

    public static final class State {
        private State() {}

        public static AccountModels.HistoryPage mergePages(AccountModels.HistoryPage first, AccountModels.HistoryPage next) {
            if (first == null) return next;
            if (next == null || !first.pairId.equals(next.pairId) || first.readOnly != next.readOnly) return first;
            List<AccountModels.HistoryItem> items = new ArrayList<>(first.items);
            Set<String> ids = new HashSet<>();
            for (AccountModels.HistoryItem item : items) ids.add(item.id);
            for (AccountModels.HistoryItem item : next.items) if (ids.add(item.id)) items.add(item);
            return new AccountModels.HistoryPage(first.pairId, first.readOnly, next.nextCursor, items);
        }

        public static String durationLabel(int seconds) {
            int safe = Math.max(0, seconds);
            int hours = safe / 3600;
            int minutes = (safe % 3600) / 60;
            if (hours > 0) return minutes > 0 ? hours + " 小时 " + minutes + " 分钟" : hours + " 小时";
            return Math.max(1, minutes) + " 分钟";
        }

        public static String dateLabel(String date) {
            if (!AccountModels.isCalendarDate(date)) return "未知日期";
            return date.substring(5, 7) + " 月 " + date.substring(8, 10) + " 日";
        }

        public static String dateTimeLabel(long timestamp) {
            return new SimpleDateFormat("MM 月 dd 日 HH:mm", Locale.CHINA).format(new Date(timestamp));
        }
    }
}
