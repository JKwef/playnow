import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/shared/components/Card';
import { colors, fontSize, spacing } from '@/shared/constants';

import type { ContextId, PickerContext } from '../types';

export interface ContextCardProps {
  context: PickerContext;
  /** Сколько игр подходит под контекст (без учёта отложенных): подсказка под описанием. */
  matchingCount: number;
  onPress: (id: ContextId) => void;
}

/** Карточка контекста Solo Mode (UI2): иконка, название, описание. */
export const ContextCard = memo(function ContextCard({
  context,
  matchingCount,
  onPress,
}: ContextCardProps) {
  return (
    <Card
      onPress={() => onPress(context.id)}
      style={styles.card}
      accessibilityLabel={`${context.title}. ${context.description}. Подходит игр: ${matchingCount}`}
      accessibilityHint="Подберёт игру из вашего бэклога"
    >
      <Text style={styles.icon} accessible={false}>
        {context.icon}
      </Text>
      <Text style={styles.title}>{context.title}</Text>
      <Text style={styles.description}>{context.description}</Text>
      <Text style={styles.count}>Подходит игр: {matchingCount}</Text>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 168, padding: spacing.sm, gap: 6 },
  icon: { fontSize: 32 },
  title: { color: colors.textPrimary, fontSize: fontSize.body + 1, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: fontSize.caption + 1, flexGrow: 1 },
  count: { color: colors.secondary, fontSize: fontSize.caption + 1 },
});
