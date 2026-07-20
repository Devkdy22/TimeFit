import { ConflictException, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AppModule } from '../../src/app.module';
import { EventBus } from '../../src/core/EventBus';
import { AuthService } from '../../src/modules/auth/auth.service';
import { KakaoMapClient } from '../../src/modules/recommendation/integrations/kakao-map.client';
import { TripsController } from '../../src/modules/trips/trips.controller';
import { TripLifecycleManager } from '../../src/modules/trips/services/TripLifecycleManager';
import { TripIdempotencyStore } from '../../src/modules/trips/services/trip-idempotency.store';
import { TripsService } from '../../src/modules/trips/services/trips.service';
import { ReRoutingEngine } from '../../src/modules/recommendation/services/transit/ReRoutingEngine';

function seedEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/timefit';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
  process.env.KAKAO_API_KEY = 'k';
  process.env.KAKAO_REST_API_KEY = 'k';
  process.env.WEATHER_API_KEY = 'w';
  process.env.SEOUL_API_KEY = 's';
  process.env.SEOUL_SUBWAY_API_KEY = 'ss';
  process.env.FCM_SERVER_KEY = 'f';
  process.env.CORS_ORIGINS = '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await sleep(50);
  }
  return predicate();
}

type IdempotencyRow = {
  payloadHash: string;
  status: 'PENDING' | 'COMPLETED';
  response: unknown;
};

class InMemoryTripIdempotencyStore {
  private readonly rows = new Map<string, IdempotencyRow>();
  private nextCompleteDelayMs = 0;

  delayNextComplete(ms: number) {
    this.nextCompleteDelayMs = ms;
  }

  async begin<TResponse>(input: { userId: string; scope: string; key: string; payload: unknown }) {
    const mapKey = this.toMapKey(input);
    const payloadHash = hashPayload(input.payload);
    const existing = this.rows.get(mapKey);

    if (!existing) {
      this.rows.set(mapKey, { payloadHash, status: 'PENDING', response: null });
      return { replayed: false };
    }

    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key was reused with different payload',
      });
    }

    if (existing.status === 'PENDING') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_PENDING',
        message: 'Request with this idempotency key is already in progress',
      });
    }

    return { replayed: true, response: existing.response as TResponse };
  }

  async complete(input: { userId: string; scope: string; key: string }, response: unknown) {
    const delayMs = this.nextCompleteDelayMs;
    this.nextCompleteDelayMs = 0;
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const existing = this.rows.get(this.toMapKey(input));
    if (existing) {
      existing.status = 'COMPLETED';
      existing.response = response;
    }
  }

  async clearPending(input: { userId: string; scope: string; key: string }) {
    const mapKey = this.toMapKey(input);
    const existing = this.rows.get(mapKey);
    if (existing?.status === 'PENDING') {
      this.rows.delete(mapKey);
    }
  }

  private toMapKey(input: { userId: string; scope: string; key: string }) {
    return `${input.userId}:${input.scope}:${input.key}`;
  }
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
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

