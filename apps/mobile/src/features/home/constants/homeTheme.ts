import { Platform } from 'react-native';

export const colors = {
  primary: '#14B8A6',
  primaryDark: '#0F766E',
  primaryPressed: '#0D9488',
  primarySoft: '#CCFBF1',
  primarySurface: '#ECFEFF',
  background: '#F6FFFE',
  backgroundTop: '#E6FFFB',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  border: '#E2E8F0',
  borderSoft: 'rgba(15, 23, 42, 0.08)',
  borderMint: 'rgba(20, 184, 166, 0.18)',
  tabActive: '#14B8A6',
  tabInactive: '#64748B',
  tabSurface: 'rgba(255, 255, 255, 0.88)',
  tabBorder: 'rgba(88, 199, 194, 0.14)',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

export const typography = {
  heroEyebrow: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800' as const,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
  },
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.07,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  soft: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  tab: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
} as const;

export const layout = {
  tabBarHeight: 66,
  tabFloatingOffset: 6,
} as const;

// Backward-compatible aliases for existing home components.
export const homeColors = colors;
export const homeLayout = {
  horizontal: spacing.xl,
  sectionGap: spacing.xxl,
  cardRadius: radius.xl,
  smallCardRadius: radius.lg,
  ctaRadius: radius.lg,
  bottomTabHeight: 90,
} as const;
export const homeShadow = shadows.card;
