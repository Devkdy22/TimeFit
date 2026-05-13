import { useMemo } from 'react';
import { useRecommendRoutes } from '../../../hooks/useRecommendRoutes';
import { resolveStatusFromApi, type UiStatus } from '../../../theme/status-config';
import type { RecommendedRoute } from '../../../services/api/client';
import { useCommutePlan } from '../../commute-state/context';
import type { SelectedRouteSummary } from '../model/selectedRoute';

type ScreenPhase = 'loading' | 'ready' | 'error';

export type RouteCardItem = SelectedRouteSummary;

interface RouteRecommendViewModel {
  phase: ScreenPhase;
  status: UiStatus;
  statusLabel: string;
  subtitle: string;
  headerDestination: string;
  headerArrivalAt: string;
  recommended: RouteCardItem;
  alternatives: RouteCardItem[];
  errorMessage: string | null;
  source: 'api';
  refetch: () => Promise<void>;
}

const EPSILON = 0.0001;

function getEffectiveRouteTravelMinutes(route: RecommendedRoute): number {
  return route.route.realtimeAdjustedDurationMinutes ?? route.route.estimatedTravelMinutes;
}

function normalizeDurationMinutes(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value as number));
}

function formatTime(iso: string, options?: { pastAsNow?: boolean }) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  if (options?.pastAsNow && date.getTime() < Date.now()) {
    return '지금';
  }

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toReason(route: RecommendedRoute) {
  return `환승 ${route.route.transferCount}회 · 도보 ${route.route.walkingMinutes}분`;
}

function toDurationLabel(departureAt: string, expectedArrivalAt: string, fallbackMinutes: number) {
  const departureMsRaw = new Date(departureAt).getTime();
  const arrivalMs = new Date(expectedArrivalAt).getTime();
  const departureMs = Number.isNaN(departureMsRaw) ? Number.NaN : Math.max(departureMsRaw, Date.now());
  const minutes = Number.isNaN(departureMs) || Number.isNaN(arrivalMs)
    ? Math.max(1, fallbackMinutes)
    : Math.max(1, Math.round((arrivalMs - departureMs) / 60_000));

  if (minutes >= 60) {
    const hour = Math.floor(minutes / 60);
    const remainMinute = minutes % 60;
    return remainMinute > 0 ? `${hour}시간 ${remainMinute}분` : `${hour}시간`;
  }
  return `${minutes}분`;
}

function toEstimatedFareText(route: RecommendedRoute): string {
  const segments = route.route.mobilitySegments ?? [];
  const hasBus = segments.some((segment) => segment.mode === 'bus');
  const hasSubway = segments.some((segment) => segment.mode === 'subway');
  const transitCount = segments.filter((segment) => segment.mode === 'bus' || segment.mode === 'subway').length;

  if (!hasBus && !hasSubway) {
    return '요금 없음';
  }

  let fare = hasBus && hasSubway ? 1650 : hasSubway ? 1550 : 1500;
  if (transitCount >= 3) {
    fare += 100;
  }
  return `약 ${fare.toLocaleString('ko-KR')}원`;
}

function buildFeatureMap(routes: RecommendedRoute[]): Record<string, string[]> {
  if (routes.length === 0) {
    return {};
  }

  const minTravel = Math.min(...routes.map(getEffectiveRouteTravelMinutes));
  const minTransfer = Math.min(...routes.map((route) => route.route.transferCount));
  const minWalking = Math.min(...routes.map((route) => route.route.walkingMinutes));
  const minDelayRisk = Math.min(...routes.map((route) => route.route.delayRisk));
  const earliestArrival = Math.min(
    ...routes.map((route) => {
      const at = new Date(route.expectedArrivalAt).getTime();
      return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
    }),
  );

  return routes.reduce<Record<string, string[]>>((acc, route) => {
    const tags: string[] = [];
    const arrivalMs = new Date(route.expectedArrivalAt).getTime();

    if (Math.abs(getEffectiveRouteTravelMinutes(route) - minTravel) <= EPSILON) {
      tags.push('짧은 소요');
    }
    if (Math.abs(route.route.transferCount - minTransfer) <= EPSILON) {
      tags.push('최소 환승');
    }
    if (Math.abs(route.route.walkingMinutes - minWalking) <= EPSILON) {
      tags.push('최단 거리');
    }
    if (Math.abs(route.route.delayRisk - minDelayRisk) <= EPSILON) {
      tags.push('안정적');
    }
    if (!Number.isNaN(arrivalMs) && Math.abs(arrivalMs - earliestArrival) <= 1000) {
      tags.push('빠른 도착');
    }

    const uniq = Array.from(new Set(tags)).slice(0, 3);
    acc[route.route.id] = uniq;
    return acc;
  }, {});
}

