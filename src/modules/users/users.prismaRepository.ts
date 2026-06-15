import { Prisma, type PrismaClient } from '@prisma/client';
import { mapUser } from '../../db/prismaMappers.js';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { conflict } from '../../shared/errors/httpErrors.js';
import type { UsersRepository } from './users.repository.js';
import type { CreateUserInput, User } from './users.types.js';

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          id: randomToken(16),
          username: input.username.trim().toLowerCase(),
          email: input.email?.trim().toLowerCase() ?? null,
          displayName: input.displayName ?? null
        }
      });
      return mapUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('User already exists');
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
    return user ? mapUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    return user ? mapUser(user) : null;
  }

  async list(): Promise<User[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(mapUser);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
