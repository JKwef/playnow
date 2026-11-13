import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSize, radius, spacing } from '@/shared/constants';

import type { ContextId, PickerContext } from '../types';

export interface ContextCardProps {
  context: PickerContext;
  matchingCount: number;
  selected: boolean;
  onPress: (id: ContextId) => void;
}

export const ContextCard = memo(function ContextCard({
  context,
  matchingCount,
  selected,
  onPress,
}: ContextCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={() => onPress(context.id)}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${context.title}. ${context.description}. Доступно игр: ${matchingCount}`}
      accessibilityHint="Выберет настроение для подбора"
    >
      <View style={styles.top}>
        <Text style={styles.icon} accessible={false}>
          {context.icon}
        </Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </View>
      <Text style={styles.title}>{context.title}</Text>
      <Text style={styles.description}>{context.description}</Text>
      <Text style={[styles.count, selected && styles.countSelected]}>
        {matchingCount > 0 ? `${matchingCount} в подборе` : 'Пока нет игр'}
      </Text>
    </Pressable>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexBasis: '45%',
      flexGrow: 1,
      minWidth: 128,
      minHeight: 168,
      padding: spacing.sm,
      gap: 8,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selected: { borderColor: colors.secondary, backgroundColor: colors.mintMuted },
    pressed: { opacity: 0.8 },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    icon: { fontSize: 26 },
    radio: {
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.secondary },
    radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
    title: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '700' },
    description: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flexGrow: 1 },
    count: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    countSelected: { color: colors.secondary },
  });
