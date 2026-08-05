// Normal and InPrivate windows represent two independent participants during
// single-machine testing. Split incognito mode gives each side its own
// background process; distinct keys also prevent a restarted worker from
// restoring the other side's room and player routes.
const STORAGE_CONTEXT = chrome.extension?.inIncognitoContext ? "incognito" : "regular";
const STORAGE_KEY = `tongkan:bridge-state:v1:${STORAGE_CONTEXT}`;
// A browser profile may host both participants during local testing. Keep the
// room binding per tab so opening the second room page never replaces the first.
const roomTabs = new Map();
const biliTabs = new Map();
const biliPlayerStates = new Map();
const embeddedMediaByTab = new Map();
const pendingAnchors = new Map();
const resolvingTabs = new Map();
const restorePromise = restoreState();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => {
      sendResponse(response ?? { ok: true });
    })
    .catch(() => {
      sendResponse({ ok: false });
    });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void restorePromise.then(async () => {
    let changed = biliTabs.delete(tabId);
    changed = biliPlayerStates.delete(tabId) || changed;
    changed = resolvingTabs.delete(tabId) || changed;
    changed = roomTabs.delete(tabId) || changed;
    changed = embeddedMediaByTab.delete(tabId) || changed;
    if (changed) await persistState();
  });
});

async function handleMessage(message, sender) {
  await restorePromise;
  const tabId = sender.tab?.id;

  if (message?.type === "ROOM_BIND" && Number.isInteger(tabId)) {
    roomTabs.set(tabId, message.roomId);
    await persistState();
    return { ok: true };
  }

  if (message?.type === "ROOM_UNBIND" && Number.isInteger(tabId)) {
    if (roomTabs.get(tabId) === message.roomId) {
      roomTabs.delete(tabId);
      embeddedMediaByTab.delete(tabId);
      await persistState();
    }
    return;
  }

  if (message?.type === "ROOM_EMBED_MEDIA" && Number.isInteger(tabId)) {
    if (roomTabs.get(tabId) !== message.roomId) return { ok: false };
    if (message.media) {
      embeddedMediaByTab.set(tabId, message.media);
    } else {
      embeddedMediaByTab.delete(tabId);
      biliTabs.delete(tabId);
      biliPlayerStates.delete(tabId);
    }
    await persistState();
    if (message.media && sameMedia(biliTabs.get(tabId), message.media)) {
      await sendEmbeddedReady(message.roomId, tabId, message.media);
      const state = biliPlayerStates.get(tabId);
      if (state) await sendEmbeddedState(message.roomId, tabId, state);
      await requestBiliPlayerState(tabId);
    }
    return { ok: true };
  }

  if (message?.type === "BILI_READY" && Number.isInteger(tabId)) {
    const previousMedia = biliTabs.get(tabId) ?? null;
    biliTabs.set(tabId, message.media ?? null);
    if (message.state) biliPlayerStates.set(tabId, message.state);
    await persistState();
    const embeddedRoomId = roomTabs.get(tabId);
    if (embeddedRoomId && sameMedia(embeddedMediaByTab.get(tabId), message.media)) {
      await sendEmbeddedReady(embeddedRoomId, tabId, message.media);
      if (message.state) await sendEmbeddedState(embeddedRoomId, tabId, message.state);
      await requestBiliPlayerState(tabId);
    }
    const resolvingRoomId = resolvingTabs.get(tabId);
    if (resolvingRoomId && message.media) {
      resolvingTabs.delete(tabId);
      await persistState();
      const pending = pendingAnchors.get(resolvingRoomId);
      const roomTabId = findLatestRoomTab(resolvingRoomId);
      if (pending?.anchor?.media?.unresolved && Number.isInteger(roomTabId)) {
        await sendToRoom(resolvingRoomId, roomTabId, {
          type: "LOCAL_PLAYBACK",
          roomId: resolvingRoomId,
          event: { kind: "media-change", media: message.media, positionSeconds: 0 },
        });
        return;
      }
    }
    if (previousMedia && message.media && !sameMedia(previousMedia, message.media)) {
      for (const [roomTabId, roomId] of roomTabs) {
        const pending = pendingAnchors.get(roomId);
        if (!sameMedia(pending?.anchor?.media, previousMedia)) continue;
        await sendToRoom(roomId, roomTabId, {
          type: "LOCAL_PLAYBACK",
          roomId,
          event: { kind: "media-change", media: message.media, positionSeconds: 0 },
        });
      }
    }
    await deliverPendingToTab(tabId, message.media ?? null);
    return;
  }

  if (message?.type === "BILI_LOCAL_PLAYBACK") {
    const embeddedRoomId = Number.isInteger(tabId) ? roomTabs.get(tabId) : null;
    if (embeddedRoomId && sameMedia(embeddedMediaByTab.get(tabId), message.event?.media)) {
      await sendToRoom(embeddedRoomId, tabId, {
        type: "LOCAL_PLAYBACK",
        roomId: embeddedRoomId,
        event: message.event,
      });
      return;
    }
    await sendExternalPlayerMessage(message.event?.media, (roomId) => ({
      type: "LOCAL_PLAYBACK",
      roomId,
      event: message.event,
    }));
    return;
  }

  if (message?.type === "BILI_LOCAL_REPORT") {
    const embeddedRoomId = Number.isInteger(tabId) ? roomTabs.get(tabId) : null;
    if (embeddedRoomId && sameMedia(embeddedMediaByTab.get(tabId), message.report?.media)) {
      await sendToRoom(embeddedRoomId, tabId, {
        type: "LOCAL_REPORT",
        roomId: embeddedRoomId,
        report: message.report,
      });
      return;
    }
    await sendExternalPlayerMessage(message.report?.media, (roomId) => ({
      type: "LOCAL_REPORT",
      roomId,
      report: message.report,
    }));
    return;
  }

  if (message?.type === "BILI_PLAYER_STATE" && Number.isInteger(tabId)) {
    biliPlayerStates.set(tabId, message.state);
    await persistState();
    const embeddedRoomId = roomTabs.get(tabId);
    if (!embeddedRoomId || !sameMedia(embeddedMediaByTab.get(tabId), message.state?.media)) return;
    await sendEmbeddedState(embeddedRoomId, tabId, message.state);
    return;
  }

  if (message?.type === "APPLY_ANCHOR") {
    if (!Number.isInteger(tabId) || roomTabs.get(tabId) !== message.roomId) return { ok: false };
    pendingAnchors.set(message.roomId, message);
    await persistState();
    await routeAnchor(message, tabId);
  }
}

