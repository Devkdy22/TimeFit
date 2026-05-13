import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TimiAnimated } from '../../../components/character/TimiAnimated';
import {
  HomeTabBar,
  RecentList,
  SectionHeader,
  TimeCard,
  type CommuteStatus,
  type RecentDestination,
} from '../../../components/home';
import { colors } from '../../../theme/colors';

export interface HomeViewProps {
  userName: string;
  status: CommuteStatus;
  statusLabel: string;
  arrivalTime: string;
  pickerTime: string;
  destination: string;
  headline: string;
  etaLabel: string;
  ctaLabel: string;
  ctaTone: 'primary' | 'subtle';
  recentItems: RecentDestination[];
  onPressStart: () => void;
  onPressNewRoute: () => void;
  onChangeArrivalTime: (time: string) => void;
  onPressDestination: () => void;
}

function mapStatusMood(status: CommuteStatus): 'happy' | 'focus' | 'concerned' {
  if (status === 'urgent') {
    return 'concerned';
  }
  if (status === 'warning') {
    return 'focus';
  }
  return 'happy';
}

export function HomeView({
  userName,
  status,
  statusLabel,
  arrivalTime,
  pickerTime,
  destination,
  headline,
  etaLabel,
  ctaLabel,
  ctaTone,
  recentItems,
  onPressStart,
  onPressNewRoute,
  onChangeArrivalTime,
  onPressDestination,
}: HomeViewProps) {
  const timiSignal = useMemo(() => Date.now(), [status]);
  const [recentExpanded, setRecentExpanded] = useState(false);

  const hasRecentItems = recentItems.length > 0;
  const canToggleRecent = recentItems.length > 2;
  const visibleRecentItems = recentExpanded ? recentItems : recentItems.slice(0, 2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="homeBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#DEFFFE" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#F8F8FF" stopOpacity="0.92" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBgGradient)" />
        </Svg>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <TimiAnimated
              status={status}
              size={122}
              mood={mapStatusMood(status)}
              interaction="none"
              signal={timiSignal}
            />
            <Text style={styles.greeting}>안녕하세요 {userName}님,</Text>
            <Text style={styles.title}>준비되셨나요?</Text>
          </View>

          <TimeCard
            arrivalTime={arrivalTime}
            pickerTime={pickerTime}
            destination={destination}
            status={status}
            statusLabel={statusLabel}
            headline={headline}
            etaLabel={etaLabel}
            ctaLabel={ctaLabel}
            ctaTone={ctaTone}
            onPressCta={onPressStart}
            onChangeArrivalTime={onChangeArrivalTime}
            onPressDestination={onPressDestination}
          />

          <View style={styles.recentSection}>
            <SectionHeader
              title="최근 목적지"
              actionLabel="새 경로 +"
              onPressAction={onPressNewRoute}
            />
            <View style={styles.listWrap}>
              {!hasRecentItems ? (
                <View style={styles.emptyRecentCard}>
                  <Text style={styles.emptyRecentTitle}>새로운 출발을 시작해주세요.</Text>
                  <Text style={styles.emptyRecentBody}>
                    새 경로를 추가하면 여기에 최근 목적지가 표시됩니다.
                  </Text>
                </View>
              ) : (
                <RecentList items={visibleRecentItems} />
              )}

              {canToggleRecent ? (
                <Pressable
                  onPress={() => setRecentExpanded((prev) => !prev)}
                  style={styles.recentToggleBtn}
                >
                  <Text style={styles.recentToggleText}>
                    {recentExpanded ? '최근 목적지 접기' : '최근 목적지 더보기'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <HomeTabBar status={status} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 132,
    gap: 16,
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  greeting: {
    marginTop: 8,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  title: {
    marginTop: 4,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 34,
    lineHeight: 40,
    color: colors.textPrimary,
  },
  recentSection: {
    marginTop: 8,
    gap: 12,
  },
  listWrap: {
    marginTop: 2,
  },
  emptyRecentCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#58C7C2',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  emptyRecentTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptyRecentBody: {
    marginTop: 6,
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  recentToggleBtn: {
    marginTop: 4,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(88, 199, 194, 0.22)',
  },
  recentToggleText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#2C8F8B',
  },
});
