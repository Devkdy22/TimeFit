import type { MapCoordinate } from '../../map/types';

function nearestPointIndex(points: MapCoordinate[], target: MapCoordinate): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const latDelta = point.lat - target.lat;
    const lngDelta = point.lng - target.lng;
    const distance = latDelta * latDelta + lngDelta * lngDelta;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function sliceBusRoutePath(
  path: MapCoordinate[],
  start: MapCoordinate | null,
  end: MapCoordinate | null,
): MapCoordinate[] {
  if (path.length < 2 || !start || !end) return path;
  const startIndex = nearestPointIndex(path, start);
  const endIndex = nearestPointIndex(path, end);
  if (startIndex <= endIndex) return path.slice(startIndex, endIndex + 1);
  return path.slice(endIndex, startIndex + 1).reverse();
}
