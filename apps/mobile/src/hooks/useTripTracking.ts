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
  previewOnly?: boolean;
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

type EventSourceState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

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
  const isRunningRef = useRef(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const appStateListenerRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const startRequestedRef = useRef(false);
  const tripIdRef = useRef<string | null>(null);
  const mountCountRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const positionInFlightRef = useRef(false);
  const eventSourceStateRef = useRef<EventSourceState>('idle');
  const activeLoopCountRef = useRef(0);
  const lastPositionTimestampRef = useRef(0);

  const logDebug = useCallback(
    (event: string, fields?: Record<string, unknown>) => {
      console.debug('[TripTracking]', {
        event,
        tripId: tripId ?? null,
        sessionGeneration: sessionGenerationRef.current,
        reconnectAttempt: reconnectAttemptRef.current,
        activeLoopCount: activeLoopCountRef.current,
        EventSourceState: eventSourceStateRef.current,
        lastPositionTimestamp: lastPositionTimestampRef.current,
        ...(fields ?? {}),
      });
    },
    [tripId],
  );

  const updateActiveLoopCount = useCallback(() => {
    activeLoopCountRef.current =
      (positionTimerRef.current ? 1 : 0) +
      (reconnectTimerRef.current ? 1 : 0) +
      (eventSourceRef.current ? 1 : 0);
  }, []);

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
    updateActiveLoopCount();
  }, [updateActiveLoopCount]);

  const clearPositionTimer = useCallback(() => {
    if (!positionTimerRef.current) {
      return;
    }
    clearInterval(positionTimerRef.current);
    positionTimerRef.current = null;
    updateActiveLoopCount();
  }, [updateActiveLoopCount]);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      eventSourceStateRef.current = 'closed';
      updateActiveLoopCount();
    }
  }, [updateActiveLoopCount]);

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
    (nextTripId: string, generation: number) => {
      if (generation !== sessionGenerationRef.current) {
        return;
      }

      if (typeof EventSource === 'undefined') {
        setError('SSE(EventSource) is not available in this runtime.');
        logDebug('sse_unavailable', {
          nextTripId,
          generation,
        });
        return;
      }

      clearReconnectTimer();
      closeEventSource();
      setIsConnectingSse(true);
      eventSourceStateRef.current = 'connecting';

      const base =
        process.env.EXPO_PUBLIC_API_URL ??
        process.env.EXPO_PUBLIC_API_BASE_URL ??
        'https://timefit-api.onrender.com';
      const normalizedBase = base.replace(/\/$/, '');
      const lastEventId = lastEventIdRef.current;
      const query = lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : '';
      const source = new EventSource(`${normalizedBase}/trips/${encodeURIComponent(nextTripId)}/events${query}`);
      eventSourceRef.current = source;
      updateActiveLoopCount();
      logDebug('sse_connecting', {
        nextTripId,
        generation,
        hasLastEventId: Boolean(lastEventId),
      });

      source.addEventListener('open', () => {
        if (generation !== sessionGenerationRef.current) {
          return;
        }
        reconnectAttemptRef.current = 0;
        setIsConnectingSse(false);
        eventSourceStateRef.current = 'open';
        logDebug('sse_open', {
          nextTripId,
          generation,
        });
      });

      const handleNamedEvent = (eventType: string) => {
        source.addEventListener(eventType, (event: MessageEvent) => {
          if (generation !== sessionGenerationRef.current) {
            return;
          }

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
            logDebug('sse_parse_error', {
              eventType,
              generation,
            });
          }
        });
      };

      ['INIT', 'ETA_CHANGED', 'STATUS_CHANGED', 'REROUTED', 'POSITION_UPDATED', 'OFF_ROUTE', 'PING'].forEach(
        handleNamedEvent,
      );

      source.addEventListener('ERROR', (event: MessageEvent) => {
        if (generation !== sessionGenerationRef.current) {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as { message?: string };
          if (payload.message) {
            setError(payload.message);
            logDebug('sse_server_error', {
              generation,
              message: payload.message,
            });
          }
        } catch {
          setError('SSE error');
          logDebug('sse_server_error_parse_failed', {
            generation,
          });
        }
        source.close();
        eventSourceStateRef.current = 'closed';
        updateActiveLoopCount();
      });

      source.onerror = () => {
        if (generation !== sessionGenerationRef.current) {
          return;
        }
        setIsConnectingSse(false);
        source.close();
        eventSourceStateRef.current = 'error';
        updateActiveLoopCount();

        if (!isRunningRef.current) {
          logDebug('sse_reconnect_skipped_not_running', {
            generation,
          });
          return;
        }

        reconnectAttemptRef.current += 1;
        const backoffMs = Math.min(10_000, 1000 * 2 ** reconnectAttemptRef.current);
        logDebug('sse_reconnect_scheduled', {
          generation,
          backoffMs,
        });

        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (generation !== sessionGenerationRef.current) {
            return;
          }
          connectSse(nextTripId, generation);
        }, backoffMs);
        updateActiveLoopCount();
      };
    },
    [applyEventPayload, clearReconnectTimer, closeEventSource, logDebug, updateActiveLoopCount],
  );

  const sendPositionTick = useCallback(async () => {
    const activeTripId = tripIdRef.current;
    if (!activeTripId || positionInFlightRef.current) {
      return;
    }

    positionInFlightRef.current = true;
    try {
      const position = await input.getCurrentPosition();
      if (!position) {
        return;
      }

      const payload: TripPositionRequest = {
        ...position,
        timestamp: Date.now(),
      };
      lastPositionTimestampRef.current = payload.timestamp;
      setCurrentPosition(position);

      const movementResult: TripPositionResult = await sendTripPosition(activeTripId, payload);
      if (movementResult.ignored) {
        logDebug('position_ignored', {
          reason: movementResult.reason ?? 'unknown',
        });
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
      logDebug('position_send_failed', {
        message: err instanceof Error ? err.message : 'unknown_error',
      });
    } finally {
      positionInFlightRef.current = false;
    }
  }, [input, logDebug]);

  const startPositionLoop = useCallback(() => {
    clearPositionTimer();

    const intervalMs = appStateRef.current === 'active' ? 2000 : 7000;
    positionTimerRef.current = setInterval(() => {
      void sendPositionTick();
    }, intervalMs);
    updateActiveLoopCount();
    logDebug('position_loop_started', {
      intervalMs,
      appState: appStateRef.current,
    });
  }, [clearPositionTimer, logDebug, sendPositionTick, updateActiveLoopCount]);

  const stop = useCallback(() => {
    sessionGenerationRef.current += 1;
    isRunningRef.current = false;
    setIsRunning(false);
    startRequestedRef.current = false;
    clearPositionTimer();
    clearReconnectTimer();
    closeEventSource();
    setIsConnectingSse(false);
    reconnectAttemptRef.current = 0;
    positionInFlightRef.current = false;
    logDebug('tracking_stopped');
  }, [clearPositionTimer, clearReconnectTimer, closeEventSource, logDebug]);

  const start = useCallback(async () => {
    if (startRequestedRef.current || isRunning) {
      return;
    }

    if (!canStart || !input.origin || !input.destination || !input.targetArrivalTime) {
      setError('origin/destination/targetArrivalTime are required');
      return;
    }

    startRequestedRef.current = true;
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    setError(null);
    reconnectAttemptRef.current = 0;
    lastEventIdRef.current = null;
    lastPositionTimestampRef.current = 0;
    logDebug('tracking_start_requested', {
      generation,
    });

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

      setRoute(selectedRoute);

      if (input.previewOnly) {
        setStatus('여유');
        startRequestedRef.current = false;
        logDebug('tracking_preview_only', {
          generation,
        });
        return;
      }

      const pos = await input.getCurrentPosition();
      if (!pos) {
        throw new Error('Current position unavailable');
      }
      setCurrentPosition(pos);

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
      isRunningRef.current = true;
      setIsRunning(true);
      startRequestedRef.current = false;
      logDebug('tracking_started', {
        generation,
        startedTripId: started.tripId,
      });

      connectSse(started.tripId, generation);
      startPositionLoop();
      void sendPositionTick();
    } catch (err) {
      startRequestedRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to start trip tracking');
      logDebug('tracking_start_failed', {
        generation,
        message: err instanceof Error ? err.message : 'unknown_error',
      });
    }
  }, [canStart, connectSse, input, isRunning, logDebug, sendPositionTick, startPositionLoop]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    tripIdRef.current = tripId;
  }, [tripId]);

  useEffect(() => {
    appStateListenerRef.current = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (isRunningRef.current) {
        startPositionLoop();
      }
    });

    return () => {
      appStateListenerRef.current?.remove();
    };
  }, [startPositionLoop]);

  useEffect(() => {
    mountCountRef.current += 1;
    return () => {
      const isDevStrictPreCleanup =
        process.env.NODE_ENV !== 'production' && mountCountRef.current === 1;
      if (isDevStrictPreCleanup) {
        return;
      }
      stop();
    };
  }, [stop]);

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
