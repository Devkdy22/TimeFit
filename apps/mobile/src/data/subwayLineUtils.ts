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

export type LineStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type LineData = {
  line?: string;
  aliases?: string[];
  stations?: LineStation[];
  features?: Array<{
    id?: string;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
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

export const LINE_MAP: Record<string, LineData> = {
  '1': RAW_LINE_MAP['1'],
  '1호선': RAW_LINE_MAP['1'],
  '수도권 1호선': RAW_LINE_MAP['1'],
  '수도권1호선': RAW_LINE_MAP['1'],
  '2': RAW_LINE_MAP['2'],
  '2호선': RAW_LINE_MAP['2'],
  '수도권 2호선': RAW_LINE_MAP['2'],
  '수도권2호선': RAW_LINE_MAP['2'],
  '3': RAW_LINE_MAP['3'],
  '3호선': RAW_LINE_MAP['3'],
  '수도권 3호선': RAW_LINE_MAP['3'],
  '수도권3호선': RAW_LINE_MAP['3'],
  '4': RAW_LINE_MAP['4'],
  '4호선': RAW_LINE_MAP['4'],
  '수도권 4호선': RAW_LINE_MAP['4'],
  '수도권4호선': RAW_LINE_MAP['4'],
  '5': RAW_LINE_MAP['5'],
  '5호선': RAW_LINE_MAP['5'],
  '수도권 5호선': RAW_LINE_MAP['5'],
  '수도권5호선': RAW_LINE_MAP['5'],
  '7': RAW_LINE_MAP['7'],
  '7호선': RAW_LINE_MAP['7'],
  '수도권 7호선': RAW_LINE_MAP['7'],
  '수도권7호선': RAW_LINE_MAP['7'],
  '9': RAW_LINE_MAP['9'],
  '9호선': RAW_LINE_MAP['9'],
  '수도권 9호선': RAW_LINE_MAP['9'],
  '수도권9호선': RAW_LINE_MAP['9'],
  분당선: RAW_LINE_MAP.bundang,
  수인분당선: RAW_LINE_MAP.bundang,
  '수인·분당선': RAW_LINE_MAP.bundang,
  '수도권 분당선': RAW_LINE_MAP.bundang,
  신분당선: RAW_LINE_MAP.shinbundang,
  '수도권 신분당선': RAW_LINE_MAP.shinbundang,
};

function normalizeLineLabel(value?: string) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function resolveLineData(lineLabel: string): LineData | null {
  if (LINE_MAP[lineLabel]) {
    return LINE_MAP[lineLabel];
  }
  const normalized = normalizeLineLabel(lineLabel);
  if (!normalized) {
    return null;
  }
  for (const [key, value] of Object.entries(LINE_MAP)) {
    if (normalizeLineLabel(key) === normalized) {
      return value;
    }
  }
  for (const [key, value] of Object.entries(LINE_MAP)) {
    const normalizedKey = normalizeLineLabel(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return value;
    }
  }
  return null;
}

function toCoordinate(entry: unknown): MapCoordinate | null {
  if (!Array.isArray(entry) || entry.length < 2) return null;
  const lng = Number(entry[0]);
  const lat = Number(entry[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toMeters(a: MapCoordinate, b: MapCoordinate) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function polylineLengthMeters(points: MapCoordinate[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += toMeters(points[i - 1], points[i]);
  }
  return total;
}

function flattenFeatureCoordinates(line: LineData): MapCoordinate[] {
  const points: MapCoordinate[] = [];
  for (const feature of line.features ?? []) {
    const geom = feature.geometry;
    if (!geom?.coordinates) continue;
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      for (const entry of geom.coordinates) {
        const coordinate = toCoordinate(entry);
        if (coordinate) points.push(coordinate);
      }
      continue;
    }
    if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      for (const lineCoords of geom.coordinates) {
        if (!Array.isArray(lineCoords)) continue;
        for (const entry of lineCoords) {
          const coordinate = toCoordinate(entry);
          if (coordinate) points.push(coordinate);
        }
      }
    }
  }
  return points.filter((point, index, arr) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    return Math.abs(prev.lat - point.lat) > 0.000001 || Math.abs(prev.lng - point.lng) > 0.000001;
  });
}

function normalizeName(value?: string) {
  return String(value ?? '').replace(/\s+/g, '').replace(/역$/, '').trim();
}

function findNearestIndex(polyline: MapCoordinate[], target: MapCoordinate) {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length; i += 1) {
    const p = polyline[i];
    const d = (p.lat - target.lat) ** 2 + (p.lng - target.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function projectPointToSegment(point: MapCoordinate, a: MapCoordinate, b: MapCoordinate) {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = point.lng;
  const py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= 0) {
    return { point: a, t: 0, distance2: (px - ax) * (px - ax) + (py - ay) * (py - ay) };
  }

  const apx = px - ax;
  const apy = py - ay;
  const rawT = (apx * abx + apy * aby) / ab2;
  const t = Math.max(0, Math.min(1, rawT));
  const proj = {
    lng: ax + abx * t,
    lat: ay + aby * t,
  };
  const dx = px - proj.lng;
  const dy = py - proj.lat;
  return { point: proj, t, distance2: dx * dx + dy * dy };
}

function findNearestProjectionOnPolyline(polyline: MapCoordinate[], target: MapCoordinate) {
  if (polyline.length < 2) {
    return {
      segmentIndex: 0,
      projected: polyline[0] ?? target,
      distance2: Number.POSITIVE_INFINITY,
    };
  }

  let best = {
    segmentIndex: 0,
    projected: polyline[0],
    distance2: Number.POSITIVE_INFINITY,
  };
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const projected = projectPointToSegment(target, polyline[i], polyline[i + 1]);
    if (projected.distance2 < best.distance2) {
      best = {
        segmentIndex: i,
        projected: projected.point,
        distance2: projected.distance2,
      };
    }
  }
  return best;
}

function slicePolylineByProjection(polyline: MapCoordinate[], start: MapCoordinate, end: MapCoordinate) {
  if (polyline.length < 2) {
    return polyline;
  }

  const startProj = findNearestProjectionOnPolyline(polyline, start);
  const endProj = findNearestProjectionOnPolyline(polyline, end);

  if (startProj.segmentIndex <= endProj.segmentIndex) {
    const middle = polyline.slice(startProj.segmentIndex + 1, endProj.segmentIndex + 1);
    return [startProj.projected, ...middle, endProj.projected];
  }

  const middle = polyline.slice(endProj.segmentIndex + 1, startProj.segmentIndex + 1).reverse();
  return [startProj.projected, ...middle, endProj.projected];
}

function featureLineStrings(line: LineData): MapCoordinate[][] {
  const lines: MapCoordinate[][] = [];
  for (const feature of line.features ?? []) {
    const geom = feature.geometry;
    if (!geom?.coordinates) continue;
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      const lineCoords = geom.coordinates
        .map((entry) => toCoordinate(entry))
        .filter((value): value is MapCoordinate => Boolean(value));
      if (lineCoords.length >= 2) lines.push(lineCoords);
      continue;
    }
    if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      for (const part of geom.coordinates) {
        if (!Array.isArray(part)) continue;
        const lineCoords = part
          .map((entry) => toCoordinate(entry))
          .filter((value): value is MapCoordinate => Boolean(value));
        if (lineCoords.length >= 2) lines.push(lineCoords);
      }
    }
  }
  return lines;
}

