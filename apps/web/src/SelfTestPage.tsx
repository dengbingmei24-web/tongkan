import {
  Activity,
  Cable,
  CircleCheck,
  CircleX,
  ExternalLink,
  Gauge,
  Link2Off,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScanLine,
  SkipForward,
  TestTube2,
  Video,
  Waves,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ClientPlaybackReport } from "@tongkan/protocol";
import {
  SelfTestRunner,
  type ExternalPlaybackEvent,
  type ParticipantView,
  type SelfTestRole,
  type SelfTestState,
} from "./self-test-runner";

interface SelfTestPageProps {
  nav: ReactNode;
  footer: ReactNode;
}

export function SelfTestPage({ nav, footer }: SelfTestPageProps) {
  const [runner] = useState(() => new SelfTestRunner());
  const [state, setState] = useState<SelfTestState>(() => runner.getState());
  const [extensionState, setExtensionState] = useState<"checking" | "installed" | "missing">("checking");
  const [realRole, setRealRole] = useState<SelfTestRole | null>(null);
  const [bridgeNotice, setBridgeNotice] = useState("正在检测 Edge 扩展…");

  useEffect(() => {
    const unsubscribe = runner.subscribe(() => setState(runner.getState()));
    void runner.initialize();
    const dispose = () => runner.dispose();
    window.addEventListener("beforeunload", dispose);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", dispose);
    };
  }, [runner]);

  useEffect(() => {
    const onExtensionMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== "tongkan-extension") return;
      if (event.data.type === "PONG") {
        setExtensionState("installed");
        setBridgeNotice((current) => current === "正在检测 Edge 扩展…" ? "扩展已连接，可以选择一个真实席位。" : current);
        return;
      }
      if (!realRole || event.data.roomId !== state.roomId) return;
      if (event.data.type === "LOCAL_PLAYBACK") {
        const playbackEvent = event.data.event as ExternalPlaybackEvent;
        runner.applyExternalPlayback(realRole, playbackEvent);
        setBridgeNotice(`已收到真实 B站的${externalEventLabel(playbackEvent.kind)}事件。`);
      }
      if (event.data.type === "LOCAL_REPORT") {
        const report = event.data.report as ClientPlaybackReport;
        runner.applyExternalReport(realRole, report);
        setBridgeNotice(report.buffering ? "真实 B站正在缓冲，房间将联动暂停。" : "真实 B站播放器已恢复可播放。");
      }
    };
    window.addEventListener("message", onExtensionMessage);
    window.postMessage({ source: "tongkan-web", type: "PING_EXTENSION" }, "*");
    const timer = window.setTimeout(() => {
      setExtensionState((current) => {
        if (current === "checking") setBridgeNotice("未检测到扩展；虚拟双端测试仍然可用。");
        return current === "checking" ? "missing" : current;
      });
    }, 900);
    return () => {
      window.removeEventListener("message", onExtensionMessage);
      window.clearTimeout(timer);
    };
  }, [realRole, runner, state.roomId]);

  useEffect(() => {
    if (extensionState !== "installed" || !state.roomId || !realRole) return;
    window.postMessage({ source: "tongkan-web", type: "BIND_ROOM", roomId: state.roomId }, "*");
    setBridgeNotice(`${realRole === "host" ? "房主" : "访客"}席位已绑定；扩展会打开或复用当前 B站视频页。`);
    return () => {
      window.postMessage({ source: "tongkan-web", type: "UNBIND_ROOM", roomId: state.roomId }, "*");
    };
  }, [extensionState, realRole, state.roomId]);

  useEffect(() => {
    if (extensionState !== "installed" || !realRole) return;
    const payload = runner.getBridgePayload(realRole);
    if (!payload) return;
    window.postMessage({ source: "tongkan-web", type: "APPLY_ANCHOR", ...payload }, "*");
  }, [extensionState, realRole, runner, state.serviceSequence]);

  const passed = state.scenarios.filter((scenario) => scenario.status === "passed").length;
  const failed = state.scenarios.filter((scenario) => scenario.status === "failed").length;
  const busy = state.phase === "initializing" || state.phase === "running";

  return (
    <>
      {nav}
      <main className="self-test-shell">
        <header className="self-test-intro reveal" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <p className="self-test-intro__signal"><TestTube2 size={17} />同一页面，两个真实客户端</p>
            <h1>一页跑完双端同步。</h1>
          </div>
          <div className="self-test-intro__copy">
            <p>无需扩展，也不用第二台电脑。左右两侧各自连接同一个临时房间，所有命令仍由本地信令服务排序。</p>
            <p className="self-test-intro__room mono">{state.roomId ? `ROOM ${state.roomId.slice(0, 12)}` : "ROOM PREPARING"}</p>
          </div>
        </header>

        <section className="test-command reveal" style={{ "--i": 1 } as React.CSSProperties} aria-live="polite">
          <div className="test-command__copy">
            <span className={`status-dot ${state.phase === "ready" ? "status-dot--ready" : ""}`} />
            <div>
              <h2>{state.phase === "running" ? "自动验收正在运行" : state.phase === "error" ? "准备过程需要处理" : "双端实验室"}</h2>
              <p>{state.message}</p>
            </div>
          </div>
          <div className="test-command__actions">
            <span className="test-score mono">{passed}/7 通过{failed > 0 ? ` · ${failed} 失败` : ""}</span>
            <button
              className="button button--primary"
              type="button"
              onClick={() => state.phase === "error" ? void runner.initialize() : void runner.runAll()}
              disabled={busy}
              data-state={busy ? "loading" : failed > 0 ? "error" : passed === 7 ? "success" : "default"}
            >
              {busy ? <LoaderCircle className="self-test-spinner" size={18} /> : passed === 7 ? <RotateCcw size={18} /> : <TestTube2 size={18} />}
              {state.phase === "initializing" ? "正在连接" : state.phase === "running" ? "正在验收" : state.phase === "error" ? "重新准备" : passed === 7 ? "再跑一次" : "运行全部测试"}
            </button>
          </div>
        </section>

        <section className="authority-strip reveal" style={{ "--i": 2 } as React.CSSProperties} aria-label="服务端权威状态">
          <div><span>服务序号</span><strong className="mono">{state.serviceSequence}</strong></div>
          <div><span>权威状态</span><strong>{state.authoritativePaused ? "暂停" : "播放"}</strong></div>
          <div><span>权威倍速</span><strong className="mono">{state.authoritativeRate.toFixed(2)}×</strong></div>
          <div className="authority-strip__media"><span>B站媒体</span><strong className="mono">{state.media ? `${state.media.bvid} / P${state.media.page}` : "未绑定"}</strong></div>
        </section>

        <RealBiliBridge
          extensionState={extensionState}
          realRole={realRole}
          notice={bridgeNotice}
          media={state.media}
          onRoleChange={setRealRole}
        />

        <section className="participant-split reveal" style={{ "--i": 3 } as React.CSSProperties} aria-label="双端播放器席位">
          <ParticipantPanel participant={state.host} media={state.media} runner={runner} disabled={busy} isReal={realRole === "host"} />
          <ParticipantPanel participant={state.guest} media={state.media} runner={runner} disabled={busy} isReal={realRole === "guest"} />
        </section>

        <section className="test-evidence reveal" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="scenario-ledger">
            <div className="evidence-heading">
              <div><h2>验收清单</h2><p>每项都等待真实服务端事件返回后才判定。</p></div>
              <ScanLine size={21} />
            </div>
            <ol>
              {state.scenarios.map((scenario) => (
                <li key={scenario.id} data-status={scenario.status}>
                  <span className="scenario-ledger__icon" aria-hidden="true">
                    {scenario.status === "passed" ? <CircleCheck /> : scenario.status === "failed" ? <CircleX /> : scenario.status === "running" ? <LoaderCircle className="self-test-spinner" /> : <span />}
                  </span>
                  <span><strong>{scenario.label}</strong><small>{scenario.detail}</small></span>
                </li>
              ))}
            </ol>
          </div>

          <aside className="event-tape">
            <div className="evidence-heading">
              <div><h2>事件带</h2><p>最近 10 条本地动作与服务端回执。</p></div>
              <Activity size={21} />
            </div>
            {state.eventLog.length === 0 ? (
              <p className="event-tape__empty">房间准备完成后，事件会从这里向下记录。</p>
            ) : (
              <ul>{state.eventLog.map((event, index) => <li className="mono" key={`${event}-${index}`}>{event}</li>)}</ul>
            )}
          </aside>
        </section>
      </main>
      {footer}
    </>
  );
}

