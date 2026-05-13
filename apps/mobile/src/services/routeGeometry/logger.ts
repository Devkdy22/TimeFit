import { GeometrySource, TransportMode } from './types';

interface GeometryLogParams {
  mode: TransportMode;
  source: GeometrySource;
  pointCount: number;
  segmentId: string;
  warning?: string;
}

export function logGeometry(params: GeometryLogParams): void {
  const { mode, source, pointCount, segmentId, warning } = params;

  console.log('[RouteGeometry]', {
    mode,
    source,
    pointCount,
    segmentId,
  });

  if (mode === 'WALK' && pointCount < 50) {
    console.warn(
      `[RouteGeometry][WALK][LOW_QUALITY] segmentId=${segmentId} pointCount=${pointCount} (권장: 50 이상)`,
    );
  }
  if (mode === 'BUS' && pointCount < 30) {
    console.warn(
      `[RouteGeometry][BUS][LOW_QUALITY] segmentId=${segmentId} pointCount=${pointCount} (권장: 30 이상)`,
    );
  }
  if (mode === 'SUBWAY' && pointCount < 3) {
    console.warn(
      `[RouteGeometry][SUBWAY][LOW_QUALITY] segmentId=${segmentId} pointCount=${pointCount} (최소: 3 이상)`,
    );
  }
  if (warning) {
    console.warn(`[RouteGeometry][${mode}] ${warning} segmentId=${segmentId}`);
  }
}

export function logFallback(mode: TransportMode, segmentId: string, reason: string): void {
  if (mode === 'BUS') {
    console.warn('[RouteGeometry][BUS][FALLBACK_PASS_STOPS]', { segmentId, reason });
  }
  if (mode === 'SUBWAY') {
    console.warn('[RouteGeometry][SUBWAY][FALLBACK_TWO_POINTS]', { segmentId, reason });
  }
  if (mode === 'WALK') {
    console.warn('[RouteGeometry][WALK][FALLBACK_TWO_POINTS]', { segmentId, reason });
  }
}
