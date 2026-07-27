import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
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

  const isDevelopmentRoute = __DEV__ && pathname.startsWith('/dev/');

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const navigateToDevelopmentRoute = (url: string) => {
      const parsed = Linking.parse(url);
      const developmentPath = parsed.hostname === 'dev' && parsed.path ? `/dev/${parsed.path.replace(/^\//, '')}` : parsed.path;
      if (developmentPath?.startsWith('/dev/')) {
        router.push(developmentPath as never);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => navigateToDevelopmentRoute(url));
    void Linking.getInitialURL().then((url) => {
      if (url) {
        navigateToDevelopmentRoute(url);
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (isDevelopmentRoute) {
      return;
    }

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
  }, [isAuthHydrating, isLoggedIn, isDevelopmentRoute, pathname, router]);

  return null;
}
