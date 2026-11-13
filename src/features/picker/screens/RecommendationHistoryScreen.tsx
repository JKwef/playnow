import { useState } from 'react';
import { Text, View } from 'react-native';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { useGamePreferences } from '@/features/backlog/hooks/useGamePreferences';
import { SteamActions } from '@/features/launch/components/SteamActions';
import { useAcceptedChoice } from '@/features/picker/hooks/useAcceptedChoice';
import { useBlacklist } from '@/features/picker/hooks/useBlacklist';
import { useRecommendationHistory } from '@/features/picker/hooks/useRecommendationHistory';
import { HISTORY_LIMIT, recommendationId } from '@/features/picker/services/recommendationHistory';
import { PICKER_MODE_LABELS } from '@/features/picker/types';
import { findContext } from '@/features/picker/utils/contexts';
import { filterCandidates } from '@/features/picker/utils/pickGame';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Screen } from '@/shared/components/Screen';
import { useThemeColors } from '@/shared/theme/useTheme';
import { confirmAction } from '@/shared/utils/confirm';
import { formatDateTime } from '@/shared/utils/format';
import { REFUSAL_LABELS } from '@/features/picker/types/refusal';
import { useInstalledGames } from '@/features/backlog/hooks/useInstalledGames';

export function RecommendationHistoryScreen({
  navigation,
}: RootStackScreenProps<'RecommendationHistory'>) {
  const history = useRecommendationHistory();
  const backlog = useBacklog();
  const preferences = useGamePreferences();
  const blacklist = useBlacklist();
  const accepted = useAcceptedChoice();
  const installed = useInstalledGames();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<string | null>(null);
  const text = { color: colors.textPrimary, fontSize: 16 };
  return (
    <Screen>
      <Text style={text}>
        Последние {HISTORY_LIMIT} рекомендаций на этом устройстве. Повтор той же игры с теми же
        условиями поднимается вверх. Просмотр истории не меняет принятый выбор.
      </Text>
      {!history.isReady && !history.error && <Text style={text}>Загружаем историю…</Text>}
      {history.error && (
        <>
          <Text accessibilityRole="alert" style={{ ...text, color: colors.error }}>
            {history.error}
          </Text>
          <Button
            label="Повторить загрузку истории"
            variant="secondary"
            disabled={history.isSaving}
            onPress={history.retry}
          />
        </>
      )}
      {history.isReady && history.entries.length === 0 && (
        <Text style={text}>
          История пока пуста. Здесь появятся игры, показанные в новом подборе.
        </Text>
      )}
      {history.entries.map((entry) => {
        const id = recommendationId(entry);
        const context = findContext(entry.contextId)!;
        const game = backlog.games?.find((item) => item.appid === entry.game.appid);
        const expanded = selected === id;
        const ready =
          backlog.games !== undefined &&
          !preferences.isLoading &&
          !preferences.isUnavailable &&
          !blacklist.isLoading &&
          (!entry.installedOnly || installed.isReady) &&
          !blacklist.errorMessage;
        const eligible =
          ready &&
          game &&
          filterCandidates([game], context, {
            mode: entry.mode,
            preferences: preferences.preferences,
            exclude: new Set(blacklist.postponed.keys()),
            ignoreGenres: entry.genreFilter === 'any',
            installedOnly: entry.installedOnly,
            installedIds: installed.marked,
          }).length > 0;
        return (
          <Card key={id} style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ ...text, fontWeight: '700' }}>
              {entry.game.name}
            </Text>
            <Text style={{ ...text, color: colors.textSecondary }}>
              Показано: {formatDateTime(entry.shownAt)}
            </Text>
            <Text style={text}>
              {PICKER_MODE_LABELS[entry.mode]} · {context.title}
              {entry.genreFilter === 'any' ? ' · без фильтра жанров' : ''}
              {entry.installedOnly ? ' · только отмеченные установленными' : ''}
            </Text>
            {entry.refusal && (
              <Text style={text}>
                Последняя причина отказа: {REFUSAL_LABELS[entry.refusal.reason]} ·{' '}
                {formatDateTime(entry.refusal.savedAt)}
              </Text>
            )}
            <Button
              label={expanded ? 'Свернуть рекомендацию' : 'Открыть рекомендацию'}
              accessibilityLabel={`${expanded ? 'Свернуть' : 'Открыть'} рекомендацию ${entry.game.name}`}
              variant="secondary"
              onPress={() => setSelected(expanded ? null : id)}
            />
            {expanded && (
              <View style={{ gap: 12 }}>
                {entry.refusal && (
                  <Button
                    label="Удалить причину отказа"
                    variant="tertiary"
                    disabled={history.isSaving}
                    onPress={() => void history.setRefusal(id, null)}
                  />
                )}
                <Text style={text}>
                  Сохранены название и условия прошлого подбора. Доступность проверяется по текущей
                  библиотеке, статусам и отложенным играм.
                </Text>
                {!ready ? (
                  <>
                    <Text style={text}>
                      Пока не удалось проверить доступность. Сохранённая рекомендация остаётся в
                      истории.
                    </Text>
                    <Button
                      label="Повторить проверку доступности"
                      variant="secondary"
                      onPress={() => {
                        void backlog.refresh();
                        void preferences.retry();
                        void blacklist.retry();
                        if (entry.installedOnly) void installed.retry();
                      }}
                    />
                  </>
                ) : !game ? (
                  <Text style={text}>
                    Игры больше нет в доступной библиотеке. Сохранено её прежнее название.
                  </Text>
                ) : !eligible ? (
                  <Text style={text}>
                    Сейчас игра не соответствует сохранённым условиям: изменились режим, жанры,
                    статус, откладывание или отметка установки. Проверьте её карточку в библиотеке.
                  </Text>
                ) : null}
                <Button
                  label={accepted.isSaving ? 'Сохраняем выбор…' : 'Выбираю эту игру из истории'}
                  disabled={!eligible || !accepted.isReady || accepted.isSaving}
                  onPress={() => {
                    if (eligible && game)
                      void accepted.accept({
                        game: { appid: game.appid, name: game.name },
                        contextId: entry.contextId,
                        mode: entry.mode,
                        genreFilter: entry.genreFilter,
                        ...(entry.installedOnly ? { installedOnly: true } : {}),
                      });
                  }}
                />
                {game && (
                  <Button
                    label="Карточка в библиотеке"
                    variant="secondary"
                    onPress={() => navigation.navigate('GameDetails', { appid: game.appid })}
                  />
                )}
                {game && <SteamActions key={game.appid} appid={game.appid} />}
              </View>
            )}
          </Card>
        );
      })}
      {accepted.choice && (
        <Text accessibilityLiveRegion="polite" style={text}>
          Принятый выбор: «{accepted.choice.game.name}». Сохранён на этом устройстве.
        </Text>
      )}
      {accepted.canUndo && (
        <Button
          label="Отменить принятие выбора"
          variant="tertiary"
          disabled={accepted.isSaving}
          onPress={() => void accepted.undo()}
        />
      )}
      {accepted.error && (
        <>
          <Text accessibilityRole="alert" style={{ ...text, color: colors.error }}>
            {accepted.error}
          </Text>
          {!accepted.isReady && (
            <Button
              label="Повторить загрузку выбора"
              variant="secondary"
              onPress={accepted.retry}
            />
          )}
        </>
      )}
      {(history.entries.length > 0 || history.error) && (
        <Button
          label="Очистить историю рекомендаций"
          variant="tertiary"
          disabled={history.isSaving}
          onPress={() => {
            void confirmAction({
              title: 'Очистить историю?',
              message:
                'Рекомендации будут удалены только на этом устройстве. Принятый выбор сохранится.',
              confirmLabel: 'Очистить',
              destructive: true,
            }).then((confirmed) => {
              if (confirmed) void history.clear();
            });
          }}
        />
      )}
      <Button
        label="К подбору"
        variant="secondary"
        onPress={() => navigation.popTo('Main', { screen: 'Picker' })}
      />
    </Screen>
  );
}
