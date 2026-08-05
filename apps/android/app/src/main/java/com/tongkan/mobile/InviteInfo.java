package com.tongkan.mobile;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class InviteInfo {
    private static final String TRUSTED_SCHEME = "https";
    private static final String TRUSTED_HOST = "tongkan-personal.pages.dev";
    private static final Pattern ROOM_PATTERN = Pattern.compile("/room/([a-f0-9]{32})/?$");
    private static final Pattern KEY_PATTERN = Pattern.compile("^[a-f0-9]{32}$");

    public final String roomId;
    public final String key;
    public final String role;

    public InviteInfo(String roomId, String key, String role) {
        this.roomId = roomId;
        this.key = key;
        this.role = role;
    }

    public static InviteInfo parse(String input) {
        if (input == null || input.trim().isEmpty()) return null;
        try {
            URI uri = URI.create(input.trim());
            if (!TRUSTED_SCHEME.equalsIgnoreCase(uri.getScheme()) || !TRUSTED_HOST.equalsIgnoreCase(uri.getHost())) {
                return null;
            }
            Matcher roomMatch = ROOM_PATTERN.matcher(uri.getPath() == null ? "" : uri.getPath());
            if (!roomMatch.find()) return null;
            String fragment = uri.getFragment() == null ? "" : uri.getFragment();
            String host = parameter(fragment, "host");
            String join = parameter(fragment, "join");
            if (host != null && KEY_PATTERN.matcher(host).matches()) {
                return new InviteInfo(roomMatch.group(1), host, "host");
            }
            if (join != null && KEY_PATTERN.matcher(join).matches()) {
                return new InviteInfo(roomMatch.group(1), join, "guest");
            }
        } catch (RuntimeException ignored) {
            return null;
        }
        return null;
    }

    private static String parameter(String query, String name) {
        for (String part : query.split("&")) {
            int separator = part.indexOf('=');
            if (separator > 0 && name.equals(part.substring(0, separator))) return part.substring(separator + 1);
        }
        return null;
    }
}
