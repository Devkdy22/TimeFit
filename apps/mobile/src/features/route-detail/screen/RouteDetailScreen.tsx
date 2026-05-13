import { useEffect } from 'react';
import { useRouteDetailState } from '../hooks/useRouteDetailState';
import { RouteDetailView } from './RouteDetailView';
import { useNavigationHelper } from '../../../utils/navigation';
import { useCommutePlan } from '../../commute-state/context';
import { useRouteRecommendState } from '../../route-recommend/hooks/useRouteRecommendState';

const ROUTE_DETAIL_REFRESH_MS = 45_000;

function toRouteSyncKey(
  route:
    | {
        id: string;
        segments: Array<{
          lineLabel?: string;
          realtimeEtaSeconds?: number;
          realtimeEtaMinutes?: number;
          realtimeUpdatedAt?: string;
        }>;
      }
    | null
    | undefined,
) {
  if (!route) {
    return '';
  }
  const segmentKey = route.segments
    .map(
      (seg) =>
        `${seg.lineLabel ?? ''}:${seg.realtimeEtaSeconds ?? ''}:${seg.realtimeEtaMinutes ?? ''}:${seg.realtimeUpdatedAt ?? ''}`,
    )
    .join('|');
  return `${route.id}::${segmentKey}`;
}

export function RouteDetailScreen() {
  const nav = useNavigationHelper();
  const { selectedRoute, origin, destination, setSelectedRoute } = useCommutePlan();
  const { lineLabel, steps } = useRouteDetailState(selectedRoute);
  const recommendState = useRouteRecommendState();

  useEffect(() => {
    if (!selectedRoute) {
      return;
    }
    const timer = setInterval(() => {
      void recommendState.refetch();
    }, ROUTE_DETAIL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [recommendState.refetch, selectedRoute]);

  useEffect(() => {
    if (!selectedRoute) {
      return;
    }
    const pool = [recommendState.recommended, ...recommendState.alternatives];
    const latest = pool.find((route) => route.id === selectedRoute.id);
    if (!latest) {
      return;
    }
    const latestKey = toRouteSyncKey(latest);
    const selectedKey = toRouteSyncKey(selectedRoute);
    if (latestKey === selectedKey) {
      return;
    }
    setSelectedRoute(latest);
  }, [recommendState.alternatives, recommendState.recommended, selectedRoute, setSelectedRoute]);

  return (
    <RouteDetailView
      route={selectedRoute}
      lineLabel={lineLabel}
      steps={steps}
      originAddress={origin?.address ?? origin?.name ?? ''}
      destinationLabel={destination?.name ?? destination?.address ?? ''}
      onPressStart={nav.goToBeforeDepartureTransitPopup}
      onPressBack={nav.goBack}
      onPressRefresh={() => void recommendState.refetch()}
    />
  );
}
