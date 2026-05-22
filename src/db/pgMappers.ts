import type { User, UserRole, UserStatus } from '../modules/users/users.types.js';
import type { Session } from '../modules/sessions/sessions.types.js';
import type { LoginChallenge } from '../modules/auth/auth.repository.js';
import type { PasswordCredential } from '../modules/auth/auth.types.js';
import type { RecoveryCodeRecord, TotpRecord } from '../modules/two_factor/twoFactor.types.js';
import type { OAuthAccountRecord, OAuthStateRecord } from '../modules/oauth/oauth.types.js';

type Row = Record<string, unknown>;

export function mapUser(row: Row): User {
  return {
    id: row.id as string,
    username: row.username as string,
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export function mapPasswordCredential(row: Row): PasswordCredential {
  return {
    userId: row.user_id as string,
    passwordHash: row.password_hash as string,
    passwordUpdatedAt: row.password_updated_at as Date
  };
}

export function mapSession(row: Row): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.session_token_hash as string,
    createdAt: row.created_at as Date,
    lastSeenAt: row.last_seen_at as Date,
    expiresAt: row.expires_at as Date,
    revokedAt: (row.revoked_at as Date | null) ?? null,
    ipAddress: (row.ip_address as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    reauthenticatedAt: (row.reauthenticated_at as Date | null) ?? null
  };
}

export function mapLoginChallenge(row: Row): LoginChallenge {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.challenge_token_hash as string,
    createdAt: row.created_at as Date,
    expiresAt: row.expires_at as Date,
    consumedAt: (row.consumed_at as Date | null) ?? null,
    ipAddress: (row.ip_address as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null
  };
}

export function mapTotpRecord(row: Row): TotpRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    secretEncrypted: row.secret_encrypted as string,
    enabledAt: (row.enabled_at as Date | null) ?? null,
    confirmedAt: (row.confirmed_at as Date | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export function mapRecoveryCode(row: Row): RecoveryCodeRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    codeHash: row.code_hash as string,
    createdAt: row.created_at as Date,
    usedAt: (row.used_at as Date | null) ?? null,
    replacedAt: (row.replaced_at as Date | null) ?? null
  };
}


export function mapOAuthState(row: Row): OAuthStateRecord {
  return {
    id: row.id as string,
    provider: row.provider as '42',
    stateTokenHash: row.state_token_hash as string,
    redirectTo: (row.redirect_to as string | null) ?? null,
    createdAt: row.created_at as Date,
    expiresAt: row.expires_at as Date,
    consumedAt: (row.consumed_at as Date | null) ?? null
  };
}

export function mapOAuthAccount(row: Row): OAuthAccountRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    provider: row.provider as '42',
    providerUserId: row.provider_user_id as string,
    providerLogin: (row.provider_login as string | null) ?? null,
    providerEmail: (row.provider_email as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}
