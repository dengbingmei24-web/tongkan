import {
  planDriftCorrection,
  positionAt,
  type BiliMediaIdentity,
  type ClientPlaybackReport,
  type MemberSlot,
  type PlaybackAnchor,
  type PlaybackCommandKind,
  type RoomSnapshot,
  type ServerEvent,
} from "@tongkan/protocol";
import { createRoom, RoomClient, type ConnectionState as RoomConnectionState } from "./room-client";

export type SelfTestRole = MemberSlot;
export type ConnectionState = RoomConnectionState;
export type TestStatus = "pending" | "running" | "passed" | "failed";

export interface ExternalPlaybackEvent {
  kind: PlaybackCommandKind;
  positionSeconds?: number;
  playbackRate?: number;
  media?: BiliMediaIdentity;
}

export interface ParticipantView {
  role: SelfTestRole;
  nickname: string;
  connection: ConnectionState;
  localPositionSeconds: number;
  projectedPositionSeconds: number;
  driftSeconds: number;
  correction: "none" | "rate" | "seek";
  paused: boolean;
  playbackRate: number;
  buffering: boolean;
  sequenceApplied: number;
}

export interface ScenarioResult {
  id: string;
  label: string;
  status: TestStatus;
  detail: string;
}

export interface SelfTestState {
  phase: "idle" | "initializing" | "ready" | "running" | "error";
  roomId: string | null;
  message: string;
  serviceSequence: number;
  authoritativePaused: boolean;
  authoritativeRate: number;
  media: BiliMediaIdentity | null;
  host: ParticipantView;
  guest: ParticipantView;
  scenarios: ScenarioResult[];
  eventLog: string[];
}

interface ParticipantRuntime extends ParticipantView {
  client: RoomClient | null;
  memberId: string | null;
  generation: number;
  anchor: PlaybackAnchor | null;
  lastTickAtMs: number;
  correctionUntilMs: number;
  sequenceLog: number[];
}

const capabilities = {
  platform: "web" as const,
  canControlBilibili: true,
  canShareScreen: false,
  canShareSystemAudio: false,
  canUseMicrophone: false,
};

const scenarioDefinitions: Array<Pick<ScenarioResult, "id" | "label">> = [
  { id: "host-play", label: "房主播放，访客跟随" },
  { id: "guest-pause", label: "访客暂停，房主跟随" },
  { id: "both-seek", label: "双方都能跳转进度" },
  { id: "server-order", label: "同时操作按服务端序号收敛" },
  { id: "hard-seek", label: "偏差超过 1.5 秒触发硬跳转" },
  { id: "buffering", label: "任一方缓冲会暂停双方" },
  { id: "reconnect", label: "重连恢复最新权威状态" },
];

const defaultAnchor: PlaybackAnchor = {
  media: null,
  paused: true,
  positionSeconds: 0,
  playbackRate: 1,
  anchoredAtServerMs: Date.now(),
  sequence: 0,
  actorId: null,
};

