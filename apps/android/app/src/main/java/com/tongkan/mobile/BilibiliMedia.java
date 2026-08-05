package com.tongkan.mobile;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BilibiliMedia {
    private static final Pattern BV_PATTERN = Pattern.compile("BV[0-9A-Za-z]{10}", Pattern.CASE_INSENSITIVE);
    private static final Pattern AV_PATTERN = Pattern.compile("(?:av|video/av)([1-9][0-9]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern AV_ID_PATTERN = Pattern.compile("^av([1-9][0-9]*)$");
    private static final Pattern SHORT_URL_PATTERN = Pattern.compile("(?:https?://)?b23\\.tv/([0-9A-Za-z_-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAGE_PATTERN = Pattern.compile("[?&](?:p|page)=([1-9][0-9]*)", Pattern.CASE_INSENSITIVE);

    public final String bvid;
    public final Long aid;
    public final int page;
    public final String canonicalUrl;
    public final boolean unresolved;

    public BilibiliMedia(String bvid, Long aid, int page, String canonicalUrl, boolean unresolved) {
        this.bvid = bvid;
        this.aid = aid;
        this.page = Math.max(1, page);
        this.canonicalUrl = canonicalUrl;
        this.unresolved = unresolved;
    }

    public static BilibiliMedia parse(String input) {
        if (input == null) return null;
        String trimmed = input.trim();
        if (trimmed.isEmpty()) return null;

        Matcher bvMatcher = BV_PATTERN.matcher(trimmed);
        Matcher avMatcher = AV_PATTERN.matcher(trimmed);
        String bvid = bvMatcher.find() ? normalizeBvid(bvMatcher.group()) : null;
        Long aid = null;
        if (bvid == null && avMatcher.find()) {
            try {
                aid = Long.parseLong(avMatcher.group(1));
                bvid = "av" + aid;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        int page = 1;
        Matcher pageMatcher = PAGE_PATTERN.matcher(trimmed);
        if (pageMatcher.find()) {
            try {
                page = Math.max(1, Integer.parseInt(pageMatcher.group(1)));
            } catch (NumberFormatException ignored) {
                page = 1;
            }
        }

        if (bvid != null) {
            return new BilibiliMedia(
                bvid,
                aid,
                page,
                canonicalUrl(bvid, page),
                false
            );
        }

        Matcher shortMatcher = SHORT_URL_PATTERN.matcher(trimmed);
        if (shortMatcher.find()) {
            String code = shortMatcher.group(1);
            return new BilibiliMedia("b23:" + code, null, 1, "https://b23.tv/" + code, true);
        }
        return null;
    }

    public static BilibiliMedia fromJson(JSONObject json) throws JSONException {
        if (json == null || !"bilibili".equals(json.optString("type"))) return null;
        String bvid = json.getString("bvid");
        Long derivedAid = aidFromBvid(bvid);
        Long aid = json.has("aid") ? json.getLong("aid") : derivedAid;
        if (derivedAid != null && !derivedAid.equals(aid)) throw new JSONException("AV aid does not match bvid");
        int page = Math.max(1, json.optInt("page", 1));
        String canonicalUrl = json.optString("canonicalUrl", canonicalUrl(bvid, page));
        return new BilibiliMedia(bvid, aid, page, canonicalUrl, json.optBoolean("unresolved", false));
    }

    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject()
            .put("type", "bilibili")
            .put("bvid", bvid)
            .put("page", page)
            .put("canonicalUrl", canonicalUrl);
        if (aid != null) json.put("aid", aid);
        if (unresolved) json.put("unresolved", true);
        return json;
    }

    public String embedUrl() {
        if (unresolved) return null;
        String identifier;
        if (bvid.matches("^BV[0-9A-Za-z]{10}$")) {
            identifier = "bvid=" + bvid;
        } else if (aid != null && aid > 0) {
            identifier = "aid=" + aid;
        } else {
            return null;
        }
        return "https://player.bilibili.com/player.html?page=" + page
            + "&high_quality=1&danmaku=0&autoplay=0&as_wide=1&" + identifier;
    }

    public boolean sameIdentity(BilibiliMedia other) {
        return other != null && bvid.equals(other.bvid) && page == other.page;
    }

    private static String normalizeBvid(String value) {
        return "BV" + value.substring(2);
    }

    private static String canonicalUrl(String bvid, int page) {
        return "https://www.bilibili.com/video/" + bvid + (page > 1 ? "?p=" + page : "");
    }

    private static Long aidFromBvid(String bvid) {
        Matcher matcher = AV_ID_PATTERN.matcher(bvid);
        if (!matcher.matches()) return null;
        try {
            return Long.parseLong(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof BilibiliMedia)) return false;
        BilibiliMedia other = (BilibiliMedia) value;
        return page == other.page && bvid.equals(other.bvid);
    }

    @Override
    public int hashCode() {
        return Objects.hash(bvid, page);
    }
}
