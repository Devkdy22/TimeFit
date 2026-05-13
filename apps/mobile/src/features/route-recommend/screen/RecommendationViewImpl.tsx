import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { HomeTabBar } from '../../../components/home';
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
  headerDestination: string;
  headerArrivalAt: string;
  recommended: RouteCardItem;
  alternatives: RouteCardItem[];
  errorMessage: string | null;
  source: 'api';
  onRetry: () => void;
  onPressDetail: () => void;
  onClose: () => void;
}

function RouteStatusPill({ label }: { label: string }) {
  const isWarning = label === '주의';
  return (
    <View style={[styles.statusPill, isWarning ? styles.statusWarningPill : styles.statusRelaxedPill]}>
      <Text style={[styles.statusPillText, isWarning ? styles.statusWarningText : styles.statusRelaxedText]}>
        {label}
      </Text>
    </View>
  );
}

function RouteTimingRow({ departure, arrival, totalDuration }: Pick<RouteCardItem, 'departure' | 'arrival' | 'totalDuration'>) {
  return (
    <View style={styles.timingRow}>
      <View style={styles.timingCol}>
        <Text style={styles.timingLabel}>출발 시간</Text>
        <Text style={styles.timingValue}>{departure}</Text>
      </View>

      <View style={styles.durationWrap}>
        <View style={styles.timingLine} />
        <View style={styles.durationPill}>
          <Text style={styles.durationText}>{totalDuration}</Text>
        </View>
        <View style={styles.timingLine} />
      </View>

      <View style={[styles.timingCol, styles.timingColRight]}>
        <Text style={styles.timingLabel}>도착 시간</Text>
        <Text style={styles.timingValue}>{arrival}</Text>
      </View>
    </View>
  );
}

