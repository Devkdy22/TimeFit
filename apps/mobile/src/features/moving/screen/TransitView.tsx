import { StyleSheet, Text, View } from 'react-native';
import { BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import type { UiStatus } from '../../../theme/status-config';

export interface TransitViewProps {
  currentTime: string;
  arrivalTime: string;
  remainingTime: string;
  mainAction: string;
  stageText: string;
  supportText: string;
  status: UiStatus;
  onPressDone: () => void;
}

export function TransitView({
  currentTime,
  arrivalTime,
  remainingTime,
  mainAction,
  stageText,
  supportText,
  status,
  onPressDone,
}: TransitViewProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="이동 중" subtitle="지금은 한 가지 행동에만 집중하세요" status={status} />

      <View style={styles.headerCard}>
        <Text style={styles.meta}>현재 {currentTime}</Text>
        <Text style={styles.meta}>도착 {arrivalTime}</Text>
        <Text style={styles.remaining}>남은 시간 {remainingTime}</Text>
      </View>

      <View style={styles.mainActionCard}>
        <StatusBadge status={status} label="지금 할 행동" />
        <Text style={styles.mainAction}>{mainAction}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.stage}>{stageText}</Text>
        <Text style={styles.support}>{supportText}</Text>
      </View>

      <BottomCTA label="도착 처리" status={status} onPress={onPressDone} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s12,
  },
  headerCard: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    padding: uiTheme.spacing.s16,
    gap: uiTheme.spacing.s4,
  },
  meta: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  remaining: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  mainActionCard: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    padding: uiTheme.spacing.s24,
    gap: uiTheme.spacing.s12,
  },
  mainAction: {
    ...uiTheme.typography.title,
    color: uiTheme.colors.textPrimary,
  },
  infoCard: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    padding: uiTheme.spacing.s16,
    gap: uiTheme.spacing.s4,
  },
  stage: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  support: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
});
