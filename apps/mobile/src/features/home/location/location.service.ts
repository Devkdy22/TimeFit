import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  coord2AddressViaProxy,
  getNearbyPoiLocationInfoViaProxy,
  type KakaoCoord2AddressDocument,
  type LocationInfo,
} from '../../../services/api/client';
import { resolveKakaoAddressFromCoord } from '../../../services/kakaoGeoService';
import {
  getCachedLocation,
  getLatestGeocodeInfo,
  setCachedLocation,
  toLocationCacheKey,
  type CachedResolvedLocation,
} from './cache.util';
import { resolveApartmentClusterFromCandidates } from './poi-clustering.util';

type GpsSample = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

const ACCURACY_THRESHOLD = 80;
const READINGS_REQUIRED = 2;
const GPS_SAMPLE_TARGET = 4;
const GPS_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 20000;
const GEO_TIMEOUT_MS = 2500;
const POI_TIMEOUT_MS = 600;

const EARLY_EXIT_CONDITIONS = {
  minSamples: 1,
  excellentAccuracy: 12,
  goodAccuracy: 18,
  maxWaitMs: 4500,
  minWaitMs: 700,
} as const;

export type ResolvedCurrentLocation = CachedResolvedLocation & {
  samples: GpsSample[];
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function ensureLocationPermission() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      throw new Error('위치 서비스는 HTTPS 환경에서만 사용 가능합니다.');
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation API unavailable');
    }

    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as any });
        if (status.state === 'denied') {
          throw new Error('Geolocation permission denied');
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('denied')) {
          throw error;
        }
      }
    }

    return;
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission denied');
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toMetersDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function filterAccurateSamples(samples: GpsSample[]) {
  return samples.filter((sample) => {
    if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lng)) {
      return false;
    }
    if (sample.accuracy == null) {
      return true;
    }
    return sample.accuracy <= ACCURACY_THRESHOLD;
  });
}

function sortByAccuracy(samples: GpsSample[]) {
  return [...samples].sort((a, b) => {
    const aAccuracy = a.accuracy ?? Number.POSITIVE_INFINITY;
    const bAccuracy = b.accuracy ?? Number.POSITIVE_INFINITY;
    return aAccuracy - bAccuracy;
  });
}

function filterOutliersByDistance(samples: GpsSample[], maxDistanceMeters = 40) {
  if (samples.length <= 2) {
    return samples;
  }

  const base = weightedAverageLatLng(samples);
  const filtered = samples.filter((sample) => toMetersDistance(base.lat, base.lng, sample.lat, sample.lng) <= maxDistanceMeters);
  return filtered.length >= 2 ? filtered : samples;
}

function pickBestSamples(samples: GpsSample[]) {
  const finiteSamples = samples.filter((sample) => Number.isFinite(sample.lat) && Number.isFinite(sample.lng));
  if (!finiteSamples.length) {
    return [] as GpsSample[];
  }

  const accurate = filterAccurateSamples(finiteSamples);
  const basePool = accurate.length > 0 ? accurate : finiteSamples;
  const sorted = sortByAccuracy(basePool);
  const top = sorted.slice(0, Math.min(READINGS_REQUIRED, sorted.length));
  return filterOutliersByDistance(top);
}

function pickBestAccuracySample(samples: GpsSample[]) {
  const sorted = sortByAccuracy(samples);
  return sorted[0] ?? null;
}

function resolvePinCoordinate(samples: GpsSample[]) {
  const best = pickBestAccuracySample(samples);
  if (!best) {
    return weightedAverageLatLng(samples);
  }

  const bestAccuracy = best.accuracy ?? Number.POSITIVE_INFINITY;
  // 정지 상태이거나 최고 정확도 샘플이 매우 좋으면, 평균보다 best sample을 우선 사용한다.
  if (bestAccuracy <= 12 || (isStationary(samples) && bestAccuracy <= 20)) {
    return { lat: best.lat, lng: best.lng };
  }

  return weightedAverageLatLng(samples);
}

function scoreAccuracyLevel(accuracy: number | null) {
  if (accuracy == null) {
    return 'unknown';
  }
  if (accuracy <= 15) {
    return 'excellent';
  }
  if (accuracy <= 30) {
    return 'good';
  }
  if (accuracy <= 50) {
    return 'acceptable';
  }
  return 'low';
}

