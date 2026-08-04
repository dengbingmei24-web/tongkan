import {
  planDriftCorrection,
  type ClientPlaybackReport,
  type DirectMediaIdentity,
  type PlaybackAnchor,
  type PlaybackCommandKind,
} from "@tongkan/protocol";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".ogg": "video/ogg",
  ".m3u8": "application/vnd.apple.mpegurl",
};

export function parseDirectVideoUrl(input: string): DirectMediaIdentity | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const filename = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "在线视频");
  const extension = Object.keys(MIME_BY_EXTENSION).find((value) => url.pathname.toLowerCase().endsWith(value));
  const media: DirectMediaIdentity = {
    type: "direct",
    url: url.toString(),
    title: filename || url.hostname,
  };
  const mimeType = extension ? MIME_BY_EXTENSION[extension] : undefined;
  if (mimeType) media.mimeType = mimeType;
  return media;
}

export async function applyDirectAnchorToVideo(
  video: HTMLVideoElement,
  anchor: PlaybackAnchor,
  serverNowMs: number,
): Promise<void> {
  if (anchor.media?.type !== "direct") return;
  const target = Math.max(0, anchor.paused
    ? anchor.positionSeconds
    : anchor.positionSeconds + Math.max(0, serverNowMs - anchor.anchoredAtServerMs) / 1_000 * anchor.playbackRate);
  const drift = target - video.currentTime;
  if (Math.abs(drift) >= 0.3) {
    try {
      video.currentTime = target;
    } catch {
      // loadedmetadata will retry once the media timeline is available.
    }
  }
  if (Math.abs(video.playbackRate - anchor.playbackRate) > 0.001) video.playbackRate = anchor.playbackRate;
  if (anchor.paused) {
    if (!video.paused) video.pause();
  } else if (video.paused) {
    await video.play();
  }
}

export interface DirectVideoCommand {
  kind: PlaybackCommandKind;
  positionSeconds?: number;
  playbackRate?: number;
  media?: DirectMediaIdentity;
}

export interface DirectVideoControllerOptions {
  onCommand: (command: DirectVideoCommand) => void;
  onReport: (report: ClientPlaybackReport) => void;
  onPositionChange: (positionSeconds: number, durationSeconds: number) => void;
  onError: (message: string) => void;
  now?: () => number;
}

export class DirectVideoController {
  private video: HTMLVideoElement | null = null;
  private media: DirectMediaIdentity | null = null;
  private lastAppliedSequence = -1;
  private latestAnchor: PlaybackAnchor | null = null;
  private suppressedEvents = new Map<string, { until: number; expectedValue?: number }>();
  private restoreRateTimer: ReturnType<typeof setTimeout> | null = null;
  private detachListeners: (() => void) | null = null;

  constructor(private readonly options: DirectVideoControllerOptions) {}

  attach(video: HTMLVideoElement, media: DirectMediaIdentity): void {
    this.detach();
    this.video = video;
    this.media = media;
    this.lastAppliedSequence = -1;

    const listen = (name: string, listener: EventListener) => video.addEventListener(name, listener);
    const listeners: Array<[string, EventListener]> = [
      ["play", () => this.emitCommand("play")],
      ["pause", () => this.emitCommand("pause")],
      ["ratechange", () => this.emitCommand("rate")],
      ["waiting", () => this.emitReport(true)],
      ["playing", () => this.emitReport(false)],
      ["timeupdate", () => this.publishPosition()],
      ["durationchange", () => this.publishPosition()],
      ["loadedmetadata", () => {
        this.publishPosition();
        if (this.latestAnchor) void this.applyAnchor(this.latestAnchor, this.options.now?.() ?? Date.now(), true);
      }],
      ["error", () => this.options.onError(directVideoError(video.error))],
    ];
    for (const [name, listener] of listeners) listen(name, listener);
    this.detachListeners = () => {
      for (const [name, listener] of listeners) video.removeEventListener(name, listener);
    };
  }

