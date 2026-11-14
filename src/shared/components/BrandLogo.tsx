import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Короткое появление без блокировки интерфейса, с учётом Reduce Motion. */
export function BrandLogo({
  animated = false,
  compact = false,
}: {
  animated?: boolean;
  compact?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!animated) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const settle = () => {
      animation?.stop();
      progress.setValue(1);
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      if (reduced) settle();
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced) return;
        progress.setValue(0);
        animation = Animated.timing(progress, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        });
        animation.start();
      })
      .catch(settle);
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [animated, progress]);

  return (
    <Animated.View
      style={[
        compact ? styles.compact : styles.panel,
        {
          opacity: progress,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <View style={compact ? styles.mark : styles.logoFrame}>
        <Image
          source={
            compact
              ? require('../../../assets/brand/quaeso-icon.png')
              : require('../../../assets/brand/quaeso-logo.png')
          }
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Quaeso"
        />
      </View>
    </Animated.View>
  );
}

export function BrandHeader() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <BrandLogo compact />
      <Text style={styles.wordmark}>
        quaeso<Text style={styles.dot}>.</Text>
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: { backgroundColor: colors.brandPaper, borderRadius: 24, padding: 20, width: '100%' },
    logoFrame: { width: '100%', aspectRatio: 2.02 },
    image: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    compact: {
      width: 56,
      height: 56,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.brandPaper,
    },
    mark: { width: 56, height: 56 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    wordmark: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -1 },
    dot: { color: colors.secondary },
  });
