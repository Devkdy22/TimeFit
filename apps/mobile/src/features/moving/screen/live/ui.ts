import type { UiStatus } from '../../../../theme/status-config';

export function statusTone(status: UiStatus) {
  if (status === 'urgent') return '#EF4444';
  if (status === 'warning') return '#F59E0B';
  return '#34B6AE';
}

export function statusPrimary(status: UiStatus) {
  if (status === 'urgent') return '경로 변경 추천';
  if (status === 'warning') return '조금 늦어지고 있어요';
  return '정시 도착 가능';
}

export function modeBadgeColor(mode?: 'walk' | 'bus' | 'subway') {
  if (mode === 'bus') return '#3B82F6';
  if (mode === 'subway') return '#8B5CF6';
  return '#94A3B8';
}

export function stripPlusDuration(text: string) {
  return text.replace(/^\+/, '').replace(/\s*남음$/, '').trim();
}
