import type { LocationReading } from '../types/location';

// 측위 허용 정확도 임계값(m)
export const ACCURACY_THRESHOLD = 80;

// 평균 계산을 위해 필요한 최소 샘플 수
export const READINGS_REQUIRED = 3;

// 측위 타임아웃(ms)
export const TIMEOUT_MS = 15000;

// 정확도 기준 이하 샘플만 필터링
export function filterReadingsByAccuracy(
  readings: LocationReading[],
  threshold: number = ACCURACY_THRESHOLD,
): LocationReading[] {
  return readings.filter((reading) => Number.isFinite(reading.accuracy) && reading.accuracy <= threshold);
}

// 정확도(낮을수록 좋음) 기준으로 상위 N개 추출
export function pickTopNByAccuracy(readings: LocationReading[], count: number = READINGS_REQUIRED): LocationReading[] {
  return [...readings].sort((a, b) => a.accuracy - b.accuracy).slice(0, count);
}

// 샘플 평균 좌표/정확도 계산
export function calculateAverageLocation(readings: LocationReading[]): {
  latitude: number;
  longitude: number;
  accuracy: number;
} {
  if (!readings.length) {
    throw new Error('평균을 계산할 측위 샘플이 없습니다.');
  }

  const latitude = readings.reduce((sum, reading) => sum + reading.latitude, 0) / readings.length;
  const longitude = readings.reduce((sum, reading) => sum + reading.longitude, 0) / readings.length;
  const accuracy = readings.reduce((sum, reading) => sum + reading.accuracy, 0) / readings.length;

  return { latitude, longitude, accuracy };
}
