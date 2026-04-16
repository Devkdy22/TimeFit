import { Platform } from 'react-native';
import type { MapAdapter } from './map-adapter';
import { createMockMapAdapter } from './mock-map-adapter';

export type MapAdapterType = 'mock' | 'kakao';

export function createMapAdapter(type: MapAdapterType): MapAdapter {
  if (type === 'kakao' && Platform.OS !== 'web') {
    const { createKakaoMapAdapter } = require('./kakao/KakaoMapAdapter') as typeof import('./kakao/KakaoMapAdapter');
    return createKakaoMapAdapter();
  }

  return createMockMapAdapter();
}
