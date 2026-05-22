import { randomToken } from '../../shared/crypto/randomToken.js';
import type { OAuthAccountRecord, OAuthProvider, OAuthStateRecord } from './oauth.types.js';

export interface OAuthRepository {
  createState(input: Omit<OAuthStateRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<OAuthStateRecord>;
  consumeStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null>;
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

  async consumeStateByTokenHash(tokenHash: string): Promise<OAuthStateRecord | null> {
    const state = [...this.states.values()].find((candidate) => candidate.stateTokenHash === tokenHash) ?? null;
    if (!state || state.consumedAt) return null;
    state.consumedAt = new Date();
    return state;
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
