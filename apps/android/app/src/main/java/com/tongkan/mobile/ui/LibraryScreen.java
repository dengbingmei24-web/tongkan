package com.tongkan.mobile.ui;

import android.app.AlertDialog;
import android.content.Context;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.tongkan.mobile.account.AccountModels;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public final class LibraryScreen {
    public interface Listener {
        void onRefresh();
        void onBatchAdd(List<String> inputs, String categoryId);
        void onCreateCategory(String name);
        void onRenameCategory(AccountModels.LibraryCategory category, String name);
        void onDeleteCategory(AccountModels.LibraryCategory category);
        void onReorderCategories(List<String> orderedIds);
        void onUpdateItem(AccountModels.LibraryItem item, String categoryId, String watchStatus, boolean refreshMetadata);
        void onClearItemCategory(AccountModels.LibraryItem item);
        void onDeleteItem(AccountModels.LibraryItem item);
        void onReorderItems(List<String> orderedIds);
        void onPlay(AccountModels.LibraryItem item);
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
    private String query = "";
    private String status = "all";
    private String categoryId;
    private boolean sorting;
    private AccountModels.LibrarySnapshot snapshot;
    private List<AccountModels.PairArchive> archives = Collections.emptyList();
    private List<String> retryInputs = Collections.emptyList();
    private boolean roomConnected;
    private boolean loading;
    private String message = "";
    private PageState pageState = PageState.LOADING;
    private View root;

    public LibraryScreen(Context context, BreathTheme theme, Listener listener) {
        this.context = context;
        this.theme = theme;
        this.listener = listener;
        this.components = new BreathComponents(context, theme);
    }

    public View render(
        PageState state,
        AccountModels.LibrarySnapshot snapshot,
        List<AccountModels.PairArchive> archives,
        List<String> retryInputs,
        boolean roomConnected,
        boolean loading,
        String message
    ) {
        this.pageState = state;
        this.snapshot = snapshot;
        this.archives = archives == null ? Collections.emptyList() : archives;
        this.retryInputs = retryInputs == null ? Collections.emptyList() : retryInputs;
        this.roomConnected = roomConnected;
        this.loading = loading;
        this.message = message == null ? "" : message;
        root = build();
        return root;
    }

    public void applyTheme() {
        if (root != null) components.applyTheme(root);
    }

    private View build() {
        ScrollView scroll = components.screen();
        LinearLayout content = components.column(20, 22, 28);
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        content.addView(components.code(snapshot != null && snapshot.readOnly ? "02 / ARCHIVE" : "02 / LIBRARY"), components.matchWrap());
        content.addView(components.title(snapshot != null && snapshot.readOnly ? "旧空间片库" : "共同片库", 32), components.margin(components.matchWrap(), 0, 7, 0, 0));
        content.addView(components.body(snapshot != null && snapshot.readOnly
            ? "这里保留你们过去共同收藏的视频，只读查看，不会修改旧空间。"
            : "两个人共同添加、分类和排序，选中视频即可开始同看。"), components.margin(components.matchWrap(), 0, 7, 0, 0));

        if (!message.isEmpty()) {
            TextView notice = components.text(message, 12, BreathComponents.ROLE_ACCENT_TEXT);
            content.addView(notice, components.margin(components.matchWrap(), 0, 12, 0, 0));
        }

        if (pageState == PageState.UNAUTHENTICATED) {
            content.addView(statePanel("登录后使用共同片库", "匿名房间仍可使用；登录并绑定唯一好友后，片库会在两台设备间同步。", "前往登录", listener::onOpenAccount), components.margin(components.matchWrap(), 0, 24, 0, 0));
            return finish(scroll);
        }
        if (pageState == PageState.LOADING && snapshot == null) {
            content.addView(statePanel("正在同步片库", "正在读取共同分类、视频和最新排序。", null, null), components.margin(components.matchWrap(), 0, 24, 0, 0));
            return finish(scroll);
        }
        if (pageState == PageState.ERROR && snapshot == null) {
            content.addView(statePanel("片库暂时无法读取", message.isEmpty() ? "请检查网络后重试。" : message, "重新加载", listener::onRefresh), components.margin(components.matchWrap(), 0, 24, 0, 0));
            addArchiveSection(content);
            return finish(scroll);
        }
        if (pageState == PageState.UNBOUND && snapshot == null) {
            content.addView(statePanel("还没有共同片库", "完成唯一好友绑定后，两个人会自动进入同一份片库。", "前往我们的空间", listener::onOpenAccount), components.margin(components.matchWrap(), 0, 24, 0, 0));
            addArchiveSection(content);
            return finish(scroll);
        }

        addToolbar(content);
        addFilters(content);
        addArchiveSection(content);
        List<AccountModels.LibraryItem> visibleItems = State.filteredItems(snapshot, query, status, categoryId);
        if (visibleItems.isEmpty()) {
            String emptyTitle = snapshot.items.isEmpty() ? "把想看的视频放进来" : "没有符合筛选的视频";
            String emptyBody = snapshot.items.isEmpty() ? "一次最多粘贴 20 条 B站链接，重复视频会自动识别。" : "换个关键词、分类或观看状态再试试。";
            content.addView(statePanel(emptyTitle, emptyBody, snapshot.readOnly ? null : "添加视频", snapshot.readOnly ? null : this::showBatchDialog), components.margin(components.matchWrap(), 0, 18, 0, 0));
        } else {
            for (AccountModels.LibraryItem item : visibleItems) {
                content.addView(itemPanel(item, visibleItems), components.margin(components.matchWrap(), 0, 12, 0, 0));
            }
        }
        return finish(scroll);
    }

    private View finish(View view) {
        components.applyTheme(view);
        return view;
    }

    private void addToolbar(LinearLayout content) {
        LinearLayout row = components.row();
        Button refresh = components.button(loading ? "同步中…" : "刷新", false);
        refresh.setEnabled(!loading);
        refresh.setOnClickListener(view -> listener.onRefresh());
        row.addView(refresh, components.weight(1));
        if (snapshot.readOnly) {
            Button close = components.button("返回当前片库", false);
            close.setOnClickListener(view -> listener.onCloseArchive());
            row.addView(close, components.margin(components.weight(1), 8, 0, 0, 0));
        } else {
            Button add = components.button("添加视频", true);
            add.setEnabled(!loading);
            add.setOnClickListener(view -> showBatchDialog());
            row.addView(add, components.margin(components.weight(1), 8, 0, 0, 0));
        }
        content.addView(row, components.margin(components.matchHeight(48), 0, 18, 0, 0));

        if (!snapshot.readOnly) {
            LinearLayout actions = components.row();
            Button category = components.button("管理分类", false);
            category.setEnabled(!loading);
            category.setOnClickListener(view -> showCategoryManager());
            actions.addView(category, components.weight(1));
            Button sort = components.button(sorting ? "完成排序" : "调整排序", false);
            sort.setEnabled(!loading && !snapshot.items.isEmpty());
            sort.setOnClickListener(view -> {
                sorting = !sorting;
                root = build();
                replaceRoot(view, root);
            });
            actions.addView(sort, components.margin(components.weight(1), 8, 0, 0, 0));
            content.addView(actions, components.margin(components.matchHeight(48), 0, 8, 0, 0));
        }
    }

    private void addFilters(LinearLayout content) {
        EditText search = components.input("搜索标题、UP 主或 BV 号", InputType.TYPE_CLASS_TEXT);
        search.setText(query);
        search.setSelection(search.length());
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence value, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence value, int start, int before, int count) { query = value.toString(); }
            @Override public void afterTextChanged(Editable value) {}
        });
        search.setOnEditorActionListener((view, actionId, event) -> {
            rerenderFrom(view);
            return true;
        });
        content.addView(search, components.margin(components.matchHeight(50), 0, 16, 0, 0));

        LinearLayout statusRow = components.row();
        statusRow.addView(filterButton("全部", "all"), components.weight(1));
        statusRow.addView(filterButton("未观看", "unwatched"), components.margin(components.weight(1), 7, 0, 0, 0));
        statusRow.addView(filterButton("已看完", "watched"), components.margin(components.weight(1), 7, 0, 0, 0));
        content.addView(statusRow, components.margin(components.matchHeight(44), 0, 9, 0, 0));

        if (!snapshot.categories.isEmpty()) {
            LinearLayout categoryRow = components.row();
            Button all = components.button(categoryId == null ? "分类：全部" : "全部分类", categoryId == null);
            all.setOnClickListener(view -> { categoryId = null; rerenderFrom(view); });
            categoryRow.addView(all, components.weight(1));
            Button choose = components.button(categoryName(categoryId), categoryId != null);
            choose.setOnClickListener(view -> showCategoryFilter(view));
            categoryRow.addView(choose, components.margin(components.weight(1), 7, 0, 0, 0));
            content.addView(categoryRow, components.margin(components.matchHeight(44), 0, 0, 0, 0));
        }
    }

    private Button filterButton(String label, String value) {
        Button button = components.button(label, value.equals(status));
        button.setOnClickListener(view -> { status = value; rerenderFrom(view); });
        return button;
    }

    private LinearLayout itemPanel(AccountModels.LibraryItem item, List<AccountModels.LibraryItem> visibleItems) {
        LinearLayout panel = components.panel(16);
        LinearLayout titleRow = components.row();
        LinearLayout textColumn = new LinearLayout(context);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        TextView title = components.section(item.title);
        title.setMaxLines(2);
        textColumn.addView(title, components.matchWrap());
        String metadata = item.bvid + (item.page > 1 ? " · P" + item.page : "")
            + (item.ownerName == null ? "" : " · " + item.ownerName)
            + (item.durationSeconds == null ? "" : " · " + duration(item.durationSeconds));
        textColumn.addView(components.body(metadata), components.margin(components.matchWrap(), 0, 5, 0, 0));
        titleRow.addView(textColumn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView state = components.text("watched".equals(item.watchStatus) ? "已看完" : "想看", 11,
            "watched".equals(item.watchStatus) ? BreathComponents.ROLE_MUTED_TEXT : BreathComponents.ROLE_ACCENT_TEXT);
        state.setGravity(Gravity.END);
        titleRow.addView(state, new LinearLayout.LayoutParams(components.dp(58), ViewGroup.LayoutParams.WRAP_CONTENT));
        panel.addView(titleRow, components.matchWrap());

        String category = item.categoryId == null ? "未分类" : categoryName(item.categoryId);
        String metadataState = "partial".equals(item.metadataStatus) ? " · 信息待补全" : "";
        panel.addView(components.body(category + " · 由 " + item.addedBy.nickname + " 添加" + metadataState), components.margin(components.matchWrap(), 0, 8, 0, 0));

        LinearLayout actions = components.row();
        if (sorting && !snapshot.readOnly) {
            int index = snapshot.items.indexOf(item);
            Button up = components.button("上移", false);
            up.setEnabled(!loading && index > 0);
            up.setOnClickListener(view -> listener.onReorderItems(State.movedItemIds(snapshot.items, index, -1)));
            actions.addView(up, components.weight(1));
            Button down = components.button("下移", false);
            down.setEnabled(!loading && index >= 0 && index < snapshot.items.size() - 1);
            down.setOnClickListener(view -> listener.onReorderItems(State.movedItemIds(snapshot.items, index, 1)));
            actions.addView(down, components.margin(components.weight(1), 8, 0, 0, 0));
        } else {
            Button play = components.button(State.playLabel(roomConnected), true);
            play.setEnabled(!loading);
            play.setOnClickListener(view -> listener.onPlay(item));
            actions.addView(play, components.weight(1));
            if (!snapshot.readOnly) {
                Button more = components.button("管理", false);
                more.setEnabled(!loading);
                more.setOnClickListener(view -> showItemActions(item));
                actions.addView(more, components.margin(components.weight(1), 8, 0, 0, 0));
            }
        }
        panel.addView(actions, components.margin(components.matchHeight(46), 0, 14, 0, 0));
        return panel;
    }

    private void addArchiveSection(LinearLayout content) {
        if (archives.isEmpty() || (snapshot != null && snapshot.readOnly)) return;
        content.addView(components.section("保留的旧空间"), components.margin(components.matchWrap(), 0, 22, 0, 0));
        for (AccountModels.PairArchive archive : archives) {
            LinearLayout panel = components.panel(15);
            panel.addView(components.section("与 " + archive.partner.nickname + " 的片库"), components.matchWrap());
            panel.addView(components.body("解绑后保留 · 只读"), components.margin(components.matchWrap(), 0, 5, 0, 0));
            Button open = components.button("查看旧片库", false);
            open.setEnabled(!loading);
            open.setOnClickListener(view -> listener.onOpenArchive(archive));
            panel.addView(open, components.margin(components.matchHeight(46), 0, 12, 0, 0));
            content.addView(panel, components.margin(components.matchWrap(), 0, 10, 0, 0));
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

    private void showBatchDialog() {
        if (snapshot == null || snapshot.readOnly || loading) return;
        EditText input = new EditText(context);
        input.setHint("每行一条 B站链接，最多 20 条");
        input.setGravity(Gravity.TOP | Gravity.START);
        input.setMinLines(7);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        input.setText(String.join("\n", retryInputs));
        if (input.length() > 0) input.setSelection(input.length());
        new AlertDialog.Builder(context)
            .setTitle("批量添加视频")
            .setMessage(categoryId == null ? "将添加到未分类" : "将添加到「" + categoryName(categoryId) + "」")
            .setView(input)
            .setNegativeButton("取消", null)
            .setPositiveButton("添加", (dialog, which) -> {
                List<String> values = State.splitBatchInput(input.getText().toString());
                if (values.size() > 20) values = new ArrayList<>(values.subList(0, 20));
                listener.onBatchAdd(values, categoryId);
            })
            .show();
    }

    private void showCategoryFilter(View source) {
        String[] labels = new String[snapshot.categories.size()];
        for (int index = 0; index < labels.length; index += 1) labels[index] = snapshot.categories.get(index).name;
        new AlertDialog.Builder(context)
            .setTitle("选择分类")
            .setItems(labels, (dialog, index) -> {
                categoryId = snapshot.categories.get(index).id;
                rerenderFrom(source);
            })
            .setNegativeButton("取消", null)
            .show();
    }

    private void showCategoryManager() {
        if (snapshot == null || snapshot.readOnly || loading) return;
        List<String> labels = new ArrayList<>();
        labels.add("＋ 新建分类");
        for (AccountModels.LibraryCategory category : snapshot.categories) labels.add(category.name);
        new AlertDialog.Builder(context)
            .setTitle("管理分类")
            .setItems(labels.toArray(new String[0]), (dialog, index) -> {
                if (index == 0) showCategoryNameDialog(null);
                else showCategoryActions(snapshot.categories.get(index - 1));
            })
            .setNegativeButton("关闭", null)
            .show();
    }

    private void showCategoryNameDialog(AccountModels.LibraryCategory category) {
        EditText input = components.textInput("1–24 个字符");
        if (category != null) input.setText(category.name);
        new AlertDialog.Builder(context)
            .setTitle(category == null ? "新建分类" : "重命名分类")
            .setView(input)
            .setNegativeButton("取消", null)
            .setPositiveButton("保存", (dialog, which) -> {
                if (category == null) listener.onCreateCategory(input.getText().toString());
                else listener.onRenameCategory(category, input.getText().toString());
            })
            .show();
    }

    private void showCategoryActions(AccountModels.LibraryCategory category) {
        String[] actions = {"重命名", "上移", "下移", "删除分类"};
        new AlertDialog.Builder(context)
            .setTitle(category.name)
            .setItems(actions, (dialog, index) -> {
                int currentIndex = snapshot.categories.indexOf(category);
                if (index == 0) showCategoryNameDialog(category);
                else if (index == 1 && currentIndex > 0) listener.onReorderCategories(State.movedCategoryIds(snapshot.categories, currentIndex, -1));
                else if (index == 2 && currentIndex < snapshot.categories.size() - 1) listener.onReorderCategories(State.movedCategoryIds(snapshot.categories, currentIndex, 1));
                else if (index == 3) confirmDeleteCategory(category);
            })
            .setNegativeButton("取消", null)
            .show();
    }

    private void confirmDeleteCategory(AccountModels.LibraryCategory category) {
        new AlertDialog.Builder(context)
            .setTitle("删除分类？")
            .setMessage("分类中的视频会变为未分类，不会删除视频。")
            .setNegativeButton("取消", null)
            .setPositiveButton("删除", (dialog, which) -> listener.onDeleteCategory(category))
            .show();
    }

    private void showItemActions(AccountModels.LibraryItem item) {
        String watchAction = "watched".equals(item.watchStatus) ? "标记为未观看" : "标记为已看完";
        String[] actions = {watchAction, "移动分类", "刷新视频信息", "删除视频"};
        new AlertDialog.Builder(context)
            .setTitle(item.title)
            .setItems(actions, (dialog, index) -> {
                if (index == 0) listener.onUpdateItem(item, null, "watched".equals(item.watchStatus) ? "unwatched" : "watched", false);
                else if (index == 1) showMoveCategory(item);
                else if (index == 2) listener.onUpdateItem(item, null, null, true);
                else if (index == 3) confirmDeleteItem(item);
            })
            .setNegativeButton("取消", null)
            .show();
    }

    private void showMoveCategory(AccountModels.LibraryItem item) {
        String[] labels = new String[snapshot.categories.size() + 1];
        labels[0] = "未分类";
        for (int index = 0; index < snapshot.categories.size(); index += 1) labels[index + 1] = snapshot.categories.get(index).name;
        new AlertDialog.Builder(context)
            .setTitle("移动到分类")
            .setItems(labels, (dialog, index) -> {
                if (index == 0) listener.onClearItemCategory(item);
                else listener.onUpdateItem(item, snapshot.categories.get(index - 1).id, null, false);
            })
            .setNegativeButton("取消", null)
            .show();
    }

    private void confirmDeleteItem(AccountModels.LibraryItem item) {
        new AlertDialog.Builder(context)
            .setTitle("删除视频？")
            .setMessage("会从两个人的共同片库中删除「" + item.title + "」。")
            .setNegativeButton("取消", null)
            .setPositiveButton("删除", (dialog, which) -> listener.onDeleteItem(item))
            .show();
    }

    private String categoryName(String id) {
        if (id == null || snapshot == null) return "选择分类";
        for (AccountModels.LibraryCategory category : snapshot.categories) if (category.id.equals(id)) return category.name;
        categoryId = null;
        return "选择分类";
    }

    private void rerenderFrom(View source) {
        View newRoot = build();
        replaceRoot(source, newRoot);
        root = newRoot;
    }

    private static void replaceRoot(View source, View replacement) {
        View current = source;
        while (current.getParent() instanceof ViewGroup && !(current.getParent() instanceof android.widget.FrameLayout)) {
            current = (View) current.getParent();
        }
        if (!(current.getParent() instanceof ViewGroup)) return;
        ViewGroup parent = (ViewGroup) current.getParent();
        int index = parent.indexOfChild(current);
        ViewGroup.LayoutParams params = current.getLayoutParams();
        parent.removeViewAt(index);
        parent.addView(replacement, index, params);
    }

    private static String duration(int seconds) {
        int minutes = seconds / 60;
        int remaining = seconds % 60;
        return String.format(Locale.CHINA, "%d:%02d", minutes, remaining);
    }

    public static final class State {
        private State() {}

        public static List<AccountModels.LibraryItem> filteredItems(
            AccountModels.LibrarySnapshot snapshot,
            String query,
            String status,
            String categoryId
        ) {
            if (snapshot == null) return Collections.emptyList();
            String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            List<AccountModels.LibraryItem> result = new ArrayList<>();
            for (AccountModels.LibraryItem item : snapshot.items) {
                if (status != null && !"all".equals(status) && !status.equals(item.watchStatus)) continue;
                if (categoryId != null && !categoryId.equals(item.categoryId)) continue;
                String haystack = (item.title + " " + item.bvid + " " + (item.ownerName == null ? "" : item.ownerName)).toLowerCase(Locale.ROOT);
                if (!normalizedQuery.isEmpty() && !haystack.contains(normalizedQuery)) continue;
                result.add(item);
            }
            return result;
        }

        public static List<String> splitBatchInput(String raw) {
            if (raw == null || raw.trim().isEmpty()) return Collections.emptyList();
            String[] parts = raw.split("[\\r\\n]+", -1);
            List<String> result = new ArrayList<>();
            for (String part : parts) {
                String value = part.trim();
                if (!value.isEmpty()) result.add(value);
            }
            return result;
        }

        public static List<String> movedItemIds(List<AccountModels.LibraryItem> items, int index, int delta) {
            List<String> ids = new ArrayList<>();
            for (AccountModels.LibraryItem item : items) ids.add(item.id);
            return moved(ids, index, delta);
        }

        public static List<String> movedCategoryIds(List<AccountModels.LibraryCategory> categories, int index, int delta) {
            List<String> ids = new ArrayList<>();
            for (AccountModels.LibraryCategory category : categories) ids.add(category.id);
            return moved(ids, index, delta);
        }

        private static List<String> moved(List<String> ids, int index, int delta) {
            int target = index + delta;
            if (index < 0 || index >= ids.size() || target < 0 || target >= ids.size()) return ids;
            Collections.swap(ids, index, target);
            return ids;
        }

        public static String playLabel(boolean roomConnected) {
            return roomConnected ? "换成这个视频" : "立即同看";
        }
    }
}
