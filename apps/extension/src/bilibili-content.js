let video = null;
let detachPlayer = null;
let lastAppliedSequence = -1;
const suppressedEvents = new Map();
let suppressReportsUntil = 0;
let restoreRateTimer = null;
let lastUrl = location.href;
let playerMissingTimer = null;
let activeRoomId = null;
const syncOverlay = globalThis.TongkanSyncOverlay?.create() ?? null;

syncOverlay?.update({
  tone: "loading",
  status: "正在寻找播放器",
  detail: "等待 B站视频加载",
  message: "播放器就绪后会自动连接。",
  media: parseBilibiliLocation(location.href),
});

const observer = new MutationObserver(() => attachToActiveVideo());
observer.observe(document.documentElement, { childList: true, subtree: true });
attachToActiveVideo();

window.setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    syncOverlay?.update({
      tone: "loading",
      status: "正在切换视频",
      detail: "等待新播放器就绪",
      message: "B站页面切换完成后会重新校准。",
      media: parseBilibiliLocation(location.href),
      sequence: lastAppliedSequence >= 0 ? lastAppliedSequence : null,
    });
    announceReady();
    attachToActiveVideo();
  }
  if (video) syncOverlay?.update({ positionSeconds: video.currentTime });
}, 700);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "APPLY_ANCHOR" && message.anchor) {
    void applyAnchor(message);
    return;
  }
  if (message?.type === "REQUEST_BILI_PLAYER_STATE") emitPlayerState();
});

function attachToActiveVideo() {
  const candidates = [...document.querySelectorAll("video")];
  const next = candidates.sort((a, b) => visibleArea(b) - visibleArea(a))[0] ?? null;
  if (!next) {
    if (playerMissingTimer === null) {
      playerMissingTimer = window.setTimeout(() => {
        playerMissingTimer = null;
        if (document.querySelectorAll("video").length > 0) return;
        syncOverlay?.update({
          tone: "error",
          status: "未找到播放器",
          detail: "刷新 B站页面后重试",
          message: "页面里没有可控制的 HTML5 视频元素。",
        });
      }, 5_000);
    }
    return;
  }
  if (next === video) return;

  if (playerMissingTimer !== null) window.clearTimeout(playerMissingTimer);
  playerMissingTimer = null;

  detachPlayer?.();
  video = next;
  const listeners = [
    ["play", () => emitLocal("play")],
    ["pause", () => emitLocal("pause")],
    ["seeked", () => emitLocal("seek")],
    ["ratechange", () => emitLocal("rate")],
    ["waiting", () => emitReport(true)],
    ["playing", () => emitReport(false)],
    ["loadedmetadata", () => emitPlayerState()],
    ["durationchange", () => emitPlayerState()],
    ["ended", () => emitPlayerState()],
  ];
  for (const [name, listener] of listeners) video.addEventListener(name, listener);
  detachPlayer = () => {
    for (const [name, listener] of listeners) video?.removeEventListener(name, listener);
  };
  syncOverlay?.update({
    tone: activeRoomId ? "loading" : "waiting",
    status: activeRoomId ? "播放器已恢复" : "播放器已就绪",
    detail: activeRoomId ? "等待房间重新校准" : "等待房间连接",
    message: activeRoomId ? "正在接收最新权威状态。" : "返回同看房间并接入一个席位。",
    media: parseBilibiliLocation(location.href),
    positionSeconds: video.currentTime,
  });
  announceReady();
  emitPlayerState();
}

