import type { MapAdapter } from './map-adapter';
import { createKakaoMapAdapter } from './kakao/KakaoMapAdapter';
import { createMockMapAdapter } from './mock-map-adapter';

export type MapAdapterType = 'mock' | 'kakao';

export function createMapAdapter(type: MapAdapterType): MapAdapter {
  if (type === 'kakao') {
    return createKakaoMapAdapter();
  }

  return createMockMapAdapter();
}
