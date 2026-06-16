import { badRequest } from '../../shared/errors/httpErrors.js';
import type { UsersService } from '../users/users.service.js';
import type { MatchesRepository } from './matches.repository.js';
import type { CreateFinishedMatchInput, Match } from './matches.types.js';

export class MatchesService {
  constructor(private readonly matchesRepository: MatchesRepository, private readonly usersService: UsersService) {}

  async createFinishedMatch(input: CreateFinishedMatchInput): Promise<Match> {
    const uniquePlayers = new Set(input.players.map((player) => player.userId));
    if (input.players.length < 2 || uniquePlayers.size !== input.players.length) {
      throw badRequest('A finished match requires at least two different players', 'VALIDATION_ERROR');
    }

    for (const player of input.players) {
      const user = await this.usersService.findById(player.userId);
      if (!user) throw badRequest('Unknown match player', 'VALIDATION_ERROR');
    }

    return this.matchesRepository.createFinished(input);
  }

  async listUserMatches(userId: string, limit: number): Promise<Match[]> {
    return this.matchesRepository.listByUser(userId, limit);
  }
}
