import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const migration = await readFile(join(process.cwd(), 'db', 'migrations', '001_auth_base.sql'), 'utf8');
  await pool.query(migration);
}

