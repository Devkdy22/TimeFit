import { useEffect, useState } from 'react';
import type { CurrentLocation } from './types';

export interface LocationProvider {
  subscribe: (onUpdate: (location: CurrentLocation) => void) => () => void;
}

export function useCurrentLocationBridge(
  initialLocation: CurrentLocation,
  provider?: LocationProvider,
) {
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(initialLocation);

  useEffect(() => {
    if (!provider) {
      return;
    }

    return provider.subscribe((nextLocation) => {
      setCurrentLocation(nextLocation);
    });
  }, [provider]);

  return currentLocation;
}

