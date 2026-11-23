import type { RootStackScreenProps } from '@/navigation/types';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { Screen } from '@/shared/components/Screen';
import { useSoloFavorites } from './SoloFavoritesContext';
import { AppText as Text } from '@/shared/components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';

import {
  isDesktopBrowser,
  steamRunUrl,
  steamStoreUrl,
} from '@/features/launch/services/steamLauncher';
import { fontSize, radius, spacing } from '@/shared/constants';
import { Button } from '@/shared/components/Button';
import { useAuth, selectIsAuthenticated } from '@/features/auth/hooks/useAuth';
import {
  friendlyInvitation,
  type InvitationEntry,
} from '@/features/demo/services/friendlyInvitations';
import { getSupabase } from '@/shared/services/supabase';
import { useThemeColors } from '@/shared/theme/useTheme';
import { DemoFriends, exampleFriends } from './DemoFriends';
import { CompanionPair } from './CompanionPair';
import { CompanionWaiting } from './CompanionWaiting';
import {
  FriendlySwipeHistory,
  matchLabel,
  useFriendlySwipes,
  type FriendlySwipe,
} from './FriendlySwipeHistory';

const cards = [
  {
    appid: 620,
    title: 'Portal 2',
    genre: 'Головоломка',
    year: 2011,
    description: 'Решай задачи с порталами в испытательных камерах Aperture Science.',
    cover: require('../../../../assets/demo/game-0.png') as ImageSourcePropType,
  },
  {
    appid: 1145360,
    title: 'Hades',
    genre: 'Экшен-рогалик',
    year: 2020,
    description: 'Выбирай оружие и дары богов, чтобы вырваться из подземного мира.',
    cover: require('../../../../assets/demo/game-1.png') as ImageSourcePropType,
  },
  {
    appid: 367520,
    title: 'Hollow Knight',
    genre: 'Метроидвания',
    year: 2017,
    description: 'Исследуй руины Халлоунеста, находи новые способности и открывай проходы.',
    cover: require('../../../../assets/demo/game-2.png') as ImageSourcePropType,
  },
  {
    appid: 427520,
    title: 'Factorio',
    genre: 'Стратегия и автоматизация',
    year: 2020,
    description: 'Строй заводы, прокладывай конвейеры и автоматизируй производство.',
    cover: require('../../../../assets/demo/game-3.png') as ImageSourcePropType,
  },
];

type SwipeCard = (typeof cards)[number];

// Portal 2 has co-op and Factorio has multiplayer.
const multiplayerCards = cards.filter(({ appid }) => appid === 620 || appid === 427520);

const randomDeck = (pool: readonly SwipeCard[]) => {
  const deck = [...pool];
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[other]] = [deck[other]!, deck[index]!];
  }
  return deck;
};

function GameCover({ card }: { card: (typeof cards)[number] }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      source={
        failed
          ? card.cover
          : { uri: `https://cdn.cloudflare.steamstatic.com/steam/apps/${card.appid}/header.jpg` }
      }
      onError={() => setFailed(true)}
      style={styles.cover}
      resizeMode="cover"
      accessible={false}
    />
  );
}

function LibraryMembership({ appid }: { appid: number }) {
  const { games, status } = useBacklog();
  const colors = useThemeColors();
  return (
    <Text style={{ color: colors.textSecondary }}>
      {games
        ? games.some((game) => game.appid === appid)
          ? 'Есть в вашей библиотеке Quaeso'
          : 'В вашей библиотеке Quaeso не найдена'
        : status === 'loading'
          ? 'Загружаем библиотеку…'
          : 'Проверка библиотеки недоступна'}
    </Text>
  );
}

