import { randomToken } from '../../shared/crypto/randomToken.js';
import type { OAuthAccountRecord, OAuthProvider, OAuthStateRecord } from './oauth.types.js';

export interface OAuthRepository {
  createState(input: Omit<OAuthStateRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<OAuthStateRecord>;
  findStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null>;
  consumeState(id: string): Promise<void>;
  findAccountByProviderUserId(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccountRecord | null>;
  createAccount(input: Omit<OAuthAccountRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthAccountRecord>;
}

export class InMemoryOAuthRepository implements OAuthRepository {
  private readonly states = new Map<string, OAuthStateRecord>();
  private readonly accounts = new Map<string, OAuthAccountRecord>();

  async createState(input: Omit<OAuthStateRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<OAuthStateRecord> {
    const record: OAuthStateRecord = {
      ...input,
      id: randomToken(16),
      createdAt: new Date(),
      consumedAt: null
    };
    this.states.set(record.id, record);
    return record;
  }

  async findStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null> {
    return [...this.states.values()].find((state) => state.stateTokenHash === tokenHash) ?? null;
  }

  async consumeState(id: string): Promise<void> {
    const state = this.states.get(id);
    if (state && !state.consumedAt) state.consumedAt = new Date();
  }

  async findAccountByProviderUserId(provider: OAuthProvider, providerUserId: string): Promise<OAuthAccountRecord | null> {
    return (
      [...this.accounts.values()].find(
        (account) => account.provider === provider && account.providerUserId === providerUserId
      ) ?? null
    );
  }

  async createAccount(input: Omit<OAuthAccountRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthAccountRecord> {
    const now = new Date();
    const record: OAuthAccountRecord = {
      ...input,
      id: randomToken(16),
      createdAt: now,
      updatedAt: now
    };
    this.accounts.set(record.id, record);
    return record;
  }
}
