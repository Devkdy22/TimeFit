import type { MobilityRoute } from '../modules/recommendation/types/recommendation.types';

export interface TimeFitStatusResult {
  status: '여유' | '주의' | '긴급';
  bufferMinutes: number;
  message: string;
  color: string;
}

export function computeTimeFitStatus(
  route: MobilityRoute,
  targetArrivalTime: string | Date,
): TimeFitStatusResult {
  const now = Date.now();
  const targetMs =
    targetArrivalTime instanceof Date ? targetArrivalTime.getTime() : Date.parse(targetArrivalTime);
  const effectiveTargetMs = Number.isNaN(targetMs) ? now : targetMs;

  const realtimeTravelMinutes = route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes;
  const realtimeArrivalMs = now + realtimeTravelMinutes * 60_000;
  const bufferMinutes = Math.floor((effectiveTargetMs - realtimeArrivalMs) / 60_000);

  let status: TimeFitStatusResult['status'];
  if (bufferMinutes >= 5) {
    status = '여유';
  } else if (bufferMinutes >= 2) {
    status = '주의';
  } else {
    status = '긴급';
  }

  if (route.delayRiskLevel === 'HIGH') {
    status = escalate(status);
  }

  const firstSegment = route.mobilitySegments?.[0];
  const firstSegmentUncertain =
    firstSegment?.realtimeStatus === 'UNAVAILABLE' ||
    (firstSegment?.realtimeInfo?.matchingConfidence ?? 1) < 0.4;
  if (firstSegmentUncertain) {
    status = '긴급';
  }

  if ((route.realtimeCoverage ?? 1) < 0.3 && status === '여유') {
    status = '주의';
  }

  return {
    status,
    bufferMinutes,
    message: toMessage(status),
    color: toColor(status),
  };
}

function escalate(status: TimeFitStatusResult['status']): TimeFitStatusResult['status'] {
  if (status === '여유') {
    return '주의';
  }
  if (status === '주의') {
    return '긴급';
  }
  return '긴급';
}

function toMessage(status: TimeFitStatusResult['status']): string {
  if (status === '여유') {
    return '현재 페이스를 유지하세요.';
  }
  if (status === '주의') {
    return '출발 준비를 서둘러 주세요.';
  }
  return '지금 출발해야 합니다.';
}

function toColor(status: TimeFitStatusResult['status']): string {
  if (status === '여유') {
    return '#20A464';
  }
  if (status === '주의') {
    return '#E6A700';
  }
  return '#E5484D';
}
