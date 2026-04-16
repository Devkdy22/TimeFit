export const uiTheme = {
  fontFamily: 'Pretendard',
  colors: {
    primaryMint: '#58C7C2',
    primaryBlue: '#6AB8FF',
    background: '#F4F7FB',
    card: '#FFFFFF',
    textPrimary: '#0B1220',
    textSecondary: '#2A3448',
    divider: '#E8EEF7',
  },
  status: {
    safe: '#58C7C2',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  spacing: {
    s4: 4,
    s8: 8,
    s12: 12,
    s16: 16,
    s20: 20,
    s24: 24,
    s32: 32,
  },
  radius: {
    small: 8,
    medium: 12,
    large: 16,
  },
  typography: {
    title: {
      fontFamily: 'Pretendard',
      fontWeight: '700',
      fontSize: 24,
      lineHeight: 32,
    },
    body: {
      fontFamily: 'Pretendard',
      fontWeight: '400',
      fontSize: 16,
      lineHeight: 22,
    },
    caption: {
      fontFamily: 'Pretendard',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
    button: {
      fontFamily: 'Pretendard',
      fontWeight: '600',
      fontSize: 16,
      lineHeight: 22,
    },
    time: {
      fontFamily: 'Pretendard',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 26,
    },
  },
} as const;

export type StatusTone = keyof typeof uiTheme.status;
