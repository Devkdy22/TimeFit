import 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CommutePlanProvider } from '../src/features/commute-state/context';
import PretendardMedium from '../assets/fonts/Pretendard-Medium.ttf';
import PretendardSemiBold from '../assets/fonts/Pretendard-SemiBold.ttf';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Medium': PretendardMedium,
    'Pretendard-SemiBold': PretendardSemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="small" color="#58C7C2" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
