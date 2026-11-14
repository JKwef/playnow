import { AppText as Text } from '@/shared/components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { fontSize, radius, spacing } from '@/shared/constants';
import { Button } from '@/shared/components/Button';
import { useThemeColors } from '@/shared/theme/useTheme';

export interface FriendlySwipe {
  id: string;
  date: number;
  players: string[];
  games: number[];
}

const storageKey = 'quaeso:demo-friendly-swipes:v1';
export const matchLabel = (entry: FriendlySwipe) => `Это взаимно! (${entry.games.length})`;

function isSwipe(value: unknown): value is FriendlySwipe {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<FriendlySwipe>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'number' &&
    Number.isFinite(new Date(entry.date).getTime()) &&
    Array.isArray(entry.players) &&
    entry.players.every((name) => typeof name === 'string') &&
    Array.isArray(entry.games) &&
    entry.games.every((game) => Number.isSafeInteger(game))
  );
}

export function useFriendlySwipes() {
  const [entries, setEntries] = useState<FriendlySwipe[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const snapshot = useRef<FriendlySwipe[]>([]);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        const value: unknown = raw ? JSON.parse(raw) : [];
        snapshot.current = Array.isArray(value) ? value.filter(isSwipe) : [];
        setEntries(snapshot.current);
        setReady(true);
      })
      .catch(() => {
        if (active) setError('Не удалось открыть историю.');
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (change: (current: FriendlySwipe[]) => FriendlySwipe[]) => {
    if (!ready) return;
    const next = change(snapshot.current);
    snapshot.current = next;
    setEntries(next);
    setError('');
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)))
      .catch(() => setError('Не удалось сохранить историю.'));
  };
  return { entries, ready, error, update };
}

export function FriendlySwipeHistory({
  entries,
  unfinished,
  loading = false,
  onResume,
  onOpen,
  onDelete,
}: {
  entries: FriendlySwipe[];
  unfinished: { id: string; label: string; status?: string; closed?: boolean }[];
  loading?: boolean;
  onResume: (id: string) => void;
  onOpen: (entry: FriendlySwipe) => void;
  onDelete: (ids: string[]) => void;
}) {
  const colors = useThemeColors();
  const [tab, setTab] = useState<'completed' | 'unfinished'>('completed');
  const [selected, setSelected] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const panel = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderBottomLeftRadius: radius.button,
    borderBottomRightRadius: radius.button,
    overflow: 'hidden' as const,
  };
  const remove = (ids: string[]) => {
    onDelete(ids);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
  };
  const trash = (label: string, action: () => void, visible = true) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      onFocus={() => setFocused(label)}
      onBlur={() => setFocused(null)}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible || focused === label ? 1 : 0,
      }}
    >
      <View style={{ width: 14, height: 2, backgroundColor: colors.error, marginBottom: 2 }} />
      <View
        style={{
          width: 11,
          height: 12,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: colors.error,
        }}
      />
    </Pressable>
  );
  return (
    <View style={{ marginTop: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontWeight: '700',
            fontSize: fontSize.subtitle,
          }}
        >
          Прошлые дружеские свайпы
        </Text>
        {tab === 'completed' &&
          selected.length > 0 &&
          trash(`Удалить отмеченные сессии (${selected.length})`, () => remove(selected))}
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4 }}>
        {(['completed', 'unfinished'] as const).map((value) => {
          const active = tab === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(value)}
              style={{
                minHeight: 44,
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 6,
                borderWidth: 1,
                borderTopLeftRadius: radius.button,
                borderTopRightRadius: radius.button,
                borderColor: active ? colors.secondary : colors.border,
                backgroundColor: active ? colors.mintMuted : colors.surface,
              }}
            >
              <Text
                style={{
                  color: active ? colors.textPrimary : colors.textSecondary,
                  fontWeight: '700',
                }}
              >
                {value === 'completed' ? 'Оконченные' : 'Неоконченные'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'unfinished' ? (
        <View style={panel}>
          {unfinished.length ? (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 205, flexGrow: 0 }}
            >
              {unfinished.map(({ id, label, status, closed }) => (
                <View
                  key={id}
                  style={{
                    padding: spacing.sm,
                    gap: spacing.xs,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textPrimary }}>{label}</Text>
                  {status && <Text style={{ color: colors.textSecondary }}>{status}</Text>}
                  {!closed && (
                    <Button
                      label="Продолжить"
                      accessibilityLabel={'Продолжить · ' + label}
                      variant="secondary"
                      onPress={() => onResume(id)}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={{ color: colors.textSecondary, padding: spacing.sm }}>
              {loading ? 'Загружаем комнаты…' : 'Неоконченных свайпов пока нет.'}
            </Text>
          )}
        </View>
      ) : (
        <View style={panel}>
          {entries.length === 0 ? (
            <Text style={{ color: colors.textSecondary, padding: spacing.sm }}>
              Завершённых голосований пока нет.
            </Text>
          ) : (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{
                maxHeight: 205,
                flexGrow: 0,
                borderWidth: 1,
                borderRadius: 12,
                borderColor: colors.border,
              }}
            >
              {entries.map((entry) => {
                const checked = selected.includes(entry.id);
                const date = new Date(entry.date).toLocaleString('ru-RU');
                return (
                  <View
                    key={entry.id}
                    onPointerEnter={() => setHovered(entry.id)}
                    onPointerLeave={() => setHovered(null)}
                    style={{
                      padding: 8,
                      gap: 4,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: checked ? colors.mintMuted : colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Отметить сессию ${date}, ${entry.players.join(', ')}`}
                        accessibilityState={{ checked }}
                        style={{
                          minHeight: 44,
                          minWidth: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() =>
                          setSelected((current) =>
                            checked
                              ? current.filter((id) => id !== entry.id)
                              : [...current, entry.id],
                          )
                        }
                      >
                        <Text style={{ color: colors.secondary }}>{checked ? '☑' : '☐'}</Text>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary }}>
                          {entry.players.join(' · ')}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{date}</Text>
                      </View>
                      {trash(
                        `Удалить сессию ${date}, ${entry.players.join(', ')}`,
                        () => remove([entry.id]),
                        Platform.OS !== 'web' || hovered === entry.id || checked,
                      )}
                    </View>
                    <Button
                      label={matchLabel(entry)}
                      variant="secondary"
                      onPress={() => onOpen(entry)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
