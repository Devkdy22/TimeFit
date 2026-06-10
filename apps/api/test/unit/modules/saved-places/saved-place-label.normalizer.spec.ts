import { normalizeSavedPlaceLabel } from '../../../../src/modules/saved-places/saved-place-label.normalizer';

describe('normalizeSavedPlaceLabel', () => {
  it('applies trim + collapse spaces + unicode normalize + lowercase', () => {
    const input = '  HOME   PLACE  ';
    const normalized = normalizeSavedPlaceLabel(input);

    expect(normalized.canonicalLabel).toBe('HOME PLACE');
    expect(normalized.normalizedLabel).toBe('home place');
  });

  it('normalizes compatibility unicode forms', () => {
    const fullWidth = 'ＨＯＭＥ';
    const normalized = normalizeSavedPlaceLabel(fullWidth);

    expect(normalized.canonicalLabel).toBe('HOME');
    expect(normalized.normalizedLabel).toBe('home');
  });

  it('maps equivalent labels to same normalized key', () => {
    const a = normalizeSavedPlaceLabel(' 집 ');
    const b = normalizeSavedPlaceLabel('집');

    expect(a.normalizedLabel).toBe(b.normalizedLabel);
  });
});
