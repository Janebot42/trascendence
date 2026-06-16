import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../authorization/requireAuth.js';
import type { SessionsService } from '../sessions/sessions.service.js';
import type { ChatService } from './chat.service.js';

const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000)
});

export async function registerChatRoutes(app: FastifyInstance, sessionsService: SessionsService, chatService: ChatService) {
  app.post('/chat/messages', { preHandler: requireAuth(sessionsService) }, async (request) => {
    const body = postMessageSchema.parse(request.body);
    const message = await chatService.postLobbyMessage(request.currentUser!.id, body.body);
    return { message };
  });

  app.get('/chat/messages', { preHandler: requireAuth(sessionsService) }, async () => {
    const messages = await chatService.listLobbyMessages(50);
    return { messages };
  });
}
