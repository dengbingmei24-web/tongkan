package com.tongkan.mobile;

import org.json.JSONObject;
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

    @Test
    public void rejectsHistoryCallbacksFromReplacedRoomClient() {
        RoomClient.Listener listener = new RoomClient.Listener() {
            @Override public void onConnectionState(String state) {}
            @Override public void onAuthenticated(String ownMemberId, JSONObject snapshot) {}
            @Override public void onSnapshot(JSONObject snapshot) {}
            @Override public void onAnchor(PlaybackAnchor anchor, String actorNickname) {}
            @Override public void onError(String message) {}
        };
        RoomClient first = new RoomClient(id('a'), id('b'), "我", listener);
        RoomClient second = new RoomClient(id('a'), id('b'), "我", listener);
        try {
            assertTrue(MainActivity.historyClientMatches(first, first));
            assertFalse(MainActivity.historyClientMatches(first, second));
            assertFalse(MainActivity.historyClientMatches(null, second));
        } finally {
            first.close();
            second.close();
        }
    }

    private static String id(char value) {
        return String.valueOf(value).repeat(32);
    }
}
