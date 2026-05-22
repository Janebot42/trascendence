import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  COOKIE_SECURE: booleanFromEnv,
  SESSION_COOKIE_NAME: z.string().default('sid'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  TOTP_ISSUER: z.string().default('Transcendence'),
  TOTP_ENCRYPTION_KEY_BASE64: z.string().min(1),
  DATABASE_URL: z.string().url().optional()
});

export const env = envSchema.parse(process.env);
