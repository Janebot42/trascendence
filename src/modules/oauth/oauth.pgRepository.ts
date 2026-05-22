import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { mapOAuthAccount, mapOAuthState } from '../../db/pgMappers.js';
import type { OAuthRepository } from './oauth.repository.js';
import type { OAuthAccountRecord, OAuthProvider, OAuthStateRecord } from './oauth.types.js';

export class PgOAuthRepository implements OAuthRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createState(input: Omit<OAuthStateRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<OAuthStateRecord> {
    const result = await this.pool.query(
      `insert into oauth_states (id, provider, state_token_hash, redirect_to, expires_at)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [randomToken(16), input.provider, input.stateTokenHash, input.redirectTo, input.expiresAt]
    );
    return mapOAuthState(result.rows[0]);
  }

  async findStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null> {
    const result = await this.pool.query('select * from oauth_states where state_token_hash = $1', [tokenHash]);
    return result.rowCount ? mapOAuthState(result.rows[0]) : null;
  }

  async consumeState(id: string): Promise<void> {
    await this.pool.query('update oauth_states set consumed_at = now() where id = $1 and consumed_at is null', [id]);
  }

  async findAccountByProviderUserId(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccountRecord | null> {
    const result = await this.pool.query(
      'select * from oauth_accounts where provider = $1 and provider_user_id = $2',
      [provider, providerUserId]
    );
    return result.rowCount ? mapOAuthAccount(result.rows[0]) : null;
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
}
