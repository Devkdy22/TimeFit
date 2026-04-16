import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { UiStatus } from '../../theme/status-config';

export interface BaseUiProps {
  status?: UiStatus;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}
