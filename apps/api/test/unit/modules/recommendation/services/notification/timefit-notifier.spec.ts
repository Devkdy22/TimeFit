import { SafeLogger } from '../../../../../../src/common/logger/safe-logger.service';
import { TimeFitNotifier } from '../../../../../../src/modules/recommendation/services/notification/TimeFitNotifier';
import type { MobilityRoute } from '../../../../../../src/modules/recommendation/types/recommendation.types';

describe('TimeFitNotifier', () => {
  it('emits status downgrade and delay spike notifications', () => {
    const notifier = new TimeFitNotifier(new SafeLogger());

    const route: MobilityRoute = {
      id: 'r1',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      delayRisk: 0.3,
      transferCount: 1,
      walkingMinutes: 4,
      mobilitySegments: [
        {
          mode: 'bus',
          durationMinutes: 12,
          realtimeInfo: { etaMinutes: 2 },
        },
      ],
    };

    const events = notifier.evaluate({
      route,
      previousStatus: '여유',
      nextStatus: '긴급',
      previousDelayMinutes: 1,
      nextDelayMinutes: 5,
    });

    expect(events.some((event) => event.type === 'STATUS_DOWNGRADED')).toBe(true);
    expect(events.some((event) => event.type === 'DELAY_SPIKE')).toBe(true);
    expect(events.some((event) => event.type === 'BUS_ARRIVING_SOON')).toBe(true);
  });
});
