import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CommuteStatus } from './types';
import { TimeWheelPicker } from './TimeWheelPicker';

interface TimeCardProps {
  arrivalTime: string;
  destination: string;
  status: CommuteStatus;
  statusLabel?: string;
  headline: string;
  etaLabel: string;
  ctaLabel?: string;
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
  destination,
  status,
  statusLabel,
  headline,
  etaLabel,
  ctaLabel = '출발하기',
  onPressCta,
  onChangeArrivalTime,
  onPressDestination,
}: TimeCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const appearance = statusAppearance[status];
  const [pickerVisible, setPickerVisible] = useState(false);

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 130,
      useNativeDriver: true,
    }).start();
  };

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

        <Pressable onPress={() => setPickerVisible(true)} style={styles.timePressable}>
          <Text style={styles.arrivalTime}>{arrivalTime}</Text>
        </Pressable>

        <Pressable
          onPress={onPressDestination}
          style={({ pressed }) => [styles.destinationRow, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Ionicons name="location-outline" size={18} color={appearance.iconTint} />
          <Text style={styles.destination} numberOfLines={1}>
            {destination}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.headline}>{headline}</Text>

        <View style={styles.inlineRowGap}>
          <Ionicons name="walk-outline" size={16} color={appearance.iconTint} />
          <Text style={styles.eta}>{etaLabel}</Text>
        </View>

        <Pressable onPress={onPressCta} onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View
            style={[
              styles.cta,
              { transform: [{ scale }], backgroundColor: appearance.buttonColor },
            ]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Animated.View>
        </Pressable>
      </View>

      <TimeWheelPicker
        visible={pickerVisible}
        initialTime={arrivalTime}
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
    alignItems: 'flex-start',
  },
  arrivalTime: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 52,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  destinationRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destination: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 28,
    color: colors.textSecondary,
    flexShrink: 1,
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
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#58C7C2',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  ctaText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: colors.white,
  },
});
