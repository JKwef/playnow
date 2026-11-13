import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { OptionsModal } from '@/shared/components/OptionsModal';
import { fontSize, spacing } from '@/shared/constants';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';

import { useGenreOverrides } from '../hooks/useGenreOverrides';
import type { Game } from '../types/Game';
import { genreLabel, SELECTABLE_GENRES } from '../utils/genres';

export function GenreEditor({ game }: { game: Game }) {
  const styles = useThemedStyles(createStyles);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const { save, isSaving, errorMessage, saved } = useGenreOverrides();
  const options = SELECTABLE_GENRES.map((value) => ({ value, label: genreLabel(value) }));
  const open = () => {
    setSelected(
      game.genres.filter((genre) => (SELECTABLE_GENRES as readonly string[]).includes(genre)),
    );
    setEditing(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.note}>
        {game.genresOverride
          ? 'Жанры указаны вами'
          : game.genres.length === 0
            ? 'Жанры не распознаны. Их можно указать вручную.'
            : 'Жанры можно исправить вручную.'}
      </Text>
      <Text style={styles.note}>
        Изменение сохраняется в аккаунте и требует подключения к сети.
      </Text>
      <Button label="Исправить жанры" variant="secondary" disabled={isSaving} onPress={open} />
      <OptionsModal
        visible={editing}
        title="Выберите жанры"
        multiple
        options={options}
        selected={selected}
        onToggle={(genre) =>
          setSelected((values) =>
            values.includes(genre) ? values.filter((value) => value !== genre) : [...values, genre],
          )
        }
        onClose={() => setEditing(false)}
        onClear={() => setSelected([])}
      />
      {selected.length > 0 && (
        <Button
          label={isSaving ? 'Сохраняем жанры…' : 'Сохранить выбранные жанры'}
          disabled={isSaving}
          onPress={() => {
            void save(game.appid, selected).then((ok) => {
              if (ok) {
                setEditing(false);
                setSelected([]);
              }
            });
          }}
        />
      )}
      {game.genresOverride && (
        <Button
          label="Вернуть автоматические жанры"
          variant="tertiary"
          disabled={isSaving}
          onPress={() => void save(game.appid, null)}
        />
      )}
      {errorMessage && (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {saved && !errorMessage && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Жанры сохранены
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    note: { color: colors.textSecondary, fontSize: fontSize.caption + 2 },
    error: { color: colors.error, fontSize: fontSize.caption + 2 },
  });
