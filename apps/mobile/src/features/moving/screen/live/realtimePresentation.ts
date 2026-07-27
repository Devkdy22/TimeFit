import type { TransitRealtimeSource, TransitRealtimeStatus } from './types';

export const REALTIME_UI_STALE_AFTER_MS = 2 * 60_000;

export function realtimeStatusLabel(status: TransitRealtimeStatus): string {
  switch (status) {
    case 'LIVE':
      return '실시간 수신 중';
    case 'DELAYED':
      return '지연 운행';
    case 'STALE':
      return '이전 정보';
    case 'UNAVAILABLE':
      return '정보 없음';
    case 'SCHEDULED':
      return '예정 정보';
    default:
      return '확인 중';
  }
}

export function formatRealtimeAge(updatedAt?: string, now = Date.now()): string {
  if (!updatedAt) return '시각 없음';
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return '시각 오류';

  const ageMinutes = Math.max(0, Math.floor((now - updatedMs) / 60_000));
  if (ageMinutes === 0) return '방금 전';
  return `${ageMinutes}분 전`;
}

export function resolveDisplayedRealtimeStatus(
  status: TransitRealtimeStatus,
  updatedAt?: string,
  now = Date.now(),
): TransitRealtimeStatus {
  if (status !== 'LIVE' && status !== 'DELAYED') {
    return status;
  }

  const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedMs)) {
    return 'UNAVAILABLE';
  }
  return now - updatedMs >= REALTIME_UI_STALE_AFTER_MS ? 'STALE' : status;
}

export function matchingConfidenceLabel(confidence?: number): string {
  if (confidence === undefined || !Number.isFinite(confidence)) return '확인 중';
  if (confidence >= 0.8) return '높음';
  if (confidence >= 0.5) return '보통';
  return '낮음';
}

export function realtimeSourceLabel(source?: TransitRealtimeSource): string {
  switch (source) {
    case 'SEOUL_API':
      return '서울 API';
    case 'GYEONGGI_API':
      return '경기 API';
    case 'INCHEON_API':
      return '인천 API';
    case 'CACHE':
      return '캐시 정보';
    default:
      return '수신 없음';
  }
}