async function routeAnchor(message, sourceRoomTabId) {
  const media = message.anchor?.media;
  if (!media || media.type !== "bilibili") return;

  const embeddedMedia = embeddedMediaByTab.get(sourceRoomTabId);
  if (!media.unresolved && sameMedia(embeddedMedia, media)) {
    try {
      await chrome.tabs.sendMessage(sourceRoomTabId, message);
    } catch {
      // The iframe may still be loading. BILI_READY will replay the pending anchor.
    }
    return;
  }

  const externalBiliTabs = [...biliTabs.entries()]
    .filter(([tabId]) => !roomTabs.has(tabId));
  const matching = media.unresolved
    ? null
    : externalBiliTabs.find(([, current]) => sameMedia(current, media));
  if (matching) {
    try {
      await chrome.tabs.sendMessage(matching[0], message);
    } catch {
      biliTabs.delete(matching[0]);
      await persistState();
    }
    return;
  }

  const existing = externalBiliTabs[0]?.[0];
  if (existing) {
    try {
      if (media.unresolved) {
        resolvingTabs.set(existing, message.roomId);
        await persistState();
      }
      await chrome.tabs.update(existing, { url: media.canonicalUrl, active: true });
    } catch {
      biliTabs.delete(existing);
      resolvingTabs.delete(existing);
      await persistState();
      const created = await chrome.tabs.create({ url: media.canonicalUrl, active: true });
      if (media.unresolved && Number.isInteger(created?.id)) {
        resolvingTabs.set(created.id, message.roomId);
        await persistState();
      }
    }
    return;
  }

  const created = await chrome.tabs.create({ url: media.canonicalUrl, active: true });
  if (media.unresolved && Number.isInteger(created?.id)) {
    resolvingTabs.set(created.id, message.roomId);
    await persistState();
  }
}

