export interface NormalizedSavedPlaceLabel {
  normalizedLabel: string;
  canonicalLabel: string;
}

export function normalizeSavedPlaceLabel(raw: string): NormalizedSavedPlaceLabel {
  const unicodeNormalized = raw.normalize('NFKC');
  const collapsedSpaces = unicodeNormalized.replace(/\s+/g, ' ').trim();
  const canonicalLabel = collapsedSpaces;
  const normalizedLabel = collapsedSpaces.toLocaleLowerCase('en-US');

  return {
    normalizedLabel,
    canonicalLabel,
  };
}
