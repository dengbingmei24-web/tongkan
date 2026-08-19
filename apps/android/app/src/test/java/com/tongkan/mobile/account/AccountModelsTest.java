package com.tongkan.mobile.account;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class AccountModelsTest {
    @Test
    public void parsesSessionResponse() throws Exception {
        JSONObject json = new JSONObject("{\"token\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expiresAt\":1800000000000,\"user\":{\"id\":\"user-1\",\"email\":\"u***@example.com\",\"nickname\":\"user\",\"avatarId\":\"signal-01\"}}");
        AccountModels.Session session = AccountModels.Session.fromJson(json);
        assertEquals("user-1", session.user.id);
        assertEquals("u***@example.com", session.user.email);
        assertEquals(1_800_000_000_000L, session.expiresAt);
    }

    @Test
    public void acceptsOnlyHttpsAccountOrigins() {
        assertEquals("https://account.example.com", AccountClient.normalizeBaseUrl("https://account.example.com/"));
        assertEquals("https://account.example.com/account-api", AccountClient.normalizeBaseUrl("https://account.example.com/account-api/"));
        assertEquals("", AccountClient.normalizeBaseUrl("http://account.example.com"));
        assertEquals("", AccountClient.normalizeBaseUrl("https://account.example.com/a/../b"));
    }

    @Test
    public void parsesPairResponses() throws Exception {
        AccountModels.PairInvite invite = AccountModels.PairInvite.fromJson(
            new JSONObject("{\"code\":\"ABCDE-23456\",\"expiresAt\":1800086400000}")
        );
        assertEquals("ABCDE-23456", invite.code);

        AccountModels.Pair pair = AccountModels.Pair.fromJson(new JSONObject(
            "{\"pairId\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"boundAt\":1800000000000,\"partner\":{\"id\":\"user-2\",\"email\":\"p***@example.com\",\"nickname\":\"partner\",\"avatarId\":\"signal-02\"}}"
        ));
        assertEquals("user-2", pair.partner.id);
        assertEquals("partner", pair.partner.nickname);
    }

    @Test
    public void parsesActivePairRoomResponses() throws Exception {
        String roomId = "dddddddddddddddddddddddddddddddd";
        JSONObject response = new JSONObject()
            .put("room", new JSONObject()
                .put("roomId", roomId)
                .put("url", "https://tongkan-personal.pages.dev/room/" + roomId + "#join=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                .put("expiresAt", 1_800_000_600_000L)
                .put("createdAt", 1_800_000_000_000L)
                .put("host", user("user-2", "Partner")));
        AccountModels.ActiveRoom room = AccountModels.ActiveRoom.fromResponse(response);
        assertEquals(roomId, room.roomId);
        assertEquals("Partner", room.host.nickname);
        assertNull(AccountModels.ActiveRoom.fromResponse(new JSONObject().put("room", JSONObject.NULL)));
    }

    @Test
    public void rejectsActiveRoomUrlsOutsideTongkan() throws Exception {
        JSONObject response = new JSONObject()
            .put("room", new JSONObject()
                .put("roomId", "dddddddddddddddddddddddddddddddd")
                .put("url", "https://evil.example/room/dddddddddddddddddddddddddddddddd#join=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                .put("expiresAt", 1_800_000_600_000L)
                .put("createdAt", 1_800_000_000_000L)
                .put("host", user("user-2", "Partner")));
        try {
            AccountModels.ActiveRoom.fromResponse(response);
            fail("Expected invalid active room URL");
        } catch (org.json.JSONException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }

    @Test
    public void parsesLegacyAndExtendedPairStateResponses() throws Exception {
        AccountModels.PairState legacy = AccountModels.PairState.fromJson(new JSONObject()
            .put("pair", pair("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_800_000_000_000L, "user-2", "partner")));
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", legacy.pair.pairId);
        assertTrue(legacy.pendingArchives.isEmpty());
        assertTrue(legacy.archives.isEmpty());

        JSONObject extendedJson = new JSONObject()
            .put("pair", JSONObject.NULL)
            .put("pendingArchives", new JSONArray()
                .put(archive("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 1_700_000_000_000L, 1_800_000_000_000L, "pending", "user-b", "B"))
                .put(archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "pending", "user-a", "A")))
            .put("archives", new JSONArray()
                .put(archive("cccccccccccccccccccccccccccccccc", 1_600_000_000_000L, 1_800_000_100_000L, "keep", "user-c", "C")));
        AccountModels.PairState extended = AccountModels.PairState.fromJson(extendedJson);
        assertNull(extended.pair);
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", extended.pendingArchives.get(0).pairId);
        assertEquals("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", extended.pendingArchives.get(1).pairId);
        assertEquals("keep", extended.archives.get(0).retention);
    }

    @Test
    public void parsesPairMutationResults() throws Exception {
        AccountModels.PairMutationResult kept = AccountModels.PairMutationResult.fromJson(new JSONObject()
            .put("archive", archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "keep", "user-a", "A"))
            .put("pairDeleted", false));
        assertEquals("keep", kept.archive.retention);
        assertFalse(kept.pairDeleted);

        AccountModels.PairMutationResult deletedAccess = AccountModels.PairMutationResult.fromJson(new JSONObject()
            .put("archive", JSONObject.NULL)
            .put("pairDeleted", false));
        assertNull(deletedAccess.archive);
        assertFalse(deletedAccess.pairDeleted);

        AccountModels.PairMutationResult deleted = AccountModels.PairMutationResult.fromJson(new JSONObject()
            .put("archive", JSONObject.NULL)
            .put("pairDeleted", true));
        assertNull(deleted.archive);
        assertTrue(deleted.pairDeleted);
    }

    @Test
    public void rejectsInvalidPairArchiveResponses() throws Exception {
        assertPairStateFailure(new JSONObject()
            .put("pair", JSONObject.NULL)
            .put("pendingArchives", new JSONArray().put(archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "pending", "user-a", "A")))
            .put("archives", new JSONArray().put(archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "keep", "user-a", "A"))));
        assertPairStateFailure(new JSONObject()
            .put("pair", JSONObject.NULL)
            .put("pendingArchives", new JSONArray())
            .put("archives", new JSONArray().put(archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "delete", "user-a", "A"))));
        try {
            AccountModels.PairMutationResult.fromJson(new JSONObject()
                .put("archive", archive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1_700_000_000_000L, 1_800_000_000_000L, "keep", "user-a", "A"))
                .put("pairDeleted", true));
            fail("Expected invalid pair mutation response");
        } catch (org.json.JSONException expected) {
            assertTrue(expected.getMessage().contains("Deleted pair"));
        }
    }

    @Test
    public void parsesStrictLibrarySnapshotAndBatchResults() throws Exception {
        JSONObject snapshotJson = librarySnapshot(false, 7);
        AccountModels.LibrarySnapshot snapshot = AccountModels.LibrarySnapshot.fromJson(snapshotJson);
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", snapshot.pairId);
        assertEquals(7, snapshot.revision);
        assertFalse(snapshot.readOnly);
        assertEquals("电影", snapshot.categories.get(0).name);
        assertEquals("BV1Qxuc62E1y", snapshot.items.get(0).bvid);
        assertEquals("partial", snapshot.items.get(0).metadataStatus);

        JSONObject batchJson = new JSONObject()
            .put("results", new JSONArray()
                .put(new JSONObject().put("input", "https://www.bilibili.com/video/BV1Qxuc62E1y")
                    .put("status", "added").put("item", snapshotJson.getJSONArray("items").getJSONObject(0)).put("error", JSONObject.NULL))
                .put(new JSONObject().put("input", "https://b23.tv/abc")
                    .put("status", "rejected").put("item", JSONObject.NULL).put("error", "B23_RESOLUTION_FAILED")))
            .put("library", snapshotJson);
        AccountModels.BatchAddResult batch = AccountModels.BatchAddResult.fromJson(batchJson);
        assertEquals(2, batch.results.size());
        assertEquals("B23_RESOLUTION_FAILED", batch.results.get(1).error);
    }

    @Test
    public void rejectsMalformedLibrarySnapshotsAndConflictErrors() throws Exception {
        JSONObject malformed = librarySnapshot(false, 1);
        malformed.getJSONArray("items").getJSONObject(0).put("watchStatus", "later");
        try {
            AccountModels.LibrarySnapshot.fromJson(malformed);
            fail("Expected invalid library snapshot");
        } catch (org.json.JSONException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }

        AccountClient.Failure conflict = AccountClient.parseFailure(409,
            "{\"error\":\"LIBRARY_VERSION_CONFLICT\",\"message\":\"stale\",\"currentRevision\":9}");
        assertEquals("LIBRARY_VERSION_CONFLICT", conflict.code);
        assertEquals(9, conflict.currentRevision);

        AccountClient.Failure invalid = AccountClient.parseFailure(409,
            "{\"error\":\"LIBRARY_VERSION_CONFLICT\",\"message\":\"stale\"}");
        assertEquals("INVALID_RESPONSE", invalid.code);
    }

    @Test
    public void parsesCalendarSnapshotAndSortsByDateThenTime() throws Exception {
        JSONObject snapshotJson = calendarSnapshot();
        snapshotJson.getJSONArray("plans")
            .put(calendarPlan("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2026-08-21", "08:00", "planned", 4))
            .put(calendarPlan("cccccccccccccccccccccccccccccccc", "2026-08-20", null, "planned", 3))
            .put(calendarPlan("dddddddddddddddddddddddddddddddd", "2026-08-20", "20:00", "planned", 2))
            .put(calendarPlan("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "2026-08-20", "18:30", "completed", 1));

        AccountModels.CalendarSnapshot snapshot = AccountModels.CalendarSnapshot.fromJson(snapshotJson);
        assertEquals(4, snapshot.plans.size());
        assertEquals("2026-08-20", snapshot.plans.get(0).date);
        assertEquals("18:30", snapshot.plans.get(0).startTime);
        assertEquals("20:00", snapshot.plans.get(1).startTime);
        assertNull(snapshot.plans.get(2).startTime);
        assertEquals("2026-08-21", snapshot.plans.get(3).date);
        assertEquals(2, snapshot.plansForDate("2026-08-20", true).size());
        assertTrue(AccountModels.isCalendarMonth("2026-08"));
        assertFalse(AccountModels.isCalendarMonth("2026-13"));
        assertTrue(AccountModels.isCalendarDate("2028-02-29"));
        assertFalse(AccountModels.isCalendarDate("2026-02-29"));
        assertTrue(AccountModels.isStartTime("23:59"));
        assertFalse(AccountModels.isStartTime("24:00"));
    }

    @Test
    public void rejectsMalformedCalendarSnapshots() throws Exception {
        JSONObject emptyTime = calendarSnapshot();
        emptyTime.getJSONArray("plans").put(
            calendarPlan("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "2026-08-20", "", "planned", 1));
        assertCalendarFailure(emptyTime);

        JSONObject outsideRange = calendarSnapshot();
        outsideRange.getJSONArray("plans").put(
            calendarPlan("cccccccccccccccccccccccccccccccc", "2026-09-01", null, "planned", 1));
        assertCalendarFailure(outsideRange);

        JSONObject duplicate = calendarSnapshot();
        JSONObject plan = calendarPlan("dddddddddddddddddddddddddddddddd", "2026-08-20", null, "planned", 1);
        duplicate.getJSONArray("plans").put(plan).put(new JSONObject(plan.toString()));
        assertCalendarFailure(duplicate);
    }

    private static JSONObject pair(String pairId, long boundAt, String userId, String nickname) throws Exception {
        return new JSONObject()
            .put("pairId", pairId)
            .put("boundAt", boundAt)
            .put("partner", user(userId, nickname));
    }

    private static JSONObject archive(
        String pairId,
        long boundAt,
        long unboundAt,
        String retention,
        String userId,
        String nickname
    ) throws Exception {
        return pair(pairId, boundAt, userId, nickname)
            .put("unboundAt", unboundAt)
            .put("retention", retention);
    }

    private static JSONObject user(String userId, String nickname) throws Exception {
        return new JSONObject()
            .put("id", userId)
            .put("email", nickname.toLowerCase() + "***@example.com")
            .put("nickname", nickname)
            .put("avatarId", "signal-01");
    }

    private static JSONObject librarySnapshot(boolean readOnly, long revision) throws Exception {
        JSONObject actor = new JSONObject().put("id", "user-1").put("nickname", "Alice");
        JSONObject category = new JSONObject()
            .put("id", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
            .put("name", "电影")
            .put("position", 0)
            .put("createdAt", 1_800_000_000_000L)
            .put("updatedAt", 1_800_000_000_000L);
        JSONObject item = new JSONObject()
            .put("id", "cccccccccccccccccccccccccccccccc")
            .put("bvid", "BV1Qxuc62E1y")
            .put("page", 1)
            .put("cid", JSONObject.NULL)
            .put("canonicalUrl", "https://www.bilibili.com/video/BV1Qxuc62E1y")
            .put("title", "BV1Qxuc62E1y")
            .put("coverUrl", JSONObject.NULL)
            .put("ownerName", JSONObject.NULL)
            .put("durationSeconds", JSONObject.NULL)
            .put("metadataStatus", "partial")
            .put("categoryId", category.getString("id"))
            .put("watchStatus", "unwatched")
            .put("position", 0)
            .put("addedBy", actor)
            .put("updatedBy", actor)
            .put("createdAt", 1_800_000_000_000L)
            .put("updatedAt", 1_800_000_000_000L);
        return new JSONObject()
            .put("pairId", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            .put("revision", revision)
            .put("readOnly", readOnly)
            .put("categories", new JSONArray().put(category))
            .put("items", new JSONArray().put(item));
    }

    private static JSONObject calendarSnapshot() throws Exception {
        return new JSONObject()
            .put("pairId", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            .put("revision", 4)
            .put("readOnly", false)
            .put("range", new JSONObject().put("from", "2026-08-01").put("to", "2026-08-31"))
            .put("plans", new JSONArray());
    }

    private static JSONObject calendarPlan(
        String id,
        String date,
        String startTime,
        String status,
        long createdAt
    ) throws Exception {
        JSONObject actor = new JSONObject().put("id", "user-a").put("nickname", "Alice");
        JSONObject media = new JSONObject()
            .put("bvid", "BV1Qxuc62E1y")
            .put("page", 1)
            .put("canonicalUrl", "https://www.bilibili.com/video/BV1Qxuc62E1y")
            .put("title", "测试视频")
            .put("coverUrl", JSONObject.NULL);
        JSONObject result = new JSONObject()
            .put("id", id)
            .put("libraryItemId", "ffffffffffffffffffffffffffffffff")
            .put("date", date)
            .put("startTime", startTime == null ? JSONObject.NULL : startTime)
            .put("note", JSONObject.NULL)
            .put("status", status)
            .put("media", media)
            .put("createdBy", actor)
            .put("updatedBy", actor)
            .put("createdAt", createdAt)
            .put("updatedAt", createdAt + 1);
        return result.put("completedAt", "completed".equals(status) ? createdAt + 1 : JSONObject.NULL);
    }

    private static void assertCalendarFailure(JSONObject value) throws Exception {
        try {
            AccountModels.CalendarSnapshot.fromJson(value);
            fail("Expected invalid calendar response");
        } catch (org.json.JSONException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }

    private static void assertPairStateFailure(JSONObject value) throws Exception {
        try {
            AccountModels.PairState.fromJson(value);
            fail("Expected invalid pair state response");
        } catch (org.json.JSONException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }
}
