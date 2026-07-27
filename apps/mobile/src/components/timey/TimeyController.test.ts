import { getTimeyAccessibilityLabel } from './TimeyController';

test('describes required Timey movement states instead of a generic label', () => {
  expect(getTimeyAccessibilityLabel('walking')).toBe('걸어서 이동하고 있어요');
  expect(getTimeyAccessibilityLabel('riding_bus')).toBe('버스를 타고 이동하고 있어요');
  expect(getTimeyAccessibilityLabel('riding_subway')).toBe('지하철을 타고 이동하고 있어요');
  expect(getTimeyAccessibilityLabel('transfer')).toBe('환승하고 있어요');
});
