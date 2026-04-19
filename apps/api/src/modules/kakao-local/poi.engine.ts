export type PoiCandidate = {
  name: string;
  lat: number;
  lng: number;
  distance: number;
  category?: string;
  source: 'category' | 'keyword' | 'address';
  score: number;
};

function clamp01(value: number) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function computeDistanceScore(distance: number) {
  if (!Number.isFinite(distance)) {
    return 0.2;
  }
  if (distance <= 30) {
    return 1.0;
  }
  if (distance <= 100) {
    return 0.8;
  }
  if (distance <= 200) {
    return 0.5;
  }
  return 0.2;
}

export function computeCategoryScore(category?: string) {
  const normalized = (category ?? '').toUpperCase();
  if (normalized === 'FD6' || normalized === 'CE7') {
    return 1.0;
  }
  if (normalized === 'AT4' || normalized === 'OL7' || normalized === 'SW8' || normalized === 'BUILDING_NAME') {
    return 0.8;
  }
  return 0.5;
}

export function computeNameQualityScore(candidate: Pick<PoiCandidate, 'name' | 'source' | 'category'>) {
  const name = candidate.name.trim();
  if (!name) {
    return 0;
  }

  if (candidate.source === 'address') {
    return candidate.category === 'BUILDING_NAME' ? 0.8 : 0.3;
  }

  return 1.0;
}

export function scoreCandidate(candidate: Omit<PoiCandidate, 'score'>): PoiCandidate {
  const distanceScore = computeDistanceScore(candidate.distance);
  const categoryScore = computeCategoryScore(candidate.category);
  const nameQualityScore = computeNameQualityScore(candidate);

  const score = clamp01(distanceScore * 0.5 + categoryScore * 0.3 + nameQualityScore * 0.2);
  return { ...candidate, score };
}

export function normalizeCandidates(candidates: Array<Omit<PoiCandidate, 'score'>>): PoiCandidate[] {
  return candidates
    .filter((candidate) => candidate.name.trim().length > 0)
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance <= 300)
    .map((candidate) => scoreCandidate(candidate))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
}

