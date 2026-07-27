import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeContainer } from '../../src/features/home/screen/HomeContainer';
import type { TimeyState } from '../../src/domain/timey/timeyTypes';

const QA_STATES: TimeyState[] = [
  'idle',
  'confident',
  'waiting',
  'searching',
  'warning',
  'urgent',
  'walking',
  'riding_bus',
  'riding_subway',
];

/** Dev-only HomeContainer path for greeting and lifecycle QA. */
export default function HomeTimeyPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<TimeyState>('idle');
  const [replayNonce, setReplayNonce] = useState(0);

  return (
    <View style={styles.screen}>
      <HomeContainer timeyStateOverride={state} timeyGreetingReplayNonce={replayNonce} />
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.panel, { top: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Home path QA · {state}</Text>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.buttonText}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {QA_STATES.map((nextState) => (
              <Pressable
                key={nextState}
                onPress={() => setState(nextState)}
                style={[styles.chip, state === nextState ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, state === nextState ? styles.chipTextActive : null]}>{nextState}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                setState('idle');
                setReplayNonce((nonce) => nonce + 1);
              }}
              style={styles.replayButton}
            >
              <Text style={styles.buttonText}>greeting replay ({replayNonce})</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/dev/timey-preview')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Stage fixture</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6FBFB' },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 34, 45, 0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#F8FAFC', fontSize: 13, fontFamily: 'Pretendard-SemiBold' },
  chipRow: { gap: 6, paddingTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#4B6470',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipActive: { borderColor: '#58C7C2', backgroundColor: 'rgba(88, 199, 194, 0.25)' },
  chipText: { color: '#B7C5CB', fontSize: 11 },
  chipTextActive: { color: '#ECFEFF' },
  actionRow: { flexDirection: 'row', gap: 6, paddingTop: 8 },
  backButton: { paddingHorizontal: 8, paddingVertical: 4 },
  replayButton: { flex: 1, borderRadius: 8, backgroundColor: '#58C7C2', paddingVertical: 8, alignItems: 'center' },
  secondaryButton: { borderRadius: 8, borderWidth: 1, borderColor: '#4B6470', paddingHorizontal: 10, paddingVertical: 8 },
  buttonText: { color: '#082F35', fontSize: 11, fontFamily: 'Pretendard-SemiBold' },
  secondaryButtonText: { color: '#D7E7EA', fontSize: 11, fontFamily: 'Pretendard-SemiBold' },
});
