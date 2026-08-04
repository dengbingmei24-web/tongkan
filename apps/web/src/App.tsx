import {
  CircleHelp,
  Clipboard,
  ExternalLink,
  Link2,
  Maximize2,
  MessageCircle,
  Mic,
  MonitorUp,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseBilibiliUrl,
  positionAt,
  type BiliMediaIdentity,
  type ClientPlaybackReport,
  type DirectMediaIdentity,
  type MediaIdentity,
  type RoomMember,
  type RoomSnapshot,
  type ScreenShareState,
  type ServerEvent,
} from "@tongkan/protocol";
import {
  createRoom,
  getHashCredential,
  getRoomIdFromPath,
  inviteUrl,
  loadIdentity,
  persistIdentity,
  RoomClient,
  snapshotPartner,
} from "./room-client";
import { SelfTestPage } from "./SelfTestPage";
import { applyDirectAnchorToVideo, parseDirectVideoUrl } from "./direct-video";
import { ScreenSharePeer, type ScreenPeerState } from "./screen-share";

const defaultCapabilities = {
  platform: "web" as const,
  canControlBilibili: false,
  canShareScreen: typeof navigator.mediaDevices?.getDisplayMedia === "function",
  canShareSystemAudio: typeof navigator.mediaDevices?.getDisplayMedia === "function",
  canUseMicrophone: typeof navigator.mediaDevices?.getUserMedia === "function",
};

function Nav({ status = "本地开发" }: { status?: string }) {
  return (
    <nav className="nav-pill" aria-label="主导航">
      <a className="wordmark" href="/" aria-label="返回同看首页">同看</a>
      <span className="nav-pill__status"><span className="status-dot" />{status}</span>
      <a className="nav-pill__link" href="/self-test">自测</a>
      <a className="nav-pill__link" href="/PRD.md">产品说明</a>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="foot-stmt">
      <p className="foot-stmt__line">不是把画面传过去，是让两边停在同一秒。</p>
      <div className="foot-stmt__meta">
        <span className="wordmark">同看</span>
        <span>个人版 · 两人房间 · 内容不保存</span>
      </div>
    </footer>
  );
}

function HomePage() {
  const [nickname, setNickname] = useState(localStorage.getItem("tongkan:nickname") ?? "");
  const [videoUrl, setVideoUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const media = useMemo(() => parseMediaInput(videoUrl), [videoUrl]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!nickname.trim() || !media) return;
    setState("loading");
    setError("");
    try {
      const room = await createRoom();
      localStorage.setItem("tongkan:nickname", nickname.trim());
      persistIdentity(room.roomId, "host", room.hostKey, nickname.trim());
      sessionStorage.setItem(`tongkan:${room.roomId}:invite`, room.inviteKey);
      sessionStorage.setItem(`tongkan:${room.roomId}:media`, JSON.stringify(media));
      window.location.assign(`/room/${room.roomId}#host=${room.hostKey}`);
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "房间没有创建成功，请重试。");
    }
  }

  const nameError = touched && !nickname.trim();
  const urlError = touched && !media;

  return (
    <>
      <Nav />
      <main className="home-shell">
        <section className="intro reveal" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <p className="intro__signal"><Radio size={16} /> B站或视频直链</p>
            <h1>两个人，同一条进度。</h1>
          </div>
          <p className="intro__lede">
            可以同步 B站播放器，也可以把可直接播放的视频链接载入房间。双方都能播放、暂停和拖动进度。
          </p>
        </section>

        <section className="workbench reveal" style={{ "--i": 1 } as React.CSSProperties}>
          <form className="create-panel" onSubmit={handleCreate} noValidate>
            <div className="panel-heading">
              <div>
                <h2>创建私人房间</h2>
                <p>固定两人，无需账号。</p>
              </div>
              <Users aria-hidden="true" />
            </div>

            <label className="field">
              <span className="field__label">你的昵称</span>
              <span className="field__control">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="例如：小明"
                  maxLength={24}
                  aria-invalid={nameError}
                  aria-describedby="nickname-help"
                />
              </span>
              <span id="nickname-help" className={nameError ? "field__help field__help--error" : "field__help"}>
                {nameError ? "昵称为空，填写一个对方能认出的名字。" : "只在当前房间中显示。"}
              </span>
            </label>

            <label className="field">
              <span className="field__label">视频链接</span>
              <span className="field__control">
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="B站链接，或 https://…/movie.mp4"
                  aria-invalid={urlError}
                  aria-describedby="video-help"
                />
                <Video size={18} aria-hidden="true" />
              </span>
              <span id="video-help" className={urlError ? "field__help field__help--error" : "field__help"}>
                {urlError
                  ? "没有识别到可用链接，请粘贴 B站视频页或 HTTP/HTTPS 视频直链。"
                  : media?.type === "bilibili"
                    ? `${media.bvid} · 第 ${media.page} P`
                    : media?.type === "direct"
                      ? `直链视频 · ${media.title ?? new URL(media.url).hostname}`
                      : "支持 B站视频页，以及浏览器可直接播放的 MP4/WebM 等地址。"}
              </span>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button--primary" type="submit" data-state={state} disabled={state === "loading"}>
              {state === "loading" ? <span className="spinner" /> : <Link2 size={18} />}
              {state === "loading" ? "正在创建" : "创建房间"}
            </button>
          </form>

          <div className="room-preview" aria-label="房间功能预览">
            <div className="preview-stage">
              <div className="preview-stage__topline">
                <span><span className="status-dot status-dot--ready" />双方已同步</span>
                <span className="mono">00:18:42</span>
              </div>
              <div className="preview-stage__centre">
                <button className="round-control" type="button" aria-label="播放预览"><Play fill="currentColor" /></button>
                <p>视频在 B站播放，房间只传控制状态。</p>
              </div>
              <div className="preview-timeline"><span /></div>
            </div>
            <div className="preview-events">
              <p><span>你</span> 将进度调整到 <strong>18:42</strong></p>
              <p><span>对方</span> 已准备，可以开始播放</p>
            </div>
          </div>
        </section>

        <section className="support-strip reveal" style={{ "--i": 2 } as React.CSSProperties}>
          <p><MonitorUp size={18} />不能同步的内容，切换为屏幕共享。</p>
          <p><CircleHelp size={18} />免费版使用 P2P，部分严格网络可能无法直连。</p>
        </section>
      </main>
      <Footer />
    </>
  );
}

