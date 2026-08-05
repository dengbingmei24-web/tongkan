import { describe, expect, it } from "vitest";
import { isMobileWebEnvironment, unavailableBilibiliCopy } from "./mobile-web";

describe("mobile Web capability messaging", () => {
  it("detects Android, iPhone and touch-based iPad browsers", () => {
    expect(isMobileWebEnvironment({ userAgent: "Mozilla/5.0 (Linux; Android 15)", maxTouchPoints: 5 })).toBe(true);
    expect(isMobileWebEnvironment({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", maxTouchPoints: 5 })).toBe(true);
    expect(isMobileWebEnvironment({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", maxTouchPoints: 5 })).toBe(true);
  });

  it("does not classify a normal desktop browser as mobile Web", () => {
    expect(isMobileWebEnvironment({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", maxTouchPoints: 0 })).toBe(false);
  });

  it("explains that a mobile Bilibili iframe is local-only", () => {
    expect(unavailableBilibiliCopy(true)).toEqual(expect.objectContaining({
      modeLabel: "B站本地观看",
      statusLabel: "手机网页未同步",
      title: "手机网页暂不能同步 B站",
    }));
  });
});
