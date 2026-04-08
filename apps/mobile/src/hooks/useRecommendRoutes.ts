import { useCallback, useEffect, useMemo, useState } from 'react';
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

const DEFAULT_RECOMMEND_INPUT: RecommendRequest = {
  origin: {
    name: '집',
    lat: 37.5665,
    lng: 126.978,
  },
  destination: {
    name: '강남역',
    lat: 37.4979,
    lng: 127.0276,
  },
  arrivalAt: new Date(Date.now() + 45 * 60_000).toISOString(),
};

export function useRecommendRoutes(input?: RecommendRequest): UseRecommendRoutesState {
  const request = useMemo(() => input ?? DEFAULT_RECOMMEND_INPUT, [input]);
  const [data, setData] = useState<RecommendResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
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
  }, [request]);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    data,
    isLoading,
    error,
    refetch: run,
  };
}
