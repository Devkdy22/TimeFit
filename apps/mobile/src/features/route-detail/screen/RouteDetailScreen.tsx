import { useRouteDetailState } from '../hooks/useRouteDetailState';
import { RouteDetailView } from './RouteDetailView';
import { useNavigationHelper } from '../../../utils/navigation';

export function RouteDetailScreen() {
  const nav = useNavigationHelper();
  const { mapData, progress, timeline } = useRouteDetailState();

  return (
    <RouteDetailView
      mapData={mapData}
      progress={progress}
      timeline={timeline}
      onPressStart={nav.goToTransit}
    />
  );
}
