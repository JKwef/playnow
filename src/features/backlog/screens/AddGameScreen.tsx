import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, radius, spacing } from '@/shared/constants';

import { useAddGame } from '../hooks/useAddGame';
import { genreLabel, SELECTABLE_GENRES } from '../utils/genres';
import { parseSteamAppId } from '../utils/manualGame';

/** Ручное добавление игры (FR2.6): название, по желанию ссылка Steam и жанры. */
export function AddGameScreen({ navigation }: RootStackScreenProps<'AddGame'>) {
  const { isSaving, errorMessage, addGame } = useAddGame();
  const [name, setName] = useState('');
  const [steamInput, setSteamInput] = useState('');
  const [genres, setGenres] = useState<readonly string[]>([]);

  const steamAppId = parseSteamAppId(steamInput);
  const steamInvalid = steamInput.trim().length > 0 && steamAppId === null;
  const canSave = name.trim().length > 0 && !steamInvalid && !isSaving;

  const toggleGenre = (genre: string) =>
    setGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );

  const save = async () => {
    const saved = await addGame({ name, steamAppId, genres });
    if (saved) navigation.goBack();
  };

  return (
    <Screen>
      <Text style={styles.label} nativeID="name-label">
        Название игры
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Например, Hades"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        accessibilityLabelledBy="name-label"
        accessibilityLabel="Название игры"
        maxLength={200}
        autoFocus
        returnKeyType="next"
      />

      <Text style={styles.label} nativeID="steam-label">
        Ссылка на игру в Steam или её номер (необязательно)
      </Text>
      <TextInput
        value={steamInput}
        onChangeText={setSteamInput}
        placeholder="https://store.steampowered.com/app/620/"
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, steamInvalid && styles.inputError]}
        accessibilityLabelledBy="steam-label"
        accessibilityLabel="Ссылка на игру в Steam"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={300}
      />
      <Text style={[styles.hint, steamInvalid && styles.error]}>
        {steamInvalid
          ? 'Не похоже на ссылку Steam. Нужна ссылка вида store.steampowered.com/app/…'
          : 'С ней кнопка «Играть» сможет запустить игру через Steam'}
      </Text>

      <Text style={styles.label}>Жанры (необязательно)</Text>
      <View style={styles.genres}>
        {SELECTABLE_GENRES.map((genre) => {
          const checked = genres.includes(genre);
          return (
            <Pressable
              key={genre}
              onPress={() => toggleGenre(genre)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={genreLabel(genre)}
              style={[styles.genre, checked && styles.genreChecked]}
            >
              <Text style={[styles.genreText, checked && styles.genreTextChecked]}>
                {genreLabel(genre)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Если не выбрать, попробуем определить жанры автоматически</Text>

      {errorMessage !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      <Button
        label={isSaving ? 'Сохраняем…' : 'Добавить игру'}
        disabled={!canSave}
        onPress={() => void save()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '600' },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.body,
  },
  inputError: { borderColor: colors.error },
  hint: { color: colors.textSecondary, fontSize: fontSize.caption + 2, marginTop: -spacing.xs },
  error: { color: colors.error, fontSize: fontSize.caption + 2 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  genre: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genreChecked: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  genreText: { color: colors.textPrimary, fontSize: fontSize.caption + 2 },
  genreTextChecked: { color: colors.background, fontWeight: '600' },
});
