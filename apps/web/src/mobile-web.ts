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
} {
  if (mobileWeb) {
    return {
      modeLabel: "B站本地观看",
      statusLabel: "手机网页未同步",
      title: "手机网页暂不能同步 B站",
      description: "当前画面由 B站播放器独立播放，房间无法读取或控制它。请改用直链视频；完整 B站同步将在 Android App 中提供。",
    };
  }
  return {
    modeLabel: "B站本地观看",
    statusLabel: "仅本地播放",
    title: "当前浏览器未连接 B站控制桥",
    description: "画面可以本地播放，但不会跟随房间进度。请在 Edge 中加载并重新连接同看扩展。",
  };
}
