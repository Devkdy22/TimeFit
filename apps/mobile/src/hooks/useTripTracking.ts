import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  fetchRouteCandidates,
  sendTripPosition,
  startTripTracking,
  type MobilityRoutePayload,
  type RecommendLocation,
  type TripPositionRequest,
  type TripPositionResult,
} from '../services/api/client';

const ROUTE_CANDIDATE_CACHE_TTL_MS = 3 * 60 * 1000;
const routeCandidateCache = new Map<
  string,
  {
    fetchedAt: number;
    candidates: MobilityRoutePayload[];
  }
>();
const routeCandidateInFlight = new Map<string, Promise<MobilityRoutePayload[]>>();

interface MovementState {
  currentSegmentIndex: number;
  progress: number;
  nextAction: string;
  distanceFromRouteMeters: number;
  isOffRoute: boolean;
  matchingConfidence: number;
}

interface UseTripTrackingInput {
  origin?: RecommendLocation;
  destination?: RecommendLocation;
  targetArrivalTime?: string;
  preferredRouteId?: string;
  getCurrentPosition: () => Promise<{
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  } | null>;
}

function toRouteKey(origin: RecommendLocation, destination: RecommendLocation) {
  const round = (value: number) => value.toFixed(5);
  return `${round(origin.lat)},${round(origin.lng)}->${round(destination.lat)},${round(destination.lng)}`;
}

async function getRouteCandidatesWithCache(input: {
  origin: RecommendLocation;
  destination: RecommendLocation;
}) {
  const key = toRouteKey(input.origin, input.destination);
  const now = Date.now();
  const cached = routeCandidateCache.get(key);
  if (cached && now - cached.fetchedAt < ROUTE_CANDIDATE_CACHE_TTL_MS && cached.candidates.length > 0) {
    return cached.candidates;
  }

  const inFlight = routeCandidateInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const fetched = await fetchRouteCandidates(input);
    routeCandidateCache.set(key, {
      fetchedAt: Date.now(),
      candidates: fetched.candidates,
    });
    return fetched.candidates;
  })().finally(() => {
    routeCandidateInFlight.delete(key);
  });

  routeCandidateInFlight.set(key, request);
  return request;
}

