import { Platform } from 'react-native';

export const settingsTokens = {
  colors: {
    background: '#F7FAFA',
    card: '#FFFFFF',
    border: '#E6EEEE',
    textPrimary: '#102B2B',
    textSecondary: '#6E8585',
    textMuted: '#9BAAAA',
    primary: '#4CC7C1',
    primarySoft: '#E8FAF8',
    danger: '#E45858',
  },
  spacing: {
    screenX: 24,
    sectionGap: 24,
    rowGap: 12,
    cardPadding: 18,
  },
  radius: {
    xl: 24,
    lg: 20,
    md: 16,
  },
  typography: {
    screenTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      fontFamily: Platform.select({ web: 'Pretendard-SemiBold, sans-serif', default: 'Pretendard-SemiBold' }),
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700' as const,
      fontFamily: Platform.select({ web: 'Pretendard-SemiBold, sans-serif', default: 'Pretendard-SemiBold' }),
    },
    rowTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600' as const,
      fontFamily: Platform.select({ web: 'Pretendard-SemiBold, sans-serif', default: 'Pretendard-SemiBold' }),
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
      fontFamily: Platform.select({ web: 'Pretendard-Medium, sans-serif', default: 'Pretendard-Medium' }),
    },
    caption: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '400' as const,
      fontFamily: Platform.select({ web: 'Pretendard-Medium, sans-serif', default: 'Pretendard-Medium' }),
    },
  },
};
