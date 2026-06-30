import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { HttpExceptionFilter } from '../../src/common/http/http-exception.filter';
import { AuthService } from '../../src/modules/auth/auth.service';
import { RecommendationService } from '../../src/modules/recommendation/services/recommendation.service';

const databaseUrl = process.env.TIMEFIT_E2E_DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

function assertTestDatabaseUrl(url: string): void {
  if (!/timefit.*(test|e2e)|(test|e2e).*timefit/i.test(url)) {
    throw new Error('TIMEFIT_E2E_DATABASE_URL must point to a test database.');
  }
}

async function resetAndMigrate(url: string): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
    await prisma.$disconnect();
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: url,
      },
      stdio: 'pipe',
    });
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

function routinePayload() {
  return {
    title: '출근',
    origin: { name: '집', lat: 37.5665, lng: 126.978 },
    destination: { name: '회사', lat: 37.4979, lng: 127.0276 },
    weekdays: [1, 2, 3, 4, 5],
    arrivalTime: '08:50',
    notificationEnabled: true,
    notificationMinutesBefore: 10,
    favorite: false,
    active: true,
  };
}

function savedPlacePayload(label = '집') {
  return {
    label,
    address: '서울 중구 세종대로 110',
    lat: 37.5665,
    lng: 126.978,
  };
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = input as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

describeIfDatabase('Auth + Routines PostgreSQL E2E', () => {
  let app: INestApplication;
  let api: ReturnType<typeof request>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }
    assertTestDatabaseUrl(databaseUrl);
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    process.env.KAKAO_API_KEY = 'k';
    process.env.KAKAO_REST_API_KEY = 'k';
    process.env.WEATHER_API_KEY = 'w';
    process.env.SEOUL_API_KEY = 's';
    process.env.SEOUL_SUBWAY_API_KEY = 'ss';
    process.env.FCM_SERVER_KEY = 'f';
    process.env.CORS_ORIGINS = '';
    process.env.RATE_LIMIT_MAX = '1000';
    process.env.RATE_LIMIT_TTL_MS = '60000';

    await resetAndMigrate(databaseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    (globalThis as unknown as { prisma?: PrismaClient }).prisma = prisma;

    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RecommendationService)
      .useValue({
        recommend: jest.fn().mockResolvedValue({
          primaryRoute: {
            route: {
              id: 'route-1',
              name: '테스트 경로',
              source: 'api',
              estimatedTravelMinutes: 30,
              delayRisk: 0.1,
              transferCount: 1,
              walkingMinutes: 8,
            },
            departureAt: new Date().toISOString(),
            expectedArrivalAt: new Date().toISOString(),
            bufferMinutes: 10,
            status: '여유',
            scoreBreakdown: {
              punctuality: 40,
              safety: 30,
              earlyArrivalPenalty: 0,
              transferPenalty: 1,
              walkingPenalty: 1,
              delayPenalty: 1,
              bufferPenalty: 0,
            },
            totalScore: 90,
            riskLevel: 'low',
          },
          alternatives: [],
          status: '여유',
          nextAction: '정상 출발',
          confidenceScore: 0.9,
          generatedAt: new Date().toISOString(),
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    api = request(app.getHttpServer());

    const authService = app.get(AuthService);
    jest
      .spyOn(
        authService as unknown as { resolveSocialProfile: (input: { idToken?: string }) => Promise<unknown> },
        'resolveSocialProfile',
      )
      .mockImplementation(async (input: { idToken?: string }) => ({
        provider: 'google',
        providerUserId: input.idToken ?? 'provider-user',
        email: `${input.idToken ?? 'provider-user'}@example.com`,
        name: input.idToken ?? 'Provider User',
      }));
  });

  afterAll(async () => {
    await app?.close();
    delete (globalThis as unknown as { prisma?: PrismaClient }).prisma;
    await prisma?.$disconnect();
  });

  async function login(providerUserId: string = randomUUID()): Promise<TokenResponse> {
    const response = await api.post('/auth/social/login').send({
      provider: 'google',
      idToken: providerUserId,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
    return response.body.data as TokenResponse;
  }

  it('creates a user, refreshes, resolves /auth/me, and rejects refresh after logout', async () => {
    const tokens = await login('auth-user-1');

    await expect(prisma.user.findUnique({ where: { id: tokens.userId } })).resolves.toBeTruthy();
    await expect(prisma.authSession.count({ where: { userId: tokens.userId } })).resolves.toBe(1);

    const refreshResponse = await api.post('/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect(refreshResponse.status).toBe(201);
    const refreshed = refreshResponse.body.data as TokenResponse;
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);

    const meResponse = await api
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.accessToken}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.id).toBe(tokens.userId);

    const logoutResponse = await api
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshed.accessToken}`)
      .send({ refreshToken: refreshed.refreshToken });
    expect(logoutResponse.status).toBe(201);

    const rejected = await api.post('/auth/refresh').send({ refreshToken: refreshed.refreshToken });
    expect(rejected.status).toBe(401);
  });

  it('rejects revoked and expired sessions', async () => {
    const revoked = await login('auth-user-revoked');
    await prisma.authSession.updateMany({
      where: { userId: revoked.userId },
      data: { revokedAt: new Date() },
    });
    const revokedResponse = await api.post('/auth/refresh').send({ refreshToken: revoked.refreshToken });
    expect(revokedResponse.status).toBe(401);

    const expired = await login('auth-user-expired');
    await prisma.authSession.updateMany({
      where: { userId: expired.userId },
      data: { refreshExpiresAt: new Date(Date.now() - 1000) },
    });
    const expiredResponse = await api.post('/auth/refresh').send({ refreshToken: expired.refreshToken });
    expect(expiredResponse.status).toBe(401);
  });

  it.each([10, 20, 50])('allows only one refresh success for %i concurrent requests', async (count) => {
    const tokens = await login(`race-${count}`);

    const responses = await Promise.all(
      Array.from({ length: count }, () =>
        api.post('/auth/refresh').send({ refreshToken: tokens.refreshToken }),
      ),
    );

    const successes = responses.filter((response) => response.status === 201);
    const failures = responses.filter((response) => response.status === 401);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(count - 1);
    await expect(
      prisma.authSession.count({
        where: { userId: tokens.userId, revokedAt: null },
      }),
    ).resolves.toBe(1);
    const [hashCounts] = await prisma.$queryRawUnsafe<
      Array<{ total: bigint; distinct_refresh: bigint; distinct_access: bigint }>
    >(
      'SELECT count(*) AS total, count(DISTINCT "refreshTokenHash") AS distinct_refresh, count(DISTINCT "accessTokenHash") AS distinct_access FROM "AuthSession" WHERE "userId" = $1',
      tokens.userId,
    );
    expect(hashCounts.total).toBe(hashCounts.distinct_refresh);
    expect(hashCounts.total).toBe(hashCounts.distinct_access);
  });

  it('creates, lists, updates, runs, and deletes owner routines', async () => {
    const tokens = await login('routine-owner');
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    const createResponse = await api
      .post('/routines')
      .set(auth)
      .set('Idempotency-Key', randomUUID())
      .send(routinePayload());
    expect(createResponse.status).toBe(201);
    const routineId = createResponse.body.data.id as string;
    expect(createResponse.body.data.origin).toMatchObject({ name: '집', lat: 37.5665 });

    const listResponse = await api.get('/routines').set(auth);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const favoriteResponse = await api.patch(`/routines/${routineId}`).set(auth).send({ favorite: true });
    expect(favoriteResponse.status).toBe(200);
    expect(favoriteResponse.body.data.favorite).toBe(true);

    const activeResponse = await api.patch(`/routines/${routineId}`).set(auth).send({ active: false });
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data.active).toBe(false);

    await api.patch(`/routines/${routineId}`).set(auth).send({ active: true });
    const runResponse = await api.post(`/routines/${routineId}/run`).set(auth).send();
    expect(runResponse.status).toBe(201);
    await expect(prisma.routine.findUnique({ where: { id: routineId } })).resolves.toMatchObject({
      lastTriggeredAt: expect.any(Date),
    });

    const deleteResponse = await api.delete(`/routines/${routineId}`).set(auth);
    expect(deleteResponse.status).toBe(200);
    const listAfterDelete = await api.get('/routines').set(auth);
    expect(listAfterDelete.body.data).toHaveLength(0);
  });

  it('handles saved places with FK ownership and DB idempotency', async () => {
    const owner = await login('saved-place-owner');
    const other = await login('saved-place-other');
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const otherAuth = { Authorization: `Bearer ${other.accessToken}` };
    const payload = savedPlacePayload('집');
    const idempotencyKey = randomUUID();

    const createResponse = await api
      .post('/me/places')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(createResponse.status).toBe(201);
    const placeId = createResponse.body.data.id as string;

    const replayResponse = await api
      .post('/me/places')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data).toEqual(createResponse.body.data);

    const conflictResponse = await api
      .post('/me/places')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send(savedPlacePayload('회사'));
    expect(conflictResponse.status).toBe(409);

    const pendingKey = randomUUID();
    await prisma.idempotencyKey.create({
      data: {
        userId: owner.userId,
        scope: 'saved-place:create',
        key: pendingKey,
        payloadHash: payloadHash(payload),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const pendingResponse = await api
      .post('/me/places')
      .set(auth)
      .set('Idempotency-Key', pendingKey)
      .send(payload);
    expect(pendingResponse.status).toBe(409);

    const spamKey = randomUUID();
    const spamResponses = await Promise.all(
      Array.from({ length: 10 }, () =>
        api.post('/me/places').set(auth).set('Idempotency-Key', spamKey).send(savedPlacePayload('학교')),
      ),
    );
    expect(spamResponses.every((response) => [201, 409].includes(response.status))).toBe(true);
    await expect(
      prisma.savedPlace.count({
        where: { userId: owner.userId, normalizedLabel: '학교' },
      }),
    ).resolves.toBe(1);

    const duplicateNormalized = await api
      .post('/me/places')
      .set(auth)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, label: ' 집 ' });
    expect(duplicateNormalized.status).toBe(201);
    expect(duplicateNormalized.body.data.id).toBe(placeId);

    const otherCreate = await api
      .post('/me/places')
      .set(otherAuth)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(otherCreate.status).toBe(201);
    expect(otherCreate.body.data.id).not.toBe(placeId);

    const forbiddenDelete = await api.delete(`/me/places/${placeId}`).set(otherAuth);
    expect(forbiddenDelete.status).toBe(403);

    const listResponse = await api.get('/me/places').set(auth);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.every((place: { id: string }) => place.id !== otherCreate.body.data.id)).toBe(true);

    const logoutTokens = await login('saved-place-logout');
    const logoutPlace = await api
      .post('/me/places')
      .set('Authorization', `Bearer ${logoutTokens.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(savedPlacePayload('로그아웃'));
    expect(logoutPlace.status).toBe(201);
    await api
      .post('/auth/logout')
      .set('Authorization', `Bearer ${logoutTokens.accessToken}`)
      .send({ refreshToken: logoutTokens.refreshToken });
    const afterLogoutCreate = await api
      .post('/me/places')
      .set('Authorization', `Bearer ${logoutTokens.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(savedPlacePayload('로그아웃 후'));
    expect(afterLogoutCreate.status).toBe(401);
    const afterLogoutDelete = await api
      .delete(`/me/places/${logoutPlace.body.data.id}`)
      .set('Authorization', `Bearer ${logoutTokens.accessToken}`);
    expect(afterLogoutDelete.status).toBe(401);

    const expiredTokens = await login('saved-place-expired');
    const expiredPlace = await api
      .post('/me/places')
      .set('Authorization', `Bearer ${expiredTokens.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(savedPlacePayload('만료 전'));
    expect(expiredPlace.status).toBe(201);
    await prisma.authSession.updateMany({
      where: { userId: expiredTokens.userId },
      data: { accessExpiresAt: new Date(Date.now() - 1000) },
    });
    const expiredCreate = await api
      .post('/me/places')
      .set('Authorization', `Bearer ${expiredTokens.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(savedPlacePayload('만료 후'));
    expect(expiredCreate.status).toBe(401);
    const expiredDelete = await api
      .delete(`/me/places/${expiredPlace.body.data.id}`)
      .set('Authorization', `Bearer ${expiredTokens.accessToken}`);
    expect(expiredDelete.status).toBe(401);
  });

  it('handles routine create DB idempotency and user isolation', async () => {
    const owner = await login('routine-idempotency-owner');
    const other = await login('routine-idempotency-other');
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const payload = routinePayload();
    const idempotencyKey = randomUUID();

    const createResponse = await api
      .post('/routines')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(createResponse.status).toBe(201);
    const routineId = createResponse.body.data.id as string;

    const replayResponse = await api
      .post('/routines')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data).toEqual(createResponse.body.data);

    const conflictResponse = await api
      .post('/routines')
      .set(auth)
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...payload, title: '다른 루틴' });
    expect(conflictResponse.status).toBe(409);

    const pendingKey = randomUUID();
    await prisma.idempotencyKey.create({
      data: {
        userId: owner.userId,
        scope: 'routine:create',
        key: pendingKey,
        payloadHash: payloadHash(payload),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const pendingResponse = await api
      .post('/routines')
      .set(auth)
      .set('Idempotency-Key', pendingKey)
      .send(payload);
    expect(pendingResponse.status).toBe(409);

    const spamKey = randomUUID();
    const spamResponses = await Promise.all(
      Array.from({ length: 10 }, () =>
        api.post('/routines').set(auth).set('Idempotency-Key', spamKey).send({
          ...payload,
          title: '스팸 방지 루틴',
        }),
      ),
    );
    expect(spamResponses.every((response) => [201, 409].includes(response.status))).toBe(true);
    await expect(
      prisma.routine.count({ where: { userId: owner.userId, title: '스팸 방지 루틴' } }),
    ).resolves.toBe(1);

    const otherReplayKey = idempotencyKey;
    const otherCreate = await api
      .post('/routines')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Idempotency-Key', otherReplayKey)
      .send(payload);
    expect(otherCreate.status).toBe(201);
    expect(otherCreate.body.data.id).not.toBe(routineId);

    const forbiddenPatch = await api
      .patch(`/routines/${routineId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ favorite: true });
    expect(forbiddenPatch.status).toBe(403);
  });

  it('enforces routine ownership and validation', async () => {
    const owner = await login('routine-owner-2');
    const other = await login('routine-other');

    const createResponse = await api
      .post('/routines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(routinePayload());
    const routineId = createResponse.body.data.id as string;

    const forbiddenPatch = await api
      .patch(`/routines/${routineId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ favorite: true });
    expect(forbiddenPatch.status).toBe(403);

    const forbiddenRun = await api
      .post(`/routines/${routineId}/run`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send();
    expect(forbiddenRun.status).toBe(403);

    const forbiddenDelete = await api
      .delete(`/routines/${routineId}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(forbiddenDelete.status).toBe(403);

    const invalidCreate = await api
      .post('/routines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ title: '필드 누락' });
    expect(invalidCreate.status).toBe(400);
  });
});
