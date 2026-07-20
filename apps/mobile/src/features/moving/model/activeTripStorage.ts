import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_TRIP_ID_KEY = 'timefit.activeTripId';

export async function getStoredActiveTripId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_TRIP_ID_KEY);
}

export async function setStoredActiveTripId(tripId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_TRIP_ID_KEY, tripId);
}

export async function clearStoredActiveTripId(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TRIP_ID_KEY);
}