async function applyAnchor(message) {
  const anchor = message.anchor;
  const serverNowMs = Number(message.serverNowMs) || Date.now();
  activeRoomId = message.roomId ?? activeRoomId;
  if (!video) {
    syncOverlay?.update({
      tone: "error",
      status: "播放器尚未就绪",
      detail: "等待 B站完成加载",
      message: "找到播放器后会自动应用房间状态。",
      roomId: activeRoomId,
      media: anchor.media,
      sequence: anchor.sequence,
    });
    return;
  }
  const localMedia = parseBilibiliLocation(location.href);
  if (!sameMedia(localMedia, anchor.media)) {
    syncOverlay?.update({
      tone: "error",
      status: "视频不匹配",
      detail: "打开房间指定的视频",
      message: anchor.media?.bvid
        ? `房间需要 ${anchor.media.bvid} · P${Number(anchor.media.page || 1)}。`
        : "房间还没有绑定 B站视频。",
      roomId: activeRoomId,
      media: localMedia,
      sequence: anchor.sequence,
      positionSeconds: video.currentTime,
    });
    return;
  }

  const elapsed = anchor.paused ? 0 : Math.max(0, serverNowMs - anchor.anchoredAtServerMs) / 1000;
  const target = Math.max(0, anchor.positionSeconds + elapsed * anchor.playbackRate);
  const drift = target - video.currentTime;
  const playbackMismatch = anchor.paused !== video.paused;
  const rateMismatch = Math.abs(video.playbackRate - anchor.playbackRate) > 0.001;
  if (anchor.sequence < lastAppliedSequence) return;
  if (anchor.sequence === lastAppliedSequence && !playbackMismatch && !rateMismatch && Math.abs(drift) < 0.3) return;

  syncOverlay?.update({
    tone: "loading",
    status: "正在校准",
    detail: `应用服务序号 ${anchor.sequence}`,
    message: "正在对齐播放状态、进度和倍速。",
    roomId: activeRoomId,
    media: localMedia,
    sequence: anchor.sequence,
    positionSeconds: video.currentTime,
  });

  lastAppliedSequence = anchor.sequence;
  suppressReportsUntil = performance.now() + 850;

  if (Math.abs(drift) > 1.5) {
    suppressEvent("seek");
    video.currentTime = target;
  }
  if (Math.abs(drift) >= 0.3 && Math.abs(drift) <= 1.5 && !anchor.paused) {
    const correction = Math.min(0.05, Math.abs(drift) * 0.04);
    suppressEvent("rate");
    video.playbackRate = drift > 0
      ? anchor.playbackRate + correction
      : Math.max(0.25, anchor.playbackRate - correction);
    clearTimeout(restoreRateTimer);
    restoreRateTimer = setTimeout(() => {
      if (video) {
        suppressEvent("rate", 500);
        video.playbackRate = anchor.playbackRate;
      }
    }, 2500);
  } else if (Math.abs(video.playbackRate - anchor.playbackRate) > 0.001) {
    suppressEvent("rate");
    video.playbackRate = anchor.playbackRate;
  }

  if (anchor.paused && !video.paused) {
    suppressEvent("pause");
    video.pause();
  }
  if (!anchor.paused && video.paused) {
    suppressEvent("play");
    try {
      await video.play();
    } catch {
      suppressedEvents.delete("play");
      syncOverlay?.update({
        tone: "error",
        status: "播放被浏览器拦截",
        detail: "先手动播放一次",
        message: "浏览器需要一次人工播放后才能接受远端播放。",
        positionSeconds: video.currentTime,
      });
      return;
    }
  }

  syncOverlay?.update({
    tone: "success",
    status: "已同步",
    detail: anchor.paused ? "房间已暂停" : "房间正在播放",
    message: `已应用服务序号 ${anchor.sequence}。`,
    roomId: activeRoomId,
    media: localMedia,
    sequence: anchor.sequence,
    positionSeconds: video.currentTime,
  });
  emitPlayerState();
}

function emitLocal(kind) {
  if (!video || consumeSuppressedEvent(kind)) return;
  const media = parseBilibiliLocation(location.href);
  if (!media) return;
  const event = {
    kind,
    positionSeconds: video.currentTime,
    playbackRate: video.playbackRate,
    media,
  };
  chrome.runtime.sendMessage({ type: "BILI_LOCAL_PLAYBACK", event });
  syncOverlay?.update({
    tone: "success",
    status: "已上报本地操作",
    detail: `${commandLabel(kind)} · 等待房间回执`,
    message: `本地${commandLabel(kind)}已发送到房间服务。`,
    media,
    roomId: activeRoomId,
    sequence: lastAppliedSequence >= 0 ? lastAppliedSequence : null,
    positionSeconds: video.currentTime,
  });
}

