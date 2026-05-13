import { RecommendationView } from './RecommendationView';
import { useRouteRecommendState } from '../hooks/useRouteRecommendState';
import { useNavigationHelper } from '../../../utils/navigation';
import { useCommutePlan } from '../../commute-state/context';

export function RouteRecommendContainer() {
  const nav = useNavigationHelper();
  const state = useRouteRecommendState();
  const { setSelectedRoute } = useCommutePlan();

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
      onRetry={() => void state.refetch()}
      onPressDetail={(route) => {
        setSelectedRoute(route);
        nav.goToRecommendationDetail();
      }}
      onPressSelect={(route) => {
        setSelectedRoute(route);
        nav.goToTransit();
      }}
      onClose={nav.goBack}
    />
  );
}
