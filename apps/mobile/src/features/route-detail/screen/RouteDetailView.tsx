import { StyleSheet, Text, View } from 'react-native';
import { BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { MapWrapper } from '../../map/MapWrapper';
import { theme } from '../../../theme/theme';
import type { UiStatus } from '../../../theme/status-config';
import type { MovingMapData } from '../../map/types';
import type { TimelineItem } from '../../../mocks/route/types';

export interface RouteDetailViewProps {
  mapData: MovingMapData;
  progress: number;
  timeline: TimelineItem[];
  onPressStart: () => void;
}

const statusColorMap: Record<UiStatus, string> = {
  relaxed: theme.colors.accent.relaxed,
  warning: theme.colors.accent.warning,
  urgent: theme.colors.accent.urgent,
};

export function RouteDetailView({ mapData, progress, timeline, onPressStart }: RouteDetailViewProps) {
  return (
    <ScreenContainer scrollable contentContainerStyle={styles.container}>
      <SectionHeader title="경로 상세" subtitle="이동 흐름을 확인하고 바로 시작" status="warning" />

      <MapWrapper
        data={mapData}
        progress={progress}
        overlay={
          <View style={styles.mapOverlay}>
            <StatusBadge status="warning" label="BEST 경로" />
            <Text style={styles.mapHint}>예상 도착 08:52 · 버퍼 4분</Text>
          </View>
        }
      />

      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>타임라인</Text>
        <View style={styles.timelineList}>
          {timeline.map((item, index) => (
            <View key={item.id} style={styles.timelineRow}>
              <View style={styles.axis}>
                <View style={[styles.dot, { backgroundColor: statusColorMap[item.status] }]} />
                {index < timeline.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.time}>{item.time}</Text>
                  <StatusBadge status={item.status} size="sm" />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <BottomCTA label="이동 시작" status="urgent" onPress={onPressStart} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  mapOverlay: {
    padding: theme.spacing.md,
    justifyContent: 'space-between',
    flex: 1,
  },
  mapHint: {
    alignSelf: 'flex-end',
    ...theme.typography.caption.md,
    color: theme.colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
  },
  timelineSection: {
    gap: theme.spacing.sm,
  },
  timelineTitle: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  timelineList: {
    gap: theme.spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
  },
  axis: {
    width: 18,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.md,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.border.subtle,
  },
  card: {
    flex: 1,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.elevation.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  time: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
  cardTitle: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  cardDescription: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
});
