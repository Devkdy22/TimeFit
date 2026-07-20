import { APP_ROUTES } from '../../constants/routes';
import { buildDeprecatedRedirectHref } from '../../navigation/deprecatedRoute';
import { claimSingleCallback, resolveOAuthCallbackRoute } from '../../navigation/oauthCallbackRoute';
import {
  resolveTripRecoveryNavigation,
  isCanonicalTransitPath,
} from '../../navigation/routeRecoveryPolicy';
import { createNavigationHelper } from '../../utils/navigation';
import type { TripSnapshotResult } from '../../services/api/client';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

function createRouterMock() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };
}

function activeTrip(): TripSnapshotResult {
  return {
    trip: {
      id: 'trip-1',
      status: 'moving',
    },
    route: null,
    status: '여유',
    bufferMinutes: 5,
  };
}

function endedTrip(): TripSnapshotResult {
  return {
    trip: {
      id: 'trip-1',
      status: 'arrived',
    },
    route: null,
    status: null,
    bufferMinutes: null,
  };
}

describe('navigation route policy', () => {
  it('handles OAuth success callback without storing raw tokens in route state', () => {
    const result = resolveOAuthCallbackRoute({
      isLoggedIn: false,
      params: {
        ticket: 'login-ticket',
        state: 'oauth-state',
        provider: 'google',
      },
    });

    expect(result).toEqual({
      action: 'redeem',
      callback: {
        ticket: 'login-ticket',
        state: 'oauth-state',
        provider: 'google',
        source: 'auth_route',
      },
    });
    expect(JSON.stringify(result)).not.toContain('refresh');
    expect(JSON.stringify(result)).not.toContain('accessToken');
  });

  it('handles OAuth cancel and error callbacks through the redeem path', () => {
    expect(resolveOAuthCallbackRoute({
      isLoggedIn: false,
      params: { error: 'access_denied', provider: 'kakao' },
    })).toEqual({
      action: 'redeem',
      callback: {
        error: 'access_denied',
        provider: 'kakao',
        source: 'auth_route',
      },
    });

    expect(resolveOAuthCallbackRoute({
      isLoggedIn: false,
      params: { error: 'cancelled', provider: 'naver' },
    })).toMatchObject({
      action: 'redeem',
      callback: {
        error: 'cancelled',
        provider: 'naver',
      },
    });
  });

  it('prevents duplicate OAuth callback handling', () => {
    const handled = { current: false };
    expect(claimSingleCallback(handled)).toBe(true);
    expect(claimSingleCallback(handled)).toBe(false);
  });

  it('replaces login route after login completion', () => {
    const router = createRouterMock();
    const nav = createNavigationHelper(router, APP_ROUTES.reengagementLogin);
    nav.replaceToHome();
    expect(router.replace).toHaveBeenCalledWith(APP_ROUTES.beforeStartHome);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('navigates recommendation to detail to canonical in-transit and avoids duplicate detail pushes', () => {
    const detailRouter = createRouterMock();
    createNavigationHelper(detailRouter, APP_ROUTES.beforeDepartureRecommendation).goToRecommendationDetail();
    expect(detailRouter.push).toHaveBeenCalledWith(APP_ROUTES.beforeDepartureDetail);

    const duplicateRouter = createRouterMock();
    createNavigationHelper(duplicateRouter, APP_ROUTES.beforeDepartureDetail).goToRecommendationDetail();
    expect(duplicateRouter.push).not.toHaveBeenCalled();

    const transitRouter = createRouterMock();
    createNavigationHelper(transitRouter, APP_ROUTES.beforeDepartureDetail).goToTransit();
    expect(transitRouter.replace).toHaveBeenCalledWith(APP_ROUTES.transitMain);
    expect(APP_ROUTES.transitMain).toBe('/in-transit/moving');
  });

  it('replaces arrival with home return path', () => {
    const router = createRouterMock();
    createNavigationHelper(router, APP_ROUTES.transitArrival).replaceToHome();
    expect(router.replace).toHaveBeenCalledWith(APP_ROUTES.beforeStartHome);
  });

  it('preserves params when redirecting deprecated routes', () => {
    expect(buildDeprecatedRedirectHref(APP_ROUTES.transitMain, {
      tripId: 'trip-1',
      source: 'legacy',
      empty: undefined,
    })).toEqual({
      pathname: APP_ROUTES.transitMain,
      params: {
        tripId: 'trip-1',
        source: 'legacy',
      },
    });
  });

  it('recovers an active Trip to canonical in-transit from app entry', () => {
    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: false,
      isLoggedIn: true,
      pathname: APP_ROUTES.beforeStartHome,
      storedTripId: 'trip-1',
      trip: activeTrip(),
    })).toEqual({ action: 'replace', href: APP_ROUTES.transitMain });
  });

  it('sends ended or invalid Trip recovery to home from transit', () => {
    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: false,
      isLoggedIn: true,
      pathname: APP_ROUTES.transitMain,
      storedTripId: 'trip-1',
      trip: endedTrip(),
    })).toEqual({ action: 'clear-and-replace', href: APP_ROUTES.beforeStartHome });

    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: false,
      isLoggedIn: true,
      pathname: '/transit/main',
      storedTripId: 'trip-1',
      trip: null,
      lookupFailed: true,
    })).toEqual({ action: 'clear-and-replace', href: APP_ROUTES.beforeStartHome });
  });

  it('does not redirect while auth is hydrating or callback is being processed', () => {
    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: true,
      isLoggedIn: false,
      pathname: APP_ROUTES.beforeStartHome,
      storedTripId: 'trip-1',
      trip: null,
    })).toEqual({ action: 'none' });

    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: false,
      isLoggedIn: true,
      pathname: '/auth',
      storedTripId: 'trip-1',
      trip: activeTrip(),
    })).toEqual({ action: 'none' });
  });

  it('does not create an infinite redirect on canonical in-transit', () => {
    expect(isCanonicalTransitPath(APP_ROUTES.transitMain)).toBe(true);
    expect(resolveTripRecoveryNavigation({
      isAuthHydrating: false,
      isLoggedIn: true,
      pathname: APP_ROUTES.transitMain,
      storedTripId: 'trip-1',
      trip: activeTrip(),
    })).toEqual({ action: 'none' });
  });
});