  async applyAnchor(anchor: PlaybackAnchor, serverNowMs: number, force = false): Promise<void> {
    this.latestAnchor = anchor;
    const video = this.video;
    if (!video || anchor.media?.type !== "direct" || anchor.media.url !== this.media?.url) return;
    if (!force && anchor.sequence <= this.lastAppliedSequence) return;
    this.lastAppliedSequence = Math.max(this.lastAppliedSequence, anchor.sequence);

    const correction = planDriftCorrection(anchor, video.currentTime, serverNowMs);
    if (
      correction.kind === "seek"
      || ((force || anchor.paused) && Math.abs(correction.driftSeconds) >= 0.3)
    ) {
      this.suppress("seek", 10_000, correction.targetPositionSeconds);
      try {
        video.currentTime = correction.targetPositionSeconds;
      } catch {
        // Metadata may still be loading; loadedmetadata will retry the anchor.
      }
    }

    if (correction.kind === "rate" && !anchor.paused) {
      this.suppress("rate", 5_000, correction.playbackRate);
      video.playbackRate = correction.playbackRate;
      if (this.restoreRateTimer !== null) clearTimeout(this.restoreRateTimer);
      this.restoreRateTimer = setTimeout(() => {
        if (!this.video) return;
        this.suppress("rate", 5_000, anchor.playbackRate);
        this.video.playbackRate = anchor.playbackRate;
      }, 2_500);
    } else if (Math.abs(video.playbackRate - anchor.playbackRate) > 0.001) {
      this.suppress("rate", 5_000, anchor.playbackRate);
      video.playbackRate = anchor.playbackRate;
    }

    if (anchor.paused && !video.paused) {
      this.suppress("pause");
      video.pause();
    } else if (!anchor.paused && video.paused) {
      this.suppress("play");
      try {
        await video.play();
      } catch {
        this.suppressedEvents.delete("play");
        this.options.onError("浏览器阻止了自动播放，请先点击一次播放器中的播放按钮。");
      }
    }
    this.publishPosition();
  }

  detach(): void {
    this.detachListeners?.();
    this.detachListeners = null;
    if (this.restoreRateTimer !== null) clearTimeout(this.restoreRateTimer);
    this.restoreRateTimer = null;
    this.video = null;
    this.media = null;
    this.latestAnchor = null;
    this.suppressedEvents.clear();
  }

  private emitCommand(kind: "play" | "pause" | "seek" | "rate"): void {
    const video = this.video;
    if (!video || !this.media || this.consumeSuppressed(kind)) return;
    this.options.onCommand({
      kind,
      positionSeconds: video.currentTime,
      playbackRate: video.playbackRate,
      media: this.media,
    });
  }

  private emitReport(buffering: boolean): void {
    const video = this.video;
    if (!video || !this.media) return;
    this.options.onReport({
      sequenceApplied: Math.max(0, this.lastAppliedSequence),
      positionSeconds: video.currentTime,
      paused: video.paused,
      readyState: video.readyState,
      buffering,
      media: this.media,
      sentAtClientMs: Date.now(),
    });
  }

  private publishPosition(): void {
    const video = this.video;
    if (!video) return;
    this.options.onPositionChange(
      Number.isFinite(video.currentTime) ? video.currentTime : 0,
      Number.isFinite(video.duration) ? video.duration : 0,
    );
  }

  private suppress(kind: string, durationMs = 5_000, expectedValue?: number): void {
    const event = { until: (this.options.now?.() ?? performance.now()) + durationMs } as {
      until: number;
      expectedValue?: number;
    };
    if (expectedValue !== undefined) event.expectedValue = expectedValue;
    this.suppressedEvents.set(kind, event);
  }

  private consumeSuppressed(kind: string): boolean {
    const now = this.options.now?.() ?? performance.now();
    const event = this.suppressedEvents.get(kind);
    if (!event) return false;
    this.suppressedEvents.delete(kind);
    if (now >= event.until) return false;
    if (event.expectedValue === undefined || !this.video) return true;
    const actualValue = kind === "rate" ? this.video.playbackRate : this.video.currentTime;
    return Math.abs(actualValue - event.expectedValue) <= (kind === "rate" ? 0.01 : 0.5);
  }
}

function directVideoError(error: MediaError | null): string {
  if (!error) return "视频载入失败。请确认地址可直接播放，或改用屏幕共享。";
  if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "浏览器不支持这个视频地址或编码。请尝试 MP4/WebM 直链，或改用屏幕共享。";
  }
  if (error.code === MediaError.MEDIA_ERR_NETWORK) return "视频网络请求失败，地址可能已过期或存在防盗链。";
  if (error.code === MediaError.MEDIA_ERR_DECODE) return "视频编码无法解码，请更换浏览器支持的格式。";
  return "视频载入被中断，请重新载入链接。";
}
