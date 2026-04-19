import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  coord2AddressViaProxy,
  getNearbyPoiLocationInfoViaProxy,
  type LocationInfo,
} from '../../../services/api/client';
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
      throw new Error('GPS requires HTTPS on web');
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
    return sample.accuracy <= 50;
  });
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

async function collectGpsSamples(): Promise<GpsSample[]> {
  console.info('[Location]', 'GPS START', { platform: Platform.OS });

  if (Platform.OS === 'web') {
    const webSamples = await new Promise<GpsSample[]>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve([]);
        return;
      }

      const samples: GpsSample[] = [];
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
          });
          if (samples.length >= 8) {
            navigator.geolocation.clearWatch(watchId);
            resolve(samples);
          }
        },
        (error) => {
          console.info('[Location]', 'GPS ERROR', { message: error.message, code: error.code });
          navigator.geolocation.clearWatch(watchId);
          resolve(samples);
        },
        {
          enableHighAccuracy: true,
          timeout: 1000,
          maximumAge: 0,
        },
      );

      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        resolve(samples);
      }, 1000);
    });

    return webSamples.slice(0, 8);
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

    const timer = setTimeout(() => finish(), 1000);

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 200,
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
        });

        if (samples.length >= 8) {
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

  if (samples.length === 0) {
    try {
      const fallback = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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

  return samples.slice(0, 8);
}

function mergeLocationInfo(
  lat: number,
  lng: number,
  poiInfo: LocationInfo | null,
  geocodeInfo: Awaited<ReturnType<typeof coord2AddressViaProxy>> | null,
): LocationInfo {
  // REST geocoder is secondary only.
  const restRoadAddress = geocodeInfo?.road_address?.address_name?.trim() || undefined;
  const restJibunAddress = geocodeInfo?.address?.address_name?.trim() || undefined;

  const locationInfo: LocationInfo = {
    lat,
    lng,
    ...poiInfo,
    roadAddress: poiInfo?.roadAddress?.trim() || restRoadAddress,
    jibunAddress: poiInfo?.jibunAddress?.trim() || restJibunAddress,
  };

  return locationInfo;
}

type JibunCandidate = {
  jibunAddress: string;
  lat: number;
  lng: number;
  distanceFromGps: number;
};

function parseJibunParts(jibunAddress: string): { region: string; lotMain: string } | null {
  const trimmed = jibunAddress.trim();
  if (!trimmed) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }

  const lotToken = tokens[tokens.length - 1];
  const lotMatch = lotToken.match(/^(\d+)(?:-\d+)?$/);
  if (!lotMatch?.[1]) {
    return null;
  }

  const region = tokens.slice(0, -1).join(' ').trim();
  if (!region) {
    return null;
  }

  return {
    region,
    lotMain: lotMatch[1],
  };
}

async function collectNearbyJibunCandidates(lat: number, lng: number) {
  const offsets: Array<[number, number]> = [
    [0, 0],
    [0.0001, 0],
    [-0.0001, 0],
    [0, 0.0001],
    [0, -0.0001],
  ];

  const settled = await Promise.allSettled(
    offsets.map(async ([dLat, dLng]) => {
      const sampleLat = lat + dLat;
      const sampleLng = lng + dLng;
      const result = await withTimeout(coord2AddressViaProxy(sampleLat, sampleLng), 1200);
      const jibunAddress = result?.address?.address_name?.trim() || null;
      if (!jibunAddress) {
        return null;
      }
      return {
        jibunAddress,
        lat: sampleLat,
        lng: sampleLng,
        distanceFromGps: toMetersDistance(lat, lng, sampleLat, sampleLng),
      } satisfies JibunCandidate;
    }),
  );

  return settled
    .filter((item): item is PromiseFulfilledResult<JibunCandidate | null> => item.status === 'fulfilled')
    .map((item) => item.value)
    .filter((item): item is JibunCandidate => item != null);
}

function resolveRepresentativeJibun(candidates: JibunCandidate[]) {
  const groups = new Map<string, { count: number; totalDistance: number }>();

  for (const candidate of candidates) {
    const parsed = parseJibunParts(candidate.jibunAddress);
    if (!parsed) {
      continue;
    }
    const key = `${parsed.region} ${parsed.lotMain}`;
    const prev = groups.get(key) ?? { count: 0, totalDistance: 0 };
    groups.set(key, {
      count: prev.count + 1,
      totalDistance: prev.totalDistance + candidate.distanceFromGps,
    });
  }

  let selected: { name: string; count: number; avgDistance: number } | null = null;
  for (const [name, value] of groups.entries()) {
    const avgDistance = value.totalDistance / value.count;
    if (!selected) {
      selected = { name, count: value.count, avgDistance };
      continue;
    }
    if (value.count > selected.count) {
      selected = { name, count: value.count, avgDistance };
      continue;
    }
    if (value.count === selected.count && avgDistance < selected.avgDistance) {
      selected = { name, count: value.count, avgDistance };
    }
  }

  return {
    representativeJibun: selected?.name ?? null,
    groups: Array.from(groups.entries()).map(([name, value]) => ({
      name,
      count: value.count,
      avgDistance: value.totalDistance / value.count,
    })),
  };
}

function isResidentialPoiName(name: string) {
  return /(아파트|빌라|주택|타운|맨션|오피스텔|연립|주공|캐슬|자이|푸르지오|래미안|아이파크|힐스테이트)/.test(
    name,
  );
}

function isStrongPoiCategory(category?: string) {
  if (!category) {
    return false;
  }
  return ['SW8', 'HP8', 'CE7', 'FD6', 'SC4', 'PS3', 'OL7'].includes(category);
}

function isStrongPoiName(name: string) {
  return /(역|병원|의원|약국|버스정류장|정류장|스타벅스|투썸|카페|커피|학교|대학교|중학교|고등학교|관공서|주민센터)/.test(
    name,
  );
}

function selectStrongPoi(
  candidates: NonNullable<LocationInfo['candidates']>,
): { name: string; distance: number; category?: string } | null {
  return candidates
    .filter((candidate) => candidate.source !== 'address')
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance <= 30)
    .filter((candidate) => {
      const name = candidate.name?.trim() || '';
      if (!name) {
        return false;
      }
      return isStrongPoiCategory(candidate.category) || isStrongPoiName(name);
    })
    .sort((a, b) => a.distance - b.distance || b.score - a.score)
    .map((candidate) => ({
      name: candidate.name.trim(),
      distance: candidate.distance,
      category: candidate.category,
    }))[0] ?? null;
}

