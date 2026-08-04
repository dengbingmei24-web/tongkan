// Normal and InPrivate windows represent two independent participants during
// single-machine testing. Split incognito mode gives each side its own
// background process; distinct keys also prevent a restarted worker from
// restoring the other side's room and player routes.
const STORAGE_CONTEXT = chrome.extension?.inIncognitoContext ? "incognito" : "regular";
const STORAGE_KEY = `tongkan:bridge-state:v1:${STORAGE_CONTEXT}`;
const roomTabs = new Map();
const biliTabs = new Map();
const pendingAnchors = new Map();
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
    for (const [roomId, roomTabId] of roomTabs) {
      if (roomTabId !== tabId) continue;
      roomTabs.delete(roomId);
      changed = true;
    }
    if (changed) await persistState();
  });
});

async function handleMessage(message, sender) {
  await restorePromise;
  const tabId = sender.tab?.id;

  if (message?.type === "ROOM_BIND" && Number.isInteger(tabId)) {
    roomTabs.set(message.roomId, tabId);
    await persistState();
    return { ok: true };
  }

  if (message?.type === "ROOM_UNBIND" && Number.isInteger(tabId)) {
    if (roomTabs.get(message.roomId) === tabId) {
      roomTabs.delete(message.roomId);
      await persistState();
    }
    return;
  }

  if (message?.type === "BILI_READY" && Number.isInteger(tabId)) {
    const previousMedia = biliTabs.get(tabId) ?? null;
    biliTabs.set(tabId, message.media ?? null);
    await persistState();
    if (previousMedia && message.media && !sameMedia(previousMedia, message.media)) {
      for (const [roomId, roomTabId] of roomTabs) {
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
    for (const [roomId, roomTabId] of roomTabs) {
      const pending = pendingAnchors.get(roomId);
      if (!sameMedia(pending?.anchor?.media, message.event?.media)) continue;
      await sendToRoom(roomId, roomTabId, {
        type: "LOCAL_PLAYBACK",
        roomId,
        event: message.event,
      });
    }
    return;
  }

  if (message?.type === "BILI_LOCAL_REPORT") {
    for (const [roomId, roomTabId] of roomTabs) {
      const pending = pendingAnchors.get(roomId);
      if (!sameMedia(pending?.anchor?.media, message.report?.media)) continue;
      await sendToRoom(roomId, roomTabId, {
        type: "LOCAL_REPORT",
        roomId,
        report: message.report,
      });
    }
    return;
  }

  if (message?.type === "APPLY_ANCHOR") {
    pendingAnchors.set(message.roomId, message);
    await persistState();
    await routeAnchor(message);
  }
}

async function routeAnchor(message) {
  const media = message.anchor?.media;
  if (!media || media.type !== "bilibili") return;

  const matching = [...biliTabs.entries()].find(([, current]) => sameMedia(current, media));
  if (matching) {
    try {
      await chrome.tabs.sendMessage(matching[0], message);
    } catch {
      biliTabs.delete(matching[0]);
      await persistState();
    }
    return;
  }

  const existing = [...biliTabs.keys()][0];
  if (existing) {
    try {
      await chrome.tabs.update(existing, { url: media.canonicalUrl, active: true });
    } catch {
      biliTabs.delete(existing);
      await persistState();
      await chrome.tabs.create({ url: media.canonicalUrl, active: true });
    }
    return;
  }

  await chrome.tabs.create({ url: media.canonicalUrl, active: true });
}

async function deliverPendingToTab(tabId, media) {
  const pending = [...pendingAnchors.values()]
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
    if (roomTabs.get(roomId) === roomTabId) {
      roomTabs.delete(roomId);
      await persistState();
    }
  }
}

async function restoreState() {
  try {
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    const state = stored?.[STORAGE_KEY];
    restoreEntries(roomTabs, state?.roomTabs, (key, value) => typeof key === "string" && Number.isInteger(value));
    restoreEntries(biliTabs, state?.biliTabs, (key) => Number.isInteger(key));
    restoreEntries(pendingAnchors, state?.pendingAnchors, (key, value) => typeof key === "string" && value?.roomId === key);
  } catch {
    // A fresh browser session has no bridge state yet.
  }
}

async function persistState() {
  await chrome.storage.session.set({
    [STORAGE_KEY]: {
      roomTabs: [...roomTabs.entries()],
      biliTabs: [...biliTabs.entries()],
      pendingAnchors: [...pendingAnchors.entries()],
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