function weightedAverageLatLng(samples: GpsSample[]) {
  let weightSum = 0;
  let latSum = 0;
  let lngSum = 0;

  for (const sample of samples) {
    const accuracy = sample.accuracy ?? 50;
    const weight = 1 / Math.max(accuracy, 5);
    latSum += sample.lat * weight;
    lngSum += sample.lng * weight;
    weightSum += weight;
  }

  if (weightSum <= 0) {
    return { lat: average(samples.map((sample) => sample.lat)), lng: average(samples.map((sample) => sample.lng)) };
  }

  return {
    lat: latSum / weightSum,
    lng: lngSum / weightSum,
  };
}

function isStationary(samples: GpsSample[]) {
  if (samples.length < 2) {
    return false;
  }

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    const moved = toMetersDistance(prev.lat, prev.lng, next.lat, next.lng);
    if (moved >= 10) {
      return false;
    }
  }

  return true;
}

function shouldStopSampling(samples: GpsSample[], elapsedMs: number) {
  if (elapsedMs < EARLY_EXIT_CONDITIONS.minWaitMs) {
    return false;
  }

  if (elapsedMs > EARLY_EXIT_CONDITIONS.maxWaitMs) {
    return true;
  }

  if (!samples.length) {
    return false;
  }

  const best = Math.min(
    ...samples.map((sample) => sample.accuracy ?? Number.POSITIVE_INFINITY),
  );

  if (best < EARLY_EXIT_CONDITIONS.excellentAccuracy) {
    return true;
  }

  if (
    samples.length >= EARLY_EXIT_CONDITIONS.minSamples &&
    best < EARLY_EXIT_CONDITIONS.goodAccuracy
  ) {
    return true;
  }

  return false;
}

async function collectGpsSamples(): Promise<GpsSample[]> {
  console.info('[Location]', 'GPS START', { platform: Platform.OS });

  if (Platform.OS === 'web') {
    const webSamples = await new Promise<GpsSample[]>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve([]);
        return;
      }

      const samples: GpsSample[] = [];
      const startedAt = Date.now();
      let done = false;

      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        navigator.geolocation.clearWatch(watchId);
        resolve(samples);
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const sample = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
          };
          samples.push(sample);
          console.info('[Location]', 'GPS SUCCESS', {
            ...sample,
            quality: scoreAccuracyLevel(sample.accuracy),
            source: 'watchPosition',
          });

          const elapsedMs = Date.now() - startedAt;
          if (shouldStopSampling(samples, elapsedMs)) {
            finish();
            return;
          }

          if (samples.length >= GPS_SAMPLE_TARGET) {
            finish();
          }
        },
        (error) => {
          console.info('[Location]', 'GPS ERROR', { message: error.message, code: error.code });
          finish();
        },
        {
          enableHighAccuracy: true,
          timeout: GPS_TIMEOUT_MS,
          maximumAge: 0,
        },
      );

      setTimeout(() => {
        finish();
      }, GPS_TIMEOUT_MS);
    });

    return webSamples.slice(0, GPS_SAMPLE_TARGET);
  }

  const samples: GpsSample[] = [];
  await new Promise<void>((resolve) => {
    let resolved = false;
    let subscription: { remove: () => void } | null = null;

    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      try {
        subscription?.remove();
      } catch {
        // noop
      }
      resolve();
    };

    const startedAt = Date.now();
    const timer = setTimeout(() => finish(), GPS_TIMEOUT_MS);

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500,
        distanceInterval: 0,
      },
      (position) => {
        const sample = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
        };
        samples.push(sample);
        console.info('[Location]', 'GPS SUCCESS', {
          ...sample,
          quality: scoreAccuracyLevel(sample.accuracy),
          source: 'watchPositionAsync',
        });

        const elapsedMs = Date.now() - startedAt;
        if (shouldStopSampling(samples, elapsedMs)) {
          clearTimeout(timer);
          finish();
          return;
        }

        if (samples.length >= GPS_SAMPLE_TARGET) {
          clearTimeout(timer);
          finish();
        }
      },
    )
      .then((sub) => {
        subscription = sub;
      })
      .catch((error) => {
        console.info('[Location]', 'GPS ERROR', {
          message: error instanceof Error ? error.message : String(error),
        });
        clearTimeout(timer);
        finish();
      });
  });

  const accurateSamples = filterAccurateSamples(samples);
  const bestAccuracy = pickBestAccuracySample(accurateSamples)?.accuracy ?? Number.POSITIVE_INFINITY;
  if (accurateSamples.length < READINGS_REQUIRED && bestAccuracy > EARLY_EXIT_CONDITIONS.goodAccuracy) {
    try {
      const fallback = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });
      const sample = {
        lat: fallback.coords.latitude,
        lng: fallback.coords.longitude,
        accuracy: typeof fallback.coords.accuracy === 'number' ? fallback.coords.accuracy : null,
      };
      samples.push(sample);
      console.info('[Location]', 'GPS SUCCESS', {
        ...sample,
        quality: scoreAccuracyLevel(sample.accuracy),
        source: 'getCurrentPosition',
      });
    } catch (error) {
      console.info('[Location]', 'GPS ERROR', {
        message: error instanceof Error ? error.message : String(error),
        source: 'getCurrentPosition',
      });
    }
  }

  return samples.slice(0, GPS_SAMPLE_TARGET + 1);
}

