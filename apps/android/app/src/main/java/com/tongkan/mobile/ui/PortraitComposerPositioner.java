package com.tongkan.mobile.ui;

public final class PortraitComposerPositioner {
    private PortraitComposerPositioner() {}

    public static int bottomMargin(
        int rootBottomOnScreen,
        int visibleFrameBottomOnScreen,
        int imeTopOnScreen,
        int systemBottomInset,
        int keyboardThreshold,
        int keyboardGap
    ) {
        int safeSystemInset = Math.max(0, systemBottomInset);
        int safeThreshold = Math.max(0, keyboardThreshold);
        int keyboardTop = Integer.MAX_VALUE;

        int visibleCoverage = rootBottomOnScreen - visibleFrameBottomOnScreen;
        if (visibleFrameBottomOnScreen > 0 && visibleCoverage >= safeThreshold) {
            keyboardTop = visibleFrameBottomOnScreen;
        }

        int imeCoverage = rootBottomOnScreen - imeTopOnScreen;
        if (imeTopOnScreen > 0 && imeCoverage >= safeThreshold) {
            keyboardTop = Math.min(keyboardTop, imeTopOnScreen);
        }

        if (keyboardTop == Integer.MAX_VALUE) return safeSystemInset;
        return Math.max(safeSystemInset, rootBottomOnScreen - keyboardTop + Math.max(0, keyboardGap));
    }
}
