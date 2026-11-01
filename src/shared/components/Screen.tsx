import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/constants';

export interface ScreenProps {
  children: ReactNode;
  /** Экран без шапки навигатора должен сам отступить от выреза/статус-бара. */
  withTopInset?: boolean;
  /** Центрировать содержимое по вертикали (экраны входа, загрузки, пустые состояния). */
  centered?: boolean;
}

/**
 * Обёртка экрана: фон, безопасные зоны, скролл.
 * Скролл нужен, чтобы контент не обрезался в ландшафте и на iPhone SE (NFR3.3).
 */
export function Screen({ children, withTopInset = false, centered = false }: ScreenProps) {
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.sm, gap: spacing.sm },
  centered: { justifyContent: 'center' },
});
