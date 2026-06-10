import type { MapCoordinate } from '../features/map/types';

import line1 from '../../assets/subway-lines/line-1.json';
import line2 from '../../assets/subway-lines/line-2.json';
import line3 from '../../assets/subway-lines/line-3.json';
import line4 from '../../assets/subway-lines/line-4.json';
import line5 from '../../assets/subway-lines/line-5.json';
import line7 from '../../assets/subway-lines/line-7.json';
import line9 from '../../assets/subway-lines/line-9.json';
import bundang from '../../assets/subway-lines/line-bundang.json';
import shinbundang from '../../assets/subway-lines/line-shinbundang.json';

type LineStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type LineBranch = {
  branchId: string;
  stations: LineStation[];
  railPolyline: MapCoordinate[];
};

type LineData = {
  lineName: string;
  branches: LineBranch[];
};

export type StationAnchor = {
  stationId: string;
  name: string;
  coordIndex: number;
};

export type LineGeometry = {
  lineId: string;
  coordinates: [number, number][];
  stations: StationAnchor[];
};

const RAW_LINE_MAP: Record<string, LineData> = {
  '1': line1 as LineData,
  '2': line2 as LineData,
  '3': line3 as LineData,
  '4': line4 as LineData,
  '5': line5 as LineData,
  '7': line7 as LineData,
  '9': line9 as LineData,
  bundang: bundang as LineData,
  shinbundang: shinbundang as LineData,
};

const cache = new Map<string, LineGeometry>();
let preloadPromise: Promise<void> | null = null;

function normalizeLineId(lineId: string): string {
  return lineId.replace(/\s+/g, '').replace(/^수도권/, '').toLowerCase();
}

function normalizeStationName(name?: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/역/g, '')
    .toLowerCase();
}

function toCoordinates(polyline: MapCoordinate[]): [number, number][] {
  return polyline
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => [p.lat, p.lng] as [number, number]);
}

function findNearestCoordIndex(coords: [number, number][], target: { lat: number; lng: number }): number {
  let bestIndex = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i += 1) {
    const point = coords[i];
    const dLat = point[0] - target.lat;
    const dLng = point[1] - target.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildGeometry(lineId: string, data: LineData): LineGeometry | null {
  const primaryBranch = data.branches.find((b) => b.railPolyline.length >= 2) ?? data.branches[0];
  if (!primaryBranch || primaryBranch.railPolyline.length < 2) {
    return null;
  }
  const coordinates = toCoordinates(primaryBranch.railPolyline);
  if (coordinates.length < 2) {
    return null;
  }

  const stations: StationAnchor[] = primaryBranch.stations.map((station) => ({
    stationId: station.id,
    name: station.name,
    coordIndex: findNearestCoordIndex(coordinates, { lat: station.lat, lng: station.lng }),
  }));

  return {
    lineId,
    coordinates,
    stations,
  };
}

function createLineAliases(lineId: string, lineName: string): string[] {
  const id = lineId;
  if (id === 'bundang') {
    return ['bundang', '분당선', '수인분당선', '수인·분당선', '수도권분당선', '수도권수인분당선'];
  }
  if (id === 'shinbundang') {
    return ['shinbundang', '신분당선', '수도권신분당선'];
  }
  return [id, `${id}호선`, `수도권${id}호선`, lineName];
}

export async function preloadSubwayLines(): Promise<void> {
  if (cache.size > 0) {
    return;
  }
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = Promise.all(
    Object.entries(RAW_LINE_MAP).map(async ([lineId, lineData]) => {
      const geometry = buildGeometry(lineId, lineData);
      if (!geometry) {
        return;
      }
      const aliases = createLineAliases(lineId, lineData.lineName);
      aliases.forEach((alias) => {
        cache.set(normalizeLineId(alias), geometry);
      });
    }),
  )
    .then(() => undefined)
    .catch((error) => {
      console.warn('[SubwayLineCache] preload failed', { error });
    })
    .finally(() => {
      preloadPromise = null;
    });

  return preloadPromise;
}

export function getSubwayLineGeometry(lineId: string): LineGeometry | null {
  if (!lineId) {
    return null;
  }
  return cache.get(normalizeLineId(lineId)) ?? null;
}

export function sliceSubwayGeometry(
  lineId: string,
  startStationId: string,
  endStationId: string,
  isBranchAware = false,
): [number, number][] | null {
  try {
    void isBranchAware;
    const geometry = getSubwayLineGeometry(lineId);
    if (!geometry || geometry.coordinates.length < 2) {
      return null;
    }

    const startToken = normalizeStationName(startStationId);
    const endToken = normalizeStationName(endStationId);
    const startAnchor = geometry.stations.find(
      (station) =>
        normalizeStationName(station.stationId) === startToken ||
        normalizeStationName(station.name) === startToken,
    );
    const endAnchor = geometry.stations.find(
      (station) =>
        normalizeStationName(station.stationId) === endToken ||
        normalizeStationName(station.name) === endToken,
    );
    if (!startAnchor || !endAnchor) {
      return null;
    }

    const startIdx = startAnchor.coordIndex;
    const endIdx = endAnchor.coordIndex;
    const sliced =
      startIdx <= endIdx
        ? geometry.coordinates.slice(startIdx, endIdx + 1)
        : geometry.coordinates.slice(endIdx, startIdx + 1).reverse();

    return sliced.length >= 2 ? sliced : null;
  } catch {
    return null;
  }
}
