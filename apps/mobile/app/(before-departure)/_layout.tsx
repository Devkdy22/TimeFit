import { Stack } from 'expo-router';

export default function BeforeDepartureLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="before-departure/detail"
        options={{
          presentation: 'transparentModal',
          animation: 'slide_from_left',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="before-departure/transit"
        options={{
          presentation: 'transparentModal',
          animation: 'slide_from_right',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
