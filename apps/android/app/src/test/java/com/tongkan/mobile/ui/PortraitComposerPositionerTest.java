package com.tongkan.mobile.ui;

import android.view.KeyEvent;
import android.view.inputmethod.EditorInfo;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class PortraitComposerPositionerTest {
    @Test
    public void visibleFrameMovesComposerAboveKeyboard() {
        assertEquals(406, PortraitComposerPositioner.bottomMargin(960, 560, Integer.MAX_VALUE, 24, 80, 6));
    }

    @Test
    public void imeInsetIsUsedWhenVisibleFrameDoesNotShrink() {
        assertEquals(326, PortraitComposerPositioner.bottomMargin(960, 960, 640, 24, 80, 6));
    }

    @Test
    public void resizedRootKeepsNormalSystemInset() {
        assertEquals(24, PortraitComposerPositioner.bottomMargin(560, 560, 560, 24, 80, 6));
    }

    @Test
    public void bothSendEntrypointsUseTheSameSubmitTrigger() {
        assertTrue(RoomChatView.isSendAction(EditorInfo.IME_ACTION_SEND, KeyEvent.KEYCODE_UNKNOWN, KeyEvent.ACTION_UP, false));
        assertTrue(RoomChatView.isSendAction(EditorInfo.IME_ACTION_NONE, KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_DOWN, false));
        assertFalse(RoomChatView.isSendAction(EditorInfo.IME_ACTION_NONE, KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_UP, false));
        assertFalse(RoomChatView.isSendAction(EditorInfo.IME_ACTION_NONE, KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_DOWN, true));
    }
}
