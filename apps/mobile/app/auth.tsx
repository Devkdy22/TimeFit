import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { APP_ROUTES } from '../src/constants/routes';
import { useAuth, type SocialProvider } from '../src/features/auth/context';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readProvider(value: string | string[] | undefined): SocialProvider | undefined {
  const provider = firstParam(value);
  if (provider === 'google' || provider === 'kakao' || provider === 'naver') {
    return provider;
  }
  return undefined;
}

export default function OAuthCallbackRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ticket?: string | string[];
    state?: string | string[];
    provider?: string | string[];
    error?: string | string[];
  }>();
  const { isLoggedIn, redeemOAuthCallback } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const ticket = firstParam(params.ticket);
    const error = firstParam(params.error);
    const state = firstParam(params.state);
    const provider = readProvider(params.provider);

    if (!ticket && !error) {
      router.replace(isLoggedIn ? APP_ROUTES.beforeStartHome : APP_ROUTES.reengagementLogin);
      return;
    }

    void redeemOAuthCallback({
      ticket,
      error,
      state,
      provider,
      source: 'auth_route',
    })
      .then(() => {
        router.replace(APP_ROUTES.beforeStartHome);
      })
      .catch((nextError: unknown) => {
        console.warn('[Auth][OAuth]', {
          event: 'oauth_route_redeem_failed',
          provider,
          hasTicket: Boolean(ticket),
          hasState: Boolean(state),
          message: nextError instanceof Error ? nextError.message : 'unknown',
        });
        router.replace(APP_ROUTES.reengagementLogin);
      });
  }, [isLoggedIn, params.error, params.provider, params.state, params.ticket, redeemOAuthCallback, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="small" color="#58C7C2" />
    </View>
  );
}
