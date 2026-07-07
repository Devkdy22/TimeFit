import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { AppConfigService } from '../../common/config/app-config.service';

type Provider = 'google' | 'kakao' | 'naver';

type AuthUserRow = {
  id: string;
  email: string;
  name: string | null;
};

type AuthIdentityRow = {
  id: string;
  provider: string;
  providerUserId: string;
  email: string;
  name: string | null;
  userId: string;
  user: AuthUserRow;
};

type AuthSessionRow = {
  id: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  revokedAt: Date | null;
  user: AuthUserRow;
};

type OAuthStateRow = {
  id: string;
  provider: string;
  stateHash: string;
  returnTo: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

type OAuthLoginTicketRow = {
  id: string;
  ticketHash: string;
  userId: string;
  sessionId: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
};

type AuthDbClient = {
  $transaction<T>(fn: (tx: AuthDbClient) => Promise<T>): Promise<T>;
  user: {
    findUnique(args: {
      where: { email: string };
    }): Promise<AuthUserRow | null>;
    create(args: {
      data: { email: string; name?: string };
    }): Promise<AuthUserRow>;
    update(args: {
      where: { id: string };
      data: { email: string; name?: string };
    }): Promise<AuthUserRow>;
  };
  authIdentity: {
    findUnique(args: {
      where: { provider_providerUserId: { provider: string; providerUserId: string } };
      include: { user: true };
    }): Promise<AuthIdentityRow | null>;
    create(args: {
      data: {
        userId: string;
        provider: string;
        providerUserId: string;
        email: string;
        name?: string;
      };
      include: { user: true };
    }): Promise<AuthIdentityRow>;
    update(args: {
      where: { id: string };
      data: { email: string; name?: string };
      include: { user: true };
    }): Promise<AuthIdentityRow>;
  };
  authSession: {
    create(args: {
      data: {
        userId: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        accessExpiresAt: Date;
        refreshExpiresAt: Date;
      };
    }): Promise<{ id: string }>;
    findUnique(args: {
      where: { refreshTokenHash?: string; accessTokenHash?: string };
      include: { user: true };
    }): Promise<AuthSessionRow | null>;
    update(args: {
      where: { id: string };
      data: { revokedAt: Date };
    }): Promise<{ id: string }>;
    updateMany(args: {
      where: {
        refreshTokenHash: string;
        revokedAt: null;
        refreshExpiresAt: { gt: Date };
      };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
  oAuthState: {
    create(args: {
      data: {
        provider: string;
        stateHash: string;
        returnTo: string;
        expiresAt: Date;
      };
    }): Promise<{ id: string }>;
    findUnique(args: {
      where: { stateHash: string };
    }): Promise<OAuthStateRow | null>;
    update(args: {
      where: { id: string };
      data: { consumedAt: Date };
    }): Promise<{ id: string }>;
  };
  oAuthLoginTicket: {
    create(args: {
      data: {
        ticketHash: string;
        userId: string;
        expiresAt: Date;
      };
    }): Promise<{ id: string }>;
    findUnique(args: {
      where: { ticketHash: string };
    }): Promise<OAuthLoginTicketRow | null>;
    update(args: {
      where: { id: string };
      data: { consumedAt: Date; sessionId?: string };
    }): Promise<{ id: string }>;
  };
};

@Injectable()
export class AuthService {
  private prisma: AuthDbClient | null = null;
  private readonly accessTtlMs = 15 * 60 * 1000;
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;
  private readonly oauthStateTtlMs = 10 * 60 * 1000;
  private readonly loginTicketTtlMs = 3 * 60 * 1000;

  constructor(
    private readonly logger: SafeLogger,
    private readonly configService: AppConfigService,
  ) {}

  async socialLogin(input: SocialLoginDto) {
    const profile = await this.resolveSocialProfile(input);
    const userId = await this.findOrCreateIdentityUserId(profile);
    return this.issueTokens(userId);
  }

  async startOAuth(provider: Provider, returnTo: string) {
    this.assertSupportedProvider(provider);
    this.assertAllowedReturnTo(returnTo);

    const state = this.randomToken();
    const redirectUri = this.providerCallbackUrl(provider);
    const authorizeUrl = this.providerAuthorizeUrl(provider, redirectUri, state);
    this.logKakaoOAuthEvent(provider, {
      event: 'kakao.oauth.start_authorize_url_created',
      redirectUri,
      returnTo,
    });
    const prisma = await this.getPrismaClient();
    await prisma.oAuthState.create({
      data: {
        provider,
        stateHash: this.hashToken(state),
        returnTo,
        expiresAt: new Date(Date.now() + this.oauthStateTtlMs),
      },
    });

    return authorizeUrl;
  }

  async completeOAuthCallback(provider: Provider, input: { code?: string; state?: string; error?: string }) {
    this.assertSupportedProvider(provider);
    this.logKakaoOAuthEvent(provider, {
      event: 'kakao.oauth.callback_received',
      hasCode: Boolean(input.code),
      hasState: Boolean(input.state),
      hasProviderError: Boolean(input.error),
    });
    if (input.error) {
      this.logKakaoOAuthEvent(provider, {
        event: 'kakao.oauth.callback_provider_error',
        redirectTo: 'timefit://auth',
      });
      return this.oauthFailureReturnTo('timefit://auth', provider, 'provider_error');
    }
    if (!input.code || !input.state) {
      this.logKakaoOAuthEvent(provider, {
        event: 'kakao.oauth.callback_missing_code_or_state',
        redirectTo: 'timefit://auth',
      });
      return this.oauthFailureReturnTo('timefit://auth', provider, 'missing_code_or_state');
    }

    let returnTo = 'timefit://auth';
    try {
      const state = await this.consumeOAuthState(provider, input.state);
      returnTo = state.returnTo;
      this.logKakaoOAuthEvent(provider, {
        event: 'kakao.oauth.callback_state_consumed',
        returnTo,
        tokenRedirectUri: this.providerCallbackUrl(provider),
      });
      const profile = await this.resolveSocialProfile({
        provider,
        authorizationCode: input.code,
        redirectUri: this.providerCallbackUrl(provider),
        state: input.state,
      });
      const userId = await this.findOrCreateIdentityUserId(profile);
      const ticket = await this.createLoginTicket(userId);
      const appRedirectUrl = this.withQuery(returnTo, { ticket, state: input.state, provider });
      this.logKakaoOAuthEvent(provider, {
        event: 'kakao.oauth.callback_app_redirect_created',
        redirectBase: returnTo,
        hasTicket: true,
        hasState: true,
      });
      return appRedirectUrl;
    } catch (error) {
      this.logKakaoOAuthEvent(provider, {
        event: 'kakao.oauth.callback_failed',
        returnTo,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return this.oauthFailureReturnTo(returnTo, provider, 'oauth_failed');
    }
  }

  async redeemLoginTicket(ticket: string) {
    if (!ticket) {
      throw new UnauthorizedException('Login ticket is required.');
    }
    const ticketHash = this.hashToken(ticket);
    const prisma = await this.getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const row = await tx.oAuthLoginTicket.findUnique({
        where: { ticketHash },
      });
      if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Invalid login ticket.');
      }
      const tokens = await this.issueTokens(row.userId, tx);
      const session = await tx.authSession.findUnique({
        where: { refreshTokenHash: this.hashToken(tokens.refreshToken) },
        include: { user: true },
      });
      await tx.oAuthLoginTicket.update({
        where: { id: row.id },
        data: {
          consumedAt: new Date(),
          sessionId: session?.id,
        },
      });
      return tokens;
    });
  }

  private async findOrCreateIdentityUserId(profile: {
    provider: Provider;
    providerUserId: string;
    email: string;
    name?: string;
  }) {
    const prisma = await this.getPrismaClient();
    const found = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    const identity = found
      ? await prisma.authIdentity.update({
          where: { id: found.id },
          data: {
            email: profile.email,
            name: profile.name ?? found.name ?? undefined,
          },
          include: { user: true },
        })
      : await this.createIdentity(profile);

    await prisma.user.update({
      where: { id: identity.userId },
      data: {
        email: profile.email,
        name: profile.name ?? identity.user.name ?? undefined,
      },
    });

    return identity.userId;
  }

  async refresh(refreshToken: string) {
    const refreshHash = this.hashToken(refreshToken);
    const prisma = await this.getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { refreshTokenHash: refreshHash },
        include: { user: true },
      });
      if (!session || session.revokedAt || session.refreshExpiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const revoked = await tx.authSession.updateMany({
        where: {
          refreshTokenHash: refreshHash,
          revokedAt: null,
          refreshExpiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.issueTokens(session.userId, tx);
    });
  }

  async logout(refreshToken?: string, accessToken?: string) {
    if (refreshToken) {
      await this.revokeByRefreshHash(this.hashToken(refreshToken));
    }
    if (accessToken) {
      await this.revokeByAccessHash(this.hashToken(accessToken));
    }
  }

  async getMe(accessToken: string) {
    const prisma = await this.getPrismaClient();
    const session = await prisma.authSession.findUnique({
      where: { accessTokenHash: this.hashToken(accessToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.accessExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      provider: null,
    };
  }

  private async issueTokens(userId: string, client?: AuthDbClient) {
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const now = Date.now();
    const prisma = client ?? (await this.getPrismaClient());
    await prisma.authSession.create({
      data: {
        userId,
        accessTokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        accessExpiresAt: new Date(now + this.accessTtlMs),
        refreshExpiresAt: new Date(now + this.refreshTtlMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.floor(this.accessTtlMs / 1000),
      userId,
    };
  }

  private async revokeByRefreshHash(refreshHash: string) {
    const prisma = await this.getPrismaClient();
    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: refreshHash },
      include: { user: true },
    });
    if (!session) {
      return;
    }
    await this.revokeSession(session.id);
  }

  private async revokeByAccessHash(accessHash: string) {
    const prisma = await this.getPrismaClient();
    const session = await prisma.authSession.findUnique({
      where: { accessTokenHash: accessHash },
      include: { user: true },
    });
    if (!session) {
      return;
    }
    await this.revokeSession(session.id);
  }

  private async revokeSession(id: string, client?: AuthDbClient) {
    const prisma = client ?? (await this.getPrismaClient());
    await prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  private async createIdentity(profile: {
    provider: Provider;
    providerUserId: string;
    email: string;
    name?: string;
  }) {
    const prisma = await this.getPrismaClient();
    const user =
      (await prisma.user.findUnique({ where: { email: profile.email } })) ??
      (await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
        },
      }));
    return prisma.authIdentity.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
      },
      include: { user: true },
    });
  }

  private async resolveSocialProfile(input: SocialLoginDto) {
    if (input.provider === 'google') {
      const idToken =
        input.idToken ??
        (await this.exchangeGoogleAuthorizationCode(input.authorizationCode, input.redirectUri));
      const payload = await this.fetchJson<{
        sub?: string;
        email?: string;
        name?: string;
        email_verified?: string | boolean;
        aud?: string;
      }>(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);

      const aud = payload.aud ?? '';
      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';
      if (!payload.sub || !payload.email || !emailVerified) {
        throw new UnauthorizedException('Invalid Google token payload.');
      }
      if (aud !== this.configService.googleClientId) {
        throw new UnauthorizedException('Google token audience mismatch.');
      }
      return {
        provider: 'google' as const,
        providerUserId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    }

    if (input.provider === 'kakao') {
      const accessToken =
        input.accessToken ??
        (await this.exchangeKakaoAuthorizationCode(input.authorizationCode, input.redirectUri));
      const payload = await this.fetchJson<{
        id?: number;
        kakao_account?: { email?: string; profile?: { nickname?: string } };
      }>('https://kapi.kakao.com/v2/user/me', {
        Authorization: `Bearer ${accessToken}`,
      });

      const providerUserId = payload.id ? String(payload.id) : '';
      if (!providerUserId) {
        throw new UnauthorizedException('Invalid Kakao token payload.');
      }
      const email = payload.kakao_account?.email?.trim() || this.kakaoInternalEmail(providerUserId);
      if (!payload.kakao_account?.email?.trim()) {
        this.logKakaoOAuthEvent('kakao', {
          event: 'kakao.oauth.profile_email_missing',
          fallbackEmailDomain: 'timefit.local',
        });
      }
      return {
        provider: 'kakao' as const,
        providerUserId,
        email,
        name: payload.kakao_account?.profile?.nickname,
      };
    }

    const accessToken =
      input.accessToken ??
      (await this.exchangeNaverAuthorizationCode(
        input.authorizationCode,
        input.redirectUri,
        input.state,
      ));
    const payload = await this.fetchJson<{
      resultcode?: string;
      response?: { id?: string; email?: string; name?: string; nickname?: string };
    }>('https://openapi.naver.com/v1/nid/me', {
      Authorization: `Bearer ${accessToken}`,
    });

    if (payload.resultcode !== '00') {
      throw new UnauthorizedException('Invalid Naver token payload.');
    }
    const providerUserId = payload.response?.id ?? '';
    const email = payload.response?.email ?? '';
    if (!providerUserId || !email) {
      throw new UnauthorizedException('Invalid Naver token payload.');
    }
    return {
      provider: 'naver' as const,
      providerUserId,
      email,
      name: payload.response?.name ?? payload.response?.nickname,
    };
  }

  private async exchangeKakaoAuthorizationCode(code?: string, redirectUri?: string) {
    if (!code || !redirectUri) {
      throw new UnauthorizedException('Kakao authorization code and redirectUri are required.');
    }
    if (!this.configService.kakaoRestApiKey || !this.configService.kakaoClientSecret) {
      throw new UnauthorizedException('Kakao OAuth is not configured.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.configService.kakaoRestApiKey,
      redirect_uri: redirectUri,
      code,
      client_secret: this.configService.kakaoClientSecret,
    });
    const payload = await this.fetchJson<{ access_token?: string }>(
      'https://kauth.kakao.com/oauth/token',
      {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      'POST',
      body.toString(),
    );
    const accessToken = payload.access_token ?? '';
    if (!accessToken) {
      throw new UnauthorizedException('Kakao token exchange failed.');
    }
    return accessToken;
  }

  private async exchangeGoogleAuthorizationCode(code?: string, redirectUri?: string) {
    if (!code || !redirectUri) {
      throw new UnauthorizedException('Google authorization code and redirectUri are required.');
    }
    if (!this.configService.googleClientId || !this.configService.googleClientSecret) {
      throw new UnauthorizedException('Google OAuth is not configured.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.configService.googleClientId,
      client_secret: this.configService.googleClientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const payload = await this.fetchJson<{ id_token?: string }>(
      'https://oauth2.googleapis.com/token',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      'POST',
      body.toString(),
    );

    const idToken = payload.id_token ?? '';
    if (!idToken) {
      throw new UnauthorizedException('Google token exchange failed.');
    }
    return idToken;
  }

  private async exchangeNaverAuthorizationCode(code?: string, redirectUri?: string, state?: string) {
    if (!code || !redirectUri || !state) {
      throw new UnauthorizedException(
        'Naver authorization code, redirectUri, and state are required.',
      );
    }
    if (!this.configService.naverClientId || !this.configService.naverClientSecret) {
      throw new UnauthorizedException('Naver OAuth is not configured.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.configService.naverClientId,
      client_secret: this.configService.naverClientSecret,
      code,
      state,
      redirect_uri: redirectUri,
    });

    const payload = await this.fetchJson<{ access_token?: string }>(
      `https://nid.naver.com/oauth2.0/token?${params.toString()}`,
      undefined,
      'POST',
    );
    const accessToken = payload.access_token ?? '';
    if (!accessToken) {
      throw new UnauthorizedException('Naver token exchange failed.');
    }
    return accessToken;
  }

  private assertSupportedProvider(provider: string): asserts provider is Provider {
    if (provider !== 'google' && provider !== 'kakao' && provider !== 'naver') {
      throw new BadRequestException('Unsupported OAuth provider.');
    }
  }

  private assertAllowedReturnTo(returnTo: string) {
    if (!this.allowedReturnToSet().has(returnTo)) {
      throw new BadRequestException('Unsupported OAuth returnTo.');
    }
  }

  private allowedReturnToSet() {
    const raw = String(this.configService.oauthReturnToAllowlist ?? 'timefit://auth');
    return new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  private publicApiBaseUrl() {
    return (this.configService.publicApiBaseUrl ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  private providerCallbackUrl(provider: Provider) {
    return `${this.publicApiBaseUrl()}/auth/${provider}/callback`;
  }

  private providerAuthorizeUrl(provider: Provider, redirectUri: string, state: string) {
    if (provider === 'google') {
      if (!this.configService.googleClientId) {
        throw new UnauthorizedException('Google OAuth is not configured.');
      }
      return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: this.configService.googleClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        access_type: 'offline',
        state,
      }).toString()}`;
    }

    if (provider === 'kakao') {
      if (!this.configService.kakaoRestApiKey) {
        throw new UnauthorizedException('Kakao OAuth is not configured.');
      }
      return `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
        client_id: this.configService.kakaoRestApiKey,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
      }).toString()}`;
    }

    if (!this.configService.naverClientId) {
      throw new UnauthorizedException('Naver OAuth is not configured.');
    }
    return `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: this.configService.naverClientId,
      redirect_uri: redirectUri,
      state,
    }).toString()}`;
  }

  private async consumeOAuthState(provider: Provider, state: string) {
    const prisma = await this.getPrismaClient();
    return prisma.$transaction(async (tx) => {
      const row = await tx.oAuthState.findUnique({
        where: { stateHash: this.hashToken(state) },
      });
      if (
        !row ||
        row.provider !== provider ||
        row.consumedAt ||
        row.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Invalid OAuth state.');
      }
      await tx.oAuthState.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      return row;
    });
  }

  private async createLoginTicket(userId: string) {
    const ticket = this.randomToken();
    const prisma = await this.getPrismaClient();
    await prisma.oAuthLoginTicket.create({
      data: {
        userId,
        ticketHash: this.hashToken(ticket),
        expiresAt: new Date(Date.now() + this.loginTicketTtlMs),
      },
    });
    return ticket;
  }

  private oauthFailureReturnTo(returnTo: string, provider: Provider, error: string) {
    const safeReturnTo = this.allowedReturnToSet().has(returnTo) ? returnTo : 'timefit://auth';
    return this.withQuery(safeReturnTo, { error, provider });
  }

  private withQuery(baseUrl: string, params: Record<string, string>) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private logKakaoOAuthEvent(provider: Provider, payload: Record<string, unknown>) {
    if (provider !== 'kakao') {
      return;
    }
    const logger = this.logger as { log?: (message: unknown, context?: string) => void };
    logger.log?.(payload, AuthService.name);
  }

  private kakaoInternalEmail(providerUserId: string) {
    return `kakao_${encodeURIComponent(providerUserId)}@timefit.local`;
  }

  private randomToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async getPrismaClient(): Promise<AuthDbClient> {
    if (this.prisma) {
      return this.prisma;
    }

    const globalForPrisma = globalThis as unknown as { prisma?: AuthDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => AuthDbClient;
    };

    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = this.prisma;
    }

    return this.prisma;
  }

  private async fetchJson<T>(
    url: string,
    headers?: Record<string, string>,
    method: 'GET' | 'POST' = 'GET',
    body?: string,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(headers ?? {}),
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new UnauthorizedException(`Provider token verification failed (${response.status}).`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Provider verification request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}
