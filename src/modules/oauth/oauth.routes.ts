import type { FastifyInstance } from 'fastify';
import { setSessionCookie } from '../../shared/http/cookies.js';
import type { OAuthService } from './oauth.service.js';

function getUserAgent(header: string | string[] | undefined): string | null {
  if (!header) return null;
  return Array.isArray(header) ? header.join(', ') : header;
}

function toPublicResult(result: Awaited<ReturnType<OAuthService['completeFortyTwoCallback']>>) {
  if (result.status === 'requires_2fa') return result;
  return {
    status: result.status,
    user: result.user,
    sessionExpiresAt: result.sessionExpiresAt
  };
}

export async function registerOAuthRoutes(app: FastifyInstance, oauthService: OAuthService) {
  app.get('/auth/oauth/42', async (_request, reply) => {
    const location = await oauthService.startFortyTwoLogin();
    return reply.redirect(location);
  });

  app.get('/auth/oauth/42/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const result = await oauthService.completeFortyTwoCallback({
      code: query.code,
      state: query.state,
      ipAddress: request.ip,
      userAgent: getUserAgent(request.headers['user-agent'])
    });

    if (result.status === 'authenticated') {
      setSessionCookie(reply, result.sessionToken, result.sessionExpiresAt);
    }
    return toPublicResult(result);
  });
}
