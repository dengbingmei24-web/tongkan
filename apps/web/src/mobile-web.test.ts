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

  it("guides mobile users to watch a computer share or use the Android App", () => {
    expect(unavailableBilibiliCopy(true)).toEqual(expect.objectContaining({
      modeLabel: "B站网页观看",
      statusLabel: "请使用 Android App",
      title: "手机网页暂不能控制 B站播放器",
      primaryAction: null,
    }));
  });

  it("offers desktop users a no-extension Bilibili sharing flow", () => {
    expect(unavailableBilibiliCopy(false)).toEqual(expect.objectContaining({
      modeLabel: "共享观看",
      statusLabel: "可共享观看",
      title: "无需扩展，也能一起看",
      primaryAction: "无需扩展共享观看",
      steps: [
        "在系统窗口中选择“浏览器标签页”",
        "选择正在播放视频的 B站标签页",
        "开启“共享标签页音频”后开始共享",
      ],
    }));
  });
});
