import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const media = {
  type: "bilibili",
  bvid: "BV1xx411c7mD",
  page: 1,
  canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
};

test("normal and InPrivate windows use isolated extension contexts", async () => {
  const manifestPath = path.join(sourceDirectory, "..", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.incognito, "split");
});

test("real extension sources route authoritative state to the Bilibili player", async () => {
  const harness = await createBridgeHarness();

  harness.webWindow.postMessage({ source: "tongkan-web", type: "PING_EXTENSION" }, "*");
  assert.equal(harness.extensionMessages().at(-1)?.type, "PONG");

  harness.bindRoom("room-protocol-test");
  await harness.attachBilibiliTab(media.canonicalUrl);
  await harness.flush();

  const anchor = {
    media,
    paused: false,
    positionSeconds: 42,
    playbackRate: 1.25,
    anchoredAtServerMs: 10_000,
    sequence: 7,
    actorId: "host-member",
  };
  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-protocol-test",
    anchor,
    serverNowMs: 10_000,
  }, "*");
  await harness.flush();

  assert.equal(harness.video.paused, false);
  assert.equal(harness.video.currentTime, 42);
  assert.equal(harness.video.playbackRate, 1.25);
  assert.deepEqual(toPlainObject(harness.messagesSentToTab(2).at(-1)), {
    type: "APPLY_ANCHOR",
    roomId: "room-protocol-test",
    anchor,
    serverNowMs: 10_000,
  });
  assert.equal(harness.createdTabs.length, 0);
  assert.equal(harness.extensionMessages().filter((message) => message.type === "LOCAL_PLAYBACK").length, 0);
});

test("an immediate user play after binding is not swallowed by remote suppression", async () => {
  const harness = await createBridgeHarness();
  harness.bindRoom("room-immediate-play-test");
  await harness.attachBilibiliTab(media.canonicalUrl);

  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-immediate-play-test",
    anchor: {
      media,
      paused: true,
      positionSeconds: 0,
      playbackRate: 1,
      anchoredAtServerMs: 15_000,
      sequence: 2,
      actorId: "host-member",
    },
    serverNowMs: 15_000,
  }, "*");
  await harness.flush();

  harness.video.userPlay();
  await harness.flush();

  const playback = harness.extensionMessages().findLast((message) => message.type === "LOCAL_PLAYBACK");
  assert.equal(playback?.roomId, "room-immediate-play-test");
  assert.equal(playback?.event?.kind, "play");
});

test("Bilibili play, pause, seek, rate and buffering travel back to the bound room", async () => {
  const harness = await createBridgeHarness();
  harness.bindRoom("room-reverse-test");
  await harness.attachBilibiliTab(media.canonicalUrl);

  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-reverse-test",
    anchor: {
      media,
      paused: false,
      positionSeconds: 8,
      playbackRate: 1,
      anchoredAtServerMs: 20_000,
      sequence: 3,
      actorId: "guest-member",
    },
    serverNowMs: 20_000,
  }, "*");
  await harness.flush();

  harness.advancePlayerClock(1_000);
  harness.video.userPause();
  harness.video.userSeek(31.5);
  harness.video.userSetRate(1.5);
  harness.video.userPlay();
  harness.video.userBuffering(true);
  await harness.flush();

  const playbackEvents = harness.extensionMessages()
    .filter((message) => message.type === "LOCAL_PLAYBACK")
    .map((message) => message.event);
  assert.deepEqual(playbackEvents.map((event) => event.kind), ["pause", "seek", "rate", "play"]);
  assert.equal(playbackEvents[1].positionSeconds, 31.5);
  assert.equal(playbackEvents[2].playbackRate, 1.5);
  assert.ok(playbackEvents.every((event) => event.media.bvid === media.bvid));

  const report = harness.extensionMessages().findLast((message) => message.type === "LOCAL_REPORT")?.report;
  assert.equal(report?.buffering, true);
  assert.equal(report?.sequenceApplied, 3);
  assert.equal(report?.positionSeconds, 31.5);
  assert.equal(report?.media?.bvid, media.bvid);
});

