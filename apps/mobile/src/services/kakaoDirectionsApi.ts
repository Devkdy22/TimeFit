import { LatLng } from './routeGeometry/types';
import { fetchKakaoWalkGeometry } from './api/client';

interface KakaoDirectionsOptions {
  origin: LatLng;
  destination: LatLng;
  priority?: 'RECOMMEND' | 'TIME' | 'DISTANCE';
}

/**
 * TimeFit backend proxy를 통해 Kakao Mobility Directions geometry를 조회한다.
 */
export async function fetchKakaoDirectionsGeometry(options: KakaoDirectionsOptions): Promise<LatLng[]> {
  const { origin, destination } = options;
  const points = await fetchKakaoWalkGeometry({
    origin: { name: 'origin', lat: origin.latitude, lng: origin.longitude },
    destination: { name: 'destination', lat: destination.latitude, lng: destination.longitude },
  });
  return points.map((point) => ({ latitude: point.lat, longitude: point.lng }));
}
