package com.tongkan.mobile.ui;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ImmersiveMediaGestureControllerTest {
    @Test
    public void gestureRegionExcludesBottomQuarterAndInvalidBounds() {
        assertTrue(ImmersiveMediaGestureController.isGestureRegion(10f, 0f, 100, 200));
        assertTrue(ImmersiveMediaGestureController.isGestureRegion(99f, 149.9f, 100, 200));
        assertFalse(ImmersiveMediaGestureController.isGestureRegion(10f, 150f, 100, 200));
        assertFalse(ImmersiveMediaGestureController.isGestureRegion(10f, 199f, 100, 200));
        assertFalse(ImmersiveMediaGestureController.isGestureRegion(-1f, 20f, 100, 200));
        assertFalse(ImmersiveMediaGestureController.isGestureRegion(100f, 20f, 100, 200));
        assertFalse(ImmersiveMediaGestureController.isGestureRegion(10f, 20f, 0, 200));
    }

    @Test
    public void leftAndRightHalvesSelectExpectedControl() {
        assertEquals(
            ImmersiveMediaGestureController.ControlType.BRIGHTNESS,
            ImmersiveMediaGestureController.controlTypeFor(49.9f, 100)
        );
        assertEquals(
            ImmersiveMediaGestureController.ControlType.VOLUME,
            ImmersiveMediaGestureController.controlTypeFor(50f, 100)
        );
    }

    @Test
    public void directionWaitsForThresholdAndRejectsHorizontalMotion() {
        assertEquals(
            ImmersiveMediaGestureController.DirectionDecision.PENDING,
            ImmersiveMediaGestureController.classifyDirection(5f, 7f, 8f)
        );
        assertEquals(
            ImmersiveMediaGestureController.DirectionDecision.HORIZONTAL,
            ImmersiveMediaGestureController.classifyDirection(12f, 5f, 8f)
        );
        assertEquals(
            ImmersiveMediaGestureController.DirectionDecision.VERTICAL,
            ImmersiveMediaGestureController.classifyDirection(5f, -12f, 8f)
        );
        assertEquals(
            ImmersiveMediaGestureController.DirectionDecision.PENDING,
            ImmersiveMediaGestureController.classifyDirection(12f, 12f, 8f)
        );
    }

    @Test
    public void progressAndPercentagesAreClamped() {
        assertEquals(1f, ImmersiveMediaGestureController.adjustedProgress(0.5f, -500f, 400), 0f);
        assertEquals(0f, ImmersiveMediaGestureController.adjustedProgress(0.5f, 500f, 400), 0f);
        assertEquals(0.5f, ImmersiveMediaGestureController.adjustedProgress(0.5f, 10f, 0), 0f);
        assertEquals(0f, ImmersiveMediaGestureController.clampUnit(Float.NaN), 0f);
        assertEquals(0, ImmersiveMediaGestureController.clampPercentage(-1));
        assertEquals(65, ImmersiveMediaGestureController.clampPercentage(65));
        assertEquals(100, ImmersiveMediaGestureController.clampPercentage(101));
    }
}
