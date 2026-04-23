import { useCallback, useRef } from 'react';
import { resolveCurrentLocationOnce, type ResolvedCurrentLocation } from './location.service';

export function useCurrentLocation() {
  const inFlightRef = useRef<Promise<ResolvedCurrentLocation> | null>(null);

  const resolveOnce = useCallback(async (options?: { forceFresh?: boolean }) => {
    if (inFlightRef.current) {
      console.info('[Location] already tracking, skipped duplicate start');
      return inFlightRef.current;
    }

    const promise = resolveCurrentLocationOnce(options).finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = promise;
    return promise;
  }, []);

  return {
    resolveOnce,
  };
}
