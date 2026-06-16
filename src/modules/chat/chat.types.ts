export type ChatMessageScope = 'lobby';

export type ChatMessage = {
  id: string;
  authorUserId: string;
  body: string;
  scope: ChatMessageScope;
  createdAt: Date;
};

export type CreateChatMessageInput = {
  authorUserId: string;
  body: string;
};
