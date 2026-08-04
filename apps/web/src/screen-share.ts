import type {
  RtcIceCandidatePayload,
  RtcSignalPayload,
  RtcSessionDescriptionPayload,
} from "@tongkan/protocol";

export type ScreenPeerState = "idle" | "connecting" | "connected" | "failed" | "closed";

export interface ScreenSharePeerOptions {
  sendSignal: (shareId: string, signal: RtcSignalPayload) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onStateChange: (state: ScreenPeerState) => void;
  onError: (message: string) => void;
  peerFactory?: () => RTCPeerConnection;
  timeoutMs?: number;
}

export class ScreenSharePeer {
  private peer: RTCPeerConnection | null = null;
  private shareId: string | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RtcIceCandidatePayload[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: ScreenSharePeerOptions) {}

  async startBroadcast(stream: MediaStream, shareId: string): Promise<void> {
    this.localStream = stream;
    this.replacePeer(shareId);
    for (const track of stream.getTracks()) this.peer?.addTrack(track, stream);
    await this.createAndSendOffer();
  }

  prepareViewer(shareId: string): void {
    if (this.shareId === shareId && this.peer) return;
    this.localStream = null;
    this.replacePeer(shareId);
  }

  async handleSignal(shareId: string, signal: RtcSignalPayload): Promise<void> {
    if (this.shareId !== shareId || !this.peer) {
      if (signal.kind === "description" && signal.description.type === "offer") this.prepareViewer(shareId);
      else return;
    }
    const peer = this.peer;
    if (!peer) return;

    try {
      if (signal.kind === "candidate") {
        if (!peer.remoteDescription) this.pendingCandidates.push(signal.candidate);
        else await peer.addIceCandidate(signal.candidate);
        return;
      }

      await peer.setRemoteDescription(signal.description);
      await this.flushCandidates();
      if (signal.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.sendDescription(answer);
      }
    } catch (error) {
      this.fail(error, "P2P 协商失败，请停止共享后重试。");
    }
  }

  close(stopLocal = true): void {
    this.clearTimeout();
    this.peer?.close();
    this.peer = null;
    this.pendingCandidates = [];
    this.shareId = null;
    this.remoteStream = null;
    this.options.onRemoteStream(null);
    if (stopLocal) {
      for (const track of this.localStream?.getTracks() ?? []) track.stop();
      this.localStream = null;
    }
    this.options.onStateChange("closed");
  }

  private replacePeer(shareId: string): void {
    this.clearTimeout();
    this.peer?.close();
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.options.onRemoteStream(null);
    this.shareId = shareId;
    this.peer = this.options.peerFactory?.() ?? new RTCPeerConnection({ iceServers: readIceServers() });
    this.options.onStateChange("connecting");

    this.peer.onicecandidate = (event) => {
      if (!event.candidate || !this.shareId) return;
      this.options.sendSignal(this.shareId, { kind: "candidate", candidate: serializeCandidate(event.candidate) });
    };
    this.peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        this.remoteStream = stream;
      } else {
        this.remoteStream ??= new MediaStream();
        this.remoteStream.addTrack(event.track);
      }
      this.options.onRemoteStream(this.remoteStream);
    };
    this.peer.onconnectionstatechange = () => {
      const state = this.peer?.connectionState;
      if (state === "connected") {
        this.clearTimeout();
        this.options.onStateChange("connected");
      } else if (state === "failed" || state === "disconnected") {
        this.fail(null, "15 秒内没有建立 P2P 连接。请关闭 VPN，或更换共享者后重试。");
      } else if (state === "closed") {
        this.options.onStateChange("closed");
      }
    };

    this.timeout = setTimeout(() => {
      if (this.peer?.connectionState !== "connected") {
        this.fail(null, "15 秒内没有建立 P2P 连接。当前免费版未配置 TURN，中继受限网络可能无法直连。");
      }
    }, this.options.timeoutMs ?? 15_000);
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peer) return;
    try {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      this.sendDescription(offer);
    } catch (error) {
      this.fail(error, "无法创建屏幕共享连接，请停止共享后重试。");
    }
  }

  private sendDescription(description: RTCSessionDescriptionInit): void {
    if (!this.shareId || !description.sdp || (description.type !== "offer" && description.type !== "answer")) return;
    const payload: RtcSessionDescriptionPayload = { type: description.type, sdp: description.sdp };
    this.options.sendSignal(this.shareId, { kind: "description", description: payload });
  }

  private async flushCandidates(): Promise<void> {
    if (!this.peer?.remoteDescription) return;
    const candidates = this.pendingCandidates.splice(0);
    for (const candidate of candidates) await this.peer.addIceCandidate(candidate);
  }

  private fail(error: unknown, fallback: string): void {
    this.clearTimeout();
    this.options.onStateChange("failed");
    this.options.onError(error instanceof Error && error.message ? `${fallback}（${error.message}）` : fallback);
  }

  private clearTimeout(): void {
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
  }
}

function serializeCandidate(candidate: RTCIceCandidate): RtcIceCandidatePayload {
  const source = candidate.toJSON();
  const payload: RtcIceCandidatePayload = {
    candidate: source.candidate ?? candidate.candidate,
    sdpMid: source.sdpMid ?? null,
    sdpMLineIndex: source.sdpMLineIndex ?? null,
  };
  if (source.usernameFragment !== undefined) payload.usernameFragment = source.usernameFragment ?? null;
  return payload;
}

function readIceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_RTC_ICE_SERVERS;
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fall through to the public STUN default.
    }
  }
  return [{ urls: "stun:stun.cloudflare.com:3478" }];
}
