import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/context';
import {
  createMyPlace,
  createRoutine,
  deleteMyPlace,
  deleteRoutine as deleteRoutineApi,
  getMyPlaces,
  getRoutines,
  updateRoutine as updateRoutineApi,
} from '../../services/api/client';
import type { RoutineListItem } from '../../services/api/client';
import type { Routine, RoutineDay } from './model/types';

export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

interface RoutineContextValue {
  routines: Routine[];
  savedPlaces: SavedPlace[];
  addRoutine: (routine: Routine) => void;
  createRoutineOnServer: (input: {
    name: string;
    originName: string;
    destinationName: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    targetTime: string;
    repeatDays: RoutineDay[];
    notificationEnabled: boolean;
    notificationMinutesBefore: number;
    favorite: boolean;
    signal?: AbortSignal;
  }) => Promise<Routine>;
  toggleFavorite: (id: string) => Promise<void>;
  updateRoutine: (id: string, patch: Partial<Routine>) => Promise<void>;
  removeRoutine: (id: string) => Promise<void>;
  addSavedPlace: (place: Omit<SavedPlace, 'id' | 'updatedAt'>) => Promise<SavedPlace>;
  removeSavedPlace: (id: string) => Promise<void>;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile, getSessionGeneration } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const createInFlightRef = useRef<
    Map<string, { key: string; promise: Promise<Routine> }>
  >(new Map());
  const savedPlaceCreateInFlightRef = useRef<
    Map<string, { key: string; promise: Promise<SavedPlace> }>
  >(new Map());

  const syncRemoteRoutines = useCallback(
    async (signal?: AbortSignal) => {
      if (!isLoggedIn || !profile?.id) {
        return;
      }

      const userId = profile.id;
      const sessionGenerationAtStart = getSessionGeneration();
      try {
        const remote = await getRoutines(signal);
        if (signal?.aborted || sessionGenerationAtStart !== getSessionGeneration()) {
          return;
        }
        const mapped: Routine[] = remote.map(routineFromRemote);
        setRoutines(mapped);
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }
        console.warn('[Routine] GET /routines sync failed', {
          message: error instanceof Error ? error.message : String(error),
          userId,
        });
      }
    },
    [getSessionGeneration, isLoggedIn, profile?.id],
  );

  const syncRemoteSavedPlaces = useCallback(
    async (signal?: AbortSignal) => {
      if (!isLoggedIn || !profile?.id) {
        return;
      }

      const userId = profile.id;
      const sessionGenerationAtStart = getSessionGeneration();
      try {
        const remote = await getMyPlaces(signal);
        if (signal?.aborted || sessionGenerationAtStart !== getSessionGeneration()) {
          return;
        }
        const mapped: SavedPlace[] = remote.map((item) => ({
          id: item.id,
          label: item.label,
          address: item.address,
          latitude: item.lat,
          longitude: item.lng,
          updatedAt: item.updatedAt,
        }));
        setSavedPlaces(mapped);
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }
        console.warn('[Routine] GET /me/places sync failed', {
          message: error instanceof Error ? error.message : String(error),
          userId,
        });
      }
    },
    [getSessionGeneration, isLoggedIn, profile?.id],
  );

  useEffect(() => {
    if (isLoggedIn && profile?.id) {
      return;
    }
    createInFlightRef.current.clear();
    savedPlaceCreateInFlightRef.current.clear();
    setRoutines([]);
    setSavedPlaces([]);
  }, [isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      return;
    }

    const controller = new AbortController();
    void syncRemoteRoutines(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isLoggedIn, profile?.id, syncRemoteRoutines]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isLoggedIn || !profile?.id) {
        return;
      }

      const controller = new AbortController();
      void syncRemoteRoutines(controller.signal);
      void syncRemoteSavedPlaces(controller.signal);
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, profile?.id, syncRemoteRoutines, syncRemoteSavedPlaces]);

  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      return;
    }

    const controller = new AbortController();
    void syncRemoteSavedPlaces(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isLoggedIn, profile?.id, syncRemoteSavedPlaces]);

  const value = useMemo<RoutineContextValue>(
    () => ({
      routines,
      savedPlaces,
      addRoutine: (routine) => setRoutines((prev) => [routine, ...prev]),
      createRoutineOnServer: async (input) => {
        const payloadFingerprint = stableStringify({
          title: input.name.trim(),
          origin: {
            name: input.originName.trim(),
            lat: input.originLat,
            lng: input.originLng,
          },
          destination: {
            name: input.destinationName.trim(),
            lat: input.destinationLat,
            lng: input.destinationLng,
          },
          weekdays: input.repeatDays.map((day) => dayToWeekdayIndex(day)),
          arrivalTime: input.targetTime.trim(),
        });

        const existing = createInFlightRef.current.get(payloadFingerprint);
        if (existing) {
          return existing.promise;
        }

        const sessionGenerationAtStart = getSessionGeneration();
        const idempotencyKey = generateUuidV4();
        const requestPromise = (async () => {
          const created = await createRoutine(
            {
              title: input.name.trim(),
              origin: {
                name: input.originName.trim(),
                lat: input.originLat,
                lng: input.originLng,
              },
              destination: {
                name: input.destinationName.trim(),
                lat: input.destinationLat,
                lng: input.destinationLng,
              },
              weekdays: input.repeatDays.map((day) => dayToWeekdayIndex(day)),
              arrivalTime: input.targetTime.trim(),
              notificationEnabled: input.notificationEnabled,
              notificationMinutesBefore: input.notificationMinutesBefore,
              favorite: input.favorite,
              active: true,
            },
            idempotencyKey,
            input.signal,
          );

          if (sessionGenerationAtStart !== getSessionGeneration()) {
            throw new Error('stale_auth_session_response_discarded');
          }

          const mapped: Routine = {
            id: created.id,
            name: created.title,
            originName: created.origin.name,
            destinationName: created.destination.name,
            originLat: created.origin.lat,
            originLng: created.origin.lng,
            destinationLat: created.destination.lat,
            destinationLng: created.destination.lng,
            targetTime: created.arrivalTime,
            timeMode: 'arrival',
            repeatDays: created.weekdays
              .map((weekday) => weekdayIndexToDay(weekday))
              .filter((day): day is RoutineDay => day !== null),
            notificationEnabled: created.notificationEnabled,
            notificationMinutesBefore: created.notificationMinutesBefore,
            favorite: created.favorite,
            active: created.active,
            lastUsedAt: created.lastTriggeredAt,
          };
          setRoutines((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)]);
          return mapped;
        })().finally(() => {
          createInFlightRef.current.delete(payloadFingerprint);
        });

        createInFlightRef.current.set(payloadFingerprint, {
          key: idempotencyKey,
          promise: requestPromise,
        });
        return requestPromise;
      },
      toggleFavorite: async (id) => {
        const current = routines.find((item) => item.id === id);
        if (!current) {
          return;
        }
        const nextFavorite = !current.favorite;
        setRoutines((prev) => prev.map((item) => (item.id === id ? { ...item, favorite: nextFavorite } : item)));
        try {
          const updated = await updateRoutineApi(id, { favorite: nextFavorite });
          setRoutines((prev) => prev.map((item) => (item.id === id ? routineFromRemote(updated) : item)));
        } catch (error) {
          setRoutines((prev) => prev.map((item) => (item.id === id ? current : item)));
          throw error;
        }
      },
      updateRoutine: async (id, patch) => {
        const current = routines.find((item) => item.id === id);
        if (!current) {
          return;
        }
        const optimistic = { ...current, ...patch };
        setRoutines((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
        try {
          const updated = await updateRoutineApi(id, routinePatchToRequest(optimistic, patch));
          setRoutines((prev) => prev.map((item) => (item.id === id ? routineFromRemote(updated) : item)));
        } catch (error) {
          setRoutines((prev) => prev.map((item) => (item.id === id ? current : item)));
          throw error;
        }
      },
      removeRoutine: async (id) => {
        const current = routines.find((item) => item.id === id);
        setRoutines((prev) => prev.filter((item) => item.id !== id));
        try {
          await deleteRoutineApi(id);
        } catch (error) {
          if (current) {
            setRoutines((prev) => [current, ...prev.filter((item) => item.id !== id)]);
          }
          throw error;
        }
      },
      addSavedPlace: async (place) => {
        const normalizedLabel = normalizeSavedPlaceLabelForRequest(place.label);
        const normalizedAddress = place.address.trim();
        if (isLoggedIn && profile?.id) {
          const payloadFingerprint = stableStringify({
            label: normalizedLabel,
            address: normalizedAddress,
            lat: place.latitude,
            lng: place.longitude,
          });
          const existing = savedPlaceCreateInFlightRef.current.get(payloadFingerprint);
          if (existing) {
            return existing.promise;
          }

          const idempotencyKey = generateUuidV4();
          const requestPromise = (async () => {
            const created = await createMyPlace({
              label: normalizedLabel,
              address: normalizedAddress,
              lat: place.latitude,
              lng: place.longitude,
            }, idempotencyKey);
            const mapped: SavedPlace = {
              id: created.id,
              label: created.label,
              address: created.address,
              latitude: created.lat,
              longitude: created.lng,
              updatedAt: created.updatedAt,
            };
            setSavedPlaces((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)]);
            return mapped;
          })().finally(() => {
            savedPlaceCreateInFlightRef.current.delete(payloadFingerprint);
          });

          savedPlaceCreateInFlightRef.current.set(payloadFingerprint, {
            key: idempotencyKey,
            promise: requestPromise,
          });
          return requestPromise;
        }

        const local: SavedPlace = {
          ...place,
          label: normalizedLabel,
          address: normalizedAddress,
          id: `saved-place-${Date.now()}`,
          updatedAt: new Date().toISOString(),
        };
        setSavedPlaces((prev) => [local, ...prev.filter((item) => item.id !== local.id)]);
        return local;
      },
      removeSavedPlace: async (id) => {
        if (isLoggedIn && profile?.id) {
          await deleteMyPlace(id);
        }
        setSavedPlaces((prev) => prev.filter((item) => item.id !== id));
      },
    }),
    [getSessionGeneration, isLoggedIn, profile?.id, routines, savedPlaces],
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

function dayToWeekdayIndex(day: RoutineDay): number {
  switch (day) {
    case 'sun':
      return 0;
    case 'mon':
      return 1;
    case 'tue':
      return 2;
    case 'wed':
      return 3;
    case 'thu':
      return 4;
    case 'fri':
      return 5;
    case 'sat':
      return 6;
  }
}

function weekdayIndexToDay(index: number): RoutineDay | null {
  switch (index) {
    case 0:
      return 'sun';
    case 1:
      return 'mon';
    case 2:
      return 'tue';
    case 3:
      return 'wed';
    case 4:
      return 'thu';
    case 5:
      return 'fri';
    case 6:
      return 'sat';
    default:
      return null;
  }
}

function routineFromRemote(item: RoutineListItem): Routine {
  return {
    id: item.id,
    name: item.title,
    originName: item.origin.name,
    destinationName: item.destination.name,
    originLat: item.origin.lat,
    originLng: item.origin.lng,
    destinationLat: item.destination.lat,
    destinationLng: item.destination.lng,
    targetTime: item.arrivalTime,
    timeMode: 'arrival',
    repeatDays: item.weekdays
      .map((weekday) => weekdayIndexToDay(weekday))
      .filter((day): day is RoutineDay => day !== null),
    notificationEnabled: item.notificationEnabled,
    notificationMinutesBefore: item.notificationMinutesBefore,
    favorite: item.favorite,
    active: item.active,
    lastUsedAt: item.lastTriggeredAt,
  };
}

function routinePatchToRequest(routine: Routine, patch: Partial<Routine>) {
  const request: {
    title?: string;
    origin?: { name: string; lat: number; lng: number };
    destination?: { name: string; lat: number; lng: number };
    weekdays?: number[];
    arrivalTime?: string;
    notificationEnabled?: boolean;
    notificationMinutesBefore?: number;
    favorite?: boolean;
    active?: boolean;
  } = {};

  if (patch.name !== undefined) {
    request.title = routine.name.trim();
  }
  if (
    patch.originName !== undefined ||
    patch.originLat !== undefined ||
    patch.originLng !== undefined
  ) {
    request.origin = {
      name: routine.originName.trim(),
      lat: routine.originLat,
      lng: routine.originLng,
    };
  }
  if (
    patch.destinationName !== undefined ||
    patch.destinationLat !== undefined ||
    patch.destinationLng !== undefined
  ) {
    request.destination = {
      name: routine.destinationName.trim(),
      lat: routine.destinationLat,
      lng: routine.destinationLng,
    };
  }
  if (patch.repeatDays !== undefined) {
    request.weekdays = routine.repeatDays.map((day) => dayToWeekdayIndex(day));
  }
  if (patch.targetTime !== undefined) {
    request.arrivalTime = routine.targetTime.trim();
  }
  if (patch.notificationEnabled !== undefined) {
    request.notificationEnabled = routine.notificationEnabled;
  }
  if (patch.notificationMinutesBefore !== undefined) {
    request.notificationMinutesBefore = routine.notificationMinutesBefore;
  }
  if (patch.favorite !== undefined) {
    request.favorite = routine.favorite;
  }
  if (patch.active !== undefined) {
    request.active = routine.active;
  }

  return request;
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const random = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${random.slice(0, 8)}-${random.slice(8, 12)}-4${random.slice(12, 15)}-a${random.slice(15, 18)}-${random.slice(18, 30).padEnd(12, '0')}`;
}

function normalizeSavedPlaceLabelForRequest(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function useRoutines() {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error('useRoutines must be used inside RoutineProvider');
  }
  return context;
}
