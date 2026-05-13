import { Platform } from 'react-native';

function resolveApiBaseUrl() {
  const raw =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'https://timefit-api.onrender.com';

  try {
    const parsed = new URL(raw);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    // Android emulator cannot reach host machine via localhost.
    if (Platform.OS === 'android' && isLocalhost) {
      parsed.hostname = '10.0.2.2';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'https://timefit-api.onrender.com';
  }
}

const API_BASE_URL = resolveApiBaseUrl();

export interface RecommendLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RecommendRequest {
  origin: RecommendLocation;
  destination: RecommendLocation;
  arrivalAt: string;
  candidateRoutes?: MobilityRoutePayload[];
}

export interface RecommendedRoute {
  route: {
    id: string;
    name: string;
    source: 'api' | 'fallback';
    mobilityFlow?: string[];
    mobilitySegments?: Array<{
      mode: 'walk' | 'bus' | 'subway' | 'car';
      durationMinutes: number;
      realtimeAdjustedDurationMinutes?: number;
      lineLabel?: string;
      lineId?: string;
      directionLabel?: string;
      startName?: string;
      endName?: string;
      startStationId?: string;
      endStationId?: string;
      busRouteId?: string;
      stationCount?: number;
      distanceMeters?: number;
      passStops?: string[];
      pathPoints?: Array<{ lat: number; lng: number; label?: string }>;
      routeGeometry?: Array<{ lat: number; lng: number }>;
      candidates?: Array<{
        route: string;
        etaMinutes: number;
        etaSeconds?: number;
        direction?: string;
      }>;
      realtimeStatus?: 'SCHEDULED' | 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';
      realtimeInfo?: {
        etaMinutes?: number;
        etaSeconds?: number;
        reasonCode?: string;
        source?: 'SEOUL_API' | 'GYEONGGI_API' | 'INCHEON_API' | 'CACHE';
        updatedAt?: string;
      };
    }>;
    estimatedTravelMinutes: number;
    realtimeAdjustedDurationMinutes?: number;
    transferCount: number;
    walkingMinutes: number;
    delayRisk: number;
  };
  departureAt: string;
  expectedArrivalAt: string;
  bufferMinutes: number;
  status: '여유' | '주의' | '긴급' | '위험';
  totalScore: number;
}

export interface RecommendResult {
  primaryRoute: RecommendedRoute;
  alternatives: RecommendedRoute[];
  status: '여유' | '주의' | '긴급' | '위험';
  allLate?: boolean;
  nextAction: string;
  confidenceScore: number;
  generatedAt: string;
}

export interface RecommendEmptyResult {
  routes: MobilityRoutePayload[];
  emptyState: {
    code: 'ROUTE_NO_RESULT' | 'ROUTE_EMPTY_AFTER_MAPPING' | 'ROUTE_INVALID_INPUT';
    title: string;
    description: string;
    retryable: boolean;
  };
}

export type RecommendResponse = RecommendResult | RecommendEmptyResult;

export interface MobilityRoutePayload {
  id: string;
  name: string;
  source: 'api' | 'fallback';
  estimatedTravelMinutes: number;
  realtimeAdjustedDurationMinutes?: number;
  delayRisk: number;
  delayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  score?: number;
  realtimeCoverage?: number;
  transferCount: number;
  walkingMinutes: number;
  mobilitySegments?: Array<{
    mode: 'walk' | 'bus' | 'subway' | 'car';
    durationMinutes: number;
    realtimeAdjustedDurationMinutes?: number;
    lineLabel?: string;
    lineId?: string;
    startName?: string;
    endName?: string;
    startStationId?: string;
    endStationId?: string;
    busRouteId?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    pathPoints?: Array<{
      lat: number;
      lng: number;
      label?: string;
    }>;
    passStops?: string[];
    routeGeometry?: Array<{
      lat: number;
      lng: number;
    }>;
    distanceMeters?: number;
    realtimeInfo?: {
      etaMinutes?: number;
      etaSeconds?: number;
      matchingConfidence?: number;
      trainStatusMessage?: string;
    };
    candidates?: Array<{
      route: string;
      etaMinutes: number;
      etaSeconds?: number;
      direction?: string;
    }>;
  }>;
}

export interface KakaoWalkGeometryPoint {
  lat: number;
  lng: number;
}

export interface TripStartRequest {
  userId?: string;
  recommendationId?: string;
  route: MobilityRoutePayload;
  targetArrivalTime: string;
  currentPosition: {
    lat: number;
    lng: number;
  };
}

export interface TripStartResult {
  tripId: string;
  routeId: string;
  status: '여유' | '주의' | '긴급';
  bufferMinutes: number;
  targetArrivalTime: string;
}

export interface TripPositionRequest {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface TripPositionResult {
  currentSegmentIndex: number;
  progress: number;
  isOffRoute: boolean;
  nextAction: string;
  distanceFromRouteMeters: number;
  matchingConfidence: number;
  ignored?: boolean;
  reason?: string;
}

export interface KakaoKeywordDocument {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_code?: string;
  category_group_name?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  place_url?: string;
  distance?: string;
}

export interface KakaoCoord2AddressDocument {
  road_address?: { address_name?: string };
  address?: { address_name?: string };
}

export interface KakaoNearbyPlace {
  placeName: string | null;
  address?: string;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  roadAddress?: string;
  jibunAddress?: string;
  poiName?: string;
  placeName?: string;
  accuracy?: number;
  candidates?: Array<{
    name: string;
    lat: number;
    lng: number;
    distance: number;
    category?: string;
    source: 'category' | 'keyword' | 'address';
    score: number;
  }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const ODSAY_ENDPOINT = 'https://api.odsay.com/v1/api/searchPubTransPathT';
const ODSAY_DETAILED_ENDPOINT = 'https://api.odsay.com/v1/api/searchPubTransPath';

function logApi(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.info('[TimeFitApi]', message, data);
    return;
  }

  console.info('[TimeFitApi]', message);
}

async function readApiEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.success) {
    throw new Error('API returned unsuccessful response');
  }

  return payload.data;
}

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

