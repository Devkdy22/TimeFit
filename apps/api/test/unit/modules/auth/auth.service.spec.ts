import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../../../src/modules/auth/auth.service';

function createAuthDb() {
  const users = new Map<string, { id: string; email: string; name: string | null }>();
  const identities = new Map<
    string,
    {
      id: string;
      userId: string;
      provider: string;
      providerUserId: string;
      email: string;
      name: string | null;
    }
  >();
  const sessions = new Map<
    string,
    {
      id: string;
      userId: string;
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
      revokedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  const oauthStates = new Map<
    string,
    {
      id: string;
      provider: string;
      stateHash: string;
      returnTo: string;
      expiresAt: Date;
      consumedAt: Date | null;
      createdAt: Date;
    }
  >();
  const loginTickets = new Map<
    string,
    {
      id: string;
      ticketHash: string;
      userId: string;
      sessionId: string | null;
      expiresAt: Date;
      consumedAt: Date | null;
      createdAt: Date;
    }
  >();
  let userSeq = 0;
  let identitySeq = 0;
  let sessionSeq = 0;
  let oauthStateSeq = 0;
  let loginTicketSeq = 0;

  const withUser = <T extends { userId: string }>(row: T) => ({
    ...row,
    user: users.get(row.userId),
  });

  const db = {
    users,
    sessions,
    oauthStates,
    loginTickets,
    client: {} as Record<string, unknown>,
  };

  db.client = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db.client)),
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) =>
        [...users.values()].find((user) => user.email === where.email) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: { email: string; name?: string } }) => {
        const row = {
          id: `user-${++userSeq}`,
          email: data.email,
          name: data.name ?? null,
        };
        users.set(row.id, row);
        return row;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { email: string; name?: string } }) => {
          const current = users.get(where.id);
          if (!current) {
            throw new Error('missing user');
          }
          const next = { ...current, email: data.email, name: data.name ?? current.name };
          users.set(next.id, next);
          return next;
        },
      ),
    },
    authIdentity: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { provider_providerUserId: { provider: string; providerUserId: string } };
        }) => {
          const key = `${where.provider_providerUserId.provider}:${where.provider_providerUserId.providerUserId}`;
          const row = identities.get(key);
          return row ? withUser(row) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            provider: string;
            providerUserId: string;
            email: string;
            name?: string;
          };
        }) => {
          const row = {
            id: `identity-${++identitySeq}`,
            userId: data.userId,
            provider: data.provider,
            providerUserId: data.providerUserId,
            email: data.email,
            name: data.name ?? null,
          };
          identities.set(`${row.provider}:${row.providerUserId}`, row);
          return withUser(row);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { email: string; name?: string };
        }) => {
          const current = [...identities.values()].find((identity) => identity.id === where.id);
          if (!current) {
            throw new Error('missing identity');
          }
          const next = { ...current, email: data.email, name: data.name ?? current.name };
          identities.set(`${next.provider}:${next.providerUserId}`, next);
          return withUser(next);
        },
      ),
    },
    authSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `session-${++sessionSeq}`,
          userId: data.userId as string,
          accessTokenHash: data.accessTokenHash as string,
          refreshTokenHash: data.refreshTokenHash as string,
          accessExpiresAt: data.accessExpiresAt as Date,
          refreshExpiresAt: data.refreshExpiresAt as Date,
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sessions.set(row.id, row);
        return { id: row.id };
      }),
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { refreshTokenHash?: string; accessTokenHash?: string };
        }) => {
          const row = [...sessions.values()].find((session) =>
            where.refreshTokenHash
              ? session.refreshTokenHash === where.refreshTokenHash
              : session.accessTokenHash === where.accessTokenHash,
          );
          return row ? withUser(row) : null;
        },
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
        const current = sessions.get(where.id);
        if (!current) {
          throw new Error('missing session');
        }
        sessions.set(where.id, { ...current, revokedAt: data.revokedAt });
        return { id: where.id };
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            refreshTokenHash: string;
            revokedAt: null;
            refreshExpiresAt: { gt: Date };
          };
          data: { revokedAt: Date };
        }) => {
          const current = [...sessions.values()].find(
            (session) =>
              session.refreshTokenHash === where.refreshTokenHash &&
              session.revokedAt === null &&
              session.refreshExpiresAt > where.refreshExpiresAt.gt,
          );
          if (!current) {
            return { count: 0 };
          }
          sessions.set(current.id, { ...current, revokedAt: data.revokedAt });
          return { count: 1 };
        },
      ),
    },
    oAuthState: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `oauth-state-${++oauthStateSeq}`,
          provider: data.provider as string,
          stateHash: data.stateHash as string,
          returnTo: data.returnTo as string,
          expiresAt: data.expiresAt as Date,
          consumedAt: null,
          createdAt: new Date(),
        };
        oauthStates.set(row.id, row);
        return { id: row.id };
      }),
      findUnique: jest.fn(async ({ where }: { where: { stateHash: string } }) => {
        return [...oauthStates.values()].find((row) => row.stateHash === where.stateHash) ?? null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { consumedAt: Date } }) => {
        const current = oauthStates.get(where.id);
        if (!current) {
          throw new Error('missing oauth state');
        }
        oauthStates.set(where.id, { ...current, consumedAt: data.consumedAt });
        return { id: where.id };
      }),
    },
    oAuthLoginTicket: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `login-ticket-${++loginTicketSeq}`,
          ticketHash: data.ticketHash as string,
          userId: data.userId as string,
          sessionId: null,
          expiresAt: data.expiresAt as Date,
          consumedAt: null,
          createdAt: new Date(),
        };
        loginTickets.set(row.id, row);
        return { id: row.id };
      }),
      findUnique: jest.fn(async ({ where }: { where: { ticketHash: string } }) => {
        return [...loginTickets.values()].find((row) => row.ticketHash === where.ticketHash) ?? null;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { consumedAt: Date; sessionId?: string };
        }) => {
          const current = loginTickets.get(where.id);
          if (!current) {
            throw new Error('missing login ticket');
          }
          loginTickets.set(where.id, {
            ...current,
            consumedAt: data.consumedAt,
            sessionId: data.sessionId ?? current.sessionId,
          });
          return { id: where.id };
        },
      ),
    },
  };

  return db as typeof db & { client: Record<string, unknown> };
}

