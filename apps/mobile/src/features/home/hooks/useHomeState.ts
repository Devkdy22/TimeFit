import { useMemo } from 'react';
import { resolveStatusFromApi } from '../../../theme/status-config';
import { routineItems } from '../../../mocks/route';
import { useCommutePlan } from '../../commute-state/context';

function parseClockToFutureMinutes(value: string | null) {
  if (!value) {
    return 90;
  }
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 60;
  }

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}

export function useHomeState() {
  const { origin, destination, arrivalAt, recentPlaces, savedPlaces, setArrivalAt } = useCommutePlan();

  const minutesUntilArrival = useMemo(() => parseClockToFutureMinutes(arrivalAt), [arrivalAt]);
  const apiStatus = minutesUntilArrival <= 30 ? '긴급' : minutesUntilArrival <= 50 ? '주의' : '여유';
  const status = resolveStatusFromApi(apiStatus);
  const originLabel = origin?.name ?? '출발지를 선택하세요';
  const destinationLabel = destination?.name ?? '';
  const hasDestination = destinationLabel.length > 0;
  const minutesUntilDeparture = Math.max(0, minutesUntilArrival - 45);

  const copy = status.buildCopy({
    minutesUntilDeparture,
    destinationName: hasDestination ? destinationLabel : undefined,
  });

  return {
    arrivalAt,
    status,
    copy,
    originLabel,
    destinationLabel,
    hasDestination,
    savedPlaces,
    recentPlaces,
    routinePreview: routineItems.slice(0, 2),
    setArrivalAt,
  };
}
