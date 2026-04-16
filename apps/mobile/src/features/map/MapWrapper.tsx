import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';
import { MAP_ADAPTER_TYPE } from './config';
import { OverlayLayer } from './OverlayLayer';
import { useProjectedMapData, type ProjectedMapData } from './projection';
import { createMapAdapter, type MapAdapterType } from './adapters/factory';
import type { MapAdapter } from './adapters/map-adapter';
import type { MovingMapData } from './types';

export interface MapWrapperProps {
  data: MovingMapData;
  progress?: number;
  adapterType?: MapAdapterType;
  adapter?: MapAdapter;
  overlay?: React.ReactNode | ((projected: ProjectedMapData) => React.ReactNode);
  mapHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export const MapWrapper = memo(function MapWrapper({
  data,
  progress = 0,
  adapterType = MAP_ADAPTER_TYPE,
  adapter,
  overlay,
  mapHeight,
  style,
}: MapWrapperProps) {
  const mapAdapter = useMemo(
    () => adapter ?? createMapAdapter(adapterType),
    [adapter, adapterType],
  );
  const projected = useProjectedMapData(data);
  const overlayNode = typeof overlay === 'function' ? overlay(projected) : overlay;

  useEffect(() => {
    mapAdapter.clear();
    mapAdapter.setCenter(data.currentLocation);
    mapAdapter.drawPolyline({
      id: data.routePath.id,
      points: data.routePath.points,
    });
    mapAdapter.addMarker({
      id: 'current-location',
      coordinate: data.currentLocation,
      kind: 'current',
    });
    mapAdapter.addMarker({
      id: data.nextActionPoint.id,
      coordinate: data.nextActionPoint.coordinate,
      kind: 'nextAction',
    });
    mapAdapter.updateMarkerPosition('current-location', data.currentLocation);
  }, [data, mapAdapter]);

  return (
    <View style={[styles.container, style]}>
      {mapAdapter.render({ projected, progress, style: [styles.map, mapHeight ? { height: mapHeight } : null] })}
      <OverlayLayer>{overlayNode}</OverlayLayer>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#EAF1FB',
    ...theme.elevation.md,
  },
  map: {
    width: '100%',
    height: 320,
  },
});
