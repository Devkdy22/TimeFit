import type { MovingMapMockData } from './types';

export const movingMapMockData: MovingMapMockData = {
  currentLocation: {
    lat: 37.56631,
    lng: 126.97794,
    heading: 85,
    accuracy: 9,
  },
  routePath: {
    id: 'route-main-001',
    points: [
      { lat: 37.56612, lng: 126.9771 },
      { lat: 37.56621, lng: 126.97748 },
      { lat: 37.56627, lng: 126.97775 },
      { lat: 37.56631, lng: 126.97794 },
      { lat: 37.56639, lng: 126.9783 },
      { lat: 37.56647, lng: 126.97867 },
      { lat: 37.56652, lng: 126.97895 },
    ],
  },
  nextActionPoint: {
    id: 'action-point-transfer',
    coordinate: { lat: 37.56647, lng: 126.97867 },
    title: '다음 행동',
    instruction: '100m 앞에서 우측 횡단보도 이용',
    status: 'warning',
  },
};
