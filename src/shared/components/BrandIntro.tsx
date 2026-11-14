import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PixelCursor, PixelHero } from './PixelHero';

export const COMPACT_BRAND_SIZE = 56;
export const BRAND_HEADER_WIDTH = 176;
export const BRAND_INTRO_DURATION_MS = 3600;

/** Одна временная шкала синхронизирует прыжок, сальто, Play, клик и финальный логотип. */
export function BrandIntro({
  allowReplay = false,
  compact = false,
  inHeader = false,
  replayRequest = 0,
  headerWidth = BRAND_HEADER_WIDTH,
}: {
  allowReplay?: boolean;
  compact?: boolean;
  inHeader?: boolean;
  replayRequest?: number;
  headerWidth?: number;
}) {
  const styles = useThemedStyles(createStyles);

  const [time] = useState(() => new Animated.Value(BRAND_INTRO_DURATION_MS));
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(true);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    let active = true;
    let motionChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      motionChanged = true;
      setReducedMotion(reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (active && !motionChanged) setReducedMotion(reduced);
      })
      .catch(() => {
        if (active && !motionChanged) setReducedMotion(true);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion !== false || (inHeader && replayRequest === 0)) {
      time.setValue(BRAND_INTRO_DURATION_MS);
      return;
    }
    const frame = inHeader ? null : requestAnimationFrame(() => setFinished(false));
    time.setValue(0);
    const animation = Animated.timing(time, {
      toValue: BRAND_INTRO_DURATION_MS,
      duration: BRAND_INTRO_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start(({ finished: completed }) => {
      if (completed && !inHeader) setFinished(true);
    });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      animation.stop();
    };
  }, [inHeader, reducedMotion, replayRequest, run, time]);

  const interpolate = (inputRange: number[], outputRange: number[]) =>
    time.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  const skip = () => {
    time.stopAnimation();
    time.setValue(BRAND_INTRO_DURATION_MS);
    setFinished(true);
  };

  return (
    <View
      style={[styles.panel, compact && styles.compact, inHeader && styles.headerPanel]}
      testID="brand-intro"
    >
      <View
        style={[styles.frame, compact && styles.compactFrame]}
        onLayout={inHeader ? undefined : (event) => setWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          pointerEvents="none"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Quaeso: герой делает сальто и нажимает Play"
          style={[
            styles.scene,
            {
              opacity: interpolate([0, 2960, 3340], [1, 1, 0]),
              transform: [
                {
                  scale: compact
                    ? COMPACT_BRAND_SIZE / 158
                    : (inHeader ? headerWidth : width) / 320,
                },
              ],
            },
          ]}
        >
          <View style={styles.halo} />
          <View style={styles.ring} />
          <View style={styles.counter} />
          <View style={styles.qTail} />
          <View style={styles.steps}>
            {[0, 1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={{
                  position: 'absolute',
                  left: step * 11,
                  top: 20 - step * 5,
                  width: 11,
                  height: 5,
                  backgroundColor: '#43C28F',
                }}
              />
            ))}
          </View>
          <Animated.View
            style={[
              styles.shadow,
              {
                opacity: interpolate([0, 420, 900, 1450, 1650], [0.15, 0.15, 0.04, 0.2, 0.15]),
                transform: [
                  { scaleX: interpolate([0, 420, 900, 1450, 1650], [1, 1, 0.5, 1.2, 1]) },
                ],
              },
            ]}
          />
          <Animated.View
            testID="brand-hero"
            style={[
              styles.hero,
              {
                transform: [
                  {
                    translateY: interpolate(
                      [0, 220, 420, 720, 1040, 1450, 1550, 1650],
                      [0, 0, 4, -30, -40, 0, 3, 0],
                    ),
                  },
                  {
                    rotate: time.interpolate({
                      inputRange: [0, 720, 1450, 3600],
                      outputRange: ['0deg', '0deg', '-360deg', '-360deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    scaleY: interpolate(
                      [0, 220, 420, 520, 1450, 1550, 1650],
                      [1, 1, 0.82, 1, 1, 0.82, 1],
                    ),
                  },
                ],
              },
            ]}
          >
            <PixelHero />
          </Animated.View>
          <Animated.View
            testID="brand-play"
            style={[
              styles.play,
              compact && styles.compactPlay,
              {
                opacity: interpolate([0, 1650, 1950], [0, 0, 1]),
                transform: [
                  {
                    scale: interpolate(
                      [0, 1650, 1900, 2020, 2670, 2760, 2860],
                      [0.4, 0.4, 1.08, 1, 1, 0.88, 1],
                    ),
                  },
                ],
              },
            ]}
          >
            <View style={styles.triangle} />
          </Animated.View>
          <Animated.View
            style={[
              styles.ripple,
              compact && styles.compactRipple,
              {
                opacity: interpolate([0, 2720, 2760, 3090], [0, 0, 0.7, 0]),
                transform: [{ scale: interpolate([0, 2720, 3090], [0.7, 0.7, 1.65]) }],
              },
            ]}
          />
          <Animated.View
            testID="brand-cursor"
            style={[
              styles.cursor,
              compact && styles.compactCursor,
              {
                opacity: interpolate([0, 2000, 2130, 2860, 3060], [0, 0, 1, 1, 0]),
                transform: [
                  { translateX: interpolate([0, 2000, 2600], [80, 80, 0]) },
                  {
                    translateY: interpolate(
                      [0, 2000, 2600, 2720, 2760, 2860],
                      [48, 48, 0, 0, 3, 0],
                    ),
                  },
                ],
              },
            ]}
          >
            <PixelCursor />
          </Animated.View>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.final,
            {
              opacity: interpolate([0, 2960, 3400], [0, 0, 1]),
              transform: [{ scale: interpolate([0, 2960, 3400], [0.94, 0.94, 1]) }],
            },
          ]}
        >
          <Image
            testID="brand-wordmark"
            source={
              compact
                ? require('../../../assets/brand/quaeso-icon.png')
                : require('../../../assets/brand/quaeso-logo.png')
            }
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="QUAESO"
          />
        </Animated.View>
      </View>
      {!compact && !inHeader && reducedMotion === false && (!finished || allowReplay) && (
        <Pressable
          onPress={finished ? () => setRun((current) => current + 1) : skip}
          accessibilityRole="button"
          accessibilityLabel={
            finished ? 'Повторить анимацию логотипа' : 'Пропустить анимацию логотипа'
          }
          style={styles.control}
        >
          <Text style={styles.controlText}>{finished ? 'Повторить ↻' : 'Пропустить →'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.brandPaper,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
      width: '100%',
      overflow: 'hidden',
    },
    headerPanel: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 12 },
    compact: {
      width: COMPACT_BRAND_SIZE,
      height: COMPACT_BRAND_SIZE,
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      borderRadius: 12,
    },
    frame: { width: '100%', aspectRatio: 2.02 },
    compactFrame: {
      width: COMPACT_BRAND_SIZE,
      height: COMPACT_BRAND_SIZE,
      aspectRatio: 1,
      overflow: 'hidden',
    },
    scene: {
      position: 'absolute',
      width: 320,
      height: 158,
      top: 0,
      left: 0,
      transformOrigin: 'left top',
    },
    halo: {
      position: 'absolute',
      width: 146,
      height: 146,
      borderRadius: 73,
      left: 12,
      top: 4,
      backgroundColor: '#43C28F',
    },
    ring: {
      position: 'absolute',
      width: 142,
      height: 142,
      borderRadius: 71,
      left: 16,
      top: 8,
      backgroundColor: '#07110B',
    },
    counter: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      left: 37,
      top: 29,
      backgroundColor: '#FFFFFF',
    },
    qTail: {
      position: 'absolute',
      left: 109,
      top: 112,
      width: 0,
      height: 0,
      borderTopWidth: 22,
      borderBottomWidth: 22,
      borderLeftWidth: 36,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: '#3ACA80',
    },
    hero: { position: 'absolute', left: 67, top: 51 },
    steps: { position: 'absolute', left: 58, top: 94, width: 55, height: 25 },
    shadow: {
      position: 'absolute',
      left: 69,
      top: 109,
      width: 34,
      height: 5,
      borderRadius: 17,
      backgroundColor: '#07110B',
    },
    play: {
      position: 'absolute',
      left: 211,
      top: 53,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#43C28F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactPlay: { left: 103, top: 92, width: 48, height: 48 },
    compactRipple: { left: 103, top: 92, width: 48, height: 48 },
    compactCursor: { left: 128, top: 116 },
    triangle: {
      width: 0,
      height: 0,
      marginLeft: 5,
      borderTopWidth: 11,
      borderBottomWidth: 11,
      borderLeftWidth: 17,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: '#07110B',
    },
    cursor: { position: 'absolute', left: 243, top: 83 },
    ripple: {
      position: 'absolute',
      left: 212,
      top: 54,
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: '#22865B',
    },
    final: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    image: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    control: {
      position: 'absolute',
      right: 12,
      bottom: 0,
      minHeight: 40,
      paddingHorizontal: 10,
      justifyContent: 'center',
    },
    controlText: { color: '#316248', fontSize: 11, fontWeight: '600' },
  });
