import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

test("sync overlay renders status, details and disclosure state", async () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    document,
    chrome: {
      runtime: {
        getURL: (resource) => `chrome-extension://tongkan/${resource}`,
      },
    },
  });
  const source = await readFile(path.join(sourceDirectory, "sync-overlay.js"), "utf8");
  vm.runInContext(source, context, { filename: "sync-overlay.js" });

  const overlay = context.TongkanSyncOverlay.create();
  assert.equal(document.documentElement.children.length, 1);
  assert.equal(overlay.elements.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(overlay.elements.toggle.getAttribute("aria-label"), "展开同看同步状态");

  overlay.update({
    tone: "success",
    status: "已同步",
    detail: "房间正在播放",
    message: "已应用服务序号 14。",
    roomId: "c79eda210aee",
    media: { bvid: "BV1xx411c7mD", page: 1 },
    sequence: 14,
    positionSeconds: 65,
  });

  assert.equal(overlay.elements.panel.dataset.tone, "success");
  assert.equal(overlay.elements.toggle.dataset.state, "success");
  assert.equal(overlay.elements.status.textContent, "已同步");
  assert.equal(overlay.elements.message.textContent, "已应用服务序号 14。");
  assert.equal(overlay.elements.sequence.textContent, "SEQ 14");
  assert.equal(overlay.elements.roomValue.textContent, "c79eda21");
  assert.equal(overlay.elements.mediaValue.textContent, "BV1xx411c7mD · P1");
  assert.equal(overlay.elements.positionValue.textContent, "01:05");

  overlay.elements.toggle.click();
  assert.equal(overlay.elements.panel.dataset.expanded, "true");
  assert.equal(overlay.elements.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(overlay.elements.toggle.getAttribute("aria-label"), "收起同看同步状态");

  overlay.destroy();
  assert.equal(document.documentElement.children.length, 0);
});

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement("html");
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.parentNode = null;
    this.className = "";
    this.id = "";
    this.textContent = "";
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  attachShadow() {
    this.shadowRoot = new FakeElement("shadow-root");
    return this.shadowRoot;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  click() {
    if (this.disabled) return;
    for (const listener of this.listeners.get("click") ?? []) listener({ currentTarget: this });
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
}

function matchesSelector(element, selector) {
  if (selector.startsWith(".")) return element.className.split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (!attribute) return false;
  if (!element.attributes.has(attribute[1])) return false;
  return attribute[2] === undefined || element.attributes.get(attribute[1]) === attribute[2];
}
