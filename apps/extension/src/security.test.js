import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

test("manifest limits the Web bridge and Bilibili host permissions", async () => {
  const manifest = JSON.parse(await readFile(path.join(sourceDirectory, "..", "manifest.json"), "utf8"));
  const bridge = manifest.content_scripts.find((entry) => entry.js?.includes("web-bridge.js"));
  assert.deepEqual(bridge?.matches, ["http://localhost:5173/*", "http://127.0.0.1:5173/*"]);
  assert.deepEqual(manifest.host_permissions, ["*://*.bilibili.com/video/*"]);
  assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
});

test("Web bridge ignores messages from another origin", async () => {
  const harness = await createHarness();
  harness.window.dispatchMessage({ source: "tongkan-web", type: "BIND_ROOM", roomId: "room-security" }, "https://evil.example");
  assert.deepEqual(harness.runtimeMessages, []);
});

test("Web bridge rewrites a forged navigation URL to the canonical Bilibili URL", async () => {
  const harness = await createHarness();
  harness.window.dispatchMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-security",
    anchor: {
      media: {
        type: "bilibili",
        bvid: "BV1xx411c7mD",
        page: 3,
        canonicalUrl: "https://evil.example/phishing",
      },
      paused: true,
      positionSeconds: 12,
      playbackRate: 1,
      anchoredAtServerMs: 1_000,
      sequence: 2,
      actorId: "host",
    },
    serverNowMs: 1_100,
  });

  assert.equal(harness.runtimeMessages.length, 1);
  assert.equal(
    harness.runtimeMessages[0].anchor.media.canonicalUrl,
    "https://www.bilibili.com/video/BV1xx411c7mD?p=3",
  );
});

test("Web bridge rejects non-Bilibili media and malformed playback values", async () => {
  const harness = await createHarness();
  const base = {
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-security",
    serverNowMs: 1_100,
  };
  harness.window.dispatchMessage({
    ...base,
    anchor: {
      media: { type: "direct", url: "https://evil.example/video.mp4" },
      paused: true,
      positionSeconds: 0,
      playbackRate: 1,
      anchoredAtServerMs: 1_000,
      sequence: 1,
      actorId: null,
    },
  });
  harness.window.dispatchMessage({
    ...base,
    anchor: {
      media: { type: "bilibili", bvid: "BV1xx411c7mD", page: 1, canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD" },
      paused: false,
      positionSeconds: Number.POSITIVE_INFINITY,
      playbackRate: 1,
      anchoredAtServerMs: 1_000,
      sequence: 1,
      actorId: null,
    },
  });
  assert.deepEqual(harness.runtimeMessages, []);
});

test("Web bridge accepts a matching HTTPS b23 short link without broadening navigation", async () => {
  const harness = await createHarness();
  harness.window.dispatchMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId: "room-security",
    anchor: {
      media: {
        type: "bilibili",
        bvid: "b23:AbCd123",
        page: 1,
        canonicalUrl: "https://b23.tv/AbCd123",
        unresolved: true,
      },
      paused: true,
      positionSeconds: 0,
      playbackRate: 1,
      anchoredAtServerMs: 1_000,
      sequence: 3,
      actorId: null,
    },
    serverNowMs: 1_100,
  });
  assert.equal(harness.runtimeMessages[0]?.anchor.media.canonicalUrl, "https://b23.tv/AbCd123");
});

async function createHarness() {
  const runtimeMessages = [];
  const runtimeListeners = [];
  const window = createMessageWindow("http://localhost:5173");
  const chrome = {
    runtime: {
      sendMessage(message) {
        runtimeMessages.push(message);
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
      },
    },
  };
  const source = await readFile(path.join(sourceDirectory, "web-bridge.js"), "utf8");
  vm.runInContext(source, vm.createContext({ URL, chrome, console, window }), { filename: "web-bridge.js" });
  return { chrome, runtimeListeners, runtimeMessages, window };
}

function createMessageWindow(origin) {
  const listeners = [];
  const window = {
    location: { origin },
    messages: [],
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    postMessage(data, targetOrigin) {
      window.messages.push({ data, targetOrigin });
    },
    dispatchMessage(data, eventOrigin = origin) {
      for (const listener of listeners) listener({ source: window, origin: eventOrigin, data });
    },
  };
  return window;
}
