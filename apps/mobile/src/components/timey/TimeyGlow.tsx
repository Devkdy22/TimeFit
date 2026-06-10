import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { timeyPalette } from '../../constants/timey/timeyColors';
import type { TimeyState } from '../../types/timey.types';

type TimeyGlowProps = PropsWithChildren<{
  state: TimeyState;
  size: number;
  enabled?: boolean;
}>;

export function TimeyGlow({ state, size, enabled, children }: TimeyGlowProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const fallbackPalette = { primary: '#58C7C2', deep: '#34B6AE', glow: 'rgba(88, 199, 194, 0.22)' };
  const palette = timeyPalette[state] ?? timeyPalette.idle ?? fallbackPalette;

  return (
    <View
      style={[
        styles.glow,
        {
          width: size,
          height: size,
          shadowColor: palette.glow,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
