import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { PixelHero } from '@/shared/components/PixelHero';

const companion = [
  [6, 2, 13, 3, '#283B58'],
  [3, 5, 19, 4, '#345875'],
  [3, 9, 18, 2, '#58BDB0'],
  [6, 11, 14, 8, '#F2BE93'],
  [7, 13, 2, 2, '#111912'],
  [12, 13, 2, 2, '#111912'],
  [7, 19, 13, 3, '#F0AA49'],
  [6, 22, 14, 8, '#507ABA'],
  [3, 21, 4, 7, '#345875'],
  [20, 22, 3, 6, '#F2BE93'],
  [7, 30, 4, 6, '#283B58'],
  [15, 30, 4, 6, '#283B58'],
] as const;

export function CompanionPair({ active }: { active: boolean }) {
  const [blinking, setBlinking] = useState<'hero' | 'companion' | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    let changed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let reopen: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearInterval(timer);
      clearTimeout(reopen);
    };
    const update = (reduced: boolean) => {
      stop();
      setBlinking(null);
      if (!reduced) {
        let next: 'hero' | 'companion' = 'hero';
        timer = setInterval(() => {
          setBlinking(next);
          next = next === 'hero' ? 'companion' : 'hero';
          reopen = setTimeout(() => setBlinking(null), 260);
        }, 2100);
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
      stop();
      subscription.remove();
    };
  }, [active]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}
    >
      <PixelHero scale={0.6} alignPixels eyesOpen={!active || blinking !== 'hero'} />
      <View style={{ width: 24, height: 36 }}>
        {companion.map(([left, top, width, height, backgroundColor], index) =>
          blinking === 'companion' && active && top === 13 ? null : (
            <View
              key={index}
              style={{ position: 'absolute', left, top, width, height, backgroundColor }}
            />
          ),
        )}
      </View>
    </View>
  );
}
