import type { BiliMediaIdentity } from "./types";

const BV_RE = /BV[0-9A-Za-z]{10}/i;
const AV_RE = /(?:av|video\/av)(\d+)/i;

export function parseBilibiliUrl(input: string): BiliMediaIdentity | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("bilibili.com") && host !== "b23.tv") {
    return null;
  }

  const bvidMatch = url.pathname.match(BV_RE) ?? input.match(BV_RE);
  const avMatch = url.pathname.match(AV_RE);
  if (!bvidMatch && !avMatch) {
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
