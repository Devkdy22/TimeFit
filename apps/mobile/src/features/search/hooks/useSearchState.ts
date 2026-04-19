import { useEffect, useMemo, useState } from 'react';
import { inferPlaceIconType, useCommutePlan, type LocationField, type SavedPlace } from '../../commute-state/context';
import { searchKakaoKeywordViaProxy } from '../../../services/api/client';
import type { MapCenterSource } from '../../map/webview/types';
import { setLatestGeocodeInfo } from '../../home/location/cache.util';

type MapCenterState = {
  lat: number;
  lng: number;
  address: string;
  source: MapCenterSource;
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

  const [activeField, setActiveField] = useState<LocationField>('destination');
  const [originInput, setOriginInput] = useState(origin?.name ?? '');
  const [destinationInput, setDestinationInput] = useState(destination?.name ?? '');
  const [mapQuery, setMapQuery] = useState('');

  const [mapSearchResults, setMapSearchResults] = useState<SavedPlace[]>(fallbackSearchPlaces.slice(0, 4));
  const [fieldSuggestions, setFieldSuggestions] = useState<SavedPlace[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isSearchingFieldSuggestions, setIsSearchingFieldSuggestions] = useState(false);

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
    setOriginInput(origin?.name ?? '');
  }, [origin?.name]);

  useEffect(() => {
    setDestinationInput(destination?.name ?? '');
  }, [destination?.name]);

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
      };
    });
  }, [activeField, origin, destination]);

  const searchPlaces = async (keyword: string) => {
    const normalized = keyword.trim().toLowerCase();

    if (normalized.length === 0) {
      return localSearchBase.slice(0, 6);
    }

    try {
      const documents = await searchKakaoKeywordViaProxy(keyword, 8);
      const mapped = documents
        .map((doc, index) => mapKakaoDocumentToPlace(doc, index))
        .filter((item): item is SavedPlace => item != null);

      if (mapped.length > 0) {
        return mapped.slice(0, 8);
      }
    } catch {
      // proxy unavailable -> fallback to local search results
    }

    return localSearchBase
      .filter((place) => {
        return (
          place.name.toLowerCase().includes(normalized) ||
          place.address.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 6);
  };

  useEffect(() => {
    let cancelled = false;
    const keyword = mapQuery.trim();

    const timer = setTimeout(async () => {
      try {
        setIsSearchingMap(true);
        const result = await searchPlaces(keyword);
        if (!cancelled) {
          setMapSearchResults(result);
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
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapQuery, localSearchBase]);

  const activeFieldInput = activeField === 'origin' ? originInput : destinationInput;

  useEffect(() => {
    const keyword = activeFieldInput.trim();

    if (keyword.length === 0) {
      setFieldSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingFieldSuggestions(true);
        const result = await searchPlaces(keyword);
        if (!cancelled) {
          setFieldSuggestions(result);
        }
      } catch {
        if (!cancelled) {
          setFieldSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingFieldSuggestions(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeFieldInput, activeField, localSearchBase]);

  const recentDestinationCards = useMemo(() => {
    const previewTimes = ['18:45', '13:00', '19:00'];
    return recentPlaces.slice(0, 3).map((place, index) => ({
      ...place,
      previewTime: previewTimes[index] ?? '18:00',
    }));
  }, [recentPlaces]);

  const applyTypedField = (field: LocationField) => {
    const typedValue = field === 'origin' ? originInput.trim() : destinationInput.trim();

    if (typedValue.length === 0) {
      clearPlaceField(field);
      return;
    }

    applyPlaceToField(field, toManualPlace(typedValue, mapCenter));
  };

  const selectPlaceToField = (field: LocationField, place: SavedPlace) => {
    applyPlaceToField(field, withNamedId(place));

    if (field === 'origin') {
      setOriginInput(place.name);
    } else {
      setDestinationInput(place.name);
    }

    setMapCenter({
      lat: place.latitude,
      lng: place.longitude,
      address: place.address,
      source: 'search',
    });
  };

  const selectPlaceForActiveField = (place: SavedPlace) => {
    selectPlaceToField(activeField, place);
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
      iconType: inferPlaceIconType(name),
    };

    selectPlaceToField(activeField, nextPlace);
    setFieldSuggestions([]);
  };

  const handleGeocodeResult = (info: {
    lat: number;
    lng: number;
    roadAddress: string | null;
    jibunAddress: string | null;
    representativeJibun: string | null;
  }) => {
    const refinedName = info.representativeJibun || info.jibunAddress || info.roadAddress || null;
    const refinedAddress = info.jibunAddress || info.roadAddress || refinedName;

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
      (origin.id.includes('current-location-resolved') || origin.name.trim() === '내 위치')
    ) {
      applyPlaceToField('origin', {
        ...origin,
        id: origin.id,
        name: refinedName,
        address: refinedAddress || origin.address,
        latitude: info.lat,
        longitude: info.lng,
      });
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
    arrivalAt: arrivalAt ?? '19:00',
    recentDestinationCards,
    originInput,
    destinationInput,
    fieldSuggestions,
    isSearchingFieldSuggestions,
    mapQuery,
    mapSearchResults,
    isSearchingMap,
    mapCenter,
    geocodeInfo,
    kakaoJsKey,
    setArrivalAt,
    setActiveField,
    setOriginInput,
    setDestinationInput,
    setMapQuery,
    setMapCenter,
    handleGeocodeResult,
    applyTypedField,
    selectPlaceForActiveField,
    selectRecentDestination,
    applyMapCenterToActiveField,
  };
}