function RealBiliBridge({
  extensionState,
  realRole,
  notice,
  media,
  onRoleChange,
}: {
  extensionState: "checking" | "installed" | "missing";
  realRole: SelfTestRole | null;
  notice: string;
  media: SelfTestState["media"];
  onRoleChange: (role: SelfTestRole | null) => void;
}) {
  const available = extensionState === "installed";
  return (
    <section className="real-bridge reveal" style={{ "--i": 3 } as React.CSSProperties} data-state={extensionState} aria-live="polite">
      <div className="real-bridge__copy">
        <span className="real-bridge__mark"><Cable size={20} /></span>
        <div>
          <h2>接入一个真实 B站标签页</h2>
          <p>{notice}</p>
        </div>
      </div>
      <div className="real-bridge__actions" aria-label="选择真实 B站席位">
        <button type="button" aria-pressed={realRole === "host"} onClick={() => onRoleChange(realRole === "host" ? null : "host")} disabled={!available}>房主接入</button>
        <button type="button" aria-pressed={realRole === "guest"} onClick={() => onRoleChange(realRole === "guest" ? null : "guest")} disabled={!available}>访客接入</button>
        {media && <a href={media.canonicalUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开当前视频</a>}
      </div>
    </section>
  );
}

function ParticipantPanel({
  participant,
  media,
  runner,
  disabled,
  isReal,
}: {
  participant: ParticipantView;
  media: SelfTestState["media"];
  runner: SelfTestRunner;
  disabled: boolean;
  isReal: boolean;
}) {
  const [seekValue, setSeekValue] = useState("45");
  const [bvid, setBvid] = useState(media?.bvid ?? "BV1xx411c7mD");
  const [page, setPage] = useState(String(media?.page ?? 1));
  const connected = participant.connection === "connected";
  const controlsDisabled = disabled || !connected;

  useEffect(() => {
    if (!media) return;
    setBvid(media.bvid);
    setPage(String(media.page));
  }, [media?.bvid, media?.page]);

  function submitSeek(event: FormEvent) {
    event.preventDefault();
    runner.seek(participant.role, Number(seekValue) || 0);
  }

  function submitMedia(event: FormEvent) {
    event.preventDefault();
    runner.changeMedia(participant.role, bvid, Number(page) || 1);
  }

  return (
    <article className="participant" data-role={participant.role}>
      <header className="participant__heading">
        <div>
          <p>{participant.role === "host" ? "房主席位" : "访客席位"}</p>
          <h2>{participant.nickname}</h2>
        </div>
        <span className="participant__chips">
          {isReal && <span className="source-chip"><Cable size={14} />真实 B站</span>}
          <span className="connection-chip" data-state={participant.connection}>
            <span className={`status-dot ${connected ? "status-dot--ready" : ""}`} />
            {connectionLabel(participant.connection)}
          </span>
        </span>
      </header>

      <div className="virtual-player">
        <div className="virtual-player__topline">
          <span><Video size={16} />{media ? `P${media.page}` : "等待媒体"}</span>
          <span className="mono">SEQ {participant.sequenceApplied}</span>
        </div>
        <div className="virtual-player__time mono">{formatTime(participant.localPositionSeconds)}</div>
        <div className="virtual-player__trace" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, participant.localPositionSeconds / 180)})` }} />
        </div>
        <div className="virtual-player__state">
          <span>{participant.buffering ? <Waves size={17} /> : participant.paused ? <Pause size={17} /> : <Play size={17} />}{participant.buffering ? "缓冲中" : participant.paused ? "已暂停" : "播放中"}</span>
          <span className="mono">{participant.playbackRate.toFixed(2)}×</span>
        </div>
      </div>

      <dl className="participant-metrics">
        <div><dt>投影位置</dt><dd className="mono">{participant.projectedPositionSeconds.toFixed(2)} s</dd></div>
        <div><dt>本地位置</dt><dd className="mono">{participant.localPositionSeconds.toFixed(2)} s</dd></div>
        <div><dt>当前偏差</dt><dd className="mono" data-tone={Math.abs(participant.driftSeconds) > 1.5 ? "danger" : Math.abs(participant.driftSeconds) >= 0.3 ? "warning" : "normal"}>{signed(participant.driftSeconds)} s</dd></div>
        <div><dt>校准方式</dt><dd><CorrectionBadge kind={participant.correction} /></dd></div>
      </dl>

      <div className="manual-controls" aria-label={`${participant.nickname}手动控制`}>
        <div className="manual-controls__primary">
          <button className="button button--quiet" type="button" onClick={() => runner.play(participant.role)} disabled={controlsDisabled}><Play size={17} />播放</button>
          <button className="button button--quiet" type="button" onClick={() => runner.pause(participant.role)} disabled={controlsDisabled}><Pause size={17} />暂停</button>
          <button className="button button--quiet" type="button" onClick={() => runner.toggleBuffering(participant.role)} disabled={controlsDisabled} data-state={participant.buffering ? "error" : "default"}><Waves size={17} />{participant.buffering ? "结束缓冲" : "模拟缓冲"}</button>
          <button className="button button--quiet" type="button" onClick={() => connected ? runner.disconnect(participant.role) : runner.reconnect(participant.role)} disabled={disabled}>
            {connected ? <Link2Off size={17} /> : <RefreshCw size={17} />}{connected ? "断开" : "重连"}
          </button>
        </div>

        <form className="inline-command" onSubmit={submitSeek}>
          <label htmlFor={`${participant.role}-seek`}>跳转到秒数</label>
          <div><input id={`${participant.role}-seek`} type="number" min="0" step="0.1" value={seekValue} onChange={(event) => setSeekValue(event.target.value)} disabled={controlsDisabled} /><button type="submit" disabled={controlsDisabled}><SkipForward size={17} />跳转</button></div>
        </form>

        <label className="select-command">
          <span>播放倍速</span>
          <span><Gauge size={17} /><select value={participant.playbackRate} onChange={(event) => runner.setRate(participant.role, Number(event.target.value))} disabled={controlsDisabled}>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate.toFixed(2)}×</option>)}
          </select></span>
        </label>

        <form className="media-command" onSubmit={submitMedia}>
          <label><span>BV 号</span><input value={bvid} onChange={(event) => setBvid(event.target.value)} maxLength={12} disabled={controlsDisabled} /></label>
          <label><span>分 P</span><input type="number" min="1" step="1" value={page} onChange={(event) => setPage(event.target.value)} disabled={controlsDisabled} /></label>
          <button type="submit" disabled={controlsDisabled}><Video size={17} />切换</button>
        </form>
      </div>
    </article>
  );
}

function CorrectionBadge({ kind }: { kind: ParticipantView["correction"] }) {
  return <span className="correction-badge" data-kind={kind}>{kind === "seek" ? "硬跳转" : kind === "rate" ? "倍速微调" : "无需校准"}</span>;
}

function connectionLabel(connection: ParticipantView["connection"]): string {
  return ({ connecting: "连接中", connected: "已连接", reconnecting: "自动重连中", closed: "已断开", error: "连接错误" })[connection];
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
}

function signed(value: number): string {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(2)}`;
}

function externalEventLabel(kind: ExternalPlaybackEvent["kind"]): string {
  return ({ play: "播放", pause: "暂停", seek: "跳转", rate: "倍速", "media-change": "换视频" })[kind];
}
