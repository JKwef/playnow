import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { BRAND_HEADER_WIDTH, BrandIntro } from './BrandIntro';

export function BrandReplay({ width = BRAND_HEADER_WIDTH }: { width?: number }) {
  const [run, setRun] = useState(0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Quaeso — запустить анимацию логотипа"
      onPress={() => setRun((current) => current + 1)}
      style={[styles.trigger, { width, height: width / 2 }]}
    >
      <BrandIntro inHeader headerWidth={width} replayRequest={run} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
