import { describe, expect, it, vi } from "vitest";
import type { RtcSignalPayload } from "@tongkan/protocol";
import { ScreenSharePeer } from "./screen-share";

class FakePeerConnection {
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  connectionState: RTCPeerConnectionState = "new";
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addedCandidates: RTCIceCandidateInit[] = [];
  addedTracks: MediaStreamTrack[] = [];

  addTrack(track: MediaStreamTrack): RTCRtpSender {
    this.addedTracks.push(track);
    return {} as RTCRtpSender;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "offer-sdp" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "answer-sdp" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    this.addedCandidates.push(candidate);
  }

  close(): void {
    this.connectionState = "closed";
  }
}

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() } as unknown as MediaStreamTrack],
  } as MediaStream;
}

describe("ScreenSharePeer", () => {
  it("creates an offer with the captured display tracks", async () => {
    const peer = new FakePeerConnection();
    const signals: RtcSignalPayload[] = [];
    const session = new ScreenSharePeer({
      peerFactory: () => peer as unknown as RTCPeerConnection,
      sendSignal: (_shareId, signal) => signals.push(signal),
      onRemoteStream: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
      timeoutMs: 60_000,
    });

    await session.startBroadcast(fakeStream(), "share-1");

    expect(peer.addedTracks).toHaveLength(1);
    expect(signals).toEqual([{ kind: "description", description: { type: "offer", sdp: "offer-sdp" } }]);
    session.close();
  });

  it("answers an offer and applies ICE candidates received before the description", async () => {
    const peer = new FakePeerConnection();
    const signals: RtcSignalPayload[] = [];
    const session = new ScreenSharePeer({
      peerFactory: () => peer as unknown as RTCPeerConnection,
      sendSignal: (_shareId, signal) => signals.push(signal),
      onRemoteStream: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
      timeoutMs: 60_000,
    });
    session.prepareViewer("share-2");

    await session.handleSignal("share-2", {
      kind: "candidate",
      candidate: { candidate: "candidate-1", sdpMid: "0", sdpMLineIndex: 0 },
    });
    await session.handleSignal("share-2", {
      kind: "description",
      description: { type: "offer", sdp: "remote-offer" },
    });

    expect(peer.addedCandidates).toEqual([{ candidate: "candidate-1", sdpMid: "0", sdpMLineIndex: 0 }]);
    expect(signals).toEqual([{ kind: "description", description: { type: "answer", sdp: "answer-sdp" } }]);
    session.close();
  });
});
