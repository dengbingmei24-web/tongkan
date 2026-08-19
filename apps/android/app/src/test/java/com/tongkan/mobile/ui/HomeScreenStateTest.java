package com.tongkan.mobile.ui;

import com.tongkan.mobile.account.AccountModels;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class HomeScreenStateTest {
    @Test
    public void returnsOnlyPlannedItemsForTargetDateInDisplayOrder() {
        AccountModels.CalendarSnapshot snapshot = new AccountModels.CalendarSnapshot(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            4,
            false,
            new AccountModels.CalendarRange("2026-08-19", "2026-08-19"),
            Arrays.asList(
                plan("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", null, "planned", 3),
                plan("cccccccccccccccccccccccccccccccc", "20:00", "planned", 2),
                plan("dddddddddddddddddddddddddddddddd", "18:00", "completed", 1)
            )
        );

        List<AccountModels.CalendarPlan> plans = HomeScreen.State.plannedForDate(snapshot, "2026-08-19");
        assertEquals(2, plans.size());
        assertEquals("20:00", plans.get(0).startTime);
        assertNull(plans.get(1).startTime);
        assertEquals("当天", HomeScreen.State.timeLabel(null));
        assertEquals("20:00", HomeScreen.State.timeLabel("20:00"));
        assertTrue(HomeScreen.State.plannedForDate(snapshot, "2026-02-30").isEmpty());
    }

    private static AccountModels.CalendarPlan plan(String id, String startTime, String status, long createdAt) {
        AccountModels.PublicActor actor = new AccountModels.PublicActor("user-a", "Alice");
        AccountModels.CalendarMedia media = new AccountModels.CalendarMedia(
            "BV1Qxuc62E1y", 1, "https://www.bilibili.com/video/BV1Qxuc62E1y", "测试视频", null);
        return new AccountModels.CalendarPlan(
            id,
            "ffffffffffffffffffffffffffffffff",
            "2026-08-19",
            startTime,
            null,
            status,
            media,
            actor,
            actor,
            createdAt,
            createdAt + 1,
            "completed".equals(status) ? createdAt + 1 : null
        );
    }
}
