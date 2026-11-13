import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing } from '@/shared/constants';

export interface ScreenProps {
  children: ReactNode;
  /** Экран без шапки навигатора должен сам отступить от выреза/статус-бара. */
  withTopInset?: boolean;
  /** Центрировать содержимое по вертикали (экраны входа, загрузки, пустые состояния). */
  centered?: boolean;
  /** Постоянно доступное главное действие над нижней безопасной зоной. */
  footer?: ReactNode;
}

/**
 * Обёртка экрана: фон, безопасные зоны, скролл.
 * Скролл нужен, чтобы контент не обрезался в ландшафте и на iPhone SE (NFR3.3).
 */
export function Screen({ children, withTopInset = false, centered = false, footer }: ScreenProps) {
  const styles = useThemedStyles(createStyles);

  const edges: Edge[] = withTopInset
    ? ['top', 'bottom', 'left', 'right']
    : ['bottom', 'left', 'right'];
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ScrollView
        contentContainerStyle={[styles.content, centered && styles.centered]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer !== undefined && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
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
