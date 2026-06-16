import type { PrismaClient } from '@prisma/client';
import { randomToken } from '../../shared/crypto/randomToken.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatMessage, CreateChatMessageInput } from './chat.types.js';

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createLobbyMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.create({
      data: {
        id: randomToken(16),
        authorUserId: input.authorUserId,
        body: input.body,
        scope: 'LOBBY'
      }
    });
    return {
      id: message.id,
      authorUserId: message.authorUserId,
      body: message.body,
      scope: 'lobby',
      createdAt: message.createdAt
    };
  }

  async listLobbyMessages(limit: number): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { scope: 'LOBBY' },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return messages.map((message) => ({
      id: message.id,
      authorUserId: message.authorUserId,
      body: message.body,
      scope: 'lobby',
      createdAt: message.createdAt
    }));
  }
}
