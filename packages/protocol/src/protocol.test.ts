import { describe, expect, it } from "vitest";
import { bilibiliEmbedUrl, parseBilibiliUrl, planDriftCorrection, positionAt } from "./index";
import type { HistoryBindMessage, PlaybackAnchor, ServerEvent, SignalingClientMessage } from "./types";

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

  it("extracts a Bilibili URL from copied share text", () => {
    expect(parseBilibiliUrl("分享一个视频 https://www.bilibili.com/video/BV1GJ411x7h7?p=2 好看！")).toMatchObject({
      bvid: "BV1GJ411x7h7",
      page: 2,
    });
  });

  it("keeps b23 short links as unresolved Bilibili media", () => {
    expect(parseBilibiliUrl("复制打开 https://b23.tv/AbCd123，看看视频")).toMatchObject({
      type: "bilibili",
      bvid: "b23:AbCd123",
      canonicalUrl: "https://b23.tv/AbCd123",
      unresolved: true,
    });
  });

  it("rejects unrelated domains", () => {
    expect(parseBilibiliUrl("https://example.com/video/BV1xx411c7mD")).toBeNull();
    expect(parseBilibiliUrl("https://evilbilibili.com/video/BV1xx411c7mD")).toBeNull();
    expect(parseBilibiliUrl("https://not-bilibili.com/video/BV1xx411c7mD")).toBeNull();
  });

  it("builds an official embedded player URL for a resolved BV video", () => {
    const media = parseBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD?p=3");
    expect(media && bilibiliEmbedUrl(media)).toBe(
      "https://player.bilibili.com/player.html?page=3&high_quality=1&danmaku=0&autoplay=0&as_wide=1&bvid=BV1xx411c7mD",
    );
  });

  it("derives AV embed aid from the av identity and rejects mismatches", () => {
    expect(bilibiliEmbedUrl({
      type: "bilibili",
      bvid: "av123",
      page: 2,
      canonicalUrl: "https://www.bilibili.com/video/av123?p=2",
    })).toBe(
      "https://player.bilibili.com/player.html?page=2&high_quality=1&danmaku=0&autoplay=0&as_wide=1&aid=123",
    );
    expect(bilibiliEmbedUrl({
      type: "bilibili",
      bvid: "av123",
      aid: 456,
      page: 1,
      canonicalUrl: "https://www.bilibili.com/video/av456",
    })).toBeNull();
  });

  it("does not embed an unresolved b23 share link", () => {
    const media = parseBilibiliUrl("https://b23.tv/AbCd123");
    expect(media && bilibiliEmbedUrl(media)).toBeNull();
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

describe("history protocol additions", () => {
  it("keeps history binding optional while exposing the bound event", () => {
    const bind: HistoryBindMessage = { type: "history.bind", grant: "opaque-grant" };
    const inbound: SignalingClientMessage = bind;
    const bound: ServerEvent = { type: "history.bound", expiresAt: 1_788_228_600_000 };
    const error: ServerEvent = {
      type: "error",
      code: "HISTORY_BIND_CONFLICT",
      message: "conflict",
    };

    expect(inbound.type).toBe("history.bind");
    expect(bound).toMatchObject({ type: "history.bound" });
    expect(error).toMatchObject({ code: "HISTORY_BIND_CONFLICT" });
  });
});
