import type { ComponentType } from 'react';
import type { MapCoordinate } from '../../types';
import type { MapMarkerCommand, MapPolylineCommand } from '../map-adapter';

export interface NativeKakaoMapViewProps {
  style?: object;
  onCenterPointMovedTo?: (event: { center?: { latitude?: number; longitude?: number } }) => void;
}

export type NativeKakaoMapComponent = ComponentType<NativeKakaoMapViewProps>;

export interface KakaoNativeModule {
  setCenter?: (coordinate: MapCoordinate) => void;
  addMarker?: (marker: MapMarkerCommand) => void;
  drawPolyline?: (polyline: MapPolylineCommand) => void;
  updateMarkerPosition?: (markerId: string, coordinate: MapCoordinate) => void;
  clear?: () => void;
}

export interface NativeOverlayState {
  center: MapCoordinate | null;
  markers: Map<string, MapMarkerCommand>;
  polylines: Map<string, MapPolylineCommand>;
}

