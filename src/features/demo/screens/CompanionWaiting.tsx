import { AppText as Text } from '@/shared/components/AppText';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';

import { PixelHero } from '@/shared/components/PixelHero';
import { Button } from '@/shared/components/Button';
import { useThemeColors } from '@/shared/theme/useTheme';

export function CompanionWaiting({
  active,
  onTestVote,
  testVoteDisabled,
}: {
  active: boolean;
  onTestVote?: () => void;
  testVoteDisabled?: boolean;
}) {
  const colors = useThemeColors();
  const [height] = useState(() => new Animated.Value(0));
  const [dots, setDots] = useState(3);

  useEffect(() => {
    if (!active) return;
    let live = true;
    let changed = false;
    let ticker: ReturnType<typeof setInterval> | undefined;
    const update = (reduced: boolean) => {
      clearInterval(ticker);
      setDots(3);
      height.stopAnimation();
      height.setValue(0);
      if (!reduced) {
        ticker = setInterval(() => setDots((count) => (count % 3) + 1), 480);
        Animated.timing(height, {
          toValue: -27,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      changed = true;
      update(reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (live && !changed) update(reduced);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      clearInterval(ticker);
      subscription.remove();
      height.stopAnimation();
    };
  }, [active, height]);

  return (
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 16 }}>
      <Text
        accessibilityRole="header"
        accessibilityLabel="Ты сделал свой выбор, путник! Ждем остальных..."
        accessibilityLiveRegion="polite"
        style={{ color: colors.textPrimary, textAlign: 'center', fontSize: 18, fontWeight: '700' }}
      >
        {'Ты сделал свой выбор, путник!\nЖдем остальных'}
        {'.'.repeat(dots)}
        <Text style={{ opacity: 0 }}>{'.'.repeat(3 - dots)}</Text>
      </Text>
      <View
        accessible={false}
        style={{ width: 148, height: 138, alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <Animated.View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: 100,
            height: 100,
            transform: [{ translateY: height }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#F5BF4528',
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: '#FFD26748',
            }}
          />
          <PixelHero />
        </Animated.View>
        <View
          style={{
            position: 'absolute',
            bottom: 17,
            width: 112,
            height: 7,
            backgroundColor: '#3AA46C',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 12,
            width: 100,
            height: 5,
            backgroundColor: '#227D50',
          }}
        />
      </View>
      {onTestVote && (
        <Button
          label="Добавить тестовый голос компаньона"
          variant="secondary"
          disabled={testVoteDisabled}
          onPress={onTestVote}
        />
      )}
    </View>
  );
}
