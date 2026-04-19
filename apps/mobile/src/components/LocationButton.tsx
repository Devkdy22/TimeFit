import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface LocationButtonProps {
  loading: boolean;
  onPress: () => void;
  onRetry: () => void;
  error: string | null;
}

export function LocationButton({ loading, onPress, onRetry, error }: LocationButtonProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          loading ? styles.buttonDisabled : null,
          pressed && !loading ? styles.buttonPressed : null,
        ]}
      >
        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.buttonText}>현재 위치 확인 중...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>내 위치</Text>
        )}
      </Pressable>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>재시도</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  button: {
    backgroundColor: '#0B3A82',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FFF2F0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD3CC',
    padding: 10,
    gap: 8,
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE4E2',
  },
  retryText: {
    color: '#B42318',
    fontWeight: '700',
    fontSize: 12,
  },
});