function toRouteCardItem(route: RecommendedRoute, features?: string[]): RouteCardItem {
  const stabilityLabel = route.status;
  const featureText = features && features.length > 0 ? features.join(' · ') : toReason(route);
  const segments =
    route.route.mobilitySegments && route.route.mobilitySegments.length > 0
      ? route.route.mobilitySegments.filter(
          (segment): segment is {
            mode: 'walk' | 'bus' | 'subway';
            durationMinutes: number;
            realtimeAdjustedDurationMinutes?: number;
            lineLabel?: string;
            startName?: string;
            endName?: string;
            distanceMeters?: number;
            stationCount?: number;
            directionLabel?: string;
            transferTip?: string;
            pathPoints?: Array<{ lat: number; lng: number; label?: string }>;
            passStops?: string[];
            realtimeStatus?: 'SCHEDULED' | 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';
            realtimeInfo?: {
              etaMinutes?: number;
              etaSeconds?: number;
              reasonCode?: string;
              source?: 'SEOUL_API' | 'GYEONGGI_API' | 'INCHEON_API' | 'CACHE';
              updatedAt?: string;
            };
            candidates?: Array<{
              route: string;
              etaMinutes: number;
              etaSeconds?: number;
              direction?: string;
            }>;
          } =>
            segment.mode !== 'car',
        ).map((segment) => {
          const effectiveDurationMinutes = normalizeDurationMinutes(
            segment.realtimeAdjustedDurationMinutes ?? segment.durationMinutes,
          );
          return {
            mode: segment.mode,
            durationMinutes: effectiveDurationMinutes,
            lineLabel: segment.lineLabel,
            startName: segment.startName,
            endName: segment.endName,
            distanceMeters: segment.distanceMeters,
            stationCount: segment.stationCount,
            directionLabel: segment.directionLabel,
            transferTip: segment.transferTip,
            passStops: (() => {
              const fromPassStops = segment.passStops?.map((label) => label?.trim()).filter(Boolean) as string[] | undefined;
              if (fromPassStops && fromPassStops.length > 0) {
                return fromPassStops;
              }
              return (
                segment.pathPoints
                  ?.map((point) => point.label?.trim())
                  .filter((label): label is string => Boolean(label)) ?? []
              );
            })(),
            realtimeStatus: segment.realtimeStatus,
            realtimeReasonCode: segment.realtimeInfo?.reasonCode,
            realtimeUpdatedAt: segment.realtimeInfo?.updatedAt,
            // 상태 플래그가 불안정해도 ETA 값이 있으면 UI에서 사용할 수 있도록 그대로 전달한다.
            realtimeEtaSeconds: segment.realtimeInfo?.etaSeconds,
            realtimeEtaMinutes: segment.realtimeInfo?.etaMinutes,
            candidates:
              segment.candidates?.map((candidate) => ({
                route: candidate.route,
                etaMinutes: candidate.etaMinutes,
                etaSeconds: candidate.etaSeconds,
                direction: candidate.direction,
              })) ?? [],
          };
        })
      : (route.route.mobilityFlow ?? ['도보']).map((step) => ({
          mode: step.includes('지하철')
            ? ('subway' as const)
            : step.includes('버스')
              ? ('bus' as const)
              : ('walk' as const),
          durationMinutes: Math.max(
            1,
            Math.round(
              getEffectiveRouteTravelMinutes(route) /
                Math.max(1, (route.route.mobilityFlow ?? ['도보']).length),
            ),
          ),
          lineLabel: undefined,
          startName: undefined,
          endName: undefined,
          distanceMeters: undefined,
          stationCount: undefined,
          directionLabel: undefined,
          transferTip: undefined,
          passStops: [],
          realtimeEtaMinutes: undefined,
          realtimeEtaSeconds: undefined,
          realtimeUpdatedAt: undefined,
          realtimeStatus: undefined,
          realtimeReasonCode: undefined,
          candidates: [],
        }));

  const bufferLabel =
    route.bufferMinutes < 0
      ? `-${Math.abs(route.bufferMinutes)}분`
      : `${route.bufferMinutes}분`;

  return {
    id: route.route.id,
    name: '',
    departure: formatTime(route.departureAt, { pastAsNow: true }),
    arrival: formatTime(route.expectedArrivalAt),
    totalDuration: toDurationLabel(
      route.departureAt,
      route.expectedArrivalAt,
      getEffectiveRouteTravelMinutes(route),
    ),
    totalFareText: toEstimatedFareText(route),
    buffer: bufferLabel,
    transportSummary: featureText,
    stabilityLabel,
    reason: featureText,
    segments,
  };
}

function parseArrivalIso(clock: string | null): string | null {
  if (!clock) {
    return null;
  }

  const [hourText, minuteText] = clock.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}

function toMetersDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

const EMPTY_ROUTE: RouteCardItem = {
  id: 'empty',
  name: '추천 경로 없음',
  departure: '--:--',
  arrival: '--:--',
  totalDuration: '--',
  totalFareText: '--',
  buffer: '--',
  transportSummary: '경로를 계산 중입니다.',
  stabilityLabel: '여유',
  reason: '실시간 교통 데이터를 확인하고 있습니다.',
  segments: [],
};

