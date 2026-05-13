import { Platform } from 'react-native';
import type { MapAdapter } from './map-adapter';
import { createMockMapAdapter } from './mock-map-adapter';
import { createKakaoMapAdapter } from './kakao/KakaoMapAdapter';

export type MapAdapterType = 'mock' | 'kakao';

export function createMapAdapter(type: MapAdapterType): MapAdapter {
  if (type === 'kakao' && Platform.OS !== 'web') {
    return createKakaoMapAdapter();
  }

  return createMockMapAdapter();
}
