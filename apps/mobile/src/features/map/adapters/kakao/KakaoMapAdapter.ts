import { createElement } from 'react';
import { NativeModules, UIManager, View, findNodeHandle, type StyleProp, type ViewStyle } from 'react-native';
import KakaoMaps from 'react-native-kakao-maps';
import { CurrentMarker } from '../../CurrentMarker';
import { NextActionMarker } from '../../NextActionMarker';
import { RouteLine } from '../../RouteLine';
import type { MapCoordinate } from '../../types';
import type { MapAdapter, MapAdapterRenderParams, MapMarkerCommand, MapPolylineCommand } from '../map-adapter';
import type {
  KakaoNativeModule,
  NativeKakaoMapComponent,
  NativeKakaoMapViewProps,
  NativeOverlayState,
} from './types';

type KakaoViewCommandName = 'setCenter' | 'addMarker' | 'drawPolyline' | 'updateMarkerPosition' | 'clear';

const KAKAO_VIEW_MANAGER_NAME = 'KakaoMapView';
const KAKAO_MAPS_MODULE = NativeModules.KakaoMaps as KakaoNativeModule | undefined;
const NativeKakaoMapView = (KakaoMaps as { KakaoMapView?: NativeKakaoMapComponent }).KakaoMapView;

function dispatchViewCommand(
  viewRef: unknown,
  name: KakaoViewCommandName,
  args: unknown[] = [],
): boolean {
  const reactTag = findNodeHandle(viewRef as never);
  if (!reactTag) {
    return false;
  }

  const config = UIManager.getViewManagerConfig?.(KAKAO_VIEW_MANAGER_NAME);
  const commandId = config?.Commands?.[name];
  if (typeof commandId !== 'number') {
    return false;
  }

  UIManager.dispatchViewManagerCommand(reactTag, commandId, args);
  return true;
}

function invokeNativeSetCenter(viewRef: unknown, coordinate: MapCoordinate) {
  if (KAKAO_MAPS_MODULE?.setCenter) {
    KAKAO_MAPS_MODULE.setCenter(coordinate);
    return;
  }
  void dispatchViewCommand(viewRef, 'setCenter', [coordinate.lat, coordinate.lng]);
}

function invokeNativeAddMarker(viewRef: unknown, marker: MapMarkerCommand) {
  if (KAKAO_MAPS_MODULE?.addMarker) {
    KAKAO_MAPS_MODULE.addMarker(marker);
    return;
  }
  void dispatchViewCommand(viewRef, 'addMarker', [marker.id, marker.coordinate.lat, marker.coordinate.lng, marker.kind ?? 'default']);
}

function invokeNativeDrawPolyline(viewRef: unknown, polyline: MapPolylineCommand) {
  if (KAKAO_MAPS_MODULE?.drawPolyline) {
    KAKAO_MAPS_MODULE.drawPolyline(polyline);
    return;
  }
  const packed = polyline.points.flatMap((point) => [point.lat, point.lng]);
  void dispatchViewCommand(viewRef, 'drawPolyline', [polyline.id, ...packed]);
}

function invokeNativeUpdateMarkerPosition(viewRef: unknown, markerId: string, coordinate: MapCoordinate) {
  if (KAKAO_MAPS_MODULE?.updateMarkerPosition) {
    KAKAO_MAPS_MODULE.updateMarkerPosition(markerId, coordinate);
    return;
  }
  void dispatchViewCommand(viewRef, 'updateMarkerPosition', [markerId, coordinate.lat, coordinate.lng]);
}

function invokeNativeClear(viewRef: unknown) {
  if (KAKAO_MAPS_MODULE?.clear) {
    KAKAO_MAPS_MODULE.clear();
    return;
  }
  void dispatchViewCommand(viewRef, 'clear');
}

function renderNativeFallback(style?: StyleProp<ViewStyle>) {
  return createElement(View, {
    style: [{ flex: 1, backgroundColor: '#EAF1FB' }, style],
  });
}

export function createKakaoMapAdapter(): MapAdapter {
  const overlayState: NativeOverlayState = {
    center: null,
    markers: new Map(),
    polylines: new Map(),
  };

  let nativeViewRef: unknown = null;

  const bindNativeRef = (ref: unknown) => {
    nativeViewRef = ref;
  };

  return {
    type: 'kakao',
    render(params: MapAdapterRenderParams) {
      const nativeMapView = NativeKakaoMapView
        ? createElement(NativeKakaoMapView as unknown as NativeKakaoMapComponent, {
            ...( {
              ref: bindNativeRef,
              style: params.style as NativeKakaoMapViewProps['style'],
              onCenterPointMovedTo: (event: { center?: { latitude?: number; longitude?: number } }) => {
                const center = event?.center;
                if (center?.latitude == null || center?.longitude == null) {
                  return;
                }
                overlayState.center = { lat: center.latitude, lng: center.longitude };
              },
            } as unknown as NativeKakaoMapViewProps),
          })
        : renderNativeFallback(params.style);

      return createElement(
        View,
        { style: params.style },
        nativeMapView,
        createElement(RouteLine, {
          segments: params.projected.segments,
          progress: params.progress,
        }),
        createElement(CurrentMarker, {
          point: params.projected.currentPoint,
        }),
        createElement(NextActionMarker, {
          point: params.projected.nextActionPoint,
        }),
      );
    },
    setCenter(coordinate) {
      overlayState.center = coordinate;
      invokeNativeSetCenter(nativeViewRef, coordinate);
    },
    addMarker(marker) {
      overlayState.markers.set(marker.id, marker);
      invokeNativeAddMarker(nativeViewRef, marker);
    },
    drawPolyline(polyline) {
      overlayState.polylines.set(polyline.id, polyline);
      invokeNativeDrawPolyline(nativeViewRef, polyline);
    },
    updateMarkerPosition(markerId, coordinate) {
      const existing = overlayState.markers.get(markerId);
      if (existing) {
        overlayState.markers.set(markerId, {
          ...existing,
          coordinate,
        });
      }
      invokeNativeUpdateMarkerPosition(nativeViewRef, markerId, coordinate);
    },
    clear() {
      overlayState.center = null;
      overlayState.markers.clear();
      overlayState.polylines.clear();
      invokeNativeClear(nativeViewRef);
    },
  };
}
