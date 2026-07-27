import { selectTimeyContextFromTrip } from '../timeySelectors';

test('marks a walking segment between transit legs as transfer', () => {
  const context = selectTimeyContextFromTrip({
    trip: {
      movement: { currentSegmentIndex: 1 },
      route: {
        mobilitySegments: [
          { mode: 'bus' },
          { mode: 'walk' },
          { mode: 'subway' },
        ],
      },
    },
  });

  expect(context.isTransfer).toBe(true);
  expect(context.currentMode).toBe('WALK');
});

test('preserves an explicit provider transfer hint', () => {
  const context = selectTimeyContextFromTrip({
    trip: {
      movement: { currentSegmentIndex: 0 },
      route: { mobilitySegments: [{ mode: 'walk', transferTip: '2호선으로 환승' }] },
    },
  });

  expect(context.isTransfer).toBe(true);
});
