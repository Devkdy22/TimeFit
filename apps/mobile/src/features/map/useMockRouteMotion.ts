import { useEffect, useMemo, useState } from 'react';
import type { CurrentLocation, MapCoordinate } from './types';

function interpolateCoordinate(start: MapCoordinate, end: MapCoordinate, t: number): MapCoordinate {
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lng: start.lng + (end.lng - start.lng) * t,
  };
}

export function useMockRouteMotion(routePoints: MapCoordinate[], frameMs = 900) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.025;
        return next > 1 ? 0 : next;
      });
    }, frameMs);

    return () => clearInterval(id);
  }, [frameMs]);

  const currentLocation = useMemo<CurrentLocation>(() => {
    if (routePoints.length === 0) {
      return { lat: 0, lng: 0 };
    }
    if (routePoints.length === 1) {
      return routePoints[0];
    }

    const scaled = progress * (routePoints.length - 1);
    const index = Math.floor(scaled);
    const t = scaled - index;

    const start = routePoints[index];
    const end = routePoints[Math.min(index + 1, routePoints.length - 1)];
    const point = interpolateCoordinate(start, end, t);

    return {
      ...point,
      accuracy: 8,
      heading: 95,
    };
  }, [progress, routePoints]);

  return {
    currentLocation,
    progress,
  };
}

