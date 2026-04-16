import { RouteRecommendView } from './RouteRecommendView';
import { useRouteRecommendState } from '../hooks/useRouteRecommendState';
import { useNavigationHelper } from '../../../utils/navigation';

export function RouteRecommendContainer() {
  const nav = useNavigationHelper();
  const state = useRouteRecommendState();

  return (
    <RouteRecommendView
      phase={state.phase}
      status={state.status}
      statusLabel={state.statusLabel}
      subtitle={state.subtitle}
      recommended={state.recommended}
      alternatives={state.alternatives}
      errorMessage={state.errorMessage}
      source={state.source}
      onRetry={() => void state.refetch()}
      onPressDetail={nav.goToRecommendationDetail}
    />
  );
}
