import { SafeLogger } from '../../../../../../src/common/logger/safe-logger.service';
import { RealtimeUpdateScheduler } from '../../../../../../src/modules/recommendation/services/transit/RealtimeUpdateScheduler';
import type { MobilityRoute } from '../../../../../../src/modules/recommendation/types/recommendation.types';

describe('RealtimeUpdateScheduler', () => {
  it('emits ETA_CHANGED when refreshed ETA differs', async () => {
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      {
        emit: jest.fn(),
      } as never,
      {
        applyRealtime: jest.fn(async (routes: MobilityRoute[]) =>
          routes.map((route) => ({
            ...route,
            realtimeAdjustedDurationMinutes: (route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes) + 3,
          })),
        ),
      } as never,
    );

    const events: string[] = [];
    const unsubscribe = scheduler.onRouteEvent((event) => {
      events.push(event.type);
    });

    scheduler.upsertTrackedRoute({
      id: 'route-1',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      realtimeAdjustedDurationMinutes: 20,
      delayRisk: 0.2,
      delayRiskLevel: 'LOW',
      transferCount: 1,
      walkingMinutes: 3,
    });

    await scheduler.refreshRoute('route-1');

    expect(events).toContain('ETA_CHANGED');

    unsubscribe();
    scheduler.stopRouteTracking('route-1');
  });

  it('does not overlap refreshes for the same tracked route', async () => {
    let resolveRefresh: ((routes: MobilityRoute[]) => void) | undefined;
    const applyRealtime = jest.fn(
      () => new Promise<MobilityRoute[]>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      { emit: jest.fn() } as never,
      { applyRealtime } as never,
    );
    const route: MobilityRoute = {
      id: 'route-lock',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 3,
    };
    scheduler.upsertTrackedRoute(route);

    const first = scheduler.refreshRoute('route-lock');
    const second = await scheduler.refreshRoute('route-lock');

    expect(applyRealtime).toHaveBeenCalledTimes(1);
    expect(second).toEqual(route);
    resolveRefresh?.([route]);
    await first;
    scheduler.stopRouteTracking('route-lock');
  });

  it('drops a provider response that finishes after tracking was stopped', async () => {
    let resolveRefresh: ((routes: MobilityRoute[]) => void) | undefined;
    const applyRealtime = jest.fn(
      () => new Promise<MobilityRoute[]>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const emit = jest.fn();
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      { emit } as never,
      { applyRealtime } as never,
    );
    const route: MobilityRoute = {
      id: 'route-stopped',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 3,
    };
    scheduler.upsertTrackedRoute(route, 'trip-stopped');

    const refresh = scheduler.refreshRoute(route.id);
    scheduler.stopRouteTracking(route.id);
    resolveRefresh?.([{ ...route, realtimeAdjustedDurationMinutes: 25 }]);

    await expect(refresh).resolves.toBeNull();
    expect(emit).not.toHaveBeenCalledWith('ROUTE_UPDATED', expect.anything());
  });

  it('refreshes immediately when tracking starts instead of waiting for the first interval', async () => {
    const applyRealtime = jest.fn(async (routes: MobilityRoute[]) => routes);
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      { emit: jest.fn() } as never,
      { applyRealtime } as never,
    );
    scheduler.upsertTrackedRoute({
      id: 'route-immediate',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 3,
    });

    scheduler.startRouteTracking('route-immediate');
    await new Promise((resolve) => setImmediate(resolve));

    expect(applyRealtime).toHaveBeenCalledTimes(1);
    scheduler.stopRouteTracking('route-immediate');
  });

  it('refreshes immediately when returning to the foreground', async () => {
    const applyRealtime = jest.fn(async (routes: MobilityRoute[]) => routes);
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      { emit: jest.fn() } as never,
      { applyRealtime } as never,
    );
    scheduler.upsertTrackedRoute({
      id: 'route-foreground',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 3,
    });
    scheduler.startRouteTracking('route-foreground');
    await new Promise((resolve) => setImmediate(resolve));
    applyRealtime.mockClear();

    scheduler.setAppState('route-foreground', 'background');
    scheduler.setAppState('route-foreground', 'foreground');
    await new Promise((resolve) => setImmediate(resolve));

    expect(applyRealtime).toHaveBeenCalledTimes(1);
    scheduler.stopRouteTracking('route-foreground');
  });

  it('emits route invalidation once until a valid route is restored', async () => {
    let invalid = true;
    const applyRealtime = jest.fn(async (routes: MobilityRoute[]) => routes.map((route) => ({
      ...route,
      mobilitySegments: invalid ? [] : [{ mode: 'walk', durationMinutes: 10 }],
    })));
    const emit = jest.fn();
    const scheduler = new RealtimeUpdateScheduler(
      new SafeLogger(),
      { emit } as never,
      { applyRealtime } as never,
    );
    scheduler.upsertTrackedRoute({
      id: 'route-invalid-transition',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 3,
      mobilitySegments: [{ mode: 'walk', durationMinutes: 10 }],
    });

    await scheduler.refreshRoute('route-invalid-transition');
    await scheduler.refreshRoute('route-invalid-transition');
    expect(emit.mock.calls.filter(([event]) => event === 'REROUTE_TRIGGERED')).toHaveLength(1);

    invalid = false;
    await scheduler.refreshRoute('route-invalid-transition');
    invalid = true;
    await scheduler.refreshRoute('route-invalid-transition');
    expect(emit.mock.calls.filter(([event]) => event === 'REROUTE_TRIGGERED')).toHaveLength(2);
    scheduler.stopRouteTracking('route-invalid-transition');
  });
});
