(() => {
  let activeOverlay = null;

  function createSyncOverlay() {
    if (activeOverlay) return activeOverlay;

    document.querySelector("[data-tongkan-overlay-host]")?.remove();

    const host = document.createElement("div");
    host.setAttribute("data-tongkan-overlay-host", "");
    const shadow = host.attachShadow({ mode: "open" });

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("sync-overlay.css");

    const panel = makeElement("section", "tongkan-overlay");
    panel.dataset.tone = "loading";
    panel.dataset.expanded = "false";
    panel.setAttribute("aria-label", "同看同步状态");

    const toggle = makeElement("button", "tongkan-overlay__toggle");
    toggle.type = "button";
    toggle.dataset.state = "loading";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "tongkan-overlay-details");
    toggle.setAttribute("aria-label", "展开同看同步状态");

    const mark = makeElement("span", "tongkan-overlay__mark", "同");
    mark.setAttribute("aria-hidden", "true");
    const summary = makeElement("span", "tongkan-overlay__summary");
    const status = makeElement("strong", "tongkan-overlay__status", "正在连接");
    const compactDetail = makeElement("small", "tongkan-overlay__compact-detail", "寻找 B站播放器");
    summary.append(status, compactDetail);
    const sequence = makeElement("span", "tongkan-overlay__sequence", "SEQ —");
    const disclosure = makeElement("span", "tongkan-overlay__disclosure", "⌃");
    disclosure.setAttribute("aria-hidden", "true");
    toggle.append(mark, summary, sequence, disclosure);

    const details = makeElement("div", "tongkan-overlay__details");
    details.id = "tongkan-overlay-details";
    const metrics = makeElement("dl", "tongkan-overlay__metrics");
    const roomValue = makeMetric("房间", "—");
    const mediaValue = makeMetric("视频", "—");
    const positionValue = makeMetric("位置", "00:00");
    metrics.append(roomValue.row, mediaValue.row, positionValue.row);
    const message = makeElement("p", "tongkan-overlay__message", "打开同看房间并接入一个席位。");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    details.append(metrics, message);
    panel.append(toggle, details);
    shadow.append(stylesheet, panel);
    document.documentElement.append(host);

    const state = {
      tone: "loading",
      status: "正在连接",
      detail: "寻找 B站播放器",
      message: "打开同看房间并接入一个席位。",
      roomId: null,
      media: null,
      sequence: null,
      positionSeconds: 0,
    };

    toggle.addEventListener("click", () => {
      const expanded = panel.dataset.expanded !== "true";
      panel.dataset.expanded = String(expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", expanded ? "收起同看同步状态" : "展开同看同步状态");
    });

    function render() {
      panel.dataset.tone = state.tone;
      toggle.dataset.state = state.tone === "waiting" ? "default" : state.tone;
      status.textContent = state.status;
      compactDetail.textContent = state.detail;
      sequence.textContent = `SEQ ${Number.isInteger(state.sequence) ? state.sequence : "—"}`;
      roomValue.value.textContent = state.roomId ? state.roomId.slice(0, 8) : "—";
      mediaValue.value.textContent = state.media
        ? `${state.media.bvid} · P${Number(state.media.page || 1)}`
        : "—";
      positionValue.value.textContent = formatTime(state.positionSeconds);
      message.textContent = state.message;
    }

    activeOverlay = {
      update(next) {
        Object.assign(state, next);
        render();
      },
      destroy() {
        host.remove();
        activeOverlay = null;
      },
      elements: {
        host,
        panel,
        toggle,
        status,
        message,
        sequence,
        roomValue: roomValue.value,
        mediaValue: mediaValue.value,
        positionValue: positionValue.value,
      },
    };
    render();
    return activeOverlay;
  }

  function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function makeMetric(label, value) {
    const row = makeElement("div", "tongkan-overlay__metric");
    const term = makeElement("dt", "tongkan-overlay__term", label);
    const definition = makeElement("dd", "tongkan-overlay__value", value);
    row.append(term, definition);
    return { row, value: definition };
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remaining = safe % 60;
    return hours > 0
      ? [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":")
      : [minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
  }

  globalThis.TongkanSyncOverlay = { create: createSyncOverlay };
})();
