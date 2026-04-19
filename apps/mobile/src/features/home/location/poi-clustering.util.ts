import type { LocationInfo } from '../../../services/api/client';
import { getNormalizedPoiNameFromCache, setNormalizedPoiNameCache } from './cache.util';

export type PoiClusterResult = {
  clusterName: string | null;
  candidateCount: number;
};

function normalizePoiName(rawName: string) {
  const cached = getNormalizedPoiNameFromCache(rawName);
  if (cached) {
    return cached;
  }

  const normalized = rawName
    .replace(/\b\d{1,3}동\b/g, '')
    .replace(/(상가|입구|후문|정문|관리사무소|주차장)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  setNormalizedPoiNameCache(rawName, normalized);
  return normalized;
}

function extractComplexName(name: string) {
  const normalized = normalizePoiName(name);
  const match = normalized.match(/([^\s]+(?:아파트|자이|푸르지오|래미안|아이파크|힐스테이트))/);
  if (match?.[1]) {
    return match[1];
  }
  return normalized;
}

export function resolveApartmentClusterFromCandidates(
  candidates: NonNullable<LocationInfo['candidates']>,
): PoiClusterResult {
  const groups = new Map<string, { count: number; totalDistance: number }>();

  for (const candidate of candidates) {
    const rawName = candidate.name?.trim();
    if (!rawName) {
      continue;
    }
    const key = extractComplexName(rawName);
    if (!key) {
      continue;
    }

    const prev = groups.get(key) ?? { count: 0, totalDistance: 0 };
    groups.set(key, {
      count: prev.count + 1,
      totalDistance: prev.totalDistance + (Number.isFinite(candidate.distance) ? candidate.distance : 9999),
    });
  }

  let selected: { name: string; count: number; avgDistance: number } | null = null;
  for (const [name, info] of groups.entries()) {
    const avgDistance = info.totalDistance / info.count;
    if (!selected) {
      selected = { name, count: info.count, avgDistance };
      continue;
    }
    if (info.count > selected.count) {
      selected = { name, count: info.count, avgDistance };
      continue;
    }
    if (info.count === selected.count && avgDistance < selected.avgDistance) {
      selected = { name, count: info.count, avgDistance };
    }
  }

  return {
    clusterName: selected?.name ?? null,
    candidateCount: candidates.length,
  };
}

