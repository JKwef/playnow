import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';

import { PixelHero } from '@/shared/components/PixelHero';

import type { ContextId } from '../types';

const propsByContext = {
  'short-session': {
    color: '#44C88F',
    pixels: ['011110', '110011', '100001', '100101', '100001', '100001', '111111'],
  },
  addictive: {
    color: '#AA88EF',
    pixels: ['0000000', '0000000', '0000000', '0111000', '0101010', '0111010', '1111111'],
  },
  story: {
    color: '#6BB8ED',
    pixels: ['0011100', '0111110', '1111111', '0101010', '0111110', '0110110', '1110111'],
  },
  action: {
    color: '#F2B84E',
    pixels: ['000110', '001100', '011000', '111110', '001100', '011000', '010000'],
  },
} satisfies Record<ContextId, { color: string; pixels: readonly string[] }>;

function PropPixels({ context, horizontal = false }: { context: ContextId; horizontal?: boolean }) {
  const { color, pixels } = propsByContext[context];
  const columns = pixels[0]?.length ?? 0;
  return pixels.flatMap((row, y) =>
    Array.from(row, (pixel, x) =>
      pixel === '1' ? (
        <View
          key={`${x}:${y}`}
          style={{
            position: 'absolute',
            left: (horizontal ? y : x) * 3,
            top: (horizontal ? columns - x - 1 : y) * 3,
            width: 3,
            height: 3,
            backgroundColor: color,
          }}
        />
      ) : null,
    ),
  );
}

const scenes = {
  addictive: {
    x: [0, 12, 24, 36, 48, 36, 24, 12, 0],
    y: [0, -8, -10, 0, 0, -8, -10, 0, 0],
    direction: [1, 1, 1, 1, -1, -1, -1, -1, 1],
    opacity: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    scenery: [
      [0, 28, 64, 2],
      [26, 22, 7, 6],
      [34, 25, 6, 3],
    ],
  },
  action: {
    x: [0, 6, 6, 2, 6, 2, 6, 6, 0],
    y: [0, -2, 0, 0, 0, 0, 0, 0, 0],
    direction: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    opacity: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    scenery: [
      [53, 11, 10, 13],
      [50, 14, 16, 7],
    ],
  },
  story: {
    x: [0, 7, 14, 21, 28, 35, 42, 45, 45],
    y: [0, -2, 0, -2, 0, -2, 0, 0, 0],
    direction: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    opacity: [1, 1, 1, 1, 1, 1, 1, 0, 0],
    scenery: [
      [45, 5, 17, 23],
      [42, 3, 23, 5],
      [48, 13, 6, 15],
    ],
  },
  'short-session': {
    x: [10, 25, 44, 44, 1, 1, 22, 44, 44],
    y: [0, -2, 0, 0, 0, 0, -2, 0, 0],
    direction: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    opacity: [1, 1, 1, 0, 0, 1, 1, 1, 0],
    scenery: [
      [0, 5, 12, 23],
      [3, 9, 6, 19],
      [48, 5, 12, 23],
      [51, 9, 6, 19],
    ],
  },
} satisfies Record<
  ContextId,
  {
    x: number[];
    y: number[];
    direction: number[];
    opacity: number[];
    scenery: number[][];
  }
>;
const frames = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function ContextHero({ context, run }: { context: ContextId; run: number }) {
  const [time] = useState(() => new Animated.Value(0));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!run) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const stop = () => {
      animation?.stop();
      if (active) setPlaying(false);
    };
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      if (reduced) stop();
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced) return;
        time.setValue(0);
        setPlaying(true);
        animation = Animated.timing(time, {
          toValue: 8,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        });
        animation.start(({ finished }) => {
          if (active && finished) setPlaying(false);
        });
      })
      .catch(stop);
    return () => {
      active = false;
      stop();
      preference.remove();
    };
  }, [run, time]);

  const scene = scenes[context];
  const animate = (outputRange: number[]) => time.interpolate({ inputRange: frames, outputRange });
  const { color } = propsByContext[context];

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: 64, height: 30, overflow: 'hidden' }}
    >
      {playing ? (
        <>
          {scene.scenery.map(([left, top, width, height], index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                backgroundColor: context !== 'addictive' && index % 2 ? '#254437' : color,
              }}
            />
          ))}
          {context === 'action' && (
            <Animated.View
              style={{
                position: 'absolute',
                left: 18,
                top: 12,
                width: 21,
                height: 18,
                transform: [{ translateX: animate([0, 0, 0, 12, 18, 12, 18, 18, 18]) }],
                opacity: animate([0, 0, 0, 1, 0, 1, 0, 0, 0]),
              }}
            >
              <PropPixels context={context} horizontal />
            </Animated.View>
          )}
          <Animated.View
            style={{
              position: 'absolute',
              top: 4,
              opacity: animate(scene.opacity),
              transform: [
                { translateX: animate(scene.x) },
                { translateY: animate(scene.y) },
                { scaleX: animate(scene.direction) },
              ],
            }}
          >
            <PixelHero scale={0.4} />
          </Animated.View>
        </>
      ) : (
        <>
          <PixelHero scale={0.5} alignPixels />
          <View style={{ position: 'absolute', left: 23, top: context === 'action' ? 4 : 8 }}>
            <PropPixels context={context} />
          </View>
        </>
      )}
    </View>
  );
}
