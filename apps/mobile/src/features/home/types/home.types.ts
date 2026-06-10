export type User = {
  id: string;
  name: string;
  isLoggedIn: boolean;
};

export type Routine = {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  departureTime: string;
  arrivalTime?: string;
  daysLabel: string;
  transitSummary?: string;
  bufferMinutes?: number;
};

export type RecentTrip = {
  id: string;
  title: string;
  subtitle?: string;
  usedAtLabel: string;
  type: 'subway' | 'bus' | 'place';
};

export type HomeState = {
  user: User | null;
  routines: Routine[];
  recentTrips: RecentTrip[];
  selectedArrivalTime: string;
  selectedDestination?: {
    id: string;
    name: string;
    address?: string;
  };
};
