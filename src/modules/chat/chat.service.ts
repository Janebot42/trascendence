import type { ChatRepository } from './chat.repository.js';
import type { ChatMessage } from './chat.types.js';

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

  async postLobbyMessage(authorUserId: string, body: string): Promise<ChatMessage> {
    return this.chatRepository.createLobbyMessage({ authorUserId, body: body.trim() });
  }

  async listLobbyMessages(limit: number): Promise<ChatMessage[]> {
    return this.chatRepository.listLobbyMessages(limit);
  }
}
