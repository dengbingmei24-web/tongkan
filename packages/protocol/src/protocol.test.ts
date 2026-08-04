import { describe, expect, it } from "vitest";
import { parseBilibiliUrl, planDriftCorrection, positionAt } from "./index";
import type { PlaybackAnchor } from "./types";

const anchor: PlaybackAnchor = {
  media: null,
  paused: false,
  positionSeconds: 12,
  playbackRate: 1,
  anchoredAtServerMs: 1_000,
  sequence: 4,
  actorId: "host",
};

describe("Bilibili URL parsing", () => {
  it("normalizes BV links and pages", () => {
    expect(parseBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD?p=3")).toMatchObject({
      bvid: "BV1xx411c7mD",
      page: 3,
    });
  });

  it("rejects unrelated domains", () => {
    expect(parseBilibiliUrl("https://example.com/video/BV1xx411c7mD")).toBeNull();
  });
});

describe("playback clock", () => {
  it("projects an active anchor forward", () => {
    expect(positionAt(anchor, 3_500)).toBe(14.5);
  });

  it("uses rate correction for medium drift", () => {
    expect(planDriftCorrection(anchor, 13.7, 3_000).kind).toBe("rate");
  });

  it("uses a hard seek for large drift", () => {
    expect(planDriftCorrection(anchor, 2, 3_000).kind).toBe("seek");
  });
});
