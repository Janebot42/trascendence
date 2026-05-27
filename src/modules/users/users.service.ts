import type { CreateUserInput, User } from './users.types.js';
import type { UsersRepository } from './users.repository.js';

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  createUser(input: CreateUserInput): Promise<User> {
    return this.usersRepository.create(input);
  }

  deleteUser(id: string): Promise<void> {
    return this.usersRepository.delete(id);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  listUsers(): Promise<User[]> {
    return this.usersRepository.list();
  }
}
