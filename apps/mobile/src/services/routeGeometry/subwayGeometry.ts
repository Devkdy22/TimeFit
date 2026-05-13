import { subwayColors, subwayLineGeometry } from '../../data/subwayLineGeometry';
import { logGeometry } from './logger';
import { RouteSegment, SegmentGeometry } from './types';

function normalizeStationName(value?: string) {
  if (!value) return '';
  return value.replace(/\s+/g, '').replace(/역$/, '').trim();
}

function resolveLineName(raw?: string) {
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, '');
  if (subwayLineGeometry[normalized]) return normalized;
  const exact = Object.keys(subwayLineGeometry).find((name) => normalizeStationName(name) === normalizeStationName(raw));
  if (exact) return exact;
  const partial = Object.keys(subwayLineGeometry).find(
    (name) =>
      normalized.includes(name.replace(/\s+/g, '')) ||
      name.replace(/\s+/g, '').includes(normalized),
  );
  return partial ?? null;
}

export function resolveSubwayGeometry(segment: RouteSegment): SegmentGeometry {
  const lineName = resolveLineName(segment.subwayLineName);
  const color = (lineName ? subwayColors[lineName] : undefined) ?? segment.subwayLineColor ?? '#9E9E9E';

  if (!lineName) {
    console.warn('[RouteGeometry][SUBWAY][NO_LINE_DATA]', segment.subwayLineName ?? null);
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      segmentId: segment.segmentId,
      mode: 'SUBWAY',
      coordinates: [],
      source: 'fallback-two-points',
      pointCount: 0,
      color,
      isDashed: false,
    };
  }

  const stations = subwayLineGeometry[lineName] ?? [];
  if (stations.length === 0) {
    console.warn('[RouteGeometry][SUBWAY][NO_LINE_DATA]', lineName);
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      segmentId: segment.segmentId,
      mode: 'SUBWAY',
      coordinates: [],
      source: 'fallback-two-points',
      pointCount: 0,
      color,
      isDashed: false,
    };
  }

  const startName = normalizeStationName(segment.startStationName);
  const endName = normalizeStationName(segment.endStationName);
  const startIndex = stations.findIndex((station) => normalizeStationName(station.name) === startName);
  const endIndex = stations.findIndex((station) => normalizeStationName(station.name) === endName);

  if (startIndex === -1 || endIndex === -1) {
    console.warn('[RouteGeometry][SUBWAY][STATION_NOT_FOUND]', {
      lineName,
      start: segment.startStationName,
      end: segment.endStationName,
    });
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      segmentId: segment.segmentId,
      mode: 'SUBWAY',
      coordinates: [],
      source: 'fallback-two-points',
      pointCount: 0,
      color,
      isDashed: false,
    };
  }

  const sliced =
    startIndex < endIndex
      ? stations.slice(startIndex, endIndex + 1)
      : stations.slice(endIndex, startIndex + 1).reverse();

  const coordinates = sliced.map((station) => ({
    latitude: station.lat,
    longitude: station.lng,
  }));

  console.log('[RouteGeometry][SUBWAY]', {
    lineName,
    start: segment.startStationName,
    end: segment.endStationName,
    pointCount: coordinates.length,
  });

  logGeometry({
    mode: 'SUBWAY',
    source: 'subway-geojson',
    pointCount: coordinates.length,
    segmentId: segment.segmentId,
  });

  return {
    segmentId: segment.segmentId,
    mode: 'SUBWAY',
    coordinates,
    source: 'subway-geojson',
    pointCount: coordinates.length,
    color,
    isDashed: false,
  };
}
