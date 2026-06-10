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
  aliases?: string[];
  lat: number;
  lng: number;
};

export type LineBranch = {
  branchId: string;
  stations: LineStation[];
  railPolyline: MapCoordinate[];
};

export type LineData = {
  lineName: string;
  branches: LineBranch[];
};

const STATION_ID_ALIAS_MAP: Record<string, string> = {
  '211': '강남',
  '222': '역삼',
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

function normalizeStationName(value?: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[1-9]\d*호선/g, '')
    .replace(/역/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

function resolveLineData(lineLabel: string): LineData | null {
  if (LINE_MAP[lineLabel]) return LINE_MAP[lineLabel];
  const normalized = normalizeLineLabel(lineLabel);
  if (!normalized) return null;
  for (const [key, value] of Object.entries(LINE_MAP)) {
    if (normalizeLineLabel(key) === normalized) return value;
  }
  for (const [key, value] of Object.entries(LINE_MAP)) {
    const normalizedKey = normalizeLineLabel(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) return value;
  }
  return null;
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
  for (let i = 1; i < points.length; i += 1) total += toMeters(points[i - 1], points[i]);
  return total;
}

function findNearestRailIndex(polyline: MapCoordinate[], target: MapCoordinate) {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length; i += 1) {
    const d = toMeters(polyline[i], target);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function dedupePolyline(points: MapCoordinate[]) {
  if (points.length < 2) return points;
  const out: MapCoordinate[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const next = points[i];
    if (Math.abs(prev.lat - next.lat) > 1e-8 || Math.abs(prev.lng - next.lng) > 1e-8) out.push(next);
  }
  return out;
}

function stationMatches(station: LineStation, target?: string) {
  if (!target) return false;
  const normalizedTarget = normalizeStationName(STATION_ID_ALIAS_MAP[target] ?? target);
  if (!normalizedTarget) return false;
  const names = [station.name, ...(station.aliases ?? []), STATION_ID_ALIAS_MAP[station.id] ?? ''];
  return names.some((n) => normalizeStationName(n) === normalizedTarget);
}

type StationResolution = {
  station: LineStation | null;
  matchedBy: 'name' | 'coord' | 'none';
};

function resolveStation(branch: LineBranch, targetName?: string, fallbackCoordinate?: MapCoordinate): StationResolution {
  const byName = branch.stations.find((s) => stationMatches(s, targetName)) ?? null;
  if (byName) return { station: byName, matchedBy: 'name' };
  if (!fallbackCoordinate || branch.stations.length === 0) return { station: null, matchedBy: 'none' };
  let best = branch.stations[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const st of branch.stations) {
    const d = toMeters(fallbackCoordinate, { lat: st.lat, lng: st.lng });
    if (d < bestDist) {
      bestDist = d;
      best = st;
    }
  }
  return { station: best, matchedBy: 'coord' };
}

function buildSlice(branch: LineBranch, start: MapCoordinate, end: MapCoordinate) {
  if (branch.railPolyline.length < 2) return null;
  const startIdx = findNearestRailIndex(branch.railPolyline, start);
  const endIdx = findNearestRailIndex(branch.railPolyline, end);
  const sliced =
    startIdx <= endIdx
      ? branch.railPolyline.slice(startIdx, endIdx + 1)
      : branch.railPolyline.slice(endIdx, startIdx + 1).reverse();
  if (sliced.length < 2) return null;
  return { sliced, startIdx, endIdx, length: polylineLengthMeters(sliced) };
}

function debugLog(payload: Record<string, unknown>) {
  console.info('[SubwayGeometry][sliceSubwayLine]', payload);
}

export function sliceSubwayLine(
  lineLabel: string,
  startStationName?: string,
  endStationName?: string,
  startCoordinate?: MapCoordinate,
  endCoordinate?: MapCoordinate,
): MapCoordinate[] {
  const data = resolveLineData(lineLabel);
  if (!data || data.branches.length === 0) return [];

  const branches = data.branches.filter((b) => b.railPolyline.length >= 2);
  if (branches.length === 0) return [];

  type Candidate = {
    branch: LineBranch;
    reason: 'A' | 'B' | 'C' | 'D';
    slice: MapCoordinate[];
    startIdx: number;
    endIdx: number;
    length: number;
  };
  const candidates: Candidate[] = [];

  for (const branch of branches) {
    const startResolved = resolveStation(branch, startStationName, startCoordinate);
    const endResolved = resolveStation(branch, endStationName, endCoordinate);
    const startStation = startResolved.station;
    const endStation = endResolved.station;
    const hasStartByName = startResolved.matchedBy === 'name';
    const hasEndByName = endResolved.matchedBy === 'name';
    const hasAnyByName = hasStartByName || hasEndByName;

    if (hasStartByName && hasEndByName) {
      const start = startCoordinate ?? { lat: startStation!.lat, lng: startStation!.lng };
      const end = endCoordinate ?? { lat: endStation!.lat, lng: endStation!.lng };
      const sliced = buildSlice(branch, start, end);
      if (sliced) candidates.push({ branch, reason: 'A', slice: sliced.sliced, startIdx: sliced.startIdx, endIdx: sliced.endIdx, length: sliced.length });
      continue;
    }

    if (hasAnyByName && startStation && endStation) {
      const start = startCoordinate ?? { lat: startStation.lat, lng: startStation.lng };
      const end = endCoordinate ?? { lat: endStation.lat, lng: endStation.lng };
      if (start && end) {
        const sliced = buildSlice(branch, start, end);
        if (sliced) candidates.push({ branch, reason: 'B', slice: sliced.sliced, startIdx: sliced.startIdx, endIdx: sliced.endIdx, length: sliced.length });
      }
      continue;
    }

    if (startCoordinate && endCoordinate) {
      const sliced = buildSlice(branch, startCoordinate, endCoordinate);
      if (sliced) candidates.push({ branch, reason: 'C', slice: sliced.sliced, startIdx: sliced.startIdx, endIdx: sliced.endIdx, length: sliced.length });
    }
  }

  candidates.sort((a, b) => {
    const priority = { A: 0, B: 1, C: 2, D: 3 };
    if (priority[a.reason] !== priority[b.reason]) return priority[a.reason] - priority[b.reason];
    if (a.reason === 'A' && b.reason === 'A') {
      const shorter = Math.min(a.length, b.length);
      const longer = Math.max(a.length, b.length);
      // 동일 A 후보 길이가 거의 같으면(<=8%) 디테일이 높은 polyline(점 밀도)이 우선.
      if (shorter > 0 && (longer - shorter) / shorter <= 0.08) {
        const aDensity = a.slice.length / Math.max(1, a.length);
        const bDensity = b.slice.length / Math.max(1, b.length);
        if (Math.abs(aDensity - bDensity) > 1e-6) return bDensity - aDensity;
      }
    }
    return a.length - b.length;
  });

  const best = candidates[0];
  if (best) {
    const out = dedupePolyline(best.slice);
    debugLog({
      lineLabel,
      resolvedLine: data.lineName,
      resolvedBranch: best.branch.branchId,
      startStation: startStationName,
      endStation: endStationName,
      startRailIndex: best.startIdx,
      endRailIndex: best.endIdx,
      polylineLength: best.branch.railPolyline.length,
      sliceLength: out.length,
      fallbackReason: best.reason,
    });
    return out;
  }

  const directStart = startCoordinate ?? branches[0].railPolyline[0];
  const directEnd = endCoordinate ?? branches[0].railPolyline[branches[0].railPolyline.length - 1];
  const direct = dedupePolyline([directStart, directEnd]);
  debugLog({
    lineLabel,
    resolvedLine: data.lineName,
    resolvedBranch: null,
    startStation: startStationName,
    endStation: endStationName,
    startRailIndex: null,
    endRailIndex: null,
    polylineLength: 2,
    sliceLength: direct.length,
    fallbackReason: 'D',
  });
  return direct;
}
