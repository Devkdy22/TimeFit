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

export const API_BASE_URL = resolveApiBaseUrl();
const REFRESH_TIMEOUT_MS = 10_000;
const DEV_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

type AuthMode = 'protected' | 'public';

interface AuthSessionBridge {
  getAccessToken: () => string | null;
  getSessionGeneration: () => number;
  refreshSession: (signal: AbortSignal | null | undefined, generation: number) => Promise<boolean>;
  onAuthFailure: (reason: 'REFRESH_FAILED' | 'REFRESH_TIMEOUT' | 'REFRESH_ABORTED') => void;
  onRefreshTimeout?: (scope: 'authorized_fetch' | 'hydration') => void;
}

const AUTH_PUBLIC_ALLOWLIST: ReadonlyArray<{ method?: string; pathPrefix: string }> = [
  { method: 'GET', pathPrefix: '/health' },
  { method: 'POST', pathPrefix: '/auth/social/login' },
  { method: 'POST', pathPrefix: '/auth/session/redeem' },
  { method: 'POST', pathPrefix: '/auth/refresh' },
  { method: 'POST', pathPrefix: '/auth/logout' },
  { method: 'GET', pathPrefix: '/kakao-local/' },
  { method: 'GET', pathPrefix: '/kakao-local' },
];

let authBridge: AuthSessionBridge | null = null;
let refreshInFlight: Promise<void> | null = null;
let authFailureNotified = false;
let refreshAbortController: AbortController | null = null;

export function configureAuthSessionBridge(next: AuthSessionBridge | null): void {
  authBridge = next;
  if (next?.getAccessToken()) {
    authFailureNotified = false;
  }
}

export function getCurrentAccessTokenForTransport(): string | null {
  return authBridge?.getAccessToken() ?? null;
}

export function abortPendingAuthRefresh(): void {
  if (refreshAbortController) {
    refreshAbortController.abort();
  }
}

export type SocialProvider = 'google' | 'kakao' | 'naver';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userId: string;
}

export interface AuthProfile {
  id: string;
  name: string | null;
  email: string | null;
  provider: SocialProvider | null;
}

export interface RoutineListItem {
  id: string;
  userId: string;
  title: string;
  origin: {
    name: string;
    lat: number;
    lng: number;
  };
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  weekdays: number[];
  arrivalTime: string;
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  favorite: boolean;
  active: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutineRequest {
  title: string;
  origin: {
    name: string;
    lat: number;
    lng: number;
  };
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  weekdays: number[];
  arrivalTime: string;
  notificationEnabled?: boolean;
  notificationMinutesBefore?: number;
  favorite?: boolean;
  active?: boolean;
  savedRoute?: {
    id: string;
    name: string;
    busRouteId?: string;
    busStationId?: string;
    routeType?: 'subway-heavy' | 'bus-heavy' | 'walking-heavy' | 'mixed' | 'bus' | 'subway' | 'car';
    estimatedTravelMinutes: number;
    delayRisk: number;
    transferCount: number;
    walkingMinutes: number;
  };
  expoPushToken?: string;
}

export type UpdateRoutineRequest = Partial<CreateRoutineRequest>;

export interface SavedPlaceItem {
  id: string;
  userId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedPlaceRequest {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

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

export interface TripSnapshotResult {
  trip: {
    id: string;
    userId?: string;
    status: 'preparing' | 'moving' | 'arrived' | string;
  };
  route: MobilityRoutePayload | null;
  status: '여유' | '주의' | '긴급' | null;
  bufferMinutes: number | null;
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

function pathFromApiUrl(url: string): string | null {
  if (!url.startsWith(API_BASE_URL)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      return pathname.slice(0, -1);
    }
    return pathname;
  } catch {
    const path = url.slice(API_BASE_URL.length).split('?')[0] ?? '';
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      return normalized.slice(0, -1);
    }
    return normalized;
  }
}

function isPublicAllowlisted(url: string, method: string): boolean {
  const path = pathFromApiUrl(url);
  if (!path) {
    return true;
  }
  const normalizedMethod = method.toUpperCase();
  return AUTH_PUBLIC_ALLOWLIST.some(
    (rule) =>
      path.startsWith(rule.pathPrefix) &&
      (rule.method === undefined || rule.method.toUpperCase() === normalizedMethod),
  );
}

function mergeAbortSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) {
    return undefined;
  }

  const aborted = active.find((signal) => signal.aborted);
  if (aborted) {
    return aborted;
  }

  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
    for (const signal of active) {
      signal.removeEventListener('abort', onAbort);
    }
  };
  for (const signal of active) {
    signal.addEventListener('abort', onAbort);
  }

  return controller.signal;
}

