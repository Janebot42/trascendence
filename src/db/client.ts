import pg from 'pg';
import { env } from '../config/env.js';

export function createPgPool(): pg.Pool | null {
  if (!env.DATABASE_URL || env.NODE_ENV === 'test') return null;

  return new pg.Pool({
    connectionString: env.DATABASE_URL
  });
}

