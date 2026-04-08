import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/common/Screen';
import { useRecommendRoutes } from '../src/hooks/useRecommendRoutes';
import type { RecommendedRoute } from '../src/services/api/client';
import { tokens } from '../src/theme/tokens';

export default function HomePage() {
  const { data, isLoading, error, refetch } = useRecommendRoutes();
  const primary = data?.primaryRoute;
  const alternatives = data?.alternatives ?? [];
  const recommendationStatus = data?.status ?? '주의';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>TimeFit 추천 결과</Text>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={tokens.color.primary} />
            <Text style={styles.description}>추천 경로 계산 중...</Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.card}>
            <Text style={styles.error}>추천 API 연결 실패: {error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void refetch()}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !error && data && primary ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>추천 상태</Text>
              <Text style={[styles.statusBadge, { color: getStatusColor(recommendationStatus) }]}>
                {data.status}
              </Text>
              <Text style={styles.sectionLabel}>권장 출발 시간</Text>
              <Text style={styles.departureTime}>{formatTime(primary.departureAt)}</Text>
              <Text style={styles.description}>{data.nextAction}</Text>
            </View>

            <RouteCard route={primary} isPrimary />
            {alternatives.map((route) => (
              <RouteCard key={route.route.id} route={route} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function RouteCard({ route, isPrimary = false }: { route: RecommendedRoute; isPrimary?: boolean }) {
  const statusColor = getStatusColor(route.status);

  return (
    <View style={[styles.card, isPrimary ? styles.primaryCard : null]}>
      <View style={styles.rowBetween}>
        <Text style={styles.routeName}>
          {isPrimary ? 'Primary' : 'Alternative'} · {route.route.name}
        </Text>
        <Text style={[styles.routeStatus, { color: statusColor }]}>{route.status}</Text>
      </View>
      <Text style={styles.meta}>출발 {formatTime(route.departureAt)} · 도착 {formatTime(route.expectedArrivalAt)}</Text>
      <Text style={styles.meta}>
        이동 {route.route.estimatedTravelMinutes}분 · 환승 {route.route.transferCount}회 · 도보 {route.route.walkingMinutes}분
      </Text>
      <Text style={styles.meta}>점수 {route.totalScore} · 버퍼 {route.bufferMinutes}분</Text>
    </View>
  );
}

function getStatusColor(status: '여유' | '주의' | '긴급' | '위험') {
  if (status === '여유') {
    return tokens.color.mint;
  }
  if (status === '주의') {
    return tokens.color.orange;
  }
  return tokens.color.red;
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  card: {
    backgroundColor: tokens.color.card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  loadingCard: {
    backgroundColor: tokens.color.card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  primaryCard: {
    borderWidth: 1,
    borderColor: tokens.color.primary,
  },
  title: {
    color: tokens.color.text,
    fontSize: 26,
    fontWeight: '700',
  },
  sectionLabel: {
    color: tokens.color.subtext,
    fontSize: 12,
  },
  departureTime: {
    color: tokens.color.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: tokens.color.subtext,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  routeName: {
    flex: 1,
    color: tokens.color.text,
    fontSize: 16,
    fontWeight: '700',
  },
  routeStatus: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: tokens.color.subtext,
    fontSize: 13,
  },
  error: {
    color: tokens.color.red,
  },
  retryButton: {
    marginTop: tokens.spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: tokens.color.text,
    fontWeight: '700',
  },
});
