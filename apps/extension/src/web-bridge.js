window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "tongkan-web") return;

  if (event.data.type === "PING_EXTENSION") {
    window.postMessage({ source: "tongkan-extension", type: "PONG" }, "*");
    return;
  }

  if (event.data.type === "BIND_ROOM") {
    chrome.runtime.sendMessage({ type: "ROOM_BIND", roomId: event.data.roomId });
    return;
  }

  if (event.data.type === "UNBIND_ROOM") {
    chrome.runtime.sendMessage({ type: "ROOM_UNBIND", roomId: event.data.roomId });
    return;
  }

  if (event.data.type === "APPLY_ANCHOR") {
    chrome.runtime.sendMessage({
      type: "APPLY_ANCHOR",
      roomId: event.data.roomId,
      anchor: event.data.anchor,
      serverNowMs: event.data.serverNowMs,
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "LOCAL_PLAYBACK" || message?.type === "LOCAL_REPORT") {
    window.postMessage({ source: "tongkan-extension", ...message }, "*");
  }
});
