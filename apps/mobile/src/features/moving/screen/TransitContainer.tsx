import { useState } from 'react';
import { useMovingState } from '../hooks/useMovingState';
import { TransitView } from './TransitView';
import { useNavigationHelper } from '../../../utils/navigation';

export function TransitContainer() {
  const nav = useNavigationHelper();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const state = useMovingState();

  return (
    <TransitView
      currentTime={state.currentTimeText}
      arrivalTime={state.arrivalTimeText}
      remainingTime={state.remainingTimeText}
      mainAction={state.nextActionText}
      stageText={state.followupActionText}
      supportText={state.statusMessage}
      upcomingActionTitle={state.upcomingActionTitle}
      upcomingActionSubtitle={state.upcomingActionSubtitle}
      upcomingActionTimeText={state.upcomingActionTimeText}
      status={state.status}
      isDetailOpen={isDetailOpen}
      mapData={state.mapData}
      originPin={state.originPin}
      destinationPin={state.destinationPin}
      routePathPoints={state.routePathPoints}
      detailLines={state.detailLines}
      onSetDetailOpen={setIsDetailOpen}
      onPressBack={nav.goBack}
    />
  );
}
