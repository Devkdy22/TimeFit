import { Stack } from 'expo-router';

export default function BeforeStartLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
