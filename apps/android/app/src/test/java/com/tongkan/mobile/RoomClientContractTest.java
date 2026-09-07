package com.tongkan.mobile;

import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertArrayEquals;

public class RoomClientContractTest {
    private static final BilibiliMedia MEDIA = new BilibiliMedia(
        "av170001",
        170001L,
        2,
        "https://www.bilibili.com/video/av170001?p=2",
        false
    );

    @Test
    public void authMessageMatchesSharedServerContract() throws Exception {
        JSONObject actual = RoomProtocol.authMessage(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "小明"
        );
        ContractFixtures.assertJsonEquals(ContractFixtures.read("android-auth.json"), actual);
    }

    @Test
    public void playbackCommandMatchesSharedServerContract() throws Exception {
        JSONObject actual = RoomProtocol.playbackCommand(
            "android-command-1",
            "media-change",
            null,
            null,
            MEDIA,
            1_700_000_000_100L
        );
        ContractFixtures.assertJsonEquals(ContractFixtures.read("android-playback-command.json"), actual);
    }

    @Test
    public void playbackReportMatchesSharedServerContract() throws Exception {
        JSONObject actual = RoomProtocol.playbackReport(
            9,
            42.5,
            false,
            4,
            false,
            MEDIA,
            1_700_000_000_200L
        );
        ContractFixtures.assertJsonEquals(ContractFixtures.read("android-playback-report.json"), actual);
    }

    @Test
    public void reconnectBackoffMatchesWebClientPolicy() {
        long[] delays = new long[7];
        for (int attempt = 0; attempt < delays.length; attempt += 1) {
            delays[attempt] = RoomProtocol.reconnectDelayMs(attempt);
        }
        assertArrayEquals(new long[] {2000, 5000, 10000, 20000, 30000, 30000, 30000}, delays);
    }
}
