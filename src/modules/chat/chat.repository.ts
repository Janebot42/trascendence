import { randomToken } from '../../shared/crypto/randomToken.js';
import type { ChatMessage, CreateChatMessageInput } from './chat.types.js';

export interface ChatRepository {
  createLobbyMessage(input: CreateChatMessageInput): Promise<ChatMessage>;
  listLobbyMessages(limit: number): Promise<ChatMessage[]>;
}

export class InMemoryChatRepository implements ChatRepository {
  private readonly messages: ChatMessage[] = [];

  async createLobbyMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: randomToken(16),
      authorUserId: input.authorUserId,
      body: input.body,
      scope: 'lobby',
      createdAt: new Date()
    };
    this.messages.push(message);
    return message;
  }

  async listLobbyMessages(limit: number): Promise<ChatMessage[]> {
    return [...this.messages].reverse().slice(0, limit);
  }
}
