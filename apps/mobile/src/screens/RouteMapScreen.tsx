import React, { useEffect, useState } from 'react';
import MapView from 'react-native-maps';

import { RoutePolylines } from '../components/RoutePolylines';
import { parseOdsayResponse } from '../services/parseOdsayResponse';
import { fetchAllSegmentGeometries, SegmentGeometry } from '../services/routeGeometry';

interface RouteMapScreenProps {
  odsayResult: {
    result?: {
      path?: unknown[];
    };
  };
  selectedPathIndex?: number;
}

export function RouteMapScreen({ odsayResult, selectedPathIndex = 0 }: RouteMapScreenProps) {
  const [geometries, setGeometries] = useState<SegmentGeometry[]>([]);

  useEffect(() => {
    const path = odsayResult?.result?.path?.[selectedPathIndex];
    if (!path) return;

    const segments = parseOdsayResponse(path);

    fetchAllSegmentGeometries(segments).then((result) => {
      setGeometries(result);

      const stats = result.reduce(
        (acc, g) => {
          acc[g.source] = (acc[g.source] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log('[RouteMap] Geometry source stats:', stats);
    });
  }, [odsayResult, selectedPathIndex]);

  return (
    <MapView style={{ flex: 1 }}>
      <RoutePolylines segments={geometries} />
    </MapView>
  );
}
