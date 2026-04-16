import type { MapCoordinate } from './types';
import type { MapMarkerCommand, MapPolylineCommand } from './adapters/map-adapter';

export interface KakaoSdkBridgeOptions {
  appKey: string;
  enableCurrentLocation: boolean;
}

export interface KakaoSdkBridge {
  initialize: (options: KakaoSdkBridgeOptions) => Promise<void>;
  setCenter: (coordinate: MapCoordinate) => void;
  addMarker: (marker: MapMarkerCommand) => void;
  drawPolyline: (polyline: MapPolylineCommand) => void;
  updateMarkerPosition: (markerId: string, coordinate: MapCoordinate) => void;
  clear: () => void;
}

/**
 * 연결 포인트:
 * 1) Native Kakao Map SDK 초기화
 * 2) currentLocation, routePath, nextActionPoint를 SDK overlay로 매핑
 * 3) GPS watcher(onLocationChanged)와 updateMapData를 연결
 */
export function createKakaoSdkBridge(): KakaoSdkBridge {
  const markerStore = new Map<string, MapCoordinate>();
  const polylineStore = new Map<string, MapCoordinate[]>();

  return {
    async initialize() {
      return Promise.resolve();
    },
    setCenter() {
      return;
    },
    addMarker(marker) {
      markerStore.set(marker.id, marker.coordinate);
    },
    drawPolyline(polyline) {
      polylineStore.set(polyline.id, polyline.points);
    },
    updateMarkerPosition(markerId, coordinate) {
      if (markerStore.has(markerId)) {
        markerStore.set(markerId, coordinate);
      }
    },
    clear() {
      markerStore.clear();
      polylineStore.clear();
      return;
    },
  };
}