function createService(db = createAuthDb()) {
  const config = {
    googleClientId: 'google-client',
    googleClientSecret: 'google-secret',
    kakaoRestApiKey: 'kakao-rest',
    kakaoClientSecret: 'kakao-secret',
    naverClientId: 'naver-client',
    naverClientSecret: 'naver-secret',
    publicApiBaseUrl: 'https://api.example.com',
    oauthReturnToAllowlist: 'timefit://auth',
  };
  const service = new AuthService({} as never, config as never);
  (
    jest.spyOn(
      service as unknown as { getPrismaClient: () => Promise<unknown> },
      'getPrismaClient',
    ) as jest.Mock
  ).mockResolvedValue(db.client);
  (
    jest.spyOn(
      service as unknown as { resolveSocialProfile: () => Promise<unknown> },
      'resolveSocialProfile',
    ) as jest.Mock
  ).mockResolvedValue({
      provider: 'google',
      providerUserId: 'provider-user-1',
      email: 'user@example.com',
      name: 'User',
    });
  return { service, db };
}

describe('AuthService persistence', () => {
  it('stores sessions in DB and refreshes across service instances', async () => {
    const { service, db } = createService();
    const login = await service.socialLogin({ provider: 'google', idToken: 'id-token' });

    expect([...db.sessions.values()][0]?.refreshTokenHash).not.toBe(login.refreshToken);

    const nextService = createService(db).service;
    const refreshed = await nextService.refresh(login.refreshToken);

    expect(refreshed.userId).toBe(login.userId);
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
  });

  it('rejects refresh after logout', async () => {
    const { service } = createService();
    const login = await service.socialLogin({ provider: 'google', idToken: 'id-token' });

    await service.logout(login.refreshToken);

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired and revoked refresh sessions', async () => {
    const { service, db } = createService();
    const expired = await service.socialLogin({ provider: 'google', idToken: 'id-token' });
    const expiredRow = [...db.sessions.values()][0];
    db.sessions.set(expiredRow.id, {
      ...expiredRow,
      refreshExpiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.refresh(expired.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    const active = await service.socialLogin({ provider: 'google', idToken: 'id-token' });
    const activeRow = [...db.sessions.values()].find(
      (session) => session.id !== expiredRow.id,
    );
    if (!activeRow) {
      throw new Error('missing active session');
    }
    db.sessions.set(activeRow.id, { ...activeRow, revokedAt: new Date() });

    await expect(service.refresh(active.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('/me reads the DB-backed access session state', async () => {
    const { service } = createService();
    const login = await service.socialLogin({ provider: 'google', idToken: 'id-token' });

    await expect(service.getMe(login.accessToken)).resolves.toMatchObject({
      id: login.userId,
      email: 'user@example.com',
    });

    await service.logout(undefined, login.accessToken);
    await expect(service.getMe(login.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('starts backend OAuth with an HTTPS provider callback and stored state', async () => {
    const { service, db } = createService();

    const redirectUrl = await service.startOAuth('google', 'timefit://auth');
    const parsed = new URL(redirectUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://api.example.com/auth/google/callback');
    expect(parsed.searchParams.get('state')).toBeTruthy();
    expect(db.oauthStates.size).toBe(1);
    expect([...db.oauthStates.values()][0]?.returnTo).toBe('timefit://auth');
  });

  it('rejects OAuth start with an unlisted returnTo', async () => {
    const { service } = createService();

    await expect(service.startOAuth('google', 'evil://auth')).rejects.toThrow(
      'Unsupported OAuth returnTo.',
    );
  });

  it('returns an app error redirect for invalid or mismatched callback state', async () => {
    const { service } = createService();
    const googleRedirect = await service.startOAuth('google', 'timefit://auth');
    const googleState = new URL(googleRedirect).searchParams.get('state') ?? '';

    const invalidStateRedirect = await service.completeOAuthCallback('google', {
      code: 'code',
      state: 'missing-state',
    });
    const providerMismatchRedirect = await service.completeOAuthCallback('kakao', {
      code: 'code',
      state: googleState,
    });

    expect(new URL(invalidStateRedirect).searchParams.get('error')).toBe('oauth_failed');
    expect(new URL(providerMismatchRedirect).searchParams.get('error')).toBe('oauth_failed');
  });

  it('callback creates a one-time app login ticket and redeem issues TimeFit tokens', async () => {
    const { service, db } = createService();
    const redirectUrl = await service.startOAuth('google', 'timefit://auth');
    const state = new URL(redirectUrl).searchParams.get('state') ?? '';

    const appRedirect = await service.completeOAuthCallback('google', {
      code: 'provider-code',
      state,
    });
    const appRedirectUrl = new URL(appRedirect);
    const ticket = appRedirectUrl.searchParams.get('ticket') ?? '';

    expect(appRedirectUrl.protocol).toBe('timefit:');
    expect(ticket).toBeTruthy();
    expect(db.loginTickets.size).toBe(1);

    const tokens = await service.redeemLoginTicket(ticket);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.userId).toBe('user-1');
    expect([...db.loginTickets.values()][0]?.consumedAt).toBeInstanceOf(Date);
  });

  it('rejects reused, expired, and invalid login tickets', async () => {
    const { service, db } = createService();
    const redirectUrl = await service.startOAuth('google', 'timefit://auth');
    const state = new URL(redirectUrl).searchParams.get('state') ?? '';
    const appRedirect = await service.completeOAuthCallback('google', {
      code: 'provider-code',
      state,
    });
    const ticket = new URL(appRedirect).searchParams.get('ticket') ?? '';

    await service.redeemLoginTicket(ticket);
    await expect(service.redeemLoginTicket(ticket)).rejects.toBeInstanceOf(UnauthorizedException);

    const nextRedirectUrl = await service.startOAuth('google', 'timefit://auth');
    const nextState = new URL(nextRedirectUrl).searchParams.get('state') ?? '';
    const nextAppRedirect = await service.completeOAuthCallback('google', {
      code: 'provider-code',
      state: nextState,
    });
    const expiredTicket = new URL(nextAppRedirect).searchParams.get('ticket') ?? '';
    const ticketRow = [...db.loginTickets.values()].find((row) => row.consumedAt === null);
    if (!ticketRow) {
      throw new Error('missing active login ticket');
    }
    db.loginTickets.set(ticketRow.id, {
      ...ticketRow,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.redeemLoginTicket(expiredTicket)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.redeemLoginTicket('not-a-real-ticket')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
