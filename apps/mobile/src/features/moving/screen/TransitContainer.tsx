import { useMovingState } from '../hooks/useMovingState';
import { TransitView } from './TransitView';
import { useNavigationHelper } from '../../../utils/navigation';

export function TransitContainer() {
  const nav = useNavigationHelper();
  const { progressPercent, remainingDistanceText, remainingTimeText, movingStatus } = useMovingState();

  return (
    <TransitView
      currentTime={new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
      arrivalTime={`+${remainingTimeText}`}
      remainingTime={remainingTimeText}
      mainAction={movingStatus.nextActionText}
      stageText={`진행 ${progressPercent}%`}
      supportText={`남은 거리 ${remainingDistanceText} · ${movingStatus.subtitle}`}
      status={movingStatus.status}
      onPressDone={nav.goToArrival}
    />
  );
}