async function runRefreshWithTimeout(signal?: AbortSignal | null): Promise<void> {
  if (!authBridge) {
    throw new Error('auth_bridge_missing');
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const timeoutController = new AbortController();
      refreshAbortController = new AbortController();
      const capturedGeneration = authBridge.getSessionGeneration();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, REFRESH_TIMEOUT_MS);
      try {
        const mergedSignal = mergeAbortSignals([signal, timeoutController.signal, refreshAbortController.signal]);
        const applied = await authBridge.refreshSession(mergedSignal, capturedGeneration);
        if (!applied) {
          throw new Error('refresh_result_discarded');
        }
        authFailureNotified = false;
      } catch (error) {
        if (timeoutController.signal.aborted) {
          authBridge.onRefreshTimeout?.('authorized_fetch');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
        refreshAbortController = null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

interface AuthorizedFetchOptions extends RequestInit {
  authMode?: AuthMode;
  authRetryCount?: 0 | 1;
}

async function authorizedFetch(url: string, options?: AuthorizedFetchOptions): Promise<Response> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const authMode = options?.authMode ?? 'protected';

  if (authMode === 'public' && DEV_MODE && !isPublicAllowlisted(url, method)) {
    console.warn('[TimeFitApi][AuthPolicy] Public call is not allowlisted.', { method, url });
  }

  const headers = new Headers(options?.headers);
  const accessToken = authBridge?.getAccessToken() ?? null;
  if (authMode === 'protected' && !accessToken) {
    throw new Error('auth_required');
  }
  if (authMode === 'protected' && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (authMode !== 'protected') {
    return response;
  }

  const retryCount = options?.authRetryCount ?? 0;
  const hasAbortSignal = Boolean(options?.signal);
  if (response.status !== 401 || retryCount >= 1 || !authBridge) {
    return response;
  }

  if (hasAbortSignal && options?.signal?.aborted) {
    return response;
  }

  try {
    await runRefreshWithTimeout(options?.signal);
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }
    if (!authFailureNotified) {
      authFailureNotified = true;
      if (options?.signal?.aborted) {
        authBridge.onAuthFailure('REFRESH_ABORTED');
      } else if (error instanceof Error && error.name === 'AbortError') {
        authBridge.onAuthFailure('REFRESH_TIMEOUT');
      } else {
        authBridge.onAuthFailure('REFRESH_FAILED');
      }
    }
    throw error;
  }

  const retryHeaders = new Headers(options?.headers);
  const refreshedAccessToken = authBridge.getAccessToken();
  if (!refreshedAccessToken) {
    return response;
  }
  if (refreshedAccessToken) {
    retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);
  }

  return fetch(url, {
    ...options,
    headers: retryHeaders,
    authRetryCount: undefined,
  } as RequestInit);
}

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function checkOAuthServerHealth(signal?: AbortSignal | null): Promise<Response> {
  return fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    signal: signal ?? undefined,
  });
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
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Route candidates failed: ${response.status}`);
  }
  const data = await readApiEnvelope<{
    source: 'api' | 'fallback';
    status: 'OK' | 'NO_RESULT' | 'MAPPING_FAILED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_DOWN' | 'INVALID_INPUT';
    fetchedAt: string;
    cacheableForMs: number;
    candidates: MobilityRoutePayload[];
    emptyState?: {
      description?: string;
    };
  }>(response);
  if (data.status !== 'OK' || data.candidates.length === 0) {
    throw new Error(data.emptyState?.description || '추천 가능한 대중교통 경로가 없습니다.');
  }
  return data;
}

export async function fetchKakaoWalkGeometry(input: {
  origin: RecommendLocation;
  destination: RecommendLocation;
}): Promise<KakaoWalkGeometryPoint[]> {
  const params = new URLSearchParams({
    originLat: String(input.origin.lat),
    originLng: String(input.origin.lng),
    destinationLat: String(input.destination.lat),
    destinationLng: String(input.destination.lng),
  });

  const response = await fetch(`${API_BASE_URL}/kakao-local/directions/walk?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Kakao Directions proxy failed: ${response.status}`);
  }
  const data = await readApiEnvelope<{
    points: KakaoWalkGeometryPoint[];
  }>(response);
  return data.points;
}

export async function startTripTracking(
  input: TripStartRequest,
  options: { idempotencyKey?: string } = {},
): Promise<TripStartResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await authorizedFetch(`${API_BASE_URL}/trips/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Start trip failed: ${response.status}`);
  }
  return readApiEnvelope<TripStartResult>(response);
}

export async function getTripTracking(tripId: string): Promise<TripSnapshotResult> {
  const response = await authorizedFetch(`${API_BASE_URL}/trips/${encodeURIComponent(tripId)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Get trip failed: ${response.status}`);
  }
  return readApiEnvelope<TripSnapshotResult>(response);
}

export async function sendTripPosition(
  tripId: string,
  input: TripPositionRequest,
): Promise<TripPositionResult> {
  const response = await authorizedFetch(`${API_BASE_URL}/trips/${encodeURIComponent(tripId)}/position`, {
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

export async function loginWithSocialProvider(input: {
  provider: SocialProvider;
  idToken?: string;
  accessToken?: string;
  authorizationCode?: string;
  redirectUri?: string;
  state?: string;
}): Promise<AuthTokens> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/social/login`, {
    method: 'POST',
    authMode: 'public',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Social login failed: ${response.status}`);
  }
  return readApiEnvelope<AuthTokens>(response);
}

export function buildOAuthStartUrl(provider: SocialProvider, returnTo: string): string {
  return `${API_BASE_URL}/auth/${provider}/start?${new URLSearchParams({ returnTo }).toString()}`;
}

export async function redeemOAuthLoginTicket(ticket: string): Promise<AuthTokens> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/session/redeem`, {
    method: 'POST',
    authMode: 'public',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  if (!response.ok) {
    throw new Error(`OAuth ticket redeem failed: ${response.status}`);
  }
  return readApiEnvelope<AuthTokens>(response);
}

export async function refreshAuthSession(
  refreshToken: string,
  signal?: AbortSignal | null,
): Promise<AuthTokens> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    authMode: 'public',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error(`Refresh failed: ${response.status}`);
  }
  return readApiEnvelope<AuthTokens>(response);
}

