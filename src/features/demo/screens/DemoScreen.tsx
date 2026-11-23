import { useDesktopHeader } from '@/shared/hooks/useDesktopHeader';
import { DemoMenu } from '@/features/demo/screens/DemoMenu';
import { PixelCheck } from '@/shared/components/PixelCheck';
import { AppText as Text } from '@/shared/components/AppText';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Game } from '@/features/backlog/types/Game';
import { ContextCard } from '@/features/picker/components/ContextCard';
import { SessionTimeTrial } from '@/features/picker/components/SessionTimeTrial';
import { PICKER_MODE_LABELS, type PickerMode } from '@/features/picker/types';
import { PICKER_CONTEXTS } from '@/features/picker/utils/contexts';
import { filterCandidates, pickGame } from '@/features/picker/utils/pickGame';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { useThemeColors } from '@/shared/theme/useTheme';
import { DemoSwipe } from './DemoSwipe';
import { selectIsAuthenticated, useAuth } from '@/features/auth/hooks/useAuth';

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

export function DemoScreen({ navigation, route }: RootStackScreenProps<'Demo'>) {
  const desktopHeader = useDesktopHeader();
  const colors = useThemeColors();
  const authenticated = useAuth(selectIsAuthenticated);
  const legacyFavorites = authenticated && route?.params?.favorites && !route.params.sessionId;
  useEffect(() => {
    if (legacyFavorites) navigation.replace('Favorites');
  }, [legacyFavorites, navigation]);
  const account = useAuth(
    (state) =>
      state.status === 'signedIn' ||
      state.status === 'signedInEmail' ||
      state.status === 'demoAdmin',
  );
  const [swipe, setSwipe] = useState(
    Boolean(
      route?.params?.solo ||
      route?.params?.favorites ||
      route?.params?.sessionId ||
      route?.params?.demoInvite,
    ),
  );
  const [shortcut, setShortcut] = useState<{
    target: 'favorites' | 'invite' | 'solo';
    sessionId?: string;
  } | null>(
    route?.params?.sessionId
      ? { target: 'invite', sessionId: route.params.sessionId }
      : route?.params?.demoInvite
        ? { target: 'invite' }
        : route?.params?.favorites
          ? { target: 'favorites' }
          : null,
  );
  const [lastParams, setLastParams] = useState(route?.params);
  if (lastParams !== route?.params) {
    setLastParams(route?.params);
    if (route?.params?.sessionId) {
      setShortcut({ target: 'invite', sessionId: route.params.sessionId });
      setSwipe(true);
    } else if (route?.params?.demoInvite) {
      setShortcut({ target: 'invite' });
      setSwipe(true);
    } else if (route?.params?.favorites) {
      setShortcut({ target: 'favorites' });
      setSwipe(true);
    } else if (route?.params?.solo) {
      setShortcut({ target: 'solo' });
      setSwipe(true);
    }
  }
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
  if (legacyFavorites) return null;
  return (
    <Screen
      footer={
        account ? undefined : (
          <Button label="Вернуться ко входу в Steam" onPress={() => navigation.navigate('Login')} />
        )
      }
    >
      {!desktopHeader && (
        <DemoMenu
          onSettings={() => navigation.navigate('AccountSettings')}
          onFavorites={() => {
            if (authenticated) {
              navigation.navigate('Favorites');
              return;
            }
            setShortcut({ target: 'favorites' });
            setSwipe(true);
          }}
          onAcceptInvitation={(sessionId) => {
            setShortcut({ target: 'invite', sessionId });
            setSwipe(true);
          }}
          onJoin={() => {
            setShortcut({ target: 'invite' });
            setSwipe(true);
          }}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ ...text, fontWeight: '800', fontSize: 24, flex: 1 }}
        >
          Попробуй подбор
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: swipe }}
          accessibilityLabel="Режим свайпа"
          onPress={() => {
            setShortcut(null);
            setSwipe((enabled) => !enabled);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: colors.secondary,
              backgroundColor: swipe ? colors.secondary : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {swipe && (
              <View testID="swipe-pixel-check">
                <PixelCheck color={colors.onPrimary} />
              </View>
            )}
          </View>
          <Text style={{ ...text, fontSize: 13 }}>Свайп</Text>
        </Pressable>
      </View>
      {swipe ? (
        <>
          <Text style={text}>
            {authenticated
              ? 'Подборка игр Steam. Понравившиеся игры из одиночного режима остаются в вашем избранном до конца текущего сеанса.'
              : 'Демо · подборка игр Steam. Избранное хранится до выхода из режима.'}
          </Text>
          <DemoSwipe
            shortcut={shortcut}
            onOpenFriend={(friendId) => navigation.navigate('DemoFriend', { friendId })}
          />
        </>
      ) : (
        <>
          <Text style={text}>
            Демо · примерная библиотека, 8 вымышленных игр.{' '}
            {account
              ? 'Выбор в этой пробе остаётся только на экране.'
              : 'Вход не выполнен. Данные не сохраняются и не попадут в твой аккаунт.'}
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
                showHero
                matchingCount={
                  filterCandidates(examples, item, { exclude: new Set(), mode }).length
                }
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
                  Примерный выбор принят только в демо. После входа можно сохранить настоящую игру
                  из своей библиотеки. Игра не запускается.
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
          <SessionTimeTrial example />
        </>
      )}
    </Screen>
  );
}
