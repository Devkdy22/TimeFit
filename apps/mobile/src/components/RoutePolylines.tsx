import React from 'react';
import { Polyline } from 'react-native-maps';

import { SegmentGeometry } from '../services/routeGeometry/types';

interface RoutePolylinesProps {
  segments: SegmentGeometry[];
}

/**
 * 각 segment를 개별 Polyline으로 렌더링한다.
 * - 전체 merged polyline 하나로 그리지 않는다
 * - 각 segment는 outline + inner 이중 Polyline으로 그린다
 */
export function RoutePolylines({ segments }: RoutePolylinesProps) {
  return (
    <>
      {segments.map((segment) => (
        <SegmentPolyline key={segment.segmentId} segment={segment} />
      ))}
    </>
  );
}

function SegmentPolyline({ segment }: { segment: SegmentGeometry }) {
  const { coordinates, color, isDashed, mode } = segment;

  if (coordinates.length < 2) return null;

  if (isDashed || mode === 'WALK') {
    return (
      <>
        <Polyline
          coordinates={coordinates}
          strokeColor="rgba(255,255,255,0.8)"
          strokeWidth={6}
          lineDashPattern={[8, 6]}
        />
        <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={3} lineDashPattern={[8, 6]} />
      </>
    );
  }

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={darkenColor(color, 0.3)}
        strokeWidth={8}
        lineCap="round"
        lineJoin="round"
      />
      <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={5} lineCap="round" lineJoin="round" />
    </>
  );
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
