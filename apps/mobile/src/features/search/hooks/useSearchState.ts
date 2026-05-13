import { useEffect, useMemo, useRef, useState } from 'react';
import { inferPlaceIconType, useCommutePlan, type LocationField, type SavedPlace } from '../../commute-state/context';
import { getNearbyPoiLocationInfoViaProxy, searchKakaoKeywordViaProxy } from '../../../services/api/client';
import type { MapCenterSource } from '../../map/webview/types';
import { setLatestGeocodeInfo } from '../../home/location/cache.util';
import { resolveCurrentLocationOnce } from '../../home/location/location.service';

type MapCenterState = {
  lat: number;
  lng: number;
  address: string;
  source: MapCenterSource;
  accuracy?: number;
};

const DEFAULT_MAP_CENTER: MapCenterState = {
  lat: 37.5665,
  lng: 126.978,
  address: '서울 시청',
  source: 'init',
};

const fallbackSearchPlaces: SavedPlace[] = [
  {
    id: 'fallback-gangnam',
    name: '강남역 2번 출구',
    address: '서울 강남구 강남대로 396',
    latitude: 37.4979,
    longitude: 127.0276,
    iconType: 'location',
  },
  {
    id: 'fallback-jamsil',
    name: '잠실역',
    address: '서울 송파구 올림픽로 265',
    latitude: 37.5133,
    longitude: 127.1002,
    iconType: 'location',
  },
  {
    id: 'fallback-anguk',
    name: '안국역 2번 출구',
    address: '서울 종로구 율곡로 62',
    latitude: 37.5766,
    longitude: 126.9855,
    iconType: 'location',
  },
  {
    id: 'fallback-jongno',
    name: '종로3가역 5번 출구',
    address: '서울 종로구 종로 130',
    latitude: 37.5702,
    longitude: 126.9911,
    iconType: 'location',
  },
];

function withNamedId(place: SavedPlace) {
  return {
    ...place,
    id: `${place.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    iconType: place.iconType ?? inferPlaceIconType(place.name),
  };
}

function toManualPlace(text: string, center: MapCenterState): SavedPlace {
  const trimmed = text.trim();
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    address: center.address,
    latitude: center.lat,
    longitude: center.lng,
    accuracy: center.accuracy,
    iconType: inferPlaceIconType(trimmed),
  };
}

function inferCenterSourceFromPlace(place: SavedPlace): MapCenterSource {
  if (place.name.includes('내 위치') || place.id.includes('current-location')) {
    return 'gps';
  }
  return 'search';
}

function mapKakaoDocumentToPlace(
  doc: {
    x?: string;
    y?: string;
    place_name?: string;
    road_address_name?: string;
    address_name?: string;
  },
  index: number,
): SavedPlace | null {
  const lng = Number(doc.x);
  const lat = Number(doc.y);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const name = doc.place_name?.trim() || doc.road_address_name?.trim() || doc.address_name?.trim();
  if (!name) {
    return null;
  }

  return {
    id: `kakao-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    address: doc.road_address_name?.trim() || doc.address_name?.trim() || name,
    latitude: lat,
    longitude: lng,
    iconType: inferPlaceIconType(name),
  };
}

function toDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toClockText(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function dedupePlaces(places: SavedPlace[]) {
  const seen = new Set<string>();
  const deduped: SavedPlace[] = [];
  for (const place of places) {
    const key = `${place.name.trim().toLowerCase()}|${place.latitude.toFixed(5)}|${place.longitude.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(place);
  }
  return deduped;
}

export function useSearchState() {
  const {
    origin,
    destination,
    arrivalAt,
    recentPlaces,
    savedPlaces,
    setArrivalAt,
    applyPlaceToField,
    clearPlaceField,
  } = useCommutePlan();

  const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

  const [activeField, setActiveField] = useState<LocationField>(() => {
    if (origin && !destination) {
      return 'origin';
    }
    return 'destination';
  });
  const [originInput, setOriginInput] = useState(origin?.name ?? '');
  const [destinationInput, setDestinationInput] = useState(destination?.name ?? '');
  const [isOriginFocused, setIsOriginFocused] = useState(false);
  const [isDestinationFocused, setIsDestinationFocused] = useState(false);
  const [mapQuery, setMapQuery] = useState('');

  const [mapSearchResults, setMapSearchResults] = useState<SavedPlace[]>(fallbackSearchPlaces.slice(0, 4));
  const [fieldSuggestions, setFieldSuggestions] = useState<SavedPlace[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isSearchingFieldSuggestions, setIsSearchingFieldSuggestions] = useState(false);
  const [isSettingCurrentOrigin, setIsSettingCurrentOrigin] = useState(false);
  const destinationSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextBlurRef = useRef<{ field: LocationField; expiresAt: number } | null>(null);
  const lastNearbyFetchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMapQueryFetchRef = useRef<string>('');
  const lastNearbyFetchKeyRef = useRef<string>('');
  const lastKeywordRequestKeyRef = useRef<string>('');

  const [mapCenter, setMapCenter] = useState<MapCenterState>(() => {
    if (origin) {
      return {
        lat: origin.latitude,
        lng: origin.longitude,
        address: origin.address,
        source: inferCenterSourceFromPlace(origin),
      };
    }

    if (destination) {
      return {
        lat: destination.latitude,
        lng: destination.longitude,
        address: destination.address,
        source: inferCenterSourceFromPlace(destination),
      };
    }

    return DEFAULT_MAP_CENTER;
  });
  const [geocodeInfo, setGeocodeInfo] = useState<{
    roadAddress: string | null;
    jibunAddress: string | null;
    representativeJibun: string | null;
    lat: number;
    lng: number;
  } | null>(null);

  const localSearchBase = useMemo(() => {
    const merged = [
      ...recentPlaces,
      ...savedPlaces,
      ...fallbackSearchPlaces,
      ...(origin ? [origin] : []),
      ...(destination ? [destination] : []),
    ];

    const seenId = new Set<string>();
    const seenAddress = new Set<string>();
    const deduped: SavedPlace[] = [];

    for (const place of merged) {
      const normalizedAddress = place.address.trim().toLowerCase();
      if (seenId.has(place.id)) {
        continue;
      }
      if (seenAddress.has(normalizedAddress)) {
        continue;
      }

      seenId.add(place.id);
      seenAddress.add(normalizedAddress);
      deduped.push(place);
    }

    return deduped;
  }, [destination, origin, recentPlaces, savedPlaces]);

  useEffect(() => {
    // 출발지 입력 중(또는 출발지가 활성 탭)에는 외부 상태로 입력값을 덮어쓰지 않는다.
    if (isOriginFocused || activeField === 'origin') {
      return;
    }
    setOriginInput(origin?.name ?? '');
  }, [origin?.name, isOriginFocused, activeField]);

  useEffect(() => {
    if (isDestinationFocused || activeField === 'destination') {
      return;
    }
    setDestinationInput(destination?.name ?? '');
  }, [destination?.name, isDestinationFocused, activeField]);

  useEffect(() => {
    const target = activeField === 'origin' ? origin : destination;
    if (!target) {
      return;
    }

    setMapCenter((prev) => {
      const sameLat = Math.abs(prev.lat - target.latitude) <= 0.000002;
      const sameLng = Math.abs(prev.lng - target.longitude) <= 0.000002;
      const sameAddress = prev.address === target.address;
      if (sameLat && sameLng && sameAddress) {
        return prev;
      }

      return {
        lat: target.latitude,
        lng: target.longitude,
        address: target.address,
        source: inferCenterSourceFromPlace(target),
        accuracy: target.accuracy,
      };
    });
  }, [activeField, origin, destination]);

  const searchPlaces = async (keyword: string, options?: { preferNearby?: boolean }) => {
    const normalized = keyword.trim().toLowerCase();
    const preferNearby = options?.preferNearby ?? false;

    if (normalized.length === 0 && preferNearby) {
      try {
        const nearby = await getNearbyPoiLocationInfoViaProxy(mapCenter.lat, mapCenter.lng, 320);
        const mappedNearby = (nearby.candidates ?? [])
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
          .sort((a, b) => a.distance - b.distance)
          .map((item, index) => ({
            id: `nearby-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: item.name,
            address: nearby.roadAddress || nearby.jibunAddress || mapCenter.address,
            latitude: item.lat,
            longitude: item.lng,
            iconType: inferPlaceIconType(item.name),
          } as SavedPlace));

        if (mappedNearby.length > 0) {
          return dedupePlaces(mappedNearby).slice(0, 8);
        }
      } catch {
        // fallback to local list
      }
    }

    if (normalized.length === 0) {
      return dedupePlaces(
        [...localSearchBase]
        .sort((a, b) => {
          const distanceA = toDistanceMeters(mapCenter.lat, mapCenter.lng, a.latitude, a.longitude);
          const distanceB = toDistanceMeters(mapCenter.lat, mapCenter.lng, b.latitude, b.longitude);
          return distanceA - distanceB;
        })
          .slice(0, 6),
      );
    }

    try {
      const documents = await searchKakaoKeywordViaProxy(keyword, 8);
      const mapped = documents
        .map((doc, index) => mapKakaoDocumentToPlace(doc, index))
        .filter((item): item is SavedPlace => item != null);

      if (mapped.length > 0) {
        return dedupePlaces(mapped)
          .sort((a, b) => {
            const distanceA = toDistanceMeters(mapCenter.lat, mapCenter.lng, a.latitude, a.longitude);
            const distanceB = toDistanceMeters(mapCenter.lat, mapCenter.lng, b.latitude, b.longitude);
            return distanceA - distanceB;
          })
          .slice(0, 8);
      }
    } catch {
      // proxy unavailable -> fallback to local search results
    }

    return dedupePlaces(
      localSearchBase
      .filter((place) => {
        return (
          place.name.toLowerCase().includes(normalized) ||
          place.address.toLowerCase().includes(normalized)
        );
      })
        .slice(0, 6),
    );
  };

  // 1) 텍스트 입력 기반 추천: 입력 시 빠르게 1회만 갱신
  useEffect(() => {
    let cancelled = false;
    const keyword = mapQuery.trim();
    const normalized = keyword.toLowerCase();
    if (!normalized) {
      lastMapQueryFetchRef.current = '';
      lastKeywordRequestKeyRef.current = '';
      return;
    }
    const centerKey = `${mapCenter.lat.toFixed(4)},${mapCenter.lng.toFixed(4)}`;
    const keywordRequestKey = `${normalized}|${centerKey}`;
    if (lastKeywordRequestKeyRef.current === keywordRequestKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingMap(true);
        const result = await searchPlaces(keyword, { preferNearby: false });
        if (!cancelled) {
          lastMapQueryFetchRef.current = normalized;
          lastKeywordRequestKeyRef.current = keywordRequestKey;
          setMapSearchResults(dedupePlaces(result));
        }
      } catch {
        if (!cancelled) {
          lastKeywordRequestKeyRef.current = keywordRequestKey;
          setMapSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingMap(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapQuery, mapCenter.lat, mapCenter.lng]);

  // 2) 지도 이동 기반 추천: 사용자가 멈춘 뒤(3~5초) 1회만 갱신
  useEffect(() => {
    const centerKey = `${mapCenter.lat.toFixed(5)},${mapCenter.lng.toFixed(5)}`;
    if (lastNearbyFetchKeyRef.current === centerKey) {
      return;
    }

    const last = lastNearbyFetchCenterRef.current;
    if (last) {
      const movedMeters = toDistanceMeters(last.lat, last.lng, mapCenter.lat, mapCenter.lng);
      if (movedMeters < 10) {
        return;
      }
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingMap(true);
        const result = await searchPlaces('', { preferNearby: true });
        if (!cancelled) {
          lastNearbyFetchCenterRef.current = { lat: mapCenter.lat, lng: mapCenter.lng };
          lastNearbyFetchKeyRef.current = centerKey;
          setMapSearchResults(dedupePlaces(result));
        }
      } catch {
        if (!cancelled) {
          setMapSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingMap(false);
        }
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapCenter.lat, mapCenter.lng, localSearchBase]);

  const activeFieldInput = activeField === 'origin' ? originInput : destinationInput;

  useEffect(() => {
    const keyword = activeFieldInput.trim();
    if (!keyword) {
      setFieldSuggestions([]);
      setIsSearchingFieldSuggestions(false);
      return;
    }

    // 필드 제안은 네트워크를 다시 치지 않고, 이미 받은 mapSearchResults + 로컬 후보에서 즉시 구성
    const normalized = keyword.toLowerCase();
    const localMatches = localSearchBase.filter((place) => {
      return (
        place.name.toLowerCase().includes(normalized) ||
        place.address.toLowerCase().includes(normalized)
      );
    });

    const merged = [...mapSearchResults, ...localMatches];
    const seen = new Set<string>();
    const deduped: SavedPlace[] = [];
    for (const place of merged) {
      if (seen.has(place.id)) {
        continue;
      }
      seen.add(place.id);
      deduped.push(place);
      if (deduped.length >= 8) {
        break;
      }
    }

    setIsSearchingFieldSuggestions(false);
    setFieldSuggestions(deduped);
  }, [activeFieldInput, activeField, localSearchBase, mapSearchResults]);

  useEffect(() => {
    if (activeField !== 'destination') {
      return;
    }
    if (mapCenter.source !== 'user' && mapCenter.source !== 'search') {
      return;
    }
    if (!mapCenter.address?.trim()) {
      return;
    }

    if (destinationSyncTimerRef.current) {
      clearTimeout(destinationSyncTimerRef.current);
    }

    destinationSyncTimerRef.current = setTimeout(() => {
      const name = mapCenter.address.trim();
      setDestinationInput(name);
    }, 700);

    return () => {
      if (destinationSyncTimerRef.current) {
        clearTimeout(destinationSyncTimerRef.current);
      }
    };
  }, [activeField, mapCenter]);

  const recentDestinationCards = useMemo(() => {
    const previewTimes = ['18:45', '13:00', '19:00'];
    return recentPlaces.slice(0, 3).map((place, index) => ({
      ...place,
      previewTime: previewTimes[index] ?? '18:00',
    }));
  }, [recentPlaces]);

  function normalizePlaceLabel(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  const applyTypedField = (field: LocationField, typedText?: string) => {
    const typedValue = (typedText ?? (field === 'origin' ? originInput : destinationInput)).trim();

    if (typedValue.length === 0) {
      clearPlaceField(field);
      return;
    }

    const currentPlace = field === 'origin' ? origin : destination;
    if (currentPlace && normalizePlaceLabel(currentPlace.name) === normalizePlaceLabel(typedValue)) {
      return;
    }

    applyPlaceToField(field, toManualPlace(typedValue, mapCenter));
  };

  const handleSelectField = (field: LocationField) => {
    if (field === 'origin') {
      setIsOriginFocused(true);
      setActiveField(field);
      return;
    }
    setIsDestinationFocused(true);
    setActiveField(field);
  };

  const handleBlurField = (field: LocationField, typedText?: string) => {
    const ignoreToken = ignoreNextBlurRef.current;
    if (ignoreToken && ignoreToken.field === field && ignoreToken.expiresAt > Date.now()) {
      ignoreNextBlurRef.current = null;
      if (field === 'origin') {
        setIsOriginFocused(false);
      } else {
        setIsDestinationFocused(false);
      }
      return;
    }

    if (field === 'origin') {
      setIsOriginFocused(false);
    } else {
      setIsDestinationFocused(false);
    }

    const trimmed = (typedText ?? (field === 'origin' ? originInput : destinationInput)).trim();
    const currentPlace = field === 'origin' ? origin : destination;
    if (currentPlace && normalizePlaceLabel(currentPlace.name) === normalizePlaceLabel(trimmed)) {
      return;
    }

    // blur 시 자동 1순위 후보를 다시 조회/적용하지 않는다.
    // 사용자가 명시적으로 고른 장소를 비동기 검색 결과가 덮어쓰는 문제를 방지한다.
    applyTypedField(field, typedText);
  };

  const selectPlaceToField = (field: LocationField, place: SavedPlace) => {
    applyPlaceToField(field, withNamedId(place));

    if (field === 'origin') {
      setOriginInput(place.name);
      return;
    }

    setDestinationInput(place.name);
    setMapCenter((prev) => {
      const sameLat = Math.abs(prev.lat - place.latitude) <= 0.000002;
      const sameLng = Math.abs(prev.lng - place.longitude) <= 0.000002;
      const sameAddress = prev.address === place.address;
      if (sameLat && sameLng && sameAddress && prev.source === 'search') {
        return prev;
      }
      return {
        lat: place.latitude,
        lng: place.longitude,
        address: place.address,
        source: 'search',
        accuracy: place.accuracy,
      };
    });
  };

  const selectPlaceForActiveField = (place: SavedPlace) => {
    selectPlaceToField(activeField, place);
    setFieldSuggestions([]);
  };

  const prepareSelectFromSuggestion = (field: LocationField) => {
    ignoreNextBlurRef.current = {
      field,
      expiresAt: Date.now() + 1500,
    };
  };

  const selectPlaceForDestination = (place: SavedPlace) => {
    selectPlaceToField('destination', place);
    setActiveField('destination');
    setFieldSuggestions([]);
  };

  const selectRecentDestination = (place: SavedPlace) => {
    selectPlaceToField('destination', place);
  };

  const applyMapCenterToActiveField = () => {
    const currentText = activeField === 'origin' ? originInput.trim() : destinationInput.trim();

    const name = currentText.length > 0 ? currentText : mapCenter.address;
    const nextPlace: SavedPlace = {
      id: `map-center-${Date.now()}`,
      name,
      address: mapCenter.address,
      latitude: mapCenter.lat,
      longitude: mapCenter.lng,
      accuracy: mapCenter.accuracy,
      iconType: inferPlaceIconType(name),
    };

    selectPlaceToField(activeField, nextPlace);
    setFieldSuggestions([]);
  };

  const setOriginToCurrentLocation = async () => {
    if (isSettingCurrentOrigin) {
      return;
    }

    setIsSettingCurrentOrigin(true);
    try {
      const resolved = await resolveCurrentLocationOnce({ forceFresh: true });
      const name = resolved.locationInfo.roadAddress || resolved.locationInfo.jibunAddress || resolved.finalName || '내 위치';
      const address = resolved.locationInfo.roadAddress || resolved.locationInfo.jibunAddress || resolved.finalName || '내 위치';

      const place: SavedPlace = {
        id: `current-location-resolved-${Date.now()}`,
        name,
        address,
        latitude: resolved.pinPosition.lat,
        longitude: resolved.pinPosition.lng,
        accuracy: resolved.accuracy ?? undefined,
        iconType: 'location',
      };

      selectPlaceToField('origin', place);
      setActiveField('origin');
      setFieldSuggestions([]);
    } catch (error) {
      console.info('[Search]', 'set current origin failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSettingCurrentOrigin(false);
    }
  };


  const handleGeocodeResult = (info: {
    lat: number;
    lng: number;
    roadAddress: string | null;
    jibunAddress: string | null;
    representativeJibun: string | null;
  }) => {
    // 주소 표시는 도로명 > 지번 > 대표지번 순서로 처리한다.
    const refinedName = info.roadAddress || info.jibunAddress || info.representativeJibun || null;
    const refinedAddress = info.roadAddress || info.jibunAddress || info.representativeJibun || null;

    setGeocodeInfo({
      roadAddress: info.roadAddress,
      jibunAddress: info.jibunAddress,
      representativeJibun: info.representativeJibun,
      lat: info.lat,
      lng: info.lng,
    });
    setLatestGeocodeInfo({
      lat: info.lat,
      lng: info.lng,
      roadAddress: info.roadAddress,
      jibunAddress: info.jibunAddress,
      representativeJibun: info.representativeJibun,
      updatedAt: Date.now(),
    });

    if (
      origin &&
      refinedName &&
      activeField === 'origin' &&
      mapCenter.source === 'gps' &&
      (origin.id.includes('current-location-resolved') || origin.name.trim() === '내 위치')
    ) {
      // 현재 위치(origin)는 GPS 원본 좌표를 유지하고, 주소/이름 텍스트만 보정한다.
      applyPlaceToField('origin', {
        ...origin,
        id: origin.id,
        name: refinedName,
        address: refinedAddress || origin.address,
        latitude: origin.latitude,
        longitude: origin.longitude,
        accuracy: origin.accuracy,
      });
    }

    // 도착지 조작 맥락에서만 도착지 입력창을 반영한다.
    if (
      refinedName &&
      (activeField === 'destination' || destination != null) &&
      (mapCenter.source === 'user' || mapCenter.source === 'search')
    ) {
      setDestinationInput(refinedName);
    }

    setMapCenter((prev) => {
      const nextAddress = refinedName || prev.address;
      if (nextAddress === prev.address) {
        return prev;
      }
      return {
        ...prev,
        address: nextAddress,
      };
    });
  };

  return {
    activeField,
    arrivalAt: arrivalAt ?? toClockText(new Date()),
    recentDestinationCards,
    originInput,
    destinationInput,
    fieldSuggestions,
    isSearchingFieldSuggestions,
    isSettingCurrentOrigin,
    mapQuery,
    mapSearchResults,
    isSearchingMap,
    mapCenter,
    hasOriginConfigured: origin != null,
    hasDestinationConfigured: destination != null,
    originMarker: origin ? { lat: origin.latitude, lng: origin.longitude } : null,
    geocodeInfo,
    kakaoJsKey,
    setArrivalAt,
    setActiveField,
    handleSelectField,
    handleBlurField,
    setOriginInput,
    setDestinationInput,
    setMapQuery,
    setMapCenter,
    handleGeocodeResult,
    applyTypedField,
    selectPlaceForActiveField,
    prepareSelectFromSuggestion,
    selectPlaceForDestination,
    selectRecentDestination,
    applyMapCenterToActiveField,
    setOriginToCurrentLocation,
  };
}