const RECOMMEND_CACHE_TTL_MS = 30_000;
const recommendCache = new Map<string, { expiresAt: number; value: RecommendResult }>();
const recommendInFlight = new Map<string, Promise<RecommendResult>>();
const KEYWORD_PROXY_CACHE_TTL_MS = 1200;
const keywordProxyCache = new Map<string, { expiresAt: number; value: KakaoKeywordDocument[] }>();
const keywordProxyInFlight = new Map<string, Promise<KakaoKeywordDocument[]>>();

function toRecommendCacheKey(input: RecommendRequest): string {
  return JSON.stringify({
    origin: {
      lat: Number(input.origin.lat.toFixed(5)),
      lng: Number(input.origin.lng.toFixed(5)),
      name: input.origin.name.trim(),
    },
    destination: {
      lat: Number(input.destination.lat.toFixed(5)),
      lng: Number(input.destination.lng.toFixed(5)),
      name: input.destination.name.trim(),
    },
    arrivalAt: input.arrivalAt,
  });
}

export async function recommendRoutes(input: RecommendRequest): Promise<RecommendResult> {
  const cacheKey = toRecommendCacheKey(input);
  const now = Date.now();
  const cached = recommendCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    logApi('recommendation call cache hit', {
      endpoint: 'recommendations/calculate',
      cacheTtlMs: Math.max(0, cached.expiresAt - now),
    });
    return cached.value;
  }

  const existingTask = recommendInFlight.get(cacheKey);
  if (existingTask) {
    logApi('recommendation call deduped (in-flight)', {
      endpoint: 'recommendations/calculate',
    });
    return existingTask;
  }

  const task = (async (): Promise<RecommendResult> => {
    logApi('recommendation call start', {
      endpoint: 'recommendations/calculate',
      origin: input.origin,
      destination: input.destination,
      arrivalAt: input.arrivalAt,
    });

    const response = await fetch(`${API_BASE_URL}/recommendations/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      logApi('recommendation call fail', {
        endpoint: 'recommendations/calculate',
        status: response.status,
      });
      throw new Error(`Recommendation failed: ${response.status}`);
    }

    const data = await readApiEnvelope<RecommendResponse>(response);
    logApi('recommendation call success', {
      endpoint: 'recommendations/calculate',
      hasEmptyState: 'emptyState' in data,
    });
    if ('emptyState' in data) {
      throw new Error(data.emptyState.description || '추천 가능한 경로가 없습니다.');
    }
    recommendCache.set(cacheKey, {
      expiresAt: Date.now() + RECOMMEND_CACHE_TTL_MS,
      value: data,
    });
    return data;
  })();

  recommendInFlight.set(cacheKey, task);
  try {
    return await task;
  } catch (error) {
    // 호출 제한 등 일시 오류 시 직전 캐시가 있으면 폴백한다.
    if (cached) {
      logApi('recommendation call fallback cache used', {
        endpoint: 'recommendations/calculate',
      });
      return cached.value;
    }
    throw error;
  } finally {
    recommendInFlight.delete(cacheKey);
  }
}

export async function fetchRouteCandidates(input: {
  origin: RecommendLocation;
  destination: RecommendLocation;
}) {
  const candidates = await fetchOdsayRouteCandidatesDirect(input);
  if (candidates.length === 0) {
    throw new Error('추천 가능한 대중교통 경로가 없습니다.');
  }
  return {
    source: 'api' as const,
    fetchedAt: new Date().toISOString(),
    cacheableForMs: 30_000,
    candidates,
  };
}

export async function fetchKakaoWalkGeometry(input: {
  origin: RecommendLocation;
  destination: RecommendLocation;
}): Promise<KakaoWalkGeometryPoint[]> {
  const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY is required for Kakao Directions API');
  }

  const params = new URLSearchParams({
    origin: `${input.origin.lng},${input.origin.lat}`,
    destination: `${input.destination.lng},${input.destination.lat}`,
    priority: 'RECOMMEND',
    alternatives: 'false',
    road_details: 'false',
  });

  const response = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Kakao Directions failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    routes?: Array<{
      sections?: Array<{
        roads?: Array<{
          vertexes?: number[];
        }>;
      }>;
    }>;
  };

  const vertexes = (body.routes?.[0]?.sections ?? [])
    .flatMap((section) => section.roads ?? [])
    .flatMap((road) => road.vertexes ?? []);

  if (vertexes.length < 4) {
    return [];
  }

  const points: KakaoWalkGeometryPoint[] = [];
  for (let index = 0; index < vertexes.length - 1; index += 2) {
    const lng = Number(vertexes[index]);
    const lat = Number(vertexes[index + 1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    points.push({ lat, lng });
  }
  return points;
}

async function fetchOdsayRouteCandidatesDirect(input: {
  origin: RecommendLocation;
  destination: RecommendLocation;
}): Promise<MobilityRoutePayload[]> {
  logApi('odsay direct call start', {
    endpoint: 'odsay/searchPubTransPathT',
    origin: input.origin,
    destination: input.destination,
  });

  const apiKey = process.env.EXPO_PUBLIC_ODSAY_API_KEY?.trim();
  if (!apiKey) {
    logApi('odsay direct call fail', {
      endpoint: 'odsay/searchPubTransPathT',
      reason: 'missing_key',
    });
    throw new Error('ODSAY API 키가 없습니다. EXPO_PUBLIC_ODSAY_API_KEY를 설정해주세요.');
  }

  const params = new URLSearchParams({
    SX: String(input.origin.lng),
    SY: String(input.origin.lat),
    EX: String(input.destination.lng),
    EY: String(input.destination.lat),
    apiKey,
    SearchType: '0',
    SearchPathType: '0',
    OPT: '0',
  });

  const response = await fetch(`${ODSAY_ENDPOINT}?${params.toString()}`);
  let body = (await response.json()) as {
    result?: {
      path?: Array<{
        pathType?: number;
        info?: { totalTime?: number };
      subPath?: Array<{
          trafficType?: number | string;
          sectionTime?: number;
          distance?: number;
          stationCount?: number;
          lane?: Array<{
            name?: string;
            busNo?: string;
            busID?: string | number;
            busLocalBlID?: string | number;
            busRouteId?: string | number;
            routeId?: string | number;
            subwayCode?: string | number;
            subwayID?: string | number;
            subwayId?: string | number;
          }>;
          startName?: string;
          endName?: string;
          startX?: number;
          startY?: number;
          endX?: number;
          endY?: number;
          startID?: string | number;
          endID?: string | number;
          stationID?: string | number;
          stationID2?: string | number;
          passStopList?: {
            stations?: Array<{
              x?: number | string;
              y?: number | string;
              stationName?: string;
              stationID?: string | number;
              stationId?: string | number;
            }>;
          };
        }>;
      }>;
      error?: { code?: number | string; msg?: string; message?: string };
    };
    error?: { code?: number | string; msg?: string; message?: string } | Array<{ code?: string; message?: string }>;
  };

  let providerError = normalizeOdsayError(body);
  let paths = body.result?.path ?? [];
  if (!providerError && paths.length > 0 && !hasAnyPassStops(paths)) {
    const detailedResponse = await fetch(`${ODSAY_DETAILED_ENDPOINT}?${params.toString()}`);
    if (detailedResponse.ok) {
      const detailedBody = (await detailedResponse.json()) as typeof body;
      const detailedError = normalizeOdsayError(detailedBody);
      const detailedPaths = detailedBody.result?.path ?? [];
      if (!detailedError && detailedPaths.length > 0 && hasAnyPassStops(detailedPaths)) {
        body = detailedBody;
        providerError = detailedError;
        paths = detailedPaths;
        logApi('odsay direct path upgraded', {
          endpoint: 'odsay/searchPubTransPath',
          pathCount: detailedPaths.length,
        });
      }
    }
  }

  if (providerError) {
    logApi('odsay direct call fail', {
      endpoint: 'odsay/searchPubTransPathT',
      code: providerError.code,
      message: providerError.message,
    });
    throw new Error(`ODSAY 호출 실패(${providerError.code}): ${providerError.message}`);
  }

  const candidates = paths
    .slice(0, 5)
    .map((path, index) => mapOdsayPathToRoute(path, index))
    .filter((route): route is MobilityRoutePayload => route !== null);
  logApi('odsay direct call success', {
    endpoint: 'odsay/searchPubTransPathT',
    pathCount: paths.length,
    candidateCount: candidates.length,
  });
  return candidates;
}

function normalizeOdsayError(body: {
  result?: { error?: { code?: number | string; msg?: string; message?: string } };
  error?: { code?: number | string; msg?: string; message?: string } | Array<{ code?: string; message?: string }>;
}): { code: string; message: string } | null {
  if (Array.isArray(body.error) && body.error[0]) {
    return {
      code: String(body.error[0].code ?? 'unknown'),
      message: body.error[0].message ?? 'unknown_error',
    };
  }

  const rootError = body.error as { code?: number | string; msg?: string; message?: string } | undefined;
  const nested = body.result?.error;
  const error = rootError ?? nested;
  if (!error) {
    return null;
  }

  return {
    code: String(error.code ?? 'unknown'),
    message: error.msg ?? error.message ?? 'unknown_error',
  };
}

function hasAnyPassStops(paths: Array<{ subPath?: Array<{ passStopList?: { stations?: unknown[] } }> }>) {
  return paths.some((path) =>
    (path.subPath ?? []).some((subPath) => (subPath.passStopList?.stations?.length ?? 0) > 0),
  );
}

function readText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function mapOdsayPathToRoute(
  path: {
    info?: { totalTime?: number };
    subPath?: Array<{
      trafficType?: number | string;
      sectionTime?: number;
      distance?: number;
      stationCount?: number;
      lane?: Array<{
        name?: string;
        busNo?: string;
        busID?: string | number;
        busLocalBlID?: string | number;
        busRouteId?: string | number;
        routeId?: string | number;
        subwayCode?: string | number;
        subwayID?: string | number;
        subwayId?: string | number;
      }>;
      startName?: string;
      endName?: string;
      startX?: number;
      startY?: number;
      endX?: number;
      endY?: number;
      startID?: string | number;
      endID?: string | number;
      stationID?: string | number;
      stationID2?: string | number;
      passStopList?: {
        stations?: Array<{
          x?: number | string;
          y?: number | string;
          stationName?: string;
          stationID?: string | number;
          stationId?: string | number;
        }>;
      };
    }>;
  },
  index: number,
): MobilityRoutePayload | null {
  type MobilitySegmentPayload = {
    mode: 'walk' | 'bus' | 'subway';
    durationMinutes: number;
    lineLabel?: string;
    lineId?: string;
    startName?: string;
    endName?: string;
    startStationId?: string;
    endStationId?: string;
    busRouteId?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    pathPoints?: Array<{
      lat: number;
      lng: number;
      label?: string;
    }>;
    passStops?: string[];
    routeGeometry?: Array<{
      lat: number;
      lng: number;
    }>;
    distanceMeters?: number;
    realtimeInfo?: {
      etaMinutes?: number;
      matchingConfidence?: number;
      trainStatusMessage?: string;
    };
  };

  const subPath = path.subPath ?? [];
  const mappedSegments: Array<MobilitySegmentPayload | null> = subPath.map((segment) => {
      const type = Number(segment.trafficType);
      const mode = type === 1 ? 'subway' : type === 2 ? 'bus' : type === 3 ? 'walk' : null;
      if (!mode) {
        return null;
      }
      const durationMinutes = Number(segment.sectionTime ?? 0);
      if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
        return null;
      }
      const stopPointsRaw =
        segment.passStopList?.stations?.map((station) => {
          const lat = Number(station.y);
          const lng = Number(station.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }
          return {
            lat,
            lng,
            label: station.stationName,
          };
        }) ?? [];
      const stopPoints = stopPointsRaw.filter(Boolean) as Array<{
        lat: number;
        lng: number;
        label?: string;
      }>;
      const lane = segment.lane?.[0];
      const lineId =
        mode === 'subway'
          ? readText(lane?.subwayCode) ?? readText(lane?.subwayID) ?? readText(lane?.subwayId)
          : mode === 'bus'
            ? readText(lane?.busID) ??
              readText(lane?.busLocalBlID) ??
              readText(lane?.busRouteId) ??
              readText(lane?.routeId)
            : undefined;
      const startStationId = readText(segment.startID) ?? readText(segment.stationID);
      const endStationId = readText(segment.endID) ?? readText(segment.stationID2);

      const pathPoints = [
        Number.isFinite(Number(segment.startY)) && Number.isFinite(Number(segment.startX))
          ? { lat: Number(segment.startY), lng: Number(segment.startX) }
          : null,
        ...stopPoints,
        Number.isFinite(Number(segment.endY)) && Number.isFinite(Number(segment.endX))
          ? { lat: Number(segment.endY), lng: Number(segment.endX) }
          : null,
      ].filter(Boolean) as Array<{ lat: number; lng: number; label?: string }>;
      const routeGeometry =
        pathPoints.length >= 2
          ? pathPoints.map((point) => ({
              lat: point.lat,
              lng: point.lng,
            }))
          : undefined;

      return {
        mode,
        durationMinutes: Math.max(1, durationMinutes),
        lineLabel:
          mode === 'subway'
            ? segment.lane?.[0]?.name ?? '지하철'
            : mode === 'bus'
              ? segment.lane?.[0]?.busNo ?? segment.lane?.[0]?.name ?? '버스'
              : undefined,
        lineId,
        startName: segment.startName,
        endName: segment.endName,
        startStationId: startStationId ?? undefined,
        endStationId: endStationId ?? undefined,
        busRouteId: mode === 'bus' ? lineId : undefined,
        startLat: segment.startY,
        startLng: segment.startX,
        endLat: segment.endY,
        endLng: segment.endX,
        pathPoints,
        routeGeometry,
        passStops: stopPoints.map((point) => point.label?.trim()).filter(Boolean) as string[],
        distanceMeters: Number(segment.distance ?? 0),
      } satisfies MobilitySegmentPayload;
    });
  const segments = mappedSegments.filter((segment): segment is MobilitySegmentPayload => segment !== null);

  const transitCount = segments.filter((segment) => segment.mode === 'bus' || segment.mode === 'subway').length;
  if (segments.length === 0 || transitCount === 0) {
    return null;
  }

  const walkingMinutes = segments
    .filter((segment) => segment.mode === 'walk')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const estimatedTravelMinutes = Number(path.info?.totalTime ?? 0) || segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const transferCount = Math.max(0, transitCount - 1);

  return {
    id: `odsay-client-${index + 1}`,
    name: `대중교통 추천 ${index + 1}`,
    source: 'api',
    estimatedTravelMinutes: Math.max(3, estimatedTravelMinutes),
    realtimeAdjustedDurationMinutes: Math.max(3, estimatedTravelMinutes),
    delayRisk: Math.max(0.05, Math.min(0.95, 0.14 + transferCount * 0.05)),
    transferCount,
    walkingMinutes,
    mobilitySegments: segments,
  };
}

export async function startTripTracking(input: TripStartRequest): Promise<TripStartResult> {
  const response = await fetch(`${API_BASE_URL}/trips/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Start trip failed: ${response.status}`);
  }
  return readApiEnvelope<TripStartResult>(response);
}

export async function sendTripPosition(
  tripId: string,
  input: TripPositionRequest,
): Promise<TripPositionResult> {
  const response = await fetch(`${API_BASE_URL}/trips/${encodeURIComponent(tripId)}/position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Trip position failed: ${response.status}`);
  }
  return readApiEnvelope<TripPositionResult>(response);
}

export async function searchKakaoKeywordViaProxy(query: string, size = 8): Promise<KakaoKeywordDocument[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const cacheKey = `${normalized.toLowerCase()}|${size}`;
  const now = Date.now();
  const cached = keywordProxyCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    logApi('kakao local proxy call cache hit', {
      keyType: 'REST',
      endpoint: 'search/keyword',
      size,
      query: normalized,
      cacheTtlMs: Math.max(0, cached.expiresAt - now),
    });
    return cached.value;
  }

  const existing = keywordProxyInFlight.get(cacheKey);
  if (existing) {
    logApi('kakao local proxy call deduped (in-flight)', {
      keyType: 'REST',
      endpoint: 'search/keyword',
      size,
      query: normalized,
    });
    return existing;
  }

  const task = (async () => {
    logApi('kakao local proxy call start', {
      keyType: 'REST',
      endpoint: 'search/keyword',
      size,
      query: normalized,
    });

    const params = new URLSearchParams({
      query: normalized,
      size: String(size),
    });

    const response = await fetch(`${API_BASE_URL}/kakao-local/search/keyword?${params.toString()}`);

    if (!response.ok) {
      logApi('kakao local proxy call fail', {
        keyType: 'REST',
        endpoint: 'search/keyword',
        size,
        query: normalized,
        status: response.status,
      });
      throw new Error(`Kakao keyword proxy failed: ${response.status}`);
    }

    const data = await readApiEnvelope<{ documents: KakaoKeywordDocument[] }>(response);
    logApi('kakao local proxy call success', {
      keyType: 'REST',
      endpoint: 'search/keyword',
      size,
      query: normalized,
      count: data.documents.length,
    });

    keywordProxyCache.set(cacheKey, {
      expiresAt: Date.now() + KEYWORD_PROXY_CACHE_TTL_MS,
      value: data.documents,
    });
    return data.documents;
  })();

  keywordProxyInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    keywordProxyInFlight.delete(cacheKey);
  }
}

export async function coord2AddressViaProxy(
  latitude: number,
  longitude: number,
): Promise<KakaoCoord2AddressDocument | null> {
  logApi('kakao local proxy call start', {
    keyType: 'REST',
    endpoint: 'geo/coord2address',
  });

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });

  const response = await fetch(`${API_BASE_URL}/kakao-local/geo/coord2address?${params.toString()}`);

  if (!response.ok) {
    logApi('kakao local proxy call fail', {
      keyType: 'REST',
      endpoint: 'geo/coord2address',
      status: response.status,
    });
    throw new Error(`Kakao coord2address proxy failed: ${response.status}`);
  }

  const data = await readApiEnvelope<{ document: KakaoCoord2AddressDocument | null }>(response);
  logApi('kakao local proxy call success', {
    keyType: 'REST',
    endpoint: 'geo/coord2address',
    found: Boolean(data.document),
  });

  return data.document;
}

export async function searchNearbyPlaceViaProxy(
  latitude: number,
  longitude: number,
  radius = 300,
): Promise<KakaoNearbyPlace> {
  logApi('kakao local proxy call start', {
    keyType: 'REST',
    endpoint: 'search/nearby-place',
    radius,
  });

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radius),
  });

  const response = await fetch(`${API_BASE_URL}/kakao-local/search/nearby-place?${params.toString()}`);

  if (!response.ok) {
    logApi('kakao local proxy call fail', {
      keyType: 'REST',
      endpoint: 'search/nearby-place',
      status: response.status,
    });
    throw new Error(`Kakao nearby place proxy failed: ${response.status}`);
  }

  const data = await readApiEnvelope<KakaoNearbyPlace>(response);
  logApi('kakao local proxy call success', {
    keyType: 'REST',
    endpoint: 'search/nearby-place',
    found: Boolean(data.placeName),
  });

  return data;
}

export async function getNearbyPoiLocationInfoViaProxy(
  latitude: number,
  longitude: number,
  radius = 120,
): Promise<LocationInfo> {
  logApi('kakao local proxy call start', {
    keyType: 'REST',
    endpoint: 'nearby-poi',
    radius,
  });

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radius),
  });

  const response = await fetch(`${API_BASE_URL}/kakao-local/nearby-poi?${params.toString()}`);

  if (!response.ok) {
    logApi('kakao local proxy call fail', {
      keyType: 'REST',
      endpoint: 'nearby-poi',
      status: response.status,
    });
    throw new Error(`Kakao nearby-poi proxy failed: ${response.status}`);
  }

  const data = await readApiEnvelope<LocationInfo>(response);
  logApi('kakao local proxy call success', {
    keyType: 'REST',
    endpoint: 'nearby-poi',
    placeName: data.placeName,
    poiName: data.poiName,
    roadAddress: data.roadAddress,
  });

  return data;
}
