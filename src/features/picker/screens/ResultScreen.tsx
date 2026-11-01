import { StyleSheet, Text } from 'react-native';

import { genreLabel } from '@/features/backlog/utils/genres';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize } from '@/shared/constants';

import { GameResult } from '../components/GameResult';
import { useGamePicker } from '../hooks/useGamePicker';
import { POSTPONE_DAYS } from '../services/blacklist';
import type { PickerContext } from '../types';
import { findContext } from '../utils/contexts';

/** Результат подбора (FR4.3, UI2). */
export function ResultScreen({ route, navigation }: RootStackScreenProps<'Result'>) {
  const context = findContext(route.params.contextId);
  if (context === undefined) {
    // Например, устаревшая ссылка playnow://result/<id>.
    return (
      <Screen centered>
        <Text style={styles.title}>Неизвестный контекст</Text>
        <Button label="К выбору контекста" onPress={() => navigation.navigate('Picker')} />
      </Screen>
    );
  }
  return <PickedGame context={context} onBack={() => navigation.goBack()} />;
}

function PickedGame({ context, onBack }: { context: PickerContext; onBack: () => void }) {
  const { status, game, postponedCount, next, postpone, isLastOption } = useGamePicker(context);

  if (status === 'loading') {
    return <LoadingIndicator fullScreen label="Подбираем игру" />;
  }

  if (status === 'empty' || game === null) {
    return (
      <Screen centered>
        <Text accessibilityRole="header" style={styles.title}>
          Нет игр под этот контекст. Попробуйте другой
        </Text>
        <Text style={styles.secondary}>
          Нужны игры с жанрами: {context.genres.map(genreLabel).join(', ')}
          {context.maxPlaytimeMinutes !== undefined
            ? ` и временем в игре меньше ${context.maxPlaytimeMinutes} мин`
            : ''}
          .{postponedCount > 0 ? ` Отложено игр: ${postponedCount}.` : ''}
        </Text>
        <Button label="Выбрать другой контекст" onPress={onBack} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.context}>
        {context.icon} {context.title}
      </Text>
      <GameResult game={game} />
      {/* Запуск steam://run/<appid> и ошибку «Steam не установлен» подключим на этапе 9. */}
      <Button label="Играть" accessibilityHint="Запустит игру в Steam" disabled />
      <Button
        label="Другой вариант"
        variant="secondary"
        disabled={isLastOption}
        accessibilityHint="Подберёт другую игру под этот контекст"
        onPress={next}
      />
      <Button
        label="Отложить"
        variant="tertiary"
        accessibilityHint={`Не предлагать эту игру ${POSTPONE_DAYS} дней`}
        onPress={() => void postpone()}
      />
      <Text style={styles.note}>
        {isLastOption ? 'Это единственная подходящая игра. ' : ''}
        Запуск через Steam появится на этапе 9.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondary: { color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' },
  context: { color: colors.secondary, fontSize: fontSize.body, fontWeight: '600' },
  note: { color: colors.textSecondary, fontSize: fontSize.caption + 2, textAlign: 'center' },
});
