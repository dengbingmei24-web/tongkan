package com.tongkan.mobile.ui;

import com.tongkan.mobile.account.AccountModels;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class CalendarScreenStateTest {
    @Test
    public void computesMonthNavigationAndSelection() {
        assertEquals("2025-12", CalendarScreen.State.previousMonth("2026-01"));
        assertEquals("2027-01", CalendarScreen.State.nextMonth("2026-12"));
        assertEquals(29, CalendarScreen.State.daysInMonth("2028-02"));
        assertEquals(28, CalendarScreen.State.daysInMonth("2026-02"));
        assertEquals(5, CalendarScreen.State.leadingBlankCount("2026-08"));
        assertEquals("2026-08", CalendarScreen.State.monthOf("2026-08-19"));
        assertEquals("2026-08-20", CalendarScreen.State.selectedDateForMonth(
            "2026-08", "2026-08-20", "2026-08-19"));
        assertEquals("2026-08-19", CalendarScreen.State.selectedDateForMonth(
            "2026-08", "2026-09-01", "2026-08-19"));
        assertEquals("2026-09-01", CalendarScreen.State.selectedDateForMonth(
            "2026-09", null, "2026-08-19"));
    }

    @Test
    public void normalizesDraftAndRejectsInvalidValues() {
        CalendarScreen.State.Draft draft = CalendarScreen.State.normalizeDraft(
            " 2026-08-20 ", " 20:05 ", "  两个人一起看  ");
        assertEquals("2026-08-20", draft.date);
        assertEquals("20:05", draft.startTime);
        assertEquals("两个人一起看", draft.note);

        CalendarScreen.State.Draft allDay = CalendarScreen.State.normalizeDraft(
            "2026-08-20", "   ", "   ");
        assertNull(allDay.startTime);
        assertNull(allDay.note);
        assertEquals("当天", CalendarScreen.State.timeLabel(null));
        assertEquals("08:30", CalendarScreen.State.timeLabel("08:30"));

        expectIllegalArgument(() -> CalendarScreen.State.normalizeDraft("2026-02-30", null, null));
        expectIllegalArgument(() -> CalendarScreen.State.normalizeDraft("2026-08-20", "24:00", null));
        expectIllegalArgument(() -> CalendarScreen.State.normalizeDraft("2026-08-20", null, "字".repeat(201)));
    }

    @Test
    public void selectsDatePlansAndFiltersToday() {
        AccountModels.CalendarPlan allDay = plan(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2026-08-20", null, "planned", 3);
        AccountModels.CalendarPlan completed = plan(
            "cccccccccccccccccccccccccccccccc", "2026-08-20", "18:00", "completed", 1);
        AccountModels.CalendarPlan timed = plan(
            "dddddddddddddddddddddddddddddddd", "2026-08-20", "20:00", "planned", 2);
        AccountModels.CalendarPlan otherDay = plan(
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "2026-08-21", "08:00", "planned", 1);
        AccountModels.CalendarSnapshot snapshot = snapshot(otherDay, allDay, timed, completed);

        List<AccountModels.CalendarPlan> datePlans = CalendarScreen.State.plansForDate(snapshot, "2026-08-20");
        assertEquals(Arrays.asList("18:00", "20:00", null), Arrays.asList(
            datePlans.get(0).startTime, datePlans.get(1).startTime, datePlans.get(2).startTime));
        List<AccountModels.CalendarPlan> today = CalendarScreen.State.todayPlans(snapshot, "2026-08-20");
        assertEquals(2, today.size());
        assertEquals("20:00", today.get(0).startTime);
        assertNull(today.get(1).startTime);
        Set<String> dates = CalendarScreen.State.planDates(snapshot);
        assertTrue(dates.contains("2026-08-20"));
        assertTrue(dates.contains("2026-08-21"));
        assertEquals("8 月 20 日", CalendarScreen.State.dateLabel("2026-08-20"));
    }

    @Test
    public void keepsPlanAndActualWatchMarkersIndependent() {
        AccountModels.CalendarMarkers markers = new AccountModels.CalendarMarkers(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            false,
            "2026-09",
            480,
            Arrays.asList(new AccountModels.CalendarMarker("2026-09-01", 3_900, 2))
        );
        assertTrue(CalendarScreen.State.watchDates(markers).contains("2026-09-01"));
        assertEquals(2, CalendarScreen.State.markerForDate(markers, "2026-09-01").sessionCount);
        assertEquals("1\n• ◆", CalendarScreen.State.dayCellLabel(1, true, true));
        assertEquals("1 小时 5 分钟", CalendarScreen.State.durationLabel(3_900));
        assertFalse(CalendarScreen.State.watchDates(markers).contains("2026-09-02"));
    }

    private static AccountModels.CalendarSnapshot snapshot(AccountModels.CalendarPlan... plans) {
        return new AccountModels.CalendarSnapshot(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            4,
            false,
            new AccountModels.CalendarRange("2026-08-01", "2026-08-31"),
            Arrays.asList(plans)
        );
    }

    private static AccountModels.CalendarPlan plan(
        String id,
        String date,
        String startTime,
        String status,
        long createdAt
    ) {
        AccountModels.PublicActor actor = new AccountModels.PublicActor("user-a", "Alice");
        AccountModels.CalendarMedia media = new AccountModels.CalendarMedia(
            "BV1Qxuc62E1y", 1, "https://www.bilibili.com/video/BV1Qxuc62E1y", "测试视频", null);
        return new AccountModels.CalendarPlan(
            id,
            "ffffffffffffffffffffffffffffffff",
            date,
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

    private static void expectIllegalArgument(Runnable action) {
        try {
            action.run();
            fail("Expected IllegalArgumentException");
        } catch (IllegalArgumentException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }
}
