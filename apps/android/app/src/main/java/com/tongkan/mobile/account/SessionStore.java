package com.tongkan.mobile.account;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SessionStore {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "tongkan_account_session_v1";
    private static final String PREFS = "tongkan_account_session";
    private static final String TOKEN = "token";
    private static final String TOKEN_IV = "tokenIv";
    private final SharedPreferences preferences;

    public SessionStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void save(AccountModels.Session session) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(session.token.getBytes(StandardCharsets.UTF_8));
        boolean saved = preferences.edit()
            .putString(TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(TOKEN_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putLong("expiresAt", session.expiresAt)
            .putString("userId", session.user.id)
            .putString("email", session.user.email)
            .putString("nickname", session.user.nickname)
            .putString("avatarId", session.user.avatarId)
            .commit();
        if (!saved) throw new IllegalStateException("Session storage failed");
    }

    public synchronized AccountModels.Session load() {
        String encryptedValue = preferences.getString(TOKEN, null);
        String ivValue = preferences.getString(TOKEN_IV, null);
        String userId = preferences.getString("userId", null);
        if (encryptedValue == null || ivValue == null || userId == null) return null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            byte[] iv = Base64.decode(ivValue, Base64.NO_WRAP);
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            byte[] decrypted = cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP));
            String token = new String(decrypted, StandardCharsets.UTF_8);
            AccountModels.User user = new AccountModels.User(
                userId,
                preferences.getString("email", "***"),
                preferences.getString("nickname", "同看用户"),
                preferences.getString("avatarId", "signal-01")
            );
            return new AccountModels.Session(token, preferences.getLong("expiresAt", 0L), user);
        } catch (Exception error) {
            clear();
            return null;
        }
    }

    public synchronized void clear() {
        preferences.edit().clear().commit();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        KeyStore.Entry existing = keyStore.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }
}