export class SelfTestRunner {
  private listeners = new Set<() => void>();
  private credentials: { host: string; guest: string } | null = null;
  private initializePromise: Promise<void> | null = null;
  private tickTimer: number | null = null;
  private anchor: PlaybackAnchor = defaultAnchor;
  private snapshot: RoomSnapshot | null = null;
  private phase: SelfTestState["phase"] = "idle";
  private roomId: string | null = null;
  private message = "正在准备真实双端房间…";
  private scenarios = makeScenarioResults();
  private eventLog: string[] = [];
  private participants: Record<SelfTestRole, ParticipantRuntime> = {
    host: makeParticipant("host", "左侧 · 房主"),
    guest: makeParticipant("guest", "右侧 · 访客"),
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SelfTestState => ({
    phase: this.phase,
    roomId: this.roomId,
    message: this.message,
    serviceSequence: this.anchor.sequence,
    authoritativePaused: this.anchor.paused,
    authoritativeRate: this.anchor.playbackRate,
    media: this.anchor.media?.type === "bilibili" ? this.anchor.media : null,
    host: viewOf(this.participants.host),
    guest: viewOf(this.participants.guest),
    scenarios: this.scenarios.map((item) => ({ ...item })),
    eventLog: [...this.eventLog],
  });

  async initialize(): Promise<void> {
    if (this.phase === "ready" || this.phase === "running") return;
    if (this.initializePromise) return this.initializePromise;
    this.initializePromise = this.prepareRoom();
    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  async runAll(): Promise<void> {
    await this.initialize();
    if (this.phase === "running" || this.phase !== "ready") return;
    this.phase = "running";
    this.message = "正在执行 7 项真实双端验收…";
    this.scenarios = makeScenarioResults();
    this.emit();

    await this.runScenario("host-play", async () => {
      const next = this.anchor.sequence + 1;
      this.play("host");
      await this.waitUntil(() => this.bothApplied(next) && !this.participants.host.paused && !this.participants.guest.paused);
      return `双方已应用序号 ${next}`;
    });

    await this.runScenario("guest-pause", async () => {
      const next = this.anchor.sequence + 1;
      this.pause("guest");
      await this.waitUntil(() => this.bothApplied(next) && this.participants.host.paused && this.participants.guest.paused);
      return `访客发令，双方停在 ${formatSeconds(this.anchor.positionSeconds)}`;
    });

    await this.runScenario("both-seek", async () => {
      let next = this.anchor.sequence + 1;
      this.seek("host", 32);
      await this.waitUntil(() => this.bothApplied(next));
      next += 1;
      this.seek("guest", 68);
      await this.waitUntil(() => this.bothApplied(next) && Math.abs(this.participants.host.localPositionSeconds - 68) < 0.3);
      return `房主与访客分别完成跳转，最终序号 ${next}`;
    });

    await this.runScenario("server-order", async () => {
      const baseline = this.anchor.sequence;
      this.participants.host.sequenceLog = [];
      this.participants.guest.sequenceLog = [];
      this.play("host");
      this.pause("guest");
      await this.waitUntil(() => this.bothApplied(baseline + 2));
      const hostOrder = this.participants.host.sequenceLog.filter((sequence) => sequence > baseline).slice(-2);
      const guestOrder = this.participants.guest.sequenceLog.filter((sequence) => sequence > baseline).slice(-2);
      if (hostOrder.length !== 2 || hostOrder.join(",") !== guestOrder.join(",")) {
        throw new Error(`两端事件序列不同：${hostOrder.join("→")} / ${guestOrder.join("→")}`);
      }
      return `两端都按 ${hostOrder.join(" → ")} 应用`;
    });

    await this.runScenario("hard-seek", async () => {
      if (this.anchor.paused) {
        const next = this.anchor.sequence + 1;
        this.play("host");
        await this.waitUntil(() => this.bothApplied(next) && !this.anchor.paused);
      }
      this.injectDrift("guest", -4);
      this.tick(Date.now());
      await this.waitUntil(() => this.participants.guest.correction === "seek" && Math.abs(this.participants.guest.driftSeconds) < 0.3);
      return "访客落后 4 秒后执行硬跳转";
    });

    await this.runScenario("buffering", async () => {
      if (this.anchor.paused) {
        const playSequence = this.anchor.sequence + 1;
        this.play("host");
        await this.waitUntil(() => this.bothApplied(playSequence) && !this.anchor.paused);
      }
      const pauseSequence = this.anchor.sequence + 1;
      this.setBuffering("guest", true);
      await this.waitUntil(() => this.bothApplied(pauseSequence) && this.anchor.paused && this.participants.host.paused);
      this.setBuffering("guest", false);
      return `访客缓冲触发权威暂停，序号 ${pauseSequence}`;
    });

    await this.runScenario("reconnect", async () => {
      this.disconnect("guest");
      await this.waitUntil(() => this.participants.guest.connection === "closed");
      const next = this.anchor.sequence + 1;
      this.setRate("host", 1.25);
      await this.waitUntil(() => this.participants.host.sequenceApplied >= next && this.anchor.playbackRate === 1.25);
      this.reconnect("guest");
      await this.waitUntil(() => this.participants.guest.connection === "connected" && this.participants.guest.sequenceApplied >= next && this.participants.guest.playbackRate === 1.25, 7_000);
      return `访客重连后恢复序号 ${next} 与 1.25× 倍速`;
    });

    const failures = this.scenarios.filter((item) => item.status === "failed").length;
    this.phase = "ready";
    this.message = failures === 0 ? "7 项验收全部通过。现在可以继续手动操作。" : `${failures} 项未通过，请查看下方原因后重试。`;
    this.emit();
  }

  applyExternalPlayback(role: SelfTestRole, event: ExternalPlaybackEvent): void {
    const participant = this.participants[role];
    if (typeof event.positionSeconds === "number") {
      participant.localPositionSeconds = Math.max(0, event.positionSeconds);
    }
    if (typeof event.playbackRate === "number") {
      participant.playbackRate = Math.min(2, Math.max(0.25, event.playbackRate));
    }
    if (event.kind === "play") participant.paused = false;
    if (event.kind === "pause") participant.paused = true;
    if (event.kind === "media-change") {
      participant.paused = true;
      participant.localPositionSeconds = Math.max(0, event.positionSeconds ?? 0);
      participant.playbackRate = 1;
    }
    this.sendCommand(role, event.kind, {
      ...(typeof event.positionSeconds === "number" ? { positionSeconds: event.positionSeconds } : {}),
      ...(typeof event.playbackRate === "number" ? { playbackRate: event.playbackRate } : {}),
      ...(event.media ? { media: event.media } : {}),
    });
    this.pushLog(`${participant.nickname}从真实 B站上报 ${commandLabel(event.kind)}`);
    this.emit();
  }

  applyExternalReport(role: SelfTestRole, report: ClientPlaybackReport): void {
    const participant = this.participants[role];
    participant.localPositionSeconds = Math.max(0, report.positionSeconds);
    participant.paused = report.paused;
    participant.buffering = report.buffering;
    participant.client?.sendReport(report);
    this.pushLog(`${participant.nickname}从真实 B站上报${report.buffering ? "缓冲" : "可播放"}`);
    this.emit();
  }

  getBridgePayload(role: SelfTestRole): { roomId: string; anchor: PlaybackAnchor; serverNowMs: number } | null {
    if (!this.roomId) return null;
    return {
      roomId: this.roomId,
      anchor: { ...this.anchor },
      serverNowMs: this.participants[role].client?.serverNow() ?? Date.now(),
    };
  }

  play(role: SelfTestRole): void {
    const participant = this.participants[role];
    participant.paused = false;
    this.sendCommand(role, "play", { positionSeconds: participant.localPositionSeconds });
  }

  pause(role: SelfTestRole): void {
    const participant = this.participants[role];
    participant.paused = true;
    this.sendCommand(role, "pause", { positionSeconds: participant.localPositionSeconds });
  }

  seek(role: SelfTestRole, positionSeconds: number): void {
    const safePosition = Math.max(0, positionSeconds);
    this.participants[role].localPositionSeconds = safePosition;
    this.sendCommand(role, "seek", { positionSeconds: safePosition });
  }

  setRate(role: SelfTestRole, playbackRate: number): void {
    const safeRate = Math.min(2, Math.max(0.25, playbackRate));
    this.participants[role].playbackRate = safeRate;
    this.sendCommand(role, "rate", { playbackRate: safeRate });
  }

  changeMedia(role: SelfTestRole, bvid: string, page: number): void {
    const normalizedBvid = bvid.trim();
    if (!/^BV[0-9A-Za-z]{10}$/.test(normalizedBvid)) {
      this.message = "BV 号格式不正确；应为 BV 开头的 12 位编号。";
      this.emit();
      return;
    }
    const safePage = Math.max(1, Math.floor(page));
    const media = makeBiliMedia(normalizedBvid, safePage);
    this.participants[role].localPositionSeconds = 0;
    this.participants[role].paused = true;
    this.participants[role].playbackRate = 1;
    this.sendCommand(role, "media-change", { media, positionSeconds: 0 });
  }

  setBuffering(role: SelfTestRole, buffering: boolean): void {
    const participant = this.participants[role];
    participant.buffering = buffering;
    participant.client?.sendReport({
      sequenceApplied: participant.sequenceApplied,
      positionSeconds: participant.localPositionSeconds,
      paused: participant.paused,
      readyState: buffering ? 2 : 4,
      buffering,
      media: this.anchor.media,
      sentAtClientMs: Date.now(),
    });
    this.pushLog(`${participant.nickname}${buffering ? "开始缓冲" : "恢复可播放"}`);
    this.emit();
  }

  toggleBuffering(role: SelfTestRole): void {
    this.setBuffering(role, !this.participants[role].buffering);
  }

  disconnect(role: SelfTestRole): void {
    const participant = this.participants[role];
    participant.generation += 1;
    participant.client?.close();
    participant.client = null;
    participant.connection = "closed";
    participant.buffering = false;
    this.pushLog(`${participant.nickname}已断开`);
    this.emit();
  }

  reconnect(role: SelfTestRole): void {
    if (!this.roomId || !this.credentials || this.participants[role].connection === "connected") return;
    this.connectParticipant(role, this.credentials[role]);
  }

  injectDrift(role: SelfTestRole, seconds: number): void {
    const participant = this.participants[role];
    participant.localPositionSeconds = Math.max(0, participant.localPositionSeconds + seconds);
    participant.correction = "none";
    participant.correctionUntilMs = 0;
    this.pushLog(`${participant.nickname}注入 ${seconds > 0 ? "+" : ""}${seconds.toFixed(1)} 秒偏差`);
    this.tick(Date.now());
  }

  dispose(): void {
    if (this.tickTimer !== null) window.clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.disconnect("host");
    this.disconnect("guest");
    this.listeners.clear();
  }

  private async prepareRoom(): Promise<void> {
    this.phase = "initializing";
    this.message = "正在创建临时房间并连接两个席位…";
    this.emit();
    try {
      const room = await createRoom();
      this.roomId = room.roomId;
      this.credentials = { host: room.hostKey, guest: room.inviteKey };
      this.connectParticipant("host", room.hostKey);
      this.connectParticipant("guest", room.inviteKey);
      if (this.tickTimer === null) this.tickTimer = window.setInterval(() => this.tick(Date.now()), 100);
      await this.waitUntil(() => this.participants.host.sequenceApplied === 0
        && this.participants.guest.sequenceApplied === 0
        && this.participants.host.connection === "connected"
        && this.participants.guest.connection === "connected", 7_000);
      this.changeMedia("host", "BV1xx411c7mD", 1);
      await this.waitUntil(() => this.bothApplied(1), 7_000);
      this.phase = "ready";
      this.message = "真实房间已就绪。可以一键验收，也可以直接手动操作。";
      this.pushLog(`临时房间 ${room.roomId.slice(0, 8)} 已连接`);
      this.emit();
    } catch (reason) {
      this.phase = "error";
      this.message = reason instanceof Error ? reason.message : "自测房间没有准备成功。";
      this.emit();
    }
  }

  private connectParticipant(role: SelfTestRole, key: string): void {
    if (!this.roomId) return;
    const participant = this.participants[role];
    const generation = participant.generation + 1;
    participant.generation = generation;
    participant.connection = "connecting";
    participant.memberId = null;
    const client = new RoomClient({
      roomId: this.roomId,
      key,
      nickname: participant.nickname,
      capabilities,
      onConnectionChange: (connection) => {
        if (participant.generation !== generation) return;
        participant.connection = connection;
        this.emit();
      },
      onEvent: (event) => {
        if (participant.generation !== generation) return;
        this.handleEvent(role, event);
      },
    });
    participant.client = client;
    client.connect();
    this.emit();
  }

  private handleEvent(role: SelfTestRole, event: ServerEvent): void {
    const participant = this.participants[role];
    if (event.type === "auth.ok") {
      participant.memberId = event.member.id;
      this.applySnapshot(role, event.snapshot);
      this.pushLog(`${participant.nickname}认证成功`);
    }
    if (event.type === "room.snapshot") this.applySnapshot(role, event.snapshot);
    if (event.type === "playback.anchor") {
      if (event.anchor.sequence >= this.anchor.sequence) this.anchor = event.anchor;
      this.applyAnchor(role, event.anchor);
      if (role === "host") this.pushLog(`${event.actorNickname}提交序号 ${event.anchor.sequence}`);
    }
    if (event.type === "error") {
      this.message = `${participant.nickname}：${event.message}`;
      this.pushLog(this.message);
    }
    this.emit();
  }

  private applySnapshot(role: SelfTestRole, snapshot: RoomSnapshot): void {
    this.snapshot = snapshot;
    if (snapshot.playback.sequence >= this.anchor.sequence) this.anchor = snapshot.playback;
    this.applyAnchor(role, snapshot.playback);
  }

  private applyAnchor(role: SelfTestRole, anchor: PlaybackAnchor): void {
    const participant = this.participants[role];
    participant.anchor = anchor;
    participant.sequenceApplied = anchor.sequence;
    participant.sequenceLog.push(anchor.sequence);
    participant.sequenceLog = participant.sequenceLog.slice(-12);
    participant.paused = anchor.paused;
    const nowMs = participant.client?.serverNow() ?? Date.now();
    const correction = planDriftCorrection(anchor, participant.localPositionSeconds, nowMs);
    participant.projectedPositionSeconds = correction.targetPositionSeconds;
    if (correction.kind === "seek") participant.localPositionSeconds = correction.targetPositionSeconds;
    participant.playbackRate = correction.kind === "rate" ? correction.playbackRate : anchor.playbackRate;
    participant.driftSeconds = correction.targetPositionSeconds - participant.localPositionSeconds;
    participant.correction = correction.kind;
    participant.correctionUntilMs = correction.kind === "none" ? participant.correctionUntilMs : Date.now() + 1_500;
    participant.lastTickAtMs = Date.now();
  }

  private tick(nowMs: number): void {
    for (const participant of Object.values(this.participants)) {
      const elapsedSeconds = Math.max(0, nowMs - participant.lastTickAtMs) / 1000;
      participant.lastTickAtMs = nowMs;
      if (participant.connection === "connected" && !participant.paused) {
        participant.localPositionSeconds += elapsedSeconds * participant.playbackRate;
      }
      if (!participant.anchor || participant.connection !== "connected") continue;
      const serverNowMs = participant.client?.serverNow() ?? nowMs;
      const correction = planDriftCorrection(participant.anchor, participant.localPositionSeconds, serverNowMs);
      participant.projectedPositionSeconds = correction.targetPositionSeconds;
      if (correction.kind === "seek") {
        participant.localPositionSeconds = correction.targetPositionSeconds;
        participant.playbackRate = participant.anchor.playbackRate;
        participant.correction = "seek";
        participant.correctionUntilMs = nowMs + 1_500;
      } else if (correction.kind === "rate" && !participant.paused) {
        participant.playbackRate = correction.playbackRate;
        participant.correction = "rate";
        participant.correctionUntilMs = nowMs + 1_500;
      } else {
        participant.playbackRate = participant.anchor.playbackRate;
        if (nowMs >= participant.correctionUntilMs) participant.correction = "none";
      }
      participant.driftSeconds = participant.projectedPositionSeconds - participant.localPositionSeconds;
    }
    this.emit();
  }

  private sendCommand(
    role: SelfTestRole,
    kind: PlaybackCommandKind,
    fields: { positionSeconds?: number; playbackRate?: number; media?: BiliMediaIdentity },
  ): void {
    const participant = this.participants[role];
    if (participant.connection !== "connected" || !participant.client) {
      this.message = `${participant.nickname}当前未连接；请先重连。`;
      this.emit();
      return;
    }
    participant.client.sendCommand({ kind, ...fields });
    this.pushLog(`${participant.nickname}发送 ${commandLabel(kind)}`);
    this.emit();
  }

  private bothApplied(sequence: number): boolean {
    return this.participants.host.sequenceApplied >= sequence && this.participants.guest.sequenceApplied >= sequence;
  }

  private async runScenario(id: string, run: () => Promise<string>): Promise<void> {
    const item = this.scenarios.find((scenario) => scenario.id === id);
    if (!item) return;
    item.status = "running";
    item.detail = "执行中";
    this.emit();
    try {
      item.detail = await run();
      item.status = "passed";
    } catch (reason) {
      item.status = "failed";
      item.detail = reason instanceof Error ? reason.message : "未满足验收条件";
    }
    this.emit();
  }

  private waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (predicate()) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          reject(new Error(`等待服务端状态超时（${timeoutMs / 1_000} 秒）`));
        }
      }, 25);
    });
  }

  private pushLog(message: string): void {
    const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    this.eventLog = [`${time}　${message}`, ...this.eventLog].slice(0, 10);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function makeParticipant(role: SelfTestRole, nickname: string): ParticipantRuntime {
  return {
    role,
    nickname,
    connection: "closed",
    localPositionSeconds: 0,
    projectedPositionSeconds: 0,
    driftSeconds: 0,
    correction: "none",
    paused: true,
    playbackRate: 1,
    buffering: false,
    sequenceApplied: 0,
    client: null,
    memberId: null,
    generation: 0,
    anchor: null,
    lastTickAtMs: Date.now(),
    correctionUntilMs: 0,
    sequenceLog: [],
  };
}

function viewOf(participant: ParticipantRuntime): ParticipantView {
  return {
    role: participant.role,
    nickname: participant.nickname,
    connection: participant.connection,
    localPositionSeconds: participant.localPositionSeconds,
    projectedPositionSeconds: participant.projectedPositionSeconds,
    driftSeconds: participant.driftSeconds,
    correction: participant.correction,
    paused: participant.paused,
    playbackRate: participant.playbackRate,
    buffering: participant.buffering,
    sequenceApplied: participant.sequenceApplied,
  };
}

function makeScenarioResults(): ScenarioResult[] {
  return scenarioDefinitions.map((scenario) => ({ ...scenario, status: "pending", detail: "等待执行" }));
}

function makeBiliMedia(bvid: string, page: number): BiliMediaIdentity {
  return {
    type: "bilibili",
    bvid,
    page,
    canonicalUrl: `https://www.bilibili.com/video/${bvid}/?p=${page}`,
  };
}

function commandLabel(kind: PlaybackCommandKind): string {
  return ({ play: "播放", pause: "暂停", seek: "跳转", rate: "倍速", "media-change": "换视频" })[kind];
}

function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(2)} 秒`;
}
