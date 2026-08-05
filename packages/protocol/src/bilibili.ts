import type { BiliMediaIdentity } from "./types";

const BV_RE = /BV[0-9A-Za-z]{10}/i;
const AV_RE = /(?:av|video\/av)(\d+)/i;
const AV_ID_RE = /^av([1-9]\d*)$/;
const URL_IN_TEXT_RE = /(?:https?:\/\/)?[0-9A-Za-z.-]+(?::\d+)?\/[^\s<>"'，。！？；：、）》」』】]+/i;
const TRAILING_SHARE_PUNCTUATION_RE = /[，。！？；：、）》」』】]+$/u;

export function parseBilibiliUrl(input: string): BiliMediaIdentity | null {
  const matchedUrl = input.trim().match(URL_IN_TEXT_RE)?.[0];
  if (!matchedUrl) return null;
  const candidate = matchedUrl
    .replace(TRAILING_SHARE_PUNCTUATION_RE, "")
    .replace(/^https?:\/\//i, "");
  let url: URL;
  try {
    url = new URL(`https://${candidate}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "bilibili.com" && !host.endsWith(".bilibili.com") && host !== "b23.tv") {
    return null;
  }

  const bvidMatch = url.pathname.match(BV_RE) ?? matchedUrl.match(BV_RE);
  const avMatch = url.pathname.match(AV_RE);
  if (!bvidMatch && !avMatch) {
    if (host === "b23.tv" && url.pathname.split("/").some(Boolean)) {
      const shortCode = url.pathname.split("/").filter(Boolean)[0] ?? "share";
      return {
        type: "bilibili",
        bvid: `b23:${shortCode}`,
        page: 1,
        title: "B站分享视频",
        canonicalUrl: url.toString(),
        unresolved: true,
      };
    }
    return null;
  }

  const pageValue = Number.parseInt(url.searchParams.get("p") ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;

  if (bvidMatch) {
    const token = bvidMatch[0];
    const bvid = `BV${token.slice(2)}`;
    return {
      type: "bilibili",
      bvid,
      page,
      canonicalUrl: `https://www.bilibili.com/video/${bvid}/?p=${page}`,
    };
  }

  const aid = Number.parseInt(avMatch?.[1] ?? "", 10);
  if (!Number.isFinite(aid)) {
    return null;
  }

  return {
    type: "bilibili",
    bvid: `av${aid}`,
    aid,
    page,
    canonicalUrl: `https://www.bilibili.com/video/av${aid}/?p=${page}`,
  };
}

export function isSameMedia(
  left: BiliMediaIdentity | null,
  right: BiliMediaIdentity | null,
): boolean {
  if (!left || !right) return left === right;
  return left.bvid === right.bvid && left.page === right.page;
}

export function bilibiliEmbedUrl(media: BiliMediaIdentity): string | null {
  if (media.unresolved) return null;
  const parameters = new URLSearchParams({
    page: String(Math.max(1, media.page || 1)),
    high_quality: "1",
    danmaku: "0",
    autoplay: "0",
    as_wide: "1",
  });
  if (/^BV[0-9A-Za-z]{10}$/.test(media.bvid)) {
    parameters.set("bvid", media.bvid);
  } else {
    const avidMatch = media.bvid.match(AV_ID_RE);
    const avidDigits = avidMatch?.[1];
    if (!avidDigits) return null;
    const aid = Number.parseInt(avidDigits, 10);
    if (!Number.isSafeInteger(aid) || aid <= 0) return null;
    if (media.aid !== undefined && media.aid !== aid) return null;
    parameters.set("aid", String(aid));
  }
  return `https://player.bilibili.com/player.html?${parameters.toString()}`;
}
