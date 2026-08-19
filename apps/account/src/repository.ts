import type { ActivePairRecord, ActivePairRoomRecord, ChallengeRecord, DeviceTokenRecord, PairInviteRecord, SessionRecord, UserRecord } from "./models";

import type { PairArchiveRecord, PairRetentionDecision } from './models';

function userFromRow(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    emailHmac: String(row.email_hmac),
    emailMasked: String(row.email_masked),
    nickname: String(row.nickname),
    avatarId: String(row.avatar_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function challengeFromRow(row: Record<string, unknown>): ChallengeRecord {
  return {
    id: String(row.id),
    emailHmac: String(row.email_hmac),
    codeHash: String(row.code_hash),
    expiresAt: Number(row.expires_at),
    availableAfter: Number(row.available_after),
    attempts: Number(row.attempts),
    consumedAt: row.consumed_at === null ? null : Number(row.consumed_at),
    requesterIpHash: row.requester_ip_hash === null ? null : String(row.requester_ip_hash),
    createdAt: Number(row.created_at),
  };
}

function sessionFromRow(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    deviceName: String(row.device_name),
    expiresAt: Number(row.expires_at),
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function pairInviteFromRow(row: Record<string, unknown>): PairInviteRecord {
  return {
    id: String(row.id),
    inviterUserId: String(row.inviter_user_id),
    codeHash: String(row.code_hash),
    expiresAt: Number(row.expires_at),
    usedAt: row.used_at === null ? null : Number(row.used_at),
    acceptedByUserId: row.accepted_by_user_id === null ? null : String(row.accepted_by_user_id),
    createdAt: Number(row.created_at),
  };
}

function deviceTokenFromRow(row: Record<string, unknown>): DeviceTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    provider: String(row.provider),
    tokenHash: String(row.token_hash),
    tokenCiphertext: String(row.token_ciphertext),
    deviceName: String(row.device_name),
    appVersion: String(row.app_version),
    lastSeenAt: Number(row.last_seen_at),
    createdAt: Number(row.created_at),
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
  };
}

function pairArchiveFromRow(row: Record<string, unknown>): PairArchiveRecord {
  return {
    pairId: String(row.pair_id),
    userId: String(row.user_id),
    partnerUserId: String(row.partner_user_id),
    boundAt: Number(row.bound_at),
    unboundAt: Number(row.unbound_at),
    retentionStatus: String(row.retention_status) as PairArchiveRecord['retentionStatus'],
    decidedAt: row.decided_at === null ? null : Number(row.decided_at),
    createdAt: Number(row.created_at),
    partnerEmailSnapshot: String(row.partner_email_snapshot),
    partnerNicknameSnapshot: String(row.partner_nickname_snapshot),
    partnerAvatarSnapshot: String(row.partner_avatar_snapshot),
  };
}

function activePairRoomFromRow(row: Record<string, unknown>): ActivePairRoomRecord {
  return {
    pairId: String(row.pair_id),
    hostUserId: String(row.host_user_id),
    roomId: String(row.room_id),
    inviteUrlCiphertext: String(row.invite_url_ciphertext),
    expiresAt: Number(row.expires_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class AccountRepository {
  constructor(private readonly db: D1Database) {}

  async latestChallenge(emailHmac: string): Promise<ChallengeRecord | null> {
    const row = await this.db.prepare(
      "SELECT * FROM email_challenges WHERE email_hmac = ? ORDER BY created_at DESC LIMIT 1",
    ).bind(emailHmac).first<Record<string, unknown>>();
    return row ? challengeFromRow(row) : null;
  }

  async insertChallenge(challenge: ChallengeRecord): Promise<void> {
    await this.db.prepare(
      "INSERT INTO email_challenges (id, email_hmac, code_hash, expires_at, available_after, attempts, consumed_at, requester_ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      challenge.id,
      challenge.emailHmac,
      challenge.codeHash,
      challenge.expiresAt,
      challenge.availableAfter,
      challenge.attempts,
      challenge.consumedAt,
      challenge.requesterIpHash,
      challenge.createdAt,
    ).run();
  }

  async deleteChallenge(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM email_challenges WHERE id = ?").bind(id).run();
  }

  async incrementChallengeAttempts(id: string): Promise<void> {
    await this.db.prepare("UPDATE email_challenges SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
  }

  async consumeChallenge(id: string, consumedAt: number): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE email_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
    ).bind(consumedAt, id).run();
    return result.meta.changes === 1;
  }

  async userByEmail(emailHmac: string): Promise<UserRecord | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE email_hmac = ? LIMIT 1").bind(emailHmac).first<Record<string, unknown>>();
    return row ? userFromRow(row) : null;
  }

  async userById(id: string): Promise<UserRecord | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").bind(id).first<Record<string, unknown>>();
    return row ? userFromRow(row) : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.db.prepare(
      "INSERT INTO users (id, email_hmac, email_masked, nickname, avatar_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(user.id, user.emailHmac, user.emailMasked, user.nickname, user.avatarId, user.createdAt, user.updatedAt).run();
  }

  async updateUserNickname(id: string, nickname: string, updatedAt: number): Promise<void> {
    await this.db.prepare(
      "UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?",
    ).bind(nickname, updatedAt, id).run();
  }

  async insertSession(session: SessionRecord): Promise<void> {
    await this.db.prepare(
      "INSERT INTO auth_sessions (id, user_id, token_hash, device_name, expires_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      session.id,
      session.userId,
      session.tokenHash,
      session.deviceName,
      session.expiresAt,
      session.revokedAt,
      session.createdAt,
      session.updatedAt,
    ).run();
  }

  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.db.prepare(
      "SELECT * FROM auth_sessions WHERE token_hash = ? LIMIT 1",
    ).bind(tokenHash).first<Record<string, unknown>>();
    return row ? sessionFromRow(row) : null;
  }

  async revokeSession(id: string, revokedAt: number): Promise<void> {
    await this.db.prepare("UPDATE auth_sessions SET revoked_at = ?, updated_at = ? WHERE id = ?").bind(revokedAt, revokedAt, id).run();
  }

  async upsertDeviceToken(device: DeviceTokenRecord): Promise<void> {
    await this.db.batch([
      this.db.prepare(
        "UPDATE device_tokens SET revoked_at = ?, last_seen_at = ? WHERE token_hash = ? AND user_id <> ? AND revoked_at IS NULL",
      ).bind(device.lastSeenAt, device.lastSeenAt, device.tokenHash, device.userId),
      this.db.prepare(
      `INSERT INTO device_tokens (id, user_id, provider, token_hash, token_ciphertext, device_name, app_version, last_seen_at, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, token_hash) DO UPDATE SET provider = excluded.provider, token_ciphertext = excluded.token_ciphertext, device_name = excluded.device_name, app_version = excluded.app_version, last_seen_at = excluded.last_seen_at, revoked_at = NULL`,
      ).bind(device.id, device.userId, device.provider, device.tokenHash, device.tokenCiphertext, device.deviceName, device.appVersion, device.lastSeenAt, device.createdAt, device.revokedAt),
    ]);
  }

  async revokeDeviceToken(userId: string, tokenHash: string, revokedAt: number): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE device_tokens SET revoked_at = ?, last_seen_at = ? WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL",
    ).bind(revokedAt, revokedAt, userId, tokenHash).run();
    return result.meta.changes === 1;
  }

  async revokeAllDeviceTokens(userId: string, revokedAt: number): Promise<void> {
    await this.db.prepare("UPDATE device_tokens SET revoked_at = ?, last_seen_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(revokedAt, revokedAt, userId).run();
  }

  async activeDeviceTokensByUser(userId: string): Promise<DeviceTokenRecord[]> {
    const result = await this.db.prepare("SELECT * FROM device_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC").bind(userId).all<Record<string, unknown>>();
    return result.results.map(deviceTokenFromRow);
  }
  async insertPairInvite(invite: PairInviteRecord): Promise<void> {
    await this.db.prepare(
      "INSERT INTO pair_invites (id, inviter_user_id, code_hash, expires_at, used_at, accepted_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(invite.id, invite.inviterUserId, invite.codeHash, invite.expiresAt, invite.usedAt, invite.acceptedByUserId, invite.createdAt).run();
  }

  async invalidatePairInvites(inviterUserId: string, invalidatedAt: number): Promise<void> {
    await this.db.prepare(
      "UPDATE pair_invites SET used_at = ? WHERE inviter_user_id = ? AND used_at IS NULL",
    ).bind(invalidatedAt, inviterUserId).run();
  }

  async pairInviteByCodeHash(codeHash: string): Promise<PairInviteRecord | null> {
    const row = await this.db.prepare("SELECT * FROM pair_invites WHERE code_hash = ? LIMIT 1")
      .bind(codeHash)
      .first<Record<string, unknown>>();
    return row ? pairInviteFromRow(row) : null;
  }

  async activePairByUser(userId: string): Promise<ActivePairRecord | null> {
    const row = await this.db.prepare(
      `SELECT ap.pair_id, p.bound_at,
        u.id AS partner_id, u.email_hmac AS partner_email_hmac,
        u.email_masked AS partner_email_masked, u.nickname AS partner_nickname,
        u.avatar_id AS partner_avatar_id, u.created_at AS partner_created_at,
        u.updated_at AS partner_updated_at
       FROM active_pair_members ap
       JOIN pairs p ON p.id = ap.pair_id AND p.status = 'active'
       JOIN users u ON u.id = ap.partner_user_id
       WHERE ap.user_id = ? LIMIT 1`,
    ).bind(userId).first<Record<string, unknown>>();
    if (!row) return null;
    return {
      pairId: String(row.pair_id),
      boundAt: Number(row.bound_at),
      partner: {
        id: String(row.partner_id),
        emailHmac: String(row.partner_email_hmac),
        emailMasked: String(row.partner_email_masked),
        nickname: String(row.partner_nickname),
        avatarId: String(row.partner_avatar_id),
        createdAt: Number(row.partner_created_at),
        updatedAt: Number(row.partner_updated_at),
      },
    };
  }

  async activePairRoomByPair(pairId: string): Promise<ActivePairRoomRecord | null> {
    const row = await this.db.prepare(
      `SELECT apr.*
       FROM active_pair_rooms apr
       JOIN pairs p ON p.id = apr.pair_id AND p.status = 'active'
       WHERE apr.pair_id = ?
       LIMIT 1`,
    ).bind(pairId).first<Record<string, unknown>>();
    return row ? activePairRoomFromRow(row) : null;
  }

  async upsertActivePairRoom(room: ActivePairRoomRecord): Promise<boolean> {
    const result = await this.db.prepare(
      `INSERT INTO active_pair_rooms (
         pair_id, host_user_id, room_id, invite_url_ciphertext,
         expires_at, created_at, updated_at
       )
       SELECT p.id, ?, ?, ?, ?, ?, ?
       FROM pairs p
       WHERE p.id = ? AND p.status = 'active' AND (p.user_a_id = ? OR p.user_b_id = ?)
       ON CONFLICT (pair_id) DO UPDATE SET
         host_user_id = excluded.host_user_id,
         room_id = excluded.room_id,
         invite_url_ciphertext = excluded.invite_url_ciphertext,
         expires_at = excluded.expires_at,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    ).bind(
      room.hostUserId,
      room.roomId,
      room.inviteUrlCiphertext,
      room.expiresAt,
      room.createdAt,
      room.updatedAt,
      room.pairId,
      room.hostUserId,
      room.hostUserId,
    ).run();
    return result.meta.changes === 1;
  }

  async clearActivePairRoomByHost(hostUserId: string): Promise<void> {
    await this.db.prepare("DELETE FROM active_pair_rooms WHERE host_user_id = ?").bind(hostUserId).run();
  }

  async clearActivePairRoom(pairId: string): Promise<void> {
    await this.db.prepare("DELETE FROM active_pair_rooms WHERE pair_id = ?").bind(pairId).run();
  }

  async pairArchiveByUser(pairId: string, userId: string): Promise<PairArchiveRecord | null> {
    const row = await this.db.prepare(
      `SELECT pam.*, p.bound_at, p.unbound_at
       FROM pair_archive_members pam
       JOIN pairs p ON p.id = pam.pair_id AND p.status = 'unbound'
       WHERE pam.pair_id = ? AND pam.user_id = ?
       LIMIT 1`,
    ).bind(pairId, userId).first<Record<string, unknown>>();
    return row ? pairArchiveFromRow(row) : null;
  }

  async pairArchivesByUser(userId: string): Promise<PairArchiveRecord[]> {
    const result = await this.db.prepare(
      `SELECT pam.*, p.bound_at, p.unbound_at
       FROM pair_archive_members pam
       JOIN pairs p ON p.id = pam.pair_id AND p.status = 'unbound'
       WHERE pam.user_id = ? AND pam.retention_status <> 'delete'
       ORDER BY p.unbound_at DESC, pam.pair_id ASC`,
    ).bind(userId).all<Record<string, unknown>>();
    return result.results.map(pairArchiveFromRow);
  }

  async unbindPair(pairId: string, userId: string, retention: PairRetentionDecision, now: number): Promise<boolean> {
    const results = await this.db.batch([
      this.db.prepare(
        `UPDATE pairs
         SET status = 'unbound', unbound_at = ?, unbound_by_user_id = ?
         WHERE id = ? AND status = 'active' AND (user_a_id = ? OR user_b_id = ?)
           AND (SELECT COUNT(*) FROM active_pair_members ap WHERE ap.pair_id = pairs.id) = 2
           AND EXISTS (
             SELECT 1 FROM active_pair_members ap
             WHERE ap.pair_id = pairs.id AND ap.user_id = pairs.user_a_id AND ap.partner_user_id = pairs.user_b_id
           )
           AND EXISTS (
             SELECT 1 FROM active_pair_members ap
             WHERE ap.pair_id = pairs.id AND ap.user_id = pairs.user_b_id AND ap.partner_user_id = pairs.user_a_id
           )`,
      ).bind(now, userId, pairId, userId, userId),
      this.db.prepare(
        `INSERT INTO pair_archive_members (
           pair_id, user_id, partner_user_id,
           partner_email_snapshot, partner_nickname_snapshot, partner_avatar_snapshot,
           retention_status, decided_at, created_at
         )
         SELECT p.id, p.user_a_id, p.user_b_id,
           partner.email_masked, partner.nickname, partner.avatar_id,
           CASE WHEN p.user_a_id = ? THEN ? ELSE 'pending' END,
           CASE WHEN p.user_a_id = ? THEN ? ELSE NULL END,
           ?
         FROM pairs p
         JOIN users partner ON partner.id = p.user_b_id
         WHERE p.id = ? AND p.status = 'unbound'
           AND p.unbound_by_user_id = ? AND p.unbound_at = ?
           AND EXISTS (SELECT 1 FROM active_pair_members ap WHERE ap.pair_id = p.id)`,
      ).bind(userId, retention, userId, now, now, pairId, userId, now),
      this.db.prepare(
        `INSERT INTO pair_archive_members (
           pair_id, user_id, partner_user_id,
           partner_email_snapshot, partner_nickname_snapshot, partner_avatar_snapshot,
           retention_status, decided_at, created_at
         )
         SELECT p.id, p.user_b_id, p.user_a_id,
           partner.email_masked, partner.nickname, partner.avatar_id,
           CASE WHEN p.user_b_id = ? THEN ? ELSE 'pending' END,
           CASE WHEN p.user_b_id = ? THEN ? ELSE NULL END,
           ?
         FROM pairs p
         JOIN users partner ON partner.id = p.user_a_id
         WHERE p.id = ? AND p.status = 'unbound'
           AND p.unbound_by_user_id = ? AND p.unbound_at = ?
           AND EXISTS (SELECT 1 FROM active_pair_members ap WHERE ap.pair_id = p.id)`,
      ).bind(userId, retention, userId, now, now, pairId, userId, now),
      this.db.prepare(
        `UPDATE pair_invites
         SET used_at = ?
         WHERE used_at IS NULL AND inviter_user_id IN (
           SELECT user_a_id FROM pairs
           WHERE id = ? AND status = 'unbound' AND unbound_by_user_id = ? AND unbound_at = ?
           UNION
           SELECT user_b_id FROM pairs
           WHERE id = ? AND status = 'unbound' AND unbound_by_user_id = ? AND unbound_at = ?
         ) AND EXISTS (SELECT 1 FROM active_pair_members ap WHERE ap.pair_id = ?)`,
      ).bind(now, pairId, userId, now, pairId, userId, now, pairId),
      this.db.prepare(
        `DELETE FROM active_pair_rooms
         WHERE pair_id = ? AND EXISTS (
           SELECT 1 FROM pairs p
           WHERE p.id = ? AND p.status = 'unbound'
             AND p.unbound_by_user_id = ? AND p.unbound_at = ?
         )`,
      ).bind(pairId, pairId, userId, now),
      this.db.prepare(
        `DELETE FROM active_pair_members
         WHERE pair_id = ? AND EXISTS (
           SELECT 1 FROM pairs p
           WHERE p.id = ? AND p.status = 'unbound'
             AND p.unbound_by_user_id = ? AND p.unbound_at = ?
         )`,
      ).bind(pairId, pairId, userId, now),
    ]);
    return results[0]?.meta.changes === 1
      && results[1]?.meta.changes === 1
      && results[2]?.meta.changes === 1;
  }

  async setPairArchiveRetention(
    pairId: string,
    userId: string,
    retention: PairRetentionDecision,
    now: number,
  ): Promise<{ updated: boolean; pairDeleted: boolean }> {
    const results = await this.db.batch([
      this.db.prepare(
        `UPDATE pair_archive_members
         SET retention_status = ?, decided_at = ?
         WHERE pair_id = ? AND user_id = ? AND retention_status = 'pending'`,
      ).bind(retention, now, pairId, userId),
      this.db.prepare(
        `DELETE FROM pairs
         WHERE id = ? AND status = 'unbound'
           AND (SELECT COUNT(*) FROM pair_archive_members pam WHERE pam.pair_id = pairs.id) = 2
           AND NOT EXISTS (
             SELECT 1 FROM pair_archive_members pam
             WHERE pam.pair_id = pairs.id AND pam.retention_status <> 'delete'
           )`,
      ).bind(pairId),
    ]);
    return {
      updated: results[0]?.meta.changes === 1,
      pairDeleted: results[1]?.meta.changes === 1,
    };
  }

  async acceptPairInvite(invite: PairInviteRecord, accepterUserId: string, pairId: string, now: number): Promise<boolean> {
    try {
      const results = await this.db.batch([
        this.db.prepare(
          `INSERT INTO pairs (id, user_a_id, user_b_id, status, bound_at)
           SELECT ?, inviter_user_id, ?, 'active', ? FROM pair_invites
           WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
        ).bind(pairId, accepterUserId, now, invite.id, now),
        this.db.prepare(
          "INSERT INTO pair_library_state (pair_id, revision, created_at, updated_at) VALUES (?, 0, ?, ?)",
        ).bind(pairId, now, now),
        this.db.prepare(
          "INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)",
        ).bind(invite.inviterUserId, pairId, accepterUserId, now),
        this.db.prepare(
          "INSERT INTO active_pair_members (user_id, pair_id, partner_user_id, joined_at) VALUES (?, ?, ?, ?)",
        ).bind(accepterUserId, pairId, invite.inviterUserId, now),
        this.db.prepare(
          "UPDATE pair_invites SET used_at = ?, accepted_by_user_id = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?",
        ).bind(now, accepterUserId, invite.id, now),
      ]);
      return results[0]?.meta.changes === 1 && results[4]?.meta.changes === 1;
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed")) return false;
      throw error;
    }
  }
}
