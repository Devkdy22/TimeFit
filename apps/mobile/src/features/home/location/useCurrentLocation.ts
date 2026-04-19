import { useCallback, useEffect, useRef } from 'react';
import { resolveCurrentLocationOnce, type ResolvedCurrentLocation } from './location.service';

export function useCurrentLocation() {
  const inFlightRef = useRef<Promise<ResolvedCurrentLocation> | null>(null);

  const resolveOnce = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const promise = resolveCurrentLocationOnce().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    void resolveOnce().catch((error) => {
      console.info('[Location]', 'GPS ERROR', {
        message: error instanceof Error ? error.message : String(error),
        stage: 'mount-prime',
      });
    });
  }, [resolveOnce]);

  return {
    resolveOnce,
  };
}
