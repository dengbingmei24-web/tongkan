package com.tongkan.mobile.account;

import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class AccountClientTest {
    @Test
    public void buildsCalendarCreateUpdateAndStatusBodies() throws Exception {
        JSONObject create = AccountClient.createCalendarPlanBody(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            " 2026-08-20 ",
            " 09:05 ",
            "  晚饭后  ",
            4
        );
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", create.getString("libraryItemId"));
        assertEquals("2026-08-20", create.getString("date"));
        assertEquals("09:05", create.getString("startTime"));
        assertEquals("晚饭后", create.getString("note"));
        assertEquals(4, create.getLong("expectedRevision"));

        JSONObject allDay = AccountClient.updateCalendarPlanDetailsBody(
            "2026-08-21",
            "   ",
            "   ",
            5
        );
        assertTrue(allDay.isNull("startTime"));
        assertTrue(allDay.isNull("note"));
        assertFalse(allDay.has("libraryItemId"));

        JSONObject completed = AccountClient.calendarPlanStatusBody("completed", 6);
        assertEquals("completed", completed.getString("status"));
        assertEquals(6, completed.getLong("expectedRevision"));
    }

    @Test
    public void rejectsInvalidCalendarRequestValues() throws Exception {
        expectIllegalArgument(() -> AccountClient.createCalendarPlanBody(
            "bad", "2026-08-20", null, null, 0));
        expectIllegalArgument(() -> AccountClient.updateCalendarPlanDetailsBody(
            "2026-02-30", null, null, 0));
        expectIllegalArgument(() -> AccountClient.updateCalendarPlanDetailsBody(
            "2026-08-20", "24:00", null, 0));
        expectIllegalArgument(() -> AccountClient.calendarPlanStatusBody("cancelled", 0));
        expectIllegalArgument(() -> AccountClient.calendarPlanStatusBody("planned", -1));
    }

    @Test
    public void parsesCalendarRevisionConflictAndRejectsMalformedConflict() {
        AccountClient.Failure conflict = AccountClient.parseFailure(409,
            "{\"error\":\"CALENDAR_VERSION_CONFLICT\",\"message\":\"stale\",\"currentRevision\":12}");
        assertEquals("CALENDAR_VERSION_CONFLICT", conflict.code);
        assertEquals(12, conflict.currentRevision);
        assertEquals(409, conflict.status);

        AccountClient.Failure missingRevision = AccountClient.parseFailure(409,
            "{\"error\":\"CALENDAR_VERSION_CONFLICT\",\"message\":\"stale\"}");
        assertEquals("INVALID_RESPONSE", missingRevision.code);

        AccountClient.Failure unexpectedRevision = AccountClient.parseFailure(404,
            "{\"error\":\"PLAN_NOT_FOUND\",\"message\":\"missing\",\"currentRevision\":12}");
        assertEquals("INVALID_RESPONSE", unexpectedRevision.code);
    }

    private static void expectIllegalArgument(ThrowingRunnable action) throws Exception {
        try {
            action.run();
            fail("Expected IllegalArgumentException");
        } catch (IllegalArgumentException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }

    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
