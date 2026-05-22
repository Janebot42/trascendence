import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { mapSession } from '../../db/pgMappers.js';
import type { Session } from './sessions.types.js';
import type { SessionsRepository } from './sessions.repository.js';

export class PgSessionsRepository implements SessionsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(input: Omit<Session, 'id' | 'createdAt' | 'lastSeenAt' | 'revokedAt'>): Promise<Session> {
    const result = await this.pool.query(
      `insert into sessions
        (id, user_id, session_token_hash, expires_at, ip_address, user_agent, reauthenticated_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        randomToken(16),
        input.userId,
        input.tokenHash,
        input.expiresAt,
        input.ipAddress,
        input.userAgent,
        input.reauthenticatedAt
      ]
    );
    return mapSession(result.rows[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const result = await this.pool.query('select * from sessions where session_token_hash = $1', [tokenHash]);
    return result.rowCount ? mapSession(result.rows[0]) : null;
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query(
      `update sessions
       set revoked_at = coalesce(revoked_at, now())
       where session_token_hash = $1`,
      [tokenHash]
    );
  }

  async revokeOtherUserSessions(userId: string, keepSessionId: string): Promise<void> {
    await this.pool.query(
      `update sessions
       set revoked_at = coalesce(revoked_at, now())
       where user_id = $1 and id <> $2 and revoked_at is null`,
      [userId, keepSessionId]
    );
  }

  async markReauthenticated(sessionId: string): Promise<void> {
    await this.pool.query('update sessions set reauthenticated_at = now() where id = $1', [sessionId]);
  }
}

