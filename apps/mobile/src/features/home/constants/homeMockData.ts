import type { HomeState } from '../types/home.types';

const guestState: HomeState = {
  user: null,
  routines: [],
  recentTrips: [],
  selectedArrivalTime: '16:41',
};

const loggedInWithRoutinesState: HomeState = {
  user: {
    id: 'user-1',
    name: '지연',
    isLoggedIn: true,
  },
  routines: [
    {
      id: 'routine-1',
      name: '출근 루틴',
      originName: '집',
      destinationName: '회사',
      departureTime: '08:20',
      arrivalTime: '08:55',
      daysLabel: '평일 오전',
      transitSummary: '2호선 · 강남역 환승',
      bufferMinutes: 12,
    },
    {
      id: 'routine-2',
      name: '퇴근 루틴',
      originName: '회사',
      destinationName: '집',
      departureTime: '18:40',
      arrivalTime: '19:25',
      daysLabel: '평일 저녁',
      transitSummary: '9호선 급행',
      bufferMinutes: 8,
    },
  ],
  recentTrips: [
    {
      id: 'trip-1',
      title: '강남역 2호선',
      subtitle: '회사 → 강남역',
      usedAtLabel: '오늘 08:12',
      type: 'subway',
    },
    {
      id: 'trip-2',
      title: '서울역 버스환승센터',
      subtitle: '강남 → 서울역',
      usedAtLabel: '어제 18:40',
      type: 'bus',
    },
  ],
  selectedArrivalTime: '08:55',
  selectedDestination: {
    id: 'dest-office',
    name: '회사',
    address: '서울 강남구 테헤란로 212',
  },
};

const loggedInWithoutRoutinesState: HomeState = {
  user: {
    id: 'user-2',
    name: '민수',
    isLoggedIn: true,
  },
  routines: [],
  recentTrips: [
    {
      id: 'trip-3',
      title: '홍대입구역',
      subtitle: '서울 마포구 양화로',
      usedAtLabel: '3일 전 19:20',
      type: 'place',
    },
  ],
  selectedArrivalTime: '19:10',
};

export const homeMockStates = {
  guest: guestState,
  loggedInWithRoutines: loggedInWithRoutinesState,
  loggedInWithoutRoutines: loggedInWithoutRoutinesState,
} as const;

export type HomeMockStateKey = keyof typeof homeMockStates;
