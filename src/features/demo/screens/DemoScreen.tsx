import { useState } from 'react';
import { Text, View } from 'react-native';

import type { Game } from '@/features/backlog/types/Game';
import { ContextCard } from '@/features/picker/components/ContextCard';
import { PICKER_MODE_LABELS, type PickerMode } from '@/features/picker/types';
import { PICKER_CONTEXTS } from '@/features/picker/utils/contexts';
import { filterCandidates, pickGame } from '@/features/picker/utils/pickGame';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { useThemeColors } from '@/shared/theme/useTheme';

// Fictional examples stay in this screen's memory. No account, cache or external links.
const examples: readonly Game[] = ['Лабиринт', 'Ещё один круг', 'Затерянный мир', 'Рывок'].flatMap(
  (name, index) =>
    [0, 90].map((playtimeMinutes, variant) => ({
      appid: -(index * 2 + variant + 1),
      name: `${name}${variant ? ': продолжение' : ''}`,
      genres: [...PICKER_CONTEXTS[index]!.genres],
      playtimeMinutes,
      coverUrl: null,
      addedAt: '2026-01-01T00:00:00.000Z',
      lastPlayedAt: null,
    })),
);

export function DemoScreen({ navigation }: RootStackScreenProps<'Demo'>) {
  const colors = useThemeColors();
  const [context, setContext] = useState(PICKER_CONTEXTS[0]!);
  const [mode, setMode] = useState<PickerMode>('new');
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  const [result, setResult] = useState<Game | null>(null);
  const [accepted, setAccepted] = useState(false);
  const options = { exclude: seen, mode };
  const remaining = filterCandidates(examples, context, options).length;
  const reset = () => {
    setSeen(new Set());
    setResult(null);
    setAccepted(false);
  };
  const text = { color: colors.textPrimary, fontSize: 16 };
  return (
    <Screen
      footer={<Button label="Вернуться ко входу в Steam" onPress={() => navigation.goBack()} />}
    >
      <Text accessibilityRole="header" style={{ ...text, fontWeight: '800', fontSize: 24 }}>
        Попробуй подбор
      </Text>
      <Text style={text}>
        Демо · примерная библиотека, 8 вымышленных игр. Вход не выполнен. Данные не сохраняются и не
        попадут в твой аккаунт.
      </Text>
      <View style={{ gap: 8 }}>
        {(['new', 'continue'] as const).map((value) => (
          <Button
            key={value}
            label={`${mode === value ? '✓ ' : ''}${PICKER_MODE_LABELS[value]}`}
            variant="secondary"
            onPress={() => {
              setMode(value);
              reset();
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {PICKER_CONTEXTS.map((item) => (
          <ContextCard
            key={item.id}
            context={item}
            matchingCount={filterCandidates(examples, item, { exclude: new Set(), mode }).length}
            selected={item.id === context.id}
            onPress={() => {
              setContext(item);
              reset();
            }}
          />
        ))}
      </View>
      <Button
        label={result ? 'Другая примерная игра' : 'Подобрать примерную игру'}
        disabled={remaining === 0}
        onPress={() => {
          const game = pickGame(examples, context, { ...options, random: Math.random });
          setResult(game);
          setAccepted(false);
          if (game) setSeen(new Set([...seen, game.appid]));
        }}
      />
      {result && (
        <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={{ ...text, fontWeight: '700' }}>
            {result.name}
          </Text>
          <Text style={text}>
            Пример подходит по жанру контекста «{context.title}» и{' '}
            {mode === 'new' ? 'нулевому' : 'ненулевому'} времени в примерной библиотеке. Это
            вымышленные данные.
          </Text>
          <Button
            label={accepted ? 'Отменить примерный выбор' : 'Выбираю эту примерную игру'}
            variant="secondary"
            onPress={() => setAccepted(!accepted)}
          />
          {accepted && (
            <Text style={text}>
              Примерный выбор принят только в демо. После входа можно сохранить настоящую игру из
              своей библиотеки. Игра не запускается.
            </Text>
          )}
        </View>
      )}
      {remaining === 0 && (
        <>
          <Text style={text}>Примерная серия закончилась. Начать новый круг?</Text>
          <Button label="Новый примерный круг" variant="secondary" onPress={reset} />
        </>
      )}
    </Screen>
  );
}
