import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function TransitBottomActions() {
  return (
    <View style={styles.row}>
      <Pressable style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}>
        <Ionicons name="refresh-outline" size={15} color="#0E2C2C" />
        <Text style={styles.label}>경로 재탐색</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}>
        <Ionicons name="locate-outline" size={15} color="#334155" />
        <Text style={styles.label}>위치 재보정</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.btn, pressed ? styles.btnDangerPressed : null]}>
        <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
        <Text style={styles.destructiveText}>이동 종료</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  btn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    paddingVertical: 11,
    alignItems: 'center',
    gap: 4,
  },
  btnPressed: { backgroundColor: '#58C7C2', borderColor: '#34B6AE' },
  btnDangerPressed: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  label: { fontFamily: 'Pretendard-SemiBold', color: '#334155', fontSize: 12 },
  destructiveText: { fontFamily: 'Pretendard-SemiBold', color: '#DC2626', fontSize: 12 },
});
