import type { LocationInfo } from '../../../services/api/client';

export type CachedResolvedLocation = {
  pinPosition: {
    lat: number;
    lng: number;
  };
  resolvedAt: number;
  displayName: string;
  accuracy: number | null;
  finalName: string;
  resolvedBy:
    | 'rest_road'
    | 'rest_jibun'
    | 'js_road'
    | 'js_jibun'
    | 'representative_jibun'
    | 'native_reverse'
    | 'fallback'
    | 'none';
  locationInfo: LocationInfo;
};

const locationCache = new Map<string, CachedResolvedLocation>();
const poiNameNormalizationCache = new Map<string, string>();
export type GeocodeInfo = {
  lat: number;
  lng: number;
  roadAddress: string | null;
  jibunAddress: string | null;
  representativeJibun?: string | null;
  updatedAt: number;
};
let latestGeocodeInfo: GeocodeInfo | null = null;

export function toLocationCacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getCachedLocation(key: string) {
  return locationCache.get(key) ?? null;
}

export function setCachedLocation(key: string, value: CachedResolvedLocation) {
  locationCache.set(key, value);
}

export function getNormalizedPoiNameFromCache(name: string) {
  return poiNameNormalizationCache.get(name) ?? null;
}

export function setNormalizedPoiNameCache(name: string, normalized: string) {
  poiNameNormalizationCache.set(name, normalized);
}

export function setLatestGeocodeInfo(info: GeocodeInfo) {
  latestGeocodeInfo = info;
}

export function getLatestGeocodeInfo() {
  return latestGeocodeInfo;
}
