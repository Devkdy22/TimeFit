import { StyleSheet, View } from 'react-native';
import { uiTheme } from '../../constants/theme';
import type { UiStatus } from '../../theme/status-config';
import { Timi, type TimiTone } from './Timi';

export interface TimiGreetingProps {
  status: UiStatus;
}

function mapStatusToTone(status: UiStatus): TimiTone {
  if (status === 'urgent') {
    return 'red';
  }
  if (status === 'warning') {
    return 'orange';
  }
  return 'mint';
}

export function TimiGreeting({ status }: TimiGreetingProps) {
  return (
    <View style={styles.wrap}>
      <Timi tone={mapStatusToTone(status)} size={56} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
  },
});
