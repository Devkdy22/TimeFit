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

export const appTypography = {
  screenTitle: { fontSize: 24, fontWeight: '700' as const },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const },
  cardTitle: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const appSpacing = {
  screenX: 24,
  sectionGap: 24,
  cardPadding: 20,
  radiusXL: 28,
  radiusLG: 22,
  radiusMD: 16,
} as const;
