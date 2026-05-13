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
  const request = useMemo(() => input ?? null, [input]);
  const [data, setData] = useState<RecommendResult | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(request));
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const autoFetchedKeyRef = useRef<string | null>(null);

  const requestKey = useMemo(() => {
    if (!request) {
      return null;
    }
    return JSON.stringify(request);
  }, [request]);

  const run = useCallback(async () => {
    if (!request || !requestKey) {
      setData(null);
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
  }, [request, requestKey]);

  useEffect(() => {
    if (!request) {
      setIsLoading(false);
      autoFetchedKeyRef.current = null;
      return;
    }
    if (autoFetchedKeyRef.current === requestKey) {
      return;
    }
    autoFetchedKeyRef.current = requestKey;
    void run();
  }, [request, requestKey, run]);

  return {
    data,
    isLoading,
    error,
    refetch: run,
  };
}
