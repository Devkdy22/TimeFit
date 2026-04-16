import { Appearance } from 'react-native';
import {
  borderWidth,
  colorPalette,
  elevationScale,
  motion,
  radiusScale,
  spacingScale,
} from './tokens';
import { statusConfig } from './status-config';
import { typographyPresets } from './typography';

export type ThemeMode = 'light' | 'dark';

export interface SemanticColors {
  background: {
    canvas: string;
    surface: string;
    elevated: string;
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    inverse: string;
    accent: string;
    critical: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  accent: {
    primary: string;
    relaxed: string;
    warning: string;
    urgent: string;
  };
}

export interface Theme {
  mode: ThemeMode;
  colors: SemanticColors;
  spacing: typeof spacingScale;
  radius: typeof radiusScale;
  border: typeof borderWidth;
  elevation: typeof elevationScale;
  motion: typeof motion;
  typography: typeof typographyPresets;
  status: typeof statusConfig;
}

const semanticColorsByMode: Record<ThemeMode, SemanticColors> = {
  light: {
    background: {
      canvas: colorPalette.slate[50],
      surface: colorPalette.slate[0],
      elevated: colorPalette.slate[0],
      overlay: 'rgba(11, 18, 32, 0.36)',
    },
    text: {
      primary: colorPalette.slate[900],
      secondary: colorPalette.slate[700],
      inverse: colorPalette.slate[0],
      accent: colorPalette.sky[500],
      critical: colorPalette.red[600],
    },
    border: {
      subtle: colorPalette.slate[100],
      strong: colorPalette.slate[300],
      focus: colorPalette.sky[500],
    },
    accent: {
      primary: colorPalette.mint[500],
      relaxed: colorPalette.mint[500],
      warning: colorPalette.orange[500],
      urgent: colorPalette.red[500],
    },
  },
  dark: {
    background: {
      canvas: colorPalette.slate[900],
      surface: colorPalette.slate[800],
      elevated: colorPalette.slate[700],
      overlay: 'rgba(7, 12, 22, 0.62)',
    },
    text: {
      primary: colorPalette.slate[50],
      secondary: colorPalette.slate[300],
      inverse: colorPalette.slate[950],
      accent: colorPalette.sky[500],
      critical: colorPalette.red[500],
    },
    border: {
      subtle: colorPalette.slate[700],
      strong: colorPalette.slate[300],
      focus: colorPalette.sky[500],
    },
    accent: {
      primary: colorPalette.mint[500],
      relaxed: colorPalette.mint[500],
      warning: colorPalette.orange[500],
      urgent: colorPalette.red[500],
    },
  },
};

export function createTheme(mode: ThemeMode): Theme {
  return {
    mode,
    colors: semanticColorsByMode[mode],
    spacing: spacingScale,
    radius: radiusScale,
    border: borderWidth,
    elevation: elevationScale,
    motion,
    typography: typographyPresets,
    status: statusConfig,
  };
}

export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');

export function getSystemThemeMode(): ThemeMode {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

export const theme = lightTheme;
