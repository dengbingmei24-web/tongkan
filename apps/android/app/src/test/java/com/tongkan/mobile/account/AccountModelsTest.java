package com.tongkan.mobile.account;

import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

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
}
