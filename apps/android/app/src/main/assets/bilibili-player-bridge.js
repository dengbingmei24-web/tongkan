(function () {
  if (window.__tongkanBridgeInstalled) return;
  window.__tongkanBridgeInstalled = true;

  let video = null;
  let detach = null;
  let lastAppliedSequence = -1;
  let hasAppliedAnchor = false;
  let suppressReportsUntil = 0;
  let restoreRateTimer = null;
  const suppressed = new Map();

  function activeVideo() {
    return Array.from(document.querySelectorAll('video')).sort(function (a, b) {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    })[0] || null;
  }

  function suppress(kind, duration) {
    suppressed.set(kind, performance.now() + (duration || 900));
  }

  function isSuppressed(kind) {
    const until = suppressed.get(kind) || 0;
    suppressed.delete(kind);
    return performance.now() < until;
  }

  function state() {
    if (!video) return null;
    return {
      positionSeconds: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState
    };
  }

  function emitState() {
    const value = state();
    if (value) TongkanAndroid.onPlayerState(JSON.stringify(value));
  }

  function emitLocal(kind) {
    if (!video || !hasAppliedAnchor || isSuppressed(kind)) return;
    TongkanAndroid.onLocalCommand(JSON.stringify({
      kind: kind,
      positionSeconds: video.currentTime || 0,
      playbackRate: video.playbackRate || 1
    }));
    emitState();
  }

  function emitBuffering(buffering) {
    if (!video || !hasAppliedAnchor || performance.now() < suppressReportsUntil) return;
    TongkanAndroid.onBuffering(JSON.stringify({
      buffering: buffering,
      positionSeconds: video.currentTime || 0,
      paused: video.paused,
      readyState: video.readyState
    }));
  }

  function attach() {
    const next = activeVideo();
    if (!next || next === video) return;
    if (detach) detach();
    video = next;
    const listeners = {
      play: function () { emitLocal('play'); },
      pause: function () { emitLocal('pause'); },
      seeked: function () { emitLocal('seek'); },
      ratechange: function () { emitLocal('rate'); },
      waiting: function () { emitBuffering(true); },
      playing: function () { emitBuffering(false); },
      loadedmetadata: emitState,
      durationchange: emitState,
      timeupdate: emitState,
      ended: emitState
    };
    Object.keys(listeners).forEach(function (name) { video.addEventListener(name, listeners[name]); });
    detach = function () {
      Object.keys(listeners).forEach(function (name) { video.removeEventListener(name, listeners[name]); });
    };
    TongkanAndroid.onPlayerReady();
    emitState();
  }

  window.__tongkanApplyAnchor = async function (anchor, serverNowMs) {
    attach();
    if (!video || !anchor) return false;
    const elapsed = anchor.paused ? 0 : Math.max(0, serverNowMs - anchor.anchoredAtServerMs) / 1000;
    const target = Math.max(0, anchor.positionSeconds + elapsed * anchor.playbackRate);
    const drift = target - video.currentTime;
    const playbackMismatch = anchor.paused !== video.paused;
    const rateMismatch = Math.abs(video.playbackRate - anchor.playbackRate) > 0.001;
    if (anchor.sequence < lastAppliedSequence) return true;
    if (anchor.sequence === lastAppliedSequence && !playbackMismatch && !rateMismatch && Math.abs(drift) < 0.3) return true;

    lastAppliedSequence = anchor.sequence;
    hasAppliedAnchor = true;
    suppressReportsUntil = performance.now() + 1000;
    if (Math.abs(drift) > 1.5) {
      suppress('seek');
      video.currentTime = target;
    }
    if (Math.abs(drift) >= 0.3 && Math.abs(drift) <= 1.5 && !anchor.paused) {
      const correction = Math.min(0.05, Math.abs(drift) * 0.04);
      suppress('rate');
      video.playbackRate = drift > 0
        ? anchor.playbackRate + correction
        : Math.max(0.25, anchor.playbackRate - correction);
      clearTimeout(restoreRateTimer);
      restoreRateTimer = setTimeout(function () {
        if (!video) return;
        suppress('rate', 500);
        video.playbackRate = anchor.playbackRate;
      }, 2500);
    } else if (rateMismatch) {
      suppress('rate');
      video.playbackRate = anchor.playbackRate;
    }

    if (anchor.paused && !video.paused) {
      suppress('pause');
      video.pause();
    } else if (!anchor.paused && video.paused) {
      suppress('play');
      try { await video.play(); } catch (_) { suppressed.delete('play'); }
    }
    emitState();
    return true;
  };

  window.__tongkanTogglePlayback = function () {
    attach();
    if (!video) return;
    if (video.paused) video.play().catch(function () {}); else video.pause();
  };

  window.__tongkanSeekTo = function (seconds) {
    attach();
    if (video && Number.isFinite(seconds)) video.currentTime = Math.max(0, seconds);
  };

  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(function () { attach(); emitState(); }, 500);
  attach();
})();
