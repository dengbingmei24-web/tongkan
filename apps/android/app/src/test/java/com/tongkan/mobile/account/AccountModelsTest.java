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

    private static void assertPairStateFailure(JSONObject value) throws Exception {
        try {
            AccountModels.PairState.fromJson(value);
            fail("Expected invalid pair state response");
        } catch (org.json.JSONException expected) {
            assertFalse(expected.getMessage().isEmpty());
        }
    }
}
