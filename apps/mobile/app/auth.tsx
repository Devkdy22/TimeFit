import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { APP_ROUTES } from '../src/constants/routes';
import { useAuth } from '../src/features/auth/context';
import { claimSingleCallback, resolveOAuthCallbackRoute } from '../src/navigation/oauthCallbackRoute';

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
    if (!claimSingleCallback(handledRef)) {
      return;
    }

    const next = resolveOAuthCallbackRoute({ params, isLoggedIn });
    if (next.action === 'redirect') {
      router.replace(next.href);
      return;
    }

    void redeemOAuthCallback(next.callback)
      .then(() => {
        router.replace(APP_ROUTES.beforeStartHome);
      })
      .catch((nextError: unknown) => {
        console.warn('[Auth][OAuth]', {
          event: 'oauth_route_redeem_failed',
          provider: next.callback.provider,
          hasTicket: Boolean(next.callback.ticket),
          hasState: Boolean(next.callback.state),
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
