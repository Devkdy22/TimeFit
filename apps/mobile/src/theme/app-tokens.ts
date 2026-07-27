export const appColors = {
  primary: '#4CC7C1',
  primaryDark: '#26AAA4',
  primaryLight: '#E8FAF8',
  textPrimary: '#102B2B',
  textSecondary: '#6E8585',
  textMuted: '#9BAAAA',
  background: '#F6FAFA',
  card: '#FFFFFF',
  border: '#E5EEEE',
  warning: '#F5A623',
  danger: '#EF5B5B',
  success: '#4CC7C1',
} as const;

import { typographyPresets } from './typography';

// Backward-compatible aliases for older app components. New screens should use
// the semantic roles in theme.typography directly.
export const appTypography = {
  screenTitle: typographyPresets.screenTitle,
  sectionTitle: typographyPresets.sectionTitle,
  cardTitle: typographyPresets.cardTitle,
  body: typographyPresets.body.md,
  caption: typographyPresets.caption.md,
  small: typographyPresets.helper,
} as const;

export const appSpacing = {
  screenX: 24,
  sectionGap: 24,
  cardPadding: 20,
  radiusXL: 28,
  radiusLG: 22,
  radiusMD: 16,
} as const;
