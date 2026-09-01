import type { MediaIdentity, SignalingClientMessage } from "@tongkan/protocol";

export const MAX_CLIENT_MESSAGE_BYTES = 64 * 1_024;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 500;
export const MAX_SDP_LENGTH = 32 * 1_024;
export const MAX_ICE_CANDIDATE_LENGTH = 4 * 1_024;
export const MAX_HISTORY_GRANT_LENGTH = 4_096;
export const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

type ValidationResult =
  | { ok: true; message: SignalingClientMessage }
  | { ok: false; reason: "MESSAGE_TOO_LARGE" | "INVALID_MESSAGE" };

type JsonObject = Record<string, unknown>;

export function parseClientMessage(raw: string | ArrayBuffer): ValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: raw.byteLength > MAX_CLIENT_MESSAGE_BYTES ? "MESSAGE_TOO_LARGE" : "INVALID_MESSAGE" };
  }
  if (raw.length > MAX_CLIENT_MESSAGE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_CLIENT_MESSAGE_BYTES) {
    return { ok: false, reason: "MESSAGE_TOO_LARGE" };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "INVALID_MESSAGE" };
  }
  return isClientMessage(value)
    ? { ok: true, message: value as SignalingClientMessage }
    : { ok: false, reason: "INVALID_MESSAGE" };
}

