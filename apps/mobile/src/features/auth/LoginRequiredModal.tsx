import { BottomCTA, BottomSheet } from '../../components/ui';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { useNavigationHelper } from '../../utils/navigation';

interface LoginRequiredModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ visible, onClose }: LoginRequiredModalProps) {
  const nav = useNavigationHelper();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="로그인이 필요해요">
      <View style={styles.copyArea}>
        <Text style={styles.title}>루틴 저장은 로그인 후 사용할 수 있어요.</Text>
        <Text style={styles.body}>계정을 연결하면 루틴을 자동 동기화하고 매일 이어서 사용할 수 있습니다.</Text>
      </View>

      <BottomCTA
        label="로그인하고 저장"
        status="warning"
        onPress={() => {
          onClose();
          nav.goToSettings();
        }}
      />

      <BottomCTA label="나중에 하기" status="relaxed" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  copyArea: {
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  body: {
    ...theme.typography.body.md,
    color: theme.colors.text.secondary,
  },
});
