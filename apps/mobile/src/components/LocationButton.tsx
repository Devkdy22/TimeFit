import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface LocationButtonProps {
  isLoading: boolean;
  error: string | null;
  onPress: () => void;
  onRetry: () => void;
  onOpenSettings?: () => void;
}

export function LocationButton({ isLoading, error, onPress, onRetry, onOpenSettings }: LocationButtonProps) {
  const shouldShowSettingsButton =
    !!error && error.includes('위치 권한이 필요합니다') && Platform.OS === 'android';

  return (
    <View style={styles.wrapper}>
      <Pressable
        disabled={isLoading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          isLoading ? styles.buttonDisabled : null,
          pressed && !isLoading ? styles.buttonPressed : null,
        ]}
      >
        {isLoading ? (
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
          <View style={styles.errorActions}>
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>재시도</Text>
            </Pressable>
            {shouldShowSettingsButton ? (
              <Pressable onPress={onOpenSettings} style={styles.settingsButton}>
                <Text style={styles.settingsText}>설정 열기</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <Text style={styles.webHint}>
          웹에서는 브라우저 위치 권한 허용이 필요하며, HTTPS(또는 localhost) 환경에서만 동작합니다.
        </Text>
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
  errorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  retryButton: {
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
  settingsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E4ECFF',
  },
  settingsText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 12,
  },
  webHint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
});