function FavoriteRow({
  card,
  onRemove,
  onPlay,
}: {
  card: (typeof cards)[number];
  onRemove?: () => void;
  onPlay: () => void;
}) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const status = useAuth((state) => state.status);
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const showTools = Platform.OS !== 'web' || width < 700 || hovered || focused || expanded;
  return (
    <View
      style={[
        styles.details,
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <View style={styles.actions}>
        <Text style={[styles.title, { color: colors.textPrimary, flex: 1 }]}>{card.title}</Text>
        <View style={[styles.actions, { opacity: showTools ? 1 : 0 }]}>
          {onRemove && (
            <Pressable
              style={styles.tool}
              accessibilityRole="button"
              accessibilityLabel={`Удалить ${card.title}`}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onPress={onRemove}
            >
              <View
                style={{ width: 14, height: 2, backgroundColor: colors.error, marginBottom: 2 }}
              />
              <View
                style={{
                  width: 11,
                  height: 12,
                  borderColor: colors.error,
                  borderWidth: 2,
                  borderTopWidth: 0,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                }}
              />
            </Pressable>
          )}
          <Pressable
            style={styles.tool}
            accessibilityRole="button"
            accessibilityLabel={`Подробнее о ${card.title}`}
            accessibilityState={{ expanded }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPress={() => setExpanded((current) => !current)}
          >
            <Text style={{ color: colors.secondary, fontSize: 20 }}>{expanded ? '⌃' : '⌄'}</Text>
          </Pressable>
        </View>
      </View>
      {expanded && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.textSecondary }}>
            {card.genre} · {card.year}
          </Text>
          {status === 'signedIn' ? (
            <LibraryMembership appid={card.appid} />
          ) : (
            <Text style={{ color: colors.textSecondary }}>
              {status === 'signedInEmail'
                ? 'Библиотека Steam не подключена.'
                : 'Библиотека: войди через Steam для проверки'}
            </Text>
          )}
          <Text style={{ color: colors.textPrimary }}>{card.description}</Text>
          <Button
            label="Посмотреть цену в Steam"
            variant="tertiary"
            onPress={() => void Linking.openURL(steamStoreUrl(card.appid)).catch(() => undefined)}
          />
        </View>
      )}
      <Button label="Играть" onPress={onPlay} />
    </View>
  );
}

const heart = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
const brokenHeart = ['01100110', '11101111', '11011111', '01101110', '00101100', '00001000'];

