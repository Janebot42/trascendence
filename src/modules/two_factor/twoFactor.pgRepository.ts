import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { mapRecoveryCode, mapTotpRecord } from '../../db/pgMappers.js';
import type { RecoveryCodeRecord, TotpRecord } from './twoFactor.types.js';
import type { TwoFactorRepository } from './twoFactor.repository.js';

export class PgTwoFactorRepository implements TwoFactorRepository {
  constructor(private readonly pool: pg.Pool) {}

  async upsertPendingTotp(userId: string, secretEncrypted: string): Promise<TotpRecord> {
    const result = await this.pool.query(
      `insert into two_factor_totp
        (id, user_id, secret_encrypted, enabled_at, confirmed_at)
       values ($1, $2, $3, null, null)
       on conflict (user_id) do update set
         secret_encrypted = excluded.secret_encrypted,
         enabled_at = null,
         confirmed_at = null,
         updated_at = now()
       returning *`,
      [randomToken(16), userId, secretEncrypted]
    );
    return mapTotpRecord(result.rows[0]);
  }

  async findTotpByUserId(userId: string): Promise<TotpRecord | null> {
    const result = await this.pool.query('select * from two_factor_totp where user_id = $1', [userId]);
    return result.rowCount ? mapTotpRecord(result.rows[0]) : null;
  }

  async enableTotp(userId: string): Promise<void> {
    await this.pool.query(
      `update two_factor_totp
       set enabled_at = now(), confirmed_at = now(), updated_at = now()
       where user_id = $1`,
      [userId]
    );
  }

  async disableTotp(userId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from two_factor_totp where user_id = $1', [userId]);
      await client.query(
        `update recovery_codes
         set replaced_at = coalesce(replaced_at, now())
         where user_id = $1 and replaced_at is null`,
        [userId]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update recovery_codes
         set replaced_at = coalesce(replaced_at, now())
         where user_id = $1 and replaced_at is null`,
        [userId]
      );
      for (const codeHash of codeHashes) {
        await client.query(
          `insert into recovery_codes (id, user_id, code_hash)
           values ($1, $2, $3)`,
          [randomToken(16), userId, codeHash]
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listActiveRecoveryCodes(userId: string): Promise<RecoveryCodeRecord[]> {
    const result = await this.pool.query(
      `select * from recovery_codes
       where user_id = $1 and used_at is null and replaced_at is null`,
      [userId]
    );
    return result.rows.map(mapRecoveryCode);
  }

  async markRecoveryCodeUsed(id: string): Promise<void> {
    await this.pool.query(
      `update recovery_codes
       set used_at = coalesce(used_at, now())
       where id = $1`,
      [id]
    );
  }
}

