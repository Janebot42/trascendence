import type pg from 'pg';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { conflict } from '../../shared/errors/httpErrors.js';
import { mapUser } from '../../db/pgMappers.js';
import type { CreateUserInput, User } from './users.types.js';
import type { UsersRepository } from './users.repository.js';

export class PgUsersRepository implements UsersRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(input: CreateUserInput): Promise<User> {
    const id = randomToken(16);
    const username = input.username.trim().toLowerCase();
    const email = input.email?.toLowerCase() ?? null;

    try {
      const result = await this.pool.query(
        `insert into users (id, username, email, display_name)
         values ($1, $2, $3, $4)
         returning *`,
        [id, username, email, input.displayName ?? null]
      );
      return mapUser(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('User already exists');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('delete from users where id = $1', [id]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query('select * from users where id = $1', [id]);
    return result.rowCount ? mapUser(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query('select * from users where username = $1', [
      username.trim().toLowerCase()
    ]);
    return result.rowCount ? mapUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query('select * from users where email = $1', [email.trim().toLowerCase()]);
    return result.rowCount ? mapUser(result.rows[0]) : null;
  }

  async list(): Promise<User[]> {
    const result = await this.pool.query('select * from users order by created_at desc');
    return result.rows.map(mapUser);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