function PixelHeart({ broken, color }: { broken: boolean; color: string }) {
  return (
    <View style={styles.heart} accessible={false}>
      {(broken ? brokenHeart : heart).flatMap((row, y) =>
        Array.from(row, (pixel, x) =>
          pixel === '1' ? (
            <View
              key={y * 8 + x}
              style={{
                position: 'absolute',
                left: x * 3,
                top: y * 3,
                width: 3,
                height: 3,
                backgroundColor: color,
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}

export function DemoSwipe({
  onOpenFriend,
  shortcut,
}: {
  onOpenFriend: (friendId: string) => void;
  shortcut: { target: 'favorites' | 'invite' | 'solo'; sessionId?: string } | null;
}) {
  const colors = useThemeColors();
  const [mode, setMode] = useState<'solo' | 'companion'>(
    shortcut?.target === 'invite' ? 'companion' : 'solo',
  );
  const [lastShortcut, setLastShortcut] = useState(shortcut);
  if (lastShortcut !== shortcut) {
    setLastShortcut(shortcut);
    if (shortcut) setMode(shortcut.target === 'invite' ? 'companion' : 'solo');
  }
  return (
    <View style={styles.content}>
      <View accessibilityRole="tablist" style={styles.actions}>
        {(['solo', 'companion'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === tab }}
            onPress={() => setMode(tab)}
            style={[
              styles.action,
              {
                backgroundColor: mode === tab ? colors.mintMuted : colors.surface,
                borderColor: mode === tab ? colors.secondary : colors.border,
              },
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
              {tab === 'solo' ? 'Одиночка' : 'Компаньон'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={mode !== 'solo' && { display: 'none' }}>
        <SwipeDeck
          onOpenFriend={onOpenFriend}
          active={mode === 'solo'}
          openFavorites={shortcut?.target === 'favorites' ? shortcut : null}
        />
      </View>
      <View style={mode !== 'companion' && { display: 'none' }}>
        <Companion
          key={shortcut?.sessionId ?? (shortcut?.target === 'invite' ? 'invite' : 'manual')}
          initialSession={shortcut?.sessionId}
          onOpenFriend={onOpenFriend}
          active={mode === 'companion'}
          invited={shortcut?.target === 'invite'}
        />
      </View>
    </View>
  );
}

function Companion({
  onOpenFriend,
  active,
  invited,
  initialSession,
}: {
  onOpenFriend: (friendId: string) => void;
  active: boolean;
  invited: boolean;
  initialSession?: string | undefined;
}) {
  const authenticated = useAuth(selectIsAuthenticated);
  return authenticated ? (
    <SharedCompanion active={active} onOpenFriend={onOpenFriend} initialSession={initialSession} />
  ) : (
    <LocalCompanion active={active} invited={invited} onOpenFriend={onOpenFriend} />
  );
}

function LocalCompanion({
  onOpenFriend,
  active,
  invited,
}: {
  onOpenFriend: (friendId: string) => void;
  active: boolean;
  invited: boolean;
}) {
  const colors = useThemeColors();
  const [selected, setSelected] = useState<string[]>(invited ? ['mint'] : []);
  const [query, setQuery] = useState('');
  const friends = exampleFriends.filter(({ nickname }) =>
    nickname.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const [room, setRoom] = useState<LocalRoom | null>(
    invited ? { players: ['Ты', 'MintKnight'], votes: null, draft: null } : null,
  );
  const [savedRooms, setSavedRooms] = useState<LocalRoom[]>([]);
  const roomWrites = useRef(Promise.resolve());
  const [roomOpen, setRoomOpen] = useState(invited);
  const [roomReady, setRoomReady] = useState(false);
  const [roomError, setRoomError] = useState(false);
  const participants = room?.players ?? [];
  const submitted = room?.votes ?? null;
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(localRoomKey)
      .then((raw) => {
        if (!alive || !raw) return;
        const saved = JSON.parse(raw) as LocalRoom | LocalRoom[];
        setSavedRooms(Array.isArray(saved) ? saved : [saved]);
      })
      .catch(() => {
        if (alive) setRoomError(true);
      })
      .finally(() => {
        if (alive) setRoomReady(true);
      });
    return () => {
      alive = false;
    };
  }, [invited]);
  const saveRoom = (next: LocalRoom | null) => {
    setRoom(next);
    setRoomError(false);
    const updated = savedRooms.filter((entry) => localRoomId(entry) !== localRoomId(next ?? room));
    if (next) updated.unshift(next);
    setSavedRooms(updated);
    roomWrites.current = roomWrites.current
      .then(() => AsyncStorage.setItem(localRoomKey, JSON.stringify(updated)))
      .catch(() => setRoomError(true));
  };
  const history = useFriendlySwipes();
  const [result, setResult] = useState<FriendlySwipe | null>(null);
  const [opened, setOpened] = useState<FriendlySwipe | null>(null);
  const [launchError, setLaunchError] = useState(false);
  const reset = () => {
    saveRoom(null);
    setRoomOpen(false);
    setResult(null);
  };
  const chosenPlayers = [
    'Ты',
    ...exampleFriends.filter(({ id }) => selected.includes(id)).map(({ nickname }) => nickname),
  ];
  if (opened) {
    return (
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          {matchLabel(opened)}
        </Text>
        <Text style={{ color: colors.textSecondary }}>{opened.players.join(' · ')}</Text>
        <Button
          label="Назад к компаньону"
          variant="secondary"
          onPress={() => {
            setOpened(null);
            setLaunchError(false);
          }}
        />
        {opened.games.length === 0 && (
          <Text style={{ color: colors.textSecondary }}>Совпадений нет.</Text>
        )}
        {multiplayerCards
          .filter(({ appid }) => opened.games.includes(appid))
          .map((card) => (
            <FavoriteRow
              key={card.appid}
              card={card}
              onPlay={() => {
                setLaunchError(false);
                const desktop = Platform.OS === 'web' && isDesktopBrowser(navigator.userAgent);
                void Linking.openURL(desktop ? steamRunUrl(card.appid) : steamStoreUrl(card.appid))
                  .catch(() => Linking.openURL(steamStoreUrl(card.appid)))
                  .catch(() => setLaunchError(true));
              }}
            />
          ))}
        {launchError && (
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            Не удалось открыть Steam.
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={styles.content}>
      <Text style={{ color: colors.textSecondary }}>
        Демо · здесь можно пройти свою часть голосования.
      </Text>
      {!roomOpen || !room ? (
        <>
          <View style={styles.companyHeading}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary, flex: 1 }]}
            >
              Выбери компанию
            </Text>
            <CompanionPair active={active} />
          </View>
          <TextInput
            accessibilityLabel="Поиск друга по нику"
            placeholder="Поиск по нику"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
            style={[
              styles.friendSearch,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={[
              styles.friendList,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            {friends.length === 0 && (
              <Text style={[styles.friendRow, { color: colors.textSecondary }]}>
                Друзья не найдены.
              </Text>
            )}
            {friends.map(({ id, nickname }) => {
              const checked = selected.includes(id);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={nickname}
                  accessibilityState={{ checked }}
                  onPress={() =>
                    setSelected((current) =>
                      checked ? current.filter((value) => value !== id) : [...current, id],
                    )
                  }
                  style={[styles.friendRow, checked && { backgroundColor: colors.mintMuted }]}
                >
                  <Text style={{ color: colors.textPrimary }}>
                    {checked ? '☑' : '☐'} {nickname}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            label="Начать совместный подбор"
            disabled={!roomReady || selected.length === 0}
            onPress={() => {
              const newRoom = { players: chosenPlayers, votes: null, draft: null };
              saveRoom(
                savedRooms.find((entry) => localRoomId(entry) === localRoomId(newRoom)) ?? newRoom,
              );
              setRoomOpen(true);
            }}
          />
          <FriendlySwipeHistory
            entries={history.entries}
            unfinished={savedRooms.map((entry) => ({
              id: localRoomId(entry),
              label: entry.players.slice(1).join(' · '),
            }))}
            onResume={(id) => {
              const entry = savedRooms.find((candidate) => localRoomId(candidate) === id);
              if (entry) {
                setRoom(entry);
                setRoomOpen(true);
              }
            }}
            onOpen={setOpened}
            onDelete={(ids) =>
              history.update((current) => current.filter(({ id }) => !ids.includes(id)))
            }
          />
        </>
      ) : (
        <>
          <CompanionBack
            onPress={
              result
                ? reset
                : () => {
                    saveRoom(room);
                    setRoomOpen(false);
                  }
            }
          />
          {result ? (
            <>
              <Text style={{ color: colors.textSecondary }}>
                Тестовый компаньон выбрал Portal 2.
              </Text>
              <Button label={matchLabel(result)} onPress={() => setOpened(result)} />
            </>
          ) : submitted ? (
            <CompanionWaiting
              active={active}
              testVoteDisabled={!history.ready}
              onTestVote={() => {
                const date = Date.now();
                const entry = {
                  id: `${date}-${Math.random().toString(36).slice(2)}`,
                  date,
                  players: participants,
                  games: submitted.includes(620) ? [620] : [],
                };
                setResult(entry);
                const remaining = savedRooms.filter(
                  (entry) => localRoomId(entry) !== localRoomId(room),
                );
                setSavedRooms(remaining);
                roomWrites.current = roomWrites.current
                  .then(() => AsyncStorage.setItem(localRoomKey, JSON.stringify(remaining)))
                  .catch(() => setRoomError(true));
                history.update((current) => [entry, ...current]);
              }}
            />
          ) : (
            <SwipeDeck
              onOpenFriend={onOpenFriend}
              active={active}
              pool={multiplayerCards}
              draft={room.draft}
              onDraft={(draft) => saveRoom({ ...room, draft })}
              onFinish={(votes) => saveRoom({ ...room, votes })}
            />
          )}
        </>
      )}
      {roomError && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          Не удалось загрузить или сохранить комнату.
        </Text>
      )}
      {!!history.error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {history.error}
        </Text>
      )}
    </View>
  );
}

type LocalRoom = { players: string[]; votes: number[] | null; draft: SwipeDraft | null };
const localRoomKey = 'quaeso:demo-companion-room';
const localRoomId = (room: LocalRoom | null) => JSON.stringify(room?.players ?? []);

type SharedSwipe = Omit<FriendlySwipe, 'games'> & {
  games: number[] | null;
  seats: number;
  finished: number;
  voted: boolean;
  invitation: 'pending' | 'accepted' | 'declined' | null;
  invitee: string | null;
};

function SharedCompanion({
  active,
  onOpenFriend,
  initialSession,
}: {
  active: boolean;
  onOpenFriend: (friendId: string) => void;
  initialSession?: string | undefined;
}) {
  const colors = useThemeColors();
  const [entries, setEntries] = useState<SharedSwipe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(initialSession ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState<FriendlySwipe | null>(null);
  const selected = entries.find(({ id }) => id === session);
  useEffect(() => {
    if (!active || busy) return;
    let alive = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const next = await friendlyInvitation<SharedSwipe>({ action: 'list' });
        if (alive) {
          setEntries(next);
          setLoaded(true);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, busy]);

  const perform = async (action: 'invite' | 'vote', id?: string, votes?: number[]) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const next = await friendlyInvitation<SharedSwipe>({
        action,
        ...(id ? { target: id } : {}),
        ...(votes ? { selected: votes } : {}),
      });
      setEntries((current) => [
        ...next,
        ...current.filter((entry) => !next.some((row) => row.id === entry.id)),
      ]);
      if (action === 'invite') setSession(next[0]?.id ?? null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const unfinished = entries.filter(({ games }) => games === null);
  const completed = entries.flatMap(({ games, ...entry }) =>
    games === null ? [] : [{ ...entry, games }],
  );
  return (
    <View style={styles.content}>
      {opened ? (
        <>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            {matchLabel(opened)}
          </Text>
          <Text style={{ color: colors.textSecondary }}>{opened.players.join(' · ')}</Text>
          {opened.games.length === 0 && (
            <Text style={{ color: colors.textPrimary }}>Совпадений нет.</Text>
          )}
          {multiplayerCards
            .filter(({ appid }) => opened.games.includes(appid))
            .map((card) => (
              <FavoriteRow
                key={card.appid}
                card={card}
                onPlay={() => {
                  void Linking.openURL(steamStoreUrl(card.appid)).catch(() => setError(true));
                }}
              />
            ))}
          <Button label="Назад к компаньону" variant="secondary" onPress={() => setOpened(null)} />
        </>
      ) : selected ? (
        <>
          {selected.invitation === 'pending' && (
            <Text style={{ color: colors.textPrimary }}>
              Приглашение отправлено игроку {selected.invitee}.
            </Text>
          )}
          <Text style={{ color: colors.textSecondary }}>
            {selected.players.join(' · ')} · Закончили {selected.finished} из {selected.seats}
          </Text>
          <CompanionBack onPress={() => setSession(null)} />
          {selected.invitation === 'declined' ? (
            <Text style={{ color: colors.textSecondary }}>Приглашение отклонено.</Text>
          ) : selected.games !== null ? (
            <Button
              label={matchLabel({ ...selected, games: selected.games })}
              onPress={() => setOpened({ ...selected, games: selected.games ?? [] })}
            />
          ) : selected.voted ? (
            <CompanionWaiting active={active} />
          ) : (
            <SharedSwipeDeck
              key={selected.id}
              sessionId={selected.id}
              pool={multiplayerCards}
              active={active}
              onOpenFriend={onOpenFriend}
              onFinish={(votes) => void perform('vote', selected.id, votes)}
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.companyHeading}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary, flex: 1 }]}
            >
              Выбери компанию
            </Text>
            <CompanionPair active={active} />
          </View>
          <PlayerSearch busy={busy} onInvite={(id) => void perform('invite', id)} />
          <FriendlySwipeHistory
            entries={completed}
            loading={!loaded && !error}
            unfinished={unfinished.map((entry) => ({
              id: entry.id,
              label:
                entry.invitation === 'pending' || entry.invitation === 'declined'
                  ? (entry.invitee ?? '')
                  : entry.players.join(' · '),
              status:
                entry.invitation === 'declined'
                  ? 'Приглашение отклонено'
                  : `Закончили ${entry.finished} из ${entry.seats}`,
              closed: entry.invitation === 'declined',
            }))}
            onResume={setSession}
            onOpen={setOpened}
            onDelete={(ids) => {
              void (async () => {
                if (busy) return;
                setBusy(true);
                setError(false);
                try {
                  for (const id of ids) {
                    await friendlyInvitation({ action: 'hide', target: id });
                    setEntries((current) => current.filter((entry) => entry.id !== id));
                  }
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
        </>
      )}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          Не удалось обновить сессию. Попробуй ещё раз.
        </Text>
      )}
    </View>
  );
}

function CompanionBack({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Назад"
      onPress={onPress}
      style={{
        alignSelf: 'flex-start',
        minHeight: 44,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.secondary, fontSize: 20 }}>←</Text>
      <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '600' }}>Назад</Text>
    </Pressable>
  );
}

function PlayerSearch({ busy, onInvite }: { busy: boolean; onInvite: (id: string) => void }) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<InvitationEntry[] | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const search = query.trim();
  useEffect(() => {
    if (search.length < 3) return;
    let alive = true;
    const timer = setTimeout(() => {
      void friendlyInvitation<InvitationEntry>({ action: 'search', query: search })
        .then((rows) => {
          if (alive) setPlayers(rows);
        })
        .catch(() => {
          if (alive) setError(true);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <>
      <TextInput
        accessibilityLabel="Поиск игрока по нику Quaeso"
        placeholder="Ник в Quaeso, от 3 символов"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        maxLength={40}
        value={query}
        onChangeText={(value) => {
          if (value.trim() !== search) {
            setPlayers(null);
            setRecipient(null);
            setError(false);
          }
          setQuery(value);
        }}
        style={[
          styles.friendSearch,
          {
            color: colors.textPrimary,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          Не удалось найти игроков.
        </Text>
      )}
      {players?.length === 0 && (
        <Text style={{ color: colors.textSecondary }}>Игроки не найдены.</Text>
      )}
      {!!players?.length && (
        <ScrollView
          style={[
            styles.friendList,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          contentContainerStyle={{ padding: spacing.xs, gap: spacing.xs }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {players.map((player) => (
            <Button
              key={player.id}
              label={player.name}
              variant={recipient === player.id ? 'primary' : 'secondary'}
              onPress={() => setRecipient(player.id)}
            />
          ))}
        </ScrollView>
      )}
      <Button
        label="Пригласить посвайпать"
        disabled={busy || !recipient}
        onPress={() => {
          if (recipient) onInvite(recipient);
        }}
      />
    </>
  );
}

type SwipeDraft = { order: number[]; index: number; favorites: number[] };

function SharedSwipeDeck({
  sessionId,
  ...props
}: {
  sessionId: string;
  active: boolean;
  pool: readonly SwipeCard[];
  onOpenFriend: (friendId: string) => void;
  onFinish: (votes: number[]) => void;
}) {
  const [saved, setSaved] = useState<{ key: string; draft: SwipeDraft | null }>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    async function restore() {
      try {
        const { data, error } = await getSupabase().auth.getSession();
        if (error || !data.session) return;
        const key = ['quaeso:swipe-draft', data.session.user.id, sessionId].join(':');
        const raw = await AsyncStorage.getItem(key).catch(() => null);
        let draft: SwipeDraft | null = null;
        if (raw) {
          try {
            const candidate = JSON.parse(raw) as SwipeDraft;
            const ids = props.pool.map(({ appid }) => appid);
            if (
              Array.isArray(candidate.order) &&
              candidate.order.length === ids.length &&
              ids.every((id) => candidate.order.includes(id)) &&
              Number.isInteger(candidate.index) &&
              candidate.index >= 0 &&
              candidate.index <= ids.length &&
              Array.isArray(candidate.favorites) &&
              candidate.favorites.every((id) =>
                candidate.order.slice(0, candidate.index).includes(id),
              )
            )
              draft = candidate;
          } catch {
            // An outdated or damaged draft starts a fresh deck.
          }
        }
        if (alive) setSaved({ key, draft });
      } finally {
        if (alive) setLoading(false);
      }
    }
    void restore().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [props.pool, sessionId]);
  if (loading) return null;
  return (
    <SwipeDeck
      {...props}
      draft={saved?.draft ?? null}
      onDraft={(value) => {
        if (saved)
          void AsyncStorage.setItem(saved.key, JSON.stringify(value)).catch(() => undefined);
      }}
    />
  );
}

export function FavoritesScreen({ navigation }: RootStackScreenProps<'Favorites'>) {
  const personal = useSoloFavorites();
  if (!personal) return null;
  const [favorites, setFavorites] = personal;
  return (
    <Screen>
      <SwipeFavorites
        favorites={favorites}
        onRemove={(appid) => setFavorites((current) => current.filter((id) => id !== appid))}
        cardsLabel="К карточкам игр"
        onCards={() => navigation.navigate('Demo', { solo: true })}
      />
    </Screen>
  );
}

function SwipeFavorites({
  favorites,
  onRemove,
  onCards,
  cardsLabel,
  onOpenFriend,
}: {
  favorites: number[];
  onRemove: (id: number) => void;
  onCards: () => void;
  cardsLabel: string;
  onOpenFriend?: ((id: string) => void) | undefined;
}) {
  const colors = useThemeColors();
  const [favoriteTab, setFavoriteTab] = useState<'mine' | 'friends'>('mine');
  const [launchError, setLaunchError] = useState(false);
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        Избранное
      </Text>
      <Button label={cardsLabel} variant="secondary" onPress={onCards} />
      <View accessibilityRole="tablist" style={styles.actions}>
        {(['mine', 'friends'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            aria-selected={tab === favoriteTab}
            accessibilityState={{ selected: tab === favoriteTab }}
            onPress={() => setFavoriteTab(tab)}
            style={[
              styles.action,
              {
                backgroundColor: tab === favoriteTab ? colors.mintMuted : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: colors.textPrimary, textAlign: 'center' }}>
              {tab === 'mine' ? 'Избранное у себя' : 'Избранное у друзей'}
            </Text>
          </Pressable>
        ))}
      </View>
      {favoriteTab === 'friends' ? (
        onOpenFriend ? (
          <DemoFriends onOpen={onOpenFriend} />
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            Избранное других игроков пока недоступно.
          </Text>
        )
      ) : (
        <>
          {favorites.length === 0 && (
            <Text style={{ color: colors.textSecondary }}>Пока ничего не добавлено.</Text>
          )}
          {favorites.map((appid) => {
            const favorite = cards.find((item) => item.appid === appid)!;
            return (
              <FavoriteRow
                key={appid}
                card={favorite}
                onRemove={() => onRemove(appid)}
                onPlay={() => {
                  setLaunchError(false);
                  const desktop = Platform.OS === 'web' && isDesktopBrowser(navigator.userAgent);
                  void Linking.openURL(desktop ? steamRunUrl(appid) : steamStoreUrl(appid))
                    .catch(() => Linking.openURL(steamStoreUrl(appid)))
                    .catch(() => setLaunchError(true));
                }}
              />
            );
          })}
          {launchError && (
            <Text accessibilityRole="alert" style={{ color: colors.error }}>
              Не удалось открыть Steam.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function SwipeDeck({
  onOpenFriend,
  active,
  pool = cards,
  onFinish,
  openFavorites = null,
  draft = null,
  onDraft,
}: {
  onOpenFriend: (friendId: string) => void;
  active: boolean;
  pool?: readonly SwipeCard[];
  onFinish?: (votes: number[]) => void;
  openFavorites?: object | null;
  draft?: SwipeDraft | null;
  onDraft?: (draft: SwipeDraft) => void;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const [deck, setDeck] = useState(() => {
    const restored = draft?.order.flatMap((id) => pool.filter(({ appid }) => appid === id));
    return restored?.length === pool.length ? restored : randomDeck(pool);
  });
  const [index, setIndex] = useState(draft?.index ?? 0);
  const [likes, setLikes] = useState(draft?.favorites.length ?? 0);
  const localFavorites = useState<number[]>(draft?.favorites ?? []);
  const personal = useSoloFavorites();
  const authenticated = useAuth(selectIsAuthenticated);
  const [favorites, setFavorites] =
    authenticated && !onFinish && personal ? personal : localFavorites;
  const [showFavorites, setShowFavorites] = useState(openFavorites !== null);
  const [lastFavoritesRequest, setLastFavoritesRequest] = useState(openFavorites);
  if (lastFavoritesRequest !== openFavorites) {
    setLastFavoritesRequest(openFavorites);
    if (openFavorites) setShowFavorites(true);
  }
  const [busy, setBusy] = useState(false);
  const [offset] = useState(() => new Animated.Value(0));
  const [reducedMotion, setReducedMotion] = useState(true);
  const locked = useRef(false);
  const card = deck[index];

  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      preferenceChanged = true;
      setReducedMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !preferenceChanged) setReducedMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
      offset.stopAnimation();
    };
  }, [offset]);

  const choose = (direction: -1 | 1) => {
    if (locked.current || !card) return;
    locked.current = true;
    setBusy(true);
    const advance = () => {
      offset.setValue(0);
      locked.current = false;
      setBusy(false);
      const nextFavorites =
        direction === 1 && !favorites.includes(card.appid) ? [...favorites, card.appid] : favorites;
      onDraft?.({
        order: deck.map(({ appid }) => appid),
        index: index + 1,
        favorites: nextFavorites,
      });
      setIndex((current) => current + 1);
      if (direction === 1) {
        setLikes((current) => current + 1);
        setFavorites(nextFavorites);
      }
    };
    if (reducedMotion) {
      advance();
      return;
    }
    Animated.timing(offset, {
      toValue: direction * (width + 100),
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) advance();
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !card || showFavorites) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      )
        return;
      const key = event.key.toLowerCase();
      if (
        key !== 'arrowleft' &&
        key !== 'arrowright' &&
        key !== 'a' &&
        key !== 'd' &&
        event.code !== 'KeyA' &&
        event.code !== 'KeyD'
      )
        return;
      event.preventDefault();
      choose(key === 'arrowleft' || key === 'a' || event.code === 'KeyA' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const recenter = () => {
    if (!locked.current)
      Animated.spring(offset, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  // PanResponder registers these callbacks and reads the lock only during touch events.
  // eslint-disable-next-line react-hooks/refs
  const gesture = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !locked.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.35,
    onPanResponderGrant: () => offset.stopAnimation(),
    onPanResponderMove: (_, { dx }) => {
      if (!reducedMotion && !locked.current) offset.setValue(dx);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      if (Math.abs(dx) > 70 || (Math.abs(dx) > 28 && Math.abs(vx) > 0.55)) {
        choose(dx < 0 ? -1 : 1);
      } else {
        recenter();
      }
    },
    onPanResponderTerminate: recenter,
  });

  const favoritesButton = (
    <Button
      label={`Избранное (${favorites.length})`}
      variant="secondary"
      disabled={busy}
      onPress={() => {
        setShowFavorites(true);
      }}
    />
  );

  const finishButton = onFinish && (
    <Button
      label="Завершить голосование"
      variant="secondary"
      disabled={busy}
      onPress={() => onFinish(favorites)}
    />
  );

  if (!card && onFinish) {
    return (
      <View style={styles.content}>
        <Text style={{ color: colors.textSecondary }}>Все карточки просмотрены.</Text>
        {finishButton}
      </View>
    );
  }
  if (showFavorites) {
    return (
      <SwipeFavorites
        favorites={favorites}
        onRemove={(appid) => setFavorites((current) => current.filter((id) => id !== appid))}
        onCards={() => setShowFavorites(false)}
        cardsLabel="Вернуться к карточкам"
        onOpenFriend={authenticated ? undefined : onOpenFriend}
      />
    );
  }

  if (!card) {
    return (
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          Все карточки просмотрены
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Понравилось игр: {likes} из {deck.length}
        </Text>
        {favoritesButton}
        <Button
          label="Перемешать и начать заново"
          onPress={() => {
            setDeck(randomDeck(pool));
            setIndex(0);
            setLikes(0);
          }}
        />
      </View>
    );
  }

  const rotate = offset.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: ['-20deg', '0deg', '20deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.content}>
      <Text style={{ color: colors.textSecondary }} accessibilityLiveRegion="polite">
        Карточка {index + 1} из {deck.length}
      </Text>
      <Animated.View
        testID="demo-swipe-card"
        {...gesture.panHandlers}
        style={[
          styles.card,
          Platform.OS === 'web' && webGestureStyle,
          { backgroundColor: colors.surface, borderColor: colors.border },
          { transform: [{ translateX: offset }, { rotate }] },
        ]}
      >
        <GameCover key={card.appid} card={card} />
        <View style={styles.details}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            {card.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22 }}>
            {card.description}
          </Text>
        </View>
      </Animated.View>
      <View style={styles.actions}>
        {([-1, 1] as const).map((direction) => (
          <Pressable
            key={direction}
            accessibilityRole="button"
            accessibilityLabel={direction === -1 ? 'Пропустить игру' : 'Понравилась игра'}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => choose(direction)}
            style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <PixelHeart
              broken={direction === -1}
              color={direction === -1 ? colors.error : colors.secondary}
            />
            <Text style={{ color: colors.textPrimary }}>
              {direction === -1 ? 'Пропустить' : 'Нравится'}
            </Text>
          </Pressable>
        ))}
      </View>
      {onFinish ? finishButton : favoritesButton}
    </View>
  );
}

const webGestureStyle = { overflow: 'hidden' as const, touchAction: 'pan-y' };

const styles = StyleSheet.create({
  companyHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendSearch: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.button,
    fontSize: fontSize.body,
  },
  friendList: { maxHeight: 132, flexGrow: 0, borderWidth: 1, borderRadius: radius.button },
  friendRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  content: { gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center', overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  details: { padding: 16, gap: 6 },
  title: { fontSize: fontSize.subtitle, fontWeight: '700', lineHeight: 26 },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderRadius: radius.button,
  },
  heart: { width: 24, height: 18 },
  tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
