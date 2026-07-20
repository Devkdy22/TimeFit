import { APP_ROUTES, type AppRoutePath } from '../constants/routes';

export interface TripRecoverySnapshot {
  trip: {
    status: string;
  };
  status: '여유' | '주의' | '긴급' | null;
}

export type RouteRecoveryDecision =
  | { action: 'none' }
  | { action: 'replace'; href: AppRoutePath }
  | { action: 'clear' }
  | { action: 'clear-and-replace'; href: AppRoutePath };

export function isCanonicalTransitPath(pathname: string) {
  return pathname === APP_ROUTES.transitMain || pathname === APP_ROUTES.transitArrival;
}

export function isDeprecatedTransitPath(pathname: string) {
  return pathname === '/transit/main' || pathname === '/transit/arrival' || pathname === '/moving';
}

export function isRecoveryEntryPath(pathname: string) {
  return pathname === '/' || pathname === APP_ROUTES.beforeStartHome;
}

export function isAuthCallbackPath(pathname: string) {
  return pathname === '/auth';
}

export function isActiveTripSnapshot(snapshot: TripRecoverySnapshot | null) {
  return Boolean(snapshot && snapshot.trip.status !== 'arrived' && snapshot.status !== null);
}

export function resolveTripRecoveryNavigation(input: {
  isAuthHydrating: boolean;
  isLoggedIn: boolean;
  pathname: string;
  storedTripId: string | null;
  trip: TripRecoverySnapshot | null;
  lookupFailed?: boolean;
}): RouteRecoveryDecision {
  if (input.isAuthHydrating || isAuthCallbackPath(input.pathname)) {
    return { action: 'none' };
  }

  const isTransitPath = isCanonicalTransitPath(input.pathname) || isDeprecatedTransitPath(input.pathname);

  if (!input.isLoggedIn) {
    return isTransitPath ? { action: 'clear-and-replace', href: APP_ROUTES.beforeStartHome } : { action: 'clear' };
  }

  if (!input.storedTripId) {
    return { action: 'none' };
  }

  if (input.lookupFailed || !isActiveTripSnapshot(input.trip)) {
    return isTransitPath ? { action: 'clear-and-replace', href: APP_ROUTES.beforeStartHome } : { action: 'clear' };
  }

  if (isRecoveryEntryPath(input.pathname) || isDeprecatedTransitPath(input.pathname)) {
    return { action: 'replace', href: APP_ROUTES.transitMain };
  }

  return { action: 'none' };
}
