import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Routine } from './model/types';

const initialRoutines: Routine[] = [
  {
    id: 'routine-1',
    name: '출근',
    originName: '집',
    destinationName: '회사',
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
    targetTime: '19:20',
    timeMode: 'departure',
    repeatDays: ['mon', 'wed', 'fri'],
    notificationEnabled: false,
    notificationMinutesBefore: 15,
    favorite: false,
  },
];

interface RoutineContextValue {
  routines: Routine[];
  addRoutine: (routine: Routine) => void;
  toggleFavorite: (id: string) => void;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);

  const value = useMemo<RoutineContextValue>(
    () => ({
      routines,
      addRoutine: (routine) => setRoutines((prev) => [routine, ...prev]),
      toggleFavorite: (id) => {
        setRoutines((prev) => prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)));
      },
    }),
    [routines],
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutines() {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error('useRoutines must be used inside RoutineProvider');
  }
  return context;
}
