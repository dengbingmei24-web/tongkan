package com.tongkan.mobile;

import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

public class PlaybackAnchorTest {
    @Test
    public void parsesAndSerializesSharedAuthoritativeAnchor() throws Exception {
        JSONObject fixture = ContractFixtures.read("android-playback-anchor.json");
        PlaybackAnchor anchor = PlaybackAnchor.fromJson(fixture);

        assertNotNull(anchor.media);
        assertEquals("av170001", anchor.media.bvid);
        assertEquals(Long.valueOf(170001), anchor.media.aid);
        assertEquals(2, anchor.media.page);
        assertEquals(9, anchor.sequence);
        assertNull(anchor.actorId);
        assertEquals(17.5, anchor.positionAt(1_700_000_004_000L), 0.0001);
        ContractFixtures.assertJsonEquals(fixture, anchor.toJson());
    }

    @Test
    public void pausedAnchorDoesNotAdvanceOrRewind() {
        PlaybackAnchor anchor = new PlaybackAnchor(null, true, 20, 1, 5_000, 4, "member-1");

        assertEquals(20, anchor.positionAt(1_000), 0.0);
        assertEquals(20, anchor.positionAt(10_000), 0.0);
    }
}
