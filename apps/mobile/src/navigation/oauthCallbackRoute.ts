import { APP_ROUTES, type AppRoutePath } from '../constants/routes';
import type { OAuthCallbackInput, SocialProvider } from '../features/auth/context';

export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readRouteProvider(value: string | string[] | undefined): SocialProvider | undefined {
  const provider = firstRouteParam(value);
  if (provider === 'google' || provider === 'kakao' || provider === 'naver') {
    return provider;
  }
  return undefined;
}

export function claimSingleCallback(ref: { current: boolean }) {
  if (ref.current) {
    return false;
  }
  ref.current = true;
  return true;
}

export function resolveOAuthCallbackRoute(input: {
  params: {
    ticket?: string | string[];
    state?: string | string[];
    provider?: string | string[];
    error?: string | string[];
  };
  isLoggedIn: boolean;
}):
  | { action: 'redirect'; href: AppRoutePath }
  | { action: 'redeem'; callback: OAuthCallbackInput } {
  const ticket = firstRouteParam(input.params.ticket);
  const error = firstRouteParam(input.params.error);
  const state = firstRouteParam(input.params.state);
  const provider = readRouteProvider(input.params.provider);

  if (!ticket && !error) {
    return {
      action: 'redirect',
      href: input.isLoggedIn ? APP_ROUTES.beforeStartHome : APP_ROUTES.reengagementLogin,
    };
  }

  return {
    action: 'redeem',
    callback: {
      ticket,
      error,
      state,
      provider,
      source: 'auth_route',
    },
  };
}
