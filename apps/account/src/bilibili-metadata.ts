import { parseBilibiliUrl, type BiliMediaIdentity } from "@tongkan/protocol";
import type { BatchItemErrorCode, LibraryMetadata } from "./library-models";

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_METADATA_BYTES = 512 * 1024;
const TRUSTED_BILIBILI_HOST = /(^|\.)bilibili\.com$/i;

export interface IdentityResolution {
  identity: BiliMediaIdentity | null;
  error: BatchItemErrorCode | null;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class BilibiliMetadataResolver {
  constructor(private readonly fetcher: FetchLike = fetch) {}

  async resolveIdentity(input: string): Promise<IdentityResolution> {
    const parsed = parseBilibiliUrl(input);
    if (!parsed) return { identity: null, error: "INVALID_BILIBILI_URL" };
    if (!parsed.unresolved) return { identity: parsed, error: null };
    try {
      const finalUrl = await this.resolveShortUrl(parsed.canonicalUrl);
      const resolved = parseBilibiliUrl(finalUrl);
      if (!resolved || resolved.unresolved) return { identity: null, error: "B23_RESOLUTION_FAILED" };
      return { identity: resolved, error: null };
    } catch {
      return { identity: null, error: "B23_RESOLUTION_FAILED" };
    }
  }

  async metadataFor(identity: BiliMediaIdentity): Promise<LibraryMetadata> {
    const fallback = this.partialMetadata(identity);
    try {
      const url = new URL("https://api.bilibili.com/x/web-interface/view");
      if (/^BV[0-9A-Za-z]{10}$/.test(identity.bvid)) {
        url.searchParams.set("bvid", identity.bvid);
      } else {
        const aid = identity.bvid.match(/^av([1-9]\d*)$/)?.[1];
        if (!aid) return fallback;
        url.searchParams.set("aid", aid);
      }
      const response = await this.fetchWithTimeout(url, { headers: { accept: "application/json" } });
      if (!response.ok) return fallback;
      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > MAX_METADATA_BYTES) return fallback;
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_METADATA_BYTES) return fallback;
      const payload = JSON.parse(text) as unknown;
      const data = objectField(payload, "data");
      if (numberField(payload, "code") !== 0 || !data) return fallback;
      const pages = Array.isArray(data.pages) ? data.pages.slice(0, 1000) : [];
      const page = objectAt(pages, identity.page - 1);
      const baseTitle = limitedString(data.title, 160);
      const partTitle = limitedString(page?.part, 80);
      const title = limitedString(
        identity.page > 1 && baseTitle && partTitle ? baseTitle + " · " + partTitle : baseTitle ?? partTitle,
        160,
      ) ?? fallback.title;
      const coverUrl = safeHttpsUrl(limitedString(data.pic, 1000));
      const owner = objectField(data, "owner");
      const ownerName = limitedString(owner?.name, 80);
      const cid = nonNegativeInteger(page?.cid ?? data.cid);
      const durationSeconds = nonNegativeInteger(page?.duration ?? data.duration);
      return {
        cid,
        title,
        coverUrl,
        ownerName,
        durationSeconds,
        status: "ready",
      };
    } catch {
      return fallback;
    }
  }

  private partialMetadata(identity: BiliMediaIdentity): LibraryMetadata {
    return {
      cid: null,
      title: identity.page > 1 ? identity.bvid + " · P" + identity.page : identity.bvid,
      coverUrl: null,
      ownerName: null,
      durationSeconds: null,
      status: "partial",
    };
  }

  private async resolveShortUrl(value: string): Promise<string> {
    let current = new URL(value);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      this.assertSafeRedirectUrl(current, redirect === 0);
      const response = await this.fetchWithTimeout(current, { method: "GET", redirect: "manual" });
      if (response.status < 300 || response.status >= 400) return current.toString();
      if (redirect === MAX_REDIRECTS) throw new Error("Too many B23 redirects.");
      const location = response.headers.get("location");
      if (!location || location.length > 2000) throw new Error("Invalid B23 redirect.");
      current = new URL(location, current);
    }
    throw new Error("B23 resolution failed.");
  }

  private assertSafeRedirectUrl(url: URL, initial: boolean): void {
    const host = url.hostname.toLowerCase();
    const trustedHost = host === "b23.tv" || TRUSTED_BILIBILI_HOST.test(host);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !trustedHost) {
      throw new Error("Untrusted B23 redirect.");
    }
    if (initial && host !== "b23.tv") throw new Error("Invalid B23 origin.");
  }

  private fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
    return this.fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }
}

function objectField(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === "object" && !Array.isArray(field) ? field as Record<string, unknown> : null;
}

function numberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

function objectAt(values: unknown[], index: number): Record<string, unknown> | null {
  const value = values[index];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function limitedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.startsWith("//") ? "https:" + value : value.replace(/^http:\/\//i, "https://");
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && !url.username && !url.password && normalized.length <= 1000 ? url.toString() : null;
  } catch {
    return null;
  }
}
