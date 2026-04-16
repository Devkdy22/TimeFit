import { colorPalette } from './tokens';

export type UiStatus = 'relaxed' | 'warning' | 'urgent';
export type ApiStatus = '여유' | '주의' | '긴급' | '위험';

export interface StatusCopyContext {
  minutesUntilDeparture?: number;
  destinationName?: string;
}

export interface StatusCopy {
  headline: string;
  body: string;
  cta: string;
}

export interface StatusConfig {
  key: UiStatus;
  label: string;
  color: string;
  emphasis: 'low' | 'medium' | 'high';
  copyRule: {
    headlineRule: string;
    bodyRule: string;
    ctaRule: string;
  };
  buildCopy: (context?: StatusCopyContext) => StatusCopy;
}

const departureText = (minutesUntilDeparture?: number) => {
  if (minutesUntilDeparture == null) {
    return '지금 바로 준비를 시작하세요.';
  }

  if (minutesUntilDeparture <= 0) {
    return '지금 즉시 이동을 시작하세요.';
  }

  return `${minutesUntilDeparture}분 안에 출발해야 합니다.`;
};

export const statusConfig: Record<UiStatus, StatusConfig> = {
  relaxed: {
    key: 'relaxed',
    label: '여유',
    color: colorPalette.mint[500],
    emphasis: 'low',
    copyRule: {
      headlineRule: '안심을 주되, 다음 행동을 함께 제시한다.',
      bodyRule: '숫자보다 행동 문장을 우선한다.',
      ctaRule: '부담 없는 준비 행동으로 유도한다.',
    },
    buildCopy: (context) => ({
      headline: '좋아요. 지금은 여유 있어요.',
      body: context?.destinationName
        ? `${context.destinationName} 가기 전, 필요한 것만 챙겨두세요.`
        : '지금은 급하지 않아요. 가볍게 준비를 시작하세요.',
      cta: '출발 준비하기',
    }),
  },
  warning: {
    key: 'warning',
    label: '주의',
    color: colorPalette.orange[500],
    emphasis: 'medium',
    copyRule: {
      headlineRule: '현재 리스크를 명확히 알리고 즉시 행동을 요청한다.',
      bodyRule: '한 문장에 한 행동만 담는다.',
      ctaRule: '준비/출발 같은 직접 동사를 사용한다.',
    },
    buildCopy: (context) => ({
      headline: '지금 준비를 시작해야 맞출 수 있어요.',
      body: departureText(context?.minutesUntilDeparture),
      cta: '지금 준비 시작',
    }),
  },
  urgent: {
    key: 'urgent',
    label: '긴급',
    color: colorPalette.red[500],
    emphasis: 'high',
    copyRule: {
      headlineRule: '위기 상황을 짧고 강하게 전달한다.',
      bodyRule: '선택지를 줄이고 즉시 행동만 제시한다.',
      ctaRule: '단일 행동 CTA만 노출한다.',
    },
    buildCopy: (context) => ({
      headline: '지금 바로 출발해야 합니다.',
      body: departureText(context?.minutesUntilDeparture),
      cta: '지금 출발',
    }),
  },
};

export const apiStatusToUiStatus: Record<ApiStatus, UiStatus> = {
  여유: 'relaxed',
  주의: 'warning',
  긴급: 'urgent',
  위험: 'urgent',
};

export function resolveStatusFromApi(status: ApiStatus): StatusConfig {
  return statusConfig[apiStatusToUiStatus[status]];
}
