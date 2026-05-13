const STOP_WORDS = ['역', '정류장', '중앙차로', '(중)', '.', ','];

export function normalizeStationName(raw: string | undefined): string {
  if (!raw) {
    return '';
  }

  let normalized = raw.trim();
  for (const token of STOP_WORDS) {
    normalized = normalized.split(token).join('');
  }

  return normalized.replace(/\s+/g, '').toLowerCase();
}

