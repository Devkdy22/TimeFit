import type { UiStatus } from '../../theme/status-config';

export interface MapCoordinate {
  lat: number;
  lng: number;
}

export interface CurrentLocation extends MapCoordinate {
  heading?: number;
  accuracy?: number;
}

export interface NextActionPoint {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  instruction: string;
  status: UiStatus;
}

export interface MapRoutePath {
  id: string;
  points: MapCoordinate[];
}

export interface MovingMapData {
  currentLocation: CurrentLocation;
  routePath: MapRoutePath;
  nextActionPoint: NextActionPoint;
}

