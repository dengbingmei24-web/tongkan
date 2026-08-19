package com.tongkan.mobile.ui;

import com.tongkan.mobile.account.AccountModels;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class LibraryScreenStateTest {
    @Test
    public void filtersByQueryStatusAndCategory() {
        AccountModels.LibraryCategory movies = category("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "电影", 0);
        AccountModels.LibraryItem first = item("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "电影一", "UP甲", "unwatched", movies.id, 0);
        AccountModels.LibraryItem second = item("cccccccccccccccccccccccccccccccc", "纪录片", "UP乙", "watched", null, 1);
        AccountModels.LibrarySnapshot snapshot = new AccountModels.LibrarySnapshot(
            "dddddddddddddddddddddddddddddddd", 3, false, Arrays.asList(movies), Arrays.asList(first, second));

        assertEquals(1, LibraryScreen.State.filteredItems(snapshot, "up甲", "all", null).size());
        assertEquals(second.id, LibraryScreen.State.filteredItems(snapshot, "", "watched", null).get(0).id);
        assertEquals(first.id, LibraryScreen.State.filteredItems(snapshot, "", "all", movies.id).get(0).id);
    }

    @Test
    public void splitsBatchMovesItemsAndLabelsPlayback() {
        assertEquals(Arrays.asList("BV1", "BV2"), LibraryScreen.State.splitBatchInput(" BV1 \n\nBV2\r\n"));
        AccountModels.LibraryItem first = item("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "A", null, "unwatched", null, 0);
        AccountModels.LibraryItem second = item("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "B", null, "unwatched", null, 1);
        List<String> moved = LibraryScreen.State.movedItemIds(Arrays.asList(first, second), 0, 1);
        assertEquals(second.id, moved.get(0));
        assertEquals("立即同看", LibraryScreen.State.playLabel(false));
        assertEquals("换成这个视频", LibraryScreen.State.playLabel(true));
        assertTrue(LibraryScreen.State.movedItemIds(Arrays.asList(first), 0, -1).contains(first.id));
    }

    @Test
    public void previewsBatchInputsAndRejectsInvalidRows() {
        List<LibraryScreen.State.BatchDraft> drafts = LibraryScreen.State.batchDrafts(
            "复制打开 https://b23.tv/AbCd123\nhttps://www.bilibili.com/video/BV1Qxuc62E1y?p=2\nhttps://example.com/video"
        );
        assertEquals(3, drafts.size());
        assertEquals("短链待解析", drafts.get(0).label);
        assertEquals("已识别 · P2", drafts.get(1).label);
        assertFalse(drafts.get(2).accepted);
        assertFalse(LibraryScreen.State.isBatchReady(drafts));
        assertTrue(LibraryScreen.State.readyBatchInputs("https://example.com/video").isEmpty());
        assertEquals(2, LibraryScreen.State.readyBatchInputs("BV1Qxuc62E1y\nhttps://b23.tv/AbCd123").size());
    }

    @Test
    public void combinesMultilineShareTextAndSubmitsCanonicalUrls() {
        String share = "【你敢在江浙沪背300块钱的包出门吗—哔哩哔哩】\nhttps://b23.tv/XM569Iw";
        List<LibraryScreen.State.BatchDraft> drafts = LibraryScreen.State.batchDrafts(share);

        assertEquals(1, drafts.size());
        assertEquals("短链待解析", drafts.get(0).label);
        assertEquals(Arrays.asList("https://b23.tv/XM569Iw"), LibraryScreen.State.readyBatchInputs(share));
        assertEquals(
            Arrays.asList("https://www.bilibili.com/video/BV1Qxuc62E1y?p=2"),
            LibraryScreen.State.readyBatchInputs("分享标题 https://www.bilibili.com/video/BV1Qxuc62E1y?p=2")
        );
    }

    @Test
    public void groupsDefaultLibraryByCategoryAndExplainsShortLinkFailure() {
        AccountModels.LibraryCategory movies = category("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "电影", 0);
        AccountModels.LibraryItem first = item("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "电影一", "UP甲", "unwatched", movies.id, 0);
        AccountModels.LibraryItem second = item("cccccccccccccccccccccccccccccccc", "纪录片", "UP乙", "watched", null, 1);
        AccountModels.LibrarySnapshot snapshot = new AccountModels.LibrarySnapshot(
            "dddddddddddddddddddddddddddddddd", 3, false, Arrays.asList(movies), Arrays.asList(first, second));

        List<LibraryScreen.State.ItemGroup> groups = LibraryScreen.State.groupedItems(snapshot, snapshot.items);
        assertEquals(Arrays.asList("电影", "未分类"), Arrays.asList(groups.get(0).label, groups.get(1).label));
        assertTrue(LibraryScreen.State.shouldGroupByCategory("", "all", null, false));
        assertFalse(LibraryScreen.State.shouldGroupByCategory("纪录", "all", null, false));
        AccountModels.BatchItemResult result = new AccountModels.BatchItemResult(
            "https://b23.tv/expired", "rejected", null, "B23_RESOLUTION_FAILED");
        assertEquals("短链失效或视频不可用", LibraryScreen.State.batchResultLabel(result));
    }
    private static AccountModels.LibraryCategory category(String id, String name, int position) {
        return new AccountModels.LibraryCategory(id, name, position, 1, 1);
    }

    private static AccountModels.LibraryItem item(
        String id,
        String title,
        String owner,
        String status,
        String categoryId,
        int position
    ) {
        AccountModels.PublicActor actor = new AccountModels.PublicActor("user", "Alice");
        return new AccountModels.LibraryItem(
            id,
            "BV1Qxuc62E1y",
            1,
            null,
            "https://www.bilibili.com/video/BV1Qxuc62E1y",
            title,
            null,
            owner,
            null,
            "partial",
            categoryId,
            status,
            position,
            actor,
            actor,
            1,
            1
        );
    }
}
