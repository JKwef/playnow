import { BrandBar } from './BrandBar';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing } from '@/shared/constants';

export interface ScreenProps {
  children: ReactNode;
  /** Экран без шапки навигатора должен сам отступить от выреза/статус-бара. */
  withTopInset?: boolean;
  /** Центрировать содержимое по вертикали (экраны входа, загрузки, пустые состояния). */
  centered?: boolean;
  showBrandBar?: boolean;
  /** Закреплённое действие; в низком окне или при крупном шрифте прокручивается. */
  footer?: ReactNode;
}

/**
 * Обёртка экрана: фон, безопасные зоны, скролл.
 * Скролл нужен, чтобы контент не обрезался в ландшафте и на iPhone SE (NFR3.3).
 */
export function Screen({
  children,
  withTopInset = false,
  centered = false,
  showBrandBar = true,
  footer,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { height, fontScale } = useWindowDimensions();
  const inlineFooter = height < 600 || fontScale > 1.3;

  const edges: Edge[] =
    withTopInset && !showBrandBar
      ? ['top', 'bottom', 'left', 'right']
      : ['bottom', 'left', 'right'];
  return (
    <View style={styles.safeArea}>
      {withTopInset && showBrandBar && <BrandBar />}
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <ScrollView
          testID="screen-content-scroll"
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          // Filtering can scroll the web container as it shrinks. Keep the active input focused.
          keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        >
          {children}
          {inlineFooter && footer !== undefined && (
            <View style={styles.inlineFooter}>{footer}</View>
          )}
        </ScrollView>
        {!inlineFooter && footer !== undefined && <View style={styles.footer}>{footer}</View>}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
      padding: spacing.md,
      gap: spacing.sm,
    },
    centered: { justifyContent: 'center' },
    inlineFooter: { paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
    footer: {
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
