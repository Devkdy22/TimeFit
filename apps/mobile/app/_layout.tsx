import { Stack } from 'expo-router';
import { CommutePlanProvider } from '../src/features/commute-state/context';

export default function RootLayout() {
  return (
    <CommutePlanProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(before-start)" />
        <Stack.Screen name="(before-departure)" />
        <Stack.Screen name="(transit)" />
        <Stack.Screen name="(re-engagement)" />
        <Stack.Screen name="(in-transit)" />
        <Stack.Screen name="(re-engage)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="route" />
        <Stack.Screen name="moving" />
        <Stack.Screen name="test-map" />
      </Stack>
    </CommutePlanProvider>
  );
}