function isResidentialDominant(candidates: NonNullable<LocationInfo['candidates']>) {
  const meaningful = candidates
    .filter((candidate) => candidate.source !== 'address')
    .filter((candidate) => candidate.name?.trim().length > 0);
  if (meaningful.length === 0) {
    return false;
  }
  const residentialCount = meaningful.filter((candidate) => isResidentialPoiName(candidate.name)).length;
  return residentialCount / meaningful.length >= 0.5;
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

async function waitForLatestGeocodeNear(lat: number, lng: number, maxWaitMs = 900) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const latest = getLatestGeocodeInfo();
    if (latest) {
      const meters = toMetersDistance(lat, lng, latest.lat, latest.lng);
      if (Number.isFinite(meters) && meters <= 120) {
        return latest;
      }
    }
    await sleep(120);
  }
  return getLatestGeocodeInfo();
}

export async function resolveCurrentLocationOnce(): Promise<ResolvedCurrentLocation> {
  await sleep(300);
  await ensureLocationPermission();

  let gpsSamples: GpsSample[] = [];
  let acceptedSamples: GpsSample[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    gpsSamples = await collectGpsSamples();
    const accurateSamples = filterAccurateSamples(gpsSamples);
    if (gpsSamples.length >= 1) {
      // Sampling is for correction only. A single successful GPS sample is enough.
      if (accurateSamples.length >= 1) {
        acceptedSamples = accurateSamples;
      } else {
        acceptedSamples = gpsSamples;
      }
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

  const avg = weightedAverageLatLng(acceptedSamples);
  const avgAccuracy = average(acceptedSamples.map((sample) => sample.accuracy ?? 0)) || null;

  const lat = avg.lat;
  const lng = avg.lng;

  console.info('[Location]', 'gps samples', {
    rawSamples: gpsSamples,
    acceptedSamples,
    avg: { lat, lng },
    accuracy: avgAccuracy,
    stationary: isStationary(acceptedSamples),
  });

  const cacheKey = toLocationCacheKey(lat, lng);
  const cached = getCachedLocation(cacheKey);
  if (cached) {
    const movedMeters = toMetersDistance(lat, lng, cached.pinPosition.lat, cached.pinPosition.lng);
    if (movedMeters < 30) {
      console.info('[Location]', 'cache hit (skip api)', { cacheKey, movedMeters });
      return { ...cached, samples: gpsSamples };
    }
  }

  const [settledResults, waitedJsGeocode] = await Promise.all([
    Promise.allSettled([
      withTimeout(coord2AddressViaProxy(lat, lng), 1200),
      withTimeout(getNearbyPoiLocationInfoViaProxy(lat, lng, 300), 1200),
    ]),
    waitForLatestGeocodeNear(lat, lng, 900),
  ]);
  const geocoderResult = settledResults[0];
  const poiResult = settledResults[1];

  const geocodeInfo = geocoderResult.status === 'fulfilled' ? geocoderResult.value : null;
  const poiInfo = poiResult.status === 'fulfilled' ? poiResult.value : null;
  const locationInfo = mergeLocationInfo(lat, lng, poiInfo, geocodeInfo);

  const latestGeocodeInfo = waitedJsGeocode ?? getLatestGeocodeInfo();
  const jsGeocoderDistanceMeters = latestGeocodeInfo
    ? toMetersDistance(lat, lng, latestGeocodeInfo.lat, latestGeocodeInfo.lng)
    : Number.POSITIVE_INFINITY;
  const hasNearbyJsGeocode = Number.isFinite(jsGeocoderDistanceMeters) && jsGeocoderDistanceMeters <= 120;
  const jsGeocodeRoad = hasNearbyJsGeocode ? latestGeocodeInfo?.roadAddress?.trim() || undefined : undefined;
  const jsGeocodeJibun = hasNearbyJsGeocode ? latestGeocodeInfo?.jibunAddress?.trim() || undefined : undefined;
  const jsRepresentativeJibun = hasNearbyJsGeocode
    ? latestGeocodeInfo?.representativeJibun?.trim() || undefined
    : undefined;
  const hasJsGeocode = Boolean(jsGeocodeJibun || jsGeocodeRoad);

  console.info('[Location]', 'geocoder raw result', {
    latestGeocodeInfo,
    jsGeocoderDistanceMeters,
    hasNearbyJsGeocode,
    jsRepresentativeJibun,
    restCoord2AddressRoad: geocodeInfo?.road_address?.address_name ?? null,
    restCoord2AddressJibun: geocodeInfo?.address?.address_name ?? null,
    restCoord2AddressIgnored: !geocodeInfo,
  });

  const geocoderAddress = jsGeocodeJibun || jsGeocodeRoad || locationInfo.jibunAddress || locationInfo.roadAddress;
  console.info('[Location]', 'geocoder result', {
    geocoderAddress,
    roadAddress: jsGeocodeRoad || locationInfo.roadAddress,
    jibunAddress: jsGeocodeJibun || locationInfo.jibunAddress,
    representativeJibun: jsRepresentativeJibun,
    distanceFromGpsToGeocoder: jsGeocoderDistanceMeters,
  });

  const cluster = resolveApartmentClusterFromCandidates(locationInfo.candidates ?? []);
  // Representative jibun runs only when JS geocoder info exists.
  const nearbyJibunCandidates =
    hasJsGeocode && !jsRepresentativeJibun ? await collectNearbyJibunCandidates(lat, lng) : [];
  const representativeJibunResult = hasJsGeocode
    ? resolveRepresentativeJibun(nearbyJibunCandidates)
    : { representativeJibun: null, groups: [] as Array<{ name: string; count: number; avgDistance: number }> };
  console.info('[Location]', 'poi result', {
    poiCount: locationInfo.candidates?.length ?? 0,
    clusterName: cluster.clusterName,
    nearbyJibunCount: nearbyJibunCandidates.length,
    jibunGroups: representativeJibunResult.groups,
  });

  const strongPoi = selectStrongPoi(locationInfo.candidates ?? []);
  const residentialDominant = isResidentialDominant(locationInfo.candidates ?? []);
  let finalName =
    jsRepresentativeJibun ||
    representativeJibunResult.representativeJibun ||
    jsGeocodeJibun ||
    locationInfo.jibunAddress ||
    locationInfo.roadAddress ||
    '내 위치';

  let nativeReverseAddress: string | undefined;
  if (finalName === '내 위치') {
    const nativeReverse = await resolveNativeReverseGeocode(lat, lng);
    nativeReverseAddress = nativeReverse?.address ?? undefined;
    if (nativeReverseAddress) {
      finalName = nativeReverseAddress;
    }
  }

  const resolvedBy: ResolvedCurrentLocation['resolvedBy'] = strongPoi
    ? 'poi'
    : jsRepresentativeJibun || representativeJibunResult.representativeJibun
      ? 'cluster'
    : hasJsGeocode || Boolean(locationInfo.jibunAddress || locationInfo.roadAddress || nativeReverseAddress)
        ? 'geocoder'
        : 'fallback';

  const resolved: ResolvedCurrentLocation = {
    pinPosition: { lat, lng },
    displayName: finalName,
    accuracy: avgAccuracy,
    finalName,
    resolvedBy,
    locationInfo: {
      ...locationInfo,
      roadAddress: jsGeocodeRoad || locationInfo.roadAddress || undefined,
      jibunAddress:
        jsRepresentativeJibun ||
        representativeJibunResult.representativeJibun ||
        jsGeocodeJibun ||
        nativeReverseAddress ||
        locationInfo.jibunAddress ||
        undefined,
    },
    samples: gpsSamples,
  };

  if (resolved.finalName !== '내 위치' && resolved.resolvedBy !== 'fallback') {
    setCachedLocation(cacheKey, resolved);
  }

  console.info('[Location]', 'final resolved', {
    finalName,
    resolvedBy,
    strongPoi: strongPoi?.name ?? null,
    residentialDominant,
    centerSource: 'gps',
  });

  return resolved;
}