function chooseBestLineForPair(lines: MapCoordinate[][], start: MapCoordinate, end: MapCoordinate) {
  let best: MapCoordinate[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const crow = toMeters(start, end);

  for (const line of lines) {
    if (line.length < 2) continue;
    const startSnap = findNearestProjectionOnPolyline(line, start);
    const endSnap = findNearestProjectionOnPolyline(line, end);
    const sliced = slicePolylineByProjection(line, start, end);
    if (sliced.length < 2) continue;
    const pathMeters = polylineLengthMeters(sliced);
    if (pathMeters < Math.max(200, crow * 0.85)) continue;
    const score =
      Math.sqrt(startSnap.distance2) +
      Math.sqrt(endSnap.distance2) +
      Math.abs(pathMeters - crow * 1.15) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      best = sliced;
    }
  }

  return best;
}

function mergePolylineChunks(chunks: MapCoordinate[][]) {
  const merged: MapCoordinate[] = [];
  for (const chunk of chunks) {
    for (const point of chunk) {
      const prev = merged[merged.length - 1];
      if (!prev) {
        merged.push(point);
        continue;
      }
      if (Math.abs(prev.lat - point.lat) > 0.000001 || Math.abs(prev.lng - point.lng) > 0.000001) {
        merged.push(point);
      }
    }
  }
  return merged;
}

