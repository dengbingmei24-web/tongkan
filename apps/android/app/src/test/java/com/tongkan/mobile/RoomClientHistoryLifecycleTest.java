package com.tongkan.mobile;

import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class RoomClientHistoryLifecycleTest {
    private static final BilibiliMedia MEDIA = new BilibiliMedia(
        "BV1Qxuc62E1y", null, 1, "https://www.bilibili.com/video/BV1Qxuc62E1y", false);
    private static final BilibiliMedia OTHER_MEDIA = new BilibiliMedia(
        "BV1xx411c7mD", null, 1, "https://www.bilibili.com/video/BV1xx411c7mD", false);

    @Test
    public void usesFiveSecondPeriodicCadence() {
        assertEquals(5_000L, RoomClient.PLAYBACK_REPORT_INTERVAL_MS);
    }

    @Test
    public void sendsImmediatelyOnlyForAuthorityStateChanges() {
        RoomClient.PlaybackReportState initial = state(4, 10, false, 4, false, MEDIA, false, 300.0);
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(null, initial));
        assertFalse(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(4, 14, false, 4, false, MEDIA, false, 300.0)));
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(4, 10, true, 4, false, MEDIA, false, 300.0)));
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(4, 10, false, 4, true, MEDIA, false, 300.0)));
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(5, 10, false, 4, false, MEDIA, false, 300.0)));
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(4, 10, false, 4, false, OTHER_MEDIA, false, 300.0)));
        assertTrue(RoomClient.PlaybackReportState.shouldSendImmediately(
            initial, state(4, 10, false, 4, false, MEDIA, true, 300.0)));
    }

    @Test
    public void dropsHistoryOnlyFieldsAfterBindingIsCleared() throws Exception {
        RoomClient.PlaybackReportState reportState = state(4, 10, false, 4, false, MEDIA, false, 300.0);
        JSONObject enabled = RoomClient.playbackReportMessage(reportState, true, 1_800_000_000_000L).getJSONObject("report");
        JSONObject disabled = RoomClient.playbackReportMessage(reportState, false, 1_800_000_000_000L).getJSONObject("report");
        assertTrue(enabled.has("ended"));
        assertTrue(enabled.has("durationSeconds"));
        assertFalse(disabled.has("ended"));
        assertFalse(disabled.has("durationSeconds"));
    }

    private static RoomClient.PlaybackReportState state(
        long sequence,
        double position,
        boolean paused,
        int readyState,
        boolean buffering,
        BilibiliMedia media,
        boolean ended,
        Double duration
    ) {
        return new RoomClient.PlaybackReportState(sequence, position, paused, readyState, buffering, media, ended, duration);
    }
}
