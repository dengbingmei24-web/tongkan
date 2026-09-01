package com.tongkan.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class MainActivityHistoryLifecycleTest {
    @Test
    public void schedulesRefreshAndExpiryWithoutZeroDelayLoops() {
        assertEquals(5_000L, MainActivity.historyScheduleDelay(15_000L, 10_000L));
        assertEquals(1_000L, MainActivity.historyScheduleDelay(9_000L, 10_000L));
    }

    @Test
    public void rejectsStaleOrMismatchedGrantCallbacks() {
        assertTrue(MainActivity.historyLifecycleStateMatches(4, 4, true, true, true, true, true, true));
        assertFalse(MainActivity.historyLifecycleStateMatches(3, 4, true, true, true, true, true, true));
        assertFalse(MainActivity.historyLifecycleStateMatches(4, 4, true, false, true, true, true, true));
        assertFalse(MainActivity.historyLifecycleStateMatches(4, 4, true, true, true, false, true, true));
        assertFalse(MainActivity.historyLifecycleStateMatches(4, 4, true, true, true, true, false, true));
    }
}