test("a Manifest V3 background restart restores both routing directions", async () => {
  const harness = await createBridgeHarness();
  harness.bindRoom("room-restart-test");
  await harness.attachBilibiliTab(media.canonicalUrl);

  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-restart-test",
    anchor: {
      media,
      paused: false,
      positionSeconds: 12,
      playbackRate: 1,
      anchoredAtServerMs: 25_000,
      sequence: 5,
      actorId: "host-member",
    },
    serverNowMs: 25_000,
  }, "*");
  await harness.flush();
  await harness.restartBackground();

  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-restart-test",
    anchor: {
      media,
      paused: true,
      positionSeconds: 24,
      playbackRate: 1,
      anchoredAtServerMs: 26_000,
      sequence: 6,
      actorId: "guest-member",
    },
    serverNowMs: 26_000,
  }, "*");
  await harness.flush();
  assert.equal(harness.video.paused, true);
  assert.equal(harness.video.currentTime, 24);

  const messageCountBeforeLocalControl = harness.extensionMessages().length;
  harness.advancePlayerClock(1_000);
  harness.video.userPlay();
  await harness.flush();

  const messagesAfterRestart = harness.extensionMessages().slice(messageCountBeforeLocalControl);
  assert.equal(messagesAfterRestart.at(-1)?.type, "LOCAL_PLAYBACK");
  assert.equal(messagesAfterRestart.at(-1)?.event?.kind, "play");
  assert.equal(messagesAfterRestart.at(-1)?.roomId, "room-restart-test");
});

test("a different Bilibili media anchor reuses the existing video tab", async () => {
  const harness = await createBridgeHarness();
  harness.bindRoom("room-media-test");
  await harness.attachBilibiliTab(media.canonicalUrl);

  const nextMedia = {
    type: "bilibili",
    bvid: "BV1GJ411x7h7",
    page: 2,
    canonicalUrl: "https://www.bilibili.com/video/BV1GJ411x7h7?p=2",
  };
  harness.webWindow.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-media-test",
    anchor: {
      media: nextMedia,
      paused: true,
      positionSeconds: 0,
      playbackRate: 1,
      anchoredAtServerMs: 30_000,
      sequence: 4,
      actorId: "host-member",
    },
    serverNowMs: 30_000,
  }, "*");
  await harness.flush();

  assert.deepEqual(toPlainObject(harness.updatedTabs.at(-1)), {
    tabId: 2,
    update: { url: nextMedia.canonicalUrl, active: true },
  });
  assert.equal(harness.createdTabs.length, 0);
});

async function createBridgeHarness() {
  const bus = createChromeBus();
  const webWindow = createMessageWindow();
  const webChrome = bus.chromeForTab(1);

  const loadBackground = async () => {
    await runSource("background.js", { chrome: bus.backgroundChrome });
    await bus.flush();
  };
  await loadBackground();
  await runSource("web-bridge.js", { chrome: webChrome, window: webWindow });

  let player = null;
  let playerClock = null;

  return {
    webWindow,
    createdTabs: bus.createdTabs,
    updatedTabs: bus.updatedTabs,
    get video() {
      assert.ok(player, "Bilibili tab has not been attached");
      return player;
    },
    bindRoom(roomId) {
      webWindow.postMessage({ source: "tongkan-web", type: "BIND_ROOM", roomId }, "*");
    },
    async restartBackground() {
      bus.clearBackgroundListeners();
      await loadBackground();
    },
    async attachBilibiliTab(url) {
      playerClock = { now: 0 };
      player = new FakeVideo();
      const timerRegistry = createTimerRegistry();
      const contentWindow = {
        setInterval: timerRegistry.setInterval,
        clearInterval: timerRegistry.clearInterval,
        setTimeout: timerRegistry.setTimeout,
        clearTimeout: timerRegistry.clearTimeout,
      };
      await runSource("bilibili-content.js", {
        chrome: bus.chromeForTab(2),
        document: {
          documentElement: {},
          querySelectorAll: (selector) => selector === "video" ? [player] : [],
        },
        location: { href: url },
        MutationObserver: class {
          observe() {}
        },
        performance: { now: () => playerClock.now },
        setTimeout: timerRegistry.setTimeout,
        clearTimeout: timerRegistry.clearTimeout,
        window: contentWindow,
      });
    },
    advancePlayerClock(milliseconds) {
      assert.ok(playerClock, "Bilibili tab has not been attached");
      playerClock.now += milliseconds;
    },
    extensionMessages() {
      return webWindow.messages.filter((message) => message?.source === "tongkan-extension");
    },
    messagesSentToTab(tabId) {
      return bus.tabMessages.filter((entry) => entry.tabId === tabId).map((entry) => entry.message);
    },
    flush: bus.flush,
  };
}

