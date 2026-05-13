import { LatLng } from './types';

/** 두 좌표 간 Haversine 거리 (미터) */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** geometry 배열에서 target 좌표와 가장 가까운 index 반환 */
export function findNearestIndex(geometry: LatLng[], target: LatLng): number {
  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < geometry.length; i += 1) {
    const d = haversineDistance(geometry[i], target);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }

  return minIdx;
}

/**
 * 전체 노선 geometry에서 startStop ~ endStop 구간만 추출
 * - startIdx > endIdx이면 역방향으로 slice 후 reverse
 */
export function cutGeometryBetweenStops(routeGeometry: LatLng[], startStop: LatLng, endStop: LatLng): LatLng[] {
  if (routeGeometry.length < 2) return routeGeometry;

  const startIdx = findNearestIndex(routeGeometry, startStop);
  const endIdx = findNearestIndex(routeGeometry, endStop);

  if (startIdx === endIdx) {
    return [routeGeometry[startIdx]];
  }

  if (startIdx < endIdx) {
    return routeGeometry.slice(startIdx, endIdx + 1);
  }

  return routeGeometry.slice(endIdx, startIdx + 1).reverse();
}

/**
 * Kakao Directions vertexes 배열 파싱
 * vertexes = [lng, lat, lng, lat, ...]
 */
export function parseKakaoVertexes(vertexes: number[]): LatLng[] {
  const result: LatLng[] = [];
  for (let i = 0; i + 1 < vertexes.length; i += 2) {
    result.push({ longitude: vertexes[i], latitude: vertexes[i + 1] });
  }
  return result;
}
