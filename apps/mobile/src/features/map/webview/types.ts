import type { StyleProp, ViewStyle } from 'react-native';
import type { MapCoordinate } from '../types';

export type MapCenterSource = 'gps' | 'search' | 'user' | 'init';

export type KakaoMapWebViewEvent =
  | { type: 'MAP_BOOT'; href: string }
  | { type: 'MAP_READY' }
  | {
      type: 'MAP_MOVED';
      lat: number;
      lng: number;
      address?: string;
      roadAddress?: string;
      jibunAddress?: string;
      representativeJibun?: string;
      source?: MapCenterSource;
      reason?: string;
    }
  | { type: 'MAP_ERROR'; message: string }
  | { type: 'MAP_LOG'; keyType: 'JS' | 'REST'; message: string; meta?: Record<string, unknown> };

export interface KakaoMapWebViewProps {
  jsApiKey: string;
  initialCenter: MapCoordinate;
  initialMarker?: MapCoordinate;
  style?: StyleProp<ViewStyle>;
  onEvent?: (event: KakaoMapWebViewEvent) => void;
}

export interface KakaoMapWebViewHandle {
  moveTo: (coordinate: MapCoordinate & { source?: MapCenterSource }) => void;
}
