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
});
