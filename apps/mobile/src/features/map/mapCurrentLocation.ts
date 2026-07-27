import type { CurrentLocation } from './types';

interface MatchedLocationInput {
  matchedPoint?: { lat: number; lng: number };
  matchingConfidence?: number;
  isOffRoute?: boolean;
}

export function resolveMapCurrentLocation(
  rawLocation: CurrentLocation | null,
  movement: MatchedLocationInput | null | undefined,
): CurrentLocation | null {
  if (!rawLocation) {
    return null;
  }

  const matchedPoint = movement?.matchedPoint;
  const confidence = movement?.matchingConfidence ?? 0;
  if (
    matchedPoint &&
    movement?.isOffRoute !== true &&
    confidence >= 0.55 &&
    Number.isFinite(matchedPoint.lat) &&
    Number.isFinite(matchedPoint.lng)
  ) {
    return { ...rawLocation, lat: matchedPoint.lat, lng: matchedPoint.lng };
  }

  return rawLocation;
}
