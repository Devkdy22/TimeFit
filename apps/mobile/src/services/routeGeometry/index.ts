import { fetchBusRouteGeometry } from './busGeometry';
import { resolveSubwayGeometry } from './subwayGeometry';
import { RouteSegment, SegmentGeometry } from './types';
import { fetchWalkGeometry } from './walkGeometry';

/**
 * ODsay 경로검색 결과에서 파싱된 segments를 받아
 * 각 segment의 실제 geometry를 비동기로 조회한다.
 */
export async function fetchAllSegmentGeometries(segments: RouteSegment[]): Promise<SegmentGeometry[]> {
  const results = await Promise.allSettled(segments.map((segment) => fetchSegmentGeometry(segment)));

  return results
    .filter((r): r is PromiseFulfilledResult<SegmentGeometry> => r.status === 'fulfilled')
    .map((r) => r.value);
}

async function fetchSegmentGeometry(segment: RouteSegment): Promise<SegmentGeometry> {
  switch (segment.mode) {
    case 'WALK':
      return fetchWalkGeometry(segment);
    case 'BUS':
      return fetchBusRouteGeometry(segment);
    case 'SUBWAY':
      return resolveSubwayGeometry(segment);
    default:
      throw new Error(`Unknown mode: ${String((segment as { mode?: unknown }).mode)}`);
  }
}

export type { LatLng, RouteSegment, SegmentGeometry } from './types';
