import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors, homeLayout, homeShadow } from '../constants/homeTheme';
import type { Routine } from '../types/home.types';

interface NextRoutineCardProps {
  routine: Routine;
  onPressStart: () => void;
  onPressNotification: () => void;
}

function statusToken(bufferMinutes: number) {
  if (bufferMinutes <= 5) {
    return { text: `위험 ${bufferMinutes}분`, bg: '#FEE2E2', color: homeColors.danger };
  }
  if (bufferMinutes <= 10) {
    return { text: `주의 ${bufferMinutes}분`, bg: '#FEF3C7', color: homeColors.warning };
  }
  return { text: `여유 ${bufferMinutes}분`, bg: '#DCFCE7', color: homeColors.success };
}

export function NextRoutineCard({ routine, onPressStart, onPressNotification }: NextRoutineCardProps) {
  const buffer = routine.bufferMinutes ?? 10;
  const token = statusToken(buffer);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.badge}>다음 이동</Text>
        <View style={[styles.statusPill, { backgroundColor: token.bg }]}> 
          <Text style={[styles.statusText, { color: token.color }]}>{token.text}</Text>
        </View>
      </View>

      <Text style={styles.title}>{routine.name}</Text>
      <Text style={styles.timeRow}>{routine.departureTime} 출발 → {routine.arrivalTime ?? '--:--'} 도착 예정</Text>
      <Text style={styles.routeRow}>{routine.originName} → {routine.destinationName}</Text>
      <Text style={styles.transitRow}>{routine.transitSummary ?? '대중교통 경로 확인 가능'}</Text>

      <View style={styles.ctaRow}>
        <Pressable style={({ pressed }) => [styles.primaryCta, { opacity: pressed ? 0.9 : 1 }]} onPress={onPressStart} accessibilityRole="button">
          <Text style={styles.primaryCtaText}>지금 출발하기</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryCta, { opacity: pressed ? 0.9 : 1 }]} onPress={onPressNotification} accessibilityRole="button">
          <Ionicons name="notifications-outline" size={16} color={homeColors.primaryDark} />
          <Text style={styles.secondaryCtaText}>알림 켜기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: homeLayout.cardRadius,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: 16,
    gap: 8,
    ...homeShadow,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: homeColors.primaryDark,
    backgroundColor: homeColors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 17,
    color: homeColors.textPrimary,
  },
  timeRow: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: homeColors.textPrimary,
  },
  routeRow: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: homeColors.textSecondary,
  },
  transitRow: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: homeColors.textTertiary,
  },
  ctaRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  primaryCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryCta: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.borderMint,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryCtaText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.primaryDark,
  },
});
