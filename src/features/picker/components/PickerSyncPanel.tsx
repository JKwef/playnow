import { Text, View } from 'react-native';
import { usePickerSync } from '@/features/picker/hooks/usePickerSync';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useThemeColors } from '@/shared/theme/useTheme';
import { formatDateTime } from '@/shared/utils/format';
import type { PickerSnapshot } from '@/features/picker/services/pickerSyncModel';
import type { Game } from '@/features/backlog/types/Game';
import { findContext } from '@/features/picker/utils/contexts';

function describe(snapshot: PickerSnapshot, games: readonly Game[] | undefined): string {
  const choice = snapshot.choice;
  const accepted = choice
    ? `${choice.game.name} · ${new Date(choice.acceptedAt).toLocaleString('ru-RU')} · ${choice.mode === 'new' ? 'Новое' : 'Продолжить'} · ${findContext(choice.contextId)?.title}${choice.genreFilter === 'any' ? ' · без фильтра жанров' : ''}${choice.installedOnly ? ' · только отмеченные установленными' : ''}`
    : 'нет принятого выбора';
  const postponed = Object.entries(snapshot.postponed)
    .map(
      ([id, until]) =>
        `${games?.find((game) => game.appid === Number(id))?.name ?? `Игра ${id}`}: до ${formatDateTime(new Date(until).toISOString())}`,
    )
    .join('\n');
  return `${accepted}\nОтложено: ${Object.keys(snapshot.postponed).length}${postponed ? `\n${postponed}` : ''}`;
}

export function PickerSyncPanel({ games }: { games?: readonly Game[] }) {
  const sync = usePickerSync();
  const colors = useThemeColors();
  const text = { color: colors.textPrimary, fontSize: 15 };
  const busy = sync.phase === 'loading' || sync.phase === 'syncing';
  return (
    <Card style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ ...text, fontWeight: '700' }}>
        Выбор и отложенные игры между устройствами
      </Text>
      <Text style={text}>
        После включения принятый выбор и сроки откладывания хранятся в аккаунте и доступны на других
        устройствах после включения там. История, причины отказа и отметки установки остаются
        локальными.
      </Text>
      <Button
        label={
          sync.enabled
            ? 'Выключить синхронизацию на этом устройстве'
            : 'Включить синхронизацию выбора и отложенных игр'
        }
        variant="secondary"
        disabled={!sync.isReady || busy}
        onPress={() => void sync.enable(!sync.enabled)}
      />
      {sync.enabled && (
        <>
          <Text accessibilityLiveRegion="polite" style={text}>
            {sync.phase === 'synced'
              ? `Синхронизировано${sync.lastSyncedAt ? ` · ${formatDateTime(sync.lastSyncedAt)}` : ''}`
              : sync.phase === 'syncing'
                ? 'Синхронизируем…'
                : sync.phase === 'conflict'
                  ? 'Изменения расходятся. Выберите версию.'
                  : 'Локальные данные доступны. Синхронизация ещё не подтверждена.'}
          </Text>
          <Button
            label="Синхронизировать сейчас"
            variant="tertiary"
            disabled={busy}
            onPress={() => void sync.sync()}
          />
        </>
      )}
      {sync.error && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={{ ...text, color: colors.error }}>
            {sync.error}
          </Text>
          {!sync.isReady && (
            <Button label="Повторить загрузку синхронизации" onPress={() => void sync.sync()} />
          )}
        </View>
      )}
      {sync.conflict && (
        <View style={{ gap: 12 }}>
          <Text style={text}>На устройстве: {describe(sync.conflict.local, games)}</Text>
          <Text style={text}>В аккаунте: {describe(sync.conflict.remote.snapshot, games)}</Text>
          <Text style={text}>
            Выбранная версия заменит и принятый выбор, и сроки откладывания. Остальные локальные
            данные сохранятся.
          </Text>
          <Button
            label="Использовать версию из аккаунта"
            disabled={busy}
            onPress={() => void sync.resolve('remote')}
          />
          <Button
            label="Сохранить текущую версию устройства в аккаунте"
            variant="secondary"
            disabled={busy}
            onPress={() => void sync.resolve('local')}
          />
        </View>
      )}
      {!sync.enabled && (
        <Text style={text}>
          Выключение не удаляет уже сохранённую версию в аккаунте. Без синхронизации изменения
          остаются на этом устройстве.
        </Text>
      )}
    </Card>
  );
}
