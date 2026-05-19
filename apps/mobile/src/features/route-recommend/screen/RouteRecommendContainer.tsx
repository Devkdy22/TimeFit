import { RecommendationView } from './RecommendationView';
import { useRouteRecommendState } from '../hooks/useRouteRecommendState';
import { useNavigationHelper } from '../../../utils/navigation';
import { useCommutePlan } from '../../commute-state/context';
import { prewarmRoute } from '../../moving/model/routePrewarm';
import { useEffect } from 'react';

async function prewarmBeforeTransit(route: { rawRoute?: Parameters<typeof prewarmRoute>[0] }) {
  if (!route.rawRoute) {
    return;
  }
  try {
    await Promise.race([
      prewarmRoute(route.rawRoute),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch {
    // prewarm 실패 시에도 화면 진입은 막지 않는다.
  }
}

export function RouteRecommendContainer() {
  const freezeRouteRefresh =
    (process.env.EXPO_PUBLIC_FREEZE_ROUTE_RECOMMENDATION ?? '').toLowerCase() === 'true';
  const nav = useNavigationHelper();
  const state = useRouteRecommendState();
  const { setSelectedRoute } = useCommutePlan();

  useEffect(() => {
    const routes = [state.recommended, ...state.alternatives];
    routes.forEach((route) => {
      if (route.rawRoute) {
        void prewarmRoute(route.rawRoute);
      }
    });
  }, [state.alternatives, state.recommended]);

  return (
    <RecommendationView
      phase={state.phase}
      status={state.status}
      statusLabel={state.statusLabel}
      subtitle={state.subtitle}
      headerDestination={state.headerDestination}
      headerArrivalAt={state.headerArrivalAt}
      recommended={state.recommended}
      alternatives={state.alternatives}
      errorMessage={state.errorMessage}
      source={state.source}
      onRetry={() => {
        if (freezeRouteRefresh) {
          return;
        }
        void state.refetch();
      }}
      onPressDetail={(route) => {
        setSelectedRoute(route);
        nav.goToRecommendationDetail();
      }}
      onPressSelect={async (route) => {
        setSelectedRoute(route);
        await prewarmBeforeTransit(route);
        nav.goToTransit();
      }}
      onClose={nav.goBack}
    />
  );
}
