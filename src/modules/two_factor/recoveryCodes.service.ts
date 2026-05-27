import { hashToken } from '../../shared/crypto/hashToken.js';
import { randomToken } from '../../shared/crypto/randomToken.js';
import type { TwoFactorRepository } from './twoFactor.repository.js';

export class RecoveryCodesService {
  constructor(private readonly twoFactorRepository: TwoFactorRepository) {}

  async generateForUser(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 10 }, () => randomToken(9));
    await this.twoFactorRepository.replaceRecoveryCodes(userId, codes.map(hashToken));
    return codes;
  }

  async consume(userId: string, code: string): Promise<boolean> {
    const codeHash = hashToken(code.trim());
    return Boolean(await this.twoFactorRepository.consumeRecoveryCode(userId, codeHash));
  }
}
