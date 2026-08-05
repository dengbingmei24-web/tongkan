const ROOM_ID_PATTERN = /^[0-9A-Za-z_-]{1,64}$/;
const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;
const AVID_PATTERN = /^av([1-9]\d*)$/;
const B23_ID_PATTERN = /^[0-9A-Za-z_-]{1,64}$/;

window.addEventListener("message", (event) => {
  if (!isTrustedPageEvent(event) || event.data?.source !== "tongkan-web") return;

  if (event.data.type === "PING_EXTENSION") {
    postToPage({
      source: "tongkan-extension",
      type: "PONG",
      bridgeVersion: 2,
      capabilities: { embeddedDuration: true, multiRoomTabs: true },
    });
    return;
  }

  if (event.data.type === "BIND_ROOM" && isValidRoomId(event.data.roomId)) {
    chrome.runtime.sendMessage({ type: "ROOM_BIND", roomId: event.data.roomId });
    return;
  }

  if (event.data.type === "UNBIND_ROOM" && isValidRoomId(event.data.roomId)) {
    chrome.runtime.sendMessage({ type: "ROOM_UNBIND", roomId: event.data.roomId });
    return;
  }

  if (event.data.type === "SET_EMBEDDED_BILI" && isValidRoomId(event.data.roomId)) {
    const media = event.data.media === null ? null : normalizeBilibiliMedia(event.data.media);
    if (event.data.media === null || (media && media.unresolved !== true)) {
      chrome.runtime.sendMessage({ type: "ROOM_EMBED_MEDIA", roomId: event.data.roomId, media });
    }
    return;
  }

  if (event.data.type === "APPLY_ANCHOR") {
    const message = normalizeAnchorMessage(event.data);
    if (message) chrome.runtime.sendMessage(message);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if ((message?.type === "LOCAL_PLAYBACK" || message?.type === "LOCAL_REPORT" || message?.type === "EMBEDDED_BILI_READY" || message?.type === "EMBEDDED_BILI_STATE") && isValidRoomId(message.roomId)) {
    postToPage({ source: "tongkan-extension", ...message });
  }
});

function isTrustedPageEvent(event) {
  if (event.source !== window) return false;
  const ownOrigin = window.location?.origin;
  return typeof ownOrigin !== "string" || event.origin === ownOrigin;
}

function postToPage(message) {
  window.postMessage(message, window.location?.origin ?? "*");
}

function isValidRoomId(roomId) {
  return typeof roomId === "string" && ROOM_ID_PATTERN.test(roomId);
}

function normalizeAnchorMessage(message) {
  if (!isValidRoomId(message.roomId) || !Number.isFinite(message.serverNowMs)) return null;
  const anchor = message.anchor;
  if (!anchor || typeof anchor.paused !== "boolean") return null;
  if (!isFiniteNumber(anchor.positionSeconds, 0) || !isFiniteNumber(anchor.playbackRate, 0.25, 2)) return null;
  if (!Number.isFinite(anchor.anchoredAtServerMs) || !Number.isInteger(anchor.sequence) || anchor.sequence < 0) return null;
  if (anchor.actorId !== null && typeof anchor.actorId !== "string") return null;

  const media = normalizeBilibiliMedia(anchor.media);
  if (!media) return null;
  return {
    type: "APPLY_ANCHOR",
    roomId: message.roomId,
    anchor: {
      media,
      paused: anchor.paused,
      positionSeconds: anchor.positionSeconds,
      playbackRate: anchor.playbackRate,
      anchoredAtServerMs: anchor.anchoredAtServerMs,
      sequence: anchor.sequence,
      actorId: anchor.actorId,
    },
    serverNowMs: message.serverNowMs,
  };
}

function normalizeBilibiliMedia(media) {
  if (!media || media.type !== "bilibili") return null;
  if (media.unresolved === true) return normalizeB23Media(media);
  if (typeof media.bvid !== "string") return null;
  const page = Number(media.page);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return null;
  const avidMatch = media.bvid.match(AVID_PATTERN);
  const aid = avidMatch ? Number.parseInt(avidMatch[1], 10) : null;
  if (!BVID_PATTERN.test(media.bvid) && (!Number.isSafeInteger(aid) || aid <= 0)) return null;
  if (aid !== null && Object.prototype.hasOwnProperty.call(media, "aid") && media.aid !== aid) return null;
  const bvid = aid === null ? media.bvid : `av${aid}`;
  const normalized = {
    type: "bilibili",
    bvid,
    page,
    canonicalUrl: `https://www.bilibili.com/video/${bvid}${page > 1 ? `?p=${page}` : ""}`,
  };
  if (typeof media.title === "string" && media.title.length <= 200) normalized.title = media.title;
  if (aid !== null) normalized.aid = aid;
  else if (Number.isFinite(media.aid) && media.aid >= 0) normalized.aid = media.aid;
  if (Number.isFinite(media.cid) && media.cid >= 0) normalized.cid = media.cid;
  return normalized;
}

function normalizeB23Media(media) {
  const shortId = typeof media.bvid === "string" && media.bvid.startsWith("b23:")
    ? media.bvid.slice(4)
    : "";
  if (!B23_ID_PATTERN.test(shortId)) return null;
  let source;
  try {
    source = new URL(media.canonicalUrl);
  } catch {
    return null;
  }
  if (source.protocol !== "https:" || source.hostname !== "b23.tv" || source.pathname !== `/${shortId}`) return null;
  const normalized = {
    type: "bilibili",
    bvid: `b23:${shortId}`,
    page: 1,
    canonicalUrl: `https://b23.tv/${shortId}`,
    unresolved: true,
  };
  if (typeof media.title === "string" && media.title.length <= 200) normalized.title = media.title;
  return normalized;
}

function isFiniteNumber(value, minimum, maximum = Number.POSITIVE_INFINITY) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}
