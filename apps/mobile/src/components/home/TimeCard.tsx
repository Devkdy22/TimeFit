import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CommuteStatus } from './types';
import { TimeWheelPicker } from './TimeWheelPicker';

interface TimeCardProps {
  arrivalTime: string;
  pickerTime?: string;
  destination: string;
  status: CommuteStatus;
  statusLabel?: string;
  headline: string;
  etaLabel: string;
  ctaLabel?: string;
  ctaTone?: 'primary' | 'subtle';
  onPressCta?: () => void;
  onChangeArrivalTime?: (time: string) => void;
  onPressDestination?: () => void;
}

const statusAppearance: Record<
  CommuteStatus,
  {
    badgeBg: string;
    badgeText: string;
    buttonColor: string;
    iconTint: string;
    iconSoftBg: string;
    cardRing: string;
  }
> = {
  relaxed: {
    badgeBg: '#E5F8F6',
    badgeText: '#46A9A5',
    buttonColor: '#58C7C2',
    iconTint: '#58C7C2',
    iconSoftBg: 'rgba(88, 199, 194, 0.14)',
    cardRing: 'rgba(88, 199, 194, 0.25)',
  },
  warning: {
    badgeBg: '#FFF2E6',
    badgeText: '#E47F1F',
    buttonColor: '#FF9F43',
    iconTint: '#FF9F43',
    iconSoftBg: 'rgba(255, 159, 67, 0.14)',
    cardRing: 'rgba(255, 159, 67, 0.22)',
  },
  urgent: {
    badgeBg: '#FFECEF',
    badgeText: '#E63A52',
    buttonColor: '#FF5D73',
    iconTint: '#FF5D73',
    iconSoftBg: 'rgba(255, 93, 115, 0.14)',
    cardRing: 'rgba(255, 93, 115, 0.25)',
  },
};

export function TimeCard({
  arrivalTime,
  pickerTime,
  destination,
  status,
  statusLabel,
  headline,
  etaLabel,
  ctaLabel = '출발하기',
  ctaTone = 'primary',
  onPressCta,
  onChangeArrivalTime,
  onPressDestination,
}: TimeCardProps) {
  const appearance = statusAppearance[status];
  const [pickerVisible, setPickerVisible] = useState(false);
  const initialPickerTime = pickerTime ?? (/\d{2}:\d{2}/.test(arrivalTime) ? arrivalTime : '19:00');
  const isArrivalConfigured = /\d{2}:\d{2}/.test(arrivalTime);
  const isDestinationConfigured = !destination.includes('설정');

  return (
    <>
      <View style={[styles.card, { borderColor: appearance.cardRing }]}>
        <View style={styles.rowBetween}>
          <View style={styles.inlineRow}>
            <View style={[styles.iconPill, { backgroundColor: appearance.iconSoftBg }]}>
              <Ionicons name="time-outline" size={16} color={appearance.iconTint} />
            </View>
            <Text style={styles.label}>도착 시간</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: appearance.badgeBg }]}>
            <Text style={[styles.badgeText, { color: appearance.badgeText }]}>
              {statusLabel ?? '여유'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setPickerVisible(true)}
          style={({ pressed }) => [styles.timePressable, { opacity: pressed ? 0.88 : 1 }]}
        >
          <View style={styles.timeActionRow}>
            <Text style={styles.arrivalTime}>{arrivalTime}</Text>
            <View style={styles.timeActionMeta}>
              <View style={styles.timeActionChip}>
                <Text style={styles.timeActionChipText}>
                  {isArrivalConfigured ? '변경' : '도착시간 설정'}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={onPressDestination}
          style={({ pressed }) => [styles.destinationRow, { opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={styles.destinationLeft}>
            <Ionicons name="location-outline" size={18} color={appearance.iconTint} />
            <Text style={styles.destination} numberOfLines={1}>
              {destination}
            </Text>
          </View>
          <View style={styles.destinationActionChip}>
            <Text style={styles.destinationActionChipText}>
              {isDestinationConfigured ? '변경' : '도착지 설정'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.headline}>{headline}</Text>

        <View style={styles.inlineRowGap}>
          <Ionicons name="walk-outline" size={16} color={appearance.iconTint} />
          <Text style={styles.eta}>{etaLabel}</Text>
        </View>

        <Pressable
          onPress={onPressCta}
          style={({ pressed }) => [styles.ctaPressable, pressed ? styles.ctaPressed : null]}
        >
          <View
            style={[
              styles.cta,
              ctaTone === 'subtle' ? styles.ctaSubtle : null,
              { backgroundColor: ctaTone === 'subtle' ? '#D8ECEB' : appearance.buttonColor },
            ]}
          >
            <Text style={[styles.ctaText, ctaTone === 'subtle' ? styles.ctaTextSubtle : null]}>{ctaLabel}</Text>
          </View>
        </Pressable>
      </View>

      <TimeWheelPicker
        visible={pickerVisible}
        initialTime={initialPickerTime}
        accentColor={appearance.iconTint}
        onClose={() => setPickerVisible(false)}
        onConfirm={(time) => {
          onChangeArrivalTime?.(time);
          setPickerVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineRowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  iconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
  },
  timePressable: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2ECEC',
    backgroundColor: '#F9FCFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeActionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeActionChip: {
    borderRadius: 999,
    backgroundColor: '#EAF4F4',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeActionChipText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: '#426464',
  },
  arrivalTime: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 44,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  destinationRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FBFB',
    borderWidth: 1,
    borderColor: '#E2ECEC',
  },
  destinationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destination: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  destinationActionChip: {
    borderRadius: 999,
    backgroundColor: '#EAF4F4',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  destinationActionChipText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: '#426464',
  },
  divider: {
    marginVertical: 16,
    height: 1,
    backgroundColor: colors.border,
  },
  headline: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 22,
    color: colors.textPrimary,
  },
  eta: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: colors.textSecondary,
  },
  cta: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#58C7C2',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  ctaPressable: {
    marginTop: 16,
    borderRadius: 999,
    overflow: 'visible',
  },
  ctaPressed: {
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: colors.white,
  },
  ctaSubtle: {
    borderWidth: 1,
    borderColor: '#9CCFCC',
    shadowOpacity: 0.18,
    elevation: 3,
  },
  ctaTextSubtle: {
    color: '#1F5B58',
  },
});
