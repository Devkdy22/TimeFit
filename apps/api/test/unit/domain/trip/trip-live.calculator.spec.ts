import { calculateTripLiveState } from '../../../../src/domain/trip/trip-live.calculator';
import type { TripEntity } from '../../../../src/modules/trips/types/trip.types';

describe('calculateTripLiveState', () => {
  const baseTrip: TripEntity = {
    id: 'trip-1',
    userId: 'user-1',
    recommendationId: 'rec-1',
    status: 'preparing',
    startedAt: '2026-04-07T09:00:00.000Z',
    currentRoute: 'rec-1',
    departureAt: '2026-04-07T09:00:00.000Z',
    arrivalAt: '2026-04-07T09:30:00.000Z',
    plannedDurationMinutes: 30,
    expectedArrivalAt: '2026-04-07T09:30:00.000Z',
    delayOffsetMinutes: 0,
  };

  it('returns 여유/주의/긴급/위험 by thresholds', () => {
    const comfortable = calculateTripLiveState(
      {
        ...baseTrip,
        arrivalAt: '2026-04-07T09:40:00.000Z',
        expectedArrivalAt: '2026-04-07T09:40:00.000Z',
      },
      new Date('2026-04-07T09:10:00.000Z'),
      0,
    );
    const caution = calculateTripLiveState(
      {
        ...baseTrip,
        arrivalAt: '2026-04-07T09:33:00.000Z',
        expectedArrivalAt: '2026-04-07T09:33:00.000Z',
      },
      new Date('2026-04-07T09:10:00.000Z'),
      0,
    );
    const urgent = calculateTripLiveState(
      {
        ...baseTrip,
        arrivalAt: '2026-04-07T09:31:00.000Z',
        expectedArrivalAt: '2026-04-07T09:31:00.000Z',
      },
      new Date('2026-04-07T09:10:00.000Z'),
      0,
    );
    const overdue = calculateTripLiveState(baseTrip, new Date('2026-04-07T09:31:00.000Z'), 0);

    expect(comfortable.currentStatus).toBe('여유');
    expect(caution.currentStatus).toBe('주의');
    expect(urgent.currentStatus).toBe('긴급');
    expect(overdue.currentStatus).toBe('위험');
  });

  it('detects negative buffer and marks 위험', () => {
    const live = calculateTripLiveState(baseTrip, new Date('2026-04-07T09:20:00.000Z'), 8);

    expect(live.bufferMinutes).toBeLessThan(0);
    expect(live.currentStatus).toBe('위험');
    expect(live.urgencyLevel).toBe('critical');
  });
});
