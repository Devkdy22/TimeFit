import type { StyleProp, ViewStyle } from 'react-native';
import type { MapCoordinate } from '../types';

export type KakaoMapWebViewEvent =
  | { type: 'MAP_BOOT'; href: string }
  | { type: 'MAP_READY' }
  | { type: 'MAP_MOVED'; lat: number; lng: number; address?: string }
  | { type: 'MAP_ERROR'; message: string };

export interface KakaoMapWebViewProps {
  apiKey: string;
  initialCenter: MapCoordinate;
  initialMarker?: MapCoordinate;
  style?: StyleProp<ViewStyle>;
  onEvent?: (event: KakaoMapWebViewEvent) => void;
}

export interface KakaoMapWebViewHandle {
  moveTo: (coordinate: MapCoordinate) => void;
}
