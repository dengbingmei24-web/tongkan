import { describe, expect, it } from "vitest";
import type { AuthMessage, PlaybackCommandMessage, ScreenStartMessage } from "@tongkan/protocol";
import { ROOM_EMPTY_TTL_MS, RoomSession } from "./room-session";

const capabilities = {
  platform: "web" as const,
  canControlBilibili: true,
  canShareScreen: true,
  canShareSystemAudio: true,
  canUseMicrophone: true,
};

function auth(key: string, nickname: string): AuthMessage {
  return { type: "auth", key, nickname, capabilities };
}

function command(
  kind: PlaybackCommandMessage["kind"],
  overrides: Partial<PlaybackCommandMessage> = {},
): PlaybackCommandMessage {
  return {
    type: "playback.command",
    commandId: crypto.randomUUID(),
    kind,
    clientSentAtMs: 1_000,
    ...overrides,
  };
}

function screenStart(shareId: string, hasAudio = true): ScreenStartMessage {
  return { type: "screen.start", shareId, hasAudio, clientSentAtMs: 2_000 };
}

describe("RoomSession", () => {
  it("gives both fixed slots equal playback control", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_100);

    const first = room.applyPlaybackCommand("host", command("play"), 2_000);
    const second = room.applyPlaybackCommand("guest", command("seek", { positionSeconds: 88 }), 2_100);

    expect(typeof first).toBe("object");
    expect(second).toMatchObject({ sequence: 2, positionSeconds: 88 });
  });

  it("orders simultaneous commands by server arrival", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_000);
    room.applyPlaybackCommand("guest", command("play", { positionSeconds: 5 }), 2_000);
    room.applyPlaybackCommand("host", command("pause", { positionSeconds: 6 }), 2_001);

    expect(room.snapshot(2_001).playback).toMatchObject({ paused: true, sequence: 2, positionSeconds: 6 });
  });

  it("limits seek floods to two commands per second", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);

    expect(room.applyPlaybackCommand("host", command("seek", { positionSeconds: 1 }), 2_000)).not.toBe("RATE_LIMITED");
    expect(room.applyPlaybackCommand("host", command("seek", { positionSeconds: 2 }), 2_100)).not.toBe("RATE_LIMITED");
    expect(room.applyPlaybackCommand("host", command("seek", { positionSeconds: 3 }), 2_200)).toBe("RATE_LIMITED");
  });

  it("starts the ten-minute TTL only while both member slots are offline", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    expect(room.emptyExpiresAtMs()).toBe(1_000 + ROOM_EMPTY_TTL_MS);

    room.authenticate(auth("host-key", "小明"), 2_000);
    room.authenticate(auth("guest-key", "小夏"), 2_100);
    expect(room.emptyExpiresAtMs()).toBeNull();

    room.disconnect("host", 3_000);
    expect(room.emptyExpiresAtMs()).toBeNull();
    room.disconnect("guest", 3_100);
    expect(room.emptyExpiresAtMs()).toBe(3_100 + ROOM_EMPTY_TTL_MS);

    room.authenticate(auth("host-key", "小明"), 4_000);
    expect(room.emptyExpiresAtMs()).toBeNull();
  });

  it("removes fragments from direct URLs and rejects credential query parameters", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);

    const accepted = room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "direct",
        url: "https://media.example.com/movie.mp4?quality=hd#private-note",
        title: "movie.mp4",
      },
    }), 2_000);
    expect(accepted).toMatchObject({
      media: { type: "direct", url: "https://media.example.com/movie.mp4?quality=hd" },
    });

    expect(room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "direct",
        url: "https://media.example.com/movie.mp4?access_token=secret",
      },
    }), 2_100)).toBe("INVALID_MEDIA");
    expect(room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "direct",
        url: "https://user:password@media.example.com/movie.mp4",
      },
    }), 2_200)).toBe("INVALID_MEDIA");
  });

  it("purges a sensitive legacy direct URL when stored state is loaded", () => {
    const stored = RoomSession.create("room", "host-key", "guest-key", 1_000).serialize();
    stored.mode = "direct-video";
    stored.playback = {
      ...stored.playback,
      media: { type: "direct", url: "https://media.example.com/movie.mp4?signature=secret" },
    };

    const restored = new RoomSession(stored);

    expect(restored.snapshot(2_000)).toMatchObject({ mode: "bilibili", playback: { media: null, paused: true } });
    expect(restored.serialize().playback.media).toBeNull();
  });

  it("allows only one active screen sharer and restores the previous media mode", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_100);

    const started = room.startScreenShare("host", screenStart("share-host"), 2_000);

    expect(started).toMatchObject({
      shareId: "share-host",
      sharerSlot: "host",
      sharerNickname: "小明",
      hasAudio: true,
    });
    expect(room.snapshot(2_000)).toMatchObject({ mode: "screen-share", screenShare: { shareId: "share-host" } });
    expect(room.startScreenShare("guest", screenStart("share-guest"), 2_100)).toBe("SCREEN_BUSY");
    expect(room.stopScreenShare("guest", "share-host")).toBe("INVALID_SCREEN_SHARE");
    expect(room.stopScreenShare("host", "share-host")).toBe("bilibili");
    expect(room.snapshot(2_200)).toMatchObject({ mode: "bilibili", screenShare: null });
  });

  it("ends a share when its owner disconnects", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.startScreenShare("host", screenStart("share-host", false), 2_000);

    expect(room.stopScreenShareForSlot("host")).toEqual({ shareId: "share-host", nextMode: "bilibili" });
    expect(room.getScreenShare()).toBeNull();
  });

  it("keeps Bilibili controls active while screen sharing", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_100);
    room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "bilibili",
        bvid: "BV1xx411c7mD",
        page: 1,
        canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
      },
    }), 1_500);
    room.startScreenShare("host", screenStart("share-host"), 2_000);

    const played = room.applyPlaybackCommand("guest", command("play", { positionSeconds: 12 }), 2_100);
    const paused = room.applyPlaybackCommand("host", command("pause", { positionSeconds: 14 }), 2_200);

    expect(played).toMatchObject({ paused: false, positionSeconds: 12 });
    expect(paused).toMatchObject({ paused: true, positionSeconds: 14 });
    expect(room.snapshot(2_200)).toMatchObject({
      mode: "screen-share",
      playback: { paused: true, positionSeconds: 14 },
      screenShare: { shareId: "share-host" },
    });
  });

  it("switches the room to a direct video that either member can seek", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_100);

    room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "direct",
        url: "https://media.example.com/movie.mp4",
        title: "movie.mp4",
        mimeType: "video/mp4",
      },
    }), 1_500);
    const seek = room.applyPlaybackCommand("guest", command("seek", { positionSeconds: 66 }), 1_600);

    expect(seek).toMatchObject({ positionSeconds: 66, paused: true, sequence: 2 });
    expect(room.snapshot(1_600)).toMatchObject({
      mode: "direct-video",
      playback: { media: { type: "direct", url: "https://media.example.com/movie.mp4" } },
    });
  });

  it("maps ZIP0 webpage media to its distinct mode and restores it after screen sharing", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);
    room.authenticate(auth("guest-key", "小夏"), 1_100);

    const changed = room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://www.zip0.com/watch?episode=1&id=158205&source=bfzy",
        contentKey: "zip0:bfzy:158205:1",
        title: "欢迎来龙餐馆",
      },
    }), 1_500);

    expect(changed).toMatchObject({
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://zip0.com/watch?source=bfzy&id=158205&episode=1",
        contentKey: "zip0:bfzy:158205:1",
      },
    });
    expect(room.snapshot(1_500)).toMatchObject({ mode: "webpage" });

    room.startScreenShare("host", screenStart("share-host"), 2_000);
    expect(room.stopScreenShare("host", "share-host")).toBe("webpage");
    expect(room.snapshot(2_100)).toMatchObject({ mode: "webpage", screenShare: null });
  });

  it("rejects ZIP0 media whose content key does not match its URL", () => {
    const room = RoomSession.create("room", "host-key", "guest-key", 1_000);
    room.authenticate(auth("host-key", "小明"), 1_000);

    expect(room.applyPlaybackCommand("host", command("media-change", {
      media: {
        type: "webpage",
        site: "zip0",
        url: "https://zip0.com/watch?source=bfzy&id=158205&episode=1",
        contentKey: "zip0:bfzy:158205:2",
      },
    }), 2_000)).toBe("INVALID_MEDIA");
  });
});
