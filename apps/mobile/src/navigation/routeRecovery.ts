import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '../features/auth/context';
import {
  clearStoredActiveTripId,
  getStoredActiveTripId,
} from '../features/moving/model/activeTripStorage';
import { getTripTracking, type TripSnapshotResult } from '../services/api/client';
import { isAuthCallbackPath, resolveTripRecoveryNavigation } from './routeRecoveryPolicy';

export function AppNavigationCoordinator() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthHydrating, isLoggedIn } = useAuth();
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${isAuthHydrating}:${isLoggedIn}:${pathname}`;
    if (inFlightKeyRef.current === key) {
      return;
    }
    inFlightKeyRef.current = key;

    let cancelled = false;

    async function run() {
      let storedTripId: string | null = null;
      let trip: TripSnapshotResult | null = null;
      let lookupFailed = false;

      if (!isAuthHydrating) {
        storedTripId = await getStoredActiveTripId();
      }

      if (storedTripId && isLoggedIn && !isAuthCallbackPath(pathname)) {
        try {
          trip = await getTripTracking(storedTripId);
        } catch {
          lookupFailed = true;
        }
      }

      if (cancelled) {
        return;
      }

      const decision = resolveTripRecoveryNavigation({
        isAuthHydrating,
        isLoggedIn,
        pathname,
        storedTripId,
        trip,
        lookupFailed,
      });

      if (decision.action === 'clear' || decision.action === 'clear-and-replace') {
        await clearStoredActiveTripId();
      }

      if (cancelled) {
        return;
      }

      if (decision.action === 'replace' || decision.action === 'clear-and-replace') {
        router.replace(decision.href);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAuthHydrating, isLoggedIn, pathname, router]);

  return null;
}
