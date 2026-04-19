import { Platform } from 'react-native';

function resolveApiBaseUrl() {
  const raw =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'http://localhost:3000';

  try {
    const parsed = new URL(raw);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    // Android emulator cannot reach host machine via localhost.
    if (Platform.OS === 'android' && isLocalhost) {
      parsed.hostname = '10.0.2.2';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:3000';
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
}

export interface RecommendedRoute {
  route: {
    id: string;
    name: string;
    source: 'api' | 'fallback';
    estimatedTravelMinutes: number;
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
  nextAction: string;
  confidenceScore: number;
  generatedAt: string;
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

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function recommendRoutes(input: RecommendRequest): Promise<RecommendResult> {
  const response = await fetch(`${API_BASE_URL}/recommendations/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Recommendation failed: ${response.status}`);
  }

  return readApiEnvelope<RecommendResult>(response);
}

export async function searchKakaoKeywordViaProxy(query: string, size = 8): Promise<KakaoKeywordDocument[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  logApi('kakao local proxy call start', {
    keyType: 'REST',
    endpoint: 'search/keyword',
    size,
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
      status: response.status,
    });
    throw new Error(`Kakao keyword proxy failed: ${response.status}`);
  }

  const data = await readApiEnvelope<{ documents: KakaoKeywordDocument[] }>(response);
  logApi('kakao local proxy call success', {
    keyType: 'REST',
    endpoint: 'search/keyword',
    count: data.documents.length,
  });

  return data.documents;
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
