import { Pressable, StyleSheet, Text, View } from 'react-native';
import { uiTheme, type StatusTone } from '../../constants/theme';
import { StatusBadge } from './StatusBadge';
import { TimeDisplay } from './TimeDisplay';
import { TransportChip } from './TransportChip';

export interface RouteCardProps {
  title: string;
  departureTime: string;
  arrivalTime: string;
  totalDuration: string;
  bufferTime: string;
  transportSummary: string;
  stabilityLabel: string;
  tone?: StatusTone;
  highlight?: boolean;
  onPress?: () => void;
}

export function RouteCard({
  title,
  departureTime,
  arrivalTime,
  totalDuration,
  bufferTime,
  transportSummary,
  stabilityLabel,
  tone = 'warning',
  highlight = false,
  onPress,
}: RouteCardProps) {
  const Card = onPress ? Pressable : View;

  return (
    <Card
      {...(onPress
        ? {
            onPress,
            style: ({ pressed }: { pressed: boolean }) => [
              styles.container,
              highlight ? styles.containerHighlight : null,
              { borderColor: highlight ? uiTheme.status[tone] : uiTheme.colors.divider },
              { opacity: pressed ? 0.94 : 1 },
            ],
          }
        : {
            style: [
              styles.container,
              highlight ? styles.containerHighlight : null,
              { borderColor: highlight ? uiTheme.status[tone] : uiTheme.colors.divider },
            ],
          })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <StatusBadge tone={tone} label={stabilityLabel} size="sm" />
      </View>

      <View style={styles.timeRow}>
        <TimeDisplay label="출발" time={departureTime} />
        <TimeDisplay label="도착" time={arrivalTime} />
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaText}>총 소요 시간 {totalDuration}</Text>
        <Text style={[styles.metaText, styles.bufferText]}>여유 시간 {bufferTime}</Text>
      </View>

      <TransportChip summary={transportSummary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: uiTheme.radius.large,
    borderWidth: 1,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s16,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s12,
  },
  containerHighlight: {
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s8,
  },
  title: {
    ...uiTheme.typography.body,
    fontWeight: '700',
    color: uiTheme.colors.textPrimary,
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s16,
  },
  metaCard: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s8,
    gap: uiTheme.spacing.s4,
  },
  metaText: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textSecondary,
  },
  bufferText: {
    color: uiTheme.status.warning,
    fontWeight: '700',
  },
});
