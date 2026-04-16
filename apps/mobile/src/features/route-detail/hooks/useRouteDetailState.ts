import { useMemo } from 'react';
import { movingMapMockData } from '../../../mocks/map';
import { routeDetailProgress, routeTimeline } from '../../../mocks/route';

export function useRouteDetailState() {
  const mapData = useMemo(() => movingMapMockData, []);

  return {
    mapData,
    progress: routeDetailProgress,
    timeline: routeTimeline,
  };
}
