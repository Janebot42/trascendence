import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { mapOAuthAccount, mapOAuthState } from '../../db/pgMappers.js';
import type { OAuthRepository } from './oauth.repository.js';
import type { OAuthAccountRecord, OAuthProvider, OAuthStateRecord } from './oauth.types.js';

export class PgOAuthRepository implements OAuthRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createState(input: Omit<OAuthStateRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<OAuthStateRecord> {
    const result = await this.pool.query(
      `insert into oauth_states (id, provider, purpose, initiating_user_id, state_token_hash, redirect_to, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        randomToken(16),
        input.provider,
        input.purpose,
        input.initiatingUserId,
        input.stateTokenHash,
        input.redirectTo,
        input.expiresAt
      ]
    );
    return mapOAuthState(result.rows[0]);
  }

  async consumeStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null> {
    const result = await this.pool.query(
      `update oauth_states
       set consumed_at = now()
       where state_token_hash = $1
         and consumed_at is null
       returning *`,
      [tokenHash]
    );
    return result.rowCount ? mapOAuthState(result.rows[0]) : null;
  }

  async findAccountByProviderUserId(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccountRecord | null> {
    const result = await this.pool.query(
      'select * from oauth_accounts where provider = $1 and provider_user_id = $2',
      [provider, providerUserId]
    );
    return result.rowCount ? mapOAuthAccount(result.rows[0]) : null;
  }

  async findAccountByUserIdAndProvider(userId: string, provider: OAuthProvider): Promise<OAuthAccountRecord | null> {
    const result = await this.pool.query('select * from oauth_accounts where user_id = $1 and provider = $2', [
      userId,
      provider
    ]);
    return result.rowCount ? mapOAuthAccount(result.rows[0]) : null;
  }

  async countAccountsForUser(userId: string): Promise<number> {
    const result = await this.pool.query('select count(*)::int as count from oauth_accounts where user_id = $1', [userId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async createAccount(input: Omit<OAuthAccountRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthAccountRecord> {
    const result = await this.pool.query(
      `insert into oauth_accounts (id, user_id, provider, provider_user_id, provider_login, provider_email)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        randomToken(16),
        input.userId,
        input.provider,
        input.providerUserId,
        input.providerLogin,
        input.providerEmail
      ]
    );
    return mapOAuthAccount(result.rows[0]);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.pool.query('delete from oauth_accounts where id = $1', [id]);
  }
}
