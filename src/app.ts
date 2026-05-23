import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { securityConfig } from './config/security.js';
import { createPgPool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { AppError } from './shared/errors/AppError.js';
import { SecretBox } from './shared/crypto/encryption.js';
import { ScryptPasswordHasher } from './shared/crypto/passwordHasher.js';
import { InMemoryUsersRepository } from './modules/users/users.repository.js';
import { PgUsersRepository } from './modules/users/users.pgRepository.js';
import { UsersService } from './modules/users/users.service.js';
import { InMemorySessionsRepository } from './modules/sessions/sessions.repository.js';
import { PgSessionsRepository } from './modules/sessions/sessions.pgRepository.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { InMemoryAuthRepository } from './modules/auth/auth.repository.js';
import { PgAuthRepository } from './modules/auth/auth.pgRepository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { InMemoryTwoFactorRepository } from './modules/two_factor/twoFactor.repository.js';
import { PgTwoFactorRepository } from './modules/two_factor/twoFactor.pgRepository.js';
import { TotpService } from './modules/two_factor/totp.service.js';
import { RecoveryCodesService } from './modules/two_factor/recoveryCodes.service.js';
import { TwoFactorService } from './modules/two_factor/twoFactor.service.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerTwoFactorRoutes } from './modules/two_factor/twoFactor.routes.js';
import { registerUserRoutes } from './modules/users/users.routes.js';
import { registerUiRoutes } from './ui/ui.routes.js';
import { InMemoryOAuthRepository } from './modules/oauth/oauth.repository.js';
import { PgOAuthRepository } from './modules/oauth/oauth.pgRepository.js';
import { OAuthService } from './modules/oauth/oauth.service.js';
import { registerOAuthRoutes } from './modules/oauth/oauth.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const rawBody = body.toString();
    if (!rawBody.trim()) {
      done(null, {});
      return;
    }

    try {
      done(null, JSON.parse(rawBody));
    } catch (error) {
      done(error as Error);
    }
  });

  await app.register(cookie);

  const pgPool = createPgPool();
  if (pgPool) {
    await runMigrations(pgPool);
    app.addHook('onClose', async () => {
      await pgPool.end();
    });
  }

  const usersRepository = pgPool ? new PgUsersRepository(pgPool) : new InMemoryUsersRepository();
  const usersService = new UsersService(usersRepository);
  const sessionsRepository = pgPool ? new PgSessionsRepository(pgPool) : new InMemorySessionsRepository();
  const authRepository = pgPool ? new PgAuthRepository(pgPool) : new InMemoryAuthRepository();
  const twoFactorRepository = pgPool ? new PgTwoFactorRepository(pgPool) : new InMemoryTwoFactorRepository();
  const oauthRepository = pgPool ? new PgOAuthRepository(pgPool) : new InMemoryOAuthRepository();
  const sessionsService = new SessionsService(sessionsRepository, usersService);
  const totpService = new TotpService(new SecretBox(securityConfig.totpEncryptionKeyBase64));
  const recoveryCodesService = new RecoveryCodesService(twoFactorRepository);
  const twoFactorService = new TwoFactorService(
    twoFactorRepository,
    usersService,
    totpService,
    recoveryCodesService
  );
  const authService = new AuthService(
    usersService,
    authRepository,
    new ScryptPasswordHasher(),
    sessionsService,
    twoFactorService
  );
  const oauthService = new OAuthService(oauthRepository, usersService, authService, authRepository);

  if (env.NODE_ENV === 'test') {
    app.decorate('testContext', {
      oauthRepository,
      usersService,
      authService,
      authRepository,
      twoFactorService,
      sessionsService
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid request body' });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  app.get('/health', async () => ({ ok: true }));
  await registerUiRoutes(app);
  await registerAuthRoutes(app, authService, sessionsService);
  await registerOAuthRoutes(app, oauthService, sessionsService);
  await registerTwoFactorRoutes(app, twoFactorService, sessionsService);
  await registerUserRoutes(app, sessionsService, usersService);

  return app;
}
