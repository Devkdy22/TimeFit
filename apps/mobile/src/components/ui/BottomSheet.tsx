import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';

export interface BottomSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, title, onClose, children, style }: BottomSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;

  const openAnimation = useMemo(
    () =>
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: theme.motion.duration.normal,
          easing: Easing.bezier(...theme.motion.easing.standard),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: theme.motion.duration.normal,
          easing: Easing.bezier(...theme.motion.easing.standard),
          useNativeDriver: true,
        }),
      ]),
    [backdropOpacity, translateY],
  );

  const closeAnimation = useMemo(
    () =>
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: theme.motion.duration.fast,
          easing: Easing.bezier(...theme.motion.easing.exit),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 32,
          duration: theme.motion.duration.fast,
          easing: Easing.bezier(...theme.motion.easing.exit),
          useNativeDriver: true,
        }),
      ]),
    [backdropOpacity, translateY],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      openAnimation.start();
      return;
    }

    closeAnimation.start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [closeAnimation, openAnimation, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal transparent visible onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }, style]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.background.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.background.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    maxHeight: '74%',
    ...theme.elevation.lg,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border.strong,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  scroll: {
    flexGrow: 0,
  },
});
