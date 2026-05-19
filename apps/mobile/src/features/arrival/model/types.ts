export type ArrivalSummary = {
  originName: string;
  destinationName: string;
  departureTime: string;
  arrivalTime: string;
  durationText: string;
  status: 'onTime' | 'early' | 'late';
  statusLabel: string;
  bufferMinutes?: number;
};
