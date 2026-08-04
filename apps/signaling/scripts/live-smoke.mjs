import assert from "node:assert/strict";

const HTTP_ORIGIN = process.env.TONGKAN_SIGNALING_HTTP ?? "http://127.0.0.1:8787";
const WS_ORIGIN = HTTP_ORIGIN.replace(/^http/, "ws");

if (typeof WebSocket === "undefined") {
  throw new Error("The live smoke test requires Node.js 22 or newer.");
}

const roomResponse = await fetch(`${HTTP_ORIGIN}/api/rooms`, { method: "POST" });
assert.equal(roomResponse.status, 201, "room creation should return 201");
const room = await roomResponse.json();

const host = await connectClient(room.roomId, room.hostKey, "自动房主");
const guest = await connectClient(room.roomId, room.inviteKey, "自动访客");

const media = {
  type: "bilibili",
  bvid: "BV1xx411c7mD",
  page: 2,
  canonicalUrl: "https://www.bilibili.com/video/BV1xx411c7mD/?p=2",
};

await commandAndExpectBoth(host, guest, {
  kind: "media-change",
  media,
  positionSeconds: 0,
}, 1, (anchor) => {
  assert.deepEqual(anchor.media, media);
  assert.equal(anchor.paused, true);
});

await commandAndExpectBoth(guest, host, {
  kind: "play",
  positionSeconds: 0,
}, 2, (anchor) => assert.equal(anchor.paused, false));

await commandAndExpectBoth(host, guest, {
  kind: "seek",
  positionSeconds: 42,
}, 3, (anchor) => assert.equal(anchor.positionSeconds, 42));

await commandAndExpectBoth(guest, host, {
  kind: "pause",
  positionSeconds: 43,
}, 4, (anchor) => {
  assert.equal(anchor.paused, true);
  assert.equal(anchor.positionSeconds, 43);
});

await commandAndExpectBoth(guest, host, {
  kind: "play",
  positionSeconds: 43,
}, 5, (anchor) => assert.equal(anchor.paused, false));

host.send({
  type: "playback.report",
  report: {
    sequenceApplied: 5,
    positionSeconds: 43.2,
    paused: false,
    readyState: 2,
    buffering: true,
    media,
    sentAtClientMs: Date.now(),
  },
});

const [hostBufferSnapshot, guestBufferSnapshot] = await Promise.all([
  host.next((event) => event.type === "room.snapshot" && event.snapshot.playback.sequence === 6),
  guest.next((event) => event.type === "room.snapshot" && event.snapshot.playback.sequence === 6),
]);
assert.equal(hostBufferSnapshot.snapshot.playback.paused, true);
assert.equal(guestBufferSnapshot.snapshot.playback.paused, true);
assert.deepEqual(hostBufferSnapshot.snapshot.bufferingSlots, ["host"]);

host.close();
guest.close();

console.log("Live smoke test passed:");
console.log(`  room ${room.roomId}`);
console.log("  host and guest authenticated");
console.log("  both sides controlled media through sequences 1-5");
console.log("  buffering generated authoritative pause at sequence 6");

async function commandAndExpectBoth(actor, observer, payload, expectedSequence, verify) {
  actor.send({
    type: "playback.command",
    commandId: crypto.randomUUID(),
    clientSentAtMs: Date.now(),
    ...payload,
  });
  const [actorEvent, observerEvent] = await Promise.all([
    actor.next((event) => event.type === "playback.anchor" && event.anchor.sequence === expectedSequence),
    observer.next((event) => event.type === "playback.anchor" && event.anchor.sequence === expectedSequence),
  ]);
  assert.deepEqual(actorEvent.anchor, observerEvent.anchor);
  verify(actorEvent.anchor);
}

async function connectClient(roomId, key, nickname) {
  const socket = new WebSocket(`${WS_ORIGIN}/rooms/${roomId}`);
  const queue = [];
  const waiters = [];

  socket.addEventListener("message", (message) => {
    const event = JSON.parse(String(message.data));
    const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(event));
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(event);
    } else {
      queue.push(event);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const client = {
    send(message) {
      socket.send(JSON.stringify(message));
    },
    next(predicate, timeoutMs = 5_000) {
      const queuedIndex = queue.findIndex(predicate);
      if (queuedIndex >= 0) return Promise.resolve(queue.splice(queuedIndex, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error(`Timed out waiting for ${nickname} event`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
    close() {
      socket.close(1000, "test complete");
    },
  };

  client.send({
    type: "auth",
    key,
    nickname,
    capabilities: {
      platform: "web",
      canControlBilibili: true,
      canShareScreen: false,
      canShareSystemAudio: false,
      canUseMicrophone: false,
    },
  });
  const auth = await client.next((event) => event.type === "auth.ok");
  assert.equal(auth.member.nickname, nickname);
  return client;
}