function mergeLocationInfo(
  lat: number,
  lng: number,
  poiInfo: LocationInfo | null,
  geocodeInfo: { roadAddress: string | null; jibunAddress: string | null } | null,
): LocationInfo {
  const restRoadAddress = geocodeInfo?.roadAddress ?? undefined;
  const restJibunAddress = geocodeInfo?.jibunAddress ?? undefined;

  const locationInfo: LocationInfo = {
    lat,
    lng,
    ...poiInfo,
    roadAddress: poiInfo?.roadAddress?.trim() || restRoadAddress,
    jibunAddress: poiInfo?.jibunAddress?.trim() || restJibunAddress,
  };

  return locationInfo;
}

function formatNativeReverseGeocodeAddress(parts: Location.LocationGeocodedAddress | null) {
  if (!parts) {
    return null;
  }

  const tokens = [
    parts.region ?? '',
    parts.city ?? '',
    parts.district ?? '',
    parts.subregion ?? '',
    parts.street ?? '',
    parts.streetNumber ?? '',
  ]
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  if (tokens.length === 0) {
    return null;
  }

  return tokens.join(' ');
}

async function resolveNativeReverseGeocode(lat: number, lng: number) {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const reversed = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }), 1500);
    const first = Array.isArray(reversed) ? reversed[0] ?? null : null;
    const address = formatNativeReverseGeocodeAddress(first);
    if (!address) {
      return null;
    }
    return {
      address,
    };
  } catch (error) {
    console.info('[Location]', 'native reverse geocode fail', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function parseKakaoCoord2AddressResponse(response: unknown): {
  roadAddress: string | null;
  jibunAddress: string | null;
} {
  const fromDocument = response as KakaoCoord2AddressDocument | null | undefined;
  const docFromDocuments = (response as { documents?: KakaoCoord2AddressDocument[] } | null | undefined)?.documents?.[0];
  const doc = docFromDocuments ?? fromDocument ?? null;

  if (!doc) {
    return { roadAddress: null, jibunAddress: null };
  }

  const roadAddress = doc.road_address?.address_name?.trim() ?? null;
  const jibunAddress = doc.address?.address_name?.trim() ?? null;

  console.info('[Location]', 'REST geocode parsed', {
    roadAddress,
    jibunAddress,
    raw: doc,
  });

  return { roadAddress, jibunAddress };
}

function resolveDisplayAddress(params: {
  restRoad: string | null;
  restJibun: string | null;
  jsRoad: string | null;
  jsJibun: string | null;
  representativeJibun: string | null;
}): { finalName: string; resolvedBy: ResolvedCurrentLocation['resolvedBy'] } {
  const { restRoad, restJibun, jsRoad, jsJibun, representativeJibun } = params;

  if (restRoad) {
    return { finalName: restRoad, resolvedBy: 'rest_road' };
  }
  if (restJibun) {
    return { finalName: restJibun, resolvedBy: 'rest_jibun' };
  }
  if (jsRoad) {
    return { finalName: jsRoad, resolvedBy: 'js_road' };
  }
  if (jsJibun) {
    return { finalName: jsJibun, resolvedBy: 'js_jibun' };
  }
  if (representativeJibun) {
    return { finalName: representativeJibun, resolvedBy: 'representative_jibun' };
  }

  return { finalName: '위치 확인 중', resolvedBy: 'none' };
}

async function resolveCoord2AddressRobust(
  lat: number,
  lng: number,
): Promise<{ roadAddress: string | null; jibunAddress: string | null }> {
  const MAX_RETRY = 1;

  for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
    console.info('[Location]', 'REST geocode attempt', { lat, lng, attempt });
    try {
      const response = await withTimeout(coord2AddressViaProxy(lat, lng), GEO_TIMEOUT_MS);
      const parsed = parseKakaoCoord2AddressResponse(response);
      if (parsed.roadAddress || parsed.jibunAddress) {
        return parsed;
      }
    } catch (error) {
      console.info('[Location]', 'REST geocode fail', {
        lat,
        lng,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (attempt < MAX_RETRY) {
      await sleep(500 * (attempt + 1));
    }
  }

  // 프록시(API 서버) 불가 상황에서도 클라이언트에서 직접 Kakao REST 호출로 보정한다.
  try {
    console.info('[Location]', 'REST geocode direct fallback attempt', { lat, lng });
    const direct = await withTimeout(resolveKakaoAddressFromCoord(lat, lng), GEO_TIMEOUT_MS);
    const parsed = {
      roadAddress: direct?.roadAddress ?? null,
      jibunAddress: direct?.jibunAddress ?? null,
    };
    console.info('[Location]', 'REST geocode direct fallback parsed', parsed);
    if (parsed.roadAddress || parsed.jibunAddress) {
      return parsed;
    }
  } catch (error) {
    console.info('[Location]', 'REST geocode direct fallback fail', {
      lat,
      lng,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return { roadAddress: null, jibunAddress: null };
}

async function resolveNearbyPoiRobust(lat: number, lng: number) {
  return withTimeout(getNearbyPoiLocationInfoViaProxy(lat, lng, 300), POI_TIMEOUT_MS);
}

export async function resolveCurrentLocationOnce(options?: { forceFresh?: boolean }): Promise<ResolvedCurrentLocation> {
  await sleep(200);
  await ensureLocationPermission();

  let gpsSamples: GpsSample[] = [];
  let acceptedSamples: GpsSample[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    gpsSamples = await collectGpsSamples();
    acceptedSamples = pickBestSamples(gpsSamples);
    if (acceptedSamples.length > 0) {
      break;
    }
    console.info('[Location]', 'GPS ERROR', {
      message: 'no gps callback samples collected',
      attempt,
      sampleCount: gpsSamples.length,
    });
    await sleep(150);
  }

  if (acceptedSamples.length === 0) {
    throw new Error('Failed to collect GPS samples');
  }

  const filteredAcceptedSamples = filterOutliersByDistance(acceptedSamples);
  const avg = resolvePinCoordinate(filteredAcceptedSamples);
  const avgAccuracy = average(filteredAcceptedSamples.map((sample) => sample.accuracy ?? 0)) || null;

  const lat = avg.lat;
  const lng = avg.lng;

  console.info('[Location]', 'gps samples', {
    rawSamples: gpsSamples,
    acceptedSamples: filteredAcceptedSamples,
    avg: { lat, lng },
    accuracy: avgAccuracy,
    stationary: isStationary(filteredAcceptedSamples),
  });

  const cacheKey = toLocationCacheKey(lat, lng);
  const cached = getCachedLocation(cacheKey);
  if (cached && !options?.forceFresh) {
    const movedMeters = toMetersDistance(lat, lng, cached.pinPosition.lat, cached.pinPosition.lng);
    const cacheAgeMs = Date.now() - cached.resolvedAt;
    if (movedMeters < 15 && cacheAgeMs <= CACHE_TTL_MS) {
      console.info('[Location]', 'cache hit (skip api)', { cacheKey, movedMeters, cacheAgeMs });
      return { ...cached, samples: gpsSamples };
    }
  }

  const settledResults = await Promise.allSettled([resolveCoord2AddressRobust(lat, lng), resolveNearbyPoiRobust(lat, lng)]);
  const geocoderResult = settledResults[0];
  const poiResult = settledResults[1];

  const restParsed =
    geocoderResult.status === 'fulfilled'
      ? geocoderResult.value
      : { roadAddress: null, jibunAddress: null };
  const poiInfo = poiResult.status === 'fulfilled' ? poiResult.value : null;
  const locationInfo = mergeLocationInfo(lat, lng, poiInfo, restParsed);

  const latestGeocodeInfo = getLatestGeocodeInfo();
  const jsGeocoderDistanceMeters = latestGeocodeInfo
    ? toMetersDistance(lat, lng, latestGeocodeInfo.lat, latestGeocodeInfo.lng)
    : Number.POSITIVE_INFINITY;
  const hasNearbyJsGeocode = Number.isFinite(jsGeocoderDistanceMeters) && jsGeocoderDistanceMeters <= 120;
  const jsGeocodeRoad = hasNearbyJsGeocode ? latestGeocodeInfo?.roadAddress?.trim() || null : null;
  const jsGeocodeJibun = hasNearbyJsGeocode ? latestGeocodeInfo?.jibunAddress?.trim() || null : null;
  const jsRepresentativeJibun = hasNearbyJsGeocode
    ? latestGeocodeInfo?.representativeJibun?.trim() || null
    : null;
  const hasValidRestResult = Boolean(restParsed.roadAddress || restParsed.jibunAddress);
  const restCoord2AddressIgnored = !hasValidRestResult;

  console.info('[Location]', 'geocoder raw result', {
    latestGeocodeInfo,
    jsGeocoderDistanceMeters,
    hasNearbyJsGeocode,
    jsRepresentativeJibun,
    restCoord2AddressRoad: restParsed.roadAddress,
    restCoord2AddressJibun: restParsed.jibunAddress,
    restCoord2AddressIgnored,
  });

  console.info('[Location]', 'restCoord2AddressIgnored decision', {
    restRoad: restParsed.roadAddress,
    restJibun: restParsed.jibunAddress,
    ignored: restCoord2AddressIgnored,
    reason: hasValidRestResult ? 'rest_result_present' : 'rest_result_empty',
  });

  const geocoderAddress =
    restParsed.roadAddress ||
    restParsed.jibunAddress ||
    jsGeocodeRoad ||
    jsGeocodeJibun ||
    locationInfo.roadAddress ||
    locationInfo.jibunAddress ||
    null;
  console.info('[Location]', 'geocoder result', {
    geocoderAddress,
    roadAddress: restParsed.roadAddress || jsGeocodeRoad || locationInfo.roadAddress || null,
    jibunAddress: restParsed.jibunAddress || jsGeocodeJibun || locationInfo.jibunAddress || null,
    representativeJibun: jsRepresentativeJibun,
    distanceFromGpsToGeocoder: jsGeocoderDistanceMeters,
  });
  const cluster = resolveApartmentClusterFromCandidates(locationInfo.candidates ?? []);
  console.info('[Location]', 'poi result', {
    poiCount: locationInfo.candidates?.length ?? 0,
    clusterName: cluster.clusterName,
  });

  const finalResolved = resolveDisplayAddress({
    restRoad: restParsed.roadAddress,
    restJibun: restParsed.jibunAddress,
    jsRoad: jsGeocodeRoad,
    jsJibun: jsGeocodeJibun,
    representativeJibun: jsRepresentativeJibun,
  });
  let finalName = finalResolved.finalName;
  let resolvedBy: ResolvedCurrentLocation['resolvedBy'] = finalResolved.resolvedBy;

  if (finalName === '위치 확인 중') {
    const nativeReverse = await resolveNativeReverseGeocode(lat, lng);
    const nativeReverseAddress = nativeReverse?.address ?? null;
    if (nativeReverseAddress) {
      finalName = nativeReverseAddress;
      resolvedBy = 'native_reverse';
    } else {
      finalName = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      resolvedBy = 'fallback';
    }
  }

  const resolved: ResolvedCurrentLocation = {
    pinPosition: { lat, lng },
    resolvedAt: Date.now(),
    displayName: finalName,
    accuracy: avgAccuracy,
    finalName,
    resolvedBy,
    locationInfo: {
      ...locationInfo,
      roadAddress: restParsed.roadAddress || jsGeocodeRoad || locationInfo.roadAddress || undefined,
      jibunAddress: restParsed.jibunAddress || jsGeocodeJibun || jsRepresentativeJibun || locationInfo.jibunAddress || undefined,
    },
    samples: gpsSamples,
  };

  if (resolved.finalName !== '내 위치' && resolved.resolvedBy !== 'fallback') {
    setCachedLocation(cacheKey, resolved);
  }

  console.info('[Location]', 'final address resolved', {
    finalName,
    resolvedBy,
    lat,
    lng,
  });

  return resolved;
}
