import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontSize } from '@/shared/constants';

export interface GameCoverProps {
  name: string;
  uri: string | null;
  style?: StyleProp<ViewStyle>;
}

/** Обложка игры. Нет ссылки или картинка не загрузилась — показываем первую букву названия. */
export const GameCover = memo(function GameCover({ name, uri, style }: GameCoverProps) {
  const styles = useThemedStyles(createStyles);

  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri !== null && uri !== failedUri;
  return (
    <View
      style={[styles.box, style]}
      // Обложка декоративная: название игры и так озвучивается рядом.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Text style={styles.letter}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
      )}
    </View>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    box: {
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    letter: { color: colors.textSecondary, fontSize: fontSize.subtitle, fontWeight: '700' },
  });
