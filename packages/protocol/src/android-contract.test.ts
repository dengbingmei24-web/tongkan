import { describe, expect, it } from "vitest";
import androidPlaybackAnchor from "../../../qa/protocol-contract/android-playback-anchor.json";
import {
  positionAt,
  type ClientPlaybackReport,
  type HistoryBindMessage,
  type HistoryBoundEvent,
  type PlaybackAnchor,
} from "./index";

describe("Android authoritative anchor fixture", () => {
  it("projects the shared running anchor with the same server clock semantics", () => {
    const anchor: PlaybackAnchor = {
      ...androidPlaybackAnchor,
      media: {
        ...androidPlaybackAnchor.media,
        type: "bilibili",
      },
    };

    expect(positionAt(anchor, 1_700_000_004_000)).toBe(17.5);
    expect(anchor.actorId).toBeNull();
    expect(anchor.media).toMatchObject({ bvid: "av170001", aid: 170001, page: 2 });
  });

  it("keeps the Alpha 10.4 Android history messages JSON-compatible", () => {
    const bind: HistoryBindMessage = { type: "history.bind", grant: "opaque-grant" };
    const bound: HistoryBoundEvent = { type: "history.bound", expiresAt: 1_788_228_600_000 };
    const report: ClientPlaybackReport = {
      sequenceApplied: 4,
      positionSeconds: 15,
      paused: false,
      readyState: 4,
      buffering: false,
      ended: false,
      durationSeconds: null,
      media: {
        ...androidPlaybackAnchor.media,
        type: "bilibili",
      },
      sentAtClientMs: 1_700_000_004_000,
    };

    expect(JSON.parse(JSON.stringify(bind))).toEqual(bind);
    expect(JSON.parse(JSON.stringify(bound))).toEqual(bound);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