export async function logoutAuthSession(refreshToken: string, accessToken?: string): Promise<void> {
  await authorizedFetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    authMode: 'public',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getMyAuthProfile(accessToken: string): Promise<AuthProfile> {
  const response = await authorizedFetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    authMode: 'protected',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Get auth profile failed: ${response.status}`);
  }

  const data = await readApiEnvelope<{
    id?: string;
    name?: string | null;
    email?: string | null;
    provider?: SocialProvider | null;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      provider?: SocialProvider | null;
    };
  }>(response);

  const source = data.user ?? data;
  if (!source.id) {
    throw new Error('Auth profile is missing id.');
  }

  return {
    id: source.id,
    name: source.name ?? null,
    email: source.email ?? null,
    provider: source.provider ?? null,
  };
}

export async function getRoutines(signal?: AbortSignal): Promise<RoutineListItem[]> {
  const response = await authorizedFetch(`${API_BASE_URL}/routines`, {
    method: 'GET',
    authMode: 'protected',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Get routines failed: ${response.status}`);
  }

  return readApiEnvelope<RoutineListItem[]>(response);
}

export async function createRoutine(
  input: CreateRoutineRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<RoutineListItem> {
  const response = await authorizedFetch(`${API_BASE_URL}/routines`, {
    method: 'POST',
    authMode: 'protected',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const errorPayload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = errorPayload.error?.code;
    } catch {
      code = undefined;
    }
    throw new ApiRequestError(`Create routine failed: ${response.status}`, response.status, code);
  }

  return readApiEnvelope<RoutineListItem>(response);
}

export async function updateRoutine(
  id: string,
  input: UpdateRoutineRequest,
  signal?: AbortSignal,
): Promise<RoutineListItem> {
  const response = await authorizedFetch(`${API_BASE_URL}/routines/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    authMode: 'protected',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiRequestError(`Update routine failed: ${response.status}`, response.status);
  }

  return readApiEnvelope<RoutineListItem>(response);
}

export async function deleteRoutine(id: string, signal?: AbortSignal): Promise<void> {
  const response = await authorizedFetch(`${API_BASE_URL}/routines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    authMode: 'protected',
    signal,
  });

  if (!response.ok) {
    throw new ApiRequestError(`Delete routine failed: ${response.status}`, response.status);
  }
}

export async function getMyPlaces(signal?: AbortSignal): Promise<SavedPlaceItem[]> {
  const response = await authorizedFetch(`${API_BASE_URL}/me/places`, {
    method: 'GET',
    authMode: 'protected',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Get saved places failed: ${response.status}`);
  }

  return readApiEnvelope<SavedPlaceItem[]>(response);
}

export async function createMyPlace(
  input: CreateSavedPlaceRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<SavedPlaceItem> {
  const response = await authorizedFetch(`${API_BASE_URL}/me/places`, {
    method: 'POST',
    authMode: 'protected',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const errorPayload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = errorPayload.error?.code;
    } catch {
      code = undefined;
    }
    throw new ApiRequestError(`Create saved place failed: ${response.status}`, response.status, code);
  }

  return readApiEnvelope<SavedPlaceItem>(response);
}

export async function deleteMyPlace(id: string, signal?: AbortSignal): Promise<{ id: string }> {
  const response = await authorizedFetch(`${API_BASE_URL}/me/places/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    authMode: 'protected',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Delete saved place failed: ${response.status}`);
  }

  return readApiEnvelope<{ id: string }>(response);
}
