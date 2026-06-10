import type { BusProviderType } from '../realtime-bus.types';

type ProviderOverride = {
  stationId?: string;
  routeId?: string;
  routeName?: string;
};

type OverrideSet = Partial<Record<BusProviderType, ProviderOverride>>;

const OVERRIDES: Record<string, OverrideSet> = {
  // lineLabel=30, startStationId=177326
  '30:177326': {
    INCHEON: {
      stationId: '177326',
      routeId: '227000003',
      routeName: '30',
    },
    SEOUL: {
      routeId: '227000003',
      routeName: '30',
    },
  },
  // lineLabel=140, startStationId=106171
  '140:106171': {
    INCHEON: {
      stationId: '106171',
      routeId: '100100019',
      routeName: '140',
    },
    SEOUL: {
      routeId: '100100019',
      routeName: '140',
    },
  },
};

function normalizeLineLabel(lineLabel?: string): string {
  return String(lineLabel ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/(번|버스)$/g, '')
    .toUpperCase();
}

function normalizeStationId(stationId?: string): string {
  return String(stationId ?? '').trim();
}

export function resolveProviderOverride(
  lineLabel?: string,
  startStationId?: string,
): OverrideSet | null {
  const key = `${normalizeLineLabel(lineLabel)}:${normalizeStationId(startStationId)}`;
  return OVERRIDES[key] ?? null;
}
