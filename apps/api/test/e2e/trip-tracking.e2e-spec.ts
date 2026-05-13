import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AppModule } from '../../src/app.module';
import { EventBus } from '../../src/core/EventBus';
import { TripsController } from '../../src/modules/trips/trips.controller';
import { TripLifecycleManager } from '../../src/modules/trips/services/TripLifecycleManager';
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

describe('Trip Tracking E2E', () => {
  let app: INestApplication;
  let eventBus: EventBus;
  let tripsController: TripsController;
  let lifecycleManager: TripLifecycleManager;
  let api: ReturnType<typeof request>;

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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    const adapterInstance = app.getHttpAdapter().getInstance() as unknown;
    api = request(adapterInstance as Parameters<typeof request>[0]);

    eventBus = app.get(EventBus);
    tripsController = app.get(TripsController);
    lifecycleManager = app.get(TripLifecycleManager);
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

    const startRes = await api.post('/trips/start').send({
      route: sampleRoute,
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });

    expect(startRes.status).toBe(201);
    const tripId = startRes.body.data.tripId as string;

    const positionRes = await api
      .post(`/trips/${tripId}/position`)
      .send({ lat: 37.5002, lng: 127.0002, timestamp: Date.now() + 5000 });

    expect(positionRes.status).toBe(201);
    expect(positionRes.body.data).toHaveProperty('progress');

    const tripRes = await api.get(`/trips/${tripId}`);
    expect(tripRes.status).toBe(200);
    expect(tripRes.body.data).toHaveProperty('status');
  });

  it('2) off-route: two deviations trigger OFF_ROUTE and reroute', async () => {
    const startRes = await api.post('/trips/start').send({
      route: sampleRoute,
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });
    const tripId = startRes.body.data.tripId as string;

    const routedSpy = jest.fn();
    const unsubscribe = eventBus.subscribe('ROUTE_SWITCHED', routedSpy);

    await sleep(1100);

    const firstPosition = await api
      .post(`/trips/${tripId}/position`)
      .send({ lat: 37.9, lng: 127.4, timestamp: Date.now() + 5000 });
    expect(firstPosition.status).toBe(201);
    expect(firstPosition.body.data.ignored).not.toBe(true);
    expect(firstPosition.body.data.isOffRoute).toBe(true);

    await sleep(1100);

    const secondPosition = await api
      .post(`/trips/${tripId}/position`)
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
    const startRes = await api.post('/trips/start').send({
      route: sampleRoute,
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });
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

    const stream = tripsController.events(tripId, String((last?.eventId ?? 0) - 1));
    const events = await firstValueFrom(stream.pipe(take(2), toArray()));

    expect(events[0]?.type).toBe('ETA_CHANGED');
    expect(events[1]?.type).toBe('INIT');
  });

  it('5) lifecycle: 10min inactivity closes active tracking', async () => {
    const startRes = await api.post('/trips/start').send({
      route: sampleRoute,
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });
    const tripId = startRes.body.data.tripId as string;

    const base = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base + 11 * 60_000);
    lifecycleManager.cleanup();
    nowSpy.mockRestore();

    const tripRes = await api.get(`/trips/${tripId}`);
    expect(tripRes.status).toBe(200);
    expect(tripRes.body.data.trip.status).toBe('arrived');
  });
});
