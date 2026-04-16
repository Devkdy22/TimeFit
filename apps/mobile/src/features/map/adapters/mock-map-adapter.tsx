import { KakaoMapView } from '../KakaoMapView';
import type { MapAdapter } from './map-adapter';

export function createMockMapAdapter(): MapAdapter {
  const markerStore = new Map<string, { lat: number; lng: number }>();
  const polylineStore = new Map<string, { lat: number; lng: number }[]>();
  let center: { lat: number; lng: number } | null = null;

  return {
    type: 'mock',
    render({ projected, progress, style }) {
      return <KakaoMapView projected={projected} progress={progress} style={style} />;
    },
    setCenter(coordinate) {
      center = coordinate;
      void center;
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
      center = null;
    },
  };
}
