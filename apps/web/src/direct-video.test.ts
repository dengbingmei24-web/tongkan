import { describe, expect, it, vi } from "vitest";
import type { DirectMediaIdentity, PlaybackAnchor } from "@tongkan/protocol";
import { DirectVideoController, parseDirectVideoUrl } from "./direct-video";

const media: DirectMediaIdentity = {
  type: "direct",
  url: "https://media.example.com/movie.mp4",
  title: "movie.mp4",
  mimeType: "video/mp4",
};

class FakeVideo {
  currentTime = 0;
  duration = 120;
  playbackRate = 1;
  paused = true;
  readyState = 4;
  error: MediaError | null = null;
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(name: string, listener: EventListener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(listener);
  }

  removeEventListener(name: string, listener: EventListener) {
    this.listeners.get(name)?.delete(listener);
  }

  async play() {
    this.paused = false;
    this.dispatch("play");
  }

  pause() {
    this.paused = true;
    this.dispatch("pause");
  }

  userSeek(position: number) {
    this.currentTime = position;
    this.dispatch("seeked");
  }

  finishSeek() {
    this.dispatch("seeked");
  }

  private dispatch(name: string) {
    for (const listener of this.listeners.get(name) ?? []) listener({ type: name } as Event);
  }
}

function anchor(overrides: Partial<PlaybackAnchor> = {}): PlaybackAnchor {
  return {
    media,
    paused: true,
    positionSeconds: 0,
    playbackRate: 1,
    anchoredAtServerMs: 1_000,
    sequence: 1,
    actorId: "host",
    ...overrides,
  };
}

describe("direct video", () => {
  it("parses browser-playable direct links", () => {
    expect(parseDirectVideoUrl("https://cdn.example.com/a/movie.webm?token=1")).toEqual({
      type: "direct",
      url: "https://cdn.example.com/a/movie.webm?token=1",
      title: "movie.webm",
      mimeType: "video/webm",
    });
    expect(parseDirectVideoUrl("file:///movie.mp4")).toBeNull();
  });

  it("applies remote state without echoing commands and reports local seeks", async () => {
    let now = 1_000;
    const commands: unknown[] = [];
    const video = new FakeVideo();
    const controller = new DirectVideoController({
      onCommand: (command) => commands.push(command),
      onReport: vi.fn(),
      onPositionChange: vi.fn(),
      onError: vi.fn(),
      now: () => now,
    });
    controller.attach(video as unknown as HTMLVideoElement, media);

    await controller.applyAnchor(anchor({ paused: false, positionSeconds: 12 }), 1_000);
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(12);
    expect(commands).toHaveLength(0);

    now = 9_000;
    video.finishSeek();
    expect(commands).toHaveLength(0);

    now = 12_000;
    video.pause();
    expect(commands).toMatchObject([{ kind: "pause", positionSeconds: 12, media }]);
    controller.detach();
  });

  it("hard-seeks medium drift while the room is paused", async () => {
    const video = new FakeVideo();
    video.currentTime = 3;
    const controller = new DirectVideoController({
      onCommand: vi.fn(),
      onReport: vi.fn(),
      onPositionChange: vi.fn(),
      onError: vi.fn(),
      now: () => 2_000,
    });
    controller.attach(video as unknown as HTMLVideoElement, media);

    await controller.applyAnchor(anchor({ paused: true, positionSeconds: 4, sequence: 2 }), 2_000);

    expect(video.currentTime).toBe(4);
    controller.detach();
  });
});
