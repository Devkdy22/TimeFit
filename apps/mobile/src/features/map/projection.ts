import { useMemo } from 'react';
import type { CurrentLocation, MapCoordinate, MovingMapData } from './types';
import type { Point2D, Segment } from './render-model';

export const MAP_PROJECTION = {
  width: 360,
  height: 320,
  padding: 24,
} as const;

export interface ProjectedMapData {
  currentPoint: Point2D;
  nextActionPoint: Point2D;
  segments: Segment[];
}

function toProjectedPoint(
  coordinate: MapCoordinate,
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  },
): Point2D {
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const normalizedX = (coordinate.lng - bounds.minLng) / lngRange;
  const normalizedY = (bounds.maxLat - coordinate.lat) / latRange;

  const mapWidth = MAP_PROJECTION.width - MAP_PROJECTION.padding * 2;
  const mapHeight = MAP_PROJECTION.height - MAP_PROJECTION.padding * 2;

  return {
    x: MAP_PROJECTION.padding + normalizedX * mapWidth,
    y: MAP_PROJECTION.padding + normalizedY * mapHeight,
  };
}

export function projectMapData(data: MovingMapData): ProjectedMapData {
  const points = data.routePath.points;
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  const bounds = {
    minLat: Math.min(...latitudes) - 0.0002,
    maxLat: Math.max(...latitudes) + 0.0002,
    minLng: Math.min(...longitudes) - 0.0002,
    maxLng: Math.max(...longitudes) + 0.0002,
  };

  const routePoints = points.map((point) => toProjectedPoint(point, bounds));
  const currentPoint = toProjectedPoint(data.currentLocation, bounds);
  const nextActionPoint = toProjectedPoint(data.nextActionPoint.coordinate, bounds);

  const segments: Segment[] = routePoints.slice(0, -1).map((start, index) => {
    const end = routePoints[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const width = Math.hypot(dx, dy);

    return {
      left: start.x,
      top: start.y,
      width,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });

  return {
    currentPoint,
    nextActionPoint,
    segments,
  };
}

export function useProjectedMapData(data: MovingMapData) {
  return useMemo(() => projectMapData(data), [data]);
}

export function estimateProgressRatio(
  currentLocation: CurrentLocation,
  routePoints: MapCoordinate[],
) {
  if (routePoints.length < 2) {
    return 0;
  }

  const nearestIndex = routePoints.reduce(
    (bestIndex, point, index) => {
      const bestPoint = routePoints[bestIndex];
      const bestDistance = Math.hypot(bestPoint.lat - currentLocation.lat, bestPoint.lng - currentLocation.lng);
      const currentDistance = Math.hypot(point.lat - currentLocation.lat, point.lng - currentLocation.lng);
      return currentDistance < bestDistance ? index : bestIndex;
    },
    0,
  );

  return nearestIndex / (routePoints.length - 1);
}

