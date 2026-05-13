import type { MobilityRealtimeInfo, MobilitySegment } from '../modules/recommendation/types/recommendation.types';

export interface NextActionResult {
  title: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export function generateNextAction(
  currentSegment: MobilitySegment | undefined,
  progress: number,
  realtimeInfo?: MobilityRealtimeInfo,
  options?: {
    departureInMinutes?: number;
  },
): NextActionResult {
  if (!currentSegment) {
    return {
      title: '경로 확인 중',
      description: '실시간 경로 정보를 불러오고 있습니다.',
      urgency: 'MEDIUM',
    };
  }

  const departureInMinutes = options?.departureInMinutes;
  if (progress < 0.1 && typeof departureInMinutes === 'number' && departureInMinutes < 2) {
    return {
      title: '즉시 이동 필요',
      description: '출발 시간이 2분 이내입니다. 바로 이동하세요.',
      urgency: 'HIGH',
    };
  }

  if (currentSegment.mode === 'bus') {
    const eta = realtimeInfo?.etaMinutes;
    return {
      title: eta !== undefined ? `${eta}분 후 버스 도착` : '버스 탑승 준비',
      description: progress < 0.1 ? '지금 정류장으로 이동하세요' : '정류장에서 탑승 대기하세요',
      urgency: eta !== undefined && eta <= 2 ? 'HIGH' : 'MEDIUM',
    };
  }

  if (currentSegment.mode === 'subway') {
    return {
      title: realtimeInfo?.trainStatusMessage ? '지하철 진입 중' : '지하철 탑승 준비',
      description: realtimeInfo?.trainStatusMessage ?? '곧 도착합니다',
      urgency: 'MEDIUM',
    };
  }

  if (currentSegment.mode === 'walk') {
    const distance = currentSegment.distanceMeters ?? 0;
    const remainMeters = Math.max(0, Math.round(distance * (1 - Math.min(1, Math.max(0, progress)))));
    return {
      title: '도보 이동',
      description: `다음 정류장까지 ${remainMeters}m 이동`,
      urgency: 'LOW',
    };
  }

  return {
    title: '이동 중',
    description: '현재 안내에 따라 이동하세요.',
    urgency: 'MEDIUM',
  };
}
