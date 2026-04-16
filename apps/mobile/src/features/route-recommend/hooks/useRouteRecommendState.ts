import { useMemo } from 'react';
import { useRecommendRoutes } from '../../../hooks/useRecommendRoutes';
import { alternativeRoutes, bestRoute } from '../../../mocks/route';
import { resolveStatusFromApi, type UiStatus } from '../../../theme/status-config';
import type { RecommendedRoute } from '../../../services/api/client';

type DataSource = 'api' | 'mock';
type ScreenPhase = 'loading' | 'ready' | 'error';

interface RouteCardItem {
  id: string;
  name: string;
  departure: string;
  arrival: string;
  totalDuration: string;
  buffer: string;
  transportSummary: string;
  stabilityLabel: string;
  reason: string;
}

interface RouteRecommendViewModel {
  phase: ScreenPhase;
  status: UiStatus;
  statusLabel: string;
  subtitle: string;
  recommended: RouteCardItem;
  alternatives: RouteCardItem[];
  errorMessage: string | null;
  source: DataSource;
  refetch: () => Promise<void>;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toReason(route: RecommendedRoute) {
  const sourceLabel = route.route.source === 'api' ? '실시간 API' : '보조 데이터';
  return `${sourceLabel} 기반 · 환승 ${route.route.transferCount}회 · 도보 ${route.route.walkingMinutes}분`;
}

function toRouteCardItem(route: RecommendedRoute): RouteCardItem {
  const stabilityLabel =
    route.route.delayRisk <= 0.25 ? '안정 높음' : route.route.delayRisk <= 0.5 ? '안정 보통' : '안정 낮음';

  return {
    id: route.route.id,
    name: route.route.name,
    departure: formatTime(route.departureAt),
    arrival: formatTime(route.expectedArrivalAt),
    totalDuration: `${route.route.estimatedTravelMinutes}분`,
    buffer: `${route.bufferMinutes}분`,
    transportSummary: `환승 ${route.route.transferCount}회 · 도보 ${route.route.walkingMinutes}분`,
    stabilityLabel,
    reason: toReason(route),
  };
}

export function useRouteRecommendState(): RouteRecommendViewModel {
  const { data, isLoading, error, refetch } = useRecommendRoutes();

  return useMemo(() => {
    if (data) {
      const resolvedStatus = resolveStatusFromApi(data.status);
      const status = resolvedStatus.key;

      return {
        phase: 'ready',
        status,
        statusLabel: `추천 ${resolvedStatus.label}`,
        subtitle: data.nextAction,
        recommended: toRouteCardItem(data.primaryRoute),
        alternatives: data.alternatives.map(toRouteCardItem),
        errorMessage: null,
        source: 'api',
        refetch,
      };
    }

    if (isLoading) {
      return {
        phase: 'loading',
        status: 'warning',
        statusLabel: '추천 계산 중',
        subtitle: '실시간 교통과 도착 가능 시간을 분석하고 있어요.',
        recommended: {
          id: bestRoute.id,
          name: bestRoute.name,
          departure: '08:15',
          arrival: '08:52',
          totalDuration: '37분',
          buffer: '4분',
          transportSummary: '지하철 + 버스 · 환승 1회',
          stabilityLabel: '안정 높음',
          reason: '평균 지연 리스크가 가장 낮습니다.',
        },
        alternatives: alternativeRoutes.slice(0, 3).map((route, index) => ({
          id: route.id,
          name: route.name,
          departure: `08:${18 + index * 2}`,
          arrival: `08:${55 + index}`,
          totalDuration: `${39 + index * 2}분`,
          buffer: `${3 - index > 0 ? 3 - index : 1}분`,
          transportSummary: `대중교통 조합 · 환승 ${index + 1}회`,
          stabilityLabel: index === 0 ? '안정 보통' : '안정 낮음',
          reason: `대안 ${index + 1} · ${route.summary}`,
        })),
        errorMessage: null,
        source: 'mock',
        refetch,
      };
    }

    return {
      phase: 'error',
      status: 'warning',
      statusLabel: '임시 경로',
      subtitle: 'API 연결이 불안정해 최근 추천 데이터를 보여줘요.',
      recommended: {
        id: bestRoute.id,
        name: bestRoute.name,
        departure: '08:15',
        arrival: '08:52',
        totalDuration: '37분',
        buffer: '4분',
        transportSummary: '지하철 + 버스 · 환승 1회',
        stabilityLabel: '안정 보통',
        reason: '임시 추천 · 평균 소요시간이 가장 짧습니다.',
      },
      alternatives: alternativeRoutes.slice(0, 3).map((route, index) => ({
        id: route.id,
        name: route.name,
        departure: `08:${17 + index * 3}`,
        arrival: `08:${56 + index}`,
        totalDuration: `${40 + index * 2}분`,
        buffer: `${2 - index > 0 ? 2 - index : 1}분`,
        transportSummary: `대중교통 조합 · 환승 ${index + 1}회`,
        stabilityLabel: index === 0 ? '안정 보통' : '안정 낮음',
        reason: `대안 ${index + 1} · ${route.summary}`,
      })),
      errorMessage: error,
      source: 'mock',
      refetch,
    };
  }, [data, error, isLoading, refetch]);
}
