import { AppText as Text } from '@/shared/components/AppText';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { useThemeColors } from '@/shared/theme/useTheme';

export const exampleFriends = [
  {
    id: 'mint',
    nickname: 'MintKnight',
    games: ['Hollow Knight', 'Hades', 'Portal 2', 'Celeste', 'Dead Cells', 'Factorio'],
  },
  { id: 'pixel', nickname: 'PixelFox', games: ['Portal 2', 'Factorio', 'Stardew Valley'] },
  { id: 'moon', nickname: 'MoonRunner', games: ['Hades', 'Celeste'] },
];

export function DemoFriends({ onOpen }: { onOpen: (friendId: string) => void }) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const matches = exampleFriends.filter((friend) =>
    friend.nickname.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textSecondary }}>
        Демо · пример списка друзей. Для списка из Steam нужен вход.
      </Text>
      <TextInput
        accessibilityLabel="Поиск друга по нику"
        placeholder="Поиск по нику"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={{
          minHeight: 48,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: colors.border,
          color: colors.textPrimary,
        }}
      />
      {matches.length === 0 && (
        <Text style={{ color: colors.textSecondary }}>Друзья не найдены.</Text>
      )}
      {matches.map((friend) => {
        const open = expanded.includes(friend.id);
        return (
          <View
            key={friend.id}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.surface,
              paddingHorizontal: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={friend.nickname}
              accessibilityState={{ expanded: open }}
              onPress={() =>
                setExpanded((current) =>
                  open ? current.filter((id) => id !== friend.id) : [...current, friend.id],
                )
              }
              style={{
                minHeight: 48,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                {friend.nickname}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 20 }}>{open ? '⌃' : '⌄'}</Text>
            </Pressable>
            {open && (
              <View style={{ gap: 8, paddingBottom: 12 }}>
                {friend.games.slice(0, 5).map((game) => (
                  <Text key={game} style={{ color: colors.textPrimary }}>
                    {game}
                  </Text>
                ))}
                <Button
                  label="Заглянуть в подробности"
                  variant="secondary"
                  onPress={() => onOpen(friend.id)}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function DemoFriendScreen({ route }: RootStackScreenProps<'DemoFriend'>) {
  const colors = useThemeColors();
  const friend = exampleFriends.find(({ id }) => id === route.params?.friendId);
  return (
    <Screen>
      <Text
        accessibilityRole="header"
        style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}
      >
        {friend?.nickname ?? 'Профиль недоступен'}
      </Text>
      {friend && (
        <>
          <Text style={{ color: colors.textSecondary }}>
            Демо · избранные игры ({friend.games.length})
          </Text>
          {friend.games.map((game) => (
            <Text
              key={game}
              style={{
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 14,
                borderRadius: 12,
              }}
            >
              {game}
            </Text>
          ))}
        </>
      )}
    </Screen>
  );
}