function BestRouteCard({ item, onPress }: { item: RouteCardItem; onPress: () => void }) {
  const isWarning = item.stabilityLabel === '주의';

  return (
    <View style={styles.bestCardWrap}>
      <View style={styles.bestRibbon}>
        <Text style={styles.bestRibbonText}>BEST</Text>
      </View>
      <Text style={styles.bestTitle}>{item.name}</Text>
      <Text style={styles.bestSubtitle}>{item.reason}</Text>

      <RouteTimingRow
        departure={item.departure}
        arrival={item.arrival}
        totalDuration={item.totalDuration}
      />

      <View style={styles.bestBottomRow}>
        <RouteStatusPill label={isWarning ? '주의' : '여유'} />
        <Pressable onPress={onPress} style={({ pressed }) => [styles.pickButton, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={styles.pickButtonText}>선택하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AlternativeCard({ item, onPress }: { item: RouteCardItem; onPress: () => void }) {
  const isWarning = item.stabilityLabel === '주의';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.altCard, { opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.altHead}>
        <Text style={styles.altTitle}>{item.name}</Text>
        <RouteStatusPill label={isWarning ? '주의' : '여유'} />
      </View>
      <Text style={styles.altSummary}>{item.transportSummary}</Text>
      <Text style={styles.altTimes}>
        {item.departure} → {item.arrival} · {item.totalDuration}
      </Text>
    </Pressable>
  );
}

function PhaseNotice({
  phase,
  subtitle,
  errorMessage,
  onRetry,
}: Pick<RouteRecommendViewProps, 'phase' | 'errorMessage' | 'onRetry' | 'subtitle'>) {
  if (phase === 'ready') {
    return null;
  }

  return (
    <View style={[styles.notice, phase === 'error' ? styles.noticeError : null]}>
      <Text style={styles.noticeTitle}>
        {phase === 'loading' ? '실시간 경로 계산 중' : '실시간 경로 조회 실패'}
      </Text>
      <Text style={styles.noticeBody}>
        {phase === 'loading' ? subtitle : errorMessage ?? '잠시 후 다시 시도해 주세요.'}
      </Text>
      {phase === 'error' ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.noticeRetry, { opacity: pressed ? 0.86 : 1 }]}>
          <Text style={styles.noticeRetryText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RouteRecommendView({
  phase,
  subtitle,
  headerDestination,
  headerArrivalAt,
  recommended,
  alternatives,
  errorMessage,
  onRetry,
  onPressDetail,
  onClose,
}: RouteRecommendViewProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="recommendBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#DEFFFE" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#F8F8FF" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#recommendBgGradient)" />
        </Svg>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="arrow-back-outline" size={26} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerDestination} numberOfLines={1}>
                {headerDestination}
              </Text>
              <Text style={styles.headerArrival}>{headerArrivalAt} 도착</Text>
            </View>
          </View>

          <PhaseNotice phase={phase} subtitle={subtitle} errorMessage={errorMessage} onRetry={onRetry} />

          <View style={styles.bestCardSection}>
            <View style={styles.timiFaceWrap}>
              <View style={styles.timiFace}>
                <View style={styles.timiEye} />
                <View style={styles.timiEye} />
              </View>
            </View>
            <BestRouteCard item={recommended} onPress={onPressDetail} />
          </View>

          <View style={styles.altSection}>
            <Text style={styles.altSectionTitle}>다른 경로</Text>
            <View style={styles.altList}>
              {alternatives.map((route) => (
                <AlternativeCard key={route.id} item={route} onPress={onPressDetail} />
              ))}
            </View>
          </View>

          <Pressable onPress={onPressDetail} style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}>
            <Text style={styles.ctaButtonText}>BEST 경로 선택</Text>
          </Pressable>
        </ScrollView>

        <HomeTabBar status="relaxed" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 144,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6ED6CD',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 8,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerDestination: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 34,
    lineHeight: 38,
    color: '#6F8F90',
  },
  headerArrival: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 48,
    lineHeight: 52,
    color: '#0D2B2A',
  },
  bestCardSection: {
    position: 'relative',
    marginTop: 2,
  },
  timiFaceWrap: {
    position: 'absolute',
    right: 16,
    top: -44,
    zIndex: 20,
  },
  timiFace: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#6ED6CD',
    backgroundColor: '#DFFFFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  timiEye: {
    width: 9,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#3B5A5A',
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8FDCDA',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  noticeError: {
    borderColor: '#EF9090',
  },
  noticeTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#0D2B2A',
  },
  noticeBody: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#6F8F90',
  },
  noticeRetry: {
    marginTop: 4,
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4B5B5',
  },
  noticeRetryText: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#D24A4A',
    fontSize: 12,
  },
  bestCardWrap: {
    position: 'relative',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 18,
    gap: 14,
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 5,
  },
  bestRibbon: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 112,
    height: 47,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 25,
    backgroundColor: '#6ED6CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestRibbonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  bestTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 48,
    lineHeight: 52,
    color: '#0D2B2A',
  },
  bestSubtitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 32,
    lineHeight: 36,
    color: '#6F8F90',
  },
  timingRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(111,143,144,0.3)',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timingCol: {
    gap: 8,
  },
  timingColRight: {
    alignItems: 'flex-end',
  },
  timingLabel: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#6F8F90',
  },
  timingValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 40,
    lineHeight: 44,
    color: '#0D2B2A',
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
    gap: 6,
  },
  timingLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#8FA5A6',
    opacity: 0.65,
  },
  durationPill: {
    height: 41,
    minWidth: 70,
    borderRadius: 999,
    backgroundColor: '#6F8F90',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  durationText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bestBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    minWidth: 56,
    height: 41,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  statusRelaxedPill: {
    backgroundColor: '#E4FFFD',
  },
  statusWarningPill: {
    backgroundColor: '#FFF3DB',
  },
  statusPillText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 26,
  },
  statusRelaxedText: {
    color: '#58C7C2',
  },
  statusWarningText: {
    color: '#F59E0B',
  },
  pickButton: {
    minWidth: 95,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#34B6AE',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 5,
  },
  pickButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
  },
  altSection: {
    gap: 10,
  },
  altSectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 40,
    lineHeight: 44,
    color: '#0D2B2A',
    marginLeft: 4,
  },
  altList: {
    gap: 10,
  },
  altCard: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  altHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  altTitle: {
    flex: 1,
    fontFamily: 'Pretendard-Bold',
    fontSize: 34,
    lineHeight: 38,
    color: '#0D2B2A',
  },
  altSummary: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 26,
    lineHeight: 30,
    color: '#6F8F90',
  },
  altTimes: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 36,
    lineHeight: 40,
    color: '#0D2B2A',
  },
  ctaButton: {
    marginTop: 4,
    minHeight: 62,
    borderRadius: 999,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34B6AE',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 6,
  },
  ctaButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#FFFFFF',
  },
});
