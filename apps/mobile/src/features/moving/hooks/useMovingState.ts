import { useMemo } from 'react';
import { useMockRouteMotion } from '../../map/useMockRouteMotion';
import { resolveMovingStatus } from '../status-config';
import { resolveTimiState } from '../timi-config';
import { movingMapMockData } from '../../../mocks/map';
import type { MapCoordinate } from '../../map/types';

const statusOrder = {
  relaxed: 0,
  warning: 1,
  urgent: 2,
} as const;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(start: MapCoordinate, end: MapCoordinate) {
  const earthRadius = 6371000;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function getRouteDistanceMeters(points: MapCoordinate[]) {
  if (points.length < 2) {
    return 0;
  }

  return points.slice(1).reduce((sum, point, index) => sum + getDistanceMeters(points[index], point), 0);
}

export function useMovingState() {
  const { currentLocation, progress } = useMockRouteMotion(movingMapMockData.routePath.points);
  const movingStatus = resolveMovingStatus(progress);
  const timiState = resolveTimiState(movingStatus.status);

  const routeDistance = useMemo(
    () => getRouteDistanceMeters(movingMapMockData.routePath.points),
    [],
  );
  const progressPercent = Math.round(progress * 100);
  const remainingRatio = Math.max(0, 1 - progress);
  const remainingDistanceMeters = Math.max(20, Math.round((routeDistance * remainingRatio) / 10) * 10);
  const remainingMinutes = Math.max(1, Math.round(remainingDistanceMeters / 78));

  const mapData = useMemo(
    () => ({
      ...movingMapMockData,
      currentLocation,
      nextActionPoint: {
        ...movingMapMockData.nextActionPoint,
        status: movingStatus.status,
        instruction: movingStatus.nextActionText,
      },
    }),
    [currentLocation, movingStatus.nextActionText, movingStatus.status],
  );

  return {
    progress,
    progressPercent,
    statusIndex: statusOrder[movingStatus.status],
    remainingDistanceText: `${remainingDistanceMeters}m`,
    remainingTimeText: `${remainingMinutes}분`,
    movingStatus,
    timiState,
    mapData,
  };
}
