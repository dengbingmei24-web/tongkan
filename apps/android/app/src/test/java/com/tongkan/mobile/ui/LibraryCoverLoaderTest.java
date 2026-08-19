package com.tongkan.mobile.ui;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public final class LibraryCoverLoaderTest {
    @Test
    public void transformsTrustedBilibiliCoversToJpegThumbnails() {
        assertEquals(
            "https://i0.hdslb.com/bfs/archive/cover.jpg@672w_378h_1c.jpg",
            LibraryCoverLoader.downloadUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
        );
        assertEquals(
            "https://i0.hdslb.com/bfs/archive/cover.jpg@320w_180h.jpg",
            LibraryCoverLoader.downloadUrl("https://i0.hdslb.com/bfs/archive/cover.jpg@320w_180h.jpg")
        );
    }

    @Test
    public void rejectsUntrustedOrMalformedCoverUrls() {
        assertNull(LibraryCoverLoader.downloadUrl("http://i0.hdslb.com/bfs/archive/cover.jpg"));
        assertNull(LibraryCoverLoader.downloadUrl("https://example.com/cover.jpg"));
        assertNull(LibraryCoverLoader.downloadUrl("javascript:alert(1)"));
    }
}