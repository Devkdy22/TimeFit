import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CurrentMarker } from './CurrentMarker';
import { NextActionMarker } from './NextActionMarker';
import { RouteLine } from './RouteLine';
import { MAP_PROJECTION, type ProjectedMapData } from './projection';

interface KakaoMapViewProps {
  projected: ProjectedMapData;
  progress: number;
  style?: StyleProp<ViewStyle>;
}

export const KakaoMapView = memo(function KakaoMapView({
  projected,
  progress,
  style,
}: KakaoMapViewProps) {
  const { segments, currentPoint, nextActionPoint } = projected;

  return (
    <View style={[styles.map, style]}>
      <View style={styles.mapBackground} />

      <RouteLine segments={segments} progress={progress} />
      <CurrentMarker point={currentPoint} />
      <NextActionMarker point={nextActionPoint} />
    </View>
  );
});

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: MAP_PROJECTION.height,
    overflow: 'hidden',
    backgroundColor: '#EAF1FB',
  },
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EAF1FB',
  },
});
