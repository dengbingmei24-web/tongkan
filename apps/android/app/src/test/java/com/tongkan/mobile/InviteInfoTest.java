package com.tongkan.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

public class InviteInfoTest {
    private static final String ROOM_ID = "0123456789abcdef0123456789abcdef";
    private static final String HOST_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String GUEST_KEY = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    @Test
    public void parsesOfficialHostAndGuestLinks() {
        InviteInfo host = InviteInfo.parse("https://tongkan-personal.pages.dev/room/" + ROOM_ID + "#host=" + HOST_KEY);
        InviteInfo guest = InviteInfo.parse("https://tongkan-personal.pages.dev/room/" + ROOM_ID + "/#join=" + GUEST_KEY);

        assertNotNull(host);
        assertEquals(ROOM_ID, host.roomId);
        assertEquals(HOST_KEY, host.key);
        assertEquals("host", host.role);
        assertNotNull(guest);
        assertEquals(ROOM_ID, guest.roomId);
        assertEquals(GUEST_KEY, guest.key);
        assertEquals("guest", guest.role);
    }

    @Test
    public void rejectsForgedOriginsAndMalformedKeys() {
        assertNull(InviteInfo.parse("https://evil.example/room/" + ROOM_ID + "#join=" + GUEST_KEY));
        assertNull(InviteInfo.parse("http://tongkan-personal.pages.dev/room/" + ROOM_ID + "#join=" + GUEST_KEY));
        assertNull(InviteInfo.parse("https://tongkan-personal.pages.dev/room/" + ROOM_ID + "#join=short"));
        assertNull(InviteInfo.parse("https://tongkan-personal.pages.dev/room/not-a-room#join=" + GUEST_KEY));
    }
}
