import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type RecommendRequest,
  type RecommendResult,
  recommendRoutes,
} from '../services/api/client';

interface UseRecommendRoutesState {
  data: RecommendResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecommendRoutes(input?: RecommendRequest): UseRecommendRoutesState {
  const freezeAfterFirstSearch =
    (process.env.EXPO_PUBLIC_FREEZE_ROUTE_RECOMMENDATION ?? '').toLowerCase() === 'true';
  const request = useMemo(() => input ?? null, [input]);
  const [data, setData] = useState<RecommendResult | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(request));
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const autoFetchedKeyRef = useRef<string | null>(null);
  const frozenResponseRef = useRef<RecommendResult | null>(null);

  const requestKey = useMemo(() => {
    if (!request) {
      return null;
    }
    return JSON.stringify(request);
  }, [request]);

  const run = useCallback(async () => {
    if (freezeAfterFirstSearch && frozenResponseRef.current) {
      setData(frozenResponseRef.current);
      setIsLoading(false);
      return;
    }

    if (!request || !requestKey) {
      if (!freezeAfterFirstSearch) {
        setData(null);
      }
      setError('출발지/도착지/도착시간을 먼저 설정해 주세요.');
      setIsLoading(false);
      return;
    }

    if (inFlightRef.current && inFlightKeyRef.current === requestKey) {
      await inFlightRef.current;
      return;
    }

    const task = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await recommendRoutes(request);
        if (freezeAfterFirstSearch && !frozenResponseRef.current) {
          frozenResponseRef.current = response;
        }
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '추천 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    })();

    inFlightKeyRef.current = requestKey;
    inFlightRef.current = task;
    await task;
    inFlightRef.current = null;
    inFlightKeyRef.current = null;
  }, [freezeAfterFirstSearch, request, requestKey]);

  useEffect(() => {
    if (!request) {
      setIsLoading(false);
      autoFetchedKeyRef.current = null;
      return;
    }
    if (freezeAfterFirstSearch && frozenResponseRef.current) {
      setData(frozenResponseRef.current);
      setIsLoading(false);
      return;
    }
    if (autoFetchedKeyRef.current === requestKey) {
      return;
    }
    autoFetchedKeyRef.current = requestKey;
    void run();
  }, [freezeAfterFirstSearch, request, requestKey, run]);

  return {
    data,
    isLoading,
    error,
    refetch: run,
  };
}
