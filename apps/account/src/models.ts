export interface UserRecord {
  id: string;
  emailHmac: string;
  emailMasked: string;
  nickname: string;
  avatarId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChallengeRecord {
  id: string;
  emailHmac: string;
  codeHash: string;
  expiresAt: number;
  availableAfter: number;
  attempts: number;
  consumedAt: number | null;
  requesterIpHash: string | null;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  deviceName: string;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AuthenticatedSession {
  session: SessionRecord;
  user: UserRecord;
}

export interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  avatarId: string;
}

export interface PairInviteRecord {
  id: string;
  inviterUserId: string;
  codeHash: string;
  expiresAt: number;
  usedAt: number | null;
  acceptedByUserId: string | null;
  createdAt: number;
}

export interface ActivePairRecord {
  pairId: string;
  boundAt: number;
  partner: UserRecord;
}

export interface DeviceTokenRecord {
  id: string;
  userId: string;
  provider: string;
  tokenHash: string;
  tokenCiphertext: string;
  deviceName: string;
  appVersion: string;
  lastSeenAt: number;
  createdAt: number;
  revokedAt: number | null;
}
