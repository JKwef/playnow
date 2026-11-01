import { StyleSheet, Text } from 'react-native';

import { colors, fontSize } from '@/shared/constants';

export interface PlaceholderProps {
  title: string;
  /** На каком этапе экран получит реальную реализацию. */
  stage: number;
}

/** Временная подпись для экранов-заглушек этапа 2. Удалится по мере реализации экранов. */
export function Placeholder({ title, stage }: PlaceholderProps) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.note}>Заглушка, реализация на этапе {stage}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: fontSize.body },
});