async function deliverPendingToTab(tabId, media) {
  const boundRoomId = roomTabs.get(tabId);
  const boundPending = boundRoomId ? pendingAnchors.get(boundRoomId) : null;
  const pending = boundPending && sameMedia(boundPending.anchor?.media, media)
    ? boundPending
    : [...pendingAnchors.values()]
      .filter((message) => sameMedia(message.anchor?.media, media))
      .sort((a, b) => (b.anchor?.sequence ?? 0) - (a.anchor?.sequence ?? 0))[0];
  if (!pending) return;
  try {
    await chrome.tabs.sendMessage(tabId, pending);
  } catch {
    biliTabs.delete(tabId);
    await persistState();
  }
}

async function sendToRoom(roomId, roomTabId, message) {
  try {
    await chrome.tabs.sendMessage(roomTabId, message);
  } catch {
    if (roomTabs.get(roomTabId) === roomId) {
      roomTabs.delete(roomTabId);
      embeddedMediaByTab.delete(roomTabId);
      await persistState();
    }
  }
}

async function sendEmbeddedReady(roomId, roomTabId, media) {
  await sendToRoom(roomId, roomTabId, {
    type: "EMBEDDED_BILI_READY",
    roomId,
    media,
  });
}

async function sendEmbeddedState(roomId, roomTabId, state) {
  await sendToRoom(roomId, roomTabId, {
    type: "EMBEDDED_BILI_STATE",
    roomId,
    state,
  });
}

async function requestBiliPlayerState(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "REQUEST_BILI_PLAYER_STATE" });
  } catch {
    // The iframe may not have installed its content script yet.
  }
}

async function sendExternalPlayerMessage(media, createMessage) {
  for (const roomId of new Set(roomTabs.values())) {
    const pending = pendingAnchors.get(roomId);
    if (!sameMedia(pending?.anchor?.media, media)) continue;
    const roomTabId = findLatestRoomTab(roomId);
    if (!Number.isInteger(roomTabId)) continue;
    await sendToRoom(roomId, roomTabId, createMessage(roomId));
  }
}

function findLatestRoomTab(roomId) {
  return [...roomTabs.entries()].reverse().find(([, currentRoomId]) => currentRoomId === roomId)?.[0] ?? null;
}

async function restoreState() {
  try {
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    const state = stored?.[STORAGE_KEY];
    restoreEntries(roomTabs, state?.roomTabs, (key, value) => Number.isInteger(key) && typeof value === "string");
    restoreEntries(biliTabs, state?.biliTabs, (key) => Number.isInteger(key));
    restoreEntries(biliPlayerStates, state?.biliPlayerStates, (key, value) => Number.isInteger(key) && Number.isFinite(value?.durationSeconds));
    restoreEntries(embeddedMediaByTab, state?.embeddedMediaByTab, (key, value) => Number.isInteger(key) && value?.type === "bilibili");
    restoreEntries(pendingAnchors, state?.pendingAnchors, (key, value) => typeof key === "string" && value?.roomId === key);
    restoreEntries(resolvingTabs, state?.resolvingTabs, (key, value) => Number.isInteger(key) && typeof value === "string");
  } catch {
    // A fresh browser session has no bridge state yet.
  }
}

async function persistState() {
  await chrome.storage.session.set({
    [STORAGE_KEY]: {
      roomTabs: [...roomTabs.entries()],
      biliTabs: [...biliTabs.entries()],
      biliPlayerStates: [...biliPlayerStates.entries()],
      embeddedMediaByTab: [...embeddedMediaByTab.entries()],
      pendingAnchors: [...pendingAnchors.entries()],
      resolvingTabs: [...resolvingTabs.entries()],
    },
  });
}

function restoreEntries(target, entries, isValid) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isValid(entry[0], entry[1])) continue;
    target.set(entry[0], entry[1]);
  }
}

function sameMedia(left, right) {
  return Boolean(
    left && right
      && left.type === "bilibili"
      && right.type === "bilibili"
      && left.bvid === right.bvid
      && Number(left.page || 1) === Number(right.page || 1),
  );
}
