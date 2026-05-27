import type { FastifyRequest } from 'fastify';
import { forbidden } from '../errors/httpErrors.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertSameOriginForUnsafeRequest(request: FastifyRequest): void {
  if (safeMethods.has(request.method)) return;

  const origin = request.headers.origin;
  if (!origin) return;

  const hostHeader = request.headers['x-forwarded-host'] ?? request.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) throw forbidden('Invalid request origin', 'CSRF_ORIGIN_MISMATCH');

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Invalid request origin', 'CSRF_ORIGIN_MISMATCH');
  }

  if (originHost !== host) {
    throw forbidden('Invalid request origin', 'CSRF_ORIGIN_MISMATCH');
  }
}
