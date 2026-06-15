import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

export function createPrismaClient(): PrismaClient | null {
  if (!env.DATABASE_URL || env.NODE_ENV === 'test') return null;
  return new PrismaClient();
}