describe('Trip Tracking E2E', () => {
  let app: INestApplication;
  let eventBus: EventBus;
  let tripsController: TripsController;
  let lifecycleManager: TripLifecycleManager;
  let tripsService: TripsService;
  let tripIdempotencyStore: InMemoryTripIdempotencyStore;
  let api: ReturnType<typeof request>;
  const userAToken = 'trip-user-a-token';
  const userBToken = 'trip-user-b-token';
  const authHeaderA = { Authorization: `Bearer ${userAToken}` };
  const authHeaderB = { Authorization: `Bearer ${userBToken}` };

  const sampleRoute = {
    id: 'route-1',
    name: '테스트 경로',
    source: 'api',
    estimatedTravelMinutes: 20,
    realtimeAdjustedDurationMinutes: 20,
    delayRisk: 0.1,
    delayRiskLevel: 'LOW',
    transferCount: 0,
    walkingMinutes: 10,
    score: 80,
    realtimeCoverage: 1,
    mobilitySegments: [
      {
        mode: 'walk',
        durationMinutes: 10,
        startLat: 37.5,
        startLng: 127,
        endLat: 37.51,
        endLng: 127.01,
      },
    ],
  } as const;

  beforeAll(async () => {
    seedEnv();
    tripIdempotencyStore = new InMemoryTripIdempotencyStore();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue({
        getMe: jest.fn(async (accessToken: string) => {
          if (accessToken === userAToken) {
            return { id: 'trip-user-a', email: 'a@example.com', name: 'A', provider: null };
          }
          if (accessToken === userBToken) {
            return { id: 'trip-user-b', email: 'b@example.com', name: 'B', provider: null };
          }
          throw new UnauthorizedException('Invalid access token');
        }),
      })
      .overrideProvider(KakaoMapClient)
      .useValue({
        getRouteCandidates: jest.fn(async () => ({
          source: 'api',
          status: 'OK',
          fetchedAt: new Date().toISOString(),
          cacheableForMs: 60_000,
          candidates: [sampleRoute],
        })),
      })
      .overrideProvider(ReRoutingEngine)
      .useValue({
        evaluateReRoute: jest.fn().mockResolvedValue({
          keepCurrent: false,
          reason: 'force-off-route',
          nextBestRoute: {
            ...sampleRoute,
            id: 'route-2',
            score: 92,
          },
        }),
      })
      .overrideProvider(TripIdempotencyStore)
      .useValue(tripIdempotencyStore)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    api = request(app.getHttpServer());

    eventBus = app.get(EventBus);
    tripsController = app.get(TripsController);
    lifecycleManager = app.get(TripLifecycleManager);
    tripsService = app.get(TripsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1) normal flow: /routes -> /trips/start -> /position', async () => {
    const routesRes = await api.post('/routes').send({
      origin: { name: 'A', lat: 37.5, lng: 127 },
      destination: { name: 'B', lat: 37.51, lng: 127.01 },
    });
    expect(routesRes.status).toBe(201);

    const startRes = await startTripAsUserA({ userId: 'client-spoofed-user' });

    expect(startRes.status).toBe(201);
    const tripId = startRes.body.data.tripId as string;

    const positionRes = await api
      .post(`/trips/${tripId}/position`)
      .set(authHeaderA)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });

    expect(positionRes.status).toBe(201);
    expect(positionRes.body.data).toHaveProperty('progress');

    const tripRes = await api.get(`/trips/${tripId}`).set(authHeaderA);
    expect(tripRes.status).toBe(200);
    expect(tripRes.body.data).toHaveProperty('status');
    expect(tripRes.body.data.trip.userId).toBe('trip-user-a');
  });

  it('2) off-route: two deviations trigger OFF_ROUTE and reroute', async () => {
    const startRes = await startTripAsUserA();
    const tripId = startRes.body.data.tripId as string;

    const routedSpy = jest.fn();
    const unsubscribe = eventBus.subscribe('ROUTE_SWITCHED', routedSpy);

    await sleep(1100);

    const firstPosition = await api
      .post(`/trips/${tripId}/position`)
      .set(authHeaderA)
      .send({ lat: 37.9, lng: 127.4, timestamp: Date.now() + 5000 });
    expect(firstPosition.status).toBe(201);
    expect(firstPosition.body.data.ignored).not.toBe(true);
    expect(firstPosition.body.data.isOffRoute).toBe(true);

    await sleep(1100);

    const secondPosition = await api
      .post(`/trips/${tripId}/position`)
      .set(authHeaderA)
      .send({ lat: 37.901, lng: 127.401, timestamp: Date.now() + 7000 });
    expect(secondPosition.status).toBe(201);
    expect(secondPosition.body.data.isOffRoute).toBe(true);

    const routed = await waitFor(() => routedSpy.mock.calls.length > 0, 1200);
    expect(routed).toBe(true);
    unsubscribe();
  });

  it('3) delay risk change event can be emitted and observed', async () => {
    const riskSpy = jest.fn();
    const unsubscribe = eventBus.subscribe('RISK_LEVEL_CHANGED', riskSpy);

    eventBus.emit('RISK_LEVEL_CHANGED', {
      tripId: 'trip-risk',
      routeId: 'route-risk',
      previousRiskLevel: 'LOW',
      nextRiskLevel: 'HIGH',
    });

    expect(riskSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        nextRiskLevel: 'HIGH',
      }),
    );

    unsubscribe();
  });

  it('4) SSE reconnect replay + INIT (mock event stream)', async () => {
    const startRes = await startTripAsUserA();
    const tripId = startRes.body.data.tripId as string;

    eventBus.emit('ETA_CHANGED', {
      tripId,
      routeId: 'route-1',
      previousEtaMinutes: 20,
      nextEtaMinutes: 25,
    });

    const history = eventBus.getEventsAfter(0, {
      eventNames: ['ETA_CHANGED'],
      filter: (envelope) => (envelope.payload as { tripId?: string }).tripId === tripId,
      limit: 1,
    });
    const last = history[0];
    expect(last?.eventId).toBeDefined();

    const stream = tripsController.events(
      { authUserId: 'trip-user-a' } as never,
      tripId,
      String((last?.eventId ?? 0) - 1),
    );
    const events = await firstValueFrom(stream.pipe(take(2), toArray()));

    expect(events[0]?.type).toBe('ETA_CHANGED');
    expect(events[1]?.type).toBe('INIT');
  });

  it('5) lifecycle: 10min inactivity closes active tracking', async () => {
    const startRes = await startTripAsUserA();
    const tripId = startRes.body.data.tripId as string;

    const base = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base + 11 * 60_000);
    lifecycleManager.cleanup();
    nowSpy.mockRestore();

    const tripRes = await api.get(`/trips/${tripId}`).set(authHeaderA);
    expect(tripRes.status).toBe(200);
    expect(tripRes.body.data.trip.status).toBe('arrived');
  });

  it('6) rejects unauthenticated and invalid Trip requests', async () => {
    const startWithoutAuth = await api.post('/trips/start').send({
      route: sampleRoute,
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });
    expect(startWithoutAuth.status).toBe(401);

    const positionWithoutAuth = await api
      .post('/trips/missing/position')
      .send({ lat: 37.5, lng: 127, timestamp: Date.now() + 5000 });
    expect(positionWithoutAuth.status).toBe(401);

    const sseWithoutAuth = await api.get('/trips/missing/events');
    expect(sseWithoutAuth.status).toBe(401);

    const stopWithoutAuth = await api.post('/trips/stop').send({ tripId: 'missing' });
    expect(stopWithoutAuth.status).toBe(401);

    const getWithoutAuth = await api.get('/trips/missing');
    expect(getWithoutAuth.status).toBe(401);

    const invalidSession = await api
      .post('/trips/start')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        route: sampleRoute,
        targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
        currentPosition: { lat: 37.5, lng: 127 },
      });
    expect(invalidSession.status).toBe(401);

    const invalidSessionGet = await api.get('/trips/missing').set('Authorization', 'Bearer invalid-token');
    expect(invalidSessionGet.status).toBe(401);
  });

  it('7) enforces Trip ownership for get, position updates, SSE subscription, and stop', async () => {
    const startRes = await startTripAsUserA();
    const tripId = startRes.body.data.tripId as string;

    const userBGet = await api.get(`/trips/${tripId}`).set(authHeaderB);
    expect(userBGet.status).toBe(403);

    const userBPosition = await api
      .post(`/trips/${tripId}/position`)
      .set(authHeaderB)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });
    expect(userBPosition.status).toBe(403);

    const userBSse = await api.get(`/trips/${tripId}/events`).set(authHeaderB);
    expect(userBSse.status).toBe(403);

    const userBStop = await api.post('/trips/stop').set(authHeaderB).send({ tripId });
    expect(userBStop.status).toBe(403);

    const userAGetAfterBStop = await api.get(`/trips/${tripId}`).set(authHeaderA);
    expect(userAGetAfterBStop.status).toBe(200);
    expect(userAGetAfterBStop.body.data.trip.status).toBe('preparing');
  });

  it('8) applies Trip not-found and ended-trip policies', async () => {
    const missingGet = await api.get('/trips/not-existing').set(authHeaderA);
    expect(missingGet.status).toBe(404);

    const missingPosition = await api
      .post('/trips/not-existing/position')
      .set(authHeaderA)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });
    expect(missingPosition.status).toBe(404);

    const startRes = await startTripAsUserA();
    const tripId = startRes.body.data.tripId as string;
    const stopRes = await api.post('/trips/stop').set(authHeaderA).send({ tripId });
    expect(stopRes.status).toBe(201);
    expect(stopRes.body.data).toEqual({ stopped: true, tripId });

    const duplicateStopRes = await api.post('/trips/stop').set(authHeaderA).send({ tripId });
    expect(duplicateStopRes.status).toBe(201);
    expect(duplicateStopRes.body.data).toEqual({ stopped: false, tripId });

    const endedPosition = await api
      .post(`/trips/${tripId}/position`)
      .set(authHeaderA)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });
    expect(endedPosition.status).toBe(400);

    const endedSse = await api.get(`/trips/${tripId}/events`).set(authHeaderA);
    expect(endedSse.status).toBe(400);
  });

  it('9) replays identical Trip start requests with the same Idempotency-Key', async () => {
    const key = randomUUID();
    const payload = tripStartPayload();
    const first = await startTripAsUserA(payload, key);
    const second = await startTripAsUserA(payload, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data).toEqual(first.body.data);
  });

  it('10) rejects Trip start key reuse with a different body', async () => {
    const key = randomUUID();
    const first = await startTripAsUserA(tripStartPayload({ targetArrivalTime: futureArrivalTime(40) }), key);
    const conflict = await startTripAsUserA(
      tripStartPayload({ targetArrivalTime: futureArrivalTime(45) }),
      key,
    );

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(responseErrorCode(conflict.body)).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('11) treats different Trip start idempotency keys as separate requests and preserves active policy', async () => {
    const payload = tripStartPayload();
    const first = await startTripAsUserA(payload, randomUUID());
    const second = await startTripAsUserA(payload, randomUUID());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.tripId).not.toBe(first.body.data.tripId);

    const previousPosition = await api
      .post(`/trips/${first.body.data.tripId}/position`)
      .set(authHeaderA)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });
    expect(previousPosition.status).toBe(400);

    const previousTrip = await api.get(`/trips/${first.body.data.tripId}`).set(authHeaderA);
    expect(previousTrip.status).toBe(200);
    expect(previousTrip.body.data.trip.status).toBe('preparing');
  });

  it('12) isolates Trip start idempotency keys by authenticated user', async () => {
    const key = randomUUID();
    const payload = tripStartPayload();
    const userA = await startTripAsUserA(payload, key);
    const userB = await startTripAsUserB(payload, key);

    expect(userA.status).toBe(201);
    expect(userB.status).toBe(201);
    expect(userB.body.data.tripId).not.toBe(userA.body.data.tripId);
  });

  it('13) creates only one Trip while the same start key is in progress', async () => {
    const key = randomUUID();
    const payload = tripStartPayload();
    const startSpy = jest.spyOn(tripsService, 'startTrip');
    tripIdempotencyStore.delayNextComplete(50);

    const [first, second] = await Promise.all([
      startTripAsUserA(payload, key),
      startTripAsUserA(payload, key),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([201, 409]);
    expect([first.body, second.body].some((body) => responseErrorCode(body) === 'IDEMPOTENCY_PENDING')).toBe(true);
    expect(startSpy).toHaveBeenCalledTimes(1);
    startSpy.mockRestore();

    const replay = await startTripAsUserA(payload, key);
    const created = first.status === 201 ? first : second;
    expect(replay.status).toBe(201);
    expect(replay.body.data).toEqual(created.body.data);
  });

  it('14) reuses completed Trip start idempotency result after stop', async () => {
    const key = randomUUID();
    const payload = tripStartPayload();
    const started = await startTripAsUserA(payload, key);
    expect(started.status).toBe(201);

    const tripId = started.body.data.tripId as string;
    const stop = await api.post('/trips/stop').set(authHeaderA).send({ tripId });
    expect(stop.status).toBe(201);

    const replay = await startTripAsUserA(payload, key);
    expect(replay.status).toBe(201);
    expect(replay.body.data).toEqual(started.body.data);

    const trip = await api.get(`/trips/${tripId}`).set(authHeaderA);
    expect(trip.status).toBe(200);
    expect(trip.body.data.trip.status).toBe('arrived');
  });

  function tripStartPayload(overrides: Record<string, unknown> = {}) {
    return {
      route: sampleRoute,
      targetArrivalTime: futureArrivalTime(),
      currentPosition: { lat: 37.5, lng: 127 },
      ...overrides,
    };
  }

  function futureArrivalTime(offsetMinutes = 40) {
    return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
  }

  function startTripAsUserA(overrides: Record<string, unknown> = {}, idempotencyKey?: string) {
    const req = api
      .post('/trips/start')
      .set(authHeaderA);
    if (idempotencyKey) {
      req.set('Idempotency-Key', idempotencyKey);
    }
    return req.send({
      ...tripStartPayload({
        targetArrivalTime: futureArrivalTime(),
      }),
      ...overrides,
    });
  }

  function startTripAsUserB(overrides: Record<string, unknown> = {}, idempotencyKey?: string) {
    const req = api
      .post('/trips/start')
      .set(authHeaderB);
    if (idempotencyKey) {
      req.set('Idempotency-Key', idempotencyKey);
    }
    return req.send({
      ...tripStartPayload({
        targetArrivalTime: futureArrivalTime(),
      }),
      ...overrides,
    });
  }

  function responseErrorCode(body: unknown): string | undefined {
    const payload = body as { code?: string; error?: { code?: string } };
    return payload.error?.code ?? payload.code;
  }
});
