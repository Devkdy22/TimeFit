import { fetchKakaoDirectionsGeometry } from '../kakaoDirectionsApi';
import { logFallback, logGeometry } from './logger';
import { RouteSegment, SegmentGeometry } from './types';

export async function fetchWalkGeometry(segment: RouteSegment): Promise<SegmentGeometry> {
  const { segmentId, startCoord, endCoord } = segment;

  try {
    const coordinates = await fetchKakaoDirectionsGeometry({
      origin: startCoord,
      destination: endCoord,
      priority: 'RECOMMEND',
    });

    const pointCount = coordinates.length;

    logGeometry({
      mode: 'WALK',
      source: 'kakao-directions',
      pointCount,
      segmentId,
    });

    if (pointCount < 2) {
      throw new Error('Kakao Directions returned insufficient points');
    }

    return {
      segmentId,
      mode: 'WALK',
      coordinates,
      source: 'kakao-directions',
      pointCount,
      color: '#9E9E9E',
      isDashed: true,
    };
  } catch (err) {
    console.warn('[RouteGeometry][WALK][FALLBACK]', { segmentId, err });
    logFallback('WALK', segmentId, String(err));

    const coordinates = [startCoord, endCoord];

    logGeometry({
      mode: 'WALK',
      source: 'fallback-two-points',
      pointCount: 2,
      segmentId,
      warning: 'Kakao Directions 실패, two-point fallback 사용',
    });

    return {
      segmentId,
      mode: 'WALK',
      coordinates,
      source: 'fallback-two-points',
      pointCount: 2,
      color: '#9E9E9E',
      isDashed: true,
    };
  }
}
