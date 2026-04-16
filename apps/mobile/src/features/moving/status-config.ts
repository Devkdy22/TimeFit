import type { UiStatus } from '../../theme/status-config';
import { theme } from '../../theme/theme';

export interface MovingStatusUi {
  status: UiStatus;
  title: string;
  subtitle: string;
  nextActionText: string;
  ctaLabel: string;
  badgeLabel: string;
  urgencyHint: string;
  timiMessage: string;
  color: string;
  characterMotion: 'calm' | 'alert' | 'urgent';
}

export const movingStatusConfig: Record<UiStatus, MovingStatusUi> = {
  relaxed: {
    status: 'relaxed',
    title: '좋아요. 지금 페이스를 유지하세요',
    subtitle: '지금은 리듬을 지키는 것이 가장 중요해요.',
    nextActionText: '80m 앞에서 좌측 출구로 이동',
    ctaLabel: '속도 유지',
    badgeLabel: '여유',
    urgencyHint: '호흡을 안정적으로 유지하세요',
    timiMessage: '좋아요, 지금 템포면 충분해요.',
    color: theme.colors.accent.relaxed,
    characterMotion: 'calm',
  },
  warning: {
    status: 'warning',
    title: '속도를 조금 올려야 맞출 수 있어요',
    subtitle: '지금 1분만 집중하면 도착 시간을 회복할 수 있어요.',
    nextActionText: '100m 앞에서 우측 횡단보도 이용',
    ctaLabel: '지금 뛰기',
    badgeLabel: '주의',
    urgencyHint: '신호 대기 없이 바로 건널 준비',
    timiMessage: '조금만 서두르면 맞출 수 있어요.',
    color: theme.colors.accent.warning,
    characterMotion: 'alert',
  },
  urgent: {
    status: 'urgent',
    title: '지금 바로 속도를 올려야 합니다',
    subtitle: '이번 액션이 늦으면 도착 지연 가능성이 커져요.',
    nextActionText: '30m 앞에서 즉시 우회전',
    ctaLabel: '지금 뛰기',
    badgeLabel: '긴급',
    urgencyHint: '다음 코너까지 전력으로 이동',
    timiMessage: '지금 달리면 아직 가능해요.',
    color: theme.colors.accent.urgent,
    characterMotion: 'urgent',
  },
};

export function resolveMovingStatus(progress: number): MovingStatusUi {
  if (progress < 0.35) {
    return movingStatusConfig.relaxed;
  }
  if (progress < 0.75) {
    return movingStatusConfig.warning;
  }
  return movingStatusConfig.urgent;
}