interface ChatItem {
  id: string;
  nickname: string;
  text: string;
  own: boolean;
}

function JoinGate({ roomId, credential }: { roomId: string; credential: { role: "host" | "guest"; key: string } | null }) {
  const [nickname, setNickname] = useState(localStorage.getItem("tongkan:nickname") ?? "");
  const [error, setError] = useState(false);

  function join(event: React.FormEvent) {
    event.preventDefault();
    if (!credential || !nickname.trim()) {
      setError(true);
      return;
    }
    localStorage.setItem("tongkan:nickname", nickname.trim());
    persistIdentity(roomId, credential.role, credential.key, nickname.trim());
    window.location.reload();
  }

  return (
    <>
      <Nav status="等待加入" />
      <main className="join-shell">
        <form className="create-panel join-panel" onSubmit={join}>
          <div className="panel-heading">
            <div><h1>加入私人房间</h1><p>链接只允许一名朋友进入。</p></div>
            <Users />
          </div>
          <label className="field">
            <span className="field__label">你的昵称</span>
            <span className="field__control"><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="例如：小夏" /></span>
            <span className={error ? "field__help field__help--error" : "field__help"}>{error ? "填写昵称后才能加入房间。" : "不需要注册或密码。"}</span>
          </label>
          {!credential && <p className="form-error">邀请信息不完整，请让房主重新复制链接。</p>}
          <button className="button button--primary" type="submit"><Link2 size={18} />加入房间</button>
        </form>
      </main>
    </>
  );
}

function RoomPage({ roomId }: { roomId: string }) {
  const hashCredential = getHashCredential();
  const identity = loadIdentity(roomId);
  if (!identity) return <JoinGate roomId={roomId} credential={hashCredential} />;
  return <ConnectedRoom roomId={roomId} identity={identity} />;
}

