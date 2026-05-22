import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../authorization/requireAuth.js';
import { requireRole } from '../authorization/requireRole.js';
import type { SessionsService } from '../sessions/sessions.service.js';
import type { UsersService } from './users.service.js';

export async function registerUserRoutes(app: FastifyInstance, sessionsService: SessionsService, usersService: UsersService) {
  app.get('/me', { preHandler: requireAuth(sessionsService) }, async (request) => ({
    user: request.currentUser
  }));

  app.get(
    '/admin/users',
    { preHandler: [requireAuth(sessionsService), requireRole('admin')] },
    async () => ({ users: await usersService.listUsers() })
  );
}
