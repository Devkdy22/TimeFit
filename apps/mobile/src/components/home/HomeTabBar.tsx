import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CommuteStatus } from './types';

interface HomeTabBarProps {
  status?: CommuteStatus;
}

const toneColor: Record<CommuteStatus, string> = {
  relaxed: '#58C7C2',
  warning: '#FF9F43',
  urgent: '#FF5D73',
};

export function HomeTabBar({ status = 'relaxed' }: HomeTabBarProps) {
  const activeColor = toneColor[status];

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.tabWrap}>
          <Ionicons name="bookmark-outline" size={20} color={activeColor} />
          <Text style={[styles.tab, { color: activeColor }]}>저장</Text>
        </View>

        <View style={styles.centerTabWrap}>
          <View style={[styles.centerTab, { backgroundColor: activeColor }]}>
            <Ionicons name="home" size={22} color={colors.white} />
          </View>
          <Text style={[styles.centerText, { color: activeColor }]}>홈</Text>
        </View>

        <View style={styles.tabWrap}>
          <Ionicons name="grid-outline" size={20} color={activeColor} />
          <Text style={[styles.tab, { color: activeColor }]}>더보기</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  tabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tab: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
  },
  centerTabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    gap: 4,
  },
  centerTab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  centerText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
  },
});