interface UseTripTrackingState {
  tripId: string | null;
  route: MobilityRoutePayload | null;
  status: '여유' | '주의' | '긴급' | null;
  nextAction: string | null;
  movement: MovementState | null;
  delayRisk: number | null;
  currentPosition: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  } | null;
  isRunning: boolean;
  isConnectingSse: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useTripTracking(input: UseTripTrackingInput): UseTripTrackingState {
  const [tripId, setTripId] = useState<string | null>(null);
  const [route, setRoute] = useState<MobilityRoutePayload | null>(null);
  const [status, setStatus] = useState<'여유' | '주의' | '긴급' | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [movement, setMovement] = useState<MovementState | null>(null);
  const [delayRisk, setDelayRisk] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isConnectingSse, setIsConnectingSse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const appStateListenerRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const startRequestedRef = useRef(false);

  const canStart = useMemo(
    () => Boolean(input.origin && input.destination && input.targetArrivalTime),
    [input.destination, input.origin, input.targetArrivalTime],
  );

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) {
      return;
    }
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const clearPositionTimer = useCallback(() => {
    if (!positionTimerRef.current) {
      return;
    }
    clearInterval(positionTimerRef.current);
    positionTimerRef.current = null;
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const applyEventPayload = useCallback((payload: Record<string, unknown>) => {
    const routeSummary = payload.routeSummary as
      | {
          delayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
          status?: '여유' | '주의' | '긴급';
        }
      | undefined;

    const movementPayload = payload.movement as
      | {
          currentSegmentIndex: number;
          progress: number;
          nextAction: string;
          distanceFromRouteMeters: number;
          isOffRoute: boolean;
          matchingConfidence?: number;
        }
      | undefined;

    if (movementPayload) {
      setMovement({
        currentSegmentIndex: movementPayload.currentSegmentIndex,
        progress: movementPayload.progress,
        nextAction: movementPayload.nextAction,
        distanceFromRouteMeters: movementPayload.distanceFromRouteMeters,
        isOffRoute: movementPayload.isOffRoute,
        matchingConfidence: movementPayload.matchingConfidence ?? 0,
      });
      setNextAction(movementPayload.nextAction);
    }

    if (routeSummary?.status) {
      setStatus(routeSummary.status);
    }

    if (routeSummary?.delayRiskLevel) {
      const risk =
        routeSummary.delayRiskLevel === 'HIGH'
          ? 0.9
          : routeSummary.delayRiskLevel === 'MEDIUM'
            ? 0.5
            : 0.2;
      setDelayRisk(risk);
    }
  }, []);

  const connectSse = useCallback(
    (nextTripId: string) => {
      if (typeof EventSource === 'undefined') {
        setError('SSE(EventSource) is not available in this runtime.');
        return;
      }

      clearReconnectTimer();
      closeEventSource();
      setIsConnectingSse(true);

      const base =
        process.env.EXPO_PUBLIC_API_URL ??
        process.env.EXPO_PUBLIC_API_BASE_URL ??
        'https://timefit-api.onrender.com';
      const normalizedBase = base.replace(/\/$/, '');
      const lastEventId = lastEventIdRef.current;
      const query = lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : '';
      const source = new EventSource(`${normalizedBase}/trips/${encodeURIComponent(nextTripId)}/events${query}`);
      eventSourceRef.current = source;

      source.addEventListener('open', () => {
        reconnectAttemptRef.current = 0;
        setIsConnectingSse(false);
      });

      const handleNamedEvent = (eventType: string) => {
        source.addEventListener(eventType, (event: MessageEvent) => {
          const id = (event as MessageEvent & { lastEventId?: string }).lastEventId;
          if (id) {
            lastEventIdRef.current = id;
          }

          try {
            const payload = JSON.parse(event.data) as Record<string, unknown>;

            if (eventType === 'INIT') {
              const initPayload = payload.payload as
                | {
                    route?: MobilityRoutePayload;
                    status?: '여유' | '주의' | '긴급';
                  }
                | undefined;

              if (initPayload?.route) {
                setRoute(initPayload.route);
              }
              if (initPayload?.status) {
                setStatus(initPayload.status);
              }
            }

            if (eventType === 'REROUTED') {
              const rerouted = payload.newRoute as MobilityRoutePayload | undefined;
              if (rerouted) {
                setRoute(rerouted);
              }
            }

            applyEventPayload(payload);
          } catch {
            setError('Failed to parse SSE payload.');
          }
        });
      };

      ['INIT', 'ETA_CHANGED', 'STATUS_CHANGED', 'REROUTED', 'POSITION_UPDATED', 'OFF_ROUTE', 'PING'].forEach(
        handleNamedEvent,
      );

      source.addEventListener('ERROR', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as { message?: string };
          if (payload.message) {
            setError(payload.message);
          }
        } catch {
          setError('SSE error');
        }
        source.close();
      });

      source.onerror = () => {
        setIsConnectingSse(false);
        source.close();

        if (!isRunning) {
          return;
        }

        reconnectAttemptRef.current += 1;
        const backoffMs = Math.min(10_000, 1000 * 2 ** reconnectAttemptRef.current);

        reconnectTimerRef.current = setTimeout(() => {
          connectSse(nextTripId);
        }, backoffMs);
      };
    },
    [applyEventPayload, clearReconnectTimer, closeEventSource, isRunning],
  );

  const sendPositionTick = useCallback(async () => {
    if (!tripId) {
      return;
    }

    try {
      const position = await input.getCurrentPosition();
      if (!position) {
        return;
      }

      const payload: TripPositionRequest = {
        ...position,
        timestamp: Date.now(),
      };
      setCurrentPosition(position);

      const movementResult: TripPositionResult = await sendTripPosition(tripId, payload);
      if (movementResult.ignored) {
        return;
      }

      setMovement({
        currentSegmentIndex: movementResult.currentSegmentIndex,
        progress: movementResult.progress,
        nextAction: movementResult.nextAction,
        distanceFromRouteMeters: movementResult.distanceFromRouteMeters,
        isOffRoute: movementResult.isOffRoute,
        matchingConfidence: movementResult.matchingConfidence,
      });
      setNextAction(movementResult.nextAction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send position');
    }
  }, [input, tripId]);

  const startPositionLoop = useCallback(() => {
    clearPositionTimer();

    const intervalMs = appStateRef.current === 'active' ? 2000 : 7000;
    positionTimerRef.current = setInterval(() => {
      void sendPositionTick();
    }, intervalMs);
  }, [clearPositionTimer, sendPositionTick]);

  const stop = useCallback(() => {
    setIsRunning(false);
    startRequestedRef.current = false;
    clearPositionTimer();
    clearReconnectTimer();
    closeEventSource();
  }, [clearPositionTimer, clearReconnectTimer, closeEventSource]);

  const start = useCallback(async () => {
    if (startRequestedRef.current || isRunning) {
      return;
    }

    if (!canStart || !input.origin || !input.destination || !input.targetArrivalTime) {
      setError('origin/destination/targetArrivalTime are required');
      return;
    }

    startRequestedRef.current = true;
    setError(null);

    try {
      const candidates = await getRouteCandidatesWithCache({
        origin: input.origin,
        destination: input.destination,
      });
      const selectedRoute = input.preferredRouteId
        ? candidates.find((candidate) => candidate.id === input.preferredRouteId) ?? candidates[0]
        : candidates[0];
      if (!selectedRoute) {
        throw new Error('No route candidates returned');
      }

      const pos = await input.getCurrentPosition();
      if (!pos) {
        throw new Error('Current position unavailable');
      }
      setCurrentPosition(pos);

      setRoute(selectedRoute);

      const started = await startTripTracking({
        userId: 'mobile-user',
        recommendationId: selectedRoute.id,
        route: selectedRoute,
        targetArrivalTime: input.targetArrivalTime,
        currentPosition: {
          lat: pos.lat,
          lng: pos.lng,
        },
      });

      setTripId(started.tripId);
      setStatus(started.status);
      setIsRunning(true);

      connectSse(started.tripId);
      startPositionLoop();
    } catch (err) {
      startRequestedRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to start trip tracking');
    }
  }, [canStart, connectSse, input, isRunning, startPositionLoop]);

  useEffect(() => {
    appStateListenerRef.current = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (isRunning) {
        startPositionLoop();
      }
    });

    return () => {
      appStateListenerRef.current?.remove();
      stop();
    };
  }, [isRunning, startPositionLoop, stop]);

  return {
    tripId,
    route,
    status,
    nextAction,
    movement,
    delayRisk,
    currentPosition,
    isRunning,
    isConnectingSse,
    error,
    start,
    stop,
  };
}
