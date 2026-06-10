import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/context';
import { createMyPlace, createRoutine, deleteMyPlace, getMyPlaces, getRoutines } from '../../services/api/client';
import type { Routine, RoutineDay } from './model/types';

export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

const initialRoutines: Routine[] = [
  {
    id: 'routine-1',
    name: '출근',
    originName: '집',
    destinationName: '회사',
    originLat: 37.5665,
    originLng: 126.978,
    destinationLat: 37.4979,
    destinationLng: 127.0276,
    targetTime: '08:50',
    timeMode: 'arrival',
    repeatDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    notificationEnabled: true,
    notificationMinutesBefore: 10,
    favorite: true,
    lastUsedAt: new Date().toISOString(),
  },
  {
    id: 'routine-2',
    name: '헬스장',
    originName: '회사',
    destinationName: '헬스장',
    originLat: 37.4979,
    originLng: 127.0276,
    destinationLat: 37.5013,
    destinationLng: 127.0396,
    targetTime: '19:20',
    timeMode: 'departure',
    repeatDays: ['mon', 'wed', 'fri'],
    notificationEnabled: false,
    notificationMinutesBefore: 15,
    favorite: false,
  },
];

const initialSavedPlaces: SavedPlace[] = [
  {
    id: 'saved-place-home',
    label: '집',
    address: '서울특별시 중구 세종대로 110',
    latitude: 37.5665,
    longitude: 126.978,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'saved-place-office',
    label: '회사',
    address: '서울특별시 강남구 테헤란로 212',
    latitude: 37.498,
    longitude: 127.0276,
    updatedAt: new Date().toISOString(),
  },
];

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
  toggleFavorite: (id: string) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  removeRoutine: (id: string) => void;
  addSavedPlace: (place: Omit<SavedPlace, 'id' | 'updatedAt'>) => Promise<SavedPlace>;
  removeSavedPlace: (id: string) => Promise<void>;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile, getSessionGeneration } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(initialSavedPlaces);
  const createInFlightRef = useRef<
    Map<string, { key: string; promise: Promise<Routine> }>
  >(new Map());

  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const remote = await getRoutines(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        const mapped: Routine[] = remote.map((item) => ({
          id: item.id,
          name: item.title,
          originName: item.origin,
          destinationName: item.destination,
          originLat: 0,
          originLng: 0,
          destinationLat: 0,
          destinationLng: 0,
          targetTime: item.arrivalTime,
          timeMode: 'arrival',
          repeatDays: item.weekdays
            .map((weekday) => {
              switch (weekday) {
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
            })
            .filter((day): day is Routine['repeatDays'][number] => day !== null),
          notificationEnabled: true,
          notificationMinutesBefore: 10,
          favorite: false,
          lastUsedAt: item.lastTriggeredAt,
        }));
        setRoutines(mapped);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.warn('[Routine] GET /routines sync failed', {
          message: error instanceof Error ? error.message : String(error),
          userId: profile.id,
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isLoggedIn, profile?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isLoggedIn || !profile?.id) {
        return;
      }

      const controller = new AbortController();
      void (async () => {
        try {
          const remote = await getMyPlaces(controller.signal);
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
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.warn('[Routine] foreground revalidation /me/places failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: profile.id,
          });
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const remote = await getMyPlaces(controller.signal);
        if (controller.signal.aborted) {
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
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.warn('[Routine] GET /me/places sync failed', {
          message: error instanceof Error ? error.message : String(error),
          userId: profile.id,
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isLoggedIn, profile?.id]);

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
            originName: created.origin,
            destinationName: created.destination,
            originLat: input.originLat,
            originLng: input.originLng,
            destinationLat: input.destinationLat,
            destinationLng: input.destinationLng,
            targetTime: created.arrivalTime,
            timeMode: 'arrival',
            repeatDays: created.weekdays
              .map((weekday) => weekdayIndexToDay(weekday))
              .filter((day): day is RoutineDay => day !== null),
            notificationEnabled: input.notificationEnabled,
            notificationMinutesBefore: input.notificationMinutesBefore,
            favorite: input.favorite,
            lastUsedAt: created.lastTriggeredAt,
          };
          setRoutines((prev) => [mapped, ...prev]);
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
      toggleFavorite: (id) => {
        setRoutines((prev) => prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)));
      },
      updateRoutine: (id, patch) => {
        setRoutines((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      },
      removeRoutine: (id) => {
        setRoutines((prev) => prev.filter((item) => item.id !== id));
      },
      addSavedPlace: async (place) => {
        const normalizedLabel = normalizeSavedPlaceLabelForRequest(place.label);
        const normalizedAddress = place.address.trim();
        if (isLoggedIn && profile?.id) {
          const idempotencyKey = generateUuidV4();
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
