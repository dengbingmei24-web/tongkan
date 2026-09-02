import type { WebpageMediaIdentity } from "./types";

export const ZIP0_SITE = "zip0" as const;
export const ZIP0_CANONICAL_HOST = "zip0.com";
export const ZIP0_WATCH_PATH = "/watch";

const ZIP0_QUERY_KEYS = ["source", "id", "episode"] as const;
const ZIP0_TOKEN_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ZIP0_EPISODE_RE = /^\d{1,10}$/;

export interface Zip0WatchParts {
  source: string;
  id: string;
  episode: number;
}

export function parseZip0WatchUrl(input: string): WebpageMediaIdentity | null {
  const parts = parseZip0WatchUrlParts(input);
  if (!parts) return null;

  return {
    type: "webpage",
    site: ZIP0_SITE,
    url: buildCanonicalZip0WatchUrl(parts),
    contentKey: buildZip0ContentKey(parts),
  };
}

export function normalizeZip0WatchUrl(input: string): string | null {
  return parseZip0WatchUrl(input)?.url ?? null;
}

export function normalizeZip0MediaIdentity(value: unknown): WebpageMediaIdentity | null {
  if (!isRecord(value)
    || value.type !== "webpage"
    || value.site !== ZIP0_SITE
    || !hasOnlyKeys(value, ["type", "site", "url", "contentKey", "title"])) {
    return null;
  }
  if (typeof value.url !== "string" || typeof value.contentKey !== "string") return null;
  if (value.title !== undefined && (typeof value.title !== "string" || value.title.length > 200)) return null;

  const parsed = parseZip0WatchUrlParts(value.url);
  if (!parsed || value.contentKey !== buildZip0ContentKey(parsed)) return null;

  const media: WebpageMediaIdentity = {
    type: "webpage",
    site: ZIP0_SITE,
    url: buildCanonicalZip0WatchUrl(parsed),
    contentKey: buildZip0ContentKey(parsed),
  };
  if (value.title !== undefined) media.title = value.title;
  return media;
}

export function isZip0WatchUrl(input: string): boolean {
  return normalizeZip0WatchUrl(input) !== null;
}

function parseZip0WatchUrlParts(input: string): Zip0WatchParts | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 2_048) return null;

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.hash
    || !isZip0Host(url.hostname)
    || !isZip0WatchPath(url.pathname)) {
    return null;
  }

  const keys = [...url.searchParams.keys()];
  if (keys.length !== ZIP0_QUERY_KEYS.length
    || keys.some((key) => !isAllowedQueryKey(key))
    || new Set(keys).size !== keys.length
    || keys.some(isSensitiveQueryKey)) {
    return null;
  }

  const source = url.searchParams.get("source");
  const id = url.searchParams.get("id");
  const episodeValue = url.searchParams.get("episode");
  if (!source || !id || !episodeValue || !ZIP0_TOKEN_RE.test(source) || !ZIP0_TOKEN_RE.test(id)) return null;
  if (!ZIP0_EPISODE_RE.test(episodeValue)) return null;

  const episode = Number.parseInt(episodeValue, 10);
  if (!Number.isSafeInteger(episode) || episode <= 0) return null;

  return { source: source.toLowerCase(), id, episode };
}

function buildCanonicalZip0WatchUrl(parts: Zip0WatchParts): string {
  const query = new URLSearchParams();
  query.set("source", parts.source);
  query.set("id", parts.id);
  query.set("episode", String(parts.episode));
  return `https://${ZIP0_CANONICAL_HOST}${ZIP0_WATCH_PATH}?${query.toString()}`;
}

function buildZip0ContentKey(parts: Zip0WatchParts): string {
  return `${ZIP0_SITE}:${parts.source}:${parts.id}:${parts.episode}`;
}

function isZip0Host(hostname: string): boolean {
  return hostname.toLowerCase() === ZIP0_CANONICAL_HOST || hostname.toLowerCase() === `www.${ZIP0_CANONICAL_HOST}`;
}

function isZip0WatchPath(pathname: string): boolean {
  return pathname === ZIP0_WATCH_PATH || pathname === `${ZIP0_WATCH_PATH}/`;
}

function isAllowedQueryKey(key: string): boolean {
  return (ZIP0_QUERY_KEYS as readonly string[]).includes(key);
}

function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (["auth", "key", "sig", "jwt"].includes(normalized)) return true;
  return [
    "token",
    "signature",
    "credential",
    "password",
    "secret",
    "authorization",
    "apikey",
    "accesskey",
    "authkey",
    "keypairid",
    "sessionid",
    "cookie",
    "policy",
    "stream",
    "sourceurl",
    "mediaurl",
    "videourl",
    "file",
  ].some((value) => normalized.includes(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}
