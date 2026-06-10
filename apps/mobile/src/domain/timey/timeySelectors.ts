import type { TimeyContext } from './timeyTypes';

interface TripTrackingLike {
  status?: '여유' | '주의' | '긴급' | null;
  movement?: {
    isOffRoute?: boolean;
    currentSegmentIndex?: number;
  } | null;
  route?: {
    delayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    mobilitySegments?: Array<{
      mode: 'walk' | 'bus' | 'subway' | 'car';
      realtimeInfo?: { etaMinutes?: number };
    }>;
  } | null;
  currentPosition?: {
    accuracy?: number;
  } | null;
  isConnectingSse?: boolean;
}

interface SelectTripInput {
  trip: TripTrackingLike;
  bufferMinutes?: number;
  delayMinutes?: number;
  tripStatus?: string;
}

function toCurrentMode(mode: 'walk' | 'bus' | 'subway' | 'car' | undefined): TimeyContext['currentMode'] {
  if (mode === 'walk') return 'WALK';
  if (mode === 'bus') return 'BUS';
  if (mode === 'subway') return 'SUBWAY';
  return undefined;
}

export function selectTimeyContextFromTrip(input: SelectTripInput): TimeyContext {
  const currentSegmentIndex = input.trip.movement?.currentSegmentIndex ?? 0;
  const segment = input.trip.route?.mobilitySegments?.[currentSegmentIndex];

  return {
    tripStatus: input.tripStatus,
    bufferMinutes: input.bufferMinutes,
    delayMinutes: input.delayMinutes,
    delayRiskLevel: input.trip.route?.delayRiskLevel,
    isOffRoute: input.trip.movement?.isOffRoute === true,
    isRerouting: input.trip.isConnectingSse === true,
    currentMode: toCurrentMode(segment?.mode),
    nextDepartureMinutes: segment?.realtimeInfo?.etaMinutes ?? null,
    hasRealtime: input.trip.isConnectingSse === false,
    accuracyMeters: input.trip.currentPosition?.accuracy ?? null,
    isSearching: false,
    hasRouteSelected: Boolean(input.trip.route?.mobilitySegments && input.trip.route.mobilitySegments.length > 0),
  };
}

interface SelectHomeInput {
  isGuest: boolean;
  hasRouteSelected: boolean;
  isSearching: boolean;
  hasSavedRoutine: boolean;
  isFirstVisit: boolean;
}

export function selectTimeyContextFromHome(input: SelectHomeInput): TimeyContext {
  if (input.isGuest) {
    return { isSearching: true, hasRouteSelected: false };
  }
  if (input.isSearching) {
    return { isSearching: true, hasRouteSelected: input.hasRouteSelected };
  }
  if (input.isFirstVisit) {
    return { hasRouteSelected: false };
  }
  if (input.hasSavedRoutine) {
    return { bufferMinutes: 12, hasRouteSelected: true };
  }
  if (!input.hasRouteSelected) {
    return { hasRouteSelected: false };
  }
  return { hasRouteSelected: true };
}
