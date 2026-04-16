import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { MapCoordinate } from '../types';
import type { ProjectedMapData } from '../projection';

export interface MapMarkerCommand {
  id: string;
  coordinate: MapCoordinate;
  kind?: 'default' | 'current' | 'nextAction';
}

export interface MapPolylineCommand {
  id: string;
  points: MapCoordinate[];
}

export interface MapAdapterRenderParams {
  projected: ProjectedMapData;
  progress: number;
  style?: StyleProp<ViewStyle>;
}

export interface MapAdapter {
  readonly type: 'mock' | 'kakao';
  render: (params: MapAdapterRenderParams) => ReactNode;
  setCenter: (coordinate: MapCoordinate) => void;
  addMarker: (marker: MapMarkerCommand) => void;
  drawPolyline: (polyline: MapPolylineCommand) => void;
  updateMarkerPosition: (markerId: string, coordinate: MapCoordinate) => void;
  clear: () => void;
}
