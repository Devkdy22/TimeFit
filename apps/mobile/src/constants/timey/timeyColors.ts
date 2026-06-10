import type { TimeyState } from '../../types/timey.types';

export type TimeyPaletteToken = {
  primary: string;
  deep: string;
  glow: string;
};

export const timeyPalette: Record<TimeyState, TimeyPaletteToken> = {
  idle: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.22)' },
  searching: { primary: '#6366F1', deep: '#4F46E5', glow: 'rgba(99, 102, 241, 0.18)' },
  confident: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.26)' },
  waiting: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.20)' },
  walking: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.20)' },
  riding_bus: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.20)' },
  riding_subway: { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.20)' },
  transfer: { primary: '#F59E0B', deep: '#D97706', glow: 'rgba(245, 158, 11, 0.24)' },
  warning: { primary: '#F59E0B', deep: '#D97706', glow: 'rgba(245, 158, 11, 0.24)' },
  urgent: { primary: '#EF4444', deep: '#DC2626', glow: 'rgba(239, 68, 68, 0.26)' },
  panic: { primary: '#EF4444', deep: '#DC2626', glow: 'rgba(239, 68, 68, 0.30)' },
  offroute: { primary: '#EF4444', deep: '#DC2626', glow: 'rgba(239, 68, 68, 0.30)' },
  rerouting: { primary: '#6366F1', deep: '#4F46E5', glow: 'rgba(99, 102, 241, 0.18)' },
  success: { primary: '#2BB673', deep: '#16A34A', glow: 'rgba(43, 182, 115, 0.22)' },
  late: { primary: '#EF4444', deep: '#DC2626', glow: 'rgba(239, 68, 68, 0.30)' },
};
