import type { UiStatus } from '../../theme/status-config';
import { theme } from '../../theme/theme';

export interface StatusAppearance {
  color: string;
  softBackground: string;
  subtleBorder: string;
}

const statusBackgroundMap: Record<UiStatus, string> = {
  relaxed: 'rgba(61, 220, 151, 0.12)',
  warning: 'rgba(255, 159, 67, 0.13)',
  urgent: 'rgba(255, 93, 115, 0.12)',
};

const statusBorderMap: Record<UiStatus, string> = {
  relaxed: 'rgba(61, 220, 151, 0.24)',
  warning: 'rgba(255, 159, 67, 0.24)',
  urgent: 'rgba(255, 93, 115, 0.24)',
};

export function getStatusAppearance(status: UiStatus = 'relaxed'): StatusAppearance {
  const config = theme.status[status];

  return {
    color: config.color,
    softBackground: statusBackgroundMap[status],
    subtleBorder: statusBorderMap[status],
  };
}
