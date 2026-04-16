import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomCTA, RouteCard, ScreenContainer, SectionHeader } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import type { UiStatus } from '../../../theme/status-config';

export interface RouteCardItem {
  id: string;
  name: string;
  departure: string;
  arrival: string;
  totalDuration: string;
  buffer: string;
  transportSummary: string;
  stabilityLabel: string;
  reason: string;
}

export interface RouteRecommendViewProps {
  phase: 'loading' | 'ready' | 'error';
  status: UiStatus;
  statusLabel: string;
  subtitle: string;
  recommended: RouteCardItem;
  alternatives: RouteCardItem[];
  errorMessage: string | null;
  source: 'api' | 'mock';
  onRetry: () => void;
  onPressDetail: () => void;
}

function RouteOptionCard({
  item,
  highlight = false,
  tone,
  onPress,
}: {
  item: RouteCardItem;
  highlight?: boolean;
  tone: 'safe' | 'warning' | 'danger';
  onPress: () => void;
}) {
  return (
    <View style={styles.routeOptionWrap}>
      <RouteCard
        title={item.name}
        departureTime={item.departure}
        arrivalTime={item.arrival}
        totalDuration={item.totalDuration}
        bufferTime={item.buffer}
        transportSummary={item.transportSummary}
        stabilityLabel={item.stabilityLabel}
        tone={tone}
        highlight={highlight}
        onPress={onPress}
      />
      <Text style={styles.routeReason}>{item.reason}</Text>
    </View>
  );
}

function PhaseNotice({
  phase,
  message,
  errorMessage,
  onRetry,
}: Pick<RouteRecommendViewProps, 'phase' | 'errorMessage' | 'onRetry'> & { message: string }) {
  if (phase === 'ready') {
    return null;
  }

  return (
    <View style={[styles.notice, phase === 'error' ? styles.noticeError : null]}>
      <Text style={styles.noticeTitle}>{phase === 'loading' ? '경로를 계산 중입니다' : '실시간 추천을 불러오지 못했습니다'}</Text>
      <Text style={styles.noticeBody}>
        {phase === 'loading' ? message : `${message}${errorMessage ? ` (${errorMessage})` : ''}`}
      </Text>
      {phase === 'error' ? (
        <Pressable style={({ pressed }) => [styles.retryButton, { opacity: pressed ? 0.84 : 1 }]} onPress={onRetry}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RouteRecommendView({
  phase,
  status,
  statusLabel,
  subtitle,
  recommended,
  alternatives,
  errorMessage,
  source,
  onRetry,
  onPressDetail,
}: RouteRecommendViewProps) {
  const badgeLabel = source === 'api' ? statusLabel : `${statusLabel} · Mock`;
  const tone = status === 'urgent' ? 'danger' : status === 'warning' ? 'warning' : 'safe';

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="경로 비교" subtitle="카드를 비교해 출발 결정을 확정하세요" status={status} />

      <PhaseNotice phase={phase} message={subtitle} errorMessage={errorMessage} onRetry={onRetry} />

      <View style={styles.listSection}>
        <Text style={styles.listTitle}>추천 경로 · {badgeLabel}</Text>
        <RouteOptionCard item={recommended} highlight tone={tone} onPress={onPressDetail} />
      </View>

      <View style={styles.listSection}>
        <Text style={styles.listTitle}>대안 경로</Text>
        <View style={styles.list}>
          {alternatives.map((route) => (
            <RouteOptionCard
              key={route.id}
              item={route}
              tone={tone}
              onPress={onPressDetail}
            />
          ))}
        </View>
      </View>

      <BottomCTA label="BEST 경로로 이동" status={status} onPress={onPressDetail} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s12,
  },
  notice: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.background,
    borderWidth: 1,
    borderColor: uiTheme.status.warning,
    paddingHorizontal: uiTheme.spacing.s16,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s4,
  },
  noticeError: {
    backgroundColor: uiTheme.colors.background,
    borderColor: uiTheme.status.danger,
  },
  noticeTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  noticeBody: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.s8,
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
  },
  retryText: {
    ...uiTheme.typography.caption,
    color: uiTheme.status.danger,
  },
  listSection: {
    gap: uiTheme.spacing.s8,
  },
  listTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  routeOptionWrap: {
    gap: uiTheme.spacing.s8,
  },
  routeReason: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textSecondary,
  },
  list: {
    gap: uiTheme.spacing.s8,
  },
});
