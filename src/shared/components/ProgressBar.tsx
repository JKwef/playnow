import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/shared/constants';

export interface ProgressBarProps {
  /** Текст для скринридера. */
  label: string;
}

/**
 * Неопределённый прогресс-бар: бегущая полоса.
 * Точного процента у импорта нет (Steam отдаёт библиотеку одним ответом),
 * поэтому честнее показывать движение, а не выдуманные проценты.
 */
export function ProgressBar({ label }: ProgressBarProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-120, 320] });

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bar: {
    width: 120,
    height: '100%',
    borderRadius: radius.button,
    backgroundColor: colors.secondary,
  },
});