export function useRouteRecommendState(): RouteRecommendViewModel {
  const { origin, destination, arrivalAt } = useCommutePlan();
  const samePointDistanceMeters = useMemo(() => {
    if (!origin || !destination) {
      return null;
    }

    return toMetersDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  }, [destination, origin]);
  const isSameOriginDestination = typeof samePointDistanceMeters === 'number' && samePointDistanceMeters < 80;

  const request = useMemo(() => {
    const arrivalIso = parseArrivalIso(arrivalAt);
    if (!origin || !destination || !arrivalIso) {
      return null;
    }

    return {
      origin: {
        name: origin.name,
        lat: origin.latitude,
        lng: origin.longitude,
      },
      destination: {
        name: destination.name,
        lat: destination.latitude,
        lng: destination.longitude,
      },
      arrivalAt: arrivalIso,
    };
  }, [arrivalAt, destination, origin]);

  const { data, isLoading, error, refetch } = useRecommendRoutes(
    isSameOriginDestination ? undefined : request ?? undefined,
  );

  return useMemo(() => {
    const headerDestination = destination?.name ?? '도착지 미설정';
    const headerArrivalAt = arrivalAt ?? '--:--';

    if (!request) {
      return {
        phase: 'error',
        status: 'warning',
        statusLabel: '설정 필요',
        subtitle: '출발지, 도착지, 도착시간을 먼저 선택해 주세요.',
        headerDestination,
        headerArrivalAt,
        recommended: EMPTY_ROUTE,
        alternatives: [],
        errorMessage: '경로 계산 조건이 부족합니다.',
        source: 'api' as const,
        refetch,
      };
    }

    if (isSameOriginDestination) {
      return {
        phase: 'error',
        status: 'warning',
        statusLabel: '좌표 확인',
        subtitle: '출발지와 도착지가 너무 가까워 경로를 계산할 수 없어요.',
        headerDestination,
        headerArrivalAt,
        recommended: EMPTY_ROUTE,
        alternatives: [],
        errorMessage: '출발지 또는 도착지를 다시 선택해 주세요.',
        source: 'api' as const,
        refetch,
      };
    }

    if (data) {
      const candidates = [data.primaryRoute, ...data.alternatives];
      const featureMap = buildFeatureMap(candidates);
      const [best, ...rest] = candidates;

      if (!best) {
        return {
          phase: 'error',
          status: 'warning',
          statusLabel: '후보 없음',
          subtitle: '도착 가능한 실시간 경로가 없습니다.',
          headerDestination,
          headerArrivalAt,
          recommended: EMPTY_ROUTE,
          alternatives: [],
          errorMessage: '도착 가능한 경로를 찾지 못했습니다.',
          source: 'api' as const,
          refetch,
        };
      }

      const resolvedStatus = resolveStatusFromApi(best.status);
      const lateMinutes = Math.max(1, Math.abs(Math.min(0, best.bufferMinutes)));
      const subtitle =
        data.allLate
          ? `지금 출발하면 늦습니다. 가장 빠른 경로도 약 ${lateMinutes}분 지연돼요.`
          : best.status === '긴급' || best.status === '위험'
            ? '지연 가능성이 높아 즉시 출발이 필요해요.'
            : data.nextAction;
      const statusLabel =
        best.status === '위험'
          ? '위험'
          : best.status === '긴급'
            ? '긴급'
            : resolvedStatus.label;
      return {
        phase: 'ready',
        status: resolvedStatus.key,
        statusLabel,
        subtitle,
        headerDestination,
        headerArrivalAt,
        recommended: toRouteCardItem(best, featureMap[best.route.id]),
        alternatives: rest.map((route) => toRouteCardItem(route, featureMap[route.route.id])),
        errorMessage: null,
        source: 'api' as const,
        refetch,
      };
    }

    if (isLoading) {
      return {
        phase: 'loading',
        status: 'warning',
        statusLabel: '계산 중',
        subtitle: '실시간 교통 데이터를 바탕으로 경로를 계산하고 있어요.',
        headerDestination,
        headerArrivalAt,
        recommended: EMPTY_ROUTE,
        alternatives: [],
        errorMessage: null,
        source: 'api' as const,
        refetch,
      };
    }

    return {
      phase: 'error',
      status: 'warning',
      statusLabel: '조회 실패',
      subtitle: '실시간 경로를 불러오지 못했어요.',
      headerDestination,
      headerArrivalAt,
      recommended: EMPTY_ROUTE,
      alternatives: [],
      errorMessage: error,
      source: 'api' as const,
      refetch,
    };
  }, [arrivalAt, data, destination?.name, error, isLoading, isSameOriginDestination, refetch, request]);
}
