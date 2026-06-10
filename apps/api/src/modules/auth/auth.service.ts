import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { AppConfigService } from '../../common/config/app-config.service';

type Provider = 'google' | 'kakao' | 'naver';

interface Identity {
  id: string;
  provider: Provider;
  providerUserId: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionRecord {
  userId: string;
  refreshHash: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  revokedAt?: number;
}

@Injectable()
export class AuthService {
  private readonly identitiesByKey = new Map<string, Identity>();
  private readonly sessionsByRefreshHash = new Map<string, SessionRecord>();
  private readonly accessToRefreshHash = new Map<string, string>();
  private readonly accessTtlMs = 15 * 60 * 1000;
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly logger: SafeLogger,
    private readonly configService: AppConfigService,
  ) {}

  async socialLogin(input: SocialLoginDto) {
    const profile = await this.resolveSocialProfile(input);
    const key = `${profile.provider}:${profile.providerUserId}`;
    const nowIso = new Date().toISOString();
    const found = this.identitiesByKey.get(key);
    const identity: Identity = found
      ? { ...found, email: profile.email, name: profile.name ?? found.name, updatedAt: nowIso }
      : {
          id: `user_${randomBytes(12).toString('hex')}`,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          name: profile.name,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
    this.identitiesByKey.set(key, identity);

    return this.issueTokens(identity.id);
  }

  refresh(refreshToken: string) {
    const refreshHash = this.hashToken(refreshToken);
    const session = this.sessionsByRefreshHash.get(refreshHash);
    if (!session || session.revokedAt || session.refreshExpiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.revokeByRefreshHash(refreshHash);
    return this.issueTokens(session.userId);
  }

  logout(refreshToken?: string, accessToken?: string) {
    if (refreshToken) {
      this.revokeByRefreshHash(this.hashToken(refreshToken));
    }
    if (accessToken) {
      const refreshHash = this.accessToRefreshHash.get(accessToken);
      if (refreshHash) {
        this.revokeByRefreshHash(refreshHash);
      }
    }
  }

  getMe(accessToken: string) {
    const refreshHash = this.accessToRefreshHash.get(accessToken);
    if (!refreshHash) {
      throw new UnauthorizedException('Invalid access token');
    }
    const session = this.sessionsByRefreshHash.get(refreshHash);
    if (!session || session.revokedAt || session.accessExpiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid access token');
    }

    const identity = [...this.identitiesByKey.values()].find((item) => item.id === session.userId);
    if (!identity) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: identity.id,
      email: identity.email,
      name: identity.name ?? null,
      provider: identity.provider,
    };
  }

  private issueTokens(userId: string) {
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const refreshHash = this.hashToken(refreshToken);
    const now = Date.now();
    const session: SessionRecord = {
      userId,
      refreshHash,
      accessToken,
      accessExpiresAt: now + this.accessTtlMs,
      refreshExpiresAt: now + this.refreshTtlMs,
    };

    this.sessionsByRefreshHash.set(refreshHash, session);
    this.accessToRefreshHash.set(accessToken, refreshHash);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.floor(this.accessTtlMs / 1000),
      userId,
    };
  }

  private revokeByRefreshHash(refreshHash: string) {
    const session = this.sessionsByRefreshHash.get(refreshHash);
    if (!session) {
      return;
    }
    session.revokedAt = Date.now();
    this.sessionsByRefreshHash.set(refreshHash, session);
    this.accessToRefreshHash.delete(session.accessToken);
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
      const email = payload.kakao_account?.email ?? '';
      if (!providerUserId || !email) {
        throw new UnauthorizedException('Invalid Kakao token payload.');
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

  private randomToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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
