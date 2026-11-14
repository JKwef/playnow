import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { darkColors } from '@/shared/constants/colors';
import { useThemeColors } from '@/shared/theme/useTheme';

import { BrandReplay } from './BrandReplay';

export function BrandBar({ onBack, controls }: { onBack?: () => void; controls?: ReactNode }) {
  const colors = useThemeColors();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.surface, { backgroundColor: colors.brandPaper }]}
    >
      <View style={[styles.bar, Boolean(controls) && styles.desktopBar]}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="На предыдущий экран"
            onPress={onBack}
            style={styles.back}
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
        )}
        {controls ? <View style={styles.controls}>{controls}</View> : <BrandReplay />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  surface: { width: '100%', alignSelf: 'center' },
  desktopBar: { height: undefined, minHeight: 88, maxWidth: 1200, paddingVertical: 0 },
  bar: {
    height: 112,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { width: '100%', paddingHorizontal: 44 },
  back: {
    position: 'absolute',
    left: 8,
    top: 24,
    zIndex: 1,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: darkColors.background, fontSize: 32 },
});
