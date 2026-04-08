import {
  type TripEntity,
  type TripLiveSnapshot,
  type TripLiveStatus,
  type TripUrgencyLevel,
} from '../../modules/trips/types/trip.types';

export function calculateTripLiveState(
  trip: TripEntity,
  now: Date,
  dynamicDelayMinutes: number,
): TripLiveSnapshot {
  const startedAt = new Date(trip.startedAt);
  const targetArrivalAt = new Date(trip.arrivalAt || trip.expectedArrivalAt);

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
  const plannedRemainingMinutes = trip.plannedDurationMinutes - elapsedMinutes;
  const delayMinutes = Math.max(0, dynamicDelayMinutes + trip.delayOffsetMinutes);
  const remainingMinutes = plannedRemainingMinutes + delayMinutes;
  const estimatedArrivalAt = new Date(now.getTime() + remainingMinutes * 60_000);
  const bufferMinutes = Math.floor((targetArrivalAt.getTime() - estimatedArrivalAt.getTime()) / 60_000);
  const currentStatus = resolveStatus(bufferMinutes, remainingMinutes, startedAt, now);

  return {
    remainingMinutes,
    bufferMinutes,
    estimatedArrivalAt: estimatedArrivalAt.toISOString(),
    currentStatus,
    nextAction: resolveNextAction(currentStatus, remainingMinutes),
    urgencyLevel: resolveUrgency(currentStatus),
    delayMinutes,
  };
}

function resolveStatus(
  bufferMinutes: number,
  remainingMinutes: number,
  startedAt: Date,
  now: Date,
): TripLiveStatus {
  if (now < startedAt) {
    return '여유';
  }

  if (bufferMinutes < 0) {
    return '위험';
  }

  if (remainingMinutes < 0) {
    return '위험';
  }

  if (bufferMinutes >= 5) {
    return '여유';
  }
  if (bufferMinutes >= 2 && bufferMinutes <= 4) {
    return '주의';
  }
  if (bufferMinutes >= 0 && bufferMinutes <= 1) {
    return '긴급';
  }

  return '위험';
}

function resolveNextAction(status: TripLiveStatus, remainingMinutes: number): string {
  switch (status) {
    case '여유':
      return `현재 경로를 유지하세요. 약 ${remainingMinutes}분 남았습니다.`;
    case '주의':
      return '주의 단계입니다. 환승/하차 위치를 미리 확인하세요.';
    case '긴급':
      return '긴급 단계입니다. 바로 이동 속도를 높이세요.';
    case '위험':
      return '지연이 감지되었습니다. 대체 경로로 전환하세요.';
    default:
      return '현재 이동 상태를 확인하세요.';
  }
}

function resolveUrgency(status: TripLiveStatus): TripUrgencyLevel {
  switch (status) {
    case '여유':
      return 'low';
    case '주의':
      return 'medium';
    case '긴급':
      return 'high';
    case '위험':
      return 'critical';
    default:
      return 'medium';
  }
}
