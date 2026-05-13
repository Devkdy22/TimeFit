import { fetchPublicBusRouteStops } from '../publicDataApi';
import { fetchSeoulBusRouteStops } from '../seoulBusApi';
import { cutGeometryBetweenStops } from './geometryUtils';
import { logFallback, logGeometry } from './logger';
import { LatLng, RouteSegment, SegmentGeometry } from './types';

/**
 * 버스 노선의 실제 geometry를 조회한다.
 * 우선순위:
 * 1. 서울시 버스 API (getRoutePathList)
 * 2. 공공데이터포털 버스 API
 * 3. passStops fallback (최후 수단, 경고 로그)
 */
export async function fetchBusRouteGeometry(segment: RouteSegment): Promise<SegmentGeometry> {
  const { segmentId, busRouteId, startStopCoord, endStopCoord, passStops, busColor } = segment;

  const color = busColor ?? '#1976D2';

  const startCoord: LatLng = startStopCoord ?? (passStops && passStops.length > 0 ? passStops[0].coord : segment.startCoord);
  const endCoord: LatLng =
    endStopCoord ??
    (passStops && passStops.length > 0 ? passStops[passStops.length - 1].coord : segment.endCoord);

  if (!busRouteId) {
    return fallbackPassStops(segment, startCoord, endCoord, color);
  }

  try {
    const fullRouteGeometry = await fetchSeoulBusRouteStops(busRouteId);

    if (fullRouteGeometry.length >= 2) {
      const sliced = cutGeometryBetweenStops(fullRouteGeometry, startCoord, endCoord);
      const pointCount = sliced.length;

      logGeometry({
        mode: 'BUS',
        source: 'seoul-bus-routepath',
        pointCount,
        segmentId,
      });

      return {
        segmentId,
        mode: 'BUS',
        coordinates: sliced,
        source: 'seoul-bus-routepath',
        pointCount,
        color,
        isDashed: false,
      };
    }
  } catch (err) {
    console.warn('[RouteGeometry][BUS] Seoul API 실패, 공공데이터 시도', { segmentId, err });
  }

  try {
    const cityCode = detectCityCode(busRouteId);
    const fullRouteGeometry = await fetchPublicBusRouteStops(busRouteId, cityCode);

    if (fullRouteGeometry.length >= 2) {
      const sliced = cutGeometryBetweenStops(fullRouteGeometry, startCoord, endCoord);
      const pointCount = sliced.length;

      logGeometry({
        mode: 'BUS',
        source: 'public-data-bus',
        pointCount,
        segmentId,
      });

      return {
        segmentId,
        mode: 'BUS',
        coordinates: sliced,
        source: 'public-data-bus',
        pointCount,
        color,
        isDashed: false,
      };
    }
  } catch (err) {
    console.warn('[RouteGeometry][BUS] 공공데이터 API 실패, fallback 진행', { segmentId, err });
  }

  return fallbackPassStops(segment, startCoord, endCoord, color);
}

function fallbackPassStops(segment: RouteSegment, startCoord: LatLng, endCoord: LatLng, color: string): SegmentGeometry {
  logFallback('BUS', segment.segmentId, '모든 API 실패 또는 busRouteId 없음');

  const coordinates: LatLng[] =
    segment.passStops && segment.passStops.length > 0
      ? segment.passStops.map((s) => s.coord)
      : [startCoord, endCoord];

  const pointCount = coordinates.length;

  logGeometry({
    mode: 'BUS',
    source: 'fallback-passstops',
    pointCount,
    segmentId: segment.segmentId,
    warning: 'FALLBACK_PASS_STOPS 사용 중 - 실제 노선과 맞지 않을 수 있음',
  });

  return {
    segmentId: segment.segmentId,
    mode: 'BUS',
    coordinates,
    source: 'fallback-passstops',
    pointCount,
    color,
    isDashed: false,
  };
}

/**
 * busRouteId 또는 기타 정보로 도시 코드 추정
 * 실제 서비스에서는 ODsay 응답의 도시 정보를 파싱하여 사용
 */
function detectCityCode(busRouteId: string): string {
  if (busRouteId.startsWith('1000')) return '11';
  if (busRouteId.startsWith('2000')) return '31';
  if (busRouteId.startsWith('3000')) return '22';
  return '11';
}
