import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { RecentDestination } from './types';

interface RecentItemProps {
  item: RecentDestination;
}

export function RecentItem({ item }: RecentItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="navigate-outline" size={18} color="#58C7C2" />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>

      <View style={styles.timeWrap}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.time}>{item.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(88, 199, 194, 0.12)',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(88, 199, 194, 0.12)',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: colors.textSecondary,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
});
