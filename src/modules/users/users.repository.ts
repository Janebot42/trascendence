import { conflict } from '../../shared/errors/httpErrors.js';
import { randomToken } from '../../shared/crypto/randomToken.js';
import type { CreateUserInput, User } from './users.types.js';

export interface UsersRepository {
  create(input: CreateUserInput): Promise<User>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
}

export class InMemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<string, User>();

  async create(input: CreateUserInput): Promise<User> {
    const normalizedUsername = input.username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username === normalizedUsername) throw conflict('Username already exists');
      if (input.email && user.email === input.email.toLowerCase()) throw conflict('Email already exists');
    }

    const now = new Date();
    const user: User = {
      id: randomToken(16),
      username: normalizedUsername,
      email: input.email?.toLowerCase() ?? null,
      displayName: input.displayName ?? null,
      role: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalizedUsername = username.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.username === normalizedUsername) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.email === normalizedEmail) ?? null;
  }

  async list(): Promise<User[]> {
    return [...this.users.values()];
  }
}
