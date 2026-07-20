import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useMovingState } from '../hooks/useMovingState';
import { TransitView } from './TransitView';
import { useNavigationHelper } from '../../../utils/navigation';

export function TransitContainer() {
  const nav = useNavigationHelper();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const state = useMovingState();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      nav.replaceToHome();
      return true;
    });
    return () => subscription.remove();
  }, [nav]);

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
      timeyContext={state.timeyContext}
      timeyState={state.timeyState}
      onSetDetailOpen={setIsDetailOpen}
      onPressBack={nav.replaceToHome}
    />
  );
}
