import type { TextStyle } from 'react-native';
import { font } from './tokens';

export interface TypographyPreset {
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  includeFontPadding?: boolean;
}

export const typographyPresets = {
  display: {
    ...fontStyle('display', font.family.bold, font.weight.bold, 0.2),
  },
  screenTitle: {
    ...fontStyle('screenTitle', font.family.bold, font.weight.bold, 0.1),
  },
  sectionTitle: {
    ...fontStyle('sectionTitle', font.family.bold, font.weight.bold, 0),
  },
  cardTitle: {
    ...fontStyle('cardTitle', font.family.semibold, font.weight.semibold, 0),
  },
  label: {
    ...fontStyle('label', font.family.semibold, font.weight.semibold, 0.1),
  },
  helper: {
    ...fontStyle('caption', font.family.regular, font.weight.regular, 0),
  },
  title: {
    lg: {
      fontFamily: font.family.bold,
      fontWeight: font.weight.bold,
      fontSize: font.size.screenTitle,
      lineHeight: font.lineHeight.screenTitle,
      letterSpacing: 0.2,
      includeFontPadding: false,
    } satisfies TypographyPreset,
    xl: {
      fontFamily: font.family.bold,
      fontWeight: font.weight.bold,
      fontSize: font.size.display,
      lineHeight: font.lineHeight.display,
      letterSpacing: 0.4,
      includeFontPadding: false,
    } satisfies TypographyPreset,
  },
  body: {
    md: {
      fontFamily: font.family.regular,
      fontWeight: font.weight.regular,
      fontSize: font.size.body,
      lineHeight: font.lineHeight.body,
      includeFontPadding: false,
    } satisfies TypographyPreset,
    lg: {
      fontFamily: font.family.regular,
      fontWeight: font.weight.regular,
      fontSize: font.size.bodyLg,
      lineHeight: font.lineHeight.bodyLg,
      includeFontPadding: false,
    } satisfies TypographyPreset,
    strong: {
      fontFamily: font.family.semibold,
      fontWeight: font.weight.semibold,
      fontSize: font.size.body,
      lineHeight: font.lineHeight.body,
      includeFontPadding: false,
    } satisfies TypographyPreset,
  },
  bodyEmphasis: {
    fontFamily: font.family.semibold,
    fontWeight: font.weight.semibold,
    fontSize: font.size.body,
    lineHeight: font.lineHeight.body,
    includeFontPadding: false,
  } satisfies TypographyPreset,
  caption: {
    md: {
      fontFamily: font.family.medium,
      fontWeight: font.weight.medium,
      fontSize: font.size.caption,
      lineHeight: font.lineHeight.caption,
      letterSpacing: 0.1,
      includeFontPadding: false,
    } satisfies TypographyPreset,
  },
} as const;

function fontStyle(
  role: keyof typeof font.size,
  fontFamily: string,
  fontWeight: TypographyPreset['fontWeight'],
  letterSpacing: number,
): TypographyPreset {
  return {
    fontFamily,
    fontWeight,
    fontSize: font.size[role],
    lineHeight: font.lineHeight[role],
    letterSpacing,
    includeFontPadding: false,
  };
}
