package com.tongkan.mobile.ui;

import com.tongkan.mobile.account.AccountModels;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public final class HistorySectionViewStateTest {
    @Test
    public void mergesPagesWithoutDuplicatingSessions() {
        AccountModels.HistoryPage first = new AccountModels.HistoryPage(
            id('a'), false, "next", Arrays.asList(item(id('b'), 200), item(id('c'), 100)));
        AccountModels.HistoryPage next = new AccountModels.HistoryPage(
            id('a'), false, null, Arrays.asList(item(id('c'), 100), item(id('d'), 50)));
        AccountModels.HistoryPage merged = HistorySectionView.State.mergePages(first, next);
        assertEquals(3, merged.items.size());
        assertEquals(id('b'), merged.items.get(0).id);
        assertEquals(id('d'), merged.items.get(2).id);
        assertNull(merged.nextCursor);
    }

    @Test
    public void formatsDurationAndCalendarDates() {
        assertEquals("1 分钟", HistorySectionView.State.durationLabel(60));
        assertEquals("1 小时 5 分钟", HistorySectionView.State.durationLabel(3_900));
        assertEquals("09 月 01 日", HistorySectionView.State.dateLabel("2026-09-01"));
    }

    private static AccountModels.HistoryItem item(String id, int seconds) {
        return new AccountModels.HistoryItem(
            id,
            id('e'),
            1_800_000_000_000L,
            1_800_000_000_000L + seconds * 1_000L,
            seconds,
            "unknown",
            new AccountModels.HistoryMedia(
                "BV1Qxuc62E1y", 1, "https://www.bilibili.com/video/BV1Qxuc62E1y", "测试视频", null)
        );
    }

    private static String id(char value) {
        return String.join("", Collections.nCopies(32, String.valueOf(value)));
    }
}