function createChromeBus() {
  const backgroundListeners = [];
  const tabListeners = new Map();
  const removedListeners = [];
  const tabMessages = [];
  const createdTabs = [];
  const updatedTabs = [];
  const sessionStorage = {};

  const listenersForTab = (tabId) => {
    if (!tabListeners.has(tabId)) tabListeners.set(tabId, []);
    return tabListeners.get(tabId);
  };

  const dispatchToBackground = async (tabId, message) => {
    let response;
    for (const listener of backgroundListeners) {
      listener(message, { tab: { id: tabId } }, (value) => {
        response = value;
      });
    }
    await flush();
    return response;
  };

  const backgroundChrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          backgroundListeners.push(listener);
        },
      },
    },
    storage: {
      session: {
        async get(key) {
          if (typeof key === "string") return key in sessionStorage ? { [key]: sessionStorage[key] } : {};
          const keys = Array.isArray(key) ? key : Object.keys(sessionStorage);
          return Object.fromEntries(keys.filter((entry) => entry in sessionStorage).map((entry) => [entry, sessionStorage[entry]]));
        },
        async set(value) {
          Object.assign(sessionStorage, value);
        },
      },
    },
    tabs: {
      onRemoved: {
        addListener(listener) {
          removedListeners.push(listener);
        },
      },
      async sendMessage(tabId, message) {
        tabMessages.push({ tabId, message });
        for (const listener of listenersForTab(tabId)) listener(message, { tab: { id: 0 } }, () => {});
        await flush();
      },
      async update(tabId, update) {
        updatedTabs.push({ tabId, update });
      },
      async create(create) {
        createdTabs.push(create);
      },
    },
  };

  return {
    backgroundChrome,
    createdTabs,
    updatedTabs,
    tabMessages,
    clearBackgroundListeners() {
      backgroundListeners.length = 0;
    },
    chromeForTab(tabId) {
      return {
        runtime: {
          onMessage: {
            addListener(listener) {
              listenersForTab(tabId).push(listener);
            },
          },
          sendMessage(message) {
            return dispatchToBackground(tabId, message);
          },
        },
      };
    },
    flush,
  };
}

class FakeVideo {
  constructor() {
    this.currentTime = 0;
    this.playbackRate = 1;
    this.paused = true;
    this.readyState = 4;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  getBoundingClientRect() {
    return { width: 1280, height: 720 };
  }

  async play() {
    this.paused = false;
    this.dispatch("play");
  }

  pause() {
    this.paused = true;
    this.dispatch("pause");
  }

  userPlay() {
    this.paused = false;
    this.dispatch("play");
  }

  userPause() {
    this.paused = true;
    this.dispatch("pause");
  }

  userSeek(positionSeconds) {
    this.currentTime = positionSeconds;
    this.dispatch("seeked");
  }

  userSetRate(playbackRate) {
    this.playbackRate = playbackRate;
    this.dispatch("ratechange");
  }

  userBuffering(buffering) {
    this.readyState = buffering ? 2 : 4;
    this.dispatch(buffering ? "waiting" : "playing");
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this });
  }
}

function createMessageWindow() {
  const listeners = new Map();
  const window = {
    messages: [],
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    postMessage(data) {
      window.messages.push(data);
      for (const listener of listeners.get("message") ?? []) listener({ source: window, data });
    },
  };
  return window;
}

function createTimerRegistry() {
  let nextId = 1;
  const timers = new Map();
  const register = (callback) => {
    const id = nextId++;
    timers.set(id, callback);
    return id;
  };
  return {
    setInterval: register,
    clearInterval: (id) => timers.delete(id),
    setTimeout: register,
    clearTimeout: (id) => timers.delete(id),
  };
}

async function runSource(filename, globals) {
  const source = await readFile(path.join(sourceDirectory, filename), "utf8");
  const context = vm.createContext({ URL, console, ...globals });
  vm.runInContext(source, context, { filename });
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}
