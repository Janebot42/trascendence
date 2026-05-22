import { env } from '../../config/env.js';
import { securityConfig } from '../../config/security.js';
import { hashToken } from '../../shared/crypto/hashToken.js';
import { randomToken } from '../../shared/crypto/randomToken.js';
import { badRequest, unauthorized } from '../../shared/errors/httpErrors.js';
import type { AuthService } from '../auth/auth.service.js';
import type { UsersService } from '../users/users.service.js';
import type { OAuthRepository } from './oauth.repository.js';
import type { FortyTwoProfile, OAuthCallbackResult } from './oauth.types.js';

export class OAuthService {
  constructor(
    private readonly oauthRepository: OAuthRepository,
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  async startFortyTwoLogin() {
    this.assertConfigured();

    const state = randomToken(24);
    await this.oauthRepository.createState({
      provider: '42',
      stateTokenHash: hashToken(state),
      redirectTo: null,
      expiresAt: new Date(Date.now() + securityConfig.oauthStateTtlMs)
    });

    const authorizeUrl = new URL(env.OAUTH_42_AUTHORIZE_URL!);
    authorizeUrl.searchParams.set('client_id', env.OAUTH_42_CLIENT_ID!);
    authorizeUrl.searchParams.set('redirect_uri', env.OAUTH_42_REDIRECT_URI!);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('state', state);
    return authorizeUrl.toString();
  }

  async completeFortyTwoCallback(input: {
    code?: string;
    state?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<OAuthCallbackResult> {
    this.assertConfigured();
    if (!input.code || !input.state) throw badRequest('Missing OAuth callback parameters');

    const stateRecord = await this.oauthRepository.findStateByTokenHash(hashToken(input.state));
    if (!stateRecord || stateRecord.consumedAt || stateRecord.expiresAt <= new Date()) {
      throw unauthorized('Invalid OAuth state');
    }
    await this.oauthRepository.consumeState(stateRecord.id);

    const accessToken = await this.exchangeCodeForAccessToken(input.code);
    const profile = await this.fetchFortyTwoProfile(accessToken);
    const user = await this.resolveLocalUser(profile);

    return this.authService.completeTrustedLogin({
      userId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
  }

  private async exchangeCodeForAccessToken(code: string): Promise<string> {
    const response = await fetch(env.OAUTH_42_TOKEN_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.OAUTH_42_CLIENT_ID!,
        client_secret: env.OAUTH_42_CLIENT_SECRET!,
        code,
        redirect_uri: env.OAUTH_42_REDIRECT_URI!
      })
    });

    if (!response.ok) throw unauthorized('OAuth token exchange failed');
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw unauthorized('OAuth token exchange failed');
    return data.access_token;
  }

  private async fetchFortyTwoProfile(accessToken: string): Promise<FortyTwoProfile> {
    const response = await fetch(env.OAUTH_42_ME_URL!, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) throw unauthorized('OAuth profile fetch failed');
    const data = (await response.json()) as FortyTwoProfile;
    if (!data.login || typeof data.id !== 'number') throw unauthorized('OAuth profile is incomplete');
    return data;
  }

  private async resolveLocalUser(profile: FortyTwoProfile) {
    const existingAccount = await this.oauthRepository.findAccountByProviderUserId('42', String(profile.id));
    if (existingAccount) {
      const user = await this.usersService.findById(existingAccount.userId);
      if (!user) throw unauthorized('OAuth account is linked to a missing user');
      return user;
    }

    const normalizedEmail = profile.email?.toLowerCase() ?? null;
    let user = normalizedEmail ? await this.usersService.findByEmail(normalizedEmail) : null;
    if (!user) {
      user = await this.usersService.createUser({
        username: profile.login,
        email: normalizedEmail,
        displayName: profile.displayname ?? null
      });
    }

    await this.oauthRepository.createAccount({
      userId: user.id,
      provider: '42',
      providerUserId: String(profile.id),
      providerLogin: profile.login,
      providerEmail: normalizedEmail
    });

    return user;
  }

  private assertConfigured(): void {
    if (
      !env.OAUTH_42_CLIENT_ID ||
      !env.OAUTH_42_CLIENT_SECRET ||
      !env.OAUTH_42_REDIRECT_URI ||
      !env.OAUTH_42_AUTHORIZE_URL ||
      !env.OAUTH_42_TOKEN_URL ||
      !env.OAUTH_42_ME_URL
    ) {
      throw badRequest('OAuth 42 is not configured');
    }
  }
}
