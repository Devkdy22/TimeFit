import { SafeLogger } from '../../../../../src/common/logger/safe-logger.service';
import { EventBus } from '../../../../../src/core/EventBus';
import { TripLifecycleManager } from '../../../../../src/modules/trips/services/TripLifecycleManager';

describe('TripLifecycleManager', () => {
  it('cleans up inactive trips', () => {
    const cleanupInactiveTrip = jest.fn();
    const manager = new TripLifecycleManager(
      {
        getActiveTripStates: jest.fn().mockReturnValue([
          {
            tripId: 'trip-1',
            lastActivityAt: Date.now() - 11 * 60_000,
            sseConnections: 0,
          },
        ]),
        cleanupInactiveTrip,
        markSseConnected: jest.fn(),
        markSseDisconnected: jest.fn(),
      } as never,
      new EventBus(),
      new SafeLogger(),
    );

    manager.cleanup();

    expect(cleanupInactiveTrip).toHaveBeenCalledWith('trip-1');
    manager.onModuleDestroy();
  });
});
