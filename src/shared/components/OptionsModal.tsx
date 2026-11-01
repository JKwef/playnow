import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/shared/constants';

import { Button } from './Button';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Дополнительная подпись справа (например, сколько игр в жанре). */
  hint?: string;
}

export interface OptionsModalProps<T extends string> {
  visible: boolean;
  title: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  /** true — можно выбрать несколько (чекбоксы), false — один вариант (радио). */
  multiple: boolean;
  onToggle: (value: T) => void;
  onClose: () => void;
  /** Кнопка «Сбросить» для мульти-выбора. */
  onClear?: () => void;
  emptyText?: string;
}

/**
 * Выпадающий список в виде нижнего листа на системном Modal: без сторонних библиотек.
 * Используется для фильтра по жанрам (мульти-выбор, FR3.3) и сортировки (FR3.4).
 */
export function OptionsModal<T extends string>({
  visible,
  title,
  options,
  selected,
  multiple,
  onToggle,
  onClose,
  onClear,
  emptyText = 'Нет вариантов',
}: OptionsModalProps<T>) {
  const selectedSet = new Set<string>(selected);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
      />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <FlatList
          data={options}
          keyExtractor={(option) => option.value}
          style={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => {
            const checked = selectedSet.has(item.value);
            return (
              <Pressable
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked }}
                accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
                onPress={() => onToggle(item.value)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View
                  style={[multiple ? styles.checkbox : styles.radio, checked && styles.markChecked]}
                >
                  {checked && <Text style={styles.markText}>{multiple ? '✓' : '●'}</Text>}
                </View>
                <Text style={styles.label}>{item.label}</Text>
                {item.hint !== undefined && <Text style={styles.hint}>{item.hint}</Text>}
              </Pressable>
            );
          }}
        />
        <View style={styles.actions}>
          {onClear !== undefined && (
            <View style={styles.action}>
              <Button
                label="Сбросить"
                variant="tertiary"
                disabled={selected.length === 0}
                onPress={onClear}
              />
            </View>
          )}
          <View style={styles.action}>
            <Button label="Готово" onPress={onClose} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const MARK_SIZE = 24;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  list: { flexGrow: 0 },
  empty: { color: colors.textSecondary, fontSize: fontSize.body, paddingVertical: spacing.sm },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowPressed: { opacity: 0.7 },
  checkbox: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChecked: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  markText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  label: { flex: 1, color: colors.textPrimary, fontSize: fontSize.body },
  hint: { color: colors.textSecondary, fontSize: fontSize.body },
  actions: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.sm },
  action: { flex: 1 },
});
