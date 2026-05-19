import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AlternateRouteCard({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.title}>더 나은 경로가 있어요!</Text>
        <Text style={styles.sub}>현재 경로보다 약 3분 절약 가능</Text>
      </View>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>경로 변경</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#EAF8F7',
    borderWidth: 1,
    borderColor: '#58C7C2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flex: 1, gap: 2 },
  title: { fontFamily: 'Pretendard-ExtraBold', fontSize: 18, color: '#0E2C2C' },
  sub: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#294948' },
  button: { borderRadius: 14, backgroundColor: '#34B6AE', paddingHorizontal: 16, paddingVertical: 11 },
  buttonText: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#FFFFFF' },
});
