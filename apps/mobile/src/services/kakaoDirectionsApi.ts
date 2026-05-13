import { parseKakaoVertexes } from './routeGeometry/geometryUtils';
import { LatLng } from './routeGeometry/types';

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

interface KakaoDirectionsOptions {
  origin: LatLng;
  destination: LatLng;
  priority?: 'RECOMMEND' | 'TIME' | 'DISTANCE';
}

interface KakaoDirectionsRoad {
  vertexes?: number[];
}

interface KakaoDirectionsSection {
  roads?: KakaoDirectionsRoad[];
}

interface KakaoDirectionsResponse {
  routes?: Array<{
    sections?: KakaoDirectionsSection[];
  }>;
}

/**
 * Kakao Mobility Directions API 호출
 * 도보 경로: priority=RECOMMEND, 자동차 경로 기반이지만 vertexes 품질은 충분
 * 실제 도보 API가 있다면 endpoint를 교체한다.
 */
export async function fetchKakaoDirectionsGeometry(options: KakaoDirectionsOptions): Promise<LatLng[]> {
  const { origin, destination, priority = 'RECOMMEND' } = options;

  if (!KAKAO_REST_API_KEY) {
    throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY is missing');
  }

  const url =
    `https://apis-navi.kakaomobility.com/v1/directions` +
    `?origin=${origin.longitude},${origin.latitude}` +
    `&destination=${destination.longitude},${destination.latitude}` +
    `&priority=${priority}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Kakao Directions API error: ${response.status}`);
  }

  const data = (await response.json()) as KakaoDirectionsResponse;

  const coords: LatLng[] = [];
  const sections = data.routes?.[0]?.sections ?? [];
  for (const section of sections) {
    for (const road of section.roads ?? []) {
      const parsed = parseKakaoVertexes(road.vertexes ?? []);
      coords.push(...parsed);
    }
  }

  return coords;
}
