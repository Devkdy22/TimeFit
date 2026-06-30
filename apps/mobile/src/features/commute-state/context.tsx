import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SelectedRouteSummary } from '../route-recommend/model/selectedRoute';
import { useAuth } from '../auth/context';
import { useRoutines } from '../routine/context';

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
  const { isLoggedIn } = useAuth();
  const { savedPlaces: remoteSavedPlaces } = useRoutines();
  const [origin, setOrigin] = useState<SavedPlace | null>(null);
  const [destination, setDestination] = useState<SavedPlace | null>(null);
  const [localSavedPlaces, setLocalSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<SavedPlace[]>([]);
  const [latestSelectedPlace, setLatestSelectedPlace] = useState<SavedPlace | null>(null);
  const [arrivalAt, setArrivalAt] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRouteSummary | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      return;
    }
    setOrigin(null);
    setDestination(null);
    setRecentPlaces([]);
    setLatestSelectedPlace(null);
    setArrivalAt(null);
    setSelectedRoute(null);
  }, [isLoggedIn]);
  const savedPlaces = useMemo<SavedPlace[]>(() => {
    if (isLoggedIn) {
      return remoteSavedPlaces.map((place) => ({
        id: place.id,
        name: place.label,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        iconType: inferPlaceIconType(place.label),
      }));
    }
    return localSavedPlaces;
  }, [isLoggedIn, localSavedPlaces, remoteSavedPlaces]);

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

        setLocalSavedPlaces((prev) => [saved, ...prev.filter((item) => item.address !== saved.address)]);
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
