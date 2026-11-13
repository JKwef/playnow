import { Text, View } from 'react-native';
import type { Game } from '@/features/backlog/types/Game';
import { SteamActions } from '@/features/launch/components/SteamActions';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/theme/useTheme';
import { useAcceptedChoice } from '../hooks/useAcceptedChoice';
import { PICKER_MODE_LABELS } from '../types';
import { findContext } from '../utils/contexts';

export function LastAcceptedChoice({
  games,
  onPickAnother,
  canPickAnother = true,
}: {
  games: readonly Game[] | undefined;
  onPickAnother: () => void;
  canPickAnother?: boolean;
}) {
  const accepted = useAcceptedChoice();
  const { colors } = useTheme();
  const text = { color: colors.textPrimary };
  if (accepted.error && !accepted.isReady)
    return (
      <View>
        <Text accessibilityRole="alert" style={text}>
          {accepted.error}
        </Text>
        <Button label="Повторить загрузку выбора" onPress={accepted.retry} />
      </View>
    );
  const { choice } = accepted;
  if (!choice) return null;
  const game = games?.find((item) => item.appid === choice.game.appid);
  const missing = games !== undefined && !game;
  return (
    <View
      style={{ gap: 10, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}
    >
      <Text accessibilityRole="header" style={text}>
        Последний принятый выбор
      </Text>
      <Text style={text}>{game?.name ?? choice.game.name}</Text>
      <Text style={text}>
        {PICKER_MODE_LABELS[choice.mode]} · {findContext(choice.contextId)?.title}
        {choice.genreFilter === 'any' ? ' · без фильтра жанров' : ''}
        {choice.installedOnly ? ' · при подборе: только отмеченные установленными' : ''}
      </Text>
      <Text style={text}>
        Принято: {new Date(choice.acceptedAt).toLocaleString('ru-RU')}. Сохранено на этом
        устройстве.
      </Text>
      {missing ? (
        <Text accessibilityRole="alert" style={text}>
          Выбранной игры больше нет в доступной библиотеке. Сохранённый выбор оставлен; можно
          подобрать другую игру.
        </Text>
      ) : (
        <>
          {games === undefined && (
            <Text style={text}>Библиотека ещё недоступна. Показан сохранённый выбор.</Text>
          )}
          <SteamActions key={choice.game.appid} appid={choice.game.appid} label="Открыть" />
        </>
      )}
      <Button
        label="Подобрать другое"
        variant="secondary"
        disabled={!canPickAnother}
        onPress={onPickAnother}
      />
      {accepted.canUndo && (
        <Button
          label="Отменить принятие выбора"
          variant="tertiary"
          disabled={accepted.isSaving}
          onPress={() => void accepted.undo()}
        />
      )}
      {accepted.error && (
        <Text accessibilityRole="alert" style={text}>
          {accepted.error}
        </Text>
      )}
    </View>
  );
}