function emitReport(buffering) {
  if (!video) return;
  syncOverlay?.update({
    tone: buffering ? "loading" : "success",
    status: buffering ? "播放器正在缓冲" : "播放器已恢复",
    detail: buffering ? "房间会等待本地恢复" : "可以继续同步",
    message: buffering ? "已向房间上报缓冲状态。" : "本地播放器恢复可播放。",
    positionSeconds: video.currentTime,
  });
  if (performance.now() < suppressReportsUntil) return;
  chrome.runtime.sendMessage({
    type: "BILI_LOCAL_REPORT",
    report: {
      sequenceApplied: Math.max(0, lastAppliedSequence),
      positionSeconds: video.currentTime,
      paused: video.paused,
      readyState: video.readyState,
      buffering,
      media: parseBilibiliLocation(location.href),
      sentAtClientMs: Date.now(),
    },
  });
}

function emitPlayerState() {
  const state = currentPlayerState();
  if (!state) return;
  chrome.runtime.sendMessage({
    type: "BILI_PLAYER_STATE",
    state,
  });
}

function currentPlayerState() {
  if (!video) return null;
  const media = parseBilibiliLocation(location.href);
  if (!media || !Number.isFinite(video.duration) || video.duration <= 0) return null;
  return {
    media,
    durationSeconds: video.duration,
    positionSeconds: video.currentTime,
    paused: video.paused,
    ended: video.ended,
  };
}

function suppressEvent(kind, durationMs = 850) {
  suppressedEvents.set(kind, performance.now() + durationMs);
}

function consumeSuppressedEvent(kind) {
  const until = suppressedEvents.get(kind) ?? 0;
  suppressedEvents.delete(kind);
  return performance.now() < until;
}

function announceReady() {
  const media = parseBilibiliLocation(location.href);
  chrome.runtime.sendMessage({ type: "BILI_READY", media, state: currentPlayerState() });
  if (!activeRoomId && video) {
    syncOverlay?.update({
      tone: "waiting",
      status: "播放器已就绪",
      detail: "等待房间连接",
      message: "返回同看房间并接入一个席位。",
      media,
      positionSeconds: video.currentTime,
    });
  }
}

function commandLabel(kind) {
  return ({ play: "播放", pause: "暂停", seek: "跳转", rate: "倍速" })[kind] ?? "操作";
}

function parseBilibiliLocation(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "player.bilibili.com" && url.pathname === "/player.html") {
      const embeddedBvid = url.searchParams.get("bvid");
      const embeddedAid = Number.parseInt(url.searchParams.get("aid") ?? "", 10);
      const embeddedPage = Math.max(1, Number(url.searchParams.get("page") || 1));
      if (embeddedBvid && /^BV[0-9A-Za-z]{10}$/.test(embeddedBvid)) {
        return {
          type: "bilibili",
          bvid: embeddedBvid,
          page: embeddedPage,
          canonicalUrl: `https://www.bilibili.com/video/${embeddedBvid}${embeddedPage > 1 ? `?p=${embeddedPage}` : ""}`,
        };
      }
      if (Number.isFinite(embeddedAid) && embeddedAid > 0) {
        return {
          type: "bilibili",
          bvid: `av${embeddedAid}`,
          aid: embeddedAid,
          page: embeddedPage,
          canonicalUrl: `https://www.bilibili.com/video/av${embeddedAid}${embeddedPage > 1 ? `?p=${embeddedPage}` : ""}`,
        };
      }
      return null;
    }
    const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av(\d+))/i);
    if (!match) return null;
    const token = match[1];
    const bvid = token.toLowerCase().startsWith("av") ? `av${match[2]}` : `BV${token.slice(2)}`;
    const page = Math.max(1, Number(url.searchParams.get("p") || 1));
    return {
      type: "bilibili",
      bvid,
      page,
      canonicalUrl: `https://www.bilibili.com/video/${bvid}${page > 1 ? `?p=${page}` : ""}`,
    };
  } catch {
    return null;
  }
}

function sameMedia(left, right) {
  return Boolean(left && right && left.bvid === right.bvid && left.page === right.page);
}

function visibleArea(element) {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}
