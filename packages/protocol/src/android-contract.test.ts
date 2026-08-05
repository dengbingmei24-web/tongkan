import { describe, expect, it } from "vitest";
import androidPlaybackAnchor from "../../../qa/protocol-contract/android-playback-anchor.json";
import { positionAt, type PlaybackAnchor } from "./index";

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
});