function ConnectedRoom({ roomId, identity }: { roomId: string; identity: { role: "host" | "guest"; key: string; nickname: string } }) {
  const [connection, setConnection] = useState<"connecting" | "connected" | "closed" | "error">("connecting");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [self, setSelf] = useState<RoomMember | null>(null);
  const [notice, setNotice] = useState("正在连接房间…");
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [chatText, setChatText] = useState("");
  const [seekPosition, setSeekPosition] = useState(0);
  const [copied, setCopied] = useState(false);
  const [extensionState, setExtensionState] = useState<"checking" | "installed" | "missing">("checking");
  const [screenUiState, setScreenUiState] = useState<"idle" | "requesting" | "connecting" | "sharing" | "watching" | "stopping" | "error">("idle");
  const [screenPeerState, setScreenPeerState] = useState<ScreenPeerState>("idle");
  const [screenError, setScreenError] = useState("");
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaInputError, setMediaInputError] = useState("");
  const [directPosition, setDirectPosition] = useState(0);
  const [directDuration, setDirectDuration] = useState(0);
  const [directError, setDirectError] = useState("");
  const clientRef = useRef<RoomClient | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const screenPeerRef = useRef<ScreenSharePeer | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const activeShareIdRef = useRef<string | null>(null);
  const screenShareRef = useRef<ScreenShareState | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const stoppingShareRef = useRef(false);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);
  const directSeekingRef = useRef(false);
  const directSeekPositionRef = useRef(0);
  const lastDirectTapAtRef = useRef(0);

  function ensureScreenPeer(): ScreenSharePeer {
    screenPeerRef.current ??= new ScreenSharePeer({
      sendSignal: (shareId, signal) => clientRef.current?.sendRtcSignal(shareId, signal),
      onRemoteStream: setRemoteScreenStream,
      onStateChange: (state) => {
        setScreenPeerState(state);
        if (state === "connected") {
          const sharingSelf = screenShareRef.current?.sharerMemberId === selfIdRef.current;
          setScreenUiState(sharingSelf ? "sharing" : "watching");
          setScreenError("");
        }
      },
      onError: (message) => {
        setScreenUiState("error");
        setScreenError(message);
        setNotice(message);
      },
    });
    return screenPeerRef.current;
  }

  useEffect(() => () => {
    screenPeerRef.current?.close(true);
    screenPeerRef.current = null;
  }, []);

  useEffect(() => {
    const stream = screenShareRef.current?.sharerMemberId === selfIdRef.current
      ? localScreenStream
      : remoteScreenStream;
    const videoElement = screenVideoRef.current;
    if (!videoElement || !stream) return;
    if (videoElement.srcObject !== stream) videoElement.srcObject = stream;
    void videoElement.play().catch(() => {
      setNotice("画面已经到达，点击播放器开始播放声音。");
    });
  }, [localScreenStream, remoteScreenStream, snapshot?.screenShare?.shareId]);

  useEffect(() => {
    const onExtension = (event: MessageEvent) => {
      if (event.data?.source !== "tongkan-extension") return;
      if (event.data.type === "PONG") {
        setExtensionState("installed");
        window.postMessage({ source: "tongkan-web", type: "BIND_ROOM", roomId }, "*");
      }
      if (event.data.type === "LOCAL_PLAYBACK" && event.data.roomId === roomId) {
        const local = event.data.event as {
          kind?: "play" | "pause" | "seek" | "rate" | "media-change";
          positionSeconds?: number;
          playbackRate?: number;
          media?: BiliMediaIdentity;
        };
        if (!local.kind) return;
        clientRef.current?.sendCommand({
          kind: local.kind,
          ...(typeof local.positionSeconds === "number" ? { positionSeconds: local.positionSeconds } : {}),
          ...(typeof local.playbackRate === "number" ? { playbackRate: local.playbackRate } : {}),
          ...(local.media ? { media: local.media } : {}),
        });
      }
      if (event.data.type === "LOCAL_REPORT" && event.data.roomId === roomId) {
        clientRef.current?.sendReport(event.data.report as ClientPlaybackReport);
      }
    };
    window.addEventListener("message", onExtension);
    window.postMessage({ source: "tongkan-web", type: "PING_EXTENSION" }, "*");
    const timer = window.setTimeout(() => setExtensionState((value) => value === "checking" ? "missing" : value), 900);
    return () => {
      window.postMessage({ source: "tongkan-web", type: "UNBIND_ROOM", roomId }, "*");
      window.removeEventListener("message", onExtension);
      window.clearTimeout(timer);
    };
  }, [roomId]);

  useEffect(() => {
    const client = new RoomClient({
      roomId,
      key: identity.key,
      nickname: identity.nickname,
      capabilities: { ...defaultCapabilities, canControlBilibili: extensionState === "installed" },
      onConnectionChange: setConnection,
      onEvent: (event: ServerEvent) => {
        if (event.type === "auth.ok") {
          setSelf(event.member);
          selfIdRef.current = event.member.id;
          screenShareRef.current = event.snapshot.screenShare;
          setSnapshot(event.snapshot);
          setSeekPosition(event.snapshot.playback.positionSeconds);
          setNotice("房间已连接");
          sendAnchorToExtension(roomId, event.snapshot.playback, client.serverNow());
          if (event.snapshot.screenShare && event.snapshot.screenShare.sharerMemberId !== event.member.id) {
            activeShareIdRef.current = event.snapshot.screenShare.shareId;
            ensureScreenPeer().prepareViewer(event.snapshot.screenShare.shareId);
            setScreenUiState("connecting");
            client.sendScreenWatchReady(event.snapshot.screenShare.shareId);
          }
          const storedMedia = sessionStorage.getItem(`tongkan:${roomId}:media`);
          if (storedMedia && event.snapshot.playback.media === null) {
            client.sendCommand({ kind: "media-change", media: JSON.parse(storedMedia) as MediaIdentity });
          }
        }
        if (event.type === "room.snapshot") {
          screenShareRef.current = event.snapshot.screenShare;
          setSnapshot(event.snapshot);
          sendAnchorToExtension(roomId, event.snapshot.playback, client.serverNow());
          if (event.snapshot.playback.media?.type === "direct") applyDirectPlayback(event.snapshot.playback, client.serverNow());
        }
        if (event.type === "member.updated") {
          setSnapshot((current) => current ? {
            ...current,
            members: { ...current.members, [event.member.role]: event.member },
          } : current);
          setNotice(event.member.connected ? `${event.member.nickname} 已加入` : `${event.member.nickname} 已离开`);
        }
        if (event.type === "playback.anchor") {
          setSnapshot((current) => current ? { ...current, playback: event.anchor } : current);
          setSeekPosition(event.anchor.positionSeconds);
          sendAnchorToExtension(roomId, event.anchor, client.serverNow());
          if (event.anchor.media?.type === "direct") applyDirectPlayback(event.anchor, client.serverNow());
          if (event.anchor.actorId !== selfIdRef.current) setNotice(`${event.actorNickname} 更新了播放状态`);
        }
        if (event.type === "chat.message") {
          setChat((items) => [...items, { id: event.messageId, nickname: event.nickname, text: event.text, own: event.memberId === selfIdRef.current }]);
        }
        if (event.type === "screen.started") {
          screenShareRef.current = event.share;
          activeShareIdRef.current = event.share.shareId;
          setSnapshot((current) => current ? { ...current, mode: "screen-share", screenShare: event.share } : current);
          setNotice(`${event.share.sharerNickname} 开始共享屏幕`);
          setScreenError("");
          if (event.share.sharerMemberId === selfIdRef.current) {
            // Wait until the viewer confirms that its peer is ready. Starting
            // here as well would create two offers for the same share and can
            // make the negotiation race with itself on slower connections.
            setScreenUiState("connecting");
          } else {
            ensureScreenPeer().prepareViewer(event.share.shareId);
            setScreenUiState("connecting");
            client.sendScreenWatchReady(event.share.shareId);
          }
        }
        if (event.type === "screen.watch.ready") {
          const stream = localScreenStreamRef.current;
          if (stream && activeShareIdRef.current === event.shareId) {
            setScreenUiState("connecting");
            void ensureScreenPeer().startBroadcast(stream, event.shareId);
          }
        }
        if (event.type === "rtc.signal") {
          void ensureScreenPeer().handleSignal(event.shareId, event.signal);
        }
        if (event.type === "screen.stopped") {
          screenShareRef.current = null;
          activeShareIdRef.current = null;
          screenPeerRef.current?.close(true);
          localScreenStreamRef.current = null;
          setLocalScreenStream(null);
          setRemoteScreenStream(null);
          setScreenUiState("idle");
          setScreenError("");
          setSnapshot((current) => current ? { ...current, mode: event.nextMode, screenShare: null } : current);
          setNotice(event.reason === "disconnect" ? "共享者已离开，屏幕共享结束" : "屏幕共享已结束");
        }
        if (event.type === "error") {
          setNotice(event.message);
          if (event.code === "SCREEN_BUSY" || event.code === "INVALID_SCREEN_SHARE") {
            activeShareIdRef.current = null;
            screenPeerRef.current?.close(true);
            localScreenStreamRef.current = null;
            setLocalScreenStream(null);
            setScreenUiState("error");
            setScreenError(event.message);
          }
        }
      },
    });
    clientRef.current = client;
    client.connect();
    return () => client.close();
  }, [identity.key, identity.nickname, roomId]);

  const playback = snapshot?.playback;
  const partner = snapshot && self ? snapshotPartner(snapshot, self.id) : "等待对方";
  const inviteKey = identity.role === "host" ? sessionStorage.getItem(`tongkan:${roomId}:invite`) : null;
  const biliMedia = playback?.media?.type === "bilibili" ? playback.media : null;
  const directMedia = playback?.media?.type === "direct" ? playback.media : null;
  const activeMedia = playback?.media ?? null;
  const screenShare = snapshot?.screenShare ?? null;
  const sharingSelf = Boolean(screenShare && screenShare.sharerMemberId === self?.id);
  const watchingOther = Boolean(screenShare && screenShare.sharerMemberId !== self?.id);
  const showingScreenStage = Boolean(screenShare || screenUiState !== "idle");
  const screenStatusLabel = screenUiState === "requesting"
    ? "等待选择共享内容"
    : screenUiState === "connecting"
      ? "正在建立 P2P 连接"
      : screenUiState === "sharing"
        ? "正在向对方共享"
        : screenUiState === "watching"
          ? "正在观看对方屏幕"
          : screenUiState === "stopping"
            ? "正在停止共享"
            : screenUiState === "error"
              ? "共享连接失败"
              : "屏幕共享未启动";
  const screenPeerShortLabel = screenPeerState === "connected"
    ? "已直连"
    : screenPeerState === "failed"
      ? "连接失败"
      : screenPeerState === "closed" || screenPeerState === "idle"
        ? "等待连接"
        : "直连中";

  useEffect(() => {
    if (!playback || playback.media?.type !== "direct") return;
    applyDirectPlayback(playback, clientRef.current?.serverNow() ?? Date.now());
  }, [playback?.sequence, directMedia?.url]);

  function applyDirectPlayback(anchor: RoomSnapshot["playback"], serverNowMs: number) {
    const video = directVideoRef.current;
    if (!video || anchor.media?.type !== "direct") return;
    void applyDirectAnchorToVideo(video, anchor, serverNowMs)
      .then(() => {
        directSeekPositionRef.current = video.currentTime;
        setDirectPosition(video.currentTime);
        if (Number.isFinite(video.duration)) setDirectDuration(video.duration);
      })
      .catch(() => {
        setDirectError("浏览器阻止了自动播放，请先点击一次播放器中的播放按钮。");
      });
  }

  function sendPlayback(kind: "play" | "pause" | "seek", requestedPosition?: number) {
    const positionSeconds = kind === "seek"
      ? requestedPosition ?? seekPosition
      : playback
        ? positionAt(playback, clientRef.current?.serverNow() ?? Date.now())
        : 0;
    clientRef.current?.sendCommand({ kind, positionSeconds });
  }

  function loadMedia(event: React.FormEvent) {
    event.preventDefault();
    const nextMedia = parseMediaInput(mediaUrlInput);
    if (!nextMedia) {
      setMediaInputError("没有识别到可播放链接。请粘贴 B站视频页或 HTTP/HTTPS 视频直链。");
      return;
    }
    setMediaInputError("");
    setDirectError("");
    clientRef.current?.sendCommand({ kind: "media-change", media: nextMedia, positionSeconds: 0 });
    setMediaUrlInput("");
    setNotice(nextMedia.type === "direct" ? "正在为双方载入直链视频" : "正在为双方切换 B站视频");
  }

  function toggleDirectPlayback() {
    sendPlayback(playback?.paused ? "play" : "pause", directPosition);
  }

  function handleDirectPlayerTap() {
    const now = performance.now();
    if (now - lastDirectTapAtRef.current <= 360) {
      lastDirectTapAtRef.current = 0;
      toggleDirectPlayback();
      return;
    }
    lastDirectTapAtRef.current = now;
  }

  function commitDirectSeek(positionSeconds = directSeekPositionRef.current) {
    directSeekingRef.current = false;
    directSeekPositionRef.current = positionSeconds;
    setDirectPosition(positionSeconds);
    sendPlayback("seek", positionSeconds);
    setNotice(`已将进度调整到 ${formatTime(positionSeconds)}`);
  }

  function previewDirectSeek(positionSeconds: number) {
    directSeekingRef.current = true;
    directSeekPositionRef.current = positionSeconds;
    setDirectPosition(positionSeconds);
  }

  async function openDirectFullscreen() {
    if (!directVideoRef.current?.requestFullscreen) return;
    try {
      await directVideoRef.current.requestFullscreen();
    } catch {
      setNotice("浏览器没有进入全屏，请稍后重试。");
    }
  }

  async function startScreenShare() {
    if (connection !== "connected") {
      setNotice("房间连接成功后才能共享屏幕。");
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenUiState("error");
      setScreenError("当前浏览器不支持屏幕共享，请使用桌面版 Chrome 或 Edge。");
      return;
    }
    setScreenUiState("requesting");
    setScreenError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error("没有捕获到屏幕画面");
      }
      const shareId = crypto.randomUUID();
      activeShareIdRef.current = shareId;
      localScreenStreamRef.current = stream;
      setLocalScreenStream(stream);
      videoTrack.addEventListener("ended", () => {
        if (activeShareIdRef.current === shareId) stopScreenShare("track-ended");
      }, { once: true });
      clientRef.current?.sendScreenStart(shareId, stream.getAudioTracks().length > 0);
      setScreenUiState("connecting");
      setNotice(stream.getAudioTracks().length > 0 ? "已捕获画面和共享声音，正在连接对方。" : "已捕获画面；当前来源没有共享声音。");
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "NotAllowedError";
      const message = cancelled
        ? "你取消了屏幕选择，没有开始共享。"
        : `没有开始屏幕共享。${error instanceof Error ? error.message : "请重新选择标签页、窗口或屏幕。"}`;
      setScreenUiState(cancelled ? "idle" : "error");
      setScreenError(cancelled ? "" : message);
      setNotice(message);
    }
  }

  function stopScreenShare(reason: "user" | "track-ended" | "error" = "user") {
    const shareId = activeShareIdRef.current;
    if (!shareId || stoppingShareRef.current) return;
    stoppingShareRef.current = true;
    activeShareIdRef.current = null;
    setScreenUiState("stopping");
    clientRef.current?.sendScreenStop(shareId, reason);
    screenPeerRef.current?.close(true);
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    window.setTimeout(() => { stoppingShareRef.current = false; }, 0);
  }

  async function openScreenFullscreen() {
    if (!screenVideoRef.current?.requestFullscreen) return;
    try {
      await screenVideoRef.current.requestFullscreen();
    } catch {
      setNotice("浏览器没有进入全屏，请在播放器控制栏中重试。");
    }
  }

  async function copyInvite() {
    if (!inviteKey) return;
    await navigator.clipboard.writeText(inviteUrl(roomId, inviteKey));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_500);
  }

  function sendChat(event: React.FormEvent) {
    event.preventDefault();
    if (!chatText.trim()) return;
    clientRef.current?.sendChat(chatText);
    setChatText("");
  }

  return (
    <>
      <Nav status={connection === "connected" ? "房间已连接" : connection === "connecting" ? "连接中" : "连接断开"} />
      <main className="room-shell">
        <header className="room-heading">
          <div>
            <p className="room-heading__status"><span className={`status-dot ${connection === "connected" ? "status-dot--ready" : ""}`} />{notice}</p>
            <h1>{screenShare
              ? `${screenShare.sharerNickname} 的屏幕`
              : directMedia
                ? directMedia.title ?? "直链视频"
                : biliMedia
                  ? biliMedia.bvid
                  : "准备观看视频"}</h1>
          </div>
          <div className="room-heading__people">
            <span>{identity.nickname}</span><span className="room-heading__divider">与</span><span>{partner}</span>
          </div>
        </header>

        <div className="room-grid">
          <section className="media-workbench">
            <div className="media-workbench__bar">
              <span>{showingScreenStage ? <MonitorUp size={17} /> : <Video size={17} />}{showingScreenStage ? "屏幕共享" : directMedia ? "直链同步" : "B站同步"}</span>
              <span className="mono">{showingScreenStage ? screenPeerShortLabel : `序号 ${playback?.sequence ?? 0}`}</span>
            </div>
            {showingScreenStage ? (
              <div className="screen-share-stage" data-state={screenUiState}>
                {(localScreenStream || remoteScreenStream) && (
                  <video
                    ref={screenVideoRef}
                    className="screen-share-stage__video"
                    autoPlay
                    playsInline
                    disablePictureInPicture
                    muted={sharingSelf || Boolean(localScreenStream && !screenShare)}
                    aria-label={sharingSelf ? "你的共享屏幕预览" : "对方共享的屏幕"}
                  />
                )}
                {!localScreenStream && !remoteScreenStream && (
                  <div className="screen-share-stage__empty">
                    {screenUiState === "requesting" || screenUiState === "connecting" ? <span className="spinner" aria-hidden="true" /> : <MonitorUp size={30} aria-hidden="true" />}
                    <h2>{screenStatusLabel}</h2>
                    <p>{screenError || (watchingOther ? "共享者保持当前页面打开后，画面会自动出现。" : "选择标签页时勾选“共享标签页音频”，对方才能听到声音。")}</p>
                  </div>
                )}
                <div className="screen-share-stage__status" aria-live="polite">
                  <span><span className={`status-dot ${screenPeerState === "connected" ? "status-dot--ready" : ""}`} />{screenStatusLabel}</span>
                  {screenShare?.hasAudio && <span><Volume2 size={15} />包含共享声音</span>}
                </div>
              </div>
            ) : directMedia ? (
              <div
                className="direct-video-stage"
                data-anchor-position={playback?.positionSeconds ?? 0}
                data-sequence={playback?.sequence ?? 0}
                onPointerUp={handleDirectPlayerTap}
              >
                <video
                  ref={directVideoRef}
                  className="direct-video-stage__video"
                  src={directMedia.url}
                  preload="metadata"
                  playsInline
                  disablePictureInPicture
                  onLoadedMetadata={(event) => {
                    setDirectDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                    setDirectPosition(event.currentTarget.currentTime);
                    if (playback?.media?.type === "direct") applyDirectPlayback(playback, clientRef.current?.serverNow() ?? Date.now());
                  }}
                  onTimeUpdate={(event) => {
                    if (directSeekingRef.current) return;
                    directSeekPositionRef.current = event.currentTarget.currentTime;
                    setDirectPosition(event.currentTarget.currentTime);
                  }}
                  onDurationChange={(event) => setDirectDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
                  onError={() => setDirectError("视频载入失败。地址可能过期、存在防盗链，或编码不受浏览器支持。")}
                  aria-label={directMedia.title ?? "同步直链视频"}
                />
                <div className="direct-video-stage__hint" aria-hidden="true">双击画面{playback?.paused ? "播放" : "暂停"}</div>
                {directError && <div className="direct-video-stage__error" role="alert">{directError}</div>}
                <div className="direct-video-controls" onPointerUp={(event) => event.stopPropagation()}>
                  <button className="round-control" type="button" onClick={toggleDirectPlayback} aria-label={playback?.paused ? "播放" : "暂停"}>
                    {playback?.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
                  </button>
                  <label className="timeline-control">
                    <span className="sr-only">直链视频播放进度</span>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(1, directDuration)}
                      step="0.1"
                      value={Math.min(directPosition, Math.max(1, directDuration))}
                      onPointerDown={() => { directSeekingRef.current = true; }}
                      onInput={(event) => previewDirectSeek(Number(event.currentTarget.value))}
                      onChange={(event) => previewDirectSeek(Number(event.currentTarget.value))}
                      onPointerUp={(event) => commitDirectSeek(Number(event.currentTarget.value))}
                      onKeyUp={(event) => {
                        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                          commitDirectSeek(Number(event.currentTarget.value));
                        }
                      }}
                    />
                  </label>
                  <span className="mono direct-video-controls__time">{formatTime(directPosition)} / {formatTime(directDuration)}</span>
                  <button className="button button--quiet" type="button" onClick={openDirectFullscreen}><Maximize2 size={17} />全屏</button>
                </div>
              </div>
            ) : (
              <div className="media-workbench__stage">
                <div className="media-mark" aria-hidden="true"><span>同</span><span>一</span><span>秒</span></div>
                <div className="media-workbench__copy">
                  <h2>{biliMedia ? "视频已经绑定" : "先载入一个视频链接"}</h2>
                  <p>{biliMedia ? `双方应打开 ${biliMedia.bvid} 的第 ${biliMedia.page} P。扩展会读取本地播放器并应用房间命令。` : "可载入 B站视频页，也可以直接载入 MP4/WebM 等视频地址。"}</p>
                  {biliMedia && <a className="button button--quiet" href={biliMedia.canonicalUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} />打开 B站</a>}
                </div>
              </div>
            )}
            {showingScreenStage ? (
              <div className="screen-share-controls">
                <span>{screenError || (sharingSelf
                  ? "这是共享预览；下方按钮控制双方的 B站播放器。"
                  : "这是实时共享画面；下方按钮控制双方的 B站播放器。")}</span>
                <div>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => sendPlayback(playback?.paused ? "play" : "pause")}
                    disabled={!activeMedia || connection !== "connected"}
                  >
                    {playback?.paused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}
                    {playback?.paused ? "播放视频" : "暂停视频"}
                  </button>
                  <button className="button button--quiet" type="button" onClick={openScreenFullscreen} disabled={!localScreenStream && !remoteScreenStream}><Maximize2 size={17} />全屏</button>
                  {sharingSelf && <button className="button button--quiet" type="button" onClick={() => stopScreenShare("user")} data-state={screenUiState === "stopping" ? "loading" : "default"}><MonitorUp size={17} />停止共享</button>}
                </div>
              </div>
            ) : directMedia ? null : (
              <div className="player-controls">
                <button className="round-control" type="button" onClick={() => sendPlayback(playback?.paused ? "play" : "pause")} aria-label={playback?.paused ? "播放" : "暂停"}>
                  {playback?.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
                </button>
                <label className="timeline-control">
                  <span className="sr-only">播放进度</span>
                  <input
                    type="range"
                    min="0"
                    max="7200"
                    step="1"
                    value={seekPosition}
                    onChange={(event) => setSeekPosition(Number(event.target.value))}
                    onPointerUp={() => sendPlayback("seek")}
                    onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) sendPlayback("seek"); }}
                  />
                </label>
                <span className="mono">{formatTime(seekPosition)}</span>
              </div>
            )}
          </section>

          <aside className="session-panel">
            <div className="session-block">
              <div className="session-block__heading"><h2>连接状态</h2><Radio size={18} /></div>
              <dl className="status-list">
                <div><dt>浏览器扩展</dt><dd data-tone={extensionState === "installed" ? "success" : "warning"}>{extensionState === "installed" ? "已连接" : extensionState === "checking" ? "检测中" : "未检测到"}</dd></div>
                <div><dt>对方</dt><dd>{partner}</dd></div>
                <div><dt>控制权</dt><dd>双方均可</dd></div>
                <div><dt>当前模式</dt><dd>{screenShare ? "屏幕共享" : directMedia ? "直链视频" : "B站同步"}</dd></div>
                {showingScreenStage && <div><dt>P2P</dt><dd data-tone={screenPeerState === "connected" ? "success" : screenPeerState === "failed" ? "warning" : undefined}>{screenPeerState === "connected" ? "已直连" : screenPeerState === "failed" ? "连接失败" : "连接中"}</dd></div>}
              </dl>
            </div>

            <div className="session-block">
              <div className="session-block__heading"><h2>载入视频</h2><Video size={18} /></div>
              <form className="media-link-form" onSubmit={loadMedia}>
                <label className="sr-only" htmlFor="room-media-url">B站页面或视频直链</label>
                <input
                  id="room-media-url"
                  value={mediaUrlInput}
                  onChange={(event) => setMediaUrlInput(event.target.value)}
                  placeholder="B站链接或 https://…/video.mp4"
                />
                <button className="button button--quiet" type="submit" disabled={!mediaUrlInput.trim() || connection !== "connected"}><Link2 size={17} />同步载入</button>
              </form>
              {mediaInputError
                ? <p className="form-error" role="alert">{mediaInputError}</p>
                : <p>双方都可以更换视频。直链必须允许浏览器直接访问。</p>}
            </div>

            {identity.role === "host" && (
              <div className="session-block">
                <div className="session-block__heading"><h2>邀请</h2><Link2 size={18} /></div>
                <p>邀请链接只允许一名朋友进入。</p>
                <button className="button button--quiet copy-button" type="button" onClick={copyInvite} disabled={!inviteKey} data-state={copied ? "success" : "default"}>
                  {copied ? <Clipboard size={17} /> : <Link2 size={17} />}{copied ? "已复制" : "复制链接"}
                </button>
              </div>
            )}

            <div className="session-block session-block--chat">
              <div className="session-block__heading"><h2>聊天</h2><MessageCircle size={18} /></div>
              <div className="chat-log" aria-live="polite">
                {chat.length === 0 ? <p className="chat-empty">还没有消息。观看时说的话不会被保存。</p> : chat.map((item) => (
                  <p className={item.own ? "chat-item chat-item--own" : "chat-item"} key={item.id}><span>{item.nickname}</span>{item.text}</p>
                ))}
              </div>
              <form className="chat-form" onSubmit={sendChat}>
                <label className="sr-only" htmlFor="chat-input">发送消息</label>
                <input id="chat-input" value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="说点什么" maxLength={500} />
                <button type="submit" aria-label="发送消息"><Send size={17} /></button>
              </form>
            </div>
          </aside>
        </div>

        <section className="room-actions">
          <button className="action-line" type="button"><Mic size={18} /><span>语音连接</span><strong>下一阶段</strong></button>
          <button
            className="action-line"
            type="button"
            onClick={sharingSelf ? () => stopScreenShare("user") : startScreenShare}
            disabled={watchingOther || screenUiState === "requesting" || screenUiState === "connecting" || screenUiState === "stopping" || !defaultCapabilities.canShareScreen}
            data-state={screenUiState === "error" ? "error" : sharingSelf ? "success" : screenUiState === "requesting" || screenUiState === "connecting" || screenUiState === "stopping" ? "loading" : "default"}
          >
            <MonitorUp size={18} />
            <span>{sharingSelf ? "停止屏幕共享" : watchingOther ? `${screenShare?.sharerNickname ?? "对方"} 正在共享` : "共享屏幕"}</span>
            <strong>{sharingSelf ? "正在共享" : watchingOther ? "观看中" : defaultCapabilities.canShareScreen ? "现在可用" : "浏览器不支持"}</strong>
          </button>
          <button className="action-line" type="button" onClick={() => window.location.reload()}><RotateCcw size={18} /><span>重新连接</span><strong>现在可用</strong></button>
        </section>
      </main>
      <Footer />
    </>
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return [hours, minutes, remaining].map((value) => value.toString().padStart(2, "0")).join(":");
}

function parseMediaInput(input: string): MediaIdentity | null {
  return parseBilibiliUrl(input) ?? parseDirectVideoUrl(input);
}

function sendAnchorToExtension(roomId: string, anchor: RoomSnapshot["playback"], serverNowMs: number): void {
  if (anchor.media?.type !== "bilibili") return;
  window.postMessage({
    source: "tongkan-web",
    type: "APPLY_ANCHOR",
    roomId,
    anchor,
    serverNowMs,
  }, "*");
}

export function App() {
  if (window.location.pathname === "/self-test" || window.location.pathname === "/self-test/") {
    return <SelfTestPage nav={<Nav status="双端自测" />} footer={<Footer />} />;
  }
  const roomId = getRoomIdFromPath();
  return roomId ? <RoomPage roomId={roomId} /> : <HomePage />;
}
