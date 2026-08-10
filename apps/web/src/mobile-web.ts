export interface BrowserNavigatorLike {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean };
}

export function isMobileWebEnvironment(navigatorLike: BrowserNavigatorLike): boolean {
  if (navigatorLike.userAgentData?.mobile === true) return true;
  if (/Android|iPhone|iPod|Mobile/i.test(navigatorLike.userAgent)) return true;
  return /Macintosh/i.test(navigatorLike.userAgent) && (navigatorLike.maxTouchPoints ?? 0) > 1;
}

export function unavailableBilibiliCopy(mobileWeb: boolean): {
  modeLabel: string;
  statusLabel: string;
  title: string;
  description: string;
  primaryAction: string | null;
  steps: readonly string[];
} {
  if (mobileWeb) {
    return {
      modeLabel: "B站网页观看",
      statusLabel: "请使用 Android App",
      title: "手机网页暂不能控制 B站播放器",
      description: "手机网页可以观看电脑端共享的画面；需要双方独立加载并同步控制 B站视频时，请使用同看 Android App。",
      primaryAction: null,
      steps: [],
    };
  }
  return {
    modeLabel: "共享观看",
    statusLabel: "可共享观看",
    title: "无需扩展，也能一起看",
    description: "共享正在播放的 B站标签页后，对方会收到同一画面和声音；播放操作由共享者完成。",
    primaryAction: "无需扩展共享观看",
    steps: [
      "在系统窗口中选择“浏览器标签页”",
      "选择正在播放视频的 B站标签页",
      "开启“共享标签页音频”后开始共享",
    ],
  };
}
