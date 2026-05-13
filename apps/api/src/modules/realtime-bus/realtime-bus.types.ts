export type BusProviderType = 'SEOUL' | 'GYEONGGI' | 'INCHEON';

export type RealtimeBusStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';

export type RealtimeBusReasonCode =
  | 'NO_PROVIDER_MATCH'
  | 'ARS_LOOKUP_EMPTY'
  | 'STATION_FOUND_ROUTE_NOT_FOUND'
  | 'ROUTE_FOUND_ARRIVAL_EMPTY'
  | 'PROVIDER_API_TIMEOUT'
  | 'PROVIDER_ID_MAPPING_FAILED'
  | 'SCORE_BELOW_THRESHOLD'
  | 'ALL_PROVIDER_FAILED'
  | 'ROUTE_MISMATCH'
  | 'STATION_TOO_FAR'
  | 'EMPTY_RESPONSE'
  | 'CACHE_STALE_USED';

export interface BusSegmentInput {
  lineLabel?: string;
  startArsId?: string;
  startStationId?: string;
  startName?: string;
  startLat?: number;
  startLng?: number;
  busRouteId?: string;
}

export interface StationCandidate {
  provider: BusProviderType;
  stationId: string;
  stationName: string;
  arsId?: string;
  lat?: number;
  lng?: number;
}

export interface RouteCandidate {
  provider: BusProviderType;
  routeId: string;
  routeName: string;
  direction?: string;
}

export interface ArrivalPayload {
  etaMinutes?: number;
  etaSeconds?: number;
  updatedAt: string;
  rawStatus?: string;
}

export interface BusProviderCandidate {
  provider: BusProviderType;
  station: StationCandidate;
  route: RouteCandidate;
  score: number;
  scoreBreakdown?: {
    arsMatch: number;
    lineMatch: number;
    distanceScore: number;
    stationNameScore: number;
    providerPriority: number;
    penalty: number;
  };
}

export interface ProviderResolveContext {
  segment: BusSegmentInput;
}

export interface BusProvider {
  readonly type: BusProviderType;
  readonly priority: number;
  findStationCandidates(context: ProviderResolveContext): Promise<StationCandidate[]>;
  findRouteCandidates(
    station: StationCandidate,
    context: ProviderResolveContext,
  ): Promise<RouteCandidate[]>;
  getArrival(input: { stationId: string; routeId: string }): Promise<ArrivalPayload | null>;
}

export interface MappingCacheValue {
  provider: BusProviderType;
  providerStationId: string;
  providerRouteId: string;
  confidence: number;
  routeName: string;
}

export interface EtaCacheValue {
  status: RealtimeBusStatus;
  etaMinutes?: number;
  etaSeconds?: number;
  provider: BusProviderType;
  confidence: number;
  updatedAt: string;
  reasonCode?: RealtimeBusReasonCode;
}

export interface ResolvedRealtimeBus {
  status: RealtimeBusStatus;
  etaMinutes?: number;
  etaSeconds?: number;
  provider?: BusProviderType;
  confidence: number;
  updatedAt: string;
  reasonCode?: RealtimeBusReasonCode;
  debug?: {
    selectedProvider?: BusProviderType;
    selectedScore?: number;
    failedProviders?: Array<{ provider: BusProviderType; reason: RealtimeBusReasonCode }>;
    reasonCode?: RealtimeBusReasonCode;
    candidateCount?: number;
    normalizedLineLabel?: string;
    normalizedStationName?: string;
    providerDiagnostics?: Record<string, unknown>;
  };
}

export interface ResolverDiagnostics {
  providerStationCounts: Record<BusProviderType, number>;
  providerRouteCounts: Record<BusProviderType, number>;
  failedProviders: Array<{ provider: BusProviderType; reason: RealtimeBusReasonCode }>;
}

export interface ResolverResult {
  stationCandidates: StationCandidate[];
  routeCandidates: Array<{ station: StationCandidate; route: RouteCandidate }>;
  providerCandidates: BusProviderCandidate[];
  diagnostics: ResolverDiagnostics;
}
