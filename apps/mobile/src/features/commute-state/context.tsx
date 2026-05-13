import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SelectedRouteSummary } from '../route-recommend/model/selectedRoute';

export type LocationField = 'origin' | 'destination';
export type PlaceIconType = 'home' | 'office' | 'cafe' | 'gym' | 'school' | 'location';

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  iconType: PlaceIconType;
}

interface CommutePlanContextValue {
  origin: SavedPlace | null;
  destination: SavedPlace | null;
  arrivalAt: string | null;
  savedPlaces: SavedPlace[];
  recentPlaces: SavedPlace[];
  latestSelectedPlace: SavedPlace | null;
  selectedRoute: SelectedRouteSummary | null;
  setArrivalAt: (time: string | null) => void;
  applyPlaceToField: (field: LocationField, place: SavedPlace) => void;
  clearPlaceField: (field: LocationField) => void;
  saveLatestPlace: (name: string) => SavedPlace | null;
  setSelectedRoute: (route: SelectedRouteSummary | null) => void;
}

const initialRecentPlaces: SavedPlace[] = [
  {
    id: 'recent-gangnam',
    name: '강남역',
    address: '서울 강남구 강남대로 396',
    latitude: 37.4979,
    longitude: 127.0276,
    iconType: 'location',
  },
  {
    id: 'recent-seoul-station',
    name: '서울역 KTX',
    address: '서울 용산구 한강대로 405',
    latitude: 37.5547,
    longitude: 126.9706,
    iconType: 'location',
  },
  {
    id: 'recent-cityhall',
    name: '시청역 4번 출구',
    address: '서울 중구 세종대로 110',
    latitude: 37.5665,
    longitude: 126.978,
    iconType: 'location',
  },
];

export function inferPlaceIconType(name: string): PlaceIconType {
  const normalized = name.toLowerCase().trim();
  if (normalized.includes('집') || normalized.includes('home')) {
    return 'home';
  }
  if (normalized.includes('회사') || normalized.includes('office') || normalized.includes('사무실')) {
    return 'office';
  }
  if (normalized.includes('카페') || normalized.includes('coffee')) {
    return 'cafe';
  }
  if (normalized.includes('헬스') || normalized.includes('gym') || normalized.includes('피트니스')) {
    return 'gym';
  }
  if (normalized.includes('학교') || normalized.includes('school') || normalized.includes('캠퍼스')) {
    return 'school';
  }
  return 'location';
}

const CommutePlanContext = createContext<CommutePlanContextValue | null>(null);

export function CommutePlanProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<SavedPlace | null>(null);
  const [destination, setDestination] = useState<SavedPlace | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([
    {
      id: 'saved-home',
      name: '집',
      address: '서울 송파구 올림픽로 300',
      latitude: 37.5133,
      longitude: 127.1001,
      iconType: 'home',
    },
    {
      id: 'saved-office',
      name: '회사',
      address: '서울 강남구 테헤란로 212',
      latitude: 37.5013,
      longitude: 127.0396,
      iconType: 'office',
    },
  ]);
  const [recentPlaces, setRecentPlaces] = useState<SavedPlace[]>(initialRecentPlaces);
  const [latestSelectedPlace, setLatestSelectedPlace] = useState<SavedPlace | null>(null);
  const [arrivalAt, setArrivalAt] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRouteSummary | null>(null);

  const value = useMemo<CommutePlanContextValue>(
    () => ({
      origin,
      destination,
      arrivalAt,
      savedPlaces,
      recentPlaces,
      latestSelectedPlace,
      selectedRoute,
      setArrivalAt,
      setSelectedRoute,
      applyPlaceToField: (field, place) => {
        setLatestSelectedPlace(place);
        setRecentPlaces((prev) => {
          const next = [place, ...prev.filter((item) => item.address !== place.address)];
          return next.slice(0, 6);
        });

        if (field === 'origin') {
          setOrigin(place);
          return;
        }

        setDestination(place);
      },
      clearPlaceField: (field) => {
        if (field === 'origin') {
          setOrigin(null);
          return;
        }
        setDestination(null);
      },
      saveLatestPlace: (name) => {
        const trimmedName = name.trim();
        if (!latestSelectedPlace || trimmedName.length === 0) {
          return null;
        }

        const saved: SavedPlace = {
          ...latestSelectedPlace,
          id: `saved-${Date.now()}`,
          name: trimmedName,
          iconType: inferPlaceIconType(trimmedName),
        };

        setSavedPlaces((prev) => [saved, ...prev.filter((item) => item.address !== saved.address)]);
        return saved;
      },
    }),
    [arrivalAt, destination, latestSelectedPlace, origin, recentPlaces, savedPlaces, selectedRoute],
  );

  return <CommutePlanContext.Provider value={value}>{children}</CommutePlanContext.Provider>;
}

export function useCommutePlan() {
  const context = useContext(CommutePlanContext);
  if (!context) {
    throw new Error('useCommutePlan must be used inside CommutePlanProvider');
  }
  return context;
}
