import { AppText as Text } from '@/shared/components/AppText';
import { PixelCheck } from '@/shared/components/PixelCheck';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemeColors, useThemedStyles } from '@/shared/theme/useTheme';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { fontSize, radius, spacing } from '@/shared/constants';

import type { ContextId, PickerContext } from '../types';
import { ContextHero } from './ContextHero';

export interface ContextCardProps {
  context: PickerContext;
  matchingCount: number;
  selected: boolean;
  onPress: (id: ContextId) => void;
  disabled?: boolean;
  showHero?: boolean;
}

export const ContextCard = memo(function ContextCard({
  context,
  matchingCount,
  selected,
  onPress,
  disabled = false,
  showHero = false,
}: ContextCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [heroRun, setHeroRun] = useState(0);
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.3;

  return (
    <Pressable
      onPress={() => {
        onPress(context.id);
        if (showHero) setHeroRun((run) => run + 1);
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        singleColumn && styles.singleColumn,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${context.title}. ${context.description}. Доступно игр: ${matchingCount}`}
      accessibilityHint="Выберет настроение для подбора"
    >
      <View style={styles.top}>
        {showHero ? (
          <ContextHero context={context.id} run={heroRun} />
        ) : (
          <Text style={styles.icon} accessible={false}>
            {context.icon}
          </Text>
        )}
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <PixelCheck color={colors.onPrimary} />}
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
      minWidth: 112,
      minHeight: 136,
      padding: spacing.sm,
      gap: 4,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selected: { borderColor: colors.secondary, backgroundColor: colors.mintMuted },
    singleColumn: { flexBasis: '100%', minHeight: 0 },
    pressed: { opacity: 0.8 },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    icon: { fontSize: 26 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.secondary, backgroundColor: colors.secondary },
    title: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '700' },
    description: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flexGrow: 1 },
    count: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    countSelected: { color: colors.secondary },
  });
