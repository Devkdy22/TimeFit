import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen, Header, PrimaryButton, RoutineCard, TimeyMascot } from '../../../components/app';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useRoutines } from '../context';
import type { Routine } from '../model/types';
import { useNavigationHelper } from '../../../utils/navigation';

type RoutineTab = 'all' | 'favorite' | 'recent';

export function RoutineScreen() {
  const nav = useNavigationHelper();
  const { routines, toggleFavorite } = useRoutines();
  const [activeTab, setActiveTab] = useState<RoutineTab>('all');

  const filteredRoutines = useMemo(() => {
    if (activeTab === 'favorite') {
      return routines.filter((item) => item.favorite);
    }
    if (activeTab === 'recent') {
      return routines
        .filter((item) => Boolean(item.lastUsedAt))
        .sort((a, b) => new Date(b.lastUsedAt ?? '').getTime() - new Date(a.lastUsedAt ?? '').getTime());
    }
    return routines;
  }, [activeTab, routines]);

  const renderItem = ({ item }: { item: Routine }) => (
    <RoutineCard
      routine={item}
      onPress={() => {
        // TODO: 루틴 상세 또는 해당 루틴 기반 경로 추천 화면 연결
        Alert.alert('루틴 선택', `${item.name} 루틴을 기반으로 이동 추천을 준비중입니다.`);
      }}
      onPressFavorite={() => toggleFavorite(item.id)}
    />
  );

  return (
    <AppScreen style={styles.screen}>
      <Header title="내 루틴" subtitle="자주 가는 이동을 빠르게 시작해보세요." rightAction={<Ionicons name="notifications-outline" size={20} color={appColors.textPrimary} />} />

      <View style={styles.characterRow}>
        <TimeyMascot size={72} expression="neutral" />
      </View>

      <View style={styles.tabRow}>
        {[
          { key: 'all', label: '전체' },
          { key: 'favorite', label: '즐겨찾기' },
          { key: 'recent', label: '최근 사용' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key as RoutineTab)} style={[styles.tab, active ? styles.tabActive : null]}>
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filteredRoutines.length === 0 ? (
        <View style={styles.emptyWrap}>
          <TimeyMascot size={80} expression="neutral" />
          <Text style={styles.emptyTitle}>아직 저장된 루틴이 없어요</Text>
          <Text style={styles.emptyBody}>자주 가는 경로를 저장하면 더 빠르게 이동할 수 있어요.</Text>
          <PrimaryButton label="루틴 만들기" onPress={nav.goToRoutineCreate} />
        </View>
      ) : (
        <FlatList
          data={filteredRoutines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable onPress={nav.goToRoutineCreate} style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.9 : 1 }]}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  characterRow: { alignItems: 'flex-start', marginTop: -8 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.border,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: appColors.primaryLight,
    borderColor: appColors.primary,
  },
  tabText: { color: appColors.textSecondary, ...appTypography.caption },
  tabTextActive: { color: appColors.primaryDark, fontWeight: '600' },
  listContent: { paddingBottom: 130, paddingTop: 4 },
  separator: { height: 14 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 34,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: appColors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 90,
  },
  emptyTitle: { color: appColors.textPrimary, ...appTypography.sectionTitle },
  emptyBody: { color: appColors.textSecondary, textAlign: 'center', ...appTypography.body },
});
