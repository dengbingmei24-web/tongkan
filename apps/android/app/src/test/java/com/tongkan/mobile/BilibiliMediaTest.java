package com.tongkan.mobile;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class BilibiliMediaTest {
    @Test
    public void parsesBvUrlAndPageWithoutChangingIdentifierCase() {
        BilibiliMedia media = BilibiliMedia.parse("https://www.bilibili.com/video/BV1Qxuc62E1y/?p=3");
        assertNotNull(media);
        assertEquals("BV1Qxuc62E1y", media.bvid);
        assertEquals(3, media.page);
        assertEquals("https://www.bilibili.com/video/BV1Qxuc62E1y?p=3", media.canonicalUrl);
        assertTrue(media.embedUrl().startsWith("https://player.bilibili.com/player.html?"));
        assertTrue(media.embedUrl().contains("danmaku=1"));
        assertTrue(media.embedUrl().contains("bvid=BV1Qxuc62E1y"));
    }

    @Test
    public void parsesAvUrl() {
        BilibiliMedia media = BilibiliMedia.parse("https://www.bilibili.com/video/av170001?p=2");
        assertNotNull(media);
        assertEquals("av170001", media.bvid);
        assertEquals(Long.valueOf(170001), media.aid);
        assertEquals("https://www.bilibili.com/video/av170001?p=2", media.canonicalUrl);
        assertTrue(media.embedUrl().contains("danmaku=1"));
        assertTrue(media.embedUrl().contains("aid=170001"));
    }

    @Test
    public void marksShortLinkForResolution() {
        BilibiliMedia media = BilibiliMedia.parse("https://b23.tv/AbCd12");
        assertNotNull(media);
        assertTrue(media.unresolved);
        assertNull(media.embedUrl());
    }

    @Test
    public void derivesOptionalAidFromAuthoritativeAvIdentifier() throws Exception {
        BilibiliMedia media = BilibiliMedia.fromJson(new JSONObject()
            .put("type", "bilibili")
            .put("bvid", "av170001")
            .put("page", 2)
            .put("canonicalUrl", "https://www.bilibili.com/video/av170001?p=2"));

        assertNotNull(media);
        assertEquals(Long.valueOf(170001), media.aid);
        assertTrue(media.embedUrl().contains("aid=170001"));
    }

    @Test(expected = JSONException.class)
    public void rejectsAidThatDisagreesWithAvIdentifier() throws Exception {
        BilibiliMedia.fromJson(new JSONObject()
            .put("type", "bilibili")
            .put("bvid", "av170001")
            .put("aid", 170002)
            .put("page", 1)
            .put("canonicalUrl", "https://www.bilibili.com/video/av170001"));
    }
}