function isClientMessage(value: unknown): boolean {
  if (!isObject(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "auth":
      return isAuthMessage(value);
    case "playback.command":
      return isPlaybackCommand(value);
    case "playback.report":
      return isPlaybackReport(value);
    case "history.bind":
      return hasExactKeys(value, ["type", "grant"])
        && isString(value.grant, MAX_HISTORY_GRANT_LENGTH, 20);
    case "chat.message":
      return isChatMessage(value);
    case "ping":
      return hasExactKeys(value, ["type", "clientSentAtMs"])
        && isTimestamp(value.clientSentAtMs);
    case "screen.start":
      return hasExactKeys(value, ["type", "shareId", "hasAudio", "clientSentAtMs"])
        && isIdentifier(value.shareId)
        && typeof value.hasAudio === "boolean"
        && isTimestamp(value.clientSentAtMs);
    case "screen.stop":
      return hasExactKeys(value, ["type", "shareId", "reason"])
        && isIdentifier(value.shareId)
        && ["user", "track-ended", "error"].includes(String(value.reason));
    case "screen.watch.ready":
      return hasExactKeys(value, ["type", "shareId"])
        && isIdentifier(value.shareId);
    case "rtc.signal":
      return hasExactKeys(value, ["type", "shareId", "signal"])
        && isIdentifier(value.shareId)
        && isRtcSignal(value.signal);
    default:
      return false;
  }
}

function isAuthMessage(value: JsonObject): boolean {
  if (!hasExactKeys(value, ["type", "key", "nickname", "capabilities"])) return false;
  if (typeof value.key !== "string" || !/^[a-f0-9]{32}$/.test(value.key)) return false;
  if (!isString(value.nickname, MAX_NICKNAME_LENGTH)) return false;
  const capabilities = value.capabilities;
  return isObject(capabilities)
    && hasExactKeys(capabilities, [
      "platform",
      "canControlBilibili",
      "canShareScreen",
      "canShareSystemAudio",
      "canUseMicrophone",
    ])
    && ["web", "extension", "android"].includes(String(capabilities.platform))
    && typeof capabilities.canControlBilibili === "boolean"
    && typeof capabilities.canShareScreen === "boolean"
    && typeof capabilities.canShareSystemAudio === "boolean"
    && typeof capabilities.canUseMicrophone === "boolean";
}

function isPlaybackCommand(value: JsonObject): boolean {
  if (!hasAllowedKeys(
    value,
    ["type", "commandId", "kind", "clientSentAtMs"],
    ["positionSeconds", "playbackRate", "media"],
  )) return false;
  if (!isIdentifier(value.commandId) || !isTimestamp(value.clientSentAtMs)) return false;
  if (!["play", "pause", "seek", "rate", "media-change"].includes(String(value.kind))) return false;
  if (hasOwn(value, "positionSeconds") && !isFiniteNumber(value.positionSeconds, 0)) return false;
  if (hasOwn(value, "playbackRate") && !isFiniteNumber(value.playbackRate, 0.25, 2)) return false;
  if (hasOwn(value, "media") && !isMediaIdentity(value.media)) return false;
  if (value.kind === "seek" && !isFiniteNumber(value.positionSeconds, 0)) return false;
  if (value.kind === "rate" && !isFiniteNumber(value.playbackRate, 0.25, 2)) return false;
  if (value.kind === "media-change" && !isMediaIdentity(value.media)) return false;
  return true;
}

function isPlaybackReport(value: JsonObject): boolean {
  if (!hasExactKeys(value, ["type", "report"]) || !isObject(value.report)) return false;
  const report = value.report;
  if (!hasAllowedKeys(report, [
    "sequenceApplied",
    "positionSeconds",
    "paused",
    "readyState",
    "buffering",
    "media",
    "sentAtClientMs",
  ], ["ended", "durationSeconds"])) return false;
  const hasEnded = hasOwn(report, "ended");
  const hasDuration = hasOwn(report, "durationSeconds");
  if (hasEnded !== hasDuration) return false;
  return (!hasEnded || (
    typeof report.ended === "boolean"
    && (report.durationSeconds === null || isFiniteNumber(report.durationSeconds, Number.MIN_VALUE, MAX_DURATION_SECONDS))
  ))
    && isInteger(report.sequenceApplied, 0)
    && isFiniteNumber(report.positionSeconds, 0)
    && typeof report.paused === "boolean"
    && isInteger(report.readyState, 0, 4)
    && typeof report.buffering === "boolean"
    && (report.media === null || isMediaIdentity(report.media))
    && isTimestamp(report.sentAtClientMs);
}

function isChatMessage(value: JsonObject): boolean {
  return hasExactKeys(value, ["type", "messageId", "text", "clientSentAtMs"])
    && isIdentifier(value.messageId)
    && isString(value.text, MAX_CHAT_LENGTH, 1)
    && value.text.trim().length > 0
    && isTimestamp(value.clientSentAtMs);
}

function isRtcSignal(value: unknown): boolean {
  if (!isObject(value) || typeof value.kind !== "string") return false;
  if (value.kind === "description") {
    if (!hasExactKeys(value, ["kind", "description"]) || !isObject(value.description)) return false;
    return hasExactKeys(value.description, ["type", "sdp"])
      && ["offer", "answer"].includes(String(value.description.type))
      && isString(value.description.sdp, MAX_SDP_LENGTH, 1);
  }
  if (value.kind === "candidate") {
    if (!hasExactKeys(value, ["kind", "candidate"]) || !isObject(value.candidate)) return false;
    const candidate = value.candidate;
    return hasAllowedKeys(
      candidate,
      ["candidate", "sdpMid", "sdpMLineIndex"],
      ["usernameFragment"],
    )
      && isString(candidate.candidate, MAX_ICE_CANDIDATE_LENGTH, 1)
      && isNullableString(candidate.sdpMid, 256)
      && (candidate.sdpMLineIndex === null || isInteger(candidate.sdpMLineIndex, 0, 65_535))
      && (!hasOwn(candidate, "usernameFragment") || isNullableString(candidate.usernameFragment, 256));
  }
  return false;
}

function isMediaIdentity(value: unknown): value is MediaIdentity {
  if (!isObject(value)) return false;
  if (value.type === "direct") {
    return hasAllowedKeys(value, ["type", "url"], ["title", "mimeType"])
      && isHttpUrl(value.url, 2_048)
      && (!hasOwn(value, "title") || isString(value.title, 200))
      && (!hasOwn(value, "mimeType") || isString(value.mimeType, 128));
  }
  if (value.type !== "bilibili") return false;
  if (!hasAllowedKeys(
    value,
    ["type", "bvid", "page", "canonicalUrl"],
    ["aid", "cid", "title", "unresolved"],
  )) return false;
  if (!isString(value.bvid, 128, 3) || !isInteger(value.page, 1, 10_000)) return false;
  if (!isBilibiliUrl(value.canonicalUrl)) return false;
  if (hasOwn(value, "aid") && !isInteger(value.aid, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (hasOwn(value, "cid") && !isInteger(value.cid, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (hasOwn(value, "title") && !isString(value.title, 200)) return false;
  if (hasOwn(value, "unresolved") && typeof value.unresolved !== "boolean") return false;
  if (/^BV[0-9A-Za-z]{10}$/.test(value.bvid)) return value.unresolved !== true;
  const avidMatch = value.bvid.match(/^av([1-9]\d*)$/);
  if (avidMatch) {
    const avidDigits = avidMatch[1];
    if (!avidDigits) return false;
    const aid = Number.parseInt(avidDigits, 10);
    return Number.isSafeInteger(aid)
      && value.unresolved !== true
      && (!hasOwn(value, "aid") || value.aid === aid);
  }
  return /^b23:[0-9A-Za-z_-]{1,64}$/.test(value.bvid) && value.unresolved === true;
}

function isBilibiliUrl(value: unknown): boolean {
  if (!isString(value, 2_048, 1)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.hash
      && (url.hostname === "b23.tv" || url.hostname === "bilibili.com" || url.hostname.endsWith(".bilibili.com"));
  } catch {
    return false;
  }
}

function isHttpUrl(value: unknown, maximumLength: number): boolean {
  if (!isString(value, maximumLength, 1)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasExactKeys(value: JsonObject, required: readonly string[]): boolean {
  return hasAllowedKeys(value, required, []);
}

function hasAllowedKeys(value: JsonObject, required: readonly string[], optional: readonly string[]): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown, maximumLength: number, minimumLength = 0): value is string {
  return typeof value === "string" && value.length >= minimumLength && value.length <= maximumLength;
}

function isNullableString(value: unknown, maximumLength: number): boolean {
  return value === null || isString(value, maximumLength);
}

function isIdentifier(value: unknown): value is string {
  return isString(value, 128, 1) && value.trim().length > 0;
}

function isFiniteNumber(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return isFiniteNumber(value, minimum, maximum) && Number.isInteger(value);
}

function isTimestamp(value: unknown): value is number {
  return isFiniteNumber(value, 0, Number.MAX_SAFE_INTEGER);
}
