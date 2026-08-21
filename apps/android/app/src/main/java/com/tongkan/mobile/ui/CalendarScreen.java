package com.tongkan.mobile.ui;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.tongkan.mobile.account.AccountModels;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class CalendarScreen {
    public interface Listener {
        void onRefresh();
        void onMonthChanged(String month);
        void onDateSelected(String date);
        void onRequestCreate(String date);
        void onCreatePlan(AccountModels.LibraryItem item, String date, String startTime, String note);
        void onUpdatePlan(AccountModels.CalendarPlan plan, String date, String startTime, String note);
        void onTogglePlan(AccountModels.CalendarPlan plan);
        void onCancelPlan(AccountModels.CalendarPlan plan);
        void onPlayPlan(AccountModels.CalendarPlan plan);
        void onOpenArchive(AccountModels.PairArchive archive);
        void onCloseArchive();
        void onOpenAccount();
    }

    public enum PageState {
        UNAUTHENTICATED,
        UNBOUND,
        LOADING,
        ERROR,
        CONTENT
    }

    private final Context context;
    private final BreathTheme theme;
    private final BreathComponents components;
    private final Listener listener;
    private PageState pageState = PageState.LOADING;
    private AccountModels.CalendarSnapshot snapshot;
    private List<AccountModels.PairArchive> archives = Collections.emptyList();
    private String month;
    private String selectedDate;
    private boolean loading;
    private String message = "";
    private View root;

    public CalendarScreen(Context context, BreathTheme theme, Listener listener) {
        this.context = context;
        this.theme = theme;
        this.listener = listener;
        this.components = new BreathComponents(context, theme);
    }

    public View render(
        PageState state,
        AccountModels.CalendarSnapshot snapshot,
        List<AccountModels.PairArchive> archives,
        String month,
        String selectedDate,
        boolean loading,
        String message
    ) {
        this.pageState = state;
        this.snapshot = snapshot;
        this.archives = archives == null ? Collections.emptyList() : archives;
        this.month = AccountModels.isCalendarMonth(month) ? month : State.monthOf(LocalDate.now().toString());
        this.selectedDate = State.selectedDateForMonth(this.month, selectedDate, LocalDate.now().toString());
        this.loading = loading;
        this.message = message == null ? "" : message;
        root = build();
        return root;
    }

    public void applyTheme() {
        if (root != null) components.applyTheme(root);
    }

    public void showCreateDialog(List<AccountModels.LibraryItem> items, String initialDate) {
        if (items == null || items.isEmpty()) {
            Toast.makeText(context, "共同片库还是空的，请先添加视频", Toast.LENGTH_SHORT).show();
            return;
        }
        String date = AccountModels.isCalendarDate(initialDate) ? initialDate : LocalDate.now().toString();
        if (items.size() == 1) {
            showPlanEditor(items.get(0), null, date);
            return;
        }

        LinearLayout content = components.column(0, 0, 0);
        ScrollView scroll = new ScrollView(context);
        LinearLayout list = components.column(0, 0, 0);
        scroll.addView(list, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        content.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, components.dp(330)));
        Button cancel = components.button("返回日历", false);
        content.addView(cancel, components.margin(components.matchHeight(48), 0, 12, 0, 0));

        Dialog[] holder = new Dialog[1];
        for (AccountModels.LibraryItem item : items) {
            Button choose = components.button(item.title + (item.page > 1 ? " · P" + item.page : ""), false);
            choose.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
            choose.setOnClickListener(view -> {
                holder[0].dismiss();
                showPlanEditor(item, null, date);
            });
            list.addView(choose, components.margin(components.matchHeight(50), 0, 0, 0, 8));
        }
        Dialog dialog = BreathBottomSheet.create(
            context,
            theme,
            "03 / CALENDAR · MEDIA",
            "选择共同片库视频",
            "计划只能从当前共同片库创建，保存后双方会看到相同内容。",
            content
        );
        holder[0] = dialog;
        cancel.setOnClickListener(view -> dialog.dismiss());
        dialog.show();
    }

    private View build() {
        ScrollView scroll = components.screen();
        LinearLayout content = components.column(20, 22, 28);
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        boolean readOnly = snapshot != null && snapshot.readOnly;
        content.addView(components.code(readOnly ? "03 / ARCHIVE" : "03 / CALENDAR"), components.matchWrap());
        content.addView(components.title(readOnly ? "旧空间日历" : "观看日历", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        content.addView(components.body(readOnly
            ? "这里保留过去共同安排的观看计划，只读查看，不会修改旧空间。"
            : "把“哪天想看”变成两个人都能看到的约定。"), components.margin(components.matchWrap(), 0, 7, 0, 0));

        if (!message.isEmpty()) {
            content.addView(components.text(message, 12, BreathComponents.ROLE_ACCENT_TEXT), components.margin(components.matchWrap(), 0, 12, 0, 0));
        }

        if (pageState == PageState.UNAUTHENTICATED) {
            content.addView(statePanel("登录后使用观看日历", "匿名房间仍可使用；登录并绑定好友后，计划会在两台设备间同步。", "前往登录", listener::onOpenAccount), components.margin(components.matchWrap(), 0, 24, 0, 0));
            return finish(scroll);
        }
        if (pageState == PageState.LOADING && snapshot == null) {
            content.addView(statePanel("正在同步观看日历", "正在读取这个月的共同计划。", null, null), components.margin(components.matchWrap(), 0, 24, 0, 0));
            return finish(scroll);
        }
        if (pageState == PageState.ERROR && snapshot == null) {
            content.addView(statePanel("日历暂时无法读取", message.isEmpty() ? "请检查网络后重试。" : message, "重新加载", listener::onRefresh), components.margin(components.matchWrap(), 0, 24, 0, 0));
            addArchiveSection(content);
            return finish(scroll);
        }
        if (pageState == PageState.UNBOUND && snapshot == null) {
            content.addView(statePanel("还没有共同日历", "完成唯一好友绑定后，两个人会自动进入同一份观看日历。", "前往我们的空间", listener::onOpenAccount), components.margin(components.matchWrap(), 0, 24, 0, 0));
            addArchiveSection(content);
            return finish(scroll);
        }

        if (readOnly) {
            Button close = components.button("返回当前空间", false);
            close.setEnabled(!loading);
            close.setOnClickListener(view -> listener.onCloseArchive());
            content.addView(close, components.margin(components.matchHeight(48), 0, 18, 0, 0));
        }
        addCalendar(content);
        addDateDetails(content);
        addArchiveSection(content);
        return finish(scroll);
    }

    private View finish(View view) {
        components.applyTheme(view);
        return view;
    }

    private void addCalendar(LinearLayout content) {
        LinearLayout panel = components.panel(16);
        LinearLayout header = components.row();
        LinearLayout monthCopy = components.column(0, 0, 0);
        YearMonth value = YearMonth.parse(month);
        monthCopy.addView(components.code(value.getYear() + " / SHARED"), components.matchWrap());
        monthCopy.addView(components.title(value.getMonthValue() + " 月", 24), components.margin(components.matchWrap(), 0, 4, 0, 0));
        header.addView(monthCopy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button previous = components.button("‹", false);
        previous.setTextSize(24);
        previous.setContentDescription("上个月");
        previous.setEnabled(!loading);
        previous.setOnClickListener(view -> listener.onMonthChanged(State.previousMonth(month)));
        header.addView(previous, new LinearLayout.LayoutParams(components.dp(48), components.dp(48)));
        Button next = components.button("›", false);
        next.setTextSize(24);
        next.setContentDescription("下个月");
        next.setEnabled(!loading);
        next.setOnClickListener(view -> listener.onMonthChanged(State.nextMonth(month)));
        LinearLayout.LayoutParams nextParams = new LinearLayout.LayoutParams(components.dp(48), components.dp(48));
        nextParams.setMargins(components.dp(8), 0, 0, 0);
        header.addView(next, nextParams);
        panel.addView(header, components.matchWrap());

        GridLayout weekdays = new GridLayout(context);
        weekdays.setColumnCount(7);
        String[] labels = {"一", "二", "三", "四", "五", "六", "日"};
        for (int index = 0; index < labels.length; index += 1) {
            TextView label = components.text(labels[index], 10, BreathComponents.ROLE_MUTED_TEXT);
            label.setGravity(Gravity.CENTER);
            GridLayout.LayoutParams params = cellParams(index, components.dp(28));
            weekdays.addView(label, params);
        }
        panel.addView(weekdays, components.margin(components.matchWrap(), 0, 16, 0, 0));

        GridLayout dates = new GridLayout(context);
        dates.setColumnCount(7);
        int leading = State.leadingBlankCount(month);
        int days = State.daysInMonth(month);
        Set<String> plannedDates = State.planDates(snapshot);
        for (int index = 0; index < leading; index += 1) {
            dates.addView(new View(context), cellParams(index, components.dp(52)));
        }
        for (int day = 1; day <= days; day += 1) {
            String date = String.format(Locale.ROOT, "%s-%02d", month, day);
            boolean selected = date.equals(selectedDate);
            boolean planned = plannedDates.contains(date);
            TextView cell = new TextView(context);
            cell.setText(planned ? day + "\n•" : String.valueOf(day));
            cell.setTextSize(planned ? 11 : 12);
            cell.setTypeface(Typeface.create("sans-serif", selected ? Typeface.BOLD : Typeface.NORMAL));
            cell.setGravity(Gravity.CENTER);
            cell.setTextColor(selected ? Color.WHITE : (planned ? theme.accent() : theme.ink()));
            cell.setBackground(dateBackground(selected, planned));
            cell.setContentDescription(date + (planned ? "，有计划" : "") + (selected ? "，已选择" : ""));
            cell.setOnClickListener(view -> listener.onDateSelected(date));
            dates.addView(cell, cellParams(leading + day - 1, components.dp(52)));
        }
        panel.addView(dates, components.margin(components.matchWrap(), 0, 7, 0, 0));
        content.addView(panel, components.margin(components.matchWrap(), 0, 20, 0, 0));
    }

    private GridLayout.LayoutParams cellParams(int index, int height) {
        GridLayout.LayoutParams params = new GridLayout.LayoutParams(
            GridLayout.spec(index / 7),
            GridLayout.spec(index % 7, 1f)
        );
        params.width = 0;
        params.height = height;
        params.setMargins(components.dp(2), components.dp(2), components.dp(2), components.dp(2));
        return params;
    }

    private GradientDrawable dateBackground(boolean selected, boolean planned) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(components.dp(13));
        drawable.setColor(selected ? theme.accent() : Color.TRANSPARENT);
        if (!selected && planned) drawable.setStroke(components.dp(1), theme.accentSoft());
        return drawable;
    }

    private void addDateDetails(LinearLayout content) {
        List<AccountModels.CalendarPlan> plans = State.plansForDate(snapshot, selectedDate);
        LinearLayout heading = components.row();
        heading.addView(components.section(State.dateLabel(selectedDate)), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView count = components.code(plans.size() + (plans.size() == 1 ? " PLAN" : " PLANS"));
        count.setGravity(Gravity.END);
        heading.addView(count, new LinearLayout.LayoutParams(components.dp(96), ViewGroup.LayoutParams.WRAP_CONTENT));
        content.addView(heading, components.margin(components.matchWrap(), 0, 22, 0, 8));

        if (snapshot != null && !snapshot.readOnly) {
            Button add = components.button(loading ? "正在处理…" : "＋ 为这一天安排视频", false);
            add.setEnabled(!loading);
            add.setOnClickListener(view -> listener.onRequestCreate(selectedDate));
            content.addView(add, components.margin(components.matchHeight(48), 0, 0, 0, 12));
        }

        if (plans.isEmpty()) {
            content.addView(statePanel("这一天还没有安排", snapshot != null && snapshot.readOnly
                ? "旧空间在这一天没有保存计划。"
                : "可以从共同片库选择一个视频，时间和备注都可以稍后补充。", null, null), components.matchWrap());
            return;
        }
        for (AccountModels.CalendarPlan plan : plans) {
            content.addView(planPanel(plan), components.margin(components.matchWrap(), 0, 0, 0, 10));
        }
    }

    private LinearLayout planPanel(AccountModels.CalendarPlan plan) {
        LinearLayout panel = components.panel(15);
        LinearLayout mediaRow = components.row();
        ImageView cover = new ImageView(context);
        LibraryCoverLoader.load(cover, plan.media.coverUrl, theme);
        mediaRow.addView(cover, new LinearLayout.LayoutParams(components.dp(88), components.dp(54)));
        LinearLayout copy = components.column(0, 0, 0);
        String status = "completed".equals(plan.status) ? "COMPLETED" : "PLANNED";
        copy.addView(components.code(State.timeLabel(plan.startTime) + " / " + status), components.matchWrap());
        TextView title = components.section(plan.media.title);
        title.setMaxLines(2);
        copy.addView(title, components.margin(components.matchWrap(), 0, 5, 0, 0));
        mediaRow.addView(copy, components.margin(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f), 12, 0, 0, 0));
        panel.addView(mediaRow, components.matchWrap());
        String note = plan.note == null ? "没有备注" : plan.note;
        panel.addView(components.body(note + " · " + plan.media.bvid + (plan.media.page > 1 ? " · P" + plan.media.page : "")), components.margin(components.matchWrap(), 0, 9, 0, 0));
        panel.addView(components.body("最近由 " + plan.updatedBy.nickname + " 更新"), components.margin(components.matchWrap(), 0, 5, 0, 0));

        LinearLayout primaryActions = components.row();
        Button play = components.button("开始同看", true);
        play.setEnabled(!loading);
        play.setOnClickListener(view -> listener.onPlayPlan(plan));
        primaryActions.addView(play, components.weight(1));
        if (snapshot != null && !snapshot.readOnly) {
            Button edit = components.button("编辑", false);
            edit.setEnabled(!loading);
            edit.setOnClickListener(view -> showPlanEditor(null, plan, plan.date));
            primaryActions.addView(edit, components.margin(components.weight(1), 8, 0, 0, 0));
        }
        panel.addView(primaryActions, components.margin(components.matchHeight(46), 0, 14, 0, 0));

        if (snapshot != null && !snapshot.readOnly) {
            LinearLayout management = components.row();
            Button toggle = components.button("completed".equals(plan.status) ? "恢复待看" : "标记完成", false);
            toggle.setEnabled(!loading);
            toggle.setOnClickListener(view -> listener.onTogglePlan(plan));
            management.addView(toggle, components.weight(1));
            Button cancel = components.dangerButton("取消计划");
            cancel.setEnabled(!loading);
            cancel.setOnClickListener(view -> confirmCancel(plan));
            management.addView(cancel, components.margin(components.weight(1), 8, 0, 0, 0));
            panel.addView(management, components.margin(components.matchHeight(46), 0, 8, 0, 0));
        }
        return panel;
    }

    private void addArchiveSection(LinearLayout content) {
        if (archives.isEmpty() || (snapshot != null && snapshot.readOnly)) return;
        content.addView(components.section("保留的旧空间"), components.margin(components.matchWrap(), 0, 24, 0, 8));
        for (AccountModels.PairArchive archive : archives) {
            LinearLayout panel = components.panel(15);
            panel.addView(components.section("与 " + archive.partner.nickname + " 的日历"), components.matchWrap());
            panel.addView(components.body("解绑后保留 · 只读查看"), components.margin(components.matchWrap(), 0, 5, 0, 0));
            Button open = components.button("查看这个月", false);
            open.setEnabled(!loading);
            open.setOnClickListener(view -> listener.onOpenArchive(archive));
            panel.addView(open, components.margin(components.matchHeight(46), 0, 12, 0, 0));
            content.addView(panel, components.margin(components.matchWrap(), 0, 0, 0, 10));
        }
    }

    private LinearLayout statePanel(String title, String body, String action, Runnable callback) {
        LinearLayout panel = components.panel(18);
        panel.addView(components.title(title, 21), components.matchWrap());
        panel.addView(components.body(body), components.margin(components.matchWrap(), 0, 8, 0, 0));
        if (action != null && callback != null) {
            Button button = components.button(action, true);
            button.setOnClickListener(view -> callback.run());
            panel.addView(button, components.margin(components.matchHeight(48), 0, 16, 0, 0));
        }
        return panel;
    }

    private void showPlanEditor(AccountModels.LibraryItem item, AccountModels.CalendarPlan plan, String initialDate) {
        LinearLayout form = components.column(0, 0, 0);
        String mediaTitle = plan == null ? item.title : plan.media.title;
        TextView media = components.section(mediaTitle);
        form.addView(media, components.matchWrap());

        form.addView(components.code("日期 · 必填"), components.margin(components.matchWrap(), 0, 18, 0, 7));
        EditText dateInput = components.textInput("YYYY-MM-DD");
        dateInput.setInputType(InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_DATE);
        dateInput.setText(plan == null ? initialDate : plan.date);
        form.addView(dateInput, components.matchHeight(50));

        form.addView(components.code("开始时间 · 可选"), components.margin(components.matchWrap(), 0, 12, 0, 7));
        EditText timeInput = components.textInput("HH:mm · 留空表示当天");
        timeInput.setInputType(InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
        timeInput.setText(plan == null || plan.startTime == null ? "" : plan.startTime);
        form.addView(timeInput, components.matchHeight(50));

        form.addView(components.code("备注 · 可选"), components.margin(components.matchWrap(), 0, 12, 0, 7));
        EditText noteInput = components.input("最多 200 字", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        noteInput.setSingleLine(false);
        noteInput.setGravity(Gravity.TOP | Gravity.START);
        noteInput.setPadding(components.dp(14), components.dp(12), components.dp(14), components.dp(12));
        noteInput.setMinLines(3);
        noteInput.setMaxLines(5);
        noteInput.setText(plan == null || plan.note == null ? "" : plan.note);
        form.addView(noteInput, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, components.dp(96)));

        TextView errorText = components.text("", 11, BreathComponents.ROLE_MUTED_TEXT);
        errorText.setVisibility(View.GONE);
        form.addView(errorText, components.margin(components.matchWrap(), 0, 8, 0, 0));

        LinearLayout actions = components.row();
        Button close = components.button("返回", false);
        actions.addView(close, components.weight(1));
        Button save = components.button(plan == null ? "保存计划" : "保存修改", true);
        actions.addView(save, components.margin(components.weight(1), 8, 0, 0, 0));
        form.addView(actions, components.margin(components.matchHeight(50), 0, 14, 0, 0));
        components.applyTheme(form);

        Dialog dialog = BreathBottomSheet.create(
            context,
            theme,
            plan == null ? "03 / CALENDAR · CREATE" : "03 / CALENDAR · EDIT",
            plan == null ? "安排观看日期" : "编辑观看计划",
            "日期必填；开始时间和备注可以留空。",
            form
        );
        close.setOnClickListener(view -> dialog.dismiss());
        save.setOnClickListener(view -> {
            try {
                State.Draft draft = State.normalizeDraft(
                    dateInput.getText().toString(),
                    timeInput.getText().toString(),
                    noteInput.getText().toString()
                );
                dialog.dismiss();
                if (plan == null) listener.onCreatePlan(item, draft.date, draft.startTime, draft.note);
                else listener.onUpdatePlan(plan, draft.date, draft.startTime, draft.note);
            } catch (IllegalArgumentException error) {
                errorText.setText(error.getMessage());
                errorText.setTextColor(theme.danger());
                errorText.setVisibility(View.VISIBLE);
            }
        });
        dialog.show();
    }

    private void confirmCancel(AccountModels.CalendarPlan plan) {
        LinearLayout content = components.column(0, 0, 0);
        LinearLayout actions = components.row();
        Button back = components.button("返回", false);
        actions.addView(back, components.weight(1));
        Button confirm = components.dangerButton("确认取消");
        actions.addView(confirm, components.margin(components.weight(1), 8, 0, 0, 0));
        content.addView(actions, components.matchHeight(50));
        Dialog dialog = BreathBottomSheet.create(
            context,
            theme,
            "03 / CALENDAR · REMOVE",
            "取消这个计划？",
            "“" + plan.media.title + "”会从双方日历中移除。",
            content
        );
        back.setOnClickListener(view -> dialog.dismiss());
        confirm.setOnClickListener(view -> {
            dialog.dismiss();
            listener.onCancelPlan(plan);
        });
        dialog.show();
    }

    public static final class State {
        private State() {}

        public static final class Draft {
            public final String date;
            public final String startTime;
            public final String note;

            Draft(String date, String startTime, String note) {
                this.date = date;
                this.startTime = startTime;
                this.note = note;
            }
        }

        public static String previousMonth(String month) {
            return parseMonth(month).minusMonths(1).toString();
        }

        public static String nextMonth(String month) {
            return parseMonth(month).plusMonths(1).toString();
        }

        public static int daysInMonth(String month) {
            return parseMonth(month).lengthOfMonth();
        }

        public static int leadingBlankCount(String month) {
            return parseMonth(month).atDay(1).getDayOfWeek().getValue() - 1;
        }

        public static String monthOf(String date) {
            if (!AccountModels.isCalendarDate(date)) throw new IllegalArgumentException("Invalid date");
            return date.substring(0, 7);
        }

        public static String selectedDateForMonth(String month, String selectedDate, String today) {
            YearMonth value = parseMonth(month);
            if (AccountModels.isCalendarDate(selectedDate) && month.equals(monthOf(selectedDate))) return selectedDate;
            if (AccountModels.isCalendarDate(today) && month.equals(monthOf(today))) return today;
            return value.atDay(1).toString();
        }

        public static List<AccountModels.CalendarPlan> plansForDate(AccountModels.CalendarSnapshot snapshot, String date) {
            if (snapshot == null || !AccountModels.isCalendarDate(date)) return Collections.emptyList();
            List<AccountModels.CalendarPlan> result = new ArrayList<>(snapshot.plansForDate(date, false));
            result.sort(AccountModels.CalendarPlan.DISPLAY_ORDER);
            return result;
        }

        public static List<AccountModels.CalendarPlan> todayPlans(AccountModels.CalendarSnapshot snapshot, String date) {
            if (snapshot == null || !AccountModels.isCalendarDate(date)) return Collections.emptyList();
            List<AccountModels.CalendarPlan> result = new ArrayList<>(snapshot.plansForDate(date, true));
            result.sort(AccountModels.CalendarPlan.DISPLAY_ORDER);
            return result;
        }

        public static Set<String> planDates(AccountModels.CalendarSnapshot snapshot) {
            if (snapshot == null) return Collections.emptySet();
            Set<String> result = new HashSet<>();
            for (AccountModels.CalendarPlan plan : snapshot.plans) result.add(plan.date);
            return result;
        }

        public static String timeLabel(String startTime) {
            return startTime == null || startTime.trim().isEmpty() ? "当天" : startTime;
        }

        public static String dateLabel(String date) {
            if (!AccountModels.isCalendarDate(date)) return "选择日期";
            LocalDate value = LocalDate.parse(date);
            return value.getMonthValue() + " 月 " + value.getDayOfMonth() + " 日";
        }

        public static Draft normalizeDraft(String date, String startTime, String note) {
            String normalizedDate = date == null ? "" : date.trim();
            if (!AccountModels.isCalendarDate(normalizedDate)) {
                throw new IllegalArgumentException("请输入有效日期，例如 2026-08-20。");
            }
            String normalizedTime = startTime == null ? "" : startTime.trim();
            if (!normalizedTime.isEmpty() && !AccountModels.isStartTime(normalizedTime)) {
                throw new IllegalArgumentException("开始时间需要使用 24 小时 HH:mm 格式。");
            }
            String normalizedNote = note == null ? "" : note.trim();
            if (normalizedNote.codePointCount(0, normalizedNote.length()) > 200) {
                throw new IllegalArgumentException("备注最多 200 个字符。");
            }
            return new Draft(
                normalizedDate,
                normalizedTime.isEmpty() ? null : normalizedTime,
                normalizedNote.isEmpty() ? null : normalizedNote
            );
        }

        private static YearMonth parseMonth(String month) {
            if (!AccountModels.isCalendarMonth(month)) throw new IllegalArgumentException("Invalid month");
            try {
                return YearMonth.parse(month);
            } catch (DateTimeParseException error) {
                throw new IllegalArgumentException("Invalid month", error);
            }
        }
    }
}