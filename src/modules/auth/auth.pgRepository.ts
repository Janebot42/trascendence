import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { mapLoginChallenge, mapPasswordCredential } from '../../db/pgMappers.js';
import type { PasswordCredential } from './auth.types.js';
import type { AuthRepository, LoginChallenge } from './auth.repository.js';

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createPasswordCredential(input: PasswordCredential): Promise<void> {
    await this.pool.query(
      `insert into password_credentials (user_id, password_hash, password_updated_at)
       values ($1, $2, $3)`,
      [input.userId, input.passwordHash, input.passwordUpdatedAt]
    );
  }

  async findPasswordCredential(userId: string): Promise<PasswordCredential | null> {
    const result = await this.pool.query('select * from password_credentials where user_id = $1', [userId]);
    return result.rowCount ? mapPasswordCredential(result.rows[0]) : null;
  }

  async updatePasswordCredential(input: PasswordCredential): Promise<void> {
    await this.pool.query(
      `update password_credentials
       set password_hash = $2, password_updated_at = $3, updated_at = now()
       where user_id = $1`,
      [input.userId, input.passwordHash, input.passwordUpdatedAt]
    );
  }

  async createLoginChallenge(input: Omit<LoginChallenge, 'id' | 'createdAt' | 'consumedAt'>): Promise<LoginChallenge> {
    const result = await this.pool.query(
      `insert into login_challenges
        (id, user_id, challenge_token_hash, expires_at, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [randomToken(16), input.userId, input.tokenHash, input.expiresAt, input.ipAddress, input.userAgent]
    );
    return mapLoginChallenge(result.rows[0]);
  }

  async findLoginChallengeByTokenHash(tokenHash: string): Promise<LoginChallenge | null> {
    const result = await this.pool.query('select * from login_challenges where challenge_token_hash = $1', [
      tokenHash
    ]);
    return result.rowCount ? mapLoginChallenge(result.rows[0]) : null;
  }

  async consumeLoginChallenge(id: string): Promise<void> {
    await this.pool.query(
      `update login_challenges
       set consumed_at = coalesce(consumed_at, now())
       where id = $1`,
      [id]
    );
  }
}