export function sliceSubwayLine(
  lineLabel: string,
  startStationName?: string,
  endStationName?: string,
  startCoordinate?: MapCoordinate,
  endCoordinate?: MapCoordinate,
): MapCoordinate[] {
  const data = resolveLineData(lineLabel);
  if (!data) return [];
  const allPolyline = flattenFeatureCoordinates(data);
  if (allPolyline.length < 2) return [];

  const stations = (data.stations ?? []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const startStation = stations.find((s) => normalizeName(s.name) === normalizeName(startStationName));
  const endStation = stations.find((s) => normalizeName(s.name) === normalizeName(endStationName));

  if ((!startStation || !endStation) && (!startCoordinate || !endCoordinate)) {
    return allPolyline;
  }

  const start = startCoordinate ?? { lat: startStation!.lat, lng: startStation!.lng };
  const end = endCoordinate ?? { lat: endStation!.lat, lng: endStation!.lng };
  const crowMeters = toMeters(start, end);
  const lines = featureLineStrings(data);

  // 1) 역 순서 기반 구간 분할 슬라이스 (가장 실제 호선 형태에 근접)
  if (startStation && endStation && lines.length > 0) {
    const startIdx = stations.findIndex((s) => normalizeName(s.name) === normalizeName(startStation.name));
    const endIdx = stations.findIndex((s) => normalizeName(s.name) === normalizeName(endStation.name));
    if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
      const stationPath =
        startIdx < endIdx ? stations.slice(startIdx, endIdx + 1) : stations.slice(endIdx, startIdx + 1).reverse();
      const chunks: MapCoordinate[][] = [];
      for (let i = 0; i < stationPath.length - 1; i += 1) {
        const a = { lat: stationPath[i].lat, lng: stationPath[i].lng };
        const b = { lat: stationPath[i + 1].lat, lng: stationPath[i + 1].lng };
        const bestPair = chooseBestLineForPair(lines, a, b);
        if (bestPair && bestPair.length >= 2) {
          chunks.push(bestPair);
        }
      }
      const mergedByStations = mergePolylineChunks(chunks);
      if (mergedByStations.length >= 8) {
        return mergedByStations;
      }
    }
  }

  let bestSlice: MapCoordinate[] = [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const startSnapInfo = findNearestProjectionOnPolyline(line, start);
    const endSnapInfo = findNearestProjectionOnPolyline(line, end);
    const startSnap = startSnapInfo.projected;
    const endSnap = endSnapInfo.projected;
    const startSnapMeters = toMeters(startSnap, start);
    const endSnapMeters = toMeters(endSnap, end);
    const sliced = slicePolylineByProjection(line, start, end);
    if (sliced.length < 2) continue;
    const pathMeters = polylineLengthMeters(sliced);
    if (pathMeters < Math.max(crowMeters * 0.9, 500)) {
      continue;
    }
    const score = startSnapMeters + endSnapMeters + Math.max(0, 80 - sliced.length) - Math.min(pathMeters, 30000) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      bestSlice = sliced;
    }
  }

  if (bestSlice.length >= 8) {
    return bestSlice;
  }

  const startIdx = findNearestIndex(allPolyline, start);
  const endIdx = findNearestIndex(allPolyline, end);
  const fallbackSlice =
    startIdx <= endIdx
      ? allPolyline.slice(startIdx, endIdx + 1)
      : allPolyline.slice(endIdx, startIdx + 1).reverse();
  return fallbackSlice.length >= 2 ? fallbackSlice : allPolyline;
}
