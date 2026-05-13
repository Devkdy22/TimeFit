import type { LocationInput } from '../types/recommendation.types';
import type {
  KakaoMapBounds,
  KakaoMapMarker,
  KakaoMapOverlay,
  KakaoPolylineSegment,
  OdsayPath,
  OdsaySubPath,
} from '../types/transit';

export function buildKakaoMapOverlay(
  path: OdsayPath,
  origin: LocationInput,
  destination: LocationInput,
): KakaoMapOverlay {
  const subPaths = path.subPath ?? [];
  const polylineSegments = subPaths
    .map((subPath) => toPolylineSegment(subPath))
    .filter((segment): segment is KakaoPolylineSegment => segment !== null);

  const markers: KakaoMapMarker[] = [
    {
      id: 'origin',
      type: 'origin',
      label: origin.name,
      lat: origin.lat,
      lng: origin.lng,
    },
    {
      id: 'destination',
      type: 'destination',
      label: destination.name,
      lat: destination.lat,
      lng: destination.lng,
    },
  ];

  subPaths.forEach((subPath, index) => {
    const point = resolveTransferPoint(subPath);
    if (!point) {
      return;
    }

    if (index > 0 && index < subPaths.length - 1) {
      markers.push({
        id: `transfer-${index}`,
        type: 'transfer',
        label: subPath.startName ?? '환승',
        lat: point.lat,
        lng: point.lng,
      });
    }
  });

  const bounds = computeBounds(polylineSegments, markers, origin, destination);
  return {
    polylineSegments,
    markers,
    bounds,
  };
}

function toPolylineSegment(subPath: OdsaySubPath): KakaoPolylineSegment | null {
  const normalizedTrafficType = Number(subPath.trafficType);
  const mode = mapTrafficTypeToOverlayMode(normalizedTrafficType);
  if (!mode) {
    return null;
  }

  const passStations = subPath.passStopList?.stations ?? [];
  const passPoints = passStations
    .map((station) => {
      const lat = parseCoordinate(station.y);
      const lng = parseCoordinate(station.x);
      if (lat === undefined || lng === undefined) {
        return null;
      }
      return { lat, lng };
    })
    .filter((point): point is { lat: number; lng: number } => point !== null);

  const points: Array<{ lat: number; lng: number }> = [];
  const start = resolveStartPoint(subPath);
  const end = resolveEndPoint(subPath);

  if (start) {
    points.push(start);
  }

  for (const point of passPoints) {
    points.push(point);
  }

  if (end) {
    points.push(end);
  }

  if (points.length < 2) {
    return null;
  }

  return {
    mode,
    points,
  };
}

function computeBounds(
  polylineSegments: KakaoPolylineSegment[],
  markers: KakaoMapMarker[],
  origin: LocationInput,
  destination: LocationInput,
): KakaoMapBounds {
  const lats = [origin.lat, destination.lat];
  const lngs = [origin.lng, destination.lng];

  for (const marker of markers) {
    lats.push(marker.lat);
    lngs.push(marker.lng);
  }

  for (const segment of polylineSegments) {
    for (const point of segment.points) {
      lats.push(point.lat);
      lngs.push(point.lng);
    }
  }

  return {
    minLat: Math.min(...lats),
    minLng: Math.min(...lngs),
    maxLat: Math.max(...lats),
    maxLng: Math.max(...lngs),
  };
}

function mapTrafficTypeToOverlayMode(trafficType: number): 'subway' | 'bus' | 'walk' | null {
  if (trafficType === 1) {
    return 'subway';
  }
  if (trafficType === 2) {
    return 'bus';
  }
  if (trafficType === 3) {
    return 'walk';
  }
  return null;
}

function resolveStartPoint(subPath: OdsaySubPath): { lat: number; lng: number } | null {
  const lat = parseCoordinate(subPath.startY);
  const lng = parseCoordinate(subPath.startX);

  if (lat === undefined || lng === undefined) {
    return null;
  }

  return { lat, lng };
}

function resolveEndPoint(subPath: OdsaySubPath): { lat: number; lng: number } | null {
  const lat = parseCoordinate(subPath.endY);
  const lng = parseCoordinate(subPath.endX);

  if (lat === undefined || lng === undefined) {
    return null;
  }

  return { lat, lng };
}

function resolveTransferPoint(subPath: OdsaySubPath): { lat: number; lng: number } | null {
  return resolveStartPoint(subPath) ?? resolveEndPoint(subPath);
}

function parseCoordinate(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}
