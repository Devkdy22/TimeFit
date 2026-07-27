import { resolveMapCurrentLocation } from './mapCurrentLocation';

const rawLocation = { lat: 37.5, lng: 127.01, accuracy: 12 };

test('uses the route-matched point when confidence is sufficient', () => {
  expect(
    resolveMapCurrentLocation(rawLocation, {
      matchedPoint: { lat: 37.501, lng: 127.011 },
      matchingConfidence: 0.8,
      isOffRoute: false,
    }),
  ).toEqual({ lat: 37.501, lng: 127.011, accuracy: 12 });
});

test('keeps the raw point while off-route or when matching confidence is low', () => {
  expect(
    resolveMapCurrentLocation(rawLocation, {
      matchedPoint: { lat: 37.501, lng: 127.011 },
      matchingConfidence: 0.95,
      isOffRoute: true,
    }),
  ).toEqual(rawLocation);
  expect(
    resolveMapCurrentLocation(rawLocation, {
      matchedPoint: { lat: 37.501, lng: 127.011 },
      matchingConfidence: 0.3,
      isOffRoute: false,
    }),
  ).toEqual(rawLocation);
});
