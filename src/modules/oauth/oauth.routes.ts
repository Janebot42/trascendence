import type { FastifyInstance } from 'fastify';
import { clearOAuthStateCookie, setOAuthStateCookie, setSessionCookie } from '../../shared/http/cookies.js';
import { securityConfig } from '../../config/security.js';
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
    const { authorizationUrl, state } = await oauthService.startFortyTwoLogin();
    setOAuthStateCookie(reply, state);
    return reply.redirect(authorizationUrl);
  });

  app.get('/auth/oauth/42/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string };

    try {
      const result = await oauthService.completeFortyTwoCallback({
        code: query.code,
        state: query.state,
        browserState: request.cookies[securityConfig.oauthCookieName] ?? null,
        ipAddress: request.ip,
        userAgent: getUserAgent(request.headers['user-agent'])
      });

      clearOAuthStateCookie(reply);
      if (result.status === 'authenticated') {
        setSessionCookie(reply, result.sessionToken, result.sessionExpiresAt);
      }
      return toPublicResult(result);
    } catch (error) {
      clearOAuthStateCookie(reply);
      throw error;
    }
  });
}
