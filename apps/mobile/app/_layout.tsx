import 'react-native-gesture-handler';
import { useEffect, type ReactNode } from 'react';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/features/auth/context';
import { CommutePlanProvider } from '../src/features/commute-state/context';
import { RoutineProvider } from '../src/features/routine/context';
import { AppNavigationCoordinator } from '../src/navigation/routeRecovery';
import { preloadSubwayLines } from '../src/utils/subwayLineCache';
import PretendardMedium from '../assets/fonts/Pretendard-Medium.ttf';
import PretendardSemiBold from '../assets/fonts/Pretendard-SemiBold.ttf';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Medium': PretendardMedium,
    'Pretendard-SemiBold': PretendardSemiBold,
  });

  useEffect(() => {
    void preloadSubwayLines();
  }, []);

  useEffect(() => {
    let isMounted = true;

    void Linking.getInitialURL()
      .then((url) => {
        if (!isMounted) {
          return;
        }
        logDeepLinkRuntime('initial_url', url);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        logDeepLinkRuntime('initial_url_error', null, error);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      logDeepLinkRuntime('url_event', url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="small" color="#58C7C2" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthGate>
          <RoutineProvider>
            <CommutePlanProvider>
              <AppNavigationCoordinator />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(before-start)" />
                <Stack.Screen name="(before-departure)" />
                <Stack.Screen name="(in-transit)" />
                <Stack.Screen name="(re-engagement)" />
                <Stack.Screen name="(transit)" />
                <Stack.Screen name="(re-engage)" />
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
                <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="search" />
                <Stack.Screen name="route" />
                <Stack.Screen name="moving" />
                <Stack.Screen name="test-map" />
                {__DEV__ ? <Stack.Screen name="dev/timey-preview" /> : null}
                {__DEV__ ? <Stack.Screen name="dev/timey-export" /> : null}
              </Stack>
            </CommutePlanProvider>
          </RoutineProvider>
        </AuthGate>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthHydrating } = useAuth();
  if (isAuthHydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="small" color="#58C7C2" />
      </View>
    );
  }
  return <>{children}</>;
}

function resolveDeepLinkRuntime() {
  const appOwnership = Constants.appOwnership ?? 'unknown';
  const executionEnvironment = Constants.executionEnvironment ?? 'unknown';

  if (Platform.OS === 'web') {
    return {
      appOwnership,
      executionEnvironment,
      redirectRuntime: 'web',
      redirectUri: null,
    };
  }

  if (appOwnership === 'expo') {
    return {
      appOwnership,
      executionEnvironment,
      redirectRuntime: 'expo-go',
      redirectUri: 'https://auth.expo.io/@devkdy/timefit-mobile',
    };
  }

  return {
    appOwnership,
    executionEnvironment,
    redirectRuntime: 'dev-build-or-standalone',
    redirectUri: 'timefit://auth',
  };
}

function logDeepLinkRuntime(event: string, url: string | null, error?: unknown) {
  const runtime = resolveDeepLinkRuntime();

  console.info('[DeepLink][Runtime]', {
    event,
    received: Boolean(url),
    url,
    appOwnership: runtime.appOwnership,
    executionEnvironment: runtime.executionEnvironment,
    redirectRuntime: runtime.redirectRuntime,
    redirectUri: runtime.redirectUri,
    error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
  });
}
