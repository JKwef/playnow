import { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import { spacing } from '@/shared/constants';
import type { RootStackScreenProps } from '@/navigation/types';

// Временный список; полноценные контексты с тегами (FR4.1) появятся на этапе 8.
const DEMO_CONTEXTS = [
  { id: 'short-session', label: 'У меня 30 минут' },
  { id: 'addictive', label: 'Хочу залипательное' },
  { id: 'story', label: 'Хочу сюжетку' },
  { id: 'action', label: 'Хочу экшен' },
] as const;

/** Главный экран Solo Mode. Отсюда же переходы в список игр и настройки. */
export function PickerScreen({ navigation }: RootStackScreenProps<'Picker'>) {
  // Кнопки в шапке ставим через setOptions, чтобы замыкать navigation этого экрана.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Button
            label="Игры"
            variant="tertiary"
            accessibilityLabel="Мои игры"
            onPress={() => navigation.navigate('Backlog')}
          />
          <Button
            label="⚙"
            variant="tertiary"
            accessibilityLabel="Настройки"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      ),
    });
  }, [navigation]);

  return (
    <Screen>
      <Placeholder title="Во что поиграть?" stage={8} />
      {DEMO_CONTEXTS.map((context) => (
        <Button
          key={context.id}
          label={context.label}
          variant="secondary"
          onPress={() => navigation.navigate('Result', { contextId: context.id })}
        />
      ))}
      <Button
        label="Экран загрузки бэклога"
        variant="tertiary"
        onPress={() => navigation.navigate('BacklogLoading')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.xs },
});
