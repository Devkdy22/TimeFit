import { useMemo } from 'react';
import type { SelectedRouteSummary } from '../../route-recommend/model/selectedRoute';

export interface RouteDetailStep {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: 'go' | 'walk' | 'bus' | 'subway' | 'done';
  isDone?: boolean;
}

function plusMinutes(timeText: string, minutes: number) {
  const [hourText, minuteText] = timeText.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return '--:--';
  }
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() + Math.max(0, minutes));
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toLineLabel(route: SelectedRouteSummary | null) {
  if (!route) {
    return '도보→버스→지하철';
  }
  const labels = route.segments.map((segment) => {
    if (segment.mode === 'walk') {
      return '도보';
    }
    if (segment.mode === 'bus') {
      return '버스';
    }
    return '지하철';
  });
  return labels.length > 0 ? labels.join('→') : '도보';
}

function buildSteps(route: SelectedRouteSummary | null): RouteDetailStep[] {
  if (!route) {
    return [
      { id: 'start', title: '출발', subtitle: '현재 위치', time: '--:--', icon: 'go' },
      { id: 'arrival', title: '도착', subtitle: '목적지', time: '--:--', icon: 'done', isDone: true },
    ];
  }

  const steps: RouteDetailStep[] = [
    { id: 'start', title: '출발', subtitle: '현재 위치', time: route.departure, icon: 'go' },
  ];

  let elapsedMinutes = 0;
  route.segments.forEach((segment, index) => {
    elapsedMinutes += Math.max(1, segment.durationMinutes);
    const isLast = index === route.segments.length - 1;
    const time = isLast ? route.arrival : plusMinutes(route.departure, elapsedMinutes);
    const title =
      segment.mode === 'walk'
        ? `도보 ${Math.max(1, segment.durationMinutes)}분`
        : segment.mode === 'bus'
          ? `${segment.lineLabel ?? '버스'} 탑승`
          : `${segment.lineLabel ?? '지하철'} 탑승`;
    const subtitle =
      segment.mode === 'walk'
        ? (segment.endName ?? segment.startName ?? '다음 지점으로 이동')
        : (segment.endName ?? segment.startName ?? '하차 지점 정보 없음');
    steps.push({
      id: `segment-${index}`,
      title,
      subtitle,
      time,
      icon: segment.mode,
    });
  });

  steps.push({
    id: 'arrival',
    title: '도착',
    subtitle: '목적지 도착',
    time: route.arrival,
    icon: 'done',
    isDone: true,
  });
  return steps;
}

export function useRouteDetailState(selectedRoute: SelectedRouteSummary | null) {
  return useMemo(
    () => ({
      selectedRoute,
      lineLabel: toLineLabel(selectedRoute),
      steps: buildSteps(selectedRoute),
    }),
    [selectedRoute],
  );
}
