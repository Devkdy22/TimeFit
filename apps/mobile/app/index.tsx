import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/common/Screen';
import { getHealth } from '../src/services/api/client';
import { tokens } from '../src/theme/tokens';

export default function HomePage() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(`${res.status} (${res.service})`))
      .catch(() => setStatus('api-unreachable'));
  }, []);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>TimeFit</Text>
        <Text style={styles.description}>초기 프로젝트 기반이 정상 동작 중입니다.</Text>
        <View style={styles.row}>
          {status === 'checking' ? <ActivityIndicator color={tokens.color.primary} /> : null}
          <Text style={styles.status}>API Health: {status}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.color.text,
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: tokens.color.subtext,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  status: {
    color: tokens.color.text,
  },
});
