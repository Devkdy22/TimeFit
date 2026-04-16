import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = '@timefit/onboarding-completed';

export async function getIsOnboardingCompleted() {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === '1';
}

export async function setOnboardingCompleted() {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
}

